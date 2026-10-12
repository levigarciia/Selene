import { z } from 'zod';
import {
    esquemaEnvolvimentoGitHub,
    esquemaEstadoItemGitHub,
    esquemaTipoItemGitHub,
    type ItemGitHub,
} from '../../shared/repositorio';

export const ordensGitHub = ['atualizado', 'recente', 'antigo', 'maior', 'menor'] as const;
export type OrdemGitHub = (typeof ordensGitHub)[number];

const esquemaPreferencias = z.object({
    tipo: esquemaTipoItemGitHub.catch('pr'),
    estado: esquemaEstadoItemGitHub.catch('open'),
    envolvimento: esquemaEnvolvimentoGitHub.catch('todos'),
    ordem: z.enum(ordensGitHub).catch('atualizado'),
    projetoId: z.string().nullable().catch(null),
});
export type PreferenciasGitHub = z.infer<typeof esquemaPreferencias>;

const CHAVE_PREFERENCIAS = 'selene.listaGitHub';

/** Lê os filtros usados por último, descartando valores que deixaram de existir. */
export function lerPreferenciasGitHub(): PreferenciasGitHub {
    try {
        return esquemaPreferencias.parse(JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS) ?? '{}'));
    } catch {
        return esquemaPreferencias.parse({});
    }
}

export function salvarPreferenciasGitHub(preferencias: PreferenciasGitHub): void {
    localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(preferencias));
}

const tamanho = (item: ItemGitHub) => (item.adicoes ?? 0) + (item.remocoes ?? 0);

const comparadores: Record<OrdemGitHub, (a: ItemGitHub, b: ItemGitHub) => number> = {
    atualizado: (a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm),
    recente: (a, b) => b.criadoEm.localeCompare(a.criadoEm),
    antigo: (a, b) => a.criadoEm.localeCompare(b.criadoEm),
    maior: (a, b) => tamanho(b) - tamanho(a),
    menor: (a, b) => tamanho(a) - tamanho(b),
};

/** Une as respostas de vários projetos, sem repetir itens de projetos que apontam ao mesmo repositório. */
export function unirItensGitHub(respostas: ItemGitHub[][]): ItemGitHub[] {
    const vistos = new Set<string>();
    return respostas.flat().filter((item) => {
        const chave = `${item.repositorio}#${item.numero}`;
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
    });
}

export function ordenarItensGitHub(itens: ItemGitHub[], ordem: OrdemGitHub): ItemGitHub[] {
    return [...itens].sort(comparadores[ordem]);
}

export interface GrupoGitHub {
    repositorio: string;
    itens: ItemGitHub[];
}

/** Agrupa por repositório, na ordem em que cada repositório aparece primeiro na lista ordenada. */
export function agruparItensGitHub(itens: ItemGitHub[]): GrupoGitHub[] {
    const grupos = new Map<string, ItemGitHub[]>();
    for (const item of itens) grupos.set(item.repositorio, [...(grupos.get(item.repositorio) ?? []), item]);
    return [...grupos].map(([repositorio, itensGrupo]) => ({ repositorio, itens: itensGrupo }));
}

/** Rótulo curto de tempo relativo, como o T3 usa na coluna da direita. */
export function tempoRelativo(data: string, agora = Date.now()): string {
    const minutos = Math.max(1, Math.round((agora - new Date(data).getTime()) / 60000));
    if (minutos < 60) return `${minutos} min`;
    if (minutos < 1440) return `${Math.round(minutos / 60)} h`;
    if (minutos < 43200) return `${Math.round(minutos / 1440)} d`;
    if (minutos < 525600) return `${Math.round(minutos / 43200)} m`;
    return `${Math.round(minutos / 525600)} a`;
}
