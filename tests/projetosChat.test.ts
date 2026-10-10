import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { esquemaConversa, esquemaDados, type Conversa } from '../shared/contratos';
import { esquemaProjetoChat } from '../shared/projetosChat';
import { ProjetosChat, contextoProjetoChat, lerArquivoProjetoChat } from '../electron/services/projetosChat';
import { Agente } from '../electron/services/agente';

const conversa = (modo: 'chat' | 'code' = 'chat'): Conversa =>
    esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Conversa',
        modo,
        atualizadoEm: new Date().toISOString(),
    });
const dadosNovos = () => esquemaDados.parse({ versao: 1, configuracao: { contexto: 32768 }, conversas: [], modelos: [] });

test('cadastros antigos abrem sem projetos de Chat e projetos novos não criam pastas Code', async () => {
    const dados = dadosNovos();
    const gerenciador = new ProjetosChat(
        dados,
        async () => {},
        () => null,
    );
    const projeto = await gerenciador.criar('Estudos');
    expect(dados.projetos).toHaveLength(0);
    expect(projeto.arquivos).toHaveLength(0);
    expect(esquemaDados.parse(JSON.parse(JSON.stringify(dados))).projetosChat[0].nome).toBe('Estudos');
    expect(() => esquemaProjetoChat.parse({ ...projeto, nome: ' ' })).toThrow();
});

test('mover exige modo Chat, preserva mensagens e limpar o projeto mantém as conversas', async () => {
    const dados = dadosNovos();
    const gerenciador = new ProjetosChat(
        dados,
        async () => {},
        () => null,
    );
    const projeto = await gerenciador.criar('Estudos');
    const chat = conversa();
    chat.contextoCompactado = { resumo: 'Referência antiga', ateMensagemId: randomUUID(), criadoEm: '' };
    dados.conversas.push(chat);
    await expect(gerenciador.mover(conversa('code'), projeto.id)).rejects.toThrow('Somente conversas Chat');
    await expect(gerenciador.mover(chat, randomUUID())).rejects.toThrow('não encontrado');
    await gerenciador.mover(chat, projeto.id);
    expect(dados.conversas[0].projetoChatId).toBe(projeto.id);
    expect(dados.conversas[0].contextoCompactado).toBeUndefined();
    await gerenciador.remover(projeto.id);
    expect(dados.projetosChat).toHaveLength(0);
    expect(dados.conversas).toHaveLength(1);
    expect(dados.conversas[0].projetoChatId).toBeNull();
});

test('recusa alterações durante a geração e restaura o cadastro quando salvar falha', async () => {
    const dados = dadosNovos();
    const gerenciador = new ProjetosChat(
        dados,
        async () => {},
        () => dados.conversas[0]?.id ?? null,
    );
    const projeto = await gerenciador.criar('Estudos');
    dados.conversas.push({ ...conversa(), projetoChatId: projeto.id });
    await expect(gerenciador.remover(projeto.id)).rejects.toThrow('Interrompa');
    await expect(gerenciador.mover(dados.conversas[0], null)).rejects.toThrow('Interrompa');
    const falha = new ProjetosChat(
        dados,
        async () => {
            throw new Error('Falha ao salvar');
        },
        () => null,
    );
    await expect(falha.remover(projeto.id)).rejects.toThrow('Falha ao salvar');
    expect(dados.projetosChat[0].id).toBe(projeto.id);
    expect(dados.conversas[0].projetoChatId).toBe(projeto.id);
});

test('arquivos são cópias textuais limitadas e um lote inválido não altera as referências', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-chat-'));
    const arquivo = join(pasta, 'referencia.md');
    await writeFile(arquivo, 'Conteúdo confirmado');
    const dados = dadosNovos();
    const gerenciador = new ProjetosChat(
        dados,
        async () => {},
        () => null,
    );
    const projeto = await gerenciador.criar('Referências');
    await gerenciador.importar(projeto.id, [arquivo]);
    expect(dados.projetosChat[0].arquivos[0].texto).toBe('Conteúdo confirmado');
    await writeFile(join(pasta, 'grande.txt'), 'x'.repeat(20001));
    await expect(gerenciador.importar(projeto.id, [arquivo, join(pasta, 'grande.txt')])).rejects.toThrow();
    expect(dados.projetosChat[0].arquivos).toHaveLength(1);
    await writeFile(join(pasta, 'binario.txt'), Buffer.from([255, 0, 128]));
    await expect(lerArquivoProjetoChat(join(pasta, 'binario.txt'))).rejects.toThrow();
    await expect(lerArquivoProjetoChat(join(pasta, 'arquivo.pdf'))).rejects.toThrow('Escolha arquivos');
    await gerenciador.removerArquivo(projeto.id, dados.projetosChat[0].arquivos[0].id);
    expect(await readFile(arquivo, 'utf8')).toBe('Conteúdo confirmado');
});

test('operações simultâneas continuam sequenciais e uma falha não apaga o cadastro seguinte', async () => {
    const dados = dadosNovos();
    let quantidade = 0;
    const gerenciador = new ProjetosChat(
        dados,
        async () => {
            if (++quantidade === 1) throw new Error('Falha controlada');
        },
        () => null,
    );
    const resultados = await Promise.allSettled([gerenciador.criar('Primeiro'), gerenciador.criar('Segundo')]);
    expect(resultados[0].status).toBe('rejected');
    expect(resultados[1].status).toBe('fulfilled');
    expect(dados.projetosChat.map((item) => item.nome)).toEqual(['Segundo']);
});

test('o modelo recebe instruções e referências isoladas do projeto, sem ferramentas de Code', async () => {
    const dados = dadosNovos();
    const gerenciador = new ProjetosChat(
        dados,
        async () => {},
        () => null,
    );
    const projeto = await gerenciador.criar('Estudos');
    await gerenciador.editar(projeto.id, { nome: projeto.nome, instrucao: 'Seja meu tutor.', memoria: true });
    const atual = {
        ...conversa(),
        projetoChatId: projeto.id,
        mensagens: [
            {
                id: randomUUID(),
                papel: 'user' as const,
                texto: 'Início da conversa',
                estado: 'concluida' as const,
                criadoEm: new Date().toISOString(),
                acoes: [],
            },
        ],
    };
    dados.projetosChat[0].arquivos = [{ id: randomUUID(), nome: 'referencia.txt', texto: 'Referência compartilhada' }];
    const outra = {
        ...conversa(),
        projetoChatId: projeto.id,
        mensagens: [
            {
                id: randomUUID(),
                papel: 'assistant' as const,
                texto: 'Tema compartilhado',
                estado: 'concluida' as const,
                criadoEm: new Date().toISOString(),
                acoes: [],
            },
        ],
    };
    dados.conversas.push(atual, outra, {
        ...outra,
        id: randomUUID(),
        projetoChatId: randomUUID(),
        mensagens: [{ ...outra.mensagens[0], texto: 'Dado de outro projeto' }],
    });
    const agente = new Agente({
        salvar: async () => {},
        publicar: () => {},
        contextoProjetoChat: (chat) => contextoProjetoChat(dados, chat),
        completar: async (corpo) => {
            const pedido = corpo as { messages: { role: string; content: string }[]; tools?: unknown };
            expect(pedido.messages[0].content).toStartWith('Seja meu tutor.');
            expect(JSON.stringify(pedido)).toContain('Tema compartilhado');
            expect(JSON.stringify(pedido)).toContain('Referência compartilhada');
            expect(JSON.stringify(pedido)).not.toContain('Dado de outro projeto');
            expect(pedido.tools).toBeUndefined();
            return new Response('data: {"choices":[{"delta":{"content":"Resposta"},"finish_reason":"stop"}]}\n\n');
        },
    });
    await agente.executar(atual, 'Pergunta', dados.configuracao);
    expect(atual.mensagens.at(-1)?.estado).toBe('concluida');
    await gerenciador.editar(projeto.id, { nome: projeto.nome, instrucao: '', memoria: false });
    expect(contextoProjetoChat(dados, atual)?.referencias).toContain('Referência compartilhada');
    expect(contextoProjetoChat(dados, atual)?.referencias).not.toContain('Tema compartilhado');
    expect(contextoProjetoChat(dados, { ...atual, modo: 'code' })).toBeNull();
    expect(contextoProjetoChat(dados, conversa())).toBeNull();
});
