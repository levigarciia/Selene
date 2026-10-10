import type { Conversa } from './contratos';

/** Exporta o histórico com imagens incorporadas para leitura fora da Selene. */
export async function exportarMarkdown(
    conversa: Conversa,
    lerImagem: (id: string) => Promise<string>,
): Promise<string> {
    const texto = [`# ${conversa.titulo}`];
    for (const mensagem of conversa.mensagens) {
        texto.push(`## ${mensagem.papel === 'user' ? 'Você' : 'Selene'}\n\n${mensagem.texto}`);
        for (const imagem of mensagem.imagens ?? []) {
            texto.push(`![${imagem.nome.replace(/[\[\]\\]/g, '')}](${await lerImagem(imagem.id)})`);
        }
        texto.push(mensagem.acoes.map((acao) => `### ${acao.nome}: ${acao.estado}\n\n${acao.resultado}`).join('\n\n'));
    }
    return texto.join('\n\n');
}
