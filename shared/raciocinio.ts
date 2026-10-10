import { catalogoModelos, encontrarModeloLocal } from './catalogo';
import type { Conversa, Modelo } from './contratos';

export type NivelRaciocinio = NonNullable<Conversa['nivelRaciocinio']>;

export const nomesRaciocinio: Record<NivelRaciocinio, string> = {
    desativado: 'Desativado',
    baixo: 'Baixo',
    medio: 'Médio',
    alto: 'Alto',
    xhigh: 'Extra alto',
    max: 'Máximo',
};

/** Mapeia cada nível da Selene para o valor de esforço enviado ao OpenRouter. */
const esforcoOpenRouter: Partial<Record<NivelRaciocinio, string>> = {
    desativado: 'none',
    baixo: 'low',
    medio: 'medium',
    alto: 'high',
    xhigh: 'xhigh',
    max: 'max',
};

const nivelPorEsforco = new Map(
    Object.entries(esforcoOpenRouter).map(([nivel, esforco]) => [esforco, nivel as NivelRaciocinio]),
);

/** Níveis locais do llama.cpp, expostos somente para famílias com template de raciocínio conhecido. */
const niveisLocais: NivelRaciocinio[] = ['desativado', 'baixo', 'medio', 'alto'];

/**
 * Lista os níveis que o modelo aceita agora. Modelos remotos seguem os esforços informados pelo OpenRouter,
 * na ordem do provedor (do mais intenso ao mais leve); modelos locais seguem a capacidade do catálogo.
 */
export function niveisRaciocinio(modelo?: Modelo): NivelRaciocinio[] {
    if (!modelo) return [];
    if (modelo.openrouter) return niveisOpenRouter(modelo.openrouter);
    const item = catalogoModelos.find((entrada) => encontrarModeloLocal(entrada, [modelo]));
    if (item) {
        if (!item.capacidades.includes('raciocinio')) return [];
        return item.familia === 'deepseek' ? ['baixo', 'medio', 'alto'] : niveisLocais;
    }
    const nome = `${modelo.nome} ${modelo.caminho}`.toLowerCase();
    if (/qwen3(?:[.\s_-]|$)/.test(nome)) return niveisLocais;
    if (/deepseek[\s_-]*r1/.test(nome)) return ['baixo', 'medio', 'alto'];
    return [];
}

/** Converte os esforços do provedor em níveis da Selene, preservando a ordem recebida. */
function niveisOpenRouter(remoto: NonNullable<Modelo['openrouter']>): NivelRaciocinio[] {
    if (!remoto.raciocinio) return [];
    const niveis = (remoto.esforcos ?? []).flatMap((esforco) => {
        const nivel = nivelPorEsforco.get(esforco);
        return nivel ? [nivel] : [];
    });
    if (!niveis.length) return ['desativado', 'baixo', 'medio', 'alto'];
    return niveis.includes('desativado') ? niveis : ['desativado', ...niveis];
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
    if (modelo?.openrouter) {
        const esforco = esforcoOpenRouter[resolvido];
        return {
            reasoning: resolvido === 'desativado' ? { enabled: false } : { effort: esforco },
        };
    }
    const proporcao = { desativado: 0, baixo: 0.25, medio: 0.5, alto: 0.75, xhigh: 0.75, max: 0.75 }[resolvido];
    return {
        chat_template_kwargs: { enable_thinking: resolvido !== 'desativado' },
        reasoning_budget_tokens: Math.floor(maxTokens * proporcao),
        reasoning_format: 'deepseek',
    };
}
