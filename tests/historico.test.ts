import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { esquemaAlteracao, esquemaConfiguracao, esquemaConversa, type Conversa } from '../shared/contratos';
import { Agente } from '../electron/services/agente';
import { agruparHistorico, obterAtividadeConversa } from '../shared/historico';

function conversa(projeto = 'D:\\Projetos\\Selene'): Conversa {
    return esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Implementar sidebar',
        modo: 'code',
        projeto,
        atualizadoEm: new Date().toISOString(),
        mensagens: [
            {
                id: randomUUID(),
                papel: 'assistant',
                texto: '',
                estado: 'gerando',
                criadoEm: new Date().toISOString(),
                acoes: [{ id: 'terminal', nome: 'executar_terminal', argumentos: {}, estado: 'preparando' }],
            },
        ],
    });
}

test('renomear ou concluir não introduz valores padrão para modelo e permissão', () => {
    expect(esquemaAlteracao.parse({ titulo: 'Novo título' })).toEqual({ titulo: 'Novo título' });
    expect(esquemaAlteracao.parse({ concluida: true })).toEqual({ concluida: true });
    expect(esquemaAlteracao.parse({ modeloId: null })).toEqual({ modeloId: null });
});

test('categorias vazias não aparecem no histórico', () => {
    expect(agruparHistorico([], 'code', null)).toEqual([]);
    const atual = conversa();
    expect(agruparHistorico([atual], 'code', null).map((grupo) => grupo.chave)).toEqual(['atuais']);
    atual.concluida = true;
    expect(agruparHistorico([atual], 'code', null).map((grupo) => grupo.chave)).toEqual(['concluidas']);
});

test('preparar argumentos não indica comando executando e aprovações têm prioridade', () => {
    const atual = conversa();
    const acao = atual.mensagens[0].acoes[0];
    expect(obterAtividadeConversa(atual, atual.id).fase).toBe('trabalhando');
    acao.estado = 'aguardando';
    expect(obterAtividadeConversa(atual, atual.id).fase).toBe('aprovacao');
    acao.estado = 'executando';
    expect(obterAtividadeConversa(atual, atual.id).fase).toBe('comando');
    acao.estado = 'concluida';
    expect(obterAtividadeConversa(atual, atual.id).fase).toBe('trabalhando');
    atual.mensagens[0].faseContexto = 'compactando';
    expect(obterAtividadeConversa(atual, atual.id).fase).toBe('compactando');
});

test('novo envio retoma conversa encerrada antes de persistir e executar o agente', async () => {
    const atual = conversa();
    atual.projeto = null;
    atual.mensagens = [];
    atual.concluida = true;
    atual.encerradaEm = new Date().toISOString();
    const agente = new Agente({
        completar: async () =>
            new Response(
                [
                    'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Resposta retomada.' } }] }),
                    'data: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
                    'data: [DONE]',
                ].join('\n\n') + '\n\n',
            ),
        publicar: () => {},
        salvar: async () => {
            expect(atual.concluida).toBe(false);
            expect(atual.encerradaEm).toBeUndefined();
        },
    });
    await agente.executar(atual, 'Continue', esquemaConfiguracao.parse({}));
    expect(atual.mensagens.at(-1)?.estado).toBe('concluida');
    expect(agruparHistorico([atual], 'code', null)[0].chave).toBe('atuais');
});

test('conclusão só aparece fora da tarefa ativa e estado antigo não simula execução', () => {
    const atual = conversa();
    expect(obterAtividadeConversa(atual, null).fase).toBe('interrompida');
    atual.mensagens[0].estado = 'concluida';
    expect(obterAtividadeConversa(atual, atual.id).ocupada).toBe(true);
    expect(obterAtividadeConversa(atual, null).fase).toBe('concluida');
    atual.mensagens[0].estado = 'erro';
    expect(obterAtividadeConversa(atual, null).fase).toBe('erro');
});

test('separa modos e agrupa por estado, mantendo aprovação no topo e projetos como metadados', () => {
    const atual = conversa();
    atual.mensagens[0].estado = 'concluida';
    const executando = conversa('D:/Outro/Projeto');
    const encerrada = { ...conversa(), concluida: true };
    const chat = { ...conversa(), modo: 'chat' as const };
    const itens = [atual, executando, encerrada, chat];
    const grupos = agruparHistorico(itens, 'code', executando.id);
    expect(grupos.map((grupo) => grupo.chave)).toEqual(['atuais', 'trabalhando', 'concluidas']);
    expect(grupos[0].itens).toEqual([atual]);
    expect(grupos[1].itens).toEqual([executando]);
    expect(grupos[2].itens).toEqual([encerrada]);
    expect(agruparHistorico(itens, 'chat', executando.id)[0].itens).toEqual([chat]);
    executando.mensagens[0].acoes[0].estado = 'aguardando';
    expect(agruparHistorico(itens, 'code', executando.id)[0].itens[0]).toBe(executando);
    executando.mensagens[0].acoes[0].estado = 'concluida';
    executando.mensagens[0].estado = 'concluida';
    executando.mensagens[0].concluidoEm = '2099-01-01T00:00:00.000Z';
    expect(agruparHistorico(itens, 'code', null)[0].itens[0]).toBe(executando);
});
