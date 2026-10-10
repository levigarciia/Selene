import { useEffect, useRef, useState } from 'react';
import { esquemaConversa, type Conversa, type Projeto } from '../../shared/contratos';
import { lerRascunhos, possuiRascunho } from '../../shared/rascunhos';
import { criarIdentificador } from '../utils/identificador';

const chave = 'selene.rascunhos.v1';

/** Mantém a composição local persistente até o primeiro envio, sem criar conversas no processo principal. */
export function useRascunhos(informarErro: (erro: string) => void) {
    const falhaLeitura = useRef(false);
    const [rascunhos, definirRascunhos] = useState<Conversa[]>(() => {
        try {
            return lerRascunhos(localStorage.getItem(chave));
        } catch {
            falhaLeitura.current = true;
            return [];
        }
    });
    const atuais = useRef(rascunhos);
    useEffect(() => {
        if (falhaLeitura.current) {
            informarErro('Não foi possível recuperar os rascunhos locais. Os dados originais serão preservados.');
        }
    }, []);

    function atualizar(novos: Conversa[]) {
        atuais.current = novos;
        definirRascunhos(novos);
        try {
            if (falhaLeitura.current) {
                const original = localStorage.getItem(chave);
                if (original) localStorage.setItem(`${chave}.recuperacao`, original);
                falhaLeitura.current = false;
            }
            const textos = novos
                .filter((item) => item.rascunho?.trim())
                .map((item) => ({ ...item, anexosRascunho: 0 }));
            localStorage.setItem(chave, JSON.stringify(textos));
        } catch {
            informarErro('Não foi possível salvar o rascunho local. Mantenha a janela aberta para preservar o texto.');
        }
    }

    function criar(
        modo: 'chat' | 'code',
        projeto?: Projeto | null,
        existentes: string[] = [],
        projetoChatId: string | null = null,
    ): Conversa {
        const vazio = atuais.current.find(
            (item) =>
                item.modo === modo &&
                !existentes.includes(item.id) &&
                !possuiRascunho(item) &&
                item.projeto === (projeto?.caminho ?? null) &&
                (item.projetoChatId ?? null) === projetoChatId,
        );
        if (vazio) return vazio;
        const novo = esquemaConversa.parse({
            id: criarIdentificador(),
            titulo: 'Nova conversa',
            modo,
            projeto: projeto?.caminho ?? null,
            projetoId: projeto?.id ?? null,
            projetoChatId,
            rascunho: '',
            atualizadoEm: new Date().toISOString(),
        });
        atualizar([...atuais.current.filter(possuiRascunho), novo]);
        return novo;
    }

    function alterar(conversa: Conversa, alteracao: Partial<Conversa>): Conversa {
        const anterior = atuais.current.find((item) => item.id === conversa.id) ?? conversa;
        const nova = esquemaConversa.parse({
            ...anterior,
            ...alteracao,
            mensagens: [],
            atualizadoEm: new Date().toISOString(),
        });
        if (!conversa.mensagens.length && alteracao.rascunho !== undefined) {
            nova.titulo = alteracao.rascunho.trim().replace(/\s+/g, ' ').slice(0, 80) || 'Nova conversa';
        }
        if (!conversa.mensagens.length && !nova.rascunho?.trim() && nova.anexosRascunho) {
            nova.titulo = 'Imagem anexada';
        }
        atualizar([...atuais.current.filter((item) => item.id !== nova.id), nova]);
        return nova;
    }

    function remover(id: string) {
        atualizar(atuais.current.filter((item) => item.id !== id));
    }

    function confirmarEnvio(id: string, textoEnviado: string) {
        const atual = atuais.current.find((item) => item.id === id);
        if (atual?.rascunho === textoEnviado || !atual?.rascunho) remover(id);
    }
    function limparProjetosChat(ids: string[]) {
        if (!atuais.current.some((item) => item.projetoChatId && !ids.includes(item.projetoChatId))) return;
        atualizar(
            atuais.current.map((item) =>
                item.projetoChatId && !ids.includes(item.projetoChatId)
                    ? { ...item, projetoChatId: null, contextoCompactado: undefined }
                    : item,
            ),
        );
    }

    return {
        rascunhos,
        criarRascunho: criar,
        alterarRascunho: alterar,
        removerRascunho: remover,
        confirmarEnvioRascunho: confirmarEnvio,
        limparProjetosChat,
    };
}
