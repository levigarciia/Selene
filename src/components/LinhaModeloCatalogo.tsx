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
        <div className={`item-catalogo ${selecionado ? 'modelo-selecionado' : ''}`}>
            <div className="linha-catalogo">
                <span className="familia-modelo">
                    <IconeModelo familia={item.familia} />
                </span>
                <button
                    type="button"
                    className="nome-catalogo"
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
                    <span className="descricao-modelo">{item.descricao}</span>
                </button>
                <button
                    type="button"
                    className={`botao-icone favorito-modelo ${favorito ? 'favoritado' : ''}`}
                    aria-label={`Favoritar ${item.nome}`}
                    aria-pressed={favorito}
                    onClick={favoritar}
                >
                    <StarIcon size={16} weight={favorito ? 'fill' : 'regular'} />
                </button>
                <div className="capacidades-modelo">
                    {item.capacidades.map((capacidade) => {
                        const { nome, Icone } = capacidades[capacidade];
                        return (
                            <span className={`capacidade capacidade-${capacidade}`} title={nome} key={capacidade}>
                                <Icone size={14} aria-label={nome} />
                            </span>
                        );
                    })}
                </div>
                {ativo ? (
                    <button
                        type="button"
                        className="botao-icone"
                        aria-label={`Cancelar download de ${item.nome}`}
                        onClick={cancelar}
                    >
                        <XIcon size={17} />
                    </button>
                ) : local ? (
                    <button
                        type="button"
                        className="botao-icone modelo-disponivel"
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
                        className="botao-icone baixar-modelo"
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
                <div className="progresso-modelo" role="status">
                    <span>{download.fase === 'verificando' ? 'Verificando arquivo' : `${percentual}%`}</span>
                    <span>
                        {formatarTamanho(download.recebido)} de {formatarTamanho(download.total)}
                    </span>
                    <progress value={download.recebido} max={download.total} aria-label={`Download de ${item.nome}`} />
                </div>
            )}
            {download?.fase === 'erro' && (
                <p className="erro-download" role="alert">
                    {download.erro}
                </p>
            )}
            {download?.fase === 'cancelado' && !local && <p className="descricao-download">Download cancelado</p>}
        </div>
    );
}
