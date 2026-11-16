import { describe, expect, test } from 'bun:test';
import {
    cabecalhoEconomia,
    estimarEconomia,
    lembrarACada,
    planejarBlocoEconomia,
    type EnvioEconomia,
} from '../shared/economiaTokens';

const semRtk = { rtk: false };
const caveman = { pacotes: ['caveman' as const], nivel: 'ultra' as const };

describe('economia de tokens', () => {
    test('desligada desde o início não envia nada', () => {
        expect(planejarBlocoEconomia(undefined, undefined, semRtk).bloco).toBe('');
    });

    test('envia ao ativar, silencia e relembra a cada ciclo', () => {
        let envio: EnvioEconomia | undefined;
        const blocos: string[] = [];
        for (let indice = 0; indice < lembrarACada + 1; indice++) {
            const plano = planejarBlocoEconomia(caveman, envio, semRtk);
            envio = plano.envio;
            blocos.push(plano.bloco);
        }
        expect(blocos[0]!.startsWith(cabecalhoEconomia)).toBe(true);
        expect(blocos.slice(1, lembrarACada).every((bloco) => bloco === '')).toBe(true);
        expect(blocos[lembrarACada]).toBe(blocos[0]);
    });

    test('mudar o nível reenvia e desligar avisa o modelo', () => {
        const primeiro = planejarBlocoEconomia(caveman, undefined, semRtk).envio;
        expect(planejarBlocoEconomia({ ...caveman, nivel: 'leve' }, primeiro, semRtk).bloco).not.toBe('');
        const desligado = planejarBlocoEconomia({ pacotes: [], nivel: 'leve' }, primeiro, semRtk);
        expect(desligado.bloco).toContain('desligada');
        expect(planejarBlocoEconomia({ pacotes: [], nivel: 'leve' }, desligado.envio, semRtk).bloco).toBe('');
    });

    test('rtk sem o executável é ignorado', () => {
        expect(planejarBlocoEconomia({ pacotes: ['rtk'], nivel: 'completo' }, undefined, semRtk).bloco).toBe('');
        expect(estimarEconomia({ pacotes: ['rtk'], nivel: 'completo' }, { rtk: true })).toBe(20);
    });

    test('economias se compõem', () => {
        expect(estimarEconomia({ pacotes: ['caveman', 'codigoEnxuto'], nivel: 'completo' }, semRtk)).toBe(34);
    });
});
