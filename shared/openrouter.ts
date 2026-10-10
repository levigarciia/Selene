import { z } from 'zod';
import { esforcosOpenRouter, type EsforcoOpenRouter } from './contratos';


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
    reasoning: z
        .object({ supported_efforts: z.array(z.string()).nullish() })
        .optional(),
    top_provider: z.object({ max_completion_tokens: z.number().int().positive().nullish() }).optional(),
});
export type ModeloOpenRouter = z.infer<typeof esquemaModeloOpenRouter>;

/** Mantém somente os esforços conhecidos, na ordem do provedor. Ausência indica modelo sem seleção de esforço. */
export function esforcosDoProvedor(valores: string[] | null | undefined): EsforcoOpenRouter[] | undefined {
    if (!valores) return undefined;
    return valores.filter((valor): valor is EsforcoOpenRouter =>
        (esforcosOpenRouter as readonly string[]).includes(valor),
    );
}

/** Saldo da conta OpenRouter em dólares: créditos comprados, consumo acumulado e restante. */
export type SaldoOpenRouter = { creditos: number; usado: number; restante: number };
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

/** Mostra totais em dólares com duas casas decimais, como US$ 0,10. */
export function formatarTotalCusto(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(valor);
}

/** Remove o prefixo de fornecedor do nome do OpenRouter, como em "Anthropic: Claude Haiku 4.5". */
export function nomeModeloOpenRouter(nome: string): string {
    return nome.replace(/^[^:]+:\s*/, '').trim() || nome;
}

/** Limpa o nome de exibição de modelos já salvos, inclusive cadastros feitos antes da correção. */
export function nomeExibicaoModelo(nome: string | undefined): string | undefined {
    return nome === undefined ? undefined : nomeModeloOpenRouter(nome);
}

/** Apresenta preços do catálogo por milhão de tokens, sem estimar o custo cobrado. */
export function precoModelo(modelo: ModeloOpenRouter): string {
    return (
        `Entrada ${formatarCusto(Number(modelo.pricing.prompt) * 1e6)} · ` +
        `saída ${formatarCusto(Number(modelo.pricing.completion) * 1e6)} por milhão de tokens`
    );
}
