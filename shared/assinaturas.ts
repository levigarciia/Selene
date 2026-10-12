import { z } from 'zod';

/** Provedores de modelos disponíveis na Selene. */
export const provedoresModelo = ['selene', 'openrouter', 'chatgpt', 'claude'] as const;
export type ProvedorModelo = (typeof provedoresModelo)[number];

/** Provedores autenticados pelo CLI oficial e pela inscrição do usuário. */
export const provedoresAssinatura = ['chatgpt', 'claude'] as const;
export type ProvedorAssinatura = (typeof provedoresAssinatura)[number];
export const esquemaProvedorAssinatura = z.enum(provedoresAssinatura);

/** Nomes e descrições dos provedores apresentados nas configurações. */
export const provedoresApresentacao: Record<ProvedorModelo, { nome: string; descricao: string }> = {
    selene: { nome: 'Selene', descricao: 'Modelos locais em GGUF executados neste computador.' },
    openrouter: { nome: 'OpenRouter', descricao: 'Modelos remotos com chave de API do OpenRouter.' },
    chatgpt: { nome: 'ChatGPT', descricao: 'Usa a inscrição do ChatGPT pelo Codex CLI autenticado.' },
    claude: { nome: 'Claude', descricao: 'Usa a inscrição do Claude pelo Claude Code CLI autenticado.' },
};

/** Resultado de inspeção do CLI oficial, sem expor credenciais. */
export type EstadoAssinatura =
    | { estado: 'nao-instalado'; mensagem: string }
    | { estado: 'nao-autenticado'; mensagem: string }
    | { estado: 'pronto'; mensagem: string; conta?: string };

export type ModeloAssinaturaDisponivel = { id: string; nome: string };
export type ModelosAssinatura = Record<ProvedorAssinatura, ModeloAssinaturaDisponivel[]>;

/**
 * Lista usada quando o CLI não informa seus modelos. O Claude Code resolve os apelidos para a versão mais
 * recente da família, então eles acompanham novos lançamentos sem atualizar a Selene.
 */
export const modelosAssinatura: ModelosAssinatura = {
    chatgpt: [],
    claude: [
        { id: 'opus', nome: 'Claude Opus' },
        { id: 'sonnet', nome: 'Claude Sonnet' },
        { id: 'haiku', nome: 'Claude Haiku' },
    ],
};

/** Identificadores aceitos pela interface de CLI, sem caracteres que alterem a lista de argumentos. */
export const esquemaModeloAssinatura = z.string().min(1).max(120).regex(/^[A-Za-z0-9._:-]+$/);

/** Validadores de dados recebidos pelo IPC ao cadastrar modelos de assinatura. */
export const esquemaNovoModeloAssinatura = z.object({
    nome: z.string().trim().min(1).max(120),
    assinatura: z.object({ provedor: esquemaProvedorAssinatura, id: esquemaModeloAssinatura }),
});
export type ModeloAssinaturaEntrada = z.infer<typeof esquemaNovoModeloAssinatura>;
