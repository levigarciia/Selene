import { useCallback, useEffect, useState } from 'react';
import { esquemaDados, type Estado, type Projeto, type Resultado } from '../../shared/contratos';
import { useRascunhos } from './useRascunhos';
import { reunirRascunhos } from '../../shared/rascunhos';
import type { PreviaNavegador } from '../../shared/web';
import type { PreviaComputador } from '../../shared/computador';

const inicial: Estado = {
    ...esquemaDados.parse({ versao: 1, configuracao: {}, modelos: [], conversas: [] }),
    motor: {
        fase: 'desligado',
        detalhe: 'Abra o aplicativo desktop para carregar modelos',
        instalado: { cpu: false, vulkan: false, rocm: false },
    },
    conversaEmExecucao: null,
    downloads: [],
};

/** Centraliza a ponte desktop e mantém a interface sincronizada com eventos do processo principal. */
export function useSelene() {
    const [estado, definirEstado] = useState<Estado>(inicial);
    const [erro, definirErro] = useState('');
    const [previasNavegador, definirPreviasNavegador] = useState<Record<string, PreviaNavegador>>({});
    const [previasComputador, definirPreviasComputador] = useState<Record<string, PreviaComputador>>({});
    const rascunhos = useRascunhos(definirErro);
    const [carregando, definirCarregando] = useState(!!window.selene);
    useEffect(() => {
        if (!carregando) rascunhos.limparProjetosChat(estado.projetosChat.map((item) => item.id));
    }, [carregando, estado.projetosChat]);
    useEffect(() => {
        const ponte = window.selene;
        if (!ponte) return;
        let ativo = true;
        const remover = ponte.aoEvento((evento) => {
            if (evento.tipo === 'computador') {
                definirPreviasComputador((anteriores) => {
                    const anterior = anteriores[evento.previa.conversaId];
                    return anterior && anterior.atualizadoEm > evento.previa.atualizadoEm ? anteriores :
                        { ...anteriores, [evento.previa.conversaId]: evento.previa };
                });
                return;
            }
            if (evento.tipo === 'navegador') {
                definirPreviasNavegador((anteriores) => ({ ...anteriores, [evento.previa.conversaId]: evento.previa }));
                return;
            }
            if (evento.tipo === 'erro') {
                definirErro(evento.erro);
                return;
            }
            if (evento.tipo === 'estado') {
                definirEstado(evento.estado);
                return;
            }
            definirEstado((anterior) => ({
                ...anterior,
                conversas: anterior.conversas.map((conversa) =>
                    conversa.id === evento.conversaId
                        ? {
                              ...conversa,
                              mensagens: conversa.mensagens.map((mensagem) =>
                                  mensagem.id === evento.mensagem.id ? evento.mensagem : mensagem,
                              ),
                          }
                        : conversa,
                ),
            }));
        });
        void ponte
            .previasNavegador()
            .then((resultado) => {
                if (!ativo || !resultado.ok) return;
                definirPreviasNavegador((anteriores) => ({
                    ...Object.fromEntries(resultado.valor.map((previa) => [previa.conversaId, previa])),
                    ...anteriores,
                }));
            })
            .catch(() => {});
        void ponte
            .estado()
            .then((resultado) => {
                if (!ativo) return;
                if (resultado.ok) definirEstado(resultado.valor);
                else definirErro(resultado.erro);
            })
            .catch((falha: Error) => {
                if (ativo) definirErro(falha.message);
            })
            .finally(() => {
                if (ativo) definirCarregando(false);
            });
        void ponte.previasComputador().then((resultado) => {
            if (!ativo || !resultado.ok) return;
            definirPreviasComputador((anteriores) => ({
                ...Object.fromEntries(resultado.valor.map((previa) => [previa.conversaId, previa])), ...anteriores,
            }));
        }).catch(() => {});
        return () => {
            ativo = false;
            remover();
        };
    }, []);

    const executar = useCallback(async <T>(operacao: () => Promise<Resultado<T>>): Promise<T | undefined> => {
        definirErro('');
        if (!window.selene) {
            definirErro('Esta ação está disponível no aplicativo desktop. Use bun run dev.');
            return;
        }
        try {
            const resultado = await operacao();
            if (!resultado.ok) {
                definirErro(resultado.erro);
                return;
            }
            return resultado.valor;
        } catch (falha) {
            definirErro(falha instanceof Error ? falha.message : 'Operação não concluída.');
        }
    }, []);
    return {
        estado: reunirRascunhos(estado, rascunhos.rascunhos),
        estadoPersistido: estado,
        previasNavegador,
        previasComputador,
        ...rascunhos,
        criarRascunho: (modo: 'chat' | 'code', projeto?: Projeto | null, projetoChatId: string | null = null) =>
            rascunhos.criarRascunho(
                modo,
                projeto,
                estado.conversas.map((item) => item.id),
                projetoChatId,
            ),
        erro,
        carregando,
        executar,
        definirErro,
        ponte: window.selene,
    };
}
