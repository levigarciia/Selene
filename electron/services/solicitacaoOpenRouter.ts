import { setTimeout as esperar } from 'node:timers/promises';
import { z } from 'zod';

const esquemaErro = z.object({
    error: z.object({
        code: z.number().optional(),
        message: z.string().optional(),
        metadata: z
            .object({
                raw: z.string().optional(),
                limit_source: z.string().optional(),
                headers: z.record(z.string(), z.string()).optional(),
            })
            .optional(),
    }),
});

/** Interpreta falhas remotas sem expor credenciais ou o corpo bruto do provedor na conversa. */
export function interpretarErroOpenRouter(status: number, dados: unknown, cabecalhos = new Headers()) {
    const resultado = esquemaErro.safeParse(dados);
    const erro = resultado.success ? resultado.data.error : undefined;
    const detalhe = `${erro?.message ?? ''} ${erro?.metadata?.raw ?? ''}`;
    const diario = /free.models.per.day|daily|per day|diári/i.test(detalhe);
    const depois = cabecalhos.get('retry-after');
    const segundos = depois !== null && depois.trim() !== '' ? Number(depois) : NaN;
    const data = depois ? Date.parse(depois) : NaN;
    const reinicio = Number(erro?.metadata?.headers?.['X-RateLimit-Reset']);
    const esperaMs =
        Number.isFinite(segundos) && segundos >= 0
            ? segundos * 1000
            : Number.isFinite(data)
              ? Math.max(0, data - Date.now())
              : Number.isFinite(reinicio) && reinicio > Date.now()
                ? reinicio - Date.now()
                : undefined;
    const temporario =
        !diario &&
        (status === 429 ||
            status === 503 ||
            (status === 402 && erro?.metadata?.limit_source === 'openrouter_in_flight_budget'));
    let mensagem = `OpenRouter: não foi possível concluir a solicitação (HTTP ${status}).`;
    if (status === 401) mensagem = 'OpenRouter: chave de API inválida ou expirada. Atualize a chave nas configurações.';
    else if (status === 402 && !temporario)
        mensagem = 'OpenRouter: saldo ou limite de créditos insuficiente. Verifique sua conta e o limite da chave.';
    else if (status === 429 && diario)
        mensagem = 'OpenRouter: limite diário de modelos gratuitos atingido. Aguarde a renovação da cota.';
    else if (status === 429)
        mensagem =
            'OpenRouter: limite temporário de solicitações atingido. Tente novamente mais tarde ou escolha outro modelo.';
    else if (temporario) mensagem = 'OpenRouter: serviço temporariamente indisponível. Tente novamente mais tarde.';
    if (temporario && esperaMs !== undefined)
        mensagem += ` Aguarde ${Math.max(1, Math.ceil(esperaMs / 1000))} segundos.`;
    return { mensagem, temporario, esperaMs };
}

/** Repete apenas falhas temporárias antes do início da resposta, respeitando a espera e o cancelamento. */
export async function solicitarOpenRouter(
    opcoes: RequestInit & { signal: AbortSignal },
    dependencias = {
        enviar: (entrada: string, parametros: RequestInit) => fetch(entrada, parametros),
        aguardar: (tempo: number, sinal: AbortSignal) => esperar(tempo, undefined, { signal: sinal }),
    },
): Promise<Response> {
    for (let tentativa = 0; ; tentativa++) {
        opcoes.signal.throwIfAborted();
        const resposta = await dependencias.enviar('https://openrouter.ai/api/v1/chat/completions', opcoes);
        if (resposta.ok) return resposta;
        const dados: unknown = await resposta.json().catch(() => undefined);
        const falha = interpretarErroOpenRouter(resposta.status, dados, resposta.headers);
        const esperaMs = falha.esperaMs ?? 1000 * 2 ** tentativa;
        if (!falha.temporario || tentativa >= 2 || esperaMs > 30000) throw new Error(falha.mensagem);
        await dependencias.aguardar(esperaMs, opcoes.signal);
    }
}
