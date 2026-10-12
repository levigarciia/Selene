import { z } from 'zod';
import type { Conversa } from './contratos';

const padraoUrl = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/([1-9]\d*)\/?$/i;

export const esquemaUrlPullRequest = z.string().max(2000).regex(padraoUrl);
export const esquemaPullRequest = z.object({
    url: esquemaUrlPullRequest,
    repositorio: z.string().min(3).max(250),
    numero: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    estado: z.enum(['aberto', 'fechado', 'mesclado']).optional(),
    titulo: z.string().optional(),
    branch: z.string().optional(),
    atualizadoEm: z.string().datetime().optional(),
});
export type PullRequest = z.infer<typeof esquemaPullRequest>;

/** Normaliza links de PR do GitHub antes de persistir ou consultar o vínculo. */
export function interpretarPullRequest(url: string): PullRequest | null {
    const partes = padraoUrl.exec(url.trim());
    if (!partes) return null;
    const numero = Number(partes[2]);
    if (!Number.isSafeInteger(numero)) return null;
    const repositorio = partes[1];
    return { url: `https://github.com/${repositorio}/pull/${numero}`, repositorio, numero };
}

/** Registra um PR na conversa Code sem duplicar o vínculo nem alterar mensagens ou outros projetos. */
export function vincularPullRequest(conversa: Conversa, url: string): boolean {
    if (conversa.modo !== 'code') throw new Error('Pull requests pertencem às conversas Code.');
    const pr = interpretarPullRequest(url);
    if (!pr) throw new Error('Endereço de pull request inválido.');
    const existentes = conversa.pullRequests ?? [];
    if (existentes.some((item) => item.url.toLowerCase() === pr.url.toLowerCase())) return false;
    conversa.pullRequests = [...existentes, pr];
    return true;
}

/** Remove apenas o vínculo local, sem modificar ou fechar o PR no GitHub. */
export function desvincularPullRequest(conversa: Conversa, url: string): void {
    if (conversa.modo !== 'code') throw new Error('Pull requests pertencem às conversas Code.');
    const pr = interpretarPullRequest(url);
    if (!pr) throw new Error('Endereço de pull request inválido.');
    conversa.pullRequests = (conversa.pullRequests ?? []).filter(
        (item) => item.url.toLowerCase() !== pr.url.toLowerCase(),
    );
}

/** Recupera PRs criados em ações concluídas, ignorando texto do assistente, leituras e comandos que falharam. */
export function recuperarPullRequests(conversa: Conversa): boolean {
    if (conversa.modo !== 'code' || conversa.pullRequests !== undefined) return false;
    let mudou = false;
    for (const mensagem of conversa.mensagens) {
        if (mensagem.papel !== 'assistant') continue;
        for (const acao of mensagem.acoes) {
            if (acao.estado !== 'concluida') continue;
            const comando = acao.argumentos.comando;
            const criouNoTerminal =
                acao.nome === 'executar_terminal' &&
                typeof comando === 'string' &&
                /\bgh(?:\.exe)?\s+pr\s+create\b/i.test(comando);
            const criouPorFerramenta = /(?:^|__)create_pull_request$/.test(acao.nome);
            if (!criouNoTerminal && !criouPorFerramenta) continue;
            const codigo = /^Código de saída:\s*(-?\d+)\s*$/m.exec(acao.resultado);
            if (codigo && codigo[1] !== '0') continue;
            const urls = acao.resultado.match(/https:\/\/github\.com\/[^\s"'<>]+/gi) ?? [];
            for (const url of urls) {
                const pr = interpretarPullRequest(url);
                if (pr) mudou = vincularPullRequest(conversa, pr.url) || mudou;
            }
        }
    }
    return mudou;
}
