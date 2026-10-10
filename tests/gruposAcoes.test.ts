import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { agruparAtividade, resumirAcoes } from '../shared/atividade';
import type { Acao, Mensagem } from '../shared/contratos';

function acao(nome = 'pesquisar_web', estado: Acao['estado'] = 'concluida', posicaoTexto = 6): Acao {
    return { id: randomUUID(), nome, estado, posicaoTexto, argumentos: {}, resultado: '' };
}

function mensagem(acoes: Acao[], texto = 'Antes.Depois.'): Mensagem {
    return {
        id: randomUUID(),
        papel: 'assistant',
        estado: 'gerando',
        texto,
        acoes,
        criadoEm: new Date().toISOString(),
    };
}

test('recolhe cada sequência assim que chega texto posterior durante a geração', () => {
    const acoes = [acao(), acao(), acao('ler_pagina_web', 'concluida', 13)];
    const blocos = agruparAtividade(mensagem(acoes));
    expect(blocos.map((bloco) => bloco.tipo)).toEqual(['texto', 'grupo', 'texto', 'acao']);
    expect(blocos[1]).toEqual({ tipo: 'grupo', acoes: acoes.slice(0, 2) });
    expect(agruparAtividade(mensagem(acoes.slice(0, 2), 'Antes.')).map((bloco) => bloco.tipo)).toEqual([
        'texto',
        'acao',
        'acao',
    ]);
});

test('não esconde aprovação, execução, falha ou ação isolada', () => {
    for (const estado of ['preparando', 'executando', 'aguardando', 'erro', 'interrompida', 'recusada'] as const) {
        expect(
            agruparAtividade(mensagem([acao(), acao('escrever_arquivo', estado)])).some(
                (bloco) => bloco.tipo === 'grupo',
            ),
        ).toBe(false);
    }
    expect(agruparAtividade(mensagem([acao()])).map((bloco) => bloco.tipo)).toEqual(['texto', 'acao', 'texto']);
});

test('mantém grupos separados por texto e não recolhe apenas por espaços posteriores', () => {
    const acoes = [acao(), acao(), acao('ler_pagina_web', 'concluida', 13), acao('ler_pagina_web', 'concluida', 13)];
    expect(agruparAtividade(mensagem(acoes, 'Antes.Depois.Final.')).map((bloco) => bloco.tipo)).toEqual([
        'texto',
        'grupo',
        'texto',
        'grupo',
        'texto',
    ]);
    expect(agruparAtividade(mensagem([acao(), acao()], 'Antes.\n\n')).map((bloco) => bloco.tipo)).toEqual([
        'texto',
        'acao',
        'acao',
        'texto',
    ]);
});

test('resume quantidades e conta arquivos distintos em vez de operações de escrita', () => {
    const escrever = { ...acao('escrever_arquivo'), argumentos: { caminho: 'a.txt' } };
    const editar = { ...acao('editar_arquivo'), argumentos: { caminho: 'a.txt' } };
    expect(resumirAcoes([acao('executar_terminal'), escrever, editar, acao('ler_arquivo')])).toBe(
        'Executou 1 comando, alterou 1 arquivo e realizou 1 outra ação',
    );
    expect(resumirAcoes([acao(), acao(), acao(), acao('ler_pagina_web')])).toBe('Fez 3 pesquisas e leu 1 página');
});
