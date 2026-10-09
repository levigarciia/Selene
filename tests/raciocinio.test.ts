import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Agente } from '../electron/services/agente';
import { esquemaAlteracao, esquemaConfiguracao, esquemaConversa, type Modelo } from '../shared/contratos';
import { niveisRaciocinio, resolverNivelRaciocinio } from '../shared/raciocinio';

const qwen: Modelo = {
    id: randomUUID(),
    nome: 'Qwen3.5 4B',
    caminho: 'D:/modelos/qwen.gguf',
    tamanho: 1,
    catalogoId: 'qwen3.5-4b-q4',
};

test('oferece somente níveis compatíveis e resolve a escolha ao trocar o modelo', () => {
    const llama = { ...qwen, catalogoId: 'llama-3.2-1b-q4', nome: 'Llama', caminho: 'llama.gguf' };
    const deepseek = { ...qwen, catalogoId: 'deepseek-r1-1.5b-q4' };
    expect(niveisRaciocinio(llama)).toEqual([]);
    expect(niveisRaciocinio(undefined)).toEqual([]);
    expect(niveisRaciocinio({ ...llama, catalogoId: undefined, nome: 'Modelo desconhecido' })).toEqual([]);
    expect(niveisRaciocinio({ ...qwen, catalogoId: undefined, nome: 'Qwen3 8B' })).toContain('alto');
    expect(niveisRaciocinio(deepseek)).not.toContain('desativado');
    expect(resolverNivelRaciocinio(deepseek, 'desativado')).toBe('medio');
    expect(resolverNivelRaciocinio(llama, 'alto')).toBe('desativado');
});

test('valida níveis na fronteira IPC e preserva conversas antigas', () => {
    expect(esquemaAlteracao.safeParse({ nivelRaciocinio: 'inexistente' }).success).toBe(false);
    expect(esquemaAlteracao.parse({ nivelRaciocinio: 'alto' }).nivelRaciocinio).toBe('alto');
    expect(
        esquemaConversa.parse({
            id: randomUUID(),
            titulo: 'Antiga',
            modo: 'chat',
            atualizadoEm: new Date().toISOString(),
        }).nivelRaciocinio,
    ).toBeUndefined();
});

test('envia o nível persistido ao motor e reserva tokens para a resposta final', async () => {
    const orcamentos: number[] = [];
    for (const nivel of ['desativado', 'baixo', 'medio', 'alto'] as const) {
        const conversa = esquemaConversa.parse({
            id: randomUUID(),
            titulo: 'Teste',
            modo: 'chat',
            atualizadoEm: new Date().toISOString(),
            modeloId: qwen.id,
            nivelRaciocinio: nivel,
        });
        const publicacoes: string[] = [];
        const agente = new Agente({
            salvar: async () => {},
            publicar: (mensagem) => {
                if (mensagem.faseGeracao === 'raciocinando') publicacoes.push(mensagem.raciocinio ?? '');
            },
            completar: async (corpo) => {
                const pedido = corpo as {
                    reasoning_budget_tokens: number;
                    max_tokens: number;
                    chat_template_kwargs: { enable_thinking: boolean };
                };
                expect(pedido.chat_template_kwargs.enable_thinking).toBe(nivel !== 'desativado');
                expect(pedido.reasoning_budget_tokens).toBeLessThan(pedido.max_tokens);
                orcamentos.push(pedido.reasoning_budget_tokens);
                return new Response(
                    [
                        'data: {"choices":[{"delta":{"reasoning_content":"Analisando"},"finish_reason":null}]}',
                        'data: {"choices":[{"delta":{"content":"Resposta final"},"finish_reason":"stop"}]}',
                        'data: [DONE]',
                    ].join('\n\n') + '\n\n',
                );
            },
        });
        await agente.executar(conversa, 'Pergunta', esquemaConfiguracao.parse({}), [], qwen);
        expect(publicacoes).toContain('Analisando');
        expect(conversa.mensagens.at(-1)?.raciocinio).toBe('Analisando');
        expect(conversa.mensagens.at(-1)?.faseGeracao).toBeUndefined();
        expect(conversa.mensagens.at(-1)?.texto).toBe('Resposta final');
        expect(conversa.mensagens.at(-1)?.estado).toBe('concluida');
    }
    expect(orcamentos[0]).toBe(0);
    expect(orcamentos[1]).toBeGreaterThan(orcamentos[0]);
    expect(orcamentos[2]).toBeGreaterThan(orcamentos[1]);
    expect(orcamentos[3]).toBeGreaterThan(orcamentos[2]);
});

test('cancelar durante o raciocínio interrompe o envio e preserva o nível escolhido', async () => {
    const conversa = esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Cancelamento',
        modo: 'chat',
        atualizadoEm: new Date().toISOString(),
        modeloId: qwen.id,
        nivelRaciocinio: 'alto',
    });
    const agente = new Agente({
        salvar: async () => {},
        publicar: () => {},
        completar: async (_corpo, sinal) => {
            agente.cancelar();
            sinal.throwIfAborted();
            throw new Error('O cancelamento deve encerrar o pedido.');
        },
    });
    await agente.executar(conversa, 'Pergunta', esquemaConfiguracao.parse({}), [], qwen);
    expect(conversa.mensagens.at(-1)?.estado).toBe('interrompida');
    expect(conversa.nivelRaciocinio).toBe('alto');
    expect(agente.conversaId).toBeNull();
});
