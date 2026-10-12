import { z } from 'zod';

/** Janela de uso de uma inscrição, como as de sessão (5 horas) e semanal exibidas pelos CLIs oficiais. */
export type JanelaLimite = {
    id: string;
    tipo: 'sessao' | 'semanal' | 'mensal';
    rotulo: string;
    percentualUsado: number;
    /** Instante ISO em que a janela reinicia. */
    reiniciaEm?: string;
};

export type LimitesAssinatura =
    | {
          estado: 'ok';
          plano?: string;
          janelas: JanelaLimite[];
          /** Reinícios gratuitos concedidos pela conta, quando o CLI informa. */
          reiniciosDisponiveis?: number;
          verificadoEm: string;
      }
    | { estado: 'indisponivel'; motivo: string; verificadoEm: string };

const MIN_SEMANA = 7 * 24 * 60;
const MIN_MES = 30 * 24 * 60;

function limitar(percentual: number): number {
    return Math.min(100, Math.max(0, percentual));
}

function isoDeSegundos(valor: number | null | undefined): string | undefined {
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) return undefined;
    return new Date(valor * 1000).toISOString();
}

function isoDeTexto(valor: string | null | undefined): string | undefined {
    if (!valor) return undefined;
    const tempo = Date.parse(valor);
    return Number.isFinite(tempo) ? new Date(tempo).toISOString() : undefined;
}

const esquemaJanelaCodex = z
    .object({
        usedPercent: z.number(),
        windowDurationMins: z.number().nullish(),
        resetsAt: z.number().nullish(),
    })
    .nullish();
const esquemaSnapshotCodex = z.object({
    limitId: z.string().nullish(),
    planType: z.string().nullish(),
    primary: esquemaJanelaCodex,
    secondary: esquemaJanelaCodex,
});
const esquemaRespostaCodex = z.object({
    rateLimits: esquemaSnapshotCodex.nullish(),
    rateLimitsByLimitId: z.record(z.string(), esquemaSnapshotCodex).nullish(),
    rateLimitResetCredits: z
        .object({ availableCount: z.number(), credits: z.array(z.object({ status: z.string() })).nullish() })
        .nullish(),
});

/**
 * Converte `account/rateLimits/read` do Codex. A posição primária e secundária não indica duração:
 * usa-se `windowDurationMins` e, na falta dele, o par de 5 horas e semana dos planos pagos.
 */
export function limitesDoCodex(resposta: unknown, verificadoEm: string): LimitesAssinatura {
    const lida = esquemaRespostaCodex.safeParse(resposta);
    if (!lida.success) return { estado: 'indisponivel', motivo: 'Resposta do Codex não reconhecida.', verificadoEm };
    const snapshot = lida.data.rateLimitsByLimitId?.codex ?? lida.data.rateLimits;
    if (!snapshot) return { estado: 'indisponivel', motivo: 'O Codex não informou limites.', verificadoEm };
    const mensal = snapshot.planType === 'free' || snapshot.planType === 'go';
    const janelas: JanelaLimite[] = [];
    for (const [id, janela, padrao] of [
        ['primaria', snapshot.primary, mensal ? MIN_MES : 300],
        ['secundaria', snapshot.secondary, MIN_SEMANA],
    ] as const) {
        if (!janela || !Number.isFinite(janela.usedPercent)) continue;
        const duracao = janela.windowDurationMins ?? padrao;
        const tipo = duracao >= MIN_MES ? 'mensal' : duracao >= MIN_SEMANA ? 'semanal' : 'sessao';
        const reiniciaEm = isoDeSegundos(janela.resetsAt);
        janelas.push({
            id,
            tipo,
            rotulo: tipo === 'sessao' ? 'Sessão de 5 horas' : tipo === 'semanal' ? 'Semanal' : 'Mensal',
            percentualUsado: limitar(janela.usedPercent),
            ...(reiniciaEm ? { reiniciaEm } : {}),
        });
    }
    const reinicios = lida.data.rateLimitResetCredits?.availableCount;
    return {
        estado: 'ok',
        ...(snapshot.planType ? { plano: snapshot.planType } : {}),
        janelas,
        ...(reinicios ? { reiniciosDisponiveis: reinicios } : {}),
        verificadoEm,
    };
}

const esquemaJanelaClaude = z.object({ utilization: z.number().nullish(), resets_at: z.string().nullish() }).nullish();
const esquemaRespostaClaude = z.object({
    subscription_type: z.string().nullish(),
    rate_limits_available: z.boolean().optional(),
    rate_limits: z
        .object({
            five_hour: esquemaJanelaClaude,
            seven_day: esquemaJanelaClaude,
            seven_day_opus: esquemaJanelaClaude,
            seven_day_sonnet: esquemaJanelaClaude,
            model_scoped: z
                .array(
                    z.object({
                        display_name: z.string(),
                        utilization: z.number().nullish(),
                        resets_at: z.string().nullish(),
                    }),
                )
                .nullish(),
        })
        .nullish(),
});

/** Converte `get_usage` do Claude Code. Porcentagens já vêm de 0 a 100. */
export function limitesDoClaude(resposta: unknown, verificadoEm: string): LimitesAssinatura {
    const lida = esquemaRespostaClaude.safeParse(resposta);
    if (!lida.success) return { estado: 'indisponivel', motivo: 'Resposta do Claude Code não reconhecida.', verificadoEm };
    const { rate_limits: limites, subscription_type: plano } = lida.data;
    if (!lida.data.rate_limits_available || !limites) {
        return { estado: 'indisponivel', motivo: 'Esta conta não informa limites de uso.', verificadoEm };
    }
    const janelas: JanelaLimite[] = [];
    const incluir = (
        id: string,
        tipo: JanelaLimite['tipo'],
        rotulo: string,
        janela: { utilization?: number | null; resets_at?: string | null } | null | undefined,
    ) => {
        if (!janela || typeof janela.utilization !== 'number') return;
        const reiniciaEm = isoDeTexto(janela.resets_at);
        janelas.push({
            id,
            tipo,
            rotulo,
            percentualUsado: limitar(janela.utilization),
            ...(reiniciaEm ? { reiniciaEm } : {}),
        });
    };
    incluir('sessao', 'sessao', 'Sessão de 5 horas', limites.five_hour);
    incluir('semanal', 'semanal', 'Semanal', limites.seven_day);
    incluir('semanal-opus', 'semanal', 'Semanal · Opus', limites.seven_day_opus);
    incluir('semanal-sonnet', 'semanal', 'Semanal · Sonnet', limites.seven_day_sonnet);
    for (const modelo of limites.model_scoped ?? []) {
        incluir(`semanal-${modelo.display_name.toLowerCase()}`, 'semanal', `Semanal · ${modelo.display_name}`, modelo);
    }
    return { estado: 'ok', ...(plano ? { plano } : {}), janelas, verificadoEm };
}

/** Tempo restante até o reinício, em texto curto ("2 h 14 min", "3 dias"). */
export function formatarReinicio(reiniciaEm: string, agora = Date.now()): string {
    const minutos = Math.round((Date.parse(reiniciaEm) - agora) / 60000);
    if (!Number.isFinite(minutos)) return '';
    if (minutos <= 0) return 'reiniciando';
    if (minutos < 60) return `${minutos} min`;
    if (minutos < 48 * 60) {
        const horas = Math.floor(minutos / 60);
        const resto = minutos % 60;
        return resto ? `${horas} h ${resto} min` : `${horas} h`;
    }
    return `${Math.round(minutos / 1440)} dias`;
}
