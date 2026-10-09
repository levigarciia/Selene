import { useEffect, useRef, useState } from 'react';
import {
    ArrowDownIcon,
    ArrowUpIcon,
    BrainIcon,
    MoonIcon,
    LockSimpleIcon,
    LockSimpleOpenIcon,
    PaperclipIcon,
    StopIcon,
    XIcon,
} from '@phosphor-icons/react';
import type { useSelene } from '../hooks/useSelene';
import { MensagemConversa } from './MensagemConversa';
import { MenuOpcoesEntrada } from './MenuOpcoesEntrada';
import { niveisRaciocinio, nomesRaciocinio, resolverNivelRaciocinio } from '../../shared/raciocinio';
import { CatalogoModelos } from './CatalogoModelos';
import { useAnexos } from '../hooks/useAnexos';
import { ImagemConversa } from './ImagemConversa';
import { TarefasConversa } from './TarefasConversa';
import { SeletorProjeto } from './SeletorProjeto';
import type { Conversa } from '../../shared/contratos';

/** Coordena os dois modos do MVP e os controles da conversa selecionada. */
export function TelaConversa({
    dados,
    ativa,
    selecionar,
    configurar,
    visivel,
    modoInicial,
    adicionarProjeto,
}: {
    dados: ReturnType<typeof useSelene>;
    ativa: string | null;
    selecionar: (id: string) => void;
    configurar: () => void;
    visivel: boolean;
    modoInicial: 'chat' | 'code';
    adicionarProjeto: () => void;
}) {
    const { estado, executar, ponte } = dados;
    const [catalogoAberto, definirCatalogoAberto] = useState(false);
    const [enviando, definirEnviando] = useState(false);
    const [selecionandoProjeto, definirSelecionandoProjeto] = useState(false);
    const rolagem = useRef<HTMLDivElement>(null);
    const acompanhar = useRef(true);
    const seletorImagens = useRef<HTMLInputElement>(null);
    const [arrastando, definirArrastando] = useState(false);
    const conversa = estado.conversas.find((item) => item.id === ativa);
    const anexos = useAnexos(ativa, ponte, dados.definirErro, (quantidade) => {
        if (conversa && quantidade !== (conversa.anexosRascunho ?? 0)) {
            dados.alterarRascunho(conversa, { anexosRascunho: quantidade });
        }
    });
    const texto = conversa?.rascunho ?? '';
    const modo = conversa?.modo ?? modoInicial;
    const ocupado = !!estado.conversaEmExecucao || enviando || selecionandoProjeto;
    const inicial = !conversa?.mensagens.length;
    const modeloId = conversa?.modeloId ?? estado.motor.modeloId ?? estado.modelos[0]?.id ?? '';
    const modelo = estado.modelos.find((item) => item.id === modeloId);
    const niveis = niveisRaciocinio(modelo);
    const nivel = resolverNivelRaciocinio(modelo, conversa?.nivelRaciocinio);
    const motorOcupado = ['carregando', 'instalando'].includes(estado.motor.fase);
    const ultimaResposta = conversa?.mensagens
        .slice()
        .reverse()
        .find((mensagem) => mensagem.papel === 'assistant');

    useEffect(() => {
        definirCatalogoAberto(false);
        acompanhar.current = true;
    }, [ativa]);

    useEffect(() => {
        if (!visivel) {
            definirCatalogoAberto(false);
            return;
        }
        if (acompanhar.current && rolagem.current) rolagem.current.scrollTop = rolagem.current.scrollHeight;
    }, [conversa?.mensagens, visivel]);

    async function obterConversa() {
        if (conversa && dados.estadoPersistido.conversas.some((item) => item.id === conversa.id)) return conversa;
        const rascunho = conversa ?? dados.criarRascunho(modo);
        const nova = await executar(() => ponte!.promoverRascunho({ ...rascunho, modeloId: modeloId || null }));
        if (nova) {
            if (ativa !== nova.id) anexos.transferir(nova.id);
            selecionar(nova.id);
            return nova;
        }
    }

    async function enviar() {
        if ((!texto.trim() && !anexos.imagens.length) || ocupado || motorOcupado || anexos.importando) return;
        definirEnviando(true);
        try {
            const atual = await obterConversa();
            if (!atual) return;
            if (modeloId !== atual.modeloId) {
                await executar(() => ponte!.alterarConversa(atual.id, { modeloId: modeloId || null }));
            }
            acompanhar.current = true;
            await executar(async () => {
                const resultado = await ponte!.enviar(
                    atual.id,
                    texto,
                    anexos.imagens.map((imagem) => imagem.id),
                );
                if (resultado.ok) {
                    dados.confirmarEnvioRascunho(atual.id, texto);
                    anexos.limpar(atual.id);
                }
                return resultado;
            });
        } finally {
            definirEnviando(false);
        }
    }

    async function escolherProjeto(caminho?: string | null) {
        if (ocupado) return;
        definirSelecionandoProjeto(true);
        try {
            if (caminho === undefined) return adicionarProjeto();
            const atual = conversa ?? dados.criarRascunho(modo);
            const projeto = estado.projetos.find((item) => item.caminho === caminho);
            if (caminho !== null && !projeto) return dados.definirErro('Projeto não encontrado.');
            if (dados.estadoPersistido.conversas.some((item) => item.id === atual.id)) {
                await executar(() => ponte!.escolherProjeto(atual.id, caminho));
            } else {
                dados.alterarRascunho(atual, { projeto: projeto?.caminho ?? null, projetoId: projeto?.id ?? null });
            }
            selecionar(atual.id);
        } finally {
            definirSelecionandoProjeto(false);
        }
    }

    async function alterarOpcoes(alteracao: Partial<Conversa>) {
        const atual = conversa ?? dados.criarRascunho(modo);
        if (dados.estadoPersistido.conversas.some((item) => item.id === atual.id)) {
            await executar(() => ponte!.alterarConversa(atual.id, alteracao));
        } else {
            dados.alterarRascunho(atual, alteracao);
        }
        selecionar(atual.id);
    }

    function definirTexto(texto: string) {
        const atual = conversa ?? dados.criarRascunho(modo);
        dados.alterarRascunho(atual, { rascunho: texto });
        selecionar(atual.id);
    }

    const seletorProjeto = modo === 'code' && (
        <SeletorProjeto conversa={conversa} projetos={estado.projetos} ocupado={ocupado} escolher={escolherProjeto} />
    );

    return (
        <div className={`tela-conversa ${inicial ? 'tela-inicial' : ''}`}>
            <div className="barra-contexto">
                <button
                    className={`estado-motor ${estado.motor.fase === 'pronto' ? 'motor-pronto' : ''}`}
                    onClick={configurar}
                >
                    {estado.motor.fase === 'pronto'
                        ? 'Modelo carregado'
                        : motorOcupado
                          ? 'Preparando modelo'
                          : 'Configurar modelo'}
                </button>
            </div>
            <div
                className="conteudo-conversa"
                ref={rolagem}
                onScroll={() => {
                    const elemento = rolagem.current;
                    if (elemento)
                        acompanhar.current = elemento.scrollHeight - elemento.scrollTop - elemento.clientHeight < 100;
                }}
            >
                {!conversa?.mensagens.length ? (
                    <div className="boas-vindas">
                        <MoonIcon size={38} weight="thin" className="simbolo-selene" />
                        <h1>{modo === 'chat' ? 'O que vamos explorar?' : 'Em que vamos trabalhar?'}</h1>
                        {modo === 'chat' ? <p>Tudo no seu computador.</p> : seletorProjeto}
                        {estado.modelos.length === 0 && (
                            <button className="botao mt-6" onClick={() => definirCatalogoAberto(true)}>
                                Explorar modelos
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="lista-mensagens">
                        {conversa.mensagens.map((mensagem) => (
                            <MensagemConversa
                                key={mensagem.id}
                                mensagem={mensagem}
                                modo={modo}
                                ponte={ponte}
                                executar={executar}
                            />
                        ))}
                    </div>
                )}
            </div>
            <div className="area-entrada">
                {modo === 'code' && (
                    <TarefasConversa
                        mensagem={ultimaResposta}
                        abrirHistorico={() => {
                            const elemento = document.getElementById(`mensagem-${ultimaResposta?.id}`);
                            const historico = elemento?.querySelector<HTMLDetailsElement>('.historico-tarefa');
                            if (historico) historico.open = true;
                            acompanhar.current = false;
                            elemento?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                    />
                )}
                {!ponte && <p className="aviso-web">Prévia da interface. Execute bun run dev para usar o desktop.</p>}
                <form
                    className={`entrada ${arrastando ? 'entrada-arrastando' : ''}`}
                    onDragOver={(evento) => {
                        if (!evento.dataTransfer.types.includes('Files')) return;
                        evento.preventDefault();
                        if (!ocupado && !anexos.importando) definirArrastando(true);
                    }}
                    onDragLeave={(evento) => {
                        if (!evento.currentTarget.contains(evento.relatedTarget as Node)) definirArrastando(false);
                    }}
                    onDrop={(evento) => {
                        evento.preventDefault();
                        definirArrastando(false);
                        if (!ocupado && !anexos.importando) void anexos.anexar(Array.from(evento.dataTransfer.files));
                    }}
                    onSubmit={(evento) => {
                        evento.preventDefault();
                        void enviar();
                    }}
                >
                    <input
                        ref={seletorImagens}
                        type="file"
                        hidden
                        multiple
                        accept="image/png,image/jpeg,image/webp"
                        aria-label="Selecionar imagens"
                        onChange={(evento) => {
                            void anexos.anexar(Array.from(evento.target.files ?? []));
                            evento.target.value = '';
                        }}
                    />
                    {!!anexos.imagens.length && (
                        <div className="anexos-entrada">
                            {anexos.imagens.map((imagem) => (
                                <div className="anexo-rascunho" key={imagem.id}>
                                    <ImagemConversa imagem={imagem} previa={imagem.previa} />
                                    <button
                                        type="button"
                                        className="remover-anexo"
                                        disabled={ocupado || anexos.importando}
                                        aria-label={`Remover ${imagem.nome}`}
                                        onClick={() => anexos.remover(imagem.id)}
                                    >
                                        <XIcon size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <textarea
                        aria-label="Mensagem"
                        placeholder={modo === 'code' ? 'Descreva o que você quer fazer' : 'Escreva sua mensagem'}
                        rows={3}
                        maxLength={30000}
                        value={texto}
                        onChange={(evento) => definirTexto(evento.target.value)}
                        onPaste={(evento) => {
                            const arquivos = Array.from(evento.clipboardData.files);
                            if (!arquivos.length) return;
                            evento.preventDefault();
                            if (!ocupado && !anexos.importando) void anexos.anexar(arquivos);
                        }}
                        onKeyDown={(evento) => {
                            if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
                                evento.preventDefault();
                                void enviar();
                            }
                        }}
                    />
                    <div className="barra-entrada">
                        <CatalogoModelos
                            estado={estado}
                            ponte={ponte}
                            executar={executar}
                            modeloId={modeloId}
                            aberto={catalogoAberto}
                            definirAberto={definirCatalogoAberto}
                            selecionar={(id) => alterarOpcoes({ modeloId: id })}
                        />
                        {!!niveis.length && (
                            <MenuOpcoesEntrada
                                key={`raciocinio-${ativa}-${modeloId}`}
                                rotulo="Nível de raciocínio"
                                nome={nomesRaciocinio[nivel]}
                                icone={<BrainIcon size={16} />}
                                valor={nivel}
                                desativado={ocupado || motorOcupado}
                                opcoes={niveis.map((valor) => ({ valor, nome: nomesRaciocinio[valor] }))}
                                alterar={async (valor) => {
                                    const escolhido = niveis.find((item) => item === valor);
                                    if (!escolhido) return;
                                    await alterarOpcoes({ modeloId, nivelRaciocinio: escolhido });
                                }}
                            />
                        )}
                        {modo === 'code' && (
                            <MenuOpcoesEntrada
                                key={`permissao-${ativa}`}
                                rotulo="Permissão da conversa"
                                nome={conversa?.acessoCompleto ? 'Acesso completo' : 'Pedir aprovação'}
                                icone={
                                    conversa?.acessoCompleto ? (
                                        <LockSimpleOpenIcon size={16} />
                                    ) : (
                                        <LockSimpleIcon size={16} />
                                    )
                                }
                                valor={conversa?.acessoCompleto ? 'completo' : 'aprovacao'}
                                desativado={ocupado}
                                opcoes={[
                                    {
                                        valor: 'aprovacao',
                                        nome: 'Pedir aprovação',
                                        descricao: 'Leituras no projeto. Escritas e comandos pedem aprovação.',
                                    },
                                    {
                                        valor: 'completo',
                                        nome: 'Acesso completo',
                                        descricao:
                                            'Arquivos e comandos em todo o computador sem aprovação nesta conversa.',
                                    },
                                ]}
                                alterar={(valor) => alterarOpcoes({ acessoCompleto: valor === 'completo' })}
                            />
                        )}
                        <div className="flex-1" />
                        {anexos.importando && (
                            <span className="texto-secundario" role="status">
                                Preparando imagens
                            </span>
                        )}
                        {conversa?.mensagens.at(-1)?.usoContexto && (
                            <span
                                className="uso-contexto"
                                title="Estimativa conservadora do contexto usado, com reserva para imagens"
                            >
                                {Math.min(
                                    100,
                                    Math.round(
                                        (conversa.mensagens.at(-1)!.usoContexto!.tokens /
                                            conversa.mensagens.at(-1)!.usoContexto!.limite) *
                                            100,
                                    ),
                                )}
                                % do contexto
                            </span>
                        )}
                        <button
                            type="button"
                            className="botao-icone botao-anexar"
                            aria-label="Anexar imagens"
                            title="Anexar imagens"
                            disabled={ocupado || anexos.importando || anexos.imagens.length >= 4}
                            onClick={() => seletorImagens.current?.click()}
                        >
                            <PaperclipIcon size={18} />
                        </button>
                        {estado.conversaEmExecucao || enviando || motorOcupado ? (
                            <button
                                className="botao-enviar botao-interromper"
                                type="button"
                                aria-label="Interromper tarefa"
                                onClick={() => executar(() => ponte!.cancelar())}
                            >
                                <StopIcon size={18} weight="fill" />
                            </button>
                        ) : (
                            <button
                                className="botao-enviar"
                                type="submit"
                                aria-label="Enviar mensagem"
                                disabled={
                                    (!texto.trim() && !anexos.imagens.length) ||
                                    !modeloId ||
                                    anexos.importando ||
                                    selecionandoProjeto
                                }
                            >
                                <ArrowUpIcon size={20} weight="bold" />
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
