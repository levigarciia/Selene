import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { esquemaDados } from '../shared/contratos';
import type { Navegador } from '../electron/services/navegador';

await mkdir('.teste-dados', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'navegador-inline-'));
const id = randomUUID();
const idChat = randomUUID();
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [],
    conversas: [
        {
            id,
            titulo: 'Navegador na conversa',
            modo: 'code',
            atualizadoEm: new Date().toISOString(),
            mensagens: [
                {
                    id: randomUUID(),
                    papel: 'assistant',
                    texto: 'Página aberta na conversa.',
                    estado: 'gerando',
                    criadoEm: new Date().toISOString(),
                    acoes: [
                        {
                            id: randomUUID(),
                            nome: 'controlar_navegador',
                            argumentos: { acao: 'abrir' },
                            estado: 'concluida',
                            resultado: 'Página aberta.',
                        },
                    ],
                },
            ],
        },
    ],
});
dados.conversas.push({
    ...dados.conversas[0],
    id: idChat,
    titulo: 'Pesquisa no Chat',
    modo: 'chat',
    mensagens: [
        {
            ...dados.conversas[0].mensagens[0],
            id: randomUUID(),
            acoes: [
                {
                    id: randomUUID(),
                    nome: 'ler_pagina_web',
                    argumentos: { url: 'https://example.org/' },
                    estado: 'concluida',
                    resultado: 'Fonte pública.',
                },
            ],
        },
    ],
});
const arquivo = resolve(pasta, 'selene.json');
await writeFile(arquivo, JSON.stringify(dados));
const servidor = createServer((_pedido, resposta) => {
    resposta.setHeader('Content-Type', 'text/html; charset=utf-8');
    resposta.end(
        '<html><title>Página inline</title><body style="background:#14251f;color:white"><h1>Chromium dentro da conversa</h1><button>Continuar</button></body></html>',
    );
});
await new Promise<void>((resolver) => servidor.listen(0, '127.0.0.1', resolver));
const endereco = servidor.address();
assert(endereco && typeof endereco !== 'string');
const url = `http://127.0.0.1:${endereco.port}/`;
const ambiente = Object.fromEntries(Object.entries(process.env).filter((item): item is [string, string] => !!item[1]));
delete ambiente.ELECTRON_RUN_AS_NODE;
ambiente.SELENE_TESTE_INLINE = arquivo;
const app = await electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'),
    args: [resolve('artifacts/navegador.cjs')],
    env: ambiente,
});
type Ambiente = typeof globalThis & { navegadorValidacao: Navegador };
try {
    const pagina = await app.firstWindow();
    pagina.setDefaultTimeout(15000);
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('button', { name: 'Navegador na conversa', exact: true }).click();
    await app.evaluate(
        async (_electron, { id, url }) => {
            await (globalThis as Ambiente).navegadorValidacao
                .preparar(id, { acao: 'abrir', url })
                .executar(new AbortController().signal);
        },
        { id, url },
    );
    const painel = pagina.locator('[data-ui="navegador-inline"]:visible');
    const imagem = painel.locator('img');
    await imagem.waitFor();
    assert.equal(await painel.count(), 1);
    assert(await imagem.evaluate((elemento: HTMLImageElement) => elemento.complete && elemento.naturalWidth > 0));
    await painel.getByRole('button', { name: 'Recolher navegador' }).click();
    assert.equal(await imagem.count(), 0);
    await painel.getByRole('button', { name: 'Mostrar navegador' }).click();
    await painel.getByRole('button', { name: 'Ampliar navegador' }).click();
    await painel.getByRole('button', { name: 'Reduzir navegador' }).waitFor();
    const anterior = await imagem.getAttribute('src');
    await app.evaluate(async ({ BrowserWindow }, url) => {
        const janela = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL() === url)!;
        await janela.webContents.executeJavaScript(
            "document.body.style.background='#513020';document.querySelector('h1').textContent='Página atualizada'",
        );
    }, url);
    await pagina.waitForFunction(
        (anterior) => document.querySelector('[data-ui="pagina-navegador"]')?.getAttribute('src') !== anterior,
        anterior,
    );
    await painel.getByRole('button', { name: 'Atualizar visualização do navegador' }).click();
    assert.equal(
        await app.evaluate(
            ({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((item) => item.isVisible()).length,
        ),
        1,
    );
    await pagina.screenshot({ path: 'artifacts/selene-navegador-inline.png' });
    const previasAntes = await app.evaluate(() => (globalThis as Ambiente).navegadorValidacao.listarPrevias());
    await app.evaluate(async (_electron, id) => {
        await Promise.allSettled([
            (globalThis as Ambiente).navegadorValidacao.pesquisar(
                'Electron BrowserWindow documentation', new AbortController().signal, id,
            ),
            (globalThis as Ambiente).navegadorValidacao.ler(
                'https://example.org/', new AbortController().signal, id,
            ),
        ]);
    }, id);
    const previasDepois = await app.evaluate(() => (globalThis as Ambiente).navegadorValidacao.listarPrevias());
    assert.deepEqual(previasDepois.map((previa) => previa.origem), previasAntes.map((previa) => previa.origem));
    assert((await painel.innerText()).includes(url));
    await pagina.setViewportSize({ width: 420, height: 850 });
    assert(await painel.evaluate((elemento) => elemento.getBoundingClientRect().width <= 420));
    const atual = await pagina.evaluate(() => window.selene!.estado());
    assert(atual.ok);
    const estado = atual.valor;
    for (const situacao of ['concluida', 'interrompida', 'erro'] as const) {
        estado.conversas[0].mensagens[0].estado = situacao;
        estado.conversaEmExecucao = null;
        await app.evaluate(({ BrowserWindow }, estado) => {
            BrowserWindow.getAllWindows().find((janela) => janela.isVisible())!
                .webContents.send('selene:evento', { tipo: 'estado', estado });
        }, estado);
        await painel.waitFor({ state: 'detached' });
        assert.equal(await painel.count(), 0);
    }
    await pagina.setViewportSize({ width: 1200, height: 900 });
    await pagina.getByRole('button', { name: 'Chat', exact: true }).click();
    await pagina.getByRole('button', { name: 'Pesquisa no Chat', exact: true }).click();
    await app.evaluate(async (_electron, idChat) => {
        await (globalThis as Ambiente).navegadorValidacao.ler(
            'https://example.org/', new AbortController().signal, idChat,
        );
    }, idChat);
    assert.equal(await painel.count(), 0);
    assert.equal(await app.evaluate(() => (globalThis as Ambiente).navegadorValidacao.listarPrevias()
        .some((previa) => previa.origem !== 'navegador')), false);
    assert.deepEqual(erros, []);
    console.log('Prévia exclusiva do navegador validada no Electron, oculta após concluir, cancelar ou falhar.');
} finally {
    await app.close();
    servidor.closeAllConnections();
    await new Promise<void>((resolver) => servidor.close(() => resolver()));
}
