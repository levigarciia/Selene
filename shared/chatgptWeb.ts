import { z } from 'zod';

/** Aceita somente páginas de conversa do ChatGPT, sem parâmetros de autenticação. */
export function urlConversaChatGpt(entrada: string): string | null {
    try {
        const url = new URL(entrada);
        if (url.origin !== 'https://chatgpt.com' || url.username || url.password) return null;
        if (!/^\/(?:c\/[a-zA-Z0-9-]+|g\/[a-zA-Z0-9-]+\/c\/[a-zA-Z0-9-]+)$/.test(url.pathname)) return null;
        return url.origin + url.pathname;
    } catch {
        return null;
    }
}

/** Delimita as páginas de login que podem abrir na janela remota sem expor a ponte do desktop. */
export function navegacaoChatGptPermitida(entrada: string): boolean {
    try {
        const url = new URL(entrada);
        return (
            url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            !url.port &&
            [
                'chatgpt.com',
                'chat.openai.com',
                'auth.openai.com',
                'auth0.openai.com',
                'accounts.google.com',
                'appleid.apple.com',
                'login.live.com',
                'login.microsoftonline.com',
            ].includes(url.hostname)
        );
    } catch {
        return false;
    }
}

export const esquemaVinculoChatGpt = z.object({
    url: z
        .string()
        .refine((url) => urlConversaChatGpt(url) === url)
        .optional(),
    envioIncerto: z.boolean().default(false),
});

export type ObservacaoChatGpt = {
    editor: boolean;
    textoEditor: string;
    login: boolean;
    gerando: boolean;
    usuarios: string[];
    resposta: string;
    respostaId: string;
    erro: string;
};

/** O histórico importado é contexto textual e não concede ferramentas ou permissões. */
export function pedidoInicialChatGpt(mensagens: readonly { papel: string; texto: string }[]): string {
    const anteriores = mensagens.slice(0, -1).filter((mensagem) => mensagem.texto.trim());
    const pedido = mensagens.at(-1)?.texto ?? '';
    if (!pedido.trim()) throw new Error('Escreva uma mensagem para o ChatGPT.');
    const texto = anteriores.length
        ? 'Contexto da conversa anterior:\n\n' +
          anteriores
              .map((mensagem) => `${mensagem.papel === 'user' ? 'Usuário' : 'Assistente'}:\n${mensagem.texto}`)
              .join('\n\n') +
          '\n\nPedido atual do usuário:\n' +
          pedido
        : pedido;
    if (texto.length > 100000) throw new Error('O histórico é grande demais para importar. Abra uma conversa nova.');
    return texto;
}
