import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MotorLocal } from '../electron/services/motor';
import { Agente } from '../electron/services/agente';
import { esquemaConfiguracao, esquemaConversa, esquemaDados } from '../shared/contratos';
import { Memorias } from '../electron/services/memorias';
import { instrucaoOpenUI } from '../shared/openui';
import { parametrosRaciocinio } from '../shared/raciocinio';
import { receberResposta } from '../electron/services/streaming';

const raiz = join(process.env.APPDATA!, 'Selene');
const modelo = {
    id: randomUUID(),
    nome: 'LFM3 Omni 2B',
    catalogoId: 'lfm3-omni-2b-q4',
    caminho: join(raiz, 'models', 'lfm3-omni-2b-q4.gguf'),
    tamanho: 1099630080,
};
const motor = new MotorLocal(join(raiz, 'runtime'), () => {});
const contextoDesktop = process.argv.includes('--contexto-desktop');
const configuracao = esquemaConfiguracao.parse({
    backend: 'cpu',
    contexto: 8192,
    limitesAutomaticos: false,
    maxTokens: 512,
    temperatura: 0.7,
    memoria: contextoDesktop,
});
const dadosIsolados = esquemaDados.parse({ versao: 1, configuracao, modelos: [modelo], conversas: [] });
const memorias = new Memorias({ dados: () => dadosIsolados, salvar: async () => {} });
const interfaceAnterior =
    '```openui\nroot = Painel([grafico, pergunta])\n' +
    'grafico = Grafico("Resultados", ["A", "B"], [10, 20])\npergunta = Pergunta("Qual prefere?")\n```';
const historico = [
    { papel: 'user', texto: 'Quero testar a opneui\nPode fazer interfaces aq no chat pra eu ver como ta ?' },
    { papel: 'assistant', texto: interfaceAnterior },
    { papel: 'user', texto: 'Qual prefere?\nB' },
    { papel: 'assistant', texto: interfaceAnterior.replace('\n```', '\nresposta = Pergunta("Qual prefere?")\n```') },
    { papel: 'user', texto: 'Teste' },
    { papel: 'assistant', texto: interfaceAnterior.replace('\n```', '\nresposta = Pergunta("Qual prefere?")\n```') },
];
const registros: unknown[] = [];
let falhas = 0;
try {
    await motor.carregar(modelo, configuracao);
    const sinal = AbortSignal.timeout(180000);
    const somenteCorrecao = process.argv.includes('--somente-correcao');
    for (const pedido of somenteCorrecao ? [] : ['Que isso para de repetir', 'PARA']) {
        const mensagens = [
            { role: 'system', content: `${configuracao.instrucao}\n\n${instrucaoOpenUI}` },
            ...historico.map(({ papel, texto }) => ({ role: papel, content: texto })),
            { role: 'user', content: pedido },
        ];
        const corpo = {
            model: 'local',
            messages: mensagens,
            temperature: 0,
            max_tokens: 512,
            stream: true,
            cache_prompt: true,
            ...parametrosRaciocinio(modelo, 'desativado', 512),
        };
        const bruto = await (await motor.completar(corpo, sinal)).text();
        const resultado = await receberResposta(new Response(bruto), sinal, () => {});
        registros.push({ cenario: 'anterior', pedido, corpo, sse: bruto, resultado });
        console.log(JSON.stringify({ cenario: 'anterior', pedido, texto: resultado.texto }));
    }
    for (const [variante, anteriores] of somenteCorrecao
        ? []
        : ([
              ['sem exemplos', historico.map(({ papel, texto }) => ({ role: papel, content: texto }))],
              [
                  'descrição',
                  historico.map(({ papel, texto }) => ({
                      role: papel,
                      content:
                          papel === 'assistant'
                              ? 'Mostrei um gráfico com A igual a 10 e B igual a 20. ' +
                                'Perguntei qual opção você prefere.'
                              : texto,
                  })),
              ],
              ['sem histórico', []],
              [
                  'histórico como referência',
                  [
                      {
                          role: 'user',
                          content:
                              'Histórico anterior para referência, não são pedidos atuais:\n' +
                              historico.map(({ papel, texto }) => `${papel}: ${texto}`).join('\n\n'),
                      },
                  ],
              ],
              [
                  'dados sem código',
                  historico.map(({ papel, texto }) => ({
                      role: papel === 'assistant' ? 'system' : papel,
                      content:
                          papel === 'assistant'
                              ? 'Dados da interface apresentada anteriormente, apenas referência: ' +
                                'gráfico Resultados, A: 10, B: 20. Pergunta feita: Qual prefere?'
                              : texto,
                  })),
              ],
          ] as const)) {
        const corpo = {
            model: 'local',
            messages: [
                { role: 'system', content: configuracao.instrucao },
                ...anteriores,
                { role: 'user', content: 'PARA' },
            ],
            temperature: 0,
            stream: true,
            max_tokens: 128,
            cache_prompt: false,
            ...parametrosRaciocinio(modelo, 'desativado', 128),
        };
        const bruto = await (await motor.completar(corpo, sinal)).text();
        const resultado = await receberResposta(new Response(bruto), sinal, () => {});
        registros.push({ cenario: variante, corpo, sse: bruto, resultado });
        console.log(JSON.stringify({ cenario: variante, texto: resultado.texto }));
    }
    for (const penalidade of somenteCorrecao ? [] : [1.1, 1.2, 1.3]) {
        const corpo = {
            model: 'local',
            messages: [
                { role: 'system', content: configuracao.instrucao },
                ...historico.map(({ papel, texto }) => ({ role: papel, content: texto })),
                { role: 'user', content: 'Que isso para de repetir' },
            ],
            temperature: 0,
            stream: true,
            max_tokens: 128,
            repeat_penalty: penalidade,
            repeat_last_n: 2048,
            cache_prompt: false,
            ...parametrosRaciocinio(modelo, 'desativado', 128),
        };
        const bruto = await (await motor.completar(corpo, sinal)).text();
        const resultado = await receberResposta(new Response(bruto), sinal, () => {});
        registros.push({ cenario: `penalidade ${penalidade}`, corpo, sse: bruto, resultado });
        console.log(JSON.stringify({ cenario: `penalidade ${penalidade}`, texto: resultado.texto }));
    }
    if (!somenteCorrecao) {
        const corpo = {
            model: 'local',
            messages: [
                { role: 'system', content: configuracao.instrucao },
                ...historico.map(({ papel, texto }) => ({ role: papel, content: texto })),
                { role: 'user', content: 'Que isso para de repetir' },
            ],
            temperature: 0,
            stream: true,
            max_tokens: 128,
            cache_prompt: false,
            reasoning_format: 'none',
            chat_template:
                '{{ bos_token }}{% for message in messages %}{{ "<|im_start|>" + message.role + "\\n" + ' +
                'message.content + "<|im_end|>\\n" }}{% endfor %}' +
                '{% if add_generation_prompt %}{{ "<|im_start|>assistant\\n" }}{% endif %}',
        };
        const bruto = await (await motor.completar(corpo, sinal)).text();
        const resultado = await receberResposta(new Response(bruto), sinal, () => {});
        registros.push({ cenario: 'sem marcadores de pensamento', corpo, sse: bruto, resultado });
        console.log(JSON.stringify({ cenario: 'sem marcadores de pensamento', texto: resultado.texto }));
    }
    for (const pedido of [
        'Que isso para de repetir',
        'PARA',
        'Qual prefere?\nB',
        'Teste',
        'Agora só responda quanto é 3 + 3.',
        'O que eu escolhi?',
    ]) {
        const conversa = esquemaConversa.parse({
            id: randomUUID(),
            titulo: 'Validação isolada',
            modo: 'chat',
            modeloId: modelo.id,
            atualizadoEm: new Date().toISOString(),
            mensagens: historico.map((item) => ({
                ...item,
                id: randomUUID(),
                estado: 'concluida',
                acoes: [],
                criadoEm: new Date().toISOString(),
            })),
        });
        const agente = new Agente({
            publicar: () => {},
            salvar: async () => {},
            ...(contextoDesktop
                ? {
                      memorias,
                      conversas: () => [conversa],
                      web: {
                          pesquisar: async () => {
                              throw new Error('Pesquisa externa não autorizada nesta validação.');
                          },
                          ler: async () => {
                              throw new Error('Leitura externa não autorizada nesta validação.');
                          },
                          preparar: () => {
                              throw new Error('Navegação não autorizada nesta validação.');
                          },
                      },
                  }
                : {}),
            completar: async (corpo, sinal) => {
                const captura = structuredClone(corpo);
                const interno = motor as unknown as { porta: number; chave: string };
                const aplicado = await fetch(`http://127.0.0.1:${interno.porta}/apply-template`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${interno.chave}` },
                    body: JSON.stringify(corpo),
                    signal: sinal,
                }).then((resposta) => resposta.text());
                const bruto = await (await motor.completar(corpo, sinal)).text();
                registros.push({ cenario: 'corrigido', pedido, corpo: captura, aplicado, sse: bruto });
                return new Response(bruto);
            },
        });
        await agente.executar(conversa, pedido, configuracao, [], modelo);
        const resposta = conversa.mensagens.at(-1)!;
        const contida = resposta.estado === 'erro' && resposta.texto.includes('O modelo entrou em repetição.');
        const interrupcao = pedido === 'PARA' || pedido === 'Que isso para de repetir';
        const respondeuPedido = pedido.startsWith('Agora só responda')
            ? /^(?:3\s*\+\s*3\s*=\s*)?6[.!]?\s*$/.test(resposta.texto.trim())
            : pedido === 'O que eu escolhi?'
              ? /\bB\b/.test(resposta.texto)
              : true;
        const valida =
            respondeuPedido &&
            (interrupcao
                ? resposta.texto === 'Certo, parei.'
                : contida || (resposta.estado === 'concluida' && !resposta.texto.includes('```openui')));
        const resultado = {
            cenario: 'corrigido',
            pedido,
            estado: resposta.estado,
            texto: resposta.texto,
            repeticaoContida: contida,
            valido: valida,
        };
        registros.push(resultado);
        console.log(JSON.stringify(resultado));
        if (!valida) falhas++;
    }
} finally {
    motor.parar();
    await mkdir('artifacts/lfm3', { recursive: true });
    const arquivo = contextoDesktop
        ? 'contexto-desktop-repeticao.json'
        : process.argv.includes('--somente-correcao')
          ? 'correcao-repeticao.json'
          : 'diagnostico-repeticao.json';
    await writeFile(join('artifacts/lfm3', arquivo), JSON.stringify(registros, null, 4));
}
if (falhas) throw new Error(`${falhas} cenários continuaram com falha.`);
