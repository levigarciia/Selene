import { catalogoModelos, encontrarModeloLocal } from './catalogo';
import type { Conversa, Modelo } from './contratos';

export type NivelRaciocinio = NonNullable<Conversa['nivelRaciocinio']>;
export const nomesRaciocinio: Record<NivelRaciocinio, string> = {
    desativado: 'Desativado',
    baixo: 'Baixo',
    medio: 'Médio',
    alto: 'Alto',
};

/** Oferece níveis somente para famílias com template de raciocínio conhecido. */
export function niveisRaciocinio(modelo?: Modelo): NivelRaciocinio[] {
    if (!modelo) return [];
    const item = catalogoModelos.find((entrada) => encontrarModeloLocal(entrada, [modelo]));
    const nome = `${modelo.nome} ${modelo.caminho}`.toLowerCase();
    if (item?.familia === 'qwen' || (!item && /qwen3(?:[.\s_-]|$)/.test(nome))) {
        return ['desativado', 'baixo', 'medio', 'alto'];
    }
    if (item?.familia === 'deepseek' || (!item && /deepseek[\s_-]*r1/.test(nome))) {
        return ['baixo', 'medio', 'alto'];
    }
    return [];
}

/** Resolve escolhas antigas ou incompatíveis ao trocar o modelo da conversa. */
export function resolverNivelRaciocinio(modelo?: Modelo, nivel?: NivelRaciocinio): NivelRaciocinio {
    const niveis = niveisRaciocinio(modelo);
    if (nivel && niveis.includes(nivel)) return nivel;
    return niveis.includes('desativado') || !niveis.length ? 'desativado' : 'medio';
}

/** Reserva tokens para a resposta final e aplica o orçamento ao raciocínio do servidor local. */
export function parametrosRaciocinio(
    modelo: Modelo | undefined,
    nivel: NivelRaciocinio | undefined,
    maxTokens: number,
) {
    const resolvido = resolverNivelRaciocinio(modelo, nivel);
    const proporcao = { desativado: 0, baixo: 0.25, medio: 0.5, alto: 0.75 }[resolvido];
    return {
        chat_template_kwargs: { enable_thinking: resolvido !== 'desativado' },
        reasoning_budget_tokens: Math.floor(maxTokens * proporcao),
        reasoning_format: 'deepseek',
    };
}
