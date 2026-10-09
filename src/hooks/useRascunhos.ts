import { useRef, useState } from 'react';
import { esquemaConversa, type Conversa, type Projeto } from '../../shared/contratos';
import { lerRascunhos, possuiRascunho } from '../../shared/rascunhos';

const chave = 'selene.rascunhos.v1';

/** Mantém a composição local persistente até o primeiro envio, sem criar conversas no processo principal. */
export function useRascunhos(informarErro: (erro: string) => void) {
    const [rascunhos, definirRascunhos] = useState<Conversa[]>(() => {
        try {
            return lerRascunhos(localStorage.getItem(chave));
        } catch {
            return [];
        }
    });
    const atuais = useRef(rascunhos);

    function atualizar(novos: Conversa[]) {
        atuais.current = novos;
        definirRascunhos(novos);
        try {
            localStorage.setItem(chave, JSON.stringify(novos.filter(possuiRascunho)));
        } catch {
            informarErro('Não foi possível salvar o rascunho local. Mantenha a janela aberta para preservar o texto.');
        }
    }

    function criar(modo: 'chat' | 'code', projeto?: Projeto | null): Conversa {
        const vazio = atuais.current.find((item) => item.modo === modo && !possuiRascunho(item)
            && item.projeto === (projeto?.caminho ?? null));
        if (vazio) return vazio;
        const novo = esquemaConversa.parse({
            id: crypto.randomUUID(), titulo: 'Nova conversa', modo, projeto: projeto?.caminho ?? null,
            projetoId: projeto?.id ?? null, rascunho: '', atualizadoEm: new Date().toISOString(),
        });
        atualizar([...atuais.current.filter(possuiRascunho), novo]);
        return novo;
    }

    function alterar(conversa: Conversa, alteracao: Partial<Conversa>): Conversa {
        const anterior = atuais.current.find((item) => item.id === conversa.id) ?? conversa;
        const nova = esquemaConversa.parse({ ...anterior, ...alteracao, mensagens: [], atualizadoEm: new Date().toISOString() });
        if (!conversa.mensagens.length && alteracao.rascunho !== undefined) {
            nova.titulo = alteracao.rascunho.trim().replace(/\s+/g, ' ').slice(0, 80) || 'Nova conversa';
        }
        atualizar([...atuais.current.filter((item) => item.id !== nova.id), nova]);
        return nova;
    }

    function remover(id: string) {
        atualizar(atuais.current.filter((item) => item.id !== id));
    }

    return { rascunhos, criarRascunho: criar, alterarRascunho: alterar, removerRascunho: remover };
}
