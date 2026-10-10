import { z } from 'zod';

export const esquemaModeloOpenRouter = z.object({
    id: z.string().min(1).max(200),
    name: z.string().min(1),
    context_length: z.number().int().positive(),
    pricing: z.object({ prompt: z.string(), completion: z.string() }),
    architecture: z.object({
        input_modalities: z.array(z.string()),
        output_modalities: z.array(z.string()),
    }),
    supported_parameters: z.array(z.string()).default([]),
    top_provider: z.object({ max_completion_tokens: z.number().int().positive().nullish() }).optional(),
});
export type ModeloOpenRouter = z.infer<typeof esquemaModeloOpenRouter>;
export const esquemaOrdenacaoOpenRouter = z.enum([
    'most-popular',
    'newest',
    'top-weekly',
    'pricing-low-to-high',
    'pricing-high-to-low',
    'context-high-to-low',
    'throughput-high-to-low',
    'latency-low-to-high',
]);
export type OrdenacaoOpenRouter = z.infer<typeof esquemaOrdenacaoOpenRouter>;
export const ordenacoesOpenRouter: { valor: OrdenacaoOpenRouter; nome: string }[] = [
    { valor: 'most-popular', nome: 'Mais populares' },
    { valor: 'newest', nome: 'Mais recentes' },
    { valor: 'top-weekly', nome: 'Destaques da semana' },
    { valor: 'pricing-low-to-high', nome: 'Menor preço' },
    { valor: 'pricing-high-to-low', nome: 'Maior preço' },
    { valor: 'context-high-to-low', nome: 'Maior contexto' },
    { valor: 'throughput-high-to-low', nome: 'Mais rápidos' },
    { valor: 'latency-low-to-high', nome: 'Menor latência' },
];

/** Formata custos em dólares preservando valores pequenos de cada solicitação. */
export function formatarCusto(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    }).format(valor);
}

/** Apresenta preços do catálogo por milhão de tokens, sem estimar o custo cobrado. */
export function precoModelo(modelo: ModeloOpenRouter): string {
    return (
        `Entrada ${formatarCusto(Number(modelo.pricing.prompt) * 1e6)} · ` +
        `saída ${formatarCusto(Number(modelo.pricing.completion) * 1e6)} por milhão de tokens`
    );
}
