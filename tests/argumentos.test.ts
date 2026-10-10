import { describe, expect, test } from 'bun:test';
import {
    interpretarArgumentos,
    interpretarPreviaArgumentos,
    tentarInterpretarArgumentos,
} from '../electron/services/argumentos';

describe('Argumentos de ferramenta', () => {
    test('mostra conteúdo progressivo sem aceitar o fragmento para execução', () => {
        const completo = JSON.stringify({ caminho: 'prospeccao.txt', conteudo: 'Clientes:\n"João" C:\\Fotos' });
        for (let tamanho = 1; tamanho < completo.length; tamanho += 1) {
            const fragmento = completo.slice(0, tamanho);
            const previa = interpretarPreviaArgumentos(fragmento);
            if (typeof previa.conteudo === 'string') {
                expect('Clientes:\n"João" C:\\Fotos'.startsWith(previa.conteudo)).toBe(true);
            }
            expect(tentarInterpretarArgumentos(fragmento)).toBeNull();
        }
        expect(interpretarPreviaArgumentos('{"caminho":"a.txt","conteudo":"Clientes:\\nJo')).toEqual({
            caminho: 'a.txt',
            conteudo: 'Clientes:\nJo',
        });
        expect(interpretarPreviaArgumentos(completo)).toEqual(JSON.parse(completo));
    });
    test('aguarda escapes Unicode completos e não confunde conteúdo com campos', () => {
        expect(interpretarPreviaArgumentos('{"conteudo":"Ol\\u00')).toEqual({ conteudo: 'Ol' });
        expect(interpretarPreviaArgumentos('{"conteudo":"Ol\\u00e1')).toEqual({ conteudo: 'Olá' });
        expect(interpretarPreviaArgumentos('{"conteudo":"{\\"caminho\\":\\"falso')).toEqual({
            conteudo: '{"caminho":"falso',
        });
    });
    test('aceita JSON válido, vazio e cercas de Markdown', () => {
        expect(interpretarArgumentos('{"caminho":"a.txt"}')).toEqual({ caminho: 'a.txt' });
        expect(interpretarArgumentos('')).toEqual({});
        expect(interpretarArgumentos('```json\n{"caminho":"a.txt"}\n```')).toEqual({ caminho: 'a.txt' });
    });
    test('repara chaves sem aspas, aspas simples, vírgula final e literais Python', () => {
        expect(
            interpretarArgumentos(
                `{caminho: 'C:\\\\Users\\\\levig\\\\Downloads\\\\poema.txt', conteudo: "A lua:\\nbrilha", rascunho: True,}`,
            ),
        ).toEqual({
            caminho: 'C:\\Users\\levig\\Downloads\\poema.txt',
            conteudo: 'A lua:\nbrilha',
            rascunho: true,
        });
    });
    test('preserva barras invertidas inválidas como caminho Windows e não quebra o conteúdo', () => {
        expect(interpretarArgumentos('{caminho: "C:\\Users\\levig\\Downloads\\poema.txt"}')).toEqual({
            caminho: 'C:\\Users\\levig\\Downloads\\poema.txt',
        });
        expect(
            interpretarArgumentos('{caminho: "poema.txt", conteudo: "verso: a lua, {nao_e_chave: 1}"}'),
        ).toEqual({
            caminho: 'poema.txt',
            conteudo: 'verso: a lua, {nao_e_chave: 1}',
        });
    });
    test('não interpreta fragmento incompleto e rejeita texto sem objeto', () => {
        expect(tentarInterpretarArgumentos('{')).toBeNull();
        expect(tentarInterpretarArgumentos('{caminho')).toBeNull();
        expect(() => interpretarArgumentos('não é json')).toThrow('JSON de objeto válido');
    });
});
