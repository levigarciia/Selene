import { z } from 'zod';
import { esquemaIconeProjeto } from './iconesProjetos';

export const esquemaArquivoProjetoChat = z.object({
    id: z.string().uuid(),
    nome: z.string().trim().min(1).max(200),
    texto: z.string().min(1).max(20000),
});
const esquemaBaseProjetoChat = z.object({
    id: z.string().uuid(),
    nome: z.string().trim().min(1).max(100),
    instrucao: z.string().max(20000).default(''),
    icone: esquemaIconeProjeto.nullable().optional(),
    memoria: z.boolean().default(true),
    arquivos: z.array(esquemaArquivoProjetoChat).max(10).default([]),
    criadoEm: z.string().datetime(),
});
export const esquemaProjetoChat = esquemaBaseProjetoChat.refine(
    (projeto) => projeto.arquivos.reduce((total, arquivo) => total + arquivo.texto.length, 0) <= 60000,
    'Os arquivos do projeto excedem o limite de 60000 caracteres.',
);
export const esquemaEdicaoProjetoChat = esquemaBaseProjetoChat.pick({
    nome: true,
    instrucao: true,
    icone: true,
    memoria: true,
});
export type ProjetoChat = z.infer<typeof esquemaProjetoChat>;
export type EdicaoProjetoChat = z.infer<typeof esquemaEdicaoProjetoChat>;
