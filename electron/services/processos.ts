import { spawn, type ChildProcess } from 'node:child_process';

/** Encerra uma árvore de processos da tarefa, incluindo subprocessos no Windows. */
export function encerrarProcesso(processo: ChildProcess): void {
    if (!processo.pid || processo.exitCode !== null) return;
    if (process.platform === 'win32') {
        const encerramento = spawn('taskkill', ['/pid', String(processo.pid), '/t', '/f'], {
            windowsHide: true,
            stdio: 'ignore',
        });
        encerramento.on('error', () => processo.kill());
        return;
    }
    try {
        process.kill(-processo.pid, 'SIGKILL');
    } catch {
        processo.kill('SIGKILL');
    }
}

/** Executa processos limitados no tempo e cancela sua árvore quando a tarefa é interrompida. */
export function executarProcesso(
    executavel: string,
    argumentos: string[],
    pasta: string,
    sinal: AbortSignal,
    ambiente?: NodeJS.ProcessEnv,
    limiteMs = 60000,
): Promise<{ codigo: number | null; saida: string }> {
    sinal.throwIfAborted();
    return new Promise((resolver, rejeitar) => {
        const processo = spawn(executavel, argumentos, {
            cwd: pasta,
            windowsHide: true,
            detached: process.platform !== 'win32',
            env: ambiente ?? process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let saida = '';
        let expirou = false;
        const adicionar = (trecho: Buffer) => {
            saida = (saida + trecho.toString()).slice(-30000);
        };
        processo.stdout.on('data', adicionar);
        processo.stderr.on('data', adicionar);
        const cancelar = () => encerrarProcesso(processo);
        const temporizador = setTimeout(() => {
            expirou = true;
            cancelar();
        }, limiteMs);
        sinal.addEventListener('abort', cancelar, { once: true });
        const limpar = () => {
            clearTimeout(temporizador);
            sinal.removeEventListener('abort', cancelar);
        };
        processo.once('error', (erro) => {
            limpar();
            rejeitar(erro);
        });
        processo.once('close', (codigo) => {
            limpar();
            if (sinal.aborted) {
                rejeitar(sinal.reason);
                return;
            }
            resolver({ codigo, saida: expirou ? `${saida}\nTempo limite atingido. Processo encerrado.` : saida });
        });
    });
}
