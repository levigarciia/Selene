import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { z } from 'zod';
import { AcessoWeb } from '../electron/services/acessoWeb';
import { Operacoes } from '../electron/services/operacoes';

test('acesso web autentica, valida operações, transmite eventos e revoga sessões', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-acesso-'));
    const interfaceWeb = join(pasta, 'dist');
    await mkdir(interfaceWeb);
    await writeFile(join(interfaceWeb, 'index.html'), '<main>Selene</main>');
    await writeFile(join(pasta, 'privado.js'), 'segredo');
    const reserva = createServer();
    await new Promise<void>((resolve) => reserva.listen(0, '127.0.0.1', resolve));
    const porta = (reserva.address() as { port: number }).port;
    await new Promise<void>((resolve) => reserva.close(() => resolve()));
    const operacoes = new Operacoes();
    operacoes.registrar('eco', z.tuple([z.string()]), ([texto]) => texto);
    operacoes.registrar('projeto', z.tuple([z.string(), z.string().nullable()]), () => true);
    const servidor = new AcessoWeb(join(pasta, 'acessoWeb.json'), interfaceWeb, operacoes, () => ({
        tipo: 'erro',
        erro: 'Estado inicial de teste',
    }));
    const origem = `http://127.0.0.1:${porta}`;
    const controlador = new AbortController();
    const pedir = (caminho: string, body?: unknown, cookie?: string, origin = origem) =>
        fetch(origem + caminho, {
            method: body === undefined ? 'GET' : 'POST',
            headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    try {
        await servidor.configurar({ ativo: true, porta });
        expect(servidor.estado.exigirChave).toBe(true);
        expect(await (await pedir('/')).text()).toContain('Selene');
        expect((await pedir('/api/operacao', { nome: 'eco', argumentos: ['texto'] })).status).toBe(401);
        expect((await pedir('/api/entrar', { chave: 'incorreta' })).status).toBe(401);
        expect(
            (await pedir('/api/entrar', { chave: servidor.estado.chave }, undefined, 'https://outro.site')).status,
        ).toBe(403);
        const entrada = await pedir('/api/entrar', { chave: servidor.estado.chave });
        const cookie = entrada.headers.get('set-cookie')!.split(';')[0];
        expect(entrada.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Strict');
        expect(await (await pedir('/api/operacao', { nome: 'eco', argumentos: ['validado'] }, cookie)).json()).toEqual({
            ok: true,
            valor: 'validado',
        });
        expect((await (await pedir('/api/operacao', { nome: 'eco', argumentos: [42] }, cookie)).json()).ok).toBe(false);
        expect((await pedir('/api/operacao', { nome: 'acessoWeb', argumentos: [] }, cookie)).status).toBe(403);
        expect((await pedir('/api/operacao', { nome: 'projeto', argumentos: ['id'] }, cookie)).status).toBe(403);
        expect((await pedir('/api/operacao', { nome: 'projeto', argumentos: ['id', null] }, cookie)).status).toBe(200);
        expect(
            (await pedir('/api/operacao', { nome: 'adicionarProjeto', argumentos: [{ tipo: 'pasta' }] }, cookie))
                .status,
        ).toBe(403);
        expect((await pedir('/%2e%2e%2fprivado.js')).status).toBe(404);
        expect((await fetch(origem, { headers: { Host: `outro.site:${porta}` } })).status).toBe(403);
        const eventos = await fetch(origem + '/api/eventos', {
            headers: { Cookie: cookie },
            signal: controlador.signal,
        });
        const leitor = eventos.body!.getReader();
        expect(new TextDecoder().decode((await leitor.read()).value)).toContain('Estado inicial');
        servidor.publicar({ tipo: 'erro', erro: 'Evento em tempo real' });
        expect(new TextDecoder().decode((await leitor.read()).value)).toContain('Evento em tempo real');
        const chaveAnterior = servidor.estado.chave;
        servidor.renovarChave();
        expect(servidor.estado.chave).not.toBe(chaveAnterior);
        expect((await pedir('/api/sessao', undefined, cookie)).status).toBe(401);
        expect((await pedir('/api/entrar', { chave: chaveAnterior })).status).toBe(401);
        const novaEntrada = await pedir('/api/entrar', { chave: servidor.estado.chave });
        const novaSessao = novaEntrada.headers.get('set-cookie')!.split(';')[0];
        expect((await pedir('/api/sair', {}, novaSessao)).status).toBe(200);
        expect((await pedir('/api/sessao', undefined, novaSessao)).status).toBe(401);
        expect(JSON.parse(await readFile(join(pasta, 'acessoWeb.json'), 'utf8'))).toEqual({
            ativo: true,
            porta,
            exigirChave: true,
        });
        await servidor.configurar({ ativo: true, porta, exigirChave: false });
        expect(await (await pedir('/api/sessao')).json()).toEqual({ ok: true, exigirChave: false });
        expect(await (await pedir('/api/operacao', { nome: 'eco', argumentos: ['sem chave'] })).json()).toEqual({
            ok: true,
            valor: 'sem chave',
        });
        expect((await pedir('/api/operacao', { nome: 'acessoWeb', argumentos: [] })).status).toBe(403);
        expect(
            (await pedir('/api/operacao', { nome: 'eco', argumentos: ['texto'] }, undefined, 'https://outro.site'))
                .status,
        ).toBe(403);
        const semChave = await fetch(origem + '/api/eventos', { signal: controlador.signal });
        const leitorAberto = semChave.body!.getReader();
        expect(new TextDecoder().decode((await leitorAberto.read()).value)).toContain('Estado inicial');
        servidor.publicar({ tipo: 'erro', erro: 'Evento sem chave' });
        expect(new TextDecoder().decode((await leitorAberto.read()).value)).toContain('Evento sem chave');
        await leitorAberto.cancel();
        expect(JSON.parse(await readFile(join(pasta, 'acessoWeb.json'), 'utf8')).exigirChave).toBe(false);
        await servidor.configurar({ ativo: true, porta, exigirChave: true });
        expect((await pedir('/api/sessao')).status).toBe(401);
        expect((await pedir('/api/operacao', { nome: 'eco', argumentos: ['texto'] })).status).toBe(401);
        await servidor.configurar({ ativo: false, porta });
        expect(servidor.estado.ativo).toBe(false);
    } finally {
        controlador.abort();
        await servidor.encerrar();
        await rm(pasta, { recursive: true, force: true });
    }
});
