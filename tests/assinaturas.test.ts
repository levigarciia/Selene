import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    interpretarCacheCodex,
    interpretarModelosClaude,
    listarModelosAssinatura,
    montarPromptAssinatura,
    primeiraLinha,
    validarModeloAssinatura,
} from '../electron/services/assinaturas';
import { provedoresModelo, modelosAssinatura } from '../shared/assinaturas';

describe('provedores de assinatura', () => {
    test('a Selene oferece exatamente os quatro provedores pedidos', () => {
        expect([...provedoresModelo]).toEqual(['selene', 'openrouter', 'chatgpt', 'claude']);
    });

    test('cada inscrição tem modelos com identificadores válidos', () => {
        for (const modelos of Object.values(modelosAssinatura)) {
            for (const modelo of modelos) expect(() => validarModeloAssinatura(modelo.id)).not.toThrow();
        }
    });
});

describe('descoberta de modelos das inscrições', () => {
    test('lê os modelos visíveis do cache do Codex na ordem do CLI', () => {
        const cache = JSON.stringify({
            models: [
                { slug: 'gpt-b', display_name: 'GPT B', visibility: 'list', priority: 2 },
                { slug: 'oculto', display_name: 'Oculto', visibility: 'hide', priority: 0 },
                { slug: 'gpt-a', display_name: 'GPT A', visibility: 'list', priority: 1 },
                { slug: 'inválido; rm', visibility: 'list', priority: 0 },
            ],
        });
        expect(interpretarCacheCodex(cache)).toEqual([
            { id: 'gpt-a', nome: 'GPT A' },
            { id: 'gpt-b', nome: 'GPT B' },
        ]);
    });

    test('escolhe a versão mais recente de cada família Claude', () => {
        expect(
            interpretarModelosClaude([
                'anthropic/claude-opus-4.8',
                'anthropic/claude-opus-5.5',
                'anthropic/claude-opus-5',
                'anthropic/claude-opus-5.5:batch',
                'anthropic/claude-haiku-4.5',
                'anthropic/claude-sonnet-4.10',
                'anthropic/claude-sonnet-4.9',
                'openai/gpt-6',
            ]),
        ).toEqual([
            { id: 'claude-opus-5-5', nome: 'Claude Opus 5.5' },
            { id: 'claude-sonnet-4-10', nome: 'Claude Sonnet 4.10' },
            { id: 'claude-haiku-4-5', nome: 'Claude Haiku 4.5' },
        ]);
    });

    test('usa a lista padrão quando o Codex não tem cache e o catálogo falha', async () => {
        const modelos = await listarModelosAssinatura(
            () => Promise.reject(new Error('sem rede')),
            join(tmpdir(), `selene-sem-codex-${Date.now()}`),
            async () => [],
        );
        expect(modelos.chatgpt).toEqual(modelosAssinatura.chatgpt);
        expect(modelos.claude.map((modelo) => modelo.id)).toEqual(['opus', 'sonnet', 'haiku']);
    });
});

describe('prompt dos CLIs', () => {
    test('converte mensagens e preserva instrução do sistema e ordem', () => {
        expect(
            montarPromptAssinatura({
                messages: [
                    { role: 'system', content: 'Instrução' },
                    { role: 'user', content: 'Pergunta' },
                ],
            }),
        ).toBe('[system]\nInstrução\n\n[user]\nPergunta');
    });

    test('recusa modelo com caracteres para injeção de argumentos', () => {
        expect(() => validarModeloAssinatura('gpt-5 --dangerously')).toThrow('Identificador de modelo inválido.');
    });
});

describe('primeiraLinha', () => {
    test('ignora vazias e limita o tamanho do resultado', () => {
        expect(primeiraLinha('\n Logged in \n')).toBe('Logged in');
        expect(primeiraLinha('x'.repeat(400))?.length).toBe(160);
    });
});

describe('apresentarFerramentaClaude', () => {
    test('traduz ferramentas do Claude Code para as da Selene', async () => {
        const { apresentarFerramentaClaude } = await import('../electron/services/assinaturas');
        expect(apresentarFerramentaClaude('WebSearch', { query: 'selene' })).toEqual({
            nome: 'pesquisar_web',
            argumentos: { consulta: 'selene' },
        });
        expect(apresentarFerramentaClaude('Bash', { command: 'ls' })?.nome).toBe('executar_terminal');
        expect(apresentarFerramentaClaude('ToolSearch', {})).toBeNull();
        expect(apresentarFerramentaClaude('Outra', { a: 1 })).toEqual({ nome: 'Outra', argumentos: { a: 1 } });
    });
});

describe('apresentarItemCodex', () => {
    test('traduz itens do Codex para as ferramentas da Selene', async () => {
        const { apresentarItemCodex } = await import('../electron/services/codexAppServer');
        expect(apresentarItemCodex({ type: 'commandExecution', command: 'ls' })).toEqual({
            nome: 'executar_terminal',
            argumentos: { comando: 'ls' },
        });
        expect(apresentarItemCodex({ type: 'webSearch', action: { type: 'search', query: 'node' } })).toEqual({
            nome: 'pesquisar_web',
            argumentos: { consulta: 'node' },
        });
        expect(apresentarItemCodex({ type: 'webSearch', action: { type: 'openPage', url: 'https://a.b' } })?.nome).toBe(
            'ler_pagina_web',
        );
        expect(
            apresentarItemCodex({ type: 'fileChange', changes: [{ path: 'a.txt', kind: { type: 'add' }, diff: 'oi' }] })
                ?.nome,
        ).toBe('escrever_arquivo');
        expect(apresentarItemCodex({ type: 'reasoning' })).toBeNull();
    });
});

test('preserva capacidades anunciadas e ignora esforços desconhecidos do Codex', () => {
    const [modelo] = interpretarCacheCodex(
        JSON.stringify({
            models: [
                {
                    slug: 'gpt-teste',
                    visibility: 'list',
                    supported_reasoning_levels: [{ effort: 'low' }, { effort: 'ultra' }, { effort: 'inexistente' }],
                },
            ],
        }),
    );
    expect(modelo.esforcos).toEqual(['low', 'ultra']);
});

test('deduplica aliases do Claude sem inventar esforço para modelos incompatíveis', async () => {
    const { interpretarCapacidadesClaude } = await import('../electron/services/assinaturas');
    const modelos = interpretarCapacidadesClaude([
        {
            value: 'default',
            resolvedModel: 'claude-teste',
            displayName: 'Padrão',
            description: '',
            supportsEffort: true,
            supportedEffortLevels: ['low', 'high'],
        },
        {
            value: 'opus',
            resolvedModel: 'claude-teste',
            displayName: 'Opus',
            description: '',
            supportsEffort: true,
            supportedEffortLevels: ['low', 'high'],
        },
        { value: 'haiku', displayName: 'Haiku', description: '', supportsEffort: false },
    ]);
    expect(modelos).toHaveLength(2);
    expect(modelos[0].aliases).toEqual(['default', 'opus']);
    expect(modelos[0].esforcos).toEqual(['low', 'high']);
    expect(modelos[1].esforcos).toEqual([]);
});

test('transporta mais de quatro imagens sem perder a ordem e recusa áudio de assinatura', async () => {
    const { obterImagensAssinatura } = await import('../electron/services/assinaturas');
    const imagens = Array.from(
        { length: 9 },
        (_, indice) => 'data:image/jpeg;base64,' + Buffer.from(String(indice)).toString('base64'),
    );
    expect(
        obterImagensAssinatura({
            messages: [{ role: 'user', content: imagens.map((url) => ({ type: 'image_url', image_url: { url } })) }],
        }),
    ).toEqual(imagens);
    expect(() => obterImagensAssinatura({ messages: [{ content: [{ type: 'input_audio' }] }] })).toThrow('áudio');
});
