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
        <div
            data-ui={`seletor-catalogo ${embutido ? 'catalogo-embutido' : ''}`}
            className={[
                [
                    'relative min-w-0',
                    '[@media(width<=760px)]:[[data-ui~=barra-entrada]_&]:max-w-[calc(100%_-_88px)]',
                ].join(' '),
                embutido ? '' : '',
            ].join(' ')}
            ref={raiz}
        >
            {!embutido && (
                <button
                    type="button"
                    data-ui="gatilho-catalogo"
                    className={[
                        'flex items-center gap-[7px] max-w-[260px] rounded-[6px] bg-transparent text-secundario',
                        'text-[12px] px-[2px] py-[7px] border-0 border-solid border-current',
                        '[&_>_span:not([data-ui~=icone-modelo]):not([data-ui~=indicador-download])]:overflow-hidden',
                        '[&_>_span:not([data-ui~=icone-modelo]):not([data-ui~=indicador-download])]:text-ellipsis',
                        '[&_>_span:not([data-ui~=icone-modelo]):not([data-ui~=indicador-download])]:whitespace-nowrap',
                        "[&:hover]:bg-[#2d3037] [&[aria-expanded='true']]:bg-[#2d3037]",
                        '[@media(width<=1000px)]:max-w-[210px] [@media(width<=760px)]:max-w-full',
                    ].join(' ')}
                    ref={gatilho}
                    aria-label="Modelo da conversa"
                    aria-expanded={aberto}
                    aria-haspopup="dialog"
                    aria-controls={idCatalogo}
                    onClick={() => definirAberto(!aberto)}
                >
                    <IconeModelo familia={familiaSelecionada} nome={selecionado?.nome} />
                    <span>{selecionado?.nome ?? 'Selecionar modelo'}</span>
                    {baixando && (
                        <span
                            data-ui="indicador-download"
                            className="w-[6px] h-[6px] shrink-0 rounded-full bg-[#b5a2dc]"
                            title="Download em andamento"
                        />
                    )}
                    <CaretDownIcon size={13} />
                </button>
            )}
            {aberto && (
                <div
                    data-ui="catalogo-modelos"
                    className={[
                        '[[data-ui~=catalogo-embutido]_&]:static [[data-ui~=catalogo-embutido]_&]:w-full',
                        '[[data-ui~=catalogo-embutido]_&]:h-[min(540px,_calc(100dvh_-_245px))]',
                        '[[data-ui~=catalogo-embutido]_&]:min-h-[320px]',
                        '[[data-ui~=catalogo-embutido]_&]:shadow-[none]',
                        '[[data-ui~=catalogo-embutido]_&]:rounded-[10px] absolute bottom-[calc(100%_+_16px)]',
                        'left-0 w-[min(480px,_calc(100vw_-_48px))] h-[min(480px,_calc(100dvh_-_190px))]',
                        'min-h-[270px] grid grid-cols-[55px_minmax(0,_1fr)] z-[20] bg-superficie rounded-[15px]',
                        'shadow-[0_18px_60px_#0007] overflow-hidden border border-solid border-[#2d3036]',
                    ].join(' ')}
                    id={idCatalogo}
                    role={embutido ? 'region' : 'dialog'}
                    aria-label="Catálogo de modelos"
                >
                    <nav
                        data-ui="familias-catalogo"
                        className={[
                            'flex items-center flex-col gap-[6px] border-r border-solid',
                            'border-r-borda bg-[#101114] px-[7px] py-[14px] [&_button]:grid',
                            '[&_button]:place-items-center [&_button]:w-[36px] [&_button]:h-[36px]',
                            '[&_button]:rounded-[9px] [&_button]:bg-transparent [&_button]:text-[#9298a3]',
                            '[&_button]:border-0 [&_button]:border-solid [&_button]:border-current',
                            '[&_button:hover]:bg-[#282b31] [&_button:hover]:text-[#eef0f3]',
                            [
                                "[&_button[aria-pressed='true']]:bg-[#282b31]",
                                "[&_button[aria-pressed='true']]:text-[#eef0f3]",
                            ].join(' '),
                        ].join(' ')}
                        aria-label="Filtrar modelos"
                    >
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
                        <span data-ui="divisor-catalogo" className="w-[26px] h-[1px] bg-[#2b2e35] mx-0 my-[5px]" />
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
                    <div data-ui="conteudo-catalogo" className="flex flex-col min-w-0 min-h-0">
                        <div
                            data-ui="busca-catalogo"
                            className={[
                                'flex items-center gap-[9px] border-b border-solid border-b-borda',
                                'text-[#9aa2af] px-[12px] py-[11px] [&_input]:w-full [&_input]:min-w-0',
                                [
                                    '[&_input]:bg-transparent [&_input]:text-principal',
                                    '[&_input]:text-[12px] [&_input]:px-0',
                                ].join(' '),
                                '[&_input]:py-[5px] [&_input]:border-0 [&_input]:border-solid',
                                '[&_input]:border-current [&_input::placeholder]:text-[#939ba8] [&_button]:p-[5px]',
                                "[&_button[aria-pressed='true']]:text-[#b5a2dc]",
                            ].join(' ')}
                        >
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
                                data-ui="botao-icone"
                                className={[
                                    [
                                        '[[data-ui~=marca]_&]:ml-auto',
                                        '[[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                                    ].join(' '),
                                    [
                                        'inline-flex items-center justify-center bg-transparent',
                                        'text-secundario rounded-[6px] p-[8px]',
                                    ].join(' '),
                                    'border-0 border-solid border-current [&:hover:not(:disabled)]:text-principal',
                                    '[&:hover:not(:disabled)]:bg-hover [[data-ui~=rodape-entrada]_&]:p-0',
                                    "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                                    '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                                ].join(' ')}
                                aria-label="Mostrar somente disponíveis"
                                aria-pressed={somenteLocais}
                                title="Somente disponíveis no computador"
                                onClick={() => definirSomenteLocais(!somenteLocais)}
                            >
                                <FunnelSimpleIcon size={17} weight={somenteLocais ? 'fill' : 'regular'} />
                            </button>
                        </div>
                        <div
                            data-ui="itens-catalogo"
                            className={[
                                [
                                    'flex-1 overflow-y-auto min-h-0 [scrollbar-width:thin]',
                                    '[scrollbar-color:#353940_transparent]',
                                ].join(' '),
                                'px-0 py-[8px]',
                            ].join(' ')}
                        >
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
                                        data-ui="modelo-importado"
                                        className={[
                                            [
                                                'flex items-center justify-between w-full bg-transparent',
                                                'text-[#d6dae2] text-left text-[12px]',
                                            ].join(' '),
                                            'gap-[9px] px-[16px] py-[13px] border-0 border-solid border-current',
                                            '[&:hover]:bg-[#20232a] [&_>_span:not([data-ui~=icone-modelo])]:min-w-0',
                                            [
                                                '[&_>_span:not([data-ui~=icone-modelo])]:flex-1',
                                                '[&_strong]:block [&_strong]:overflow-hidden',
                                            ].join(' '),
                                            [
                                                '[&_strong]:text-ellipsis [&_strong]:whitespace-nowrap',
                                                '[&_strong]:font-medium [&_small]:block',
                                            ].join(' '),
                                            '[&_small]:mt-[5px] [&_small]:text-secundario',
                                        ].join(' ')}
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
                                <p data-ui="catalogo-vazio" className="text-[12px] text-secundario px-[14px] py-[25px]">
                                    Nenhum modelo encontrado
                                </p>
                            )}
                        </div>
                        <footer
                            data-ui="rodape-catalogo"
                            className={[
                                'flex items-center justify-between border-t border-solid border-t-borda',
                                [
                                    'text-[10px] text-[#929aa6] px-[14px] py-[12px] [&_button]:flex',
                                    '[&_button]:items-center',
                                ].join(' '),
                                '[&_button]:gap-[5px] [&_button]:bg-transparent [&_button]:text-[#c4cad4]',
                                '[&_button]:text-[11px] [&_button]:p-0 [&_button]:border-0 [&_button]:border-solid',
                                '[&_button]:border-[currentColor]',
                            ].join(' ')}
                        >
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
