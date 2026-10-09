import { z } from 'zod';

export const simbolosProjeto = ['pasta', 'codigo', 'terminal', 'cubo', 'globo', 'livro', 'jogo', 'foguete'] as const;
export const coresProjeto = {
    verde: '#91b6a0',
    azul: '#8aaddc',
    violeta: '#b5a0dd',
    rosa: '#d89aba',
    laranja: '#d6a27c',
    amarelo: '#d5c17e',
    cinza: '#b3b8c0',
} as const;
const cor = z.enum(['verde', 'azul', 'violeta', 'rosa', 'laranja', 'amarelo', 'cinza']);
export const esquemaIconeProjeto = z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('simbolo'), nome: z.enum(simbolosProjeto), cor }),
    z.object({ tipo: z.literal('iniciais'), texto: z.string().trim().min(1).max(3), cor }),
    z.object({
        tipo: z.literal('imagem'),
        dados: z
            .string()
            .max(200000)
            .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/),
    }),
]);
export type IconeDeProjeto = z.infer<typeof esquemaIconeProjeto>;
