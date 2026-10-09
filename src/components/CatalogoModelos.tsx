import { useEffect, useId, useRef, useState } from 'react';
import {
    CaretDownIcon,
    CheckIcon,
    FunnelSimpleIcon,
    ListIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    StarIcon,
} from '@phosphor-icons/react';
import { catalogoModelos, encontrarModeloLocal, formatarTamanho, type FamiliaModelo } from '../../shared/catalogo';
import type { Estado, PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';
import { LinhaModeloCatalogo } from './LinhaModeloCatalogo';
import { IconeModelo } from './IconeModelo';

const familias: { id: FamiliaModelo; nome: string }[] = [
    { id: 'qwen', nome: 'Qwen' },
    { id: 'llama', nome: 'Llama' },
    { id: 'gemma', nome: 'Gemma' },
    { id: 'deepseek', nome: 'DeepSeek' },
];
/** Oferece modelos prontos para download e permite selecionar arquivos já disponíveis na conversa. */
export function CatalogoModelos({
    estado,
    ponte,
    executar,
    modeloId,
    selecionar,
    aberto,
    definirAberto,
    embutido = false,
}: {
    estado: Estado;
    ponte?: PonteSelene;
    executar: Executar;
    modeloId: string;
    selecionar: (id: string) => Promise<void>;
    aberto: boolean;
    definirAberto: (valor: boolean) => void;
    embutido?: boolean;
}) {
    const idCatalogo = useId();
    const [busca, definirBusca] = useState('');
    const [filtro, definirFiltro] = useState<'todos' | 'favoritos' | FamiliaModelo>('todos');
    const [somenteLocais, definirSomenteLocais] = useState(false);
    const raiz = useRef<HTMLDivElement>(null);
    const campoBusca = useRef<HTMLInputElement>(null);
    const gatilho = useRef<HTMLButtonElement>(null);
    const selecionado = estado.modelos.find((modelo) => modelo.id === modeloId);
    const familiaSelecionada = catalogoModelos.find(
        (item) => selecionado && encontrarModeloLocal(item, [selecionado]),
    )?.familia;
    const ocupado = !!estado.conversaEmExecucao || ['carregando', 'instalando'].includes(estado.motor.fase);
    const baixando = estado.downloads.some((download) => ['baixando', 'verificando'].includes(download.fase));
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    const itens = catalogoModelos
        .filter((item) => {
            if (filtro === 'favoritos' && !estado.favoritosCatalogo.includes(item.id)) return false;
            if (filtro !== 'todos' && filtro !== 'favoritos' && item.familia !== filtro) return false;
            if (somenteLocais && !encontrarModeloLocal(item, estado.modelos)) return false;
            return `${item.nome} ${item.descricao}`.toLocaleLowerCase('pt-BR').includes(termo);
        })
        .sort(
            (primeiro, segundo) =>
                Number(estado.favoritosCatalogo.includes(segundo.id)) -
                Number(estado.favoritosCatalogo.includes(primeiro.id)),
        );
    const importados = estado.modelos.filter(
        (modelo) =>
            !catalogoModelos.some((item) => encontrarModeloLocal(item, [modelo])) &&
            modelo.nome.toLocaleLowerCase('pt-BR').includes(termo),
    );

    useEffect(() => {
        if (!aberto || embutido) return;
        campoBusca.current?.focus();
        const fecharFora = (evento: MouseEvent) => {
            if (!raiz.current?.contains(evento.target as Node)) definirAberto(false);
        };
        const fecharTeclado = (evento: KeyboardEvent) => {
            if (evento.key !== 'Escape') return;
            definirAberto(false);
            gatilho.current?.focus();
        };
        document.addEventListener('mousedown', fecharFora);
        document.addEventListener('keydown', fecharTeclado);
        return () => {
            document.removeEventListener('mousedown', fecharFora);
            document.removeEventListener('keydown', fecharTeclado);
        };
    }, [aberto, definirAberto, embutido]);

    async function usar(id: string) {
        await selecionar(id);
        definirAberto(false);
        gatilho.current?.focus();
    }

    return (
        <div className={`seletor-catalogo ${embutido ? 'catalogo-embutido' : ''}`} ref={raiz}>
            {!embutido && (
                <button
                    type="button"
                    className="gatilho-catalogo"
                    ref={gatilho}
                    aria-label="Modelo da conversa"
                    aria-expanded={aberto}
                    aria-haspopup="dialog"
                    aria-controls={idCatalogo}
                    onClick={() => definirAberto(!aberto)}
                >
                    <IconeModelo familia={familiaSelecionada} nome={selecionado?.nome} />
                    <span>{selecionado?.nome ?? 'Selecionar modelo'}</span>
                    {baixando && <span className="indicador-download" title="Download em andamento" />}
                    <CaretDownIcon size={13} />
                </button>
            )}
            {aberto && (
                <div
                    className="catalogo-modelos"
                    id={idCatalogo}
                    role={embutido ? 'region' : 'dialog'}
                    aria-label="Catálogo de modelos"
                >
                    <nav className="familias-catalogo" aria-label="Filtrar modelos">
                        <button
                            type="button"
                            aria-label="Todos os modelos"
                            title="Todos os modelos"
                            aria-pressed={filtro === 'todos'}
                            onClick={() => definirFiltro('todos')}
                        >
                            <ListIcon size={20} />
                        </button>
                        <button
                            type="button"
                            aria-label="Modelos favoritos"
                            title="Favoritos"
                            aria-pressed={filtro === 'favoritos'}
                            onClick={() => definirFiltro('favoritos')}
                        >
                            <StarIcon size={20} />
                        </button>
                        <span className="divisor-catalogo" />
                        {familias.map((familia) => (
                            <button
                                type="button"
                                key={familia.id}
                                aria-label={`Família ${familia.nome}`}
                                title={familia.nome}
                                aria-pressed={filtro === familia.id}
                                onClick={() => definirFiltro(familia.id)}
                            >
                                <IconeModelo familia={familia.id} tamanho={21} />
                            </button>
                        ))}
                    </nav>
                    <div className="conteudo-catalogo">
                        <div className="busca-catalogo">
                            <MagnifyingGlassIcon size={17} />
                            <input
                                ref={campoBusca}
                                aria-label="Buscar modelos"
                                placeholder="Buscar modelos..."
                                value={busca}
                                onChange={(evento) => definirBusca(evento.target.value)}
                            />
                            <button
                                type="button"
                                className="botao-icone"
                                aria-label="Mostrar somente disponíveis"
                                aria-pressed={somenteLocais}
                                title="Somente disponíveis no computador"
                                onClick={() => definirSomenteLocais(!somenteLocais)}
                            >
                                <FunnelSimpleIcon size={17} weight={somenteLocais ? 'fill' : 'regular'} />
                            </button>
                        </div>
                        <div className="itens-catalogo">
                            {itens.map((item) => {
                                const local = encontrarModeloLocal(item, estado.modelos);
                                return (
                                    <LinhaModeloCatalogo
                                        key={item.id}
                                        item={item}
                                        local={local}
                                        download={estado.downloads.find((download) => download.catalogoId === item.id)}
                                        selecionado={local?.id === modeloId}
                                        favorito={estado.favoritosCatalogo.includes(item.id)}
                                        ocupado={ocupado}
                                        baixando={baixando}
                                        selecionar={usar}
                                        favoritar={() =>
                                            void executar(() =>
                                                ponte!.favoritarModelo(
                                                    item.id,
                                                    !estado.favoritosCatalogo.includes(item.id),
                                                ),
                                            )
                                        }
                                        baixar={() => void executar(() => ponte!.baixarModelo(item.id))}
                                        cancelar={() => void executar(() => ponte!.cancelarDownload(item.id))}
                                    />
                                );
                            })}
                            {filtro === 'todos' &&
                                importados.map((modelo) => (
                                    <button
                                        type="button"
                                        className="modelo-importado"
                                        key={modelo.id}
                                        disabled={ocupado}
                                        aria-label={`Selecionar ${modelo.nome}`}
                                        onClick={() => void usar(modelo.id)}
                                    >
                                        <IconeModelo nome={modelo.nome} />
                                        <span>
                                            <strong>{modelo.nome}</strong>
                                            <small>{formatarTamanho(modelo.tamanho)}</small>
                                        </span>
                                        {modelo.id === modeloId && <CheckIcon size={17} />}
                                    </button>
                                ))}
                            {!itens.length && !(filtro === 'todos' && importados.length) && (
                                <p className="catalogo-vazio">Nenhum modelo encontrado</p>
                            )}
                        </div>
                        <footer className="rodape-catalogo">
                            <span>GGUF · Q4_K_M</span>
                            {!embutido && (
                                <button type="button" onClick={() => executar(() => ponte!.importarModelo())}>
                                    <PlusIcon size={14} /> Importar arquivo
                                </button>
                            )}
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}
