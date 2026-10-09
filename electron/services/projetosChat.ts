import { randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import type { Conversa, Dados } from '../../shared/contratos';
import { esquemaArquivoProjetoChat, esquemaProjetoChat, type EdicaoProjetoChat } from '../../shared/projetosChat';

/** Lê somente referências textuais escolhidas pelo usuário, preservando o arquivo original. */
export async function lerArquivoProjetoChat(caminho: string) {
    if (!['.txt', '.md', '.csv', '.json'].includes(extname(caminho).toLowerCase()))
        throw new Error('Escolha arquivos TXT, Markdown, CSV ou JSON.');
    const arquivo = await open(caminho, 'r');
    try {
        const tamanho = await arquivo.stat();
        if (!tamanho.isFile() || tamanho.size > 80000) throw new Error('O arquivo deve ter até 80 KB.');
        const bytes = Buffer.alloc(80001);
        let recebido = 0;
        while (recebido < bytes.length) {
            const leitura = await arquivo.read(bytes, recebido, bytes.length - recebido, null);
            if (!leitura.bytesRead) break;
            recebido += leitura.bytesRead;
        }
        if (recebido > 80000) throw new Error('O arquivo deve ter até 80 KB.');
        let texto: string;
        try {
            texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, recebido)).trim();
        } catch {
            throw new Error('O arquivo precisa conter texto UTF 8.');
        }
        if (texto.includes('\0')) throw new Error('O arquivo precisa conter texto UTF 8.');
        if (!texto || texto.length > 20000) throw new Error('Escolha um arquivo com 1 a 20000 caracteres de texto.');
        return esquemaArquivoProjetoChat.parse({ id: randomUUID(), nome: basename(caminho), texto });
    } finally {
        await arquivo.close();
    }
}

/** Mantém projetos de Chat independentes das pastas e permissões de Code. */
export class ProjetosChat {
    private fila: Promise<void> = Promise.resolve();
    constructor(
        private dados: Dados,
        private salvar: () => Promise<void>,
        private emExecucao: () => string | null,
    ) {}

    obter(id: string) {
        const projeto = this.dados.projetosChat.find((item) => item.id === id);
        if (!projeto) throw new Error('Projeto de Chat não encontrado.');
        return projeto;
    }

    private exigirLivre(id: string) {
        if (this.dados.conversas.some((item) => item.projetoChatId === id && item.id === this.emExecucao()))
            throw new Error('Interrompa a resposta antes de alterar o projeto.');
    }

    private persistir(operacao: () => void): Promise<void> {
        const executar = async () => {
            const projetos = this.dados.projetosChat;
            const conversas = this.dados.conversas;
            operacao();
            try {
                await this.salvar();
            } catch (erro) {
                this.dados.projetosChat = projetos;
                this.dados.conversas = conversas;
                throw erro;
            }
        };
        const proxima = this.fila.then(executar, executar);
        this.fila = proxima;
        return proxima;
    }

    async criar(nome: string) {
        const projeto = esquemaProjetoChat.parse({ id: randomUUID(), nome, criadoEm: new Date().toISOString() });
        await this.persistir(() => {
            this.dados.projetosChat = [...this.dados.projetosChat, projeto];
        });
        return projeto;
    }

    async editar(id: string, edicao: EdicaoProjetoChat) {
        await this.persistir(() => {
            this.exigirLivre(id);
            const projeto = esquemaProjetoChat.parse({ ...this.obter(id), ...edicao });
            this.dados.projetosChat = this.dados.projetosChat.map((item) => (item.id === id ? projeto : item));
        });
    }

    async importar(id: string, caminhos: string[]) {
        this.exigirLivre(id);
        if (!caminhos.length || this.obter(id).arquivos.length + caminhos.length > 10)
            throw new Error('O projeto permite até 10 arquivos.');
        const arquivos = await Promise.all(caminhos.map(lerArquivoProjetoChat));
        await this.persistir(() => {
            this.exigirLivre(id);
            const projeto = esquemaProjetoChat.parse({
                ...this.obter(id),
                arquivos: [...this.obter(id).arquivos, ...arquivos],
            });
            this.dados.projetosChat = this.dados.projetosChat.map((item) => (item.id === id ? projeto : item));
        });
    }

    async removerArquivo(id: string, arquivoId: string) {
        await this.persistir(() => {
            const projeto = this.obter(id);
            if (!projeto.arquivos.some((item) => item.id === arquivoId)) throw new Error('Arquivo não encontrado.');
            this.exigirLivre(id);
            this.dados.projetosChat = this.dados.projetosChat.map((item) =>
                item.id === id
                    ? { ...item, arquivos: item.arquivos.filter((arquivo) => arquivo.id !== arquivoId) }
                    : item,
            );
        });
    }

    async remover(id: string) {
        await this.persistir(() => {
            this.obter(id);
            this.exigirLivre(id);
            this.dados.projetosChat = this.dados.projetosChat.filter((item) => item.id !== id);
            this.dados.conversas = this.dados.conversas.map((item) =>
                item.projetoChatId === id ? { ...item, projetoChatId: null, contextoCompactado: undefined } : item,
            );
        });
    }

    async mover(conversa: Conversa, id: string | null) {
        if (conversa.modo !== 'chat') throw new Error('Somente conversas Chat podem entrar neste projeto.');
        await this.persistir(() => {
            if (conversa.id === this.emExecucao()) throw new Error('Interrompa a resposta antes de mover a conversa.');
            if (id) this.obter(id);
            this.dados.conversas = this.dados.conversas.map((item) =>
                item.id === conversa.id
                    ? {
                          ...item,
                          projetoChatId: id,
                          contextoCompactado: undefined,
                          atualizadoEm: new Date().toISOString(),
                      }
                    : item,
            );
        });
    }
}

/** Reúne referências e histórico exclusivamente do projeto atual, sem conceder ferramentas. */
export function contextoProjetoChat(
    dados: Dados,
    conversa: Conversa,
): { instrucao: string; referencias: string } | null {
    if (conversa.modo !== 'chat' || !conversa.projetoChatId) return null;
    const projeto = dados.projetosChat.find((item) => item.id === conversa.projetoChatId);
    if (!projeto) throw new Error('Projeto de Chat não encontrado.');
    const referencias = projeto.arquivos.map((arquivo) => `Arquivo: ${arquivo.nome}\n${arquivo.texto}`);
    if (projeto.memoria) {
        let restante = 12000;
        for (const outra of [...dados.conversas].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))) {
            if (outra.id === conversa.id || outra.modo !== 'chat' || outra.projetoChatId !== projeto.id) continue;
            const texto = outra.mensagens
                .filter((item) => item.estado === 'concluida')
                .slice(-6)
                .map((item) => `${item.papel}: ${item.texto}`)
                .join('\n');
            if (!texto || restante <= 0) continue;
            const trecho = `Conversa: ${outra.titulo}\n${texto}`.slice(0, restante);
            referencias.push(trecho);
            restante -= trecho.length;
        }
    }
    return { instrucao: projeto.instrucao, referencias: referencias.join('\n\n') };
}
