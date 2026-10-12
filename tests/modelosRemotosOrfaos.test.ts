import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { esquemaDados } from '../shared/contratos';
import { removerModelosRemotosOrfaos } from '../electron/services/persistencia';

const dadosBase = (modelos: unknown[], conversas: unknown[] = []) =>
    esquemaDados.parse({ versao: 1, configuracao: {}, modelos, conversas });

test('remove entrada remota antiga sem vínculo OpenRouter e aponta conversas para o cadastro equivalente', () => {
    const orfaoId = randomUUID();
    const cadastroId = randomUUID();
    const conversaId = randomUUID();
    const dados = dadosBase(
        [
            { id: orfaoId, nome: 'Gemma (free)', caminho: 'google/gemma-4-26b-a4b-it:free', tamanho: 0 },
            {
                id: cadastroId,
                nome: 'Gemma (free)',
                caminho: 'google/gemma-4-26b-a4b-it:free',
                tamanho: 0,
                openrouter: { id: 'google/gemma-4-26b-a4b-it:free', contexto: 1000, imagens: false, ferramentas: true, raciocinio: false },
            },
        ],
        [{ id: conversaId, titulo: 'Teste', modeloId: orfaoId, modo: 'chat', mensagens: [], criadaEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() }],
    );

    expect(removerModelosRemotosOrfaos(dados)).toBe(true);
    expect(dados.modelos.map((modelo) => modelo.id)).toEqual([cadastroId]);
    expect(dados.conversas[0]!.modeloId).toBe(cadastroId);
});

test('zera a conversa quando a entrada órfã não tem cadastro OpenRouter equivalente', () => {
    const orfaoId = randomUUID();
    const dados = dadosBase(
        [{ id: orfaoId, nome: 'Modelo remoto', caminho: 'teste/remoto:free', tamanho: 0 }],
        [{ id: randomUUID(), titulo: 'Teste', modeloId: orfaoId, modo: 'chat', mensagens: [], criadaEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() }],
    );

    expect(removerModelosRemotosOrfaos(dados)).toBe(true);
    expect(dados.modelos).toEqual([]);
    expect(dados.conversas[0]!.modeloId).toBeNull();
});

test('preserva modelos locais, de catálogo, de assinatura e OpenRouter', () => {
    const modelos = [
        { id: randomUUID(), nome: 'Importado', caminho: 'C:/modelos/a.gguf', tamanho: 1024 },
        { id: randomUUID(), nome: 'Catálogo', caminho: 'C:/modelos/b.gguf', tamanho: 0, catalogoId: 'qwen3.5-9b-q4' },
        { id: randomUUID(), nome: 'Assinatura', caminho: 'chatgpt:x', tamanho: 0, assinatura: { provedor: 'chatgpt', id: 'gpt-5' } },
        {
            id: randomUUID(),
            nome: 'OpenRouter',
            caminho: 'openai/gpt-5',
            tamanho: 0,
            openrouter: { id: 'openai/gpt-5', contexto: 1000, imagens: false, ferramentas: true, raciocinio: false },
        },
    ];
    const dados = dadosBase(modelos);

    expect(removerModelosRemotosOrfaos(dados)).toBe(false);
    expect(dados.modelos).toHaveLength(4);
});
