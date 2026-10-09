import { z } from 'zod';
import type { Desempenho } from '../../shared/contratos';

const esquemaTempos = z.object({
    predicted_n: z.number().int().nonnegative(),
    predicted_ms: z.number().nonnegative(),
    predicted_per_second: z.number().nonnegative(),
    prompt_n: z.number().int().nonnegative().optional(),
});
const esquemaUso = z.object({ prompt_tokens: z.number().int().nonnegative() });

const esquemaTrecho = z.object({
    choices: z.array(
        z.object({
            delta: z.object({
                content: z.string().nullable().optional(),
                tool_calls: z
                    .array(
                        z.object({
                            index: z.number().int().nonnegative(),
                            id: z.string().optional(),
                            function: z
                                .object({ name: z.string().optional(), arguments: z.string().optional() })
                                .optional(),
                        }),
                    )
                    .optional(),
            }),
            finish_reason: z.string().nullable().optional(),
        }),
    ),
});
export type Chamada = { id: string; nome: string; argumentos: string };

/** Lê SSE mesmo quando bytes UTF 8 e linhas chegam separados entre vários pacotes. */
export async function lerEventos(
    resposta: Response,
    receber: (dados: string) => void,
    sinal: AbortSignal,
): Promise<void> {
    if (!resposta.ok)
        throw new Error(`Falha no modelo: HTTP ${resposta.status}. ${(await resposta.text()).slice(0, 2000)}`);
    if (!resposta.body) throw new Error('O modelo retornou uma resposta vazia.');
    const leitor = resposta.body.getReader();
    const decodificador = new TextDecoder();
    let pendente = '';
    let evento: string[] = [];
    let terminou = false;
    const processarLinha = (linha: string) => {
        if (linha === '') {
            const dados = evento.join('\n');
            evento = [];
            if (dados === '[DONE]') terminou = true;
            else if (dados) receber(dados);
            return;
        }
        if (linha.startsWith('data:')) evento.push(linha.slice(5).trimStart());
    };
    try {
        while (!terminou) {
            sinal.throwIfAborted();
            const { value, done } = await leitor.read();
            pendente += done ? decodificador.decode() : decodificador.decode(value, { stream: true });
            const linhas = pendente.split('\n');
            pendente = linhas.pop() ?? '';
            for (const linha of linhas) processarLinha(linha.replace(/\r$/, ''));
            if (done) {
                if (pendente) processarLinha(pendente.replace(/\r$/, ''));
                processarLinha('');
                break;
            }
        }
    } finally {
        await leitor.cancel().catch(() => {});
        leitor.releaseLock();
    }
}

/** Acumula texto e chamadas de ferramentas sem executar instruções contidas no texto gerado. */
export async function receberResposta(
    resposta: Response,
    sinal: AbortSignal,
    adicionarTexto: (texto: string) => void,
    adicionarChamada?: (chamada: Chamada) => void,
): Promise<{ texto: string; chamadas: Chamada[]; motivo: string | null; desempenho?: Desempenho }> {
    let texto = '';
    let motivo: string | null = null;
    const chamadas = new Map<number, Chamada>();
    let desempenho: Desempenho | undefined;
    let tokensEntrada: number | undefined;
    await lerEventos(
        resposta,
        (dados) => {
            const bruto = JSON.parse(dados);
            if (bruto.error) throw new Error(bruto.error.message ?? 'O modelo retornou um erro.');
            const evento = esquemaTrecho.parse(bruto);
            const uso = esquemaUso.safeParse(bruto.usage);
            if (uso.success) tokensEntrada = uso.data.prompt_tokens;
            const tempos = esquemaTempos.safeParse(bruto.timings);
            if (tempos.success) {
                desempenho = {
                    tokensGerados: tempos.data.predicted_n,
                    tempoGeracaoMs: tempos.data.predicted_ms,
                    tokensPorSegundo: tempos.data.predicted_per_second,
                    ...(tempos.data.prompt_n !== undefined ? { tokensEntrada: tempos.data.prompt_n } : {}),
                };
            }
            const escolha = evento.choices[0];
            if (!escolha) return;
            if (escolha.finish_reason) motivo = escolha.finish_reason;
            if (escolha.delta.content) {
                texto += escolha.delta.content;
                adicionarTexto(escolha.delta.content);
            }
            for (const parte of escolha.delta.tool_calls ?? []) {
                const chamada = chamadas.get(parte.index) ?? { id: '', nome: '', argumentos: '' };
                chamada.id += parte.id ?? '';
                chamada.nome += parte.function?.name ?? '';
                chamada.argumentos += parte.function?.arguments ?? '';
                chamadas.set(parte.index, chamada);
                if (adicionarChamada) {
                    adicionarChamada({
                        id: chamada.id,
                        nome: chamada.nome,
                        argumentos: chamada.argumentos,
                    });
                }
            }
        },
        sinal,
    );
    if (!motivo) throw new Error('O fluxo do modelo encerrou antes de confirmar a conclusão da resposta.');
    if (desempenho && tokensEntrada !== undefined) desempenho.tokensEntrada = tokensEntrada;
    return { texto, chamadas: [...chamadas.values()], motivo, desempenho };
}
