import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
    CaretDownIcon,
    CloudArrowUpIcon,
    GitDiffIcon,
    FolderOpenIcon,
    GitBranchIcon,
    CodeIcon,
    PlayIcon,
    PlusIcon,
    XIcon,
} from '@phosphor-icons/react';
import type { PonteSelene, Projeto } from '../../shared/contratos';
import type { AcaoGit, Editor, ScriptProjeto, StatusRepositorio } from '../../shared/repositorio';
import { IconeProjeto } from './IconeProjeto';

const nomesEditores: Record<Editor, string> = {
    vscode: 'VS Code',
    cursor: 'Cursor',
    explorador: 'Explorador de Arquivos',
};

const nomesAcoes: Record<AcaoGit, string> = {
    commit: 'Commit',
    push: 'Push',
    commit_push: 'Commit e push',
    commit_push_pr: 'Commit, push e PR',
};

type Painel = 'editores' | 'script' | 'branches' | 'acoes' | 'mensagem' | 'alteracoes' | null;

const classeLinha = [
    'flex w-full items-center gap-[10px] rounded-[7px] px-[10px] py-[7px] text-left text-[13px]',
    'text-principal hover:bg-hover disabled:text-discreto disabled:hover:bg-transparent',
].join(' ');
const classeCampo = 'w-full rounded-md border border-borda bg-fundo px-2 py-[6px] text-[12px] outline-none';
const classeBotaoPrimario = [
    'rounded-md bg-[#e0d8ef] px-3 py-[5px] text-[12px] text-[#251b38] hover:bg-[#cec0e5]',
    'disabled:opacity-50',
].join(' ');

function LinhaComMenu({
    icone,
    rotulo,
    acao,
    abrirMenu,
    desativado,
    complemento,
}: {
    icone: ReactNode;
    rotulo: ReactNode;
    acao: () => void;
    abrirMenu?: () => void;
    desativado?: boolean;
    complemento?: ReactNode;
}) {
    return (
        <div className="flex items-center">
            <button className={classeLinha} onClick={acao} disabled={desativado}>
                <span className="text-secundario">{icone}</span>
                <span className="min-w-0 flex-1 truncate">{rotulo}</span>
                {complemento}
            </button>
            {abrirMenu && (
                <button
                    aria-label="Mais opções"
                    onClick={abrirMenu}
                    disabled={desativado}
                    className="ml-1 rounded-[7px] border-l border-borda px-2 py-[7px] text-secundario
                        hover:bg-hover disabled:text-discreto"
                >
                    <CaretDownIcon size={13} />
                </button>
            )}
        </div>
    );
}

/** Ações do projeto Code ativo: editor, scripts, branch, commit e alterações locais. */
export function MenuProjetoCode({
    ponte,
    projeto,
    fechar,
    executarScript,
    definirErro,
}: {
    ponte: PonteSelene;
    projeto: Projeto;
    fechar: () => void;
    executarScript: (comando: string) => void;
    definirErro: (erro: string) => void;
}) {
    const raiz = useRef<HTMLDivElement>(null);
    const [status, definirStatus] = useState<StatusRepositorio | null>(null);
    const [editores, definirEditores] = useState<Editor[]>(['explorador']);
    const [editor, definirEditor] = useState<Editor>(
        () => (localStorage.getItem('selene.editor') as Editor | null) ?? 'vscode',
    );
    const [painel, definirPainel] = useState<Painel>(null);
    const [acao, definirAcao] = useState<AcaoGit>('commit_push');
    const [mensagem, definirMensagem] = useState('');
    const [novaBranch, definirNovaBranch] = useState('');
    const [script, definirScript] = useState({ nome: '', comando: '' });
    const [ocupado, definirOcupado] = useState(false);
    const editorAtual = editores.includes(editor) ? editor : (editores[0] ?? 'explorador');

    async function atualizar() {
        const resultado = await ponte.statusRepositorio(projeto.id);
        if (resultado.ok) definirStatus(resultado.valor);
        else definirErro(resultado.erro);
    }

    useEffect(() => {
        void atualizar();
        void ponte.editoresDisponiveis().then((resultado) => resultado.ok && definirEditores(resultado.valor));
    }, [projeto.id]);

    useEffect(() => {
        const fora = (evento: MouseEvent) => {
            if (!raiz.current?.contains(evento.target as Node)) fechar();
        };
        const sair = (evento: KeyboardEvent) => evento.key === 'Escape' && fechar();
        window.addEventListener('mousedown', fora);
        window.addEventListener('keydown', sair);
        return () => {
            window.removeEventListener('mousedown', fora);
            window.removeEventListener('keydown', sair);
        };
    }, [fechar]);

    async function executar(operacao: () => Promise<{ ok: boolean; erro?: string }>) {
        definirOcupado(true);
        try {
            const resultado = await operacao();
            if (!resultado.ok) {
                definirErro(resultado.erro ?? 'Operação não concluída.');
                return false;
            }
            definirPainel(null);
            await atualizar();
            return true;
        } finally {
            definirOcupado(false);
        }
    }

    function abrirEditor(escolhido: Editor) {
        definirEditor(escolhido);
        localStorage.setItem('selene.editor', escolhido);
        void ponte.abrirNoEditor(projeto.id, escolhido).then((resultado) => {
            if (!resultado.ok) definirErro(resultado.erro);
            else fechar();
        });
    }

    async function salvarScripts(scripts: ScriptProjeto[]) {
        await executar(() => ponte.salvarScriptsProjeto(projeto.id, scripts));
    }

    async function executarAcao() {
        const sucesso = await executar(async () => {
            const resultado = await ponte.acaoGit(projeto.id, acao, mensagem);
            if (resultado.ok && resultado.valor) void ponte.abrirGitHub(resultado.valor);
            return resultado;
        });
        if (sucesso) definirMensagem('');
    }

    const repositorio = status?.repositorio ? status : null;
    const alterado = !!repositorio?.alterados.length;
    const scripts = projeto.scripts ?? [];

    return (
        <div
            ref={raiz}
            role="dialog"
            aria-label={`Projeto ${projeto.nome}`}
            className="absolute right-0 top-[calc(100%+6px)] z-[80] w-[300px] rounded-[14px] border border-borda
                bg-[#111] p-[6px] shadow-[0_12px_36px_#0008] [-webkit-app-region:no-drag]"
        >
            <div className="flex items-center gap-[10px] px-[10px] py-[7px] text-[12px] font-semibold uppercase">
                <IconeProjeto projeto={projeto} tamanho={15} />
                <span className="truncate">{projeto.nome}</span>
            </div>
            <LinhaComMenu
                icone={editorAtual === 'explorador' ? <FolderOpenIcon size={16} /> : <CodeIcon size={16} />}
                rotulo={`Abrir no ${nomesEditores[editorAtual]}`}
                acao={() => abrirEditor(editorAtual)}
                abrirMenu={() => definirPainel(painel === 'editores' ? null : 'editores')}
            />
            {painel === 'editores' && (
                <div className="mb-1 ml-7">
                    {editores.map((opcao) => (
                        <button key={opcao} className={classeLinha} onClick={() => abrirEditor(opcao)}>
                            {nomesEditores[opcao]}
                        </button>
                    ))}
                </div>
            )}
            {scripts.map((item) => (
                <div key={item.id} className="group flex items-center">
                    <button
                        className={classeLinha}
                        title={item.comando}
                        onClick={() => {
                            executarScript(item.comando);
                            fechar();
                        }}
                    >
                        <span className="text-secundario">
                            <PlayIcon size={15} />
                        </span>
                        <span className="truncate">{item.nome}</span>
                    </button>
                    <button
                        aria-label={`Remover script ${item.nome}`}
                        onClick={() => void salvarScripts(scripts.filter((atual) => atual.id !== item.id))}
                        className="invisible rounded-md p-[6px] text-discreto hover:text-principal
                            group-hover:visible focus:visible"
                    >
                        <XIcon size={12} />
                    </button>
                </div>
            ))}
            <button className={classeLinha} onClick={() => definirPainel(painel === 'script' ? null : 'script')}>
                <span className="text-secundario">
                    <PlusIcon size={16} />
                </span>
                Adicionar script do projeto
            </button>
            {painel === 'script' && (
                <form
                    className="flex flex-col gap-2 px-[10px] pb-2"
                    onSubmit={(evento) => {
                        evento.preventDefault();
                        void salvarScripts([...scripts, { id: crypto.randomUUID(), ...script }]).then(() =>
                            definirScript({ nome: '', comando: '' }),
                        );
                    }}
                >
                    <input
                        autoFocus
                        aria-label="Nome do script"
                        placeholder="Nome"
                        value={script.nome}
                        onChange={(evento) => definirScript({ ...script, nome: evento.target.value })}
                        className={classeCampo}
                    />
                    <input
                        aria-label="Comando"
                        placeholder="bun run dev"
                        value={script.comando}
                        onChange={(evento) => definirScript({ ...script, comando: evento.target.value })}
                        className={`${classeCampo} font-mono`}
                    />
                    <button
                        className={`${classeBotaoPrimario} self-end`}
                        disabled={ocupado || !script.nome.trim() || !script.comando.trim()}
                    >
                        Salvar
                    </button>
                </form>
            )}
            <div className="my-[6px] border-t border-borda" />
            {!status ? (
                <p className="px-[10px] py-[7px] text-[12px] text-discreto">Lendo repositório</p>
            ) : !repositorio ? (
                <p className="px-[10px] py-[7px] text-[12px] text-discreto">A pasta não é um repositório Git.</p>
            ) : (
                <>
                    <LinhaComMenu
                        icone={<GitBranchIcon size={16} />}
                        rotulo={repositorio.branch ?? 'HEAD destacado'}
                        acao={() => definirPainel(painel === 'branches' ? null : 'branches')}
                        abrirMenu={() => definirPainel(painel === 'branches' ? null : 'branches')}
                    />
                    {painel === 'branches' && (
                        <div className="mb-1 ml-7 max-h-[220px] overflow-auto">
                            {repositorio.branches.map((nome) => (
                                <button
                                    key={nome}
                                    className={`${classeLinha} font-mono text-[12px]`}
                                    disabled={ocupado || nome === repositorio.branch}
                                    onClick={() => void executar(() => ponte.trocarBranch(projeto.id, nome))}
                                >
                                    {nome}
                                </button>
                            ))}
                            <form
                                className="flex gap-2 px-[10px] py-1"
                                onSubmit={(evento) => {
                                    evento.preventDefault();
                                    void executar(() => ponte.trocarBranch(projeto.id, novaBranch, true)).then(
                                        (sucesso) => sucesso && definirNovaBranch(''),
                                    );
                                }}
                            >
                                <input
                                    aria-label="Nova branch"
                                    placeholder="Nova branch"
                                    value={novaBranch}
                                    onChange={(evento) => definirNovaBranch(evento.target.value)}
                                    className={`${classeCampo} font-mono`}
                                />
                                <button className={classeBotaoPrimario} disabled={ocupado || !novaBranch.trim()}>
                                    Criar
                                </button>
                            </form>
                        </div>
                    )}
                    <LinhaComMenu
                        icone={<CloudArrowUpIcon size={16} />}
                        rotulo={nomesAcoes[acao]}
                        desativado={ocupado || (acao === 'push' ? repositorio.aFrente === 0 && repositorio.upstream : !alterado)}
                        acao={() => (acao === 'push' ? void executarAcao() : definirPainel('mensagem'))}
                        abrirMenu={() => definirPainel(painel === 'acoes' ? null : 'acoes')}
                        complemento={
                            repositorio.aFrente > 0 && (
                                <span className="text-[11px] text-discreto">{repositorio.aFrente} à frente</span>
                            )
                        }
                    />
                    {painel === 'acoes' && (
                        <div className="mb-1 ml-7">
                            {(Object.keys(nomesAcoes) as AcaoGit[]).map((opcao) => (
                                <button
                                    key={opcao}
                                    className={classeLinha}
                                    aria-checked={opcao === acao}
                                    role="menuitemradio"
                                    disabled={opcao === 'commit_push_pr' && !repositorio.github}
                                    onClick={() => {
                                        definirAcao(opcao);
                                        definirPainel(opcao === 'push' ? null : 'mensagem');
                                    }}
                                >
                                    {nomesAcoes[opcao]}
                                </button>
                            ))}
                        </div>
                    )}
                    {painel === 'mensagem' && acao !== 'push' && (
                        <form
                            className="flex flex-col gap-2 px-[10px] pb-2"
                            onSubmit={(evento) => {
                                evento.preventDefault();
                                void executarAcao();
                            }}
                        >
                            <textarea
                                autoFocus
                                aria-label="Mensagem do commit"
                                placeholder="Mensagem do commit"
                                rows={3}
                                value={mensagem}
                                onChange={(evento) => definirMensagem(evento.target.value)}
                                onKeyDown={(evento) => {
                                    if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
                                        evento.currentTarget.form?.requestSubmit();
                                    }
                                }}
                                className={`${classeCampo} resize-none`}
                            />
                            <button
                                className={`${classeBotaoPrimario} self-end`}
                                disabled={ocupado || !mensagem.trim()}
                            >
                                {ocupado ? 'Executando' : nomesAcoes[acao]}
                            </button>
                        </form>
                    )}
                    <LinhaComMenu
                        icone={<GitDiffIcon size={16} />}
                        rotulo="Alterações"
                        desativado={!alterado}
                        acao={() => definirPainel(painel === 'alteracoes' ? null : 'alteracoes')}
                        complemento={
                            <span className="font-mono text-[11px]">
                                <span className="text-sucesso">+{repositorio.adicoes.toLocaleString('pt-BR')}</span>{' '}
                                <span className="text-[#f87171]">-{repositorio.remocoes.toLocaleString('pt-BR')}</span>
                            </span>
                        }
                    />
                    {painel === 'alteracoes' && (
                        <ul className="mb-1 max-h-[240px] overflow-auto px-[10px]">
                            {repositorio.alterados.map((arquivo) => (
                                <li
                                    key={arquivo.caminho}
                                    className="flex items-center gap-2 py-[3px] font-mono text-[11px]"
                                    title={arquivo.caminho}
                                >
                                    <span className="min-w-0 flex-1 truncate text-secundario [direction:rtl]">
                                        {arquivo.caminho}
                                    </span>
                                    <span className="text-sucesso">+{arquivo.adicoes}</span>
                                    <span className="text-[#f87171]">-{arquivo.remocoes}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}
