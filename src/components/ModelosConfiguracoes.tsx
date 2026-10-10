import { useState } from 'react';
import { PlusIcon } from '@phosphor-icons/react';
import type { Estado, Modelo, PonteSelene } from '../../shared/contratos';
import { formatarTamanho, catalogoModelos, encontrarModeloLocal } from '../../shared/catalogo';
import { configuracaoParaModelo } from '../../shared/configuracaoMotor';
import type { HardwareLocal } from '../../shared/compatibilidadeModelo';
import { estimarVelocidadeModelo } from '../../shared/velocidadeModelo';
import type { Executar } from './Configuracoes';
import { Modal } from './Modal';
import { CatalogoModelos } from './CatalogoModelos';
import { PerfilModelo } from './PerfilModelo';

const botao =
    'rounded-md border border-borda px-3 py-2 text-xs hover:bg-hover aria-pressed:bg-hover disabled:opacity-40';

/** Gerencia modelos com ações contextuais e perfis disponíveis na própria lista. */
export function ModelosConfiguracoes({
    estado,
    ponte,
    executar,
    hardware,
}: {
    estado: Estado;
    ponte?: PonteSelene;
    executar: Executar;
    hardware?: HardwareLocal;
}) {
    const [catalogo, definirCatalogo] = useState(false);
    const [removendo, definirRemovendo] = useState<Modelo | null>(null);
    const ocupado = !!estado.conversaEmExecucao || ['instalando', 'carregando'].includes(estado.motor.fase);
    return (
        <>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-5">
                <div className="flex gap-1" aria-label="Biblioteca de modelos">
                    <button className={botao} aria-pressed={!catalogo} onClick={() => definirCatalogo(false)}>
                        Instalados
                    </button>
                    <button className={botao} aria-pressed={catalogo} onClick={() => definirCatalogo(true)}>
                        Catálogo
                    </button>
                </div>
                <button
                    className="flex items-center gap-2 text-xs text-secundario hover:text-principal"
                    onClick={() => executar(() => ponte!.importarModelo())}
                >
                    <PlusIcon size={15} />
                    Importar GGUF
                </button>
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
                    hardware={hardware}
                    selecionar={async (id) => {
                        if (!estado.modelos.find((modelo) => modelo.id === id)?.openrouter)
                            await executar(() => ponte!.carregarModelo(id));
                    }}
                />
            ) : (
                <div data-ui="lista-modelos" className="flex flex-col">
                    {estado.modelos
                        .filter((modelo) => modelo.openrouter)
                        .map((modelo) => (
                            <div key={modelo.id} className="flex items-center gap-4 border-b border-borda py-3 text-xs">
                                <div className="min-w-0 flex-1">
                                    <strong className="block truncate font-medium">{modelo.nome}</strong>
                                    <span className="mt-1 block text-secundario">
                                        OpenRouter. Disponível na conversa.
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    disabled={ocupado}
                                    className={botao}
                                    onClick={() => definirRemovendo(modelo)}
                                >
                                    Remover da lista
                                </button>
                            </div>
                        ))}
                    {!estado.modelos.length && (
                        <p className="text-xs text-secundario py-5">
                            Importe um GGUF ou escolha um modelo no catálogo.
                        </p>
                    )}
                    {estado.modelos
                        .filter((modelo) => !modelo.openrouter)
                        .map((modelo) => {
                            const item = catalogoModelos.find((item) => encontrarModeloLocal(item, [modelo]));
                            const configuracao = configuracaoParaModelo(estado.configuracao, modelo);
                            const estimativa = estimarVelocidadeModelo({
                                tamanho: modelo.tamanho,
                                hardware,
                                contexto: configuracao.limitesAutomaticos ? 2048 : configuracao.contexto,
                                projetor: item?.projetorVisual?.tamanho,
                                somenteCpu: configuracao.backend === 'cpu',
                                camadasGpu: configuracao.limitesAutomaticos ? undefined : configuracao.camadasGpu,
                                identificacao: item?.nome ?? modelo.nome,
                            });
                            const carregado = estado.motor.modeloId === modelo.id && estado.motor.fase === 'pronto';
                            return (
                                <div key={modelo.id} data-ui="linha-modelo" className="border-b border-borda py-3">
                                    <div className="flex items-center gap-4">
                                        <div className="min-w-0 flex-1">
                                            <strong className="block truncate text-xs font-medium">
                                                {modelo.nome}
                                            </strong>
                                            <span
                                                className="block mt-1 text-xs text-secundario"
                                                title={estimativa.detalhe}
                                            >
                                                {formatarTamanho(modelo.tamanho)}. {estimativa.rotulo}
                                                {carregado ? '. Carregado' : ''}
                                            </span>
                                        </div>
                                        <button
                                            className={botao}
                                            disabled={ocupado}
                                            aria-label={`${carregado ? 'Descarregar' : 'Carregar'} ${modelo.nome}`}
                                            onClick={() =>
                                                executar(() =>
                                                    carregado ? ponte!.pararMotor() : ponte!.carregarModelo(modelo.id),
                                                )
                                            }
                                        >
                                            {carregado ? 'Descarregar' : 'Carregar'}
                                        </button>
                                    </div>
                                    <details className="mt-2 text-xs">
                                        <summary className="cursor-pointer text-secundario py-1">
                                            Opções de {modelo.nome}
                                        </summary>
                                        <div className="flex flex-col gap-4 pt-3 max-w-[580px]">
                                            <p className="text-secundario">{estimativa.detalhe}</p>
                                            <PerfilModelo
                                                modelo={modelo}
                                                configuracao={estado.configuracao}
                                                ocupado={ocupado}
                                                ponte={ponte}
                                                executar={executar}
                                            />
                                            <div className="flex flex-wrap items-center gap-3">
                                                <button
                                                    className={botao}
                                                    disabled={ocupado}
                                                    onClick={() => executar(() => ponte!.importarProjetor(modelo.id))}
                                                >
                                                    {modelo.projetorVisual
                                                        ? 'Trocar projetor visual'
                                                        : 'Importar projetor visual'}
                                                </button>
                                                <button
                                                    className="text-secundario hover:text-[#eab1aa]"
                                                    aria-label={`${
                                                        modelo.catalogoId ? 'Excluir download de' : 'Remover da lista'
                                                    } ${modelo.nome}`}
                                                    disabled={ocupado}
                                                    onClick={() => definirRemovendo(modelo)}
                                                >
                                                    {modelo.catalogoId ? 'Excluir download' : 'Remover da lista'}
                                                </button>
                                            </div>
                                            {modelo.projetorVisual && (
                                                <p className="text-secundario">Projetor visual vinculado.</p>
                                            )}
                                        </div>
                                    </details>
                                </div>
                            );
                        })}
                </div>
            )}
            {removendo && (
                <Modal
                    titulo={`${removendo.catalogoId ? 'Excluir' : 'Remover'} ${removendo.nome}?`}
                    fechar={() => definirRemovendo(null)}
                >
                    <p className="text-sm">
                        {removendo.nome}.{' '}
                        {removendo.catalogoId
                            ? 'O arquivo baixado será excluído.'
                            : 'O arquivo importado será preservado.'}
                    </p>
                    <div className="flex justify-end gap-3 mt-5">
                        <button className={botao} onClick={() => definirRemovendo(null)}>
                            Cancelar
                        </button>
                        <button
                            className={botao}
                            disabled={ocupado}
                            onClick={async () => {
                                await executar(async () => {
                                    const resultado = await ponte!.removerModelo(removendo.id);
                                    if (resultado.ok) definirRemovendo(null);
                                    return resultado;
                                });
                            }}
                        >
                            {removendo.catalogoId ? 'Excluir download' : 'Remover da lista'}
                        </button>
                    </div>
                </Modal>
            )}
        </>
    );
}
