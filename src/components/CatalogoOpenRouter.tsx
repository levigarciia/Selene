import { useEffect, useState } from 'react';
import type { Estado, PonteSelene } from '../../shared/contratos';
import { ordenacoesOpenRouter, type ModeloOpenRouter, type OrdenacaoOpenRouter } from '../../shared/openrouter';
import { LinhaModeloOpenRouter } from './LinhaModeloOpenRouter';
import type { Executar } from './Configuracoes';

/** Consulta modelos de texto do catálogo oficial, com busca, capacidades e preços atuais. */
export function CatalogoOpenRouter({
    estado,
    ponte,
    executar,
    selecionar,
    busca,
    filtro,
    modeloId,
    somenteDisponiveis,
}: {
    estado: Estado;
    ponte?: PonteSelene;
    executar: Executar;
    selecionar: (id: string) => Promise<void>;
    busca: string;
    filtro: string;
    modeloId: string;
    somenteDisponiveis: boolean;
}) {
    const [modelos, definirModelos] = useState<ModeloOpenRouter[]>([]);
    const [carregando, definirCarregando] = useState(false);
    const [erro, definirErro] = useState('');
    const [escolhendo, definirEscolhendo] = useState(false);
    const [ordenacao, definirOrdenacao] = useState<OrdenacaoOpenRouter>('most-popular');
    const [revisao, definirRevisao] = useState(0);
    useEffect(() => {
        let ativo = true;
        if (!ponte) return;
        definirCarregando(true);
        definirErro('');
        ponte
            .catalogoOpenRouter(revisao > 0, ordenacao)
            .then((resultado) => {
                if (!ativo) return;
                if (resultado.ok) definirModelos(resultado.valor);
                else definirErro(resultado.erro);
            })
            .catch(() => {
                if (ativo) definirErro('Não foi possível carregar o catálogo OpenRouter.');
            })
            .finally(() => {
                if (ativo) definirCarregando(false);
            });
        return () => {
            ativo = false;
        };
    }, [ponte, revisao, ordenacao]);
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    const filtrados = modelos.filter((modelo) => {
        if (!`${modelo.id} ${modelo.name}`.toLocaleLowerCase('pt-BR').includes(termo)) return false;
        if (filtro === 'favoritos' && !estado.favoritosCatalogo.includes(`openrouter:${modelo.id}`)) return false;
        if (
            filtro !== 'todos' &&
            filtro !== 'favoritos' &&
            !`${modelo.id} ${modelo.name}`.toLowerCase().includes(filtro)
        )
            return false;
        if (somenteDisponiveis && !estado.modelos.some((item) => item.openrouter?.id === modelo.id)) return false;
        return true;
    });
    return (
        <div className="text-xs">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
                <select
                    aria-label="Ordenar modelos OpenRouter"
                    value={ordenacao}
                    className="min-w-0 rounded bg-hover p-2"
                    onChange={(evento) => definirOrdenacao(evento.target.value as OrdenacaoOpenRouter)}
                >
                    {ordenacoesOpenRouter.map((item) => (
                        <option key={item.valor} value={item.valor}>
                            {item.nome}
                        </option>
                    ))}
                </select>
                <button type="button" disabled={carregando} onClick={() => definirRevisao(revisao + 1)}>
                    Atualizar catálogo
                </button>
            </div>
            {!estado.openrouterConfigurado && (
                <p className="px-3 py-2 text-secundario">
                    Salve sua chave de API em Configurações, Geral, OpenRouter para enviar mensagens.
                </p>
            )}
            {carregando && (
                <p role="status" className="p-3 text-secundario">
                    Carregando catálogo
                </p>
            )}
            {erro && (
                <p role="alert" className="p-3 text-[#eab1aa]">
                    {erro}
                </p>
            )}
            {!carregando && !erro && <p className="px-3 py-2 text-secundario">{filtrados.length} modelos</p>}
            {filtrados.map((modelo) => (
                <LinhaModeloOpenRouter
                    key={modelo.id}
                    modelo={modelo}
                    selecionado={estado.modelos.find((item) => item.openrouter?.id === modelo.id)?.id === modeloId}
                    favorito={estado.favoritosCatalogo.includes(`openrouter:${modelo.id}`)}
                    ocupado={carregando || escolhendo || !!estado.conversaEmExecucao}
                    favoritar={() =>
                        void executar(() =>
                            ponte!.favoritarModelo(
                                `openrouter:${modelo.id}`,
                                !estado.favoritosCatalogo.includes(`openrouter:${modelo.id}`),
                            ),
                        )
                    }
                    selecionar={async () => {
                        definirEscolhendo(true);
                        try {
                            const registrado = await executar(() => ponte!.cadastrarModeloOpenRouter(modelo.id));
                            if (registrado) await selecionar(registrado.id);
                        } finally {
                            definirEscolhendo(false);
                        }
                    }}
                />
            ))}
            {!carregando && !erro && !filtrados.length && <p className="p-3">Nenhum modelo encontrado</p>}
        </div>
    );
}
