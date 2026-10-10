import type { Dados, RegistroUso } from './contratos';

export type PeriodoEstatisticas = 'semana' | 'mes' | 'total' | '24h' | '7dias' | '30dias' | '90dias';

/** Resolve o intervalo no calendário do usuário, preservando os períodos antigos. */
export function intervaloEstatisticas(periodo: PeriodoEstatisticas, agora = new Date()): Date {
    const inicio = new Date(agora);
    if (periodo === '24h') return new Date(agora.getTime() - 24 * 60 * 60 * 1000);
    if (periodo === 'total') return new Date(0);
    inicio.setHours(0, 0, 0, 0);
    if (periodo === 'semana') inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
    if (periodo === 'mes') inicio.setDate(1);
    const dias = { '7dias': 7, '30dias': 30, '90dias': 90 };
    if (periodo in dias) inicio.setDate(inicio.getDate() - dias[periodo as keyof typeof dias] + 1);
    return inicio;
}

/** Use para preservar o uso registrado mesmo após apagar conversas, sem duplicar medições da mesma resposta. */
export function reunirRegistrosUso(
    dados: Pick<Dados, 'conversas' | 'registrosUso'> & Partial<Pick<Dados, 'entradasUsoDescartadas'>>,
): RegistroUso[] {
    const registros = new Map(dados.registrosUso.map((registro) => [registro.mensagemId, registro]));
    for (const conversa of dados.conversas) {
        for (const mensagem of conversa.mensagens) {
            if (
                mensagem.papel !== 'assistant' ||
                (!mensagem.desempenho && mensagem.custoUsd === undefined && !mensagem.provedor)
            )
                continue;
            const data = Date.parse(mensagem.criadoEm);
            if (!Number.isFinite(data)) continue;
            registros.set(mensagem.id, {
                tokensGerados: 0,
                tempoGeracaoMs: 0,
                tokensPorSegundo: 0,
                ...mensagem.desempenho,
                medicoesModelo: mensagem.medicoesModelo,
                custoUsd: mensagem.custoUsd,
                provedor: mensagem.provedor,
                mensagemId: mensagem.id,
                conversaId: conversa.id,
                modo: conversa.modo,
                modeloId: mensagem.modeloUsoId ?? null,
                criadoEm: new Date(data).toISOString(),
            });
        }
    }
    const descartadas = new Set(dados.entradasUsoDescartadas ?? []);
    return [...registros.values()].map((registro) => {
        if (!descartadas.has(registro.mensagemId)) return registro;
        const limpo = { ...registro };
        delete limpo.tokensEntrada;
        delete limpo.tokensEntradaCache;
        return limpo;
    });
}

/** Calcula semana civil local, mês atual ou histórico completo somente com métricas registradas pelo motor. */
export function calcularEstatisticas(registros: RegistroUso[], periodo: PeriodoEstatisticas, agora = new Date()) {
    const inicioMs = intervaloEstatisticas(periodo, agora).getTime();
    const atuais = registros.filter((registro) => {
        const data = Date.parse(registro.criadoEm);
        return data >= inicioMs && data <= agora.getTime();
    });
    const tokensGerados = atuais.reduce((total, item) => total + item.tokensGerados, 0);
    const tokensEntrada = atuais.reduce((total, item) => total + (item.tokensEntrada ?? 0), 0);
    const cacheMedido = atuais.filter(
        (item) =>
            item.tokensEntrada !== undefined &&
            item.tokensEntradaCache !== undefined &&
            item.tokensEntradaCache <= item.tokensEntrada,
    );
    const tokensEntradaCache = cacheMedido.reduce((total, item) => total + item.tokensEntradaCache!, 0);
    const tokensEntradaSemCache = cacheMedido.reduce(
        (total, item) => total + item.tokensEntrada! - item.tokensEntradaCache!,
        0,
    );
    const medidos = atuais.filter((item) => item.tempoGeracaoMs > 0);
    const tempoMs = medidos.reduce((total, item) => total + item.tempoGeracaoMs, 0);
    const tokensMedidos = medidos.reduce((total, item) => total + item.tokensGerados, 0);
    const ultima = [...atuais].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
    return {
        custoUsd: atuais.reduce((total, item) => total + (item.custoUsd ?? 0), 0),
        custosMedidos: atuais.filter((item) => item.custoUsd !== undefined).length,
        custosPendentes: atuais.filter((item) => item.provedor === 'openrouter' && item.custoUsd === undefined).length,
        tokensGerados,
        tokensEntrada,
        tokensEntradaCache,
        tokensEntradaSemCache,
        tokensEntradaSemMedicaoCache: tokensEntrada - tokensEntradaCache - tokensEntradaSemCache,
        entradasCacheMedidas: cacheMedido.length,
        tokensRegistrados: tokensGerados + tokensEntrada,
        respostas: atuais.length,
        entradasMedidas: atuais.filter((item) => item.tokensEntrada !== undefined).length,
        tokensPorSegundo: tempoMs > 0 ? tokensMedidos / (tempoMs / 1000) : null,
        ultimaVelocidade: ultima?.tokensPorSegundo ?? null,
    };
}
