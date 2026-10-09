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
            <div className="cabecalho-modelos-config">
                <h2>{catalogo ? 'Catálogo' : 'Seus modelos'}</h2>
                <div className="flex gap-3">
                    <button type="button" className="botao" onClick={() => definirCatalogo(!catalogo)}>
                        {catalogo ? <ArrowLeftIcon size={16} /> : <DownloadSimpleIcon size={16} />}
                        {catalogo ? 'Seus modelos' : 'Baixar modelos'}
                    </button>
                    <button type="button" className="botao" onClick={() => executar(() => ponte!.importarModelo())}>
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
                        <p className="estado-vazio-pequeno">Baixe um modelo ou importe um arquivo GGUF.</p>
                    )}
                    <div className="lista-modelos">
                        {estado.modelos.map((modelo) => (
                            <div className="linha-modelo" key={modelo.id}>
                                <div className="min-w-0 flex-1">
                                    <strong className="truncate block" title={modelo.nome}>
                                        {modelo.nome}
                                    </strong>
                                    <span className="texto-secundario">
                                        {(modelo.tamanho / 1024 ** 3).toFixed(2)} GB
                                        {modelo.catalogoId ? ' · Baixado' : ' · Importado'}
                                        {modelo.projetorVisual ? ' · Projetor visual vinculado' : ''}
                                        {estado.motor.modeloId === modelo.id && estado.motor.fase === 'pronto'
                                            ? ' · Carregado'
                                            : ''}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="botao-icone"
                                    disabled={ocupado}
                                    onClick={() => executar(() => ponte!.importarProjetor(modelo.id))}
                                    aria-label={`Importar projetor visual para ${modelo.nome}`}
                                    title="Importar o arquivo mmproj GGUF compatível com este modelo"
                                >
                                    <ImageIcon size={18} />
                                </button>
                                <button
                                    type="button"
                                    className="botao-icone"
                                    disabled={ocupado}
                                    onClick={() => executar(() => ponte!.carregarModelo(modelo.id))}
                                    aria-label={`Carregar ${modelo.nome}`}
                                >
                                    <PlayIcon size={18} />
                                </button>
                                <button
                                    type="button"
                                    className="botao-icone"
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
                    <p className="texto-secundario mb-6">
                        O arquivo baixado será apagado. Você poderá baixar o modelo novamente.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button className="botao" onClick={() => definirRemovendo(null)}>
                            Cancelar
                        </button>
                        <button
                            className="botao botao-primario"
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
