import { z } from 'zod';
import type { ItemGitHub, TipoItemGitHub } from './repositorio';

export const esquemaItemGitHubNoChat = z.object({
    url: z
        .string()
        .max(2000)
        .regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:issues|pull)\/[1-9]\d*$/i),
    projetoId: z.string().uuid().optional(),
    titulo: z.string().max(500).optional(),
});

/** Prepara a instrução de uma nova conversa Code com referência exata e pasta do repositório. */
export function instrucaoItemGitHub(
    item: Pick<ItemGitHub, 'url' | 'titulo'>,
    tipo: TipoItemGitHub,
    pasta: string,
): string {
    const pedido =
        tipo === 'issue'
            ? 'Investigue essa issue e implemente o que for necessário. ' +
              'Reproduza o problema, faça a correção e valide o resultado.'
            : 'Analise esse pull request para verificar se está correto e seguro para merge. ' +
              'Revise o diff, os testes e ' +
              'as verificações do GitHub. Aponte problemas concretos e me dê um retorno antes de qualquer mesclagem.';
    return `${pedido}\n\n${item.titulo}\n${item.url}\n\nTrabalhe no repositório da pasta: ${pasta}`;
}
