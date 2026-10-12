import { describe, expect, test } from 'bun:test';
import { formatarReinicio, limitesDoClaude, limitesDoCodex } from '../shared/limites';

const agora = '2026-10-10T11:00:00.000Z';

describe('limites do Codex', () => {
    const snapshot = {
        limitId: 'codex',
        planType: 'plus',
        primary: { usedPercent: 100, windowDurationMins: 300, resetsAt: 1791635186 },
        secondary: { usedPercent: 16, windowDurationMins: 10080, resetsAt: 1792221986 },
    };

    test('converte as janelas de sessão e semanal da resposta real', () => {
        const limites = limitesDoCodex(
            {
                rateLimits: snapshot,
                rateLimitsByLimitId: { codex: snapshot },
                rateLimitResetCredits: { availableCount: 1, credits: [{ status: 'available' }] },
            },
            agora,
        );
        expect(limites).toEqual({
            estado: 'ok',
            plano: 'plus',
            janelas: [
                {
                    id: 'primaria',
                    tipo: 'sessao',
                    rotulo: 'Sessão de 5 horas',
                    percentualUsado: 100,
                    reiniciaEm: new Date(1791635186 * 1000).toISOString(),
                },
                {
                    id: 'secundaria',
                    tipo: 'semanal',
                    rotulo: 'Semanal',
                    percentualUsado: 16,
                    reiniciaEm: new Date(1792221986 * 1000).toISOString(),
                },
            ],
            reiniciosDisponiveis: 1,
            verificadoEm: agora,
        });
    });

    test('planos free e go têm uma janela mensal quando a duração não é informada', () => {
        const limites = limitesDoCodex({ rateLimits: { planType: 'free', primary: { usedPercent: 40 } } }, agora);
        expect(limites.estado === 'ok' && limites.janelas[0].tipo).toBe('mensal');
    });

    test('limita porcentagens e rejeita respostas desconhecidas', () => {
        const limites = limitesDoCodex({ rateLimits: { primary: { usedPercent: 250 } } }, agora);
        expect(limites.estado === 'ok' && limites.janelas[0].percentualUsado).toBe(100);
        expect(limitesDoCodex('lixo', agora).estado).toBe('indisponivel');
        expect(limitesDoCodex({}, agora).estado).toBe('indisponivel');
    });
});

describe('limites do Claude Code', () => {
    test('converte sessão e semana da resposta real de get_usage', () => {
        const limites = limitesDoClaude(
            {
                subscription_type: 'pro',
                rate_limits_available: true,
                rate_limits: {
                    five_hour: { utilization: 25, resets_at: '2026-10-10T15:49:59.806688+00:00' },
                    seven_day: { utilization: 3, resets_at: '2026-10-12T15:59:59.806710+00:00' },
                    seven_day_opus: null,
                    model_scoped: [{ display_name: 'Fable', utilization: 60, resets_at: null }],
                },
            },
            agora,
        );
        expect(limites.estado === 'ok' && limites.plano).toBe('pro');
        expect(limites.estado === 'ok' && limites.janelas.map((janela) => [janela.rotulo, janela.percentualUsado])).toEqual([
            ['Sessão de 5 horas', 25],
            ['Semanal', 3],
            ['Semanal · Fable', 60],
        ]);
    });

    test('informa indisponibilidade quando a conta não expõe limites', () => {
        expect(limitesDoClaude({ rate_limits_available: false }, agora).estado).toBe('indisponivel');
    });
});

describe('formatarReinicio', () => {
    const base = Date.parse(agora);
    test('usa minutos, horas e dias', () => {
        expect(formatarReinicio('2026-10-10T11:30:00.000Z', base)).toBe('30 min');
        expect(formatarReinicio('2026-10-10T13:14:00.000Z', base)).toBe('2 h 14 min');
        expect(formatarReinicio('2026-10-13T11:00:00.000Z', base)).toBe('3 dias');
        expect(formatarReinicio('2026-10-10T10:00:00.000Z', base)).toBe('reiniciando');
    });
});
