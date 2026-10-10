import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agente } from '../electron/services/agente';
import { EnviosCode } from '../electron/services/enviosCode';
import { Persistencia } from '../electron/services/persistencia';
import { esquemaConfiguracao, esquemaConversa } from '../shared/contratos';

function conversa() {
    return esquemaConversa.parse({ id: randomUUID(), titulo: 'Code', modo: 'code', atualizadoEm: '2026-10-10' });
}

function resposta(texto: string, chamada?: { name: string; arguments: string }) {
    return new Response(
        `data: ${JSON.stringify({
            choices: [
                {
                    delta: {
                        content: texto,
                        ...(chamada ? { tool_calls: [{ index: 0, id: randomUUID(), function: chamada }] } : {}),
                    },
                    finish_reason: chamada ? 'tool_calls' : 'stop',
                },
            ],
        })}\n\ndata: [DONE]\n\n`,
    );
}

test('redireciona a mesma resposta após a chamada atual sem consumir a fila', async () => {
    const atual = conversa();
    const envios = new EnviosCode(async () => {});
    let liberar!: () => void;
    let iniciou!: () => void;
    const inicio = new Promise<void>((resolver) => {
        iniciou = resolver;
    });
    const espera = new Promise<void>((resolver) => {
        liberar = resolver;
    });
    const corpos: { messages: { role: string; content: string }[] }[] = [];
    const agente = new Agente({
        salvar: async () => {},
        publicar: () => {},
        receberDirecoes: (conversa) => envios.receberDirecoes(conversa),
        completar: async (corpo) => {
            corpos.push(structuredClone(corpo) as (typeof corpos)[number]);
            if (corpos.length === 1) {
                iniciou();
                await espera;
            }
            return resposta(corpos.length === 1 ? 'Primeiro caminho' : 'Caminho corrigido');
        },
    });
    const execucao = agente.executar(atual, 'Investigue', esquemaConfiguracao.parse({}));
    await inicio;
    const respostaId = atual.mensagens.at(-1)!.id;
    const validar = () => agente.validarDirecao(atual.id, respostaId);
    expect(() => agente.validarDirecao(atual.id, randomUUID())).toThrow('já encerrou');
    await envios.adicionar(atual, 'Depois execute testes', 'fila', validar);
    await envios.adicionar(atual, 'Use Bun', 'direcao', validar);
    liberar();
    await execucao;
    expect(corpos).toHaveLength(2);
    expect(corpos[1].messages.at(-1)).toEqual({ role: 'user', content: 'Use Bun' });
    expect(JSON.stringify(corpos)).not.toContain('Depois execute testes');
    expect(atual.mensagens.filter((item) => item.papel === 'assistant')).toHaveLength(1);
    expect(atual.mensagens.at(-1)?.estado).toBe('concluida');
    expect(atual.enviosPendentes?.map((item) => item.texto)).toEqual(['Depois execute testes']);
    expect(() => validar()).toThrow('já encerrou');
});

test('redirecionamento dispensa aprovação pendente sem escrever arquivo', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-direcao-'));
    try {
        const atual = conversa();
        atual.projeto = pasta;
        const envios = new EnviosCode(async () => {});
        let avisar!: () => void;
        const aprovacao = new Promise<void>((resolver) => {
            avisar = resolver;
        });
        let chamadas = 0;
        const agente = new Agente({
            salvar: async () => {},
            publicar: (mensagem) => {
                if (mensagem.acoes.some((acao) => acao.estado === 'aguardando')) avisar();
            },
            receberDirecoes: (conversa) => envios.receberDirecoes(conversa),
            completar: async () =>
                ++chamadas === 1
                    ? resposta('Vou escrever', {
                          name: 'escrever_arquivo',
                          arguments: JSON.stringify({ caminho: 'teste.txt', conteudo: 'indevido' }),
                      })
                    : resposta('Só fiz a revisão'),
        });
        const execucao = agente.executar(atual, 'Escreva', esquemaConfiguracao.parse({}));
        await aprovacao;
        await envios.adicionar(atual, 'Só revise', 'direcao', () => {
            agente.validarDirecao(atual.id, atual.mensagens.at(-1)!.id);
        });
        agente.reconsiderar();
        await execucao;
        expect(atual.mensagens.at(-1)?.acoes[0].estado).toBe('recusada');
        await expect(readFile(join(pasta, 'teste.txt'))).rejects.toThrow();
        expect(chamadas).toBe(2);
    } finally {
        await rm(pasta, { recursive: true, force: true });
    }
});

test('fila sobrevive à reabertura e falha de gravação desfaz o envio', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-fila-'));
    try {
        const persistencia = new Persistencia(pasta);
        await persistencia.abrir();
        const atual = conversa();
        persistencia.dados.conversas.push(atual);
        const envios = new EnviosCode(() => persistencia.salvar());
        await envios.adicionar(atual, 'Primeiro', 'fila', () => {});
        await envios.adicionar(atual, 'Segundo', 'fila', () => {});
        await envios.adicionar(atual, 'Direção não entregue', 'direcao', () => {});
        const reaberta = new Persistencia(pasta);
        await reaberta.abrir();
        expect(reaberta.dados.conversas[0].enviosPendentes?.map((item) => item.texto)).toEqual([
            'Primeiro',
            'Segundo',
            'Direção não entregue',
        ]);
        expect(reaberta.dados.conversas[0].enviosPendentes?.every((envio) => envio.tipo === 'fila')).toBe(true);
        const falha = new EnviosCode(async () => {
            throw new Error('Disco indisponível');
        });
        await expect(falha.adicionar(atual, 'Perdido', 'direcao', () => {})).rejects.toThrow('Disco');
        expect(atual.enviosPendentes).toHaveLength(3);
        atual.modo = 'chat';
        await expect(envios.adicionar(atual, 'Inválido', 'fila', () => {})).rejects.toThrow('apenas no Code');
    } finally {
        await rm(pasta, { recursive: true, force: true });
    }
});
