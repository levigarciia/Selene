import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { prepararReferenciasInterfaces } from '../electron/services/contextoInterfaces';
import type { MensagemModelo } from '../electron/services/contexto';
import { Agente } from '../electron/services/agente';
import { esquemaConfiguracao, esquemaConversa } from '../shared/contratos';

const interfaceAnterior =
    '```openui\nroot = Painel([grafico, pergunta])\n' +
    'grafico = Grafico("Resultados", ["A", "B"], [10, 20])\npergunta = Pergunta("Qual prefere?")\n```';

test('preserva instruções, valores e escolhas como dados sem repetir exemplos de respostas', () => {
    const mensagens: MensagemModelo[] = [
        { role: 'system', content: 'Instruções originais.' },
        { role: 'user', content: 'Mostre um gráfico.' },
        { role: 'assistant', content: interfaceAnterior },
        { role: 'user', content: 'Qual prefere?\nB' },
        { role: 'assistant', content: interfaceAnterior },
    ];
    const antes = structuredClone(mensagens);
    const preparadas = prepararReferenciasInterfaces(mensagens);
    expect(preparadas).toHaveLength(2);
    expect(preparadas[0]).toEqual(mensagens[0]);
    expect(preparadas[1].role).toBe('user');
    expect(preparadas[1].content).toContain('A: 10, B: 20');
    expect(preparadas[1].content).toContain('Qual prefere?\\nB');
    expect(preparadas[1].content).toContain('"interfaceRepetidaDe":1');
    expect(preparadas[1].content).not.toContain('root =');
    expect(mensagens).toEqual(antes);
    expect(prepararReferenciasInterfaces(mensagens, 'Repita a interface')).toBe(mensagens);
});

test('não reorganiza conversas comuns, chamadas de ferramentas nem anexos', () => {
    const sistema = { role: 'system', content: 'Instruções.' };
    for (const mensagens of [
        [sistema, { role: 'assistant', content: 'Olá.' }],
        [sistema, { role: 'assistant', content: interfaceAnterior }, { role: 'tool', content: 'Resultado.' }],
        [
            sistema,
            { role: 'assistant', content: interfaceAnterior },
            {
                role: 'user',
                content: [{ type: 'image_url' as const, image_url: { url: 'data:image/png;base64,AA==' } }],
            },
        ],
    ]) {
        expect(prepararReferenciasInterfaces(mensagens)).toBe(mensagens);
    }
});

for (const lfm3 of [true, false]) {
    test(`reorganiza somente o contexto do LFM3 local: ${lfm3}`, async () => {
        const conversa = esquemaConversa.parse({
            id: randomUUID(),
            titulo: 'Teste',
            modo: 'chat',
            atualizadoEm: new Date().toISOString(),
            mensagens: [
                {
                    id: randomUUID(),
                    papel: 'assistant',
                    texto: interfaceAnterior,
                    estado: 'concluida',
                    acoes: [],
                    criadoEm: new Date().toISOString(),
                },
            ],
        });
        const agente = new Agente({
            salvar: async () => {},
            publicar: () => {},
            completar: async (corpo) => {
                const mensagens = (corpo as { messages: MensagemModelo[] }).messages;
                expect(mensagens.at(-1)?.content).toBe('Quanto é 3 + 3?');
                expect(mensagens.some((mensagem) => mensagem.role === 'assistant')).toBe(!lfm3);
                return new Response('data: {"choices":[{"delta":{"content":"6"},"finish_reason":"stop"}]}\n\n');
            },
        });
        const modelo = {
            id: randomUUID(),
            nome: lfm3 ? 'LFM3 Omni 2B' : 'Qwen 3.5 9B',
            caminho: lfm3 ? 'lfm3-omni-2b-q4.gguf' : 'qwen3.5-9b.gguf',
            tamanho: 1,
        };
        await agente.executar(conversa, 'Quanto é 3 + 3?', esquemaConfiguracao.parse({}), [], modelo);
        expect(conversa.mensagens.at(-1)?.estado).toBe('concluida');
        expect(conversa.mensagens[0].texto).toBe(interfaceAnterior);
    });
}
