import type { Resultado } from '../../shared/contratos';
import { z } from 'zod';

/** Compartilha operações validadas entre o aplicativo e o servidor web. */
export class Operacoes {
    private readonly operacoes = new Map<string, (entrada: unknown) => Promise<Resultado<unknown>>>();

    registrar<T extends z.ZodType>(
        nome: string,
        esquema: T,
        executar: (argumentos: z.infer<T>) => Promise<unknown> | unknown,
    ): void {
        if (this.operacoes.has(nome)) throw new Error(`Operação duplicada: ${nome}.`);
        this.operacoes.set(nome, async (entrada) => {
            try {
                return { ok: true, valor: await executar(esquema.parse(entrada)) };
            } catch (erro) {
                return { ok: false, erro: erro instanceof Error ? erro.message : 'Operação não concluída.' };
            }
        });
    }

    async executar(nome: string, entrada: unknown): Promise<Resultado<unknown>> {
        const executar = this.operacoes.get(nome);
        if (!executar) return { ok: false, erro: 'Operação não encontrada.' };
        return executar(entrada);
    }
}
