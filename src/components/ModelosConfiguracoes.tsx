import { useState } from 'react';
import { ArrowLeftIcon, DownloadSimpleIcon, PlusIcon, PlayIcon, TrashIcon, ImageIcon } from '@phosphor-icons/react';
import type { Estado, Modelo, PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';
import { Modal } from './Modal';
import { CatalogoModelos } from './CatalogoModelos';

/** Gerencia arquivos locais e downloads em uma área própria das configurações. */
export function ModelosConfiguracoes({
    estado,
    ponte,
    executar,
}: {
    estado: Estado;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    const [catalogo, definirCatalogo] = useState(false);
    const [removendo, definirRemovendo] = useState<Modelo | null>(null);
    const ocupado = !!estado.conversaEmExecucao || ['instalando', 'carregando'].includes(estado.motor.fase);
    return (
        <>
            <div
                data-ui="cabecalho-modelos-config"
                className="flex flex-wrap items-center justify-between gap-[18px] mb-[28px] [&_h2]:mb-0"
            >
                <h2>{catalogo ? 'Catálogo' : 'Seus modelos'}</h2>
                <div className="flex gap-3">
                    <button
                        type="button"
                        data-ui="botao"
                        className={[
                            'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                            'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                            '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                            '[[data-ui~=lista-projetos]_>_&]:justify-start [[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                            '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                        ].join(' ')}
                        onClick={() => definirCatalogo(!catalogo)}
                    >
                        {catalogo ? <ArrowLeftIcon size={16} /> : <DownloadSimpleIcon size={16} />}
                        {catalogo ? 'Seus modelos' : 'Baixar modelos'}
                    </button>
                    <button
                        type="button"
                        data-ui="botao"
                        className={[
                            'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                            'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                            '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                            '[[data-ui~=lista-projetos]_>_&]:justify-start [[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                            '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                        ].join(' ')}
                        onClick={() => executar(() => ponte!.importarModelo())}
                    >
                        <PlusIcon size={16} /> Importar GGUF
                    </button>
                </div>
            </div>
            {catalogo ? (
                <CatalogoModelos
                    estado={estado}
                    ponte={ponte}
                    executar={executar}
                    embutido
                    modeloId={estado.motor.modeloId ?? ''}
                    aberto
                    definirAberto={() => {}}
                    selecionar={async (id) => {
                        await executar(() => ponte!.carregarModelo(id));
                    }}
                />
            ) : (
                <>
                    {!estado.modelos.length && (
                        <p
                            data-ui="estado-vazio-pequeno"
                            className={[
                                'rounded-[9px] text-[#a1a5ad] text-[12px] text-center mb-[20px] px-[15px] py-[25px]',
                                'border [border-style:dashed] border-[#393d45]',
                            ].join(' ')}
                        >
                            Baixe um modelo ou importe um arquivo GGUF.
                        </p>
                    )}
                    <div
                        data-ui="lista-modelos"
                        className={[
                            '[[data-ui~=conteudo-configuracoes]_&]:max-h-none',
                            '[[data-ui~=conteudo-configuracoes]_&]:overflow-visible max-h-[180px] overflow-auto',
                        ].join(' ')}
                    >
                        {estado.modelos.map((modelo) => (
                            <div
                                data-ui="linha-modelo"
                                className={[
                                    '[[data-ui~=conteudo-configuracoes]_&]:border-b-[1px]',
                                    '[[data-ui~=conteudo-configuracoes]_&]:[border-bottom-style:solid]',
                                    '[[data-ui~=conteudo-configuracoes]_&]:border-b-[#272a30]',
                                    '[[data-ui~=conteudo-configuracoes]_&]:px-[0]',
                                    '[[data-ui~=conteudo-configuracoes]_&]:py-[18px] flex items-center gap-[12px] px-0',
                                    'py-[10px] [&_strong]:text-[12px] [&_strong]:font-medium',
                                ].join(' ')}
                                key={modelo.id}
                            >
                                <div className="min-w-0 flex-1">
                                    <strong className="truncate block" title={modelo.nome}>
                                        {modelo.nome}
                                    </strong>
                                    <span
                                        data-ui="texto-secundario"
                                        className={[
                                            'text-[#a1a5ad] text-[12px] leading-[1.7]',
                                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#a1a5ad]',
                                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                                            '[[data-ui~=usuario-direita]_&]:text-[#a1a5ad]',
                                            '[[data-ui~=usuario-direita]_&]:text-[12px]',
                                            '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                                        ].join(' ')}
                                    >
                                        {(modelo.tamanho / 1024 ** 3).toFixed(2)} GB
                                        {modelo.catalogoId ? '· Baixado' : '· Importado'}
                                        {modelo.projetorVisual ? '· Projetor visual vinculado' : ''}
                                        {estado.motor.modeloId === modelo.id && estado.motor.fase === 'pronto'
                                            ? '· Carregado'
                                            : ''}
                                    </span>
                                </div>
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
                                            'text-[#a1a5ad] rounded-[6px] p-[8px]',
                                        ].join(' '),
                                        'border-0 border-solid border-current [&:hover:not(:disabled)]:text-[#e6e7e9]',
                                        '[&:hover:not(:disabled)]:bg-[#24262c] [[data-ui~=rodape-entrada]_&]:p-0',
                                        "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                                        '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                                    ].join(' ')}
                                    disabled={ocupado}
                                    onClick={() => executar(() => ponte!.importarProjetor(modelo.id))}
                                    aria-label={`Importar projetor visual para ${modelo.nome}`}
                                    title="Importar o arquivo mmproj GGUF compatível com este modelo"
                                >
                                    <ImageIcon size={18} />
                                </button>
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
                                            'text-[#a1a5ad] rounded-[6px] p-[8px]',
                                        ].join(' '),
                                        'border-0 border-solid border-current [&:hover:not(:disabled)]:text-[#e6e7e9]',
                                        '[&:hover:not(:disabled)]:bg-[#24262c] [[data-ui~=rodape-entrada]_&]:p-0',
                                        "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                                        '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                                    ].join(' ')}
                                    disabled={ocupado}
                                    onClick={() => executar(() => ponte!.carregarModelo(modelo.id))}
                                    aria-label={`Carregar ${modelo.nome}`}
                                >
                                    <PlayIcon size={18} />
                                </button>
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
                                            'text-[#a1a5ad] rounded-[6px] p-[8px]',
                                        ].join(' '),
                                        'border-0 border-solid border-current [&:hover:not(:disabled)]:text-[#e6e7e9]',
                                        '[&:hover:not(:disabled)]:bg-[#24262c] [[data-ui~=rodape-entrada]_&]:p-0',
                                        "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                                        '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                                    ].join(' ')}
                                    disabled={ocupado}
                                    onClick={() =>
                                        modelo.catalogoId
                                            ? definirRemovendo(modelo)
                                            : executar(() => ponte!.removerModelo(modelo.id))
                                    }
                                    aria-label={
                                        modelo.catalogoId
                                            ? `Excluir download de ${modelo.nome}`
                                            : `Remover ${modelo.nome} da lista`
                                    }
                                    title={modelo.catalogoId ? 'Excluir arquivo baixado' : 'Preservar arquivo original'}
                                >
                                    <TrashIcon size={17} />
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}
            {removendo && (
                <Modal titulo={`Excluir ${removendo.nome}?`} fechar={() => definirRemovendo(null)}>
                    <p
                        data-ui="texto-secundario mb-6"
                        className={[
                            'mb-6 text-[#a1a5ad] text-[12px] leading-[1.7]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#a1a5ad]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                            '[[data-ui~=usuario-direita]_&]:text-[#a1a5ad]',
                            '[[data-ui~=usuario-direita]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                        ].join(' ')}
                    >
                        O arquivo baixado será apagado. Você poderá baixar o modelo novamente.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button
                            data-ui="botao"
                            className={[
                                'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                                'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                                '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                [
                                    '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                    '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                ].join(' '),
                                '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                            ].join(' ')}
                            onClick={() => definirRemovendo(null)}
                        >
                            Cancelar
                        </button>
                        <button
                            data-ui="botao botao-primario"
                            className={[
                                'inline-flex items-center justify-center gap-[9px] bg-[#e0d8ef] rounded-[8px]',
                                'whitespace-nowrap text-[#251b38] px-[14px] py-[9px] border border-solid',
                                'border-transparent [&:hover:not(:disabled)]:bg-[#cec0e5]',
                                [
                                    '[[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                    '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                ].join(' '),
                                '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                            ].join(' ')}
                            disabled={ocupado}
                            onClick={async () => {
                                await executar(async () => {
                                    const resultado = await ponte!.removerModelo(removendo.id);
                                    if (resultado.ok) definirRemovendo(null);
                                    return resultado;
                                });
                            }}
                        >
                            Excluir download
                        </button>
                    </div>
                </Modal>
            )}
        </>
    );
}
