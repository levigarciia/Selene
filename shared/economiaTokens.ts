import { z } from 'zod';

export const idsPacotesEconomia = ['caveman', 'codigoEnxuto', 'ferramentasSilenciosas', 'rtk'] as const;
export const niveisCaveman = ['leve', 'completo', 'ultra'] as const;
export type PacoteEconomia = (typeof idsPacotesEconomia)[number];
export type NivelCaveman = (typeof niveisCaveman)[number];

export const esquemaEconomiaTokens = z.object({
    pacotes: z.array(z.enum(idsPacotesEconomia)).max(idsPacotesEconomia.length),
    nivel: z.enum(niveisCaveman),
});
export type EconomiaTokens = z.infer<typeof esquemaEconomiaTokens>;

export const esquemaEnvioEconomia = z.object({
    chave: z.string().max(200),
    turnos: z.number().int().nonnegative(),
});
export type EnvioEconomia = z.infer<typeof esquemaEnvioEconomia>;

export type DisponibilidadeEconomia = { rtk: boolean };

/** Descrição de um pacote para a interface; `economia` cita benchmarks publicados ou estimativas marcadas. */
export type DescricaoPacote = { id: PacoteEconomia; titulo: string; resumo: string; economia: string; exigeRtk?: true };

export const pacotesEconomia: DescricaoPacote[] = [
    {
        id: 'caveman',
        titulo: 'Caveman',
        resumo: 'Respostas secas: resposta primeiro, sem enrolação, todo fato técnico preservado.',
        economia: '15 a 65% das respostas',
    },
    {
        id: 'codigoEnxuto',
        titulo: 'Código enxuto',
        resumo: 'O mínimo de código que funciona: reuso, sem extras especulativos, diffs em vez de arquivos inteiros.',
        economia: 'cerca de 20 a 40% do código gerado (est.)',
    },
    {
        id: 'ferramentasSilenciosas',
        titulo: 'Ferramentas silenciosas',
        resumo: 'Buscas direcionadas, intervalos de linhas, flags silenciosas, sem reler arquivos.',
        economia: 'cerca de 20 a 50% da entrada das ferramentas (est.)',
    },
    {
        id: 'rtk',
        titulo: 'Compressão RTK',
        resumo: 'Executa comandos pelo rtk, que comprime a saída antes de o agente ler.',
        economia: '60 a 90% da saída de comandos',
        exigeRtk: true,
    },
];

export const descricoesNiveis: Record<NivelCaveman, { nome: string; dica: string }> = {
    leve: { nome: 'Leve', dica: 'Breve, gramática normal' },
    completo: { nome: 'Completo', dica: 'Voz de homem das cavernas' },
    ultra: { nome: 'Ultra', dica: 'Telegráfico' },
};

/** Mensagens depois do último envio em que a orientação é repetida, para conversas longas não a perderem. */
export const lembrarACada = 8;
export const cabecalhoEconomia = 'Estilo de resposta (economia de tokens da Selene';

const caveman: Record<NivelCaveman, string> = {
    leve:
        'Responda primeiro. Sem saudação, preâmbulo, recapitulação ou oferta de ajuda adicional. Frases curtas em ' +
        'gramática normal. Preserve exatamente todo detalhe técnico, caminho, número e erro.',
    completo: [
        'Responda como homem das cavernas inteligente. Corte toda enrolação, mantenha a substância técnica.',
        '* Omita artigos (o, a, um, uma) e palavras de enchimento (só, realmente, basicamente, na verdade).',
        '* Omita cortesias (claro, certamente, com prazer).',
        '* Sem rodeios. Fragmentos servem. Sinônimos curtos.',
        '* Termos técnicos exatos. Blocos de código inalterados.',
        '* Padrão: [coisa] [ação] [motivo]. [próximo passo].',
    ].join('\n'),
    ultra: [
        'Telegráfico. Resposta primeiro, depois motivo, depois próximo passo. Omita artigos, conectivos e cortesias.',
        '* Um ponto por linha; listas em vez de prosa. Código, diffs e comandos em vez de explicação.',
        '* Nenhum texto entre chamadas rotineiras de ferramentas; uma linha por fase, uma linha de resultado no fim.',
        '* Nunca omita não, nunca, nenhum, somente. Código, caminhos, números e erros ficam literais.',
    ].join('\n'),
};

const excecoesCaveman =
    'Use frases completas em alertas de segurança, ações irreversíveis, passos ordenados, perguntas ao usuário e ' +
    'em tudo que for escrito em arquivos, commits, PRs ou documentação.';

const orientacoes: Record<Exclude<PacoteEconomia, 'caveman'>, string> = {
    codigoEnxuto:
        'Escreva o mínimo de código que resolve a tarefa por completo. Reutilize funções existentes, a biblioteca ' +
        'padrão e recursos da plataforma antes de adicionar código ou dependências. Sem abstrações, opções ou ' +
        'funcionalidades especulativas. Sem novos comentários ou documentação, salvo pedido. Na conversa, mostre ' +
        'as linhas alteradas com contexto mínimo, não arquivos inteiros.',
    ferramentasSilenciosas:
        'Mantenha pequena a saída das ferramentas. Pesquise com padrões direcionados (rg -n padrao caminho, rg -l) ' +
        'em vez de listar ou despejar árvores. Leia apenas os intervalos de linhas necessários; não releia um ' +
        'arquivo já lido, salvo se mudou. Use flags silenciosas (git --no-pager, -q, --silent) e limite saídas ' +
        'longas. Rode os testes mais próximos da mudança antes da suíte completa.',
    rtk:
        'O rtk está instalado e comprime a saída de comandos. Prefixe comandos com rtk: rtk git status, ' +
        'rtk git diff, rtk git log, rtk ls, rtk read <arquivo>, rtk grep <padrao>, rtk find, e executores de ' +
        'teste como rtk bun test. Se o rtk recusar um comando, execute-o normalmente.',
};

function pacotesAtivos(pacotes: readonly PacoteEconomia[], disponivel: DisponibilidadeEconomia): PacoteEconomia[] {
    return idsPacotesEconomia.filter((id) => pacotes.includes(id) && (id !== 'rtk' || disponivel.rtk));
}

/** Orientação para um conjunto de pacotes, ou o aviso explícito de desligamento quando nenhum está ativo. */
export function orientacaoEconomia(economia: EconomiaTokens, disponivel: DisponibilidadeEconomia): string {
    const ativos = pacotesAtivos(economia.pacotes, disponivel);
    if (!ativos.length) return `${cabecalhoEconomia}): desligada. Volte ao seu estilo normal de resposta.`;
    const linhas = ativos.map((id) => (id === 'caveman' ? caveman[economia.nivel] : orientacoes[id]));
    if (ativos.includes('caveman')) linhas.push(excecoesCaveman);
    return (
        `${cabecalhoEconomia}, vale para toda esta conversa até mudar; o leitor paga por token):\n` +
        linhas.join('\n\n')
    );
}

/**
 * Decide se a próxima mensagem leva o bloco de estilo. Ele vai quando os pacotes mudam e a cada
 * `lembrarACada` mensagens, para todo provedor recebê-lo sem pagar por ele em todo turno. Pura: o chamador
 * persiste o `envio` devolvido.
 */
export function planejarBlocoEconomia(
    economia: EconomiaTokens | undefined,
    envioAnterior: EnvioEconomia | undefined,
    disponivel: DisponibilidadeEconomia,
): { bloco: string; envio: EnvioEconomia } {
    const atual = economia ?? { pacotes: [], nivel: 'completo' as const };
    const ativos = pacotesAtivos(atual.pacotes, disponivel);
    const chave = ativos.length ? `${ativos.join(',')}:${atual.nivel}` : '';
    const turnos = (envioAnterior?.turnos ?? 0) + 1;
    const mudou = chave !== (envioAnterior?.chave ?? '');
    const vencido = !!chave && (mudou || turnos >= lembrarACada);
    const envio = { chave, turnos: mudou || vencido ? 0 : turnos };
    if (!mudou && !vencido) return { bloco: '', envio };
    return { bloco: orientacaoEconomia(atual, disponivel), envio };
}

/** Parcela combinada estimada de tokens economizados, para o medidor; as economias se compõem, não se somam. */
export function estimarEconomia(economia: EconomiaTokens, disponivel: DisponibilidadeEconomia): number {
    const parcela: Record<PacoteEconomia, number> = {
        caveman: economia.nivel === 'leve' ? 0.12 : economia.nivel === 'completo' ? 0.25 : 0.35,
        codigoEnxuto: 0.12,
        ferramentasSilenciosas: 0.15,
        rtk: 0.2,
    };
    const restante = pacotesAtivos(economia.pacotes, disponivel).reduce((total, id) => total * (1 - parcela[id]), 1);
    return Math.round((1 - restante) * 100);
}
