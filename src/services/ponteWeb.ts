import { criarPonte } from '../../shared/ponte';
import type { Resultado } from '../../shared/contratos';
import { exportarMarkdown } from '../../shared/exportacao';
import { assinarEventosWeb } from './eventosWeb';

/** Conecta a interface web ao estado e às operações do desktop. */
export function instalarPonteWeb(): void {
    const ponte = criarPonte({
        invocar: async <T>(nome: string, ...argumentos: unknown[]): Promise<Resultado<T>> => {
            try {
                while (argumentos.length && argumentos.at(-1) === undefined) argumentos.pop();
                const resposta = await fetch('/api/operacao', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome, argumentos }),
                });
                if (resposta.status === 401) window.dispatchEvent(new Event('selene:sessaoEncerrada'));
                return await resposta.json();
            } catch {
                return { ok: false, erro: 'Sem conexão com a Selene. Verifique se ela está aberta no computador.' };
            }
        },
        janela: () => {},
        assinar: assinarEventosWeb,
    });
    ponte.exportarConversa = async (id) => {
        try {
            const resultado = await ponte.estado();
            if (!resultado.ok) return resultado;
            const conversa = resultado.valor.conversas.find((item) => item.id === id);
            if (!conversa) return { ok: false, erro: 'Conversa não encontrada.' };
            const texto = await exportarMarkdown(conversa, async (imagemId) => {
                const imagem = await ponte.lerImagem(imagemId);
                if (!imagem.ok) throw new Error(imagem.erro);
                return imagem.valor;
            });
            const endereco = URL.createObjectURL(new Blob([texto], { type: 'text/markdown;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = endereco;
            link.download = `${conversa.titulo.replace(/[<>:"/\\|?*]/g, '').slice(0, 70) || 'conversa'}.md`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(endereco), 1000);
            return { ok: true, valor: undefined };
        } catch (erro) {
            return { ok: false, erro: erro instanceof Error ? erro.message : 'Não foi possível exportar.' };
        }
    };
    window.selene = ponte;
}
