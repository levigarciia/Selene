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
        <div
            data-ui={`tela-conversa ${inicial ? 'tela-inicial' : ''}`}
            className={[
                'flex flex-col flex-1 min-w-0 min-h-0',
                inicial
                    ? [
                          '[&&]:grid',
                          '[&&]:grid-rows-[auto_minmax(24px,_1fr)_auto_auto_minmax(24px,_1.3fr)]',
                          '[&&]:overflow-y-auto',
                      ].join(' ')
                    : '',
            ].join(' ')}
        >
            <div
                data-ui="barra-contexto"
                className={[
                    '[[data-ui~=tela-inicial]_&]:row-[1] flex items-center gap-[17px] min-h-[76px] px-[30px]',
                    'py-[20px] [@media(width<=760px)]:gap-[10px] [@media(width<=760px)]:p-[16px]',
                ].join(' ')}
            >
                <button
                    data-ui={`estado-motor ${estado.motor.fase === 'pronto' ? 'motor-pronto' : ''}`}
                    className={[
                        [
                            'ml-auto bg-transparent text-[11px] text-[#a1a5ad] border-0 border-solid',
                            'border-[currentColor]',
                        ].join(' '),
                        estado.motor.fase === 'pronto' ? '[&&]:text-[#b5a2dc]' : '',
                    ].join(' ')}
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
                data-ui="conteudo-conversa"
                className={[
                    '[[data-ui~=tela-inicial]_&]:row-[3] [[data-ui~=tela-inicial]_&]:overflow-visible flex-1',
                    'min-h-0 overflow-y-auto px-[36px] py-0 [@media(width<=760px)]:px-[20px]',
                    '[@media(width<=760px)]:py-[0]',
                ].join(' ')}
                ref={rolagem}
                onScroll={() => {
                    const elemento = rolagem.current;
                    if (elemento)
                        acompanhar.current = elemento.scrollHeight - elemento.scrollTop - elemento.clientHeight < 100;
                }}
            >
                {!conversa?.mensagens.length ? (
                    <div
                        data-ui="boas-vindas"
                        className={[
                            '[[data-ui~=tela-inicial]_&]:min-h-0 [[data-ui~=tela-inicial]_&]:pt-0',
                            '[[data-ui~=tela-inicial]_&]:pb-[28px] [[data-ui~=tela-inicial]_&]:px-0 min-h-full flex',
                            'flex-col items-center justify-center pt-[35px] pb-[45px] px-0 [&_>_p]:text-[#a1a5ad]',
                            '[&_>_p]:text-[13px] [&_>_p]:text-center',
                        ].join(' ')}
                    >
                        <MoonIcon
                            size={38}
                            weight="thin"
                            data-ui="simbolo-selene"
                            className="text-[#b5a2dc] mb-[24px]"
                        />
                        <h1 className="text-[29px] leading-[1.3] font-[450] tracking-[-0.7px] mt-0 mb-[13px] mx-0">
                            {modo === 'chat' ? 'O que vamos explorar?' : 'Em que vamos trabalhar?'}
                        </h1>
                        {modo === 'chat' ? <p>Tudo no seu computador.</p> : seletorProjeto}
                        {estado.modelos.length === 0 && (
                            <button
                                data-ui="botao mt-6"
                                className={[
                                    'mt-6 inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                                    'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                                    '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                    [
                                        '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                        '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                    ].join(' '),
                                    '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                                ].join(' ')}
                                onClick={() => definirCatalogoAberto(true)}
                            >
                                Explorar modelos
                            </button>
                        )}
                    </div>
                ) : (
                    <div data-ui="lista-mensagens" className="max-w-[730px] pt-[20px] pb-[40px] px-0 mx-auto my-0">
                        {conversa.mensagens.map((mensagem) => (
                            <MensagemConversa
                                key={mensagem.id}
                                mensagem={mensagem}
                                emExecucao={estado.conversaEmExecucao === conversa.id && mensagem === ultimaResposta}
                                modo={modo}
                                ponte={ponte}
                                executar={executar}
                            />
                        ))}
                    </div>
                )}
            </div>
            <div
                data-ui="area-entrada"
                className={[
                    '[[data-ui~=tela-inicial]_&]:row-[4] [[data-ui~=tela-inicial]_&]:w-[min(760px,_100%)]',
                    '[[data-ui~=tela-inicial]_&]:pb-0 w-[min(800px,_100%)] pt-0 pb-[24px] px-[30px] mx-auto',
                    'my-0 [@media(width<=760px)]:pt-0 [@media(width<=760px)]:pb-[20px]',
                    '[@media(width<=760px)]:px-[16px]',
                ].join(' ')}
            >
                {modo === 'code' && (
                    <TarefasConversa
                        mensagem={ultimaResposta}
                        abrirHistorico={() => {
                            const elemento = document.getElementById(`mensagem-${ultimaResposta?.id}`);
                            const historico = elemento?.querySelector<HTMLDetailsElement>(
                                '[data-ui~="historico-tarefa"]',
                            );
                            if (historico) historico.open = true;
                            acompanhar.current = false;
                            elemento?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                    />
                )}
                {!ponte && (
                    <p data-ui="aviso-web" className="text-[#b5bdc8] text-[11px] mb-[12px]">
                        Prévia da interface. Execute bun run dev para usar o desktop.
                    </p>
                )}
                <form
                    data-ui={`entrada ${arrastando ? 'entrada-arrastando' : ''}`}
                    className={[
                        [
                            [
                                'bg-[#141517] rounded-[22px] pt-[17px] pb-[14px]',
                                'shadow-[inset_0_1px_0_#ffffff03] px-[16px]',
                            ].join(' '),
                            'border border-solid border-[#292b30] [&:focus-within]:border-[#8974a8]',
                            [
                                '[&_textarea]:block [&_textarea]:w-full [&_textarea]:bg-transparent',
                                '[&_textarea]:resize-none',
                            ].join(' '),
                            '[&_textarea]:min-h-[68px] [&_textarea]:max-h-[200px] [&_textarea]:text-[#e6e7e9]',
                            '[&_textarea]:leading-[1.7] [&_textarea]:outline-none [&_textarea]:p-0',
                            '[&_textarea]:border-0 [&_textarea]:border-solid [&_textarea]:border-current',
                            '[&_textarea::placeholder]:text-[#858990]',
                        ].join(' '),
                        arrastando ? '[&&]:[outline:1px_solid_#8d9de0]' : '',
                    ].join(' ')}
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
                        <div
                            data-ui="anexos-entrada"
                            className="flex flex-wrap gap-[10px] mb-[12px] pt-[14px] pb-0 px-[16px]"
                        >
                            {anexos.imagens.map((imagem) => (
                                <div data-ui="anexo-rascunho" className="relative" key={imagem.id}>
                                    <ImagemConversa imagem={imagem} previa={imagem.previa} />
                                    <button
                                        type="button"
                                        data-ui="remover-anexo"
                                        className={[
                                            [
                                                'absolute top-[-6px] right-[-6px] grid place-items-center',
                                                'w-[23px] h-[23px] rounded-full',
                                            ].join(' '),
                                            'bg-[#252830] text-[#eee] border border-solid border-[#2b2e34]',
                                        ].join(' ')}
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
                    <div
                        data-ui="barra-entrada"
                        className={[
                            'flex items-center gap-[10px] mt-[10px] [@media(width<=760px)]:flex-wrap',
                            "[@media(width<=760px)]:gap-[8px] [@media(width<=760px)]:[&::after]:[content:'']",
                            '[@media(width<=760px)]:[&::after]:w-full',
                        ].join(' ')}
                    >
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
                                role="status"
                            >
                                Preparando imagens
                            </span>
                        )}
                        {conversa?.mensagens.at(-1)?.usoContexto && (
                            <span
                                data-ui="uso-contexto"
                                className="[@media(width<=760px)]:hidden whitespace-nowrap text-[11px] text-[#a1a5ad]"
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
                            data-ui="botao-icone botao-anexar"
                            className={[
                                '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                                [
                                    'inline-flex items-center justify-center bg-transparent text-[#a1a5ad]',
                                    'rounded-[6px] shrink-0',
                                ].join(' '),
                                'p-[8px] border-0 border-solid border-current',
                                '[&:hover:not(:disabled)]:text-[#e6e7e9] [&:hover:not(:disabled)]:bg-[#24262c]',
                                '[[data-ui~=rodape-entrada]_&]:p-[0]',
                                "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                                '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                            ].join(' ')}
                            aria-label="Anexar imagens"
                            title="Anexar imagens"
                            disabled={ocupado || anexos.importando || anexos.imagens.length >= 4}
                            onClick={() => seletorImagens.current?.click()}
                        >
                            <PaperclipIcon size={18} />
                        </button>
                        {estado.conversaEmExecucao || enviando || motorOcupado ? (
                            <button
                                data-ui="botao-enviar botao-interromper"
                                className={[
                                    [
                                        'flex items-center justify-center w-[33px] h-[33px] rounded-full',
                                        'bg-[#e63747] text-[#fff]',
                                    ].join(' '),
                                    'shrink-0 border-0 border-solid border-current',
                                ].join(' ')}
                                type="button"
                                aria-label="Interromper tarefa"
                                onClick={() => executar(() => ponte!.cancelar())}
                            >
                                <StopIcon size={18} weight="fill" />
                            </button>
                        ) : (
                            <button
                                data-ui="botao-enviar"
                                className={[
                                    [
                                        'flex items-center justify-center w-[33px] h-[33px] rounded-full',
                                        'bg-[#e0d8ef] text-[#251b38]',
                                    ].join(' '),
                                    'shrink-0 border-0 border-solid border-current',
                                ].join(' ')}
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
