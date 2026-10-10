import type { RegistroUso } from './contratos';
import { calcularEstatisticas, intervaloEstatisticas, type PeriodoEstatisticas } from './estatisticas';

export type GrupoEstatisticas = {
    id: string;
    entrada: number;
    saida: number;
    total: number;
    respostas: number;
    sessoes: number;
};

/** Identifica dias pelo calendário local, sem deslocar registros pela conversão UTC. */
export function chaveDiaLocal(data: Date): string {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function agrupar(registros: RegistroUso[], chave: (registro: RegistroUso) => string): GrupoEstatisticas[] {
    const grupos = new Map<string, { grupo: GrupoEstatisticas; conversas: Set<string> }>();
    for (const registro of registros) {
        const id = chave(registro);
        const atual = grupos.get(id) ?? {
            grupo: { id, entrada: 0, saida: 0, total: 0, respostas: 0, sessoes: 0 },
            conversas: new Set<string>(),
        };
        atual.grupo.entrada += registro.tokensEntrada ?? 0;
        atual.grupo.saida += registro.tokensGerados;
        atual.grupo.total = atual.grupo.entrada + atual.grupo.saida;
        atual.grupo.respostas++;
        atual.conversas.add(registro.conversaId);
        atual.grupo.sessoes = atual.conversas.size;
        grupos.set(id, atual);
    }
    return [...grupos.values()].map(({ grupo }) => grupo);
}

/** Prepara totais, dias sem uso e grupos para o painel a partir das medições persistidas. */
export function montarPainelEstatisticas(registros: RegistroUso[], periodo: PeriodoEstatisticas, agora = new Date()) {
    let inicio = intervaloEstatisticas(periodo, agora);
    const atuais = registros.filter((item) => {
        const instante = Date.parse(item.criadoEm);
        return instante >= inicio.getTime() && instante <= agora.getTime();
    });
    if (periodo === 'total') {
        inicio = new Date(atuais.length ? Math.min(...atuais.map((item) => Date.parse(item.criadoEm))) : agora);
    }
    const porDia = agrupar(atuais, (item) => chaveDiaLocal(new Date(item.criadoEm)));
    const gruposDia = new Map(porDia.map((item) => [item.id, item]));
    const serie: { dia: string; total: number }[] = [];
    const dia = new Date(inicio);
    dia.setHours(0, 0, 0, 0);
    while (dia <= agora) {
        const chave = chaveDiaLocal(dia);
        serie.push({ dia: chave, total: gruposDia.get(chave)?.total ?? 0 });
        dia.setDate(dia.getDate() + 1);
    }
    return {
        ...calcularEstatisticas(atuais, 'total', agora),
        sessoes: new Set(atuais.map((item) => item.conversaId)).size,
        inicio,
        fim: agora,
        serie,
        modelos: agrupar(atuais, (item) => item.modeloId ?? 'desconhecido').sort((a, b) => b.total - a.total),
        dias: porDia.sort((a, b) => b.id.localeCompare(a.id)),
    };
}
