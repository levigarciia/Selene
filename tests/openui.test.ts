import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import InterfaceOpenUI from '../src/components/InterfaceOpenUI';
import { descreverInterfacesAnteriores, instrucoesOpenUIParaPedido, repeteInterfaceAnterior } from '../shared/openui';

describe('OpenUI', () => {
    test('mantém os valores e a pergunta do histórico sem código nem execução', () => {
        const codigo =
            'Antes\n```openui\nroot = Painel([grafico, pergunta])\n' +
            'grafico = Grafico("Resultados", ["A", "B"], [10, 20])\n' +
            'pergunta = Pergunta("Qual prefere?")\n```\nDepois';
        const descricao = descreverInterfacesAnteriores(codigo);
        expect(descricao).toContain('Gráfico Resultados: A: 10, B: 20.');
        expect(descricao).toContain('Pergunta feita: Qual prefere?');
        expect(descricao).toContain('Antes');
        expect(descricao).toContain('Depois');
        expect(descricao).not.toContain('```');
        expect(descricao).not.toContain('root =');
    });
    test('não envia exemplos de interfaces em respostas a formulários ou pedidos para parar', () => {
        for (const pedido of [
            'PARA',
            'Que isso para de repetir',
            'Qual prefere?\nB',
            'Teste',
            'Não quero interfaces. Quanto é 3 + 3?',
            'Sem gráficos, responda em texto.',
        ]) {
            expect(instrucoesOpenUIParaPedido(pedido)).not.toContain('root = Painel');
        }
        expect(instrucoesOpenUIParaPedido('Mostre um gráfico')).toContain('root = Painel');
        expect(instrucoesOpenUIParaPedido('Quero testar a opneui')).toContain('root = Painel');
    });

    test('identifica cópias entre turnos preservando pedidos explícitos de repetição e novos dados', () => {
        const anterior = '```openui\nroot = Painel([total])\ntotal = Indicador("Pedidos", "42")\n```';
        expect(repeteInterfaceAnterior(anterior, anterior, 'PARA')).toBe(true);
        expect(repeteInterfaceAnterior(anterior, anterior, 'Repita a interface')).toBe(false);
        expect(repeteInterfaceAnterior(anterior.replace('42', '43'), anterior, 'Atualize os pedidos')).toBe(false);
        expect(repeteInterfaceAnterior('Certo, parei.', anterior, 'PARA')).toBe(false);
    });
    test('renderiza componentes definidos pela Selene', () => {
        const codigo =
            'root = Painel([titulo, grafico, pergunta])\n' +
            'titulo = Texto("Comparação")\n' +
            'grafico = Grafico("Resultados", ["A", "B"], [10, 20])\n' +
            'pergunta = Pergunta("Qual opção prefere?")';
        const html = renderToString(createElement(InterfaceOpenUI, { codigo, gerando: false }));
        expect(html).toContain('Comparação');
        expect(html).toContain('Resultados');
        expect(html).toContain('Qual opção prefere?');
    });
});
