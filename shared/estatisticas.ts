import type { Dados, RegistroUso } from './contratos';

export type PeriodoEstatisticas = 'semana' | 'mes' | 'total';

/** Use para preservar o uso registrado mesmo após apagar conversas, sem duplicar medições da mesma resposta. */
export function reunirRegistrosUso(dados: Pick<Dados, 'conversas' | 'registrosUso'>): RegistroUso[] {
    const registros = new Map(dados.registrosUso.map((registro) => [registro.mensagemId, registro]));
    for (const conversa of dados.conversas) {
        for (const mensagem of conversa.mensagens) {
            if (mensagem.papel !== 'assistant' || !mensagem.desempenho) continue;
            const data = Date.parse(mensagem.criadoEm);
            if (!Number.isFinite(data)) continue;
            registros.set(mensagem.id, {
                ...mensagem.desempenho,
                mensagemId: mensagem.id,
                conversaId: conversa.id,
                modo: conversa.modo,
                modeloId: conversa.modeloId,
                criadoEm: new Date(data).toISOString(),
            });
        }
    }
    return [...registros.values()];
}

/** Calcula semana civil local, mês atual ou histórico completo somente com métricas registradas pelo motor. */
export function calcularEstatisticas(registros: RegistroUso[], periodo: PeriodoEstatisticas, agora = new Date()) {
    const inicio = new Date(agora);
    inicio.setHours(0, 0, 0, 0);
    if (periodo === 'semana') inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
    if (periodo === 'mes') inicio.setDate(1);
    const inicioMs = periodo === 'total' ? 0 : inicio.getTime();
    const atuais = registros.filter((registro) => {
        const data = Date.parse(registro.criadoEm);
        return data >= inicioMs && data <= agora.getTime();
    });
    const tokensGerados = atuais.reduce((total, item) => total + item.tokensGerados, 0);
    const tokensEntrada = atuais.reduce((total, item) => total + (item.tokensEntrada ?? 0), 0);
    const medidos = atuais.filter((item) => item.tempoGeracaoMs > 0);
    const tempoMs = medidos.reduce((total, item) => total + item.tempoGeracaoMs, 0);
    const tokensMedidos = medidos.reduce((total, item) => total + item.tokensGerados, 0);
    const ultima = [...atuais].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
    return {
        tokensGerados,
        tokensEntrada,
        tokensRegistrados: tokensGerados + tokensEntrada,
        respostas: atuais.length,
        entradasMedidas: atuais.filter((item) => item.tokensEntrada !== undefined).length,
        tokensPorSegundo: tempoMs > 0 ? tokensMedidos / (tempoMs / 1000) : null,
        ultimaVelocidade: ultima?.tokensPorSegundo ?? null,
    };
}
