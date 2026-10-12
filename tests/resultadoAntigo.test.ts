import { describe, expect, test } from 'bun:test';
import { resumirResultadoAntigo } from '../electron/services/agente';

describe('resumirResultadoAntigo', () => {
    test('mantém resultados curtos intactos', () => {
        expect(resumirResultadoAntigo('ok')).toBe('ok');
    });

    test('preserva início e fim de resultados longos', () => {
        const resultado = `INICIO${'x'.repeat(50000)}FIM`;
        const resumido = resumirResultadoAntigo(resultado);
        expect(resumido.length).toBeLessThan(2300);
        expect(resumido.startsWith('INICIO')).toBe(true);
        expect(resumido.endsWith('FIM')).toBe(true);
        expect(resumido).toContain('Repita a ação');
    });
});
