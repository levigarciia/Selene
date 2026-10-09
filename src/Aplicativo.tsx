import { useState } from 'react';
import { ArrowLeftIcon, XIcon } from '@phosphor-icons/react';
import type { Conversa } from '../shared/contratos';
import { useSelene } from './hooks/useSelene';
import { BarraLateral } from './components/BarraLateral';
import { BarraJanela } from './components/BarraJanela';
import { Configuracoes } from './components/Configuracoes';
import { TelaConversa } from './components/TelaConversa';
import { Modal } from './components/Modal';
import { Estatisticas } from './components/Estatisticas';

function lerSidebarRecolhida(): boolean {
    try {
        return localStorage.getItem('selene.sidebarRecolhida') === 'true';
    } catch {
        return false;
    }
}

/** Coordena navegação, janela e ações do histórico preservando os rascunhos das telas. */
export function Aplicativo() {
    const dados = useSelene();
    const { estado, erro, carregando, executar, definirErro, ponte } = dados;
    const [ativas, definirAtivas] = useState<Record<'chat' | 'code', string | null>>({ chat: null, code: null });
    const [modoInicial, definirModoInicial] = useState<'chat' | 'code'>('chat');
    const [configurando, definirConfigurando] = useState(false);
    const [configuracoesMontadas, definirConfiguracoesMontadas] = useState(false);
    const [recolhida, definirRecolhida] = useState(lerSidebarRecolhida);
    const [excluindo, definirExcluindo] = useState<Conversa | null>(null);
    const [excluindoConcluidas, definirExcluindoConcluidas] = useState(false);
    const [estatisticasAbertas, definirEstatisticasAbertas] = useState(false);
    const [atualizacoesAbertas, definirAtualizacoesAbertas] = useState(false);
    const [apagando, definirApagando] = useState(false);
    const quantidadeConcluidas = estado.conversas.filter((item) => item.modo === 'code' && item.concluida).length;
    const ativa = ativas[modoInicial];
    const conversa = estado.conversas.find((item) => item.id === ativa);
    const ocupado = !!estado.conversaEmExecucao;
    function configurar() {
        definirConfiguracoesMontadas(true);
        definirConfigurando(true);
    }
    function selecionar(id: string) {
        const escolhida = estado.conversas.find((item) => item.id === id);
        const modo = escolhida?.modo ?? modoInicial;
        definirModoInicial(modo);
        definirAtivas((anteriores) => ({ ...anteriores, [modo]: id }));
        definirConfigurando(false);
    }
    if (carregando) return <div className="tela-carregando">Abrindo a Selene</div>;
    return (
        <div className={`aplicativo ${recolhida ? 'aplicativo-recolhido' : ''}`}>
            <BarraLateral
                estado={estado}
                modo={modoInicial}
                alterarModo={(modo) => {
                    definirModoInicial(modo);
                    definirConfigurando(false);
                }}
                concluir={(item) => {
                    void executar(() => ponte!.alterarConversa(item.id, { concluida: !item.concluida }));
                }}
                ativa={ativa}
                selecionar={selecionar}
                configurar={configurar}
                estatisticas={() => definirEstatisticasAbertas(true)}
                atualizar={() => definirAtualizacoesAbertas(true)}
                excluirConcluidas={() => definirExcluindoConcluidas(true)}
                configurando={configurando}
                recolhida={recolhida}
                alternar={() => {
                    definirRecolhida((anterior) => {
                        try {
                            localStorage.setItem('selene.sidebarRecolhida', String(!anterior));
                        } catch {}
                        return !anterior;
                    });
                }}
                criar={async (origemId) => {
                    const nova = await executar(() =>
                        ponte!.novaConversa(
                            origemId ? 'code' : (conversa?.modo ?? modoInicial),
                            origemId ?? conversa?.id,
                        ),
                    );
                    if (nova) selecionar(nova.id);
                }}
                criarProjeto={async () => {
                    const nova = await executar(() => ponte!.novaConversa('code'));
                    if (!nova) return;
                    const escolhido = await executar(() => ponte!.escolherProjeto(nova.id));
                    if (escolhido) selecionar(nova.id);
                    else await executar(() => ponte!.excluirConversa(nova.id));
                }}
                exportar={(id) => {
                    void executar(() => ponte!.exportarConversa(id));
                }}
                excluir={definirExcluindo}
            />
            <main className="area-principal">
                <BarraJanela ponte={ponte}>
                    {configurando ? (
                        <>
                            <button
                                className="botao-icone"
                                aria-label="Voltar à conversa"
                                onClick={() => definirConfigurando(false)}
                            >
                                <ArrowLeftIcon size={18} />
                            </button>
                            <h1 className="titulo-tela">Configurações</h1>
                        </>
                    ) : conversa ? (
                        <input
                            className="titulo-conversa"
                            aria-label="Título da conversa"
                            key={`${conversa.id}:${conversa.titulo}`}
                            defaultValue={conversa.titulo}
                            disabled={ocupado}
                            onBlur={(evento) => {
                                const titulo = evento.target.value.trim();
                                if (titulo && titulo !== conversa.titulo) {
                                    void executar(() => ponte!.alterarConversa(conversa.id, { titulo }));
                                }
                            }}
                            onKeyDown={(evento) => {
                                if (evento.key === 'Enter') evento.currentTarget.blur();
                            }}
                        />
                    ) : (
                        <span className="texto-secundario">Selene</span>
                    )}
                </BarraJanela>
                {erro && (
                    <div className="aviso-erro aviso-global" role="alert">
                        <span>{erro}</span>
                        <button className="botao-icone" aria-label="Fechar aviso" onClick={() => definirErro('')}>
                            <XIcon size={16} />
                        </button>
                    </div>
                )}
                <div className="area-tela" hidden={configurando}>
                    {(['chat', 'code'] as const).map((modo) => (
                        <div className="area-tela" key={modo} hidden={modo !== modoInicial}>
                            <TelaConversa
                                dados={dados}
                                modoInicial={modo}
                                ativa={ativas[modo]}
                                selecionar={selecionar}
                                configurar={configurar}
                                visivel={!configurando && modo === modoInicial}
                            />
                        </div>
                    ))}
                </div>
                {configuracoesMontadas && (
                    <div className="area-tela" hidden={!configurando}>
                        <Configuracoes estado={estado} ponte={ponte} executar={executar} />
                    </div>
                )}
            </main>
            {estatisticasAbertas && <Estatisticas estado={estado} fechar={() => definirEstatisticasAbertas(false)} />}
            {atualizacoesAbertas && (
                <Modal titulo="Atualizações" fechar={() => definirAtualizacoesAbertas(false)}>
                    <p className="texto-secundario">A fonte de atualizações ainda não foi configurada.</p>
                </Modal>
            )}
            {excluindoConcluidas && (
                <Modal
                    titulo="Apagar todos os chats concluídos?"
                    fechar={() => {
                        if (!apagando) definirExcluindoConcluidas(false);
                    }}
                >
                    <p className="texto-secundario mb-6">
                        {quantidadeConcluidas} conversas Code serão apagadas. As estatísticas de uso serão preservadas.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button className="botao" disabled={apagando} onClick={() => definirExcluindoConcluidas(false)}>
                            Cancelar
                        </button>
                        <button
                            className="botao botao-primario"
                            disabled={apagando || quantidadeConcluidas === 0}
                            onClick={async () => {
                                definirApagando(true);
                                try {
                                    const ids = await executar(() => ponte!.excluirConcluidas());
                                    if (!ids) return;
                                    const removidas = new Set(ids);
                                    definirAtivas((anteriores) => ({
                                        chat:
                                            anteriores.chat && removidas.has(anteriores.chat) ? null : anteriores.chat,
                                        code:
                                            anteriores.code && removidas.has(anteriores.code) ? null : anteriores.code,
                                    }));
                                    definirExcluindoConcluidas(false);
                                } finally {
                                    definirApagando(false);
                                }
                            }}
                        >
                            {apagando ? 'Apagando' : 'Apagar todos'}
                        </button>
                    </div>
                </Modal>
            )}
            {excluindo && (
                <Modal titulo="Excluir esta conversa?" fechar={() => definirExcluindo(null)}>
                    <p className="texto-secundario mb-6">O histórico de {excluindo.titulo} será removido.</p>
                    <div className="flex justify-end gap-3">
                        <button className="botao" onClick={() => definirExcluindo(null)}>
                            Cancelar
                        </button>
                        <button
                            className="botao botao-primario"
                            disabled={estado.conversaEmExecucao === excluindo.id}
                            onClick={() =>
                                executar(async () => {
                                    const resultado = await ponte!.excluirConversa(excluindo.id);
                                    if (resultado.ok) {
                                        definirAtivas((anteriores) => ({
                                            chat: anteriores.chat === excluindo.id ? null : anteriores.chat,
                                            code: anteriores.code === excluindo.id ? null : anteriores.code,
                                        }));
                                        definirExcluindo(null);
                                    }
                                    return resultado;
                                })
                            }
                        >
                            Excluir
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
