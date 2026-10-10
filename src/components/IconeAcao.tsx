import { useId, type SVGProps } from 'react';
import {
    BotIcon,
    BrainIcon,
    CheckIcon,
    CircleAlertIcon,
    EyeIcon,
    GlobeIcon,
    HammerIcon,
    MessageCircleIcon,
    SearchIcon,
    SmartphoneIcon,
    SquarePenIcon,
    TerminalIcon,
    WrenchIcon,
    XIcon,
    ZapIcon,
    GitPullRequestArrowIcon,
    GitPullRequestDraftIcon,
    GitPullRequestClosedIcon,
    GitMergeIcon,
    LayersIcon,
    Link2Icon,
    Unlink2Icon,
    TriangleAlertIcon,
} from 'lucide-react';
import type { Acao } from '../../shared/contratos';

function IconeNavegador(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M8.5 19H7.2C4.4 19 3 17.5 3 14.6V7.4C3 4.5 4.5 3 7.4 3h8.2C18.5 3 20 4.5 20 7.4v2.4" />
            <circle cx="7.4" cy="7.2" r="0.75" fill="currentColor" stroke="none" />
            <path d="M11.2 7.2h4.3" />
            <path d="m12.4 11.4 7.5 2.6-3.4 1.6-1.5 3.6z" fill="currentColor" stroke="none" />
        </svg>
    );
}

function IconeComputador(props: SVGProps<SVGSVGElement>) {
    const idGradiente = `computador${useId().replaceAll(':', '')}`;
    return (
        <svg viewBox="0 0 24 24" {...props}>
            <defs>
                <linearGradient id={idGradiente} x1="2" y1="2" x2="22" y2="22">
                    <stop offset="0" stopColor="#00dff0" />
                    <stop offset="0.42" stopColor="#3b9cff" />
                    <stop offset="0.72" stopColor="#b044f5" />
                    <stop offset="1" stopColor="#ff78b6" />
                </linearGradient>
            </defs>
            <rect x="1" y="1" width="22" height="22" rx="5" fill={`url(#${idGradiente})`} />
            <path
                d="m7.2 6.2 10.5 4.1-4.2 2.1-2 4.7z"
                fill="white"
                stroke="#315cff"
                strokeWidth="1.1"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export const iconesAcoes = {
    agente: BotIcon,
    raciocinio: BrainIcon,
    navegador: IconeNavegador,
    concluido: CheckIcon,
    aviso: CircleAlertIcon,
    computador: IconeComputador,
    dispositivo: SmartphoneIcon,
    leitura: EyeIcon,
    web: GlobeIcon,
    compilacao: HammerIcon,
    mensagem: MessageCircleIcon,
    pesquisa: SearchIcon,
    edicao: SquarePenIcon,
    terminal: TerminalIcon,
    pull_request: GitPullRequestArrowIcon,
    ferramenta: WrenchIcon,
    recusado: XIcon,
    atividade: ZapIcon,
    pull_request_rascunho: GitPullRequestDraftIcon,
    pull_request_fechado: GitPullRequestClosedIcon,
    pull_request_mesclado: GitMergeIcon,
    pilha: LayersIcon,
    vincular: Link2Icon,
    desvincular: Unlink2Icon,
    conflito: TriangleAlertIcon,
} as const;

export type NomeIconeAcao = keyof typeof iconesAcoes;

const iconesFerramentas: Record<string, NomeIconeAcao> = {
    listar_arquivos: 'leitura',
    ler_arquivo: 'leitura',
    escrever_arquivo: 'edicao',
    editar_arquivo: 'edicao',
    apply_patch: 'edicao',
    pesquisar_web: 'web',
    ler_pagina_web: 'web',
    controlar_navegador: 'navegador',
    controlar_computador: 'computador',
    atualizar_plano: 'concluido',
};

function iconeComando(comando: unknown): NomeIconeAcao {
    if (typeof comando !== 'string') return 'terminal';
    if (/(?:^|[;|&]\s*)\s*(?:rg|grep|Select-String)\b/i.test(comando)) return 'pesquisa';
    if (/(?:^|[;|&]\s*)\s*(?:cat|ls|dir|Get-Content|Get-ChildItem|type|head|tail)\b/i.test(comando)) return 'leitura';
    if (/^\s*bun\s+(?:run\s+)?(?:build(?::\S+)?|verificar|test)\b/i.test(comando)) return 'compilacao';
    if (/^\s*(?:cargo\s+(?:build|check|test)|tsc|pytest|make)\b/i.test(comando)) return 'compilacao';
    if (/^\s*(?:apply_patch|Set-Content|Add-Content|Out-File)\b/i.test(comando)) return 'edicao';
    return 'terminal';
}

/** Escolhe o ícone pela ferramenta e pelo comando, preservando sua identidade em todos os estados. */
export function escolherIconeAcao(acao: Pick<Acao, 'nome' | 'argumentos'>): NomeIconeAcao {
    if (acao.nome === 'executar_terminal') return iconeComando(acao.argumentos.comando);
    return iconesFerramentas[acao.nome] ?? 'ferramenta';
}

/** Renderiza o catálogo de ações usado pelo T3, sem incluir sua marca. */
export function IconeAcao({ nome, className }: { nome: NomeIconeAcao; className?: string }) {
    const Icone = iconesAcoes[nome];
    return (
        <Icone
            data-ui="icone-acao"
            data-icone={nome}
            className={className ?? 'size-[15px] shrink-0'}
            aria-hidden="true"
        />
    );
}
