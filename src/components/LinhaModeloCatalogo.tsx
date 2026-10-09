import { BrainIcon, CheckIcon, CodeIcon, DownloadSimpleIcon, StarIcon, WrenchIcon, XIcon } from '@phosphor-icons/react';
import { formatarTamanho, type ModeloCatalogo } from '../../shared/catalogo';
import type { DownloadModelo, Modelo } from '../../shared/contratos';
import { IconeModelo } from './IconeModelo';

const capacidades = {
    raciocinio: { nome: 'Raciocínio', Icone: BrainIcon },
    ferramentas: { nome: 'Ferramentas', Icone: WrenchIcon },
    code: { nome: 'Código', Icone: CodeIcon },
};

/** Permite acompanhar e controlar o download de um modelo do catálogo. */
export function LinhaModeloCatalogo({
    item,
    local,
    download,
    favorito,
    selecionado,
    ocupado,
    baixando,
    selecionar,
    favoritar,
    baixar,
    cancelar,
}: {
    item: ModeloCatalogo;
    local?: Modelo;
    download?: DownloadModelo;
    favorito: boolean;
    selecionado: boolean;
    ocupado: boolean;
    baixando: boolean;
    selecionar: (id: string) => void;
    favoritar: () => void;
    baixar: () => void;
    cancelar: () => void;
}) {
    const ativo = download?.fase === 'baixando' || download?.fase === 'verificando';
    const percentual = download ? Math.floor((download.recebido / download.total) * 100) : 0;
    return (
        <div
            data-ui={`item-catalogo ${selecionado ? 'modelo-selecionado' : ''}`}
            className={[
                'pt-[12px] pb-[11px] px-[12px] [&:hover]:bg-[#191c21]',
                selecionado ? '[&&]:bg-[#20232a]' : '',
            ].join(' ')}
        >
            <div data-ui="linha-catalogo" className="flex items-center gap-[6px]">
                <span data-ui="familia-modelo" className="w-[19px] self-start pt-[3px] shrink-0">
                    <IconeModelo familia={item.familia} />
                </span>
                <button
                    type="button"
                    data-ui="nome-catalogo"
                    className={[
                        'flex-1 min-w-0 bg-transparent text-left text-[#d6dae2] p-0 border-0 border-solid',
                        'border-current [&:disabled]:opacity-[1] [&_>_span:first-child]:flex',
                        '[&_>_span:first-child]:items-center [&_>_span:first-child]:gap-[7px]',
                        '[&_>_span:first-child]:whitespace-nowrap [&_strong]:text-[13px] [&_strong]:font-semibold',
                        '[&_small]:text-[10px] [&_small]:text-[#b19bd6]',
                    ].join(' ')}
                    disabled={!local || ocupado}
                    onClick={() => local && selecionar(local.id)}
                    aria-label={`Selecionar ${item.nome}`}
                    aria-pressed={selecionado}
                    title={item.descricao}
                >
                    <span>
                        <strong>{item.nome}</strong>
                        <small>{formatarTamanho(item.tamanho)}</small>
                    </span>
                    <span
                        data-ui="descricao-modelo"
                        className={[
                            'block overflow-hidden text-ellipsis whitespace-nowrap mt-[6px]',
                            'text-[#9199a7] text-[11px]',
                        ].join(' ')}
                    >
                        {item.descricao}
                    </span>
                </button>
                <button
                    type="button"
                    data-ui={`botao-icone favorito-modelo ${favorito ? 'favoritado' : ''}`}
                    className={[
                        [
                            '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                            [
                                'inline-flex items-center justify-center bg-transparent text-secundario',
                                'rounded-[6px] p-[4px]',
                            ].join(' '),
                            'border-0 border-solid border-current [&:hover:not(:disabled)]:text-principal',
                            '[&:hover:not(:disabled)]:bg-hover [[data-ui~=rodape-entrada]_&]:p-0',
                            "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                            '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                        ].join(' '),
                        favorito ? '[&&]:text-[#d6c38f]' : '',
                    ].join(' ')}
                    aria-label={`Favoritar ${item.nome}`}
                    aria-pressed={favorito}
                    onClick={favoritar}
                >
                    <StarIcon size={16} weight={favorito ? 'fill' : 'regular'} />
                </button>
                <div data-ui="capacidades-modelo" className="flex gap-[2px]">
                    {item.capacidades.map((capacidade) => {
                        const { nome, Icone } = capacidades[capacidade];
                        return (
                            <span
                                data-ui={`capacidade capacidade-${capacidade}`}
                                className={[
                                    'grid place-items-center w-[23px] h-[23px] rounded-full bg-[#232631]',
                                    capacidade === 'raciocinio'
                                        ? ['[&&]:text-[#b6a3ea]', '[&&]:bg-[#27213c]'].join(' ')
                                        : capacidade === 'ferramentas'
                                          ? ['[&&]:text-[#92bbed]', '[&&]:bg-[#1f2b3b]'].join(' ')
                                          : '[&&]:text-[#b6a3ea] [&&]:bg-[#29243a]',
                                ].join(' ')}
                                title={nome}
                                key={capacidade}
                            >
                                <Icone size={14} aria-label={nome} />
                            </span>
                        );
                    })}
                </div>
                {ativo ? (
                    <button
                        type="button"
                        data-ui="botao-icone"
                        className={[
                            '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                            [
                                'inline-flex items-center justify-center bg-transparent text-secundario',
                                'rounded-[6px] p-[8px]',
                            ].join(' '),
                            'border-0 border-solid border-current [&:hover:not(:disabled)]:text-principal',
                            '[&:hover:not(:disabled)]:bg-hover [[data-ui~=rodape-entrada]_&]:p-0',
                            "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                            '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                        ].join(' ')}
                        aria-label={`Cancelar download de ${item.nome}`}
                        onClick={cancelar}
                    >
                        <XIcon size={17} />
                    </button>
                ) : local ? (
                    <button
                        type="button"
                        data-ui="botao-icone modelo-disponivel"
                        className={[
                            '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                            [
                                'inline-flex items-center justify-center bg-transparent text-[#a4c1e8]',
                                'rounded-[6px] p-[6px]',
                            ].join(' '),
                            'border-0 border-solid border-current [&:hover:not(:disabled)]:text-principal',
                            '[&:hover:not(:disabled)]:bg-hover [[data-ui~=rodape-entrada]_&]:p-0',
                            '[[data-ui~=modelo-selecionado]_&]:text-[#b5a2dc]',
                            "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                            '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                        ].join(' ')}
                        disabled={ocupado}
                        onClick={() => selecionar(local.id)}
                        aria-label={`Usar ${item.nome}`}
                        title={selecionado ? 'Selecionado' : 'Disponível no computador'}
                    >
                        <CheckIcon size={18} weight={selecionado ? 'bold' : 'regular'} />
                    </button>
                ) : (
                    <button
                        type="button"
                        data-ui="botao-icone baixar-modelo"
                        className={[
                            '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                            [
                                'inline-flex items-center justify-center bg-transparent text-[#a4c1e8]',
                                'rounded-[6px] p-[6px]',
                            ].join(' '),
                            'border-0 border-solid border-current [&:hover:not(:disabled)]:text-principal',
                            '[&:hover:not(:disabled)]:bg-hover [[data-ui~=rodape-entrada]_&]:p-0',
                            "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                            '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                        ].join(' ')}
                        disabled={baixando}
                        aria-label={`Baixar ${item.nome}`}
                        onClick={baixar}
                        title={baixando ? 'Aguarde o download atual' : `Baixar ${formatarTamanho(item.tamanho)}`}
                    >
                        <DownloadSimpleIcon size={18} />
                    </button>
                )}
            </div>
            {ativo && (
                <div
                    data-ui="progresso-modelo"
                    className={[
                        'flex flex-wrap justify-between gap-[7px] mt-[11px] mr-[3px] mb-0 ml-[25px] text-[#b8c7d0]',
                        'text-[10px] [&_progress]:w-full [&_progress]:h-[4px] [&_progress]:border-0',
                        '[&_progress]:border-solid [&_progress]:border-current',
                    ].join(' ')}
                    role="status"
                >
                    <span>{download.fase === 'verificando' ? 'Verificando arquivo' : `${percentual}%`}</span>
                    <span>
                        {formatarTamanho(download.recebido)} de {formatarTamanho(download.total)}
                    </span>
                    <progress
                        className="accent-[#b5a2dc]"
                        value={download.recebido}
                        max={download.total}
                        aria-label={`Download de ${item.nome}`}
                    />
                </div>
            )}
            {download?.fase === 'erro' && (
                <p
                    data-ui="erro-download"
                    className="mt-[9px] mr-[3px] mb-0 ml-[25px] text-[11px] leading-[1.5] text-[#eab1aa]"
                    role="alert"
                >
                    {download.erro}
                </p>
            )}
            {download?.fase === 'cancelado' && !local && (
                <p
                    data-ui="descricao-download"
                    className="mt-[9px] mr-[3px] mb-0 ml-[25px] text-[11px] leading-[1.5] text-secundario"
                >
                    Download cancelado
                </p>
            )}
        </div>
    );
}
