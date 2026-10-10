import { CheckIcon, StarIcon } from '@phosphor-icons/react';
import { nomeModeloOpenRouter, precoModelo, type ModeloOpenRouter } from '../../shared/openrouter';
import { IconeModeloRemoto } from './IconeModeloRemoto';
import { CapacidadesModelo, type CapacidadeModelo } from './CapacidadesModelo';

/** Apresenta modelos remotos com preços, capacidades, favoritos e seleção no padrão do catálogo local. */
export function LinhaModeloOpenRouter({
    modelo,
    selecionado,
    favorito,
    ocupado,
    selecionar,
    favoritar,
}: {
    modelo: ModeloOpenRouter;
    selecionado: boolean;
    favorito: boolean;
    ocupado: boolean;
    selecionar: () => void;
    favoritar: () => void;
}) {
    const nome = nomeModeloOpenRouter(modelo.name);
    const capacidades: CapacidadeModelo[] = [];
    if (modelo.supported_parameters.includes('reasoning')) capacidades.push('raciocinio');
    if (modelo.supported_parameters.includes('tools')) capacidades.push('ferramentas');
    if (modelo.architecture.input_modalities.includes('image')) capacidades.push('imagens');
    return (
        <div
            data-ui={`item-catalogo modelo-openrouter ${selecionado ? 'modelo-selecionado' : ''}`}
            className={`px-[12px] pt-[12px] pb-[11px] hover:bg-[#191c21] ${selecionado ? 'bg-[#20232a]' : ''}`}
        >
            <div data-ui="linha-catalogo" className="flex items-center gap-[6px]">
                <span data-ui="familia-modelo" className="w-[19px] self-start shrink-0 pt-[3px]">
                    <IconeModeloRemoto id={modelo.id} nome={modelo.name} />
                </span>
                <button
                    type="button"
                    data-ui="nome-catalogo"
                    aria-label={`Selecionar ${nome}`}
                    aria-pressed={selecionado}
                    disabled={ocupado}
                    onClick={selecionar}
                    title={`${modelo.id}. ${precoModelo(modelo)}`}
                    className="min-w-0 flex-1 bg-transparent p-0 text-left text-[#d6dae2] disabled:opacity-50"
                >
                    <span className="flex min-w-0 items-center gap-[7px]">
                        <strong className="truncate text-[13px] font-semibold">{nome}</strong>
                        <small
                            title={`Contexto de ${modelo.context_length.toLocaleString('pt-BR')} tokens`}
                            className="shrink-0 text-[10px] text-[#b19bd6]"
                        >
                            {new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(modelo.context_length)}
                        </small>
                    </span>
                    <span data-ui="descricao-modelo" className="mt-[6px] block truncate text-[11px] text-[#9199a7]">
                        {modelo.id}
                    </span>
                </button>
                <button
                    type="button"
                    data-ui={`favorito-modelo ${favorito ? 'favoritado' : ''}`}
                    aria-label={`Favoritar ${nome}`}
                    aria-pressed={favorito}
                    onClick={favoritar}
                    disabled={ocupado}
                    className={`rounded-md p-1 hover:bg-hover ${
                        favorito ? 'text-[#d6c38f]' : 'text-secundario hover:text-principal'
                    }`}
                >
                    <StarIcon size={16} weight={favorito ? 'fill' : 'regular'} />
                </button>
                <CapacidadesModelo itens={capacidades} />
                <button
                    type="button"
                    aria-label={`Usar ${nome}`}
                    title={selecionado ? 'Selecionado' : 'Usar modelo'}
                    disabled={ocupado}
                    onClick={selecionar}
                    className="rounded-md p-[6px] text-[#a4c1e8] hover:bg-hover disabled:opacity-40"
                >
                    <CheckIcon size={18} weight={selecionado ? 'bold' : 'regular'} />
                </button>
            </div>
            <p className="mt-2 ml-[25px] text-[10px] text-secundario">{precoModelo(modelo)}</p>
        </div>
    );
}
