import { z } from 'zod';

/** Aceita endereços web sem credenciais ou protocolos de acesso ao computador. */
export function validarUrlWeb(valor: string): string {
    const url = new URL(valor);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Use uma URL HTTP ou HTTPS sem credenciais.');
    }
    return url.href;
}

export const esquemaPesquisaWeb = z.object({ consulta: z.string().trim().min(1).max(500) }).strict();
export const esquemaLeituraWeb = z.object({ url: z.string().max(4000).transform(validarUrlWeb) }).strict();
export const esquemaNavegador = z
    .object({
        acao: z.enum(['abrir', 'observar', 'clicar', 'preencher', 'rolar', 'voltar', 'avancar', 'fechar']),
        url: z.string().max(4000).transform(validarUrlWeb).optional(),
        observacao: z
            .string()
            .uuid()
            .nullish()
            .transform((valor) => valor ?? undefined)
            .optional(),
        referencia: z
            .string()
            .regex(/^e[1-9][0-9]*$/)
            .optional(),
        texto: z.string().max(10000).optional(),
        direcao: z.enum(['cima', 'baixo']).optional(),
    })
    .strict()
    .superRefine((entrada, contexto) => {
        const exigir = (campo: keyof typeof entrada) => {
            if (entrada[campo] === undefined)
                contexto.addIssue({ code: 'custom', path: [campo], message: 'Campo obrigatório.' });
        };
        if (entrada.acao === 'abrir') exigir('url');
        if (['clicar', 'preencher'].includes(entrada.acao)) exigir('referencia');
        if (entrada.acao === 'preencher') exigir('texto');
        if (entrada.acao === 'rolar') exigir('direcao');
    });

export type ComandoNavegador = z.infer<typeof esquemaNavegador>;
export type PreviaNavegador = {
    conversaId: string;
    origem?: 'navegador' | 'pesquisa' | 'leitura';
    aberto: boolean;
    carregando: boolean;
    url: string;
    titulo: string;
    imagem?: string;
    largura: number;
    altura: number;
};
export type ServicoWeb = {
    pesquisar: (consulta: string, sinal: AbortSignal, conversaId?: string) => Promise<string>;
    ler: (url: string, sinal: AbortSignal, conversaId?: string) => Promise<string>;
    preparar: (
        conversaId: string,
        comando: ComandoNavegador,
    ) => {
        previa: string;
        executar: (sinal: AbortSignal) => Promise<string>;
    };
};

const definir = (name: string, description: string, properties: object, required: string[]) => ({
    type: 'function',
    function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } },
});

export const ferramentasPesquisa = [
    definir(
        'pesquisar_web',
        'Pesquisa na web e retorna títulos, links e trechos de fontes. Não invente resultados.',
        { consulta: { type: 'string' } },
        ['consulta'],
    ),
    definir(
        'ler_pagina_web',
        'Abre uma URL HTTP ou HTTPS e lê seu texto e links. Cite a URL da fonte na resposta.',
        { url: { type: 'string' } },
        ['url'],
    ),
];

export const ferramentaNavegador = definir(
    'controlar_navegador',
    'Controla o navegador inline desta conversa. Abrir recebe url. Observar retorna texto e referências eN. ' +
        'Para clicar envie acao="clicar" e referencia="eN". Para preencher envie também texto. ' +
        'A Selene vincula a ação à observação atual; observacao é opcional. Não invente referências. ' +
        'Preencher recebe texto; rolar recebe direcao. Observe novamente após mudanças. ' +
        'Interações e navegação exigem aprovação sem acesso completo. Não há execução de scripts arbitrários.',
    {
        acao: {
            type: 'string',
            enum: ['abrir', 'observar', 'clicar', 'preencher', 'rolar', 'voltar', 'avancar', 'fechar'],
        },
        url: { type: 'string' },
        observacao: { type: 'string' },
        referencia: { type: 'string' },
        texto: { type: 'string' },
        direcao: { type: 'string', enum: ['cima', 'baixo'] },
    },
    ['acao'],
);
