import { afterEach, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { link, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Persistencia } from '../electron/services/persistencia';
import { prepararFerramenta, resolverCaminho } from '../electron/services/ferramentas';
import { Checkpoints } from '../electron/services/checkpoints';
import { executarProcesso } from '../electron/services/processos';
import { isolarConversa } from '../electron/services/projetos';
import { esquemaConversa } from '../shared/contratos';
import { assinaturaCompletar, montarPromptAssinatura, obterImagensAssinatura } from '../electron/services/assinaturas';
import { comBloqueioDados } from '../electron/services/bloqueioDados';

const pastas: string[] = [];
async function pastaTeste() {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-seguranca-'));
    pastas.push(pasta);
    return pasta;
}
afterEach(async () => {
    for (const pasta of pastas.splice(0)) await rm(pasta, { recursive: true, force: true });
});

function conversa(projeto: string) {
    return esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Trabalho',
        modo: 'code',
        projeto,
        atualizadoEm: new Date().toISOString(),
    });
}

test('persistência recusa estado antigo de outra instância sem perder a conversa salva', async () => {
    const pasta = await pastaTeste();
    const primeira = new Persistencia(pasta);
    await primeira.abrir();
    await primeira.salvar();
    const segunda = new Persistencia(pasta);
    await segunda.abrir();
    primeira.dados.conversas.push(conversa(pasta));
    await primeira.salvar();
    await expect(segunda.salvar()).rejects.toThrow('Outra instância');
    const reaberta = new Persistencia(pasta);
    await reaberta.abrir();
    expect(reaberta.dados.conversas).toHaveLength(1);
});

test('persistência recupera cópia válida, preserva corrupção e limita as cópias rotativas', async () => {
    const pasta = await pastaTeste();
    const dados = new Persistencia(pasta);
    await dados.abrir();
    dados.dados.conversas.push(conversa(pasta));
    for (let indice = 0; indice < 6; indice++) await dados.salvar();
    await writeFile(join(pasta, 'selene.json'), '{ corrompido');
    const reaberta = new Persistencia(pasta);
    await reaberta.abrir();
    expect(reaberta.dados.conversas).toHaveLength(1);
    expect(reaberta.avisoRecuperacao).toContain('recuperado');
    const arquivos = await readdir(pasta);
    expect(arquivos.filter((nome) => nome.startsWith('selene.backup.'))).toHaveLength(3);
    const preservado = arquivos.find((nome) => nome.startsWith('selene.corrompido.'))!;
    expect(await readFile(join(pasta, preservado), 'utf8')).toBe('{ corrompido');
    await reaberta.salvar();
});

test('bloqueio recupera processo encerrado e não repete uma operação que falhou com EEXIST', async () => {
    const pasta = await pastaTeste();
    const arquivo = join(pasta, 'dados.lock');
    await writeFile(arquivo, JSON.stringify({ pid: 2147483647, token: 'antigo' }));
    let execucoes = 0;
    await expect(
        comBloqueioDados(arquivo, async () => {
            execucoes++;
            throw Object.assign(new Error('Arquivo já existe'), { code: 'EEXIST' });
        }),
    ).rejects.toThrow('Arquivo já existe');
    expect(execucoes).toBe(1);
    expect(await Bun.file(arquivo).exists()).toBe(false);
});

test('vínculo físico externo é recusado e a prévia do terminal explicita seu alcance', async () => {
    const pasta = await pastaTeste();
    const projeto = join(pasta, 'projeto');
    await mkdir(projeto);
    await writeFile(join(pasta, 'fora.txt'), 'preservado');
    await link(join(pasta, 'fora.txt'), join(projeto, 'vinculo.txt'));
    await expect(resolverCaminho('vinculo.txt', projeto, false)).rejects.toThrow('vínculos físicos');
    const ferramenta = await prepararFerramenta('executar_terminal', { comando: 'Get-Date' }, conversa(projeto));
    expect(ferramenta.aprovacao).toBe(true);
    expect(ferramenta.previa).toContain('fora do projeto');
    expect(await readFile(join(pasta, 'fora.txt'), 'utf8')).toBe('preservado');
});

test('assinaturas preservam ferramentas e anexos e Codex Chat falha antes de iniciar o harness', async () => {
    const imagem = 'data:image/png;base64,AAAA';
    const corpo = {
        messages: [
            { role: 'user', content: [{ type: 'image_url', image_url: { url: imagem } }] },
            { role: 'assistant', content: null, tool_calls: [{ id: 'f1', name: 'ler_arquivo' }] },
            { role: 'tool', tool_call_id: 'f1', content: 'resultado' },
        ],
    };
    expect(obterImagensAssinatura(corpo)).toEqual([imagem]);
    expect(montarPromptAssinatura(corpo)).toContain('tool_calls');
    expect(montarPromptAssinatura(corpo)).toContain('[tool f1]');
    await expect(
        assinaturaCompletar({ provedor: 'chatgpt', id: 'gpt-6.1' }, corpo, new AbortController().signal, {
            modo: 'chat',
        }),
    ).rejects.toThrow('somente no Code');
    expect(() =>
        obterImagensAssinatura({
            messages: [{ content: [{ type: 'image_url', image_url: { url: 'file:///segredo' } }] }],
        }),
    ).toThrow();
});

test('checkpoint restaura arquivos e binários, recusa mudanças posteriores e worktree preserva a origem', async () => {
    const pasta = await pastaTeste();
    const projeto = join(pasta, 'projeto');
    await mkdir(projeto);
    const git = async (...argumentos: string[]) => {
        const resultado = await executarProcesso('git', argumentos, projeto, new AbortController().signal);
        expect(resultado.codigo).toBe(0);
    };
    await git('init');
    await git('config', 'user.name', 'Teste');
    await git('config', 'user.email', 'teste@example.invalid');
    await writeFile(join(projeto, 'original.txt'), 'original');
    await writeFile(join(projeto, 'binario.dat'), Buffer.from([0, 255, 17]));
    await git('add', '.');
    await git('commit', '-m', 'Cria projeto');
    const item = conversa(projeto);
    await isolarConversa(item, pasta);
    await writeFile(join(item.pastaRepositorio!, 'original.txt'), 'isolado');
    expect(await readFile(join(projeto, 'original.txt'), 'utf8')).toBe('original');
    const mensagem = randomUUID();
    const checkpoints = new Checkpoints(join(pasta, 'checkpoints'));
    await checkpoints.capturar(item.id, mensagem, projeto);
    await writeFile(join(projeto, 'original.txt'), 'agente');
    await writeFile(join(projeto, 'novo.txt'), 'novo');
    await rm(join(projeto, 'binario.dat'));
    await checkpoints.concluir(item.id, mensagem);
    const previa = await checkpoints.preparar(item.id, mensagem);
    expect(previa.arquivos).toHaveLength(3);
    await writeFile(join(projeto, 'original.txt'), 'usuário');
    await expect(checkpoints.restaurar(item.id, mensagem, previa.token)).rejects.toThrow('posterior');
    await writeFile(join(projeto, 'original.txt'), 'agente');
    const atualizada = await checkpoints.preparar(item.id, mensagem);
    await checkpoints.restaurar(item.id, mensagem, atualizada.token);
    expect(await readFile(join(projeto, 'original.txt'), 'utf8')).toBe('original');
    expect(await readFile(join(projeto, 'binario.dat'))).toEqual(Buffer.from([0, 255, 17]));
    expect(await Bun.file(join(projeto, 'novo.txt')).exists()).toBe(false);
    await expect(checkpoints.preparar(item.id, mensagem)).rejects.toThrow('já foi restaurado');
    const interrompida = randomUUID();
    await checkpoints.capturar(item.id, interrompida, projeto);
    await writeFile(join(projeto, 'original.txt'), 'interrompido');
    const recuperacao = await checkpoints.preparar(item.id, interrompida);
    expect(recuperacao.interrompido).toBe(true);
    await writeFile(join(projeto, 'aposPrevia.txt'), 'preservar');
    await expect(checkpoints.restaurar(item.id, interrompida, recuperacao.token)).rejects.toThrow('após a prévia');
    expect(await readFile(join(projeto, 'aposPrevia.txt'), 'utf8')).toBe('preservar');
});
