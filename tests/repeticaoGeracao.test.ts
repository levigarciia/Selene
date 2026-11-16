import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Agente } from '../electron/services/agente';
import { esquemaConfiguracao, esquemaConversa } from '../shared/contratos';
import { temParagrafosRepetidos, temRepeticaoDegenerada } from '../electron/services/repeticaoGeracao';
import { ErroRepeticaoGeracao } from '../electron/services/repeticaoGeracao';
import { receberResposta } from '../electron/services/streaming';

const bloco = '```openui\nroot = Painel([grafico])\ngrafico = Grafico("Resultados", ["A", "B"], [10, 20])\n```\n';

test('identifica ciclos de parágrafos com pequenas variações sem rejeitar código ou assuntos distintos', () => {
    const paragrafo =
        'O teste foi realizado. A interface apresentada anteriormente mostra os resultados ' +
        'de cada opção na comparação do gráfico. O usuário preferiu a opção B, cujo valor informado é 20.';
    const repetido = [paragrafo, paragrafo.replace('20', '10'), paragrafo.replace('informado', 'apresentado')].join(
        '\n\n',
    );
    expect(temParagrafosRepetidos(repetido)).toBe(true);
    expect(temParagrafosRepetidos(`\`\`\`text\n${repetido}\n\`\`\``)).toBe(false);
    expect(
        temParagrafosRepetidos(
            paragrafo +
                '\n\n' +
                'Detalhes diferentes sobre o carregamento do motor. '.repeat(3) +
                '\n\n' +
                'Outra explicação sobre processamento de imagens e o envio de anexos. '.repeat(3),
        ),
    ).toBe(false);
});

test('detecta o ciclo observado no motor mesmo com parágrafos diferentes entre as repetições', () => {
    const trechos = [
        'Para testar a opneui, a interface apresentada anteriormente mostra os resultados: ' +
            'A: 20 e B: 10. O usuário preferiu a opção B.',
        'Resposta anterior: Interface apresentada anteriormente:\nGráfico Resultados: A: 10, B: **B: 20**.\n' +
            'Pergunta feita: Qual prefere?',
        'Teste foi realizado. A interface apresentada anteriormente mostra os resultados: ' +
            'A: 20 e B: 10. O usuário preferiu a opção B.',
        'Pedido anterior: Teste',
        'Teste foi realizado. A interface apresentados anteriormente mostra os results: ' +
            'A: 20 e B: 10. O usuário preferiu a opção B.',
        'Pedido: Teste',
        'Teste foi realizado. A interface apresentada anteriormente mostra os results: ' +
            'A: 20 e B: 10. O usuário preferiu a opção B.',
    ];
    expect(temParagrafosRepetidos(trechos.join('\n\n'))).toBe(true);
});

test('cancela a leitura ao detectar repetição em texto, raciocínio e argumentos', async () => {
    for (const campo of ['content', 'reasoning_content', 'tool_calls']) {
        let cancelado = false;
        const delta =
            campo === 'tool_calls'
                ? {
                      tool_calls: [
                          { index: 0, id: 'teste', function: { name: 'escrever_arquivo', arguments: bloco.repeat(4) } },
                      ],
                  }
                : { [campo]: bloco.repeat(4) };
        const fluxo = new ReadableStream({
            start(controlador) {
                controlador.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`));
            },
            cancel() {
                cancelado = true;
            },
        });
        await expect(
            receberResposta(new Response(fluxo), new AbortController().signal, () => {}),
        ).rejects.toBeInstanceOf(ErroRepeticaoGeracao);
        expect(cancelado).toBe(true);
    }
});

function evento(texto: string) {
    return new Response(
        `data: ${JSON.stringify({
            choices: [{ delta: { content: texto }, finish_reason: 'stop' }],
        })}\n\ndata: [DONE]\n\n`,
    );
}

test('detecta ciclos e preserva repetição curta e conteúdo variado', () => {
    expect(temRepeticaoDegenerada(bloco.repeat(3))).toBe(true);
    expect(temRepeticaoDegenerada('abc'.repeat(300))).toBe(true);
    expect(temRepeticaoDegenerada(bloco)).toBe(false);
    expect(temRepeticaoDegenerada('Sim. Sim. Sim.')).toBe(false);
    expect(temRepeticaoDegenerada(Array.from({ length: 100 }, (_, i) => `${i}: valor ${i * 2}\n`).join(''))).toBe(
        false,
    );
});

for (const persistente of [false, true]) {
    test(`recupera repetição com limite sem preservar tentativa inválida: ${persistente}`, async () => {
        const conversa = esquemaConversa.parse({
            id: randomUUID(),
            titulo: 'Teste',
            modo: 'chat',
            atualizadoEm: new Date().toISOString(),
        });
        let chamadas = 0;
        const agente = new Agente({
            publicar: () => {},
            salvar: async () => {},
            completar: async (corpo) => {
                chamadas++;
                if (chamadas === 2) expect(JSON.stringify(corpo)).toContain('entrou em repetição');
                return evento(chamadas === 1 || persistente ? bloco.repeat(4) : 'Resposta recuperada');
            },
        });
        await agente.executar(conversa, 'Mostre uma dashboard', esquemaConfiguracao.parse({}));
        expect(chamadas).toBe(2);
        const resposta = conversa.mensagens.at(-1)!;
        expect(resposta.estado).toBe(persistente ? 'erro' : 'concluida');
        expect(resposta.texto).not.toContain('```openui');
        expect(resposta.texto).toContain(persistente ? 'entrou em repetição' : 'Resposta recuperada');
    });
}

for (const persistente of [false, true]) {
    test(`rejeita interface copiada de outro turno antes de publicar: ${persistente}`, async () => {
        const conversa = esquemaConversa.parse({
            id: randomUUID(),
            titulo: 'Teste',
            modo: 'chat',
            atualizadoEm: new Date().toISOString(),
            mensagens: [
                {
                    id: randomUUID(),
                    papel: 'assistant',
                    texto: bloco,
                    estado: 'concluida',
                    acoes: [],
                    criadoEm: new Date().toISOString(),
                },
            ],
        });
        let chamadas = 0;
        const publicacoes: string[] = [];
        const agente = new Agente({
            publicar: (mensagem) => publicacoes.push(mensagem.texto),
            salvar: async () => {},
            completar: async (corpo) => {
                chamadas++;
                if (chamadas === 2) {
                    expect(JSON.stringify(corpo)).not.toContain('Grafico(\\"Resultados');
                    expect((corpo as { messages: { content: string }[] }).messages.at(-1)?.content).toBe('Teste');
                    expect(JSON.stringify(corpo)).toContain('A: 10');
                }
                return evento(chamadas === 1 || persistente ? bloco : 'Certo, parei.');
            },
        });
        await agente.executar(conversa, 'Teste', esquemaConfiguracao.parse({}));
        expect(chamadas).toBe(2);
        expect(conversa.mensagens[0].texto).toBe(bloco);
        expect(conversa.mensagens.at(-1)?.estado).toBe(persistente ? 'erro' : 'concluida');
        expect(publicacoes.every((texto) => !texto.includes('```openui'))).toBe(true);
    });
}
