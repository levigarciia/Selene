import { randomUUID } from 'node:crypto';
import type { Conversa } from '../../shared/contratos';

/** Serializa alterações na fila persistida e a entrega de instruções à tarefa atual. */
export class EnviosCode {
    private operacao: Promise<unknown> = Promise.resolve();

    constructor(private readonly salvar: () => Promise<void>) {}

    alterar<T>(conversa: Conversa, executar: () => T): Promise<T> {
        const proxima = this.operacao
            .catch(() => {})
            .then(async () => {
                if (conversa.modo !== 'code') throw new Error('Este envio está disponível apenas no Code.');
                const anteriores = structuredClone(conversa.enviosPendentes);
                const mensagens = [...conversa.mensagens];
                try {
                    const resultado = executar();
                    await this.salvar();
                    return resultado;
                } catch (erro) {
                    conversa.enviosPendentes = anteriores;
                    conversa.mensagens = mensagens;
                    throw erro;
                }
            });
        this.operacao = proxima;
        return proxima;
    }

    adicionar(conversa: Conversa, texto: string, tipo: 'fila' | 'direcao', validar: () => void): Promise<void> {
        return this.alterar(conversa, () => {
            validar();
            if (!texto.trim() || texto.length > 30000)
                throw new Error('Escreva uma mensagem com até 30000 caracteres.');
            const envios = (conversa.enviosPendentes ??= []);
            if (envios.length >= 20) throw new Error('A fila aceita até 20 mensagens.');
            envios.push({ id: randomUUID(), texto: texto.trim(), tipo });
        });
    }

    async receberDirecoes(conversa: Conversa): Promise<string[]> {
        await this.operacao.catch(() => {});
        if (!conversa.enviosPendentes?.some((envio) => envio.tipo === 'direcao')) return [];
        return this.alterar(conversa, () => {
            const direcoes = conversa.enviosPendentes!.filter((envio) => envio.tipo === 'direcao');
            conversa.enviosPendentes = conversa.enviosPendentes!.filter((envio) => envio.tipo !== 'direcao');
            for (const envio of direcoes) {
                const indiceResposta = conversa.mensagens.findIndex((item) => item.estado === 'gerando');
                conversa.mensagens.splice(indiceResposta < 0 ? conversa.mensagens.length : indiceResposta, 0, {
                    id: envio.id,
                    papel: 'user',
                    texto: envio.texto,
                    estado: 'concluida',
                    acoes: [],
                    criadoEm: new Date().toISOString(),
                });
            }
            return direcoes.map((envio) => envio.texto);
        });
    }
}
