import { randomUUID } from 'node:crypto';
import { spawn, type IPty } from 'node-pty';
import type { DimensoesTerminal, EventoTerminal } from '../../shared/repositorio';

const LIMITE_HISTORICO = 200_000;

interface Terminal {
    processo: IPty;
    projetoId: string;
    historico: string;
}

function shellPadrao(): { executavel: string; argumentos: string[] } {
    if (process.platform === 'win32') return { executavel: 'powershell.exe', argumentos: ['-NoLogo'] };
    return { executavel: process.env.SHELL || '/bin/bash', argumentos: ['-l'] };
}

/**
 * Mantém os shells interativos dos projetos Code. Use somente a partir da janela do desktop:
 * um terminal concede o mesmo acesso do usuário ao computador.
 */
export class Terminais {
    private readonly abertos = new Map<string, Terminal>();

    constructor(private readonly publicar: (evento: EventoTerminal) => void) {}

    abrir(projetoId: string, pasta: string, dimensoes: DimensoesTerminal, comando?: string): string {
        const id = randomUUID();
        const { executavel, argumentos } = shellPadrao();
        const processo = spawn(executavel, argumentos, {
            name: 'xterm-256color',
            cols: dimensoes.colunas,
            rows: dimensoes.linhas,
            cwd: pasta,
            env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' } as Record<string, string>,
        });
        const terminal: Terminal = { processo, projetoId, historico: '' };
        this.abertos.set(id, terminal);
        processo.onData((dados) => {
            terminal.historico = (terminal.historico + dados).slice(-LIMITE_HISTORICO);
            this.publicar({ tipo: 'terminalDados', id, dados });
        });
        processo.onExit(({ exitCode }) => {
            this.abertos.delete(id);
            this.publicar({ tipo: 'terminalFim', id, codigo: exitCode });
        });
        if (comando) processo.write(`${comando}\r`);
        return id;
    }

    historico(id: string): string {
        return this.exigir(id).historico;
    }

    escrever(id: string, dados: string): void {
        this.exigir(id).processo.write(dados);
    }

    redimensionar(id: string, dimensoes: DimensoesTerminal): void {
        this.exigir(id).processo.resize(dimensoes.colunas, dimensoes.linhas);
    }

    fechar(id: string): void {
        const terminal = this.abertos.get(id);
        if (!terminal) return;
        this.abertos.delete(id);
        terminal.processo.kill();
    }

    fecharProjeto(projetoId: string): void {
        for (const [id, terminal] of this.abertos) if (terminal.projetoId === projetoId) this.fechar(id);
    }

    encerrar(): void {
        for (const id of [...this.abertos.keys()]) this.fechar(id);
    }

    private exigir(id: string): Terminal {
        const terminal = this.abertos.get(id);
        if (!terminal) throw new Error('Terminal encerrado.');
        return terminal;
    }
}
