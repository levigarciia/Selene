import { useCallback, useEffect, useState } from 'react';
import { esquemaDados, type Estado, type Projeto, type Resultado } from '../../shared/contratos';
import { useRascunhos } from './useRascunhos';
import { reunirRascunhos } from '../../shared/rascunhos';

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
    const rascunhos = useRascunhos(definirErro);
    const [carregando, definirCarregando] = useState(!!window.selene);
    useEffect(() => {
        const ponte = window.selene;
        if (!ponte) return;
        let ativo = true;
        const remover = ponte.aoEvento((evento) => {
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
        ...rascunhos,
        criarRascunho: (modo: 'chat' | 'code', projeto?: Projeto | null) =>
            rascunhos.criarRascunho(
                modo,
                projeto,
                estado.conversas.map((item) => item.id),
            ),
        erro,
        carregando,
        executar,
        definirErro,
        ponte: window.selene,
    };
}
