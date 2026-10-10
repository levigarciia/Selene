import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { scriptComputador } from './scriptComputador';
import { encerrarProcesso } from './processos';
import type { ComandoComputador } from '../../shared/computador';
import { selecionarElementosComputador } from '../../shared/elementosComputador';

export const esquemaObservacaoComputador = z.object({
    ok: z.literal(true),
    observacao: z.string().uuid(),
    janela: z.string(),
    titulo: z.string(),
    leituraParcial: z.boolean(),
    limites: z.object({ x: z.number(), y: z.number(), largura: z.number(), altura: z.number() }).nullable(),
    janelas: z.array(z.object({ janela: z.string(), titulo: z.string() })),
    elementos: z.array(
        z.object({
            referencia: z.string(),
            nome: z.string(),
            tipo: z.string(),
            habilitado: z.boolean(),
            editavel: z.boolean(),
            valor: z.string().nullable(),
            x: z.number(),
            y: z.number(),
        }),
    ),
});
export type ObservacaoComputador = z.infer<typeof esquemaObservacaoComputador>;

/** Mantém um controlador nativo limitado a comandos estruturados, sem executar código fornecido pelo modelo. */
export class ControladorComputador {
    private processo?: ChildProcessWithoutNullStreams;
    private pendente?: { resolver: (valor: ObservacaoComputador) => void; rejeitar: (erro: Error) => void };

    private iniciar(): ChildProcessWithoutNullStreams {
        if (this.processo) return this.processo;
        if (process.platform !== 'win32') throw new Error('O controle do computador requer Windows.');
        const pasta = mkdtempSync(join(tmpdir(), 'selene-computador-'));
        const arquivo = join(pasta, 'controlador.ps1');
        writeFileSync(arquivo, `\ufeff${scriptComputador}`, 'utf8');
        const processo = spawn(
            'powershell.exe',
            ['-NoProfile', '-Mta', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', arquivo],
            {
                windowsHide: true,
                stdio: ['pipe', 'pipe', 'pipe'],
            },
        );
        this.processo = processo;
        let erroInicializacao = '';
        processo.stderr.on('data', (dados: Buffer) => {
            erroInicializacao = (erroInicializacao + dados.toString()).slice(-2000);
        });
        const linhas = createInterface({ input: processo.stdout });
        linhas.on('line', (linha) => {
            const pendente = this.pendente;
            if (!pendente) return;
            this.pendente = undefined;
            try {
                const valor = JSON.parse(linha);
                if (!valor.ok) throw new Error(String(valor.erro || 'O controlador nativo falhou.'));
                const observacao = esquemaObservacaoComputador.parse(valor);
                const elementos = selecionarElementosComputador(observacao.elementos);
                pendente.resolver({
                    ...observacao,
                    elementos,
                    leituraParcial: observacao.leituraParcial || elementos.length < observacao.elementos.length,
                });
            } catch (erro) {
                pendente.rejeitar(erro instanceof Error ? erro : new Error('Resposta nativa inválida.'));
            }
        });
        const falhar = (erro: Error) => {
            if (this.processo !== processo) return;
            this.processo = undefined;
            this.pendente?.rejeitar(erro);
            this.pendente = undefined;
            linhas.close();
        };
        processo.on('error', falhar);
        processo.on('close', () => falhar(new Error(erroInicializacao || 'O controlador nativo foi encerrado.')));
        processo.once('close', () => {
            try {
                unlinkSync(arquivo);
                rmdirSync(pasta);
            } catch {}
        });
        processo.stdin.on('error', falhar);
        return processo;
    }

    async executar(comando: ComandoComputador, sinal: AbortSignal): Promise<ObservacaoComputador> {
        sinal.throwIfAborted();
        if (this.pendente) throw new Error('Já existe uma ação nativa em execução.');
        const processo = this.iniciar();
        let cancelar = () => {};
        let tempo: ReturnType<typeof setTimeout> | undefined;
        try {
            return await new Promise<ObservacaoComputador>((resolver, rejeitar) => {
                this.pendente = { resolver, rejeitar };
                cancelar = () => {
                    rejeitar(new Error('Controle interrompido. Observe novamente antes de repetir uma ação.'));
                    this.encerrar();
                };
                sinal.addEventListener('abort', cancelar, { once: true });
                tempo = setTimeout(cancelar, 15000);
                processo.stdin.write(`${JSON.stringify({ ...comando, processoSelene: process.pid })}\n`);
            });
        } finally {
            clearTimeout(tempo);
            sinal.removeEventListener('abort', cancelar);
        }
    }

    encerrar(): void {
        const processo = this.processo;
        this.pendente?.rejeitar(new Error('Controle do computador encerrado.'));
        this.pendente = undefined;
        this.processo = undefined;
        if (processo) encerrarProcesso(processo);
    }
}
