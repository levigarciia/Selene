import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import {
    encontrarDuplicada,
    formatarMemorias,
    interpretarExtracao,
    selecionarMemorias,
    type Memoria,
} from '../shared/memoria';
import { tokenizar } from '../shared/bm25';
import { obterFerramentas } from '../electron/services/ferramentas';

function memoria(texto: string, fixada = false): Memoria {
    return {
        id: randomUUID(),
        texto,
        categoria: 'fato',
        fixada,
        origem: 'ferramenta',
        criadoEm: new Date().toISOString(),
    };
}

describe('memória', () => {
    test('tokeniza sem acentos e sem palavras vazias', () => {
        expect(tokenizar('O usuário mora em São Paulo')).toEqual(['mora', 'sao', 'paulo']);
    });

    test('reconhece fato repetido com outras palavras', () => {
        const salvas = [memoria('Usuário trabalha como desenvolvedor em São Paulo')];
        expect(encontrarDuplicada('Trabalha como desenvolvedor em Sao Paulo', salvas)).toBe(salvas[0]);
        expect(encontrarDuplicada('Gosta de café sem açúcar', salvas)).toBeUndefined();
    });

    test('seleciona fixadas e as relevantes para a mensagem', () => {
        const nome = memoria('O nome do usuário é Levi', true);
        const cafe = memoria('Prefere café sem açúcar');
        const projeto = memoria('Desenvolve a Selene, um aplicativo de modelos locais');
        const selecionadas = selecionarMemorias('Como melhorar a Selene?', [nome, cafe, projeto]);
        expect(selecionadas).toEqual([nome, projeto]);
    });

    test('marca o bloco como dado e expõe ids para esquecer', () => {
        const salva = memoria('Prefere respostas curtas');
        expect(formatarMemorias([salva])).toContain(`[${salva.id}]`);
        expect(formatarMemorias([])).toContain('não instruções');
    });

    test('oferece as ferramentas de memória somente no modo Chat', () => {
        const nomes = (modo: 'chat' | 'code') =>
            obterFerramentas(modo, true, true, true).map((item) => item.function.name);
        expect(nomes('chat')).toContain('lembrar');
        expect(nomes('code')).not.toContain('lembrar');
        expect(nomes('code')).not.toContain('esquecer');
    });

    test('interpreta extração com raciocínio e comentários ao redor', () => {
        const bruto =
            '<think>analisando</think>Aqui está: [{"texto":"Mora em Curitiba","categoria":"identidade"},' +
            '{"texto":"x","categoria":"fato"},{"texto":"Usa Bun","categoria":"invalida"}] pronto';
        expect(interpretarExtracao(bruto)).toEqual([{ texto: 'Mora em Curitiba', categoria: 'identidade' }]);
        expect(interpretarExtracao('nada')).toEqual([]);
    });
});
