import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Acao, Mensagem } from '../shared/contratos';
import { obterPlano } from '../shared/atividade';
import { TarefasConversa } from '../src/components/TarefasConversa';

const etapas = [
    { descricao: 'Entender a alteração solicitada', estado: 'concluida' as const },
    { descricao: 'Implementar a solução', estado: 'em andamento' as const },
    { descricao: 'Validar o resultado', estado: 'pendente' as const },
];
const plano: Acao = {
    id: 'plano',
    nome: 'atualizar_plano',
    argumentos: { etapas },
    estado: 'concluida',
    resultado: 'Plano registrado.',
};
const escrita: Acao = {
    id: 'escrita',
    nome: 'escrever_arquivo',
    argumentos: { caminho: 'Downloads/poema.txt', conteudo: 'Poema' },
    estado: 'concluida',
    resultado: 'Arquivo salvo.',
};

function criarMensagem(acoes: Acao[], estado: Mensagem['estado'] = 'gerando'): Mensagem {
    return { id: 'resposta', papel: 'assistant', texto: '', criadoEm: '2026-10-09T00:00:00Z', estado, acoes };
}

function renderizar(mensagem?: Mensagem) {
    return renderToStaticMarkup(createElement(TarefasConversa, { mensagem, abrirHistorico: () => {} }));
}

describe('Objetivos da conversa', () => {
    test('ações de ferramentas não criam tarefas', () => {
        expect(renderizar()).toBe('');
        expect(renderizar(criarMensagem([escrita]))).toBe('');
        expect(renderizar(criarMensagem([{ ...escrita, estado: 'aguardando' }]))).toBe('');
    });

    test('mostra somente objetivos e calcula o progresso pelo plano', () => {
        const html = renderizar(criarMensagem([plano, escrita]));
        expect(html).toContain('Implementar a solução');
        expect(html).toContain('1/3');
        expect(html.match(/<li>/g)?.length).toBe(3);
        expect(html).not.toContain('poema.txt');
        expect(html).not.toContain('escrever_arquivo');
    });

    test('atualizações substituem o plano sem somar objetivos antigos ou ações', () => {
        const etapasConcluidas = etapas.map((etapa) => ({ ...etapa, estado: 'concluida' as const }));
        const mensagem = criarMensagem([
            plano,
            escrita,
            { ...plano, id: 'conclusao', argumentos: { etapas: etapasConcluidas } },
        ]);
        expect(obterPlano(mensagem)).toEqual(etapasConcluidas);
        expect(renderizar(mensagem)).toContain('3/3');
        expect(renderizar(mensagem)).toContain('Validar o resultado');
    });

    test('atualizações incompletas, recusadas ou inválidas preservam o último plano válido', () => {
        for (const estado of ['preparando', 'executando', 'erro', 'recusada', 'interrompida'] as const) {
            expect(obterPlano(criarMensagem([plano, { ...plano, id: 'novo', estado }]))).toEqual(etapas);
            expect(renderizar(criarMensagem([{ ...plano, estado }]))).toBe('');
        }
        const invalido = { ...plano, id: 'invalido', argumentos: { etapas: [] } };
        expect(obterPlano(criarMensagem([plano, invalido]))).toEqual(etapas);
        expect(renderizar(criarMensagem([invalido]))).toBe('');
    });

    test('encerra o painel ao terminar a resposta e mantém os objetivos no histórico', () => {
        for (const estado of ['concluida', 'interrompida', 'erro'] as const) {
            const mensagem = criarMensagem([plano, escrita], estado);
            expect(renderizar(mensagem)).toBe('');
            expect(obterPlano(mensagem)).toEqual(etapas);
        }
    });
});
