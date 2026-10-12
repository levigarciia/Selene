import { useState } from 'react';
import { CaretRightIcon, PlusIcon } from '@phosphor-icons/react';
import type { Estado, Modelo, PonteSelene } from '../../shared/contratos';
import { formatarTamanho, catalogoModelos, encontrarModeloLocal } from '../../shared/catalogo';
import { configuracaoParaModelo } from '../../shared/configuracaoMotor';
import type { HardwareLocal } from '../../shared/compatibilidadeModelo';
import { estimarVelocidadeModelo } from '../../shared/velocidadeModelo';
import type { Executar } from './Configuracoes';
import { Modal } from './Modal';
import { PerfilModelo } from './PerfilModelo';
import { Cartao, Linha, Ponto, botaoPequeno, botaoSecundario } from './PainelConfiguracoes';

/** Modelos locais instalados, com perfil por modelo disponível na própria linha. */
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
    const [removendo, definirRemovendo] = useState<Modelo | null>(null);
    const ocupado = !!estado.conversaEmExecucao || ['instalando', 'carregando'].includes(estado.motor.fase);
    const locais = estado.modelos.filter((modelo) => !modelo.openrouter && !modelo.assinatura);
    return (
        <>
            <section id="config-modelos" tabIndex={-1} className="flex flex-col gap-2.5 outline-none">
                <div className="flex min-h-7 items-center justify-between gap-4 px-4 max-sm:px-3">
                    <h2 className="text-sm font-normal text-principal/70">Modelos locais</h2>
                    <button className={botaoPequeno} onClick={() => executar(() => ponte!.importarModelo())}>
                        <PlusIcon size={13} />
                        Importar GGUF
                    </button>
                </div>
                <Cartao>
                    <div data-ui="lista-modelos" className="flex flex-col divide-y divide-white/[0.06]">
                        {!locais.length && (
                            <Linha
                                titulo="Nenhum modelo"
                                descricao="Importe um GGUF ou baixe um modelo pelo seletor de modelos da conversa."
                            />
                        )}
                        {locais.map((modelo) => {
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
                                <div key={modelo.id} data-ui="linha-modelo" className="px-4 py-3 max-sm:px-3">
                                    <div className="flex items-center gap-4">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="flex items-center gap-2 truncate text-sm font-medium">
                                                {carregado && <Ponto tom="ok" />}
                                                <span className="truncate">{modelo.nome}</span>
                                            </h3>
                                            <p className="mt-1 text-xs text-discreto" title={estimativa.detalhe}>
                                                {formatarTamanho(modelo.tamanho)} · {estimativa.rotulo}
                                                {carregado ? ' · Carregado' : ''}
                                            </p>
                                        </div>
                                        <button
                                            className={botaoSecundario}
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
                                    <details className="group mt-1.5 text-xs">
                                        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 py-1 text-secundario hover:text-principal [&::-webkit-details-marker]:hidden">
                                            <CaretRightIcon
                                                size={11}
                                                className="transition-transform group-open:rotate-90"
                                            />
                                            Opções de {modelo.nome}
                                        </summary>
                                        <div
                                            className="mt-2 flex flex-col gap-4 rounded-lg border border-white/[0.06] bg-fundo/60 p-3
                                                    [&_label]:flex [&_label]:flex-col [&_label]:gap-2
                                                    [&_input:not([type=checkbox])]:h-8 [&_input:not([type=checkbox])]:rounded-lg
                                                    [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-borda
                                                    [&_input:not([type=checkbox])]:bg-fundo [&_input:not([type=checkbox])]:px-2.5
                                                    [&_select]:h-8 [&_select]:rounded-lg [&_select]:border [&_select]:border-borda
                                                    [&_select]:bg-fundo [&_select]:px-2.5"
                                        >
                                            <p className="text-discreto">{estimativa.detalhe}</p>
                                            <PerfilModelo
                                                modelo={modelo}
                                                configuracao={estado.configuracao}
                                                ocupado={ocupado}
                                                ponte={ponte}
                                                executar={executar}
                                            />
                                            <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
                                                <button
                                                    className={botaoSecundario}
                                                    disabled={ocupado}
                                                    onClick={() => executar(() => ponte!.importarProjetor(modelo.id))}
                                                >
                                                    {modelo.projetorVisual
                                                        ? 'Trocar projetor visual'
                                                        : 'Importar projetor visual'}
                                                </button>
                                                {modelo.projetorVisual && (
                                                    <span className="text-discreto">Projetor visual vinculado.</span>
                                                )}
                                                <button
                                                    className={`${botaoPequeno} ml-auto hover:text-[#eab1aa]`}
                                                    aria-label={`${
                                                        modelo.catalogoId ? 'Excluir download de' : 'Remover da lista'
                                                    } ${modelo.nome}`}
                                                    disabled={ocupado}
                                                    onClick={() => definirRemovendo(modelo)}
                                                >
                                                    {modelo.catalogoId ? 'Excluir download' : 'Remover da lista'}
                                                </button>
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            );
                        })}
                    </div>
                </Cartao>
            </section>
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
                    <div className="mt-5 flex justify-end gap-3">
                        <button className={botaoSecundario} onClick={() => definirRemovendo(null)}>
                            Cancelar
                        </button>
                        <button
                            className={botaoSecundario}
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
