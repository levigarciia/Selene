import { z } from 'zod';
import type { Acao, Mensagem } from './contratos';

export const esquemaPlano = z.object({
    etapas: z
        .array(
            z.object({
                descricao: z.string().min(1).max(30000),
                estado: z.enum(['pendente', 'em andamento', 'concluida']),
            }),
        )
        .min(1)
        .max(20),
});

type BlocoAtividade = { tipo: 'texto'; texto: string } | { tipo: 'acao'; acao: Acao };
type BlocoApresentacao = BlocoAtividade | { tipo: 'grupo'; acoes: Acao[] };

/** Recolhe sequências concluídas somente quando existe texto posterior, preservando ações pendentes. */
export function agruparAtividade(mensagem: Mensagem): BlocoApresentacao[] {
    const blocos = montarAtividade(mensagem);
    const resultado: BlocoApresentacao[] = [];
    let indice = 0;
    while (indice < blocos.length) {
        const bloco = blocos[indice]!;
        if (bloco.tipo === 'texto') {
            resultado.push(bloco);
            indice += 1;
            continue;
        }
        const inicio = indice;
        const acoes: Acao[] = [];
        while (indice < blocos.length) {
            const atual = blocos[indice]!;
            if (atual.tipo === 'texto' && atual.texto.trim()) break;
            if (atual.tipo === 'acao') acoes.push(atual.acao);
            indice += 1;
        }
        const seguinte = blocos[indice];
        const recolher =
            acoes.length > 1 && seguinte?.tipo === 'texto' && acoes.every((acao) => acao.estado === 'concluida');
        if (recolher) resultado.push({ tipo: 'grupo', acoes });
        else resultado.push(...blocos.slice(inicio, indice));
    }
    return resultado;
}

/** Resume operações concluídas para a linha expansível da conversa. */
export function resumirAcoes(acoes: Acao[]): string {
    if (!acoes.length) throw new Error('O resumo exige pelo menos uma ação.');
    const comandos = acoes.filter((acao) => acao.nome === 'executar_terminal').length;
    const escritas = acoes.filter((acao) => ['escrever_arquivo', 'editar_arquivo'].includes(acao.nome));
    const arquivos = new Set(escritas.map((acao) => acao.argumentos.caminho ?? acao.id)).size;
    const pesquisas = acoes.filter((acao) => acao.nome === 'pesquisar_web').length;
    const paginas = acoes.filter((acao) => acao.nome === 'ler_pagina_web').length;
    const outras = acoes.length - comandos - escritas.length - pesquisas - paginas;
    const partes: string[] = [];
    if (comandos) partes.push(`Executou ${comandos} ${comandos === 1 ? 'comando' : 'comandos'}`);
    if (arquivos) partes.push(`alterou ${arquivos} ${arquivos === 1 ? 'arquivo' : 'arquivos'}`);
    if (pesquisas) partes.push(`fez ${pesquisas} ${pesquisas === 1 ? 'pesquisa' : 'pesquisas'}`);
    if (paginas) partes.push(`leu ${paginas} ${paginas === 1 ? 'página' : 'páginas'}`);
    if (outras) partes.push(`realizou ${outras} ${outras === 1 ? 'outra ação' : 'outras ações'}`);
    const ultima = partes.pop()!;
    const resumo = partes.length ? `${partes.join(', ')} e ${ultima}` : ultima;
    return resumo.charAt(0).toUpperCase() + resumo.slice(1);
}

/** Use para apresentar o histórico na ordem registrada, sem inferir cortes em mensagens antigas. */
export function montarAtividade(mensagem: Mensagem, limite = mensagem.texto.length): BlocoAtividade[] {
    const blocos: BlocoAtividade[] = [];
    let posicao = 0;
    for (const acao of mensagem.acoes) {
        const fim = Math.max(posicao, Math.min(acao.posicaoTexto ?? limite, limite));
        if (fim > posicao) blocos.push({ tipo: 'texto', texto: mensagem.texto.slice(posicao, fim) });
        blocos.push({ tipo: 'acao', acao });
        posicao = fim;
    }
    if (posicao < limite) blocos.push({ tipo: 'texto', texto: mensagem.texto.slice(posicao, limite) });
    return blocos;
}

/** Obtém somente o último plano validado e executado para acompanhar uma tarefa. */
export function obterPlano(mensagem?: Mensagem) {
    for (const acao of mensagem?.acoes.slice().reverse() ?? []) {
        if (acao.nome !== 'atualizar_plano' || acao.estado !== 'concluida') continue;
        const resultado = esquemaPlano.safeParse(acao.argumentos);
        if (resultado.success) return resultado.data.etapas;
    }
    return [];
}
