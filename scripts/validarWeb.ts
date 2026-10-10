import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import type { ComandoNavegador } from '../shared/web';
import type { Navegador } from '../electron/services/navegador';

const servidor = createServer((pedido, resposta) => {
    if (pedido.url === '/lenta') return;
    resposta.setHeader('Content-Type', 'text/html; charset=utf-8');
    resposta.end(`<html><title>Teste de navegador</title><main>
        <h1>Fonte de teste</h1><label>Nome <input aria-label="Nome"></label>
        <button onclick="if(event.isTrusted) document.getElementById('resultado').textContent='Enviado: '+document.querySelector('input').value">
        Enviar</button><p id="resultado"></p><a href="/outra">Outra página</a>
        <script>document.body.dataset.node=typeof require</script></main></html>`);
});
await new Promise<void>((resolver) => servidor.listen(0, '127.0.0.1', resolver));
const endereco = servidor.address();
assert(endereco && typeof endereco !== 'string');
const url = `http://127.0.0.1:${endereco.port}/`;
const ambiente = Object.fromEntries(Object.entries(process.env).filter((item): item is [string, string] => !!item[1]));
delete ambiente.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'),
    args: [resolve('artifacts/navegador.cjs')],
    env: ambiente,
});
type Ambiente = typeof globalThis & { navegadorValidacao: Navegador };
const executar = (id: string, comando: ComandoNavegador) =>
    app.evaluate(
        async (_electron, { id, comando }) =>
            (globalThis as Ambiente).navegadorValidacao.preparar(id, comando).executar(new AbortController().signal),
        { id, comando },
    );
try {
    const primeira = JSON.parse(await executar('primeira', { acao: 'abrir', url: `${url}?primeira` }));
    assert(primeira.texto.includes('Fonte de teste'));
    const ref = (estado: typeof primeira, nome: string) =>
        estado.referencias.find((item: string) => item.includes(nome)).split(':')[0];
    const preenchida = JSON.parse(
        await executar('primeira', {
            acao: 'preencher',
            referencia: ref(primeira, 'Nome'),
            texto: 'Selene',
        }),
    );
    const clicada = JSON.parse(
        await executar('primeira', {
            acao: 'clicar',
            referencia: ref(preenchida, 'Enviar'),
        }),
    );
    assert(clicada.texto.includes('Enviado: Selene'));
    await assert.rejects(
        executar('primeira', {
            acao: 'clicar',
            referencia: ref(primeira, 'Enviar'),
        }),
        /referência não pertence/,
    );
    await assert.rejects(
        executar('primeira', {
            acao: 'clicar',
            observacao: primeira.observacao,
            referencia: ref(primeira, 'Enviar'),
        }),
        /desatualizada/,
    );
    await executar('segunda', { acao: 'abrir', url });
    await assert.rejects(executar('segunda', { acao: 'fechar', observacao: clicada.observacao }), /desatualizada/);
    const paginas = app.windows().filter((pagina) => pagina.url().startsWith(url));
    assert.equal(paginas.length, 2);
    const janelasVisiveis = await app.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((janela) => janela.isVisible()).length,
    );
    assert.equal(janelasVisiveis, 0);
    const previas = await app.evaluate(() => (globalThis as Ambiente).navegadorValidacao.listarPrevias());
    assert.equal(previas.length, 2);
    assert(previas.every((previa) => previa.imagem?.startsWith('data:image/jpeg;base64,')));
    assert.equal(await paginas[0].evaluate(() => document.body.dataset.node), 'undefined');
    await paginas[0].screenshot({ path: 'artifacts/selene-navegador.png' });
    const alteracao = await app.evaluate(async ({ BrowserWindow }) => {
        const navegador = (globalThis as Ambiente).navegadorValidacao;
        const estado = JSON.parse(
            await navegador.preparar('primeira', { acao: 'observar' }).executar(new AbortController().signal),
        );
        const comando = {
            acao: 'clicar' as const,
            observacao: estado.observacao,
            referencia: estado.referencias.find((item: string) => item.includes('Enviar')).split(':')[0],
        };
        const preparada = navegador.preparar('primeira', comando);
        const janela = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('?primeira'))!;
        await janela.webContents.executeJavaScript("document.querySelector('button').textContent='Mudou'");
        try {
            await preparada.executar(new AbortController().signal);
            return 'executada';
        } catch (erro) {
            return (erro as Error).message;
        }
    });
    assert.match(alteracao, /elemento mudou/);
    const aprovacaoDesatualizada = await app.evaluate(async () => {
        const navegador = (globalThis as Ambiente).navegadorValidacao;
        const observar = () =>
            navegador.preparar('segunda', { acao: 'observar' }).executar(new AbortController().signal);
        const estado = JSON.parse(await observar());
        const preparada = navegador.preparar('segunda', {
            acao: 'clicar',
            referencia: estado.referencias.find((item: string) => item.includes('Enviar')).split(':')[0],
        });
        await observar();
        try {
            await preparada.executar(new AbortController().signal);
            return 'executada';
        } catch (erro) {
            return (erro as Error).message;
        }
    });
    assert.match(aprovacaoDesatualizada, /mudou|desatualizada/);
    const cancelada = await app.evaluate(async (_electron, url) => {
        const controle = new AbortController();
        setTimeout(() => controle.abort(), 100);
        try {
            await (globalThis as Ambiente).navegadorValidacao
                .preparar('cancelada', {
                    acao: 'abrir',
                    url: `${url}lenta`,
                })
                .executar(controle.signal);
            return 'executada';
        } catch (erro) {
            return (erro as Error).message;
        }
    }, url);
    assert.match(cancelada, /interrompido/);
    await executar('cancelada', { acao: 'abrir', url });
    const antesDeFechar = JSON.parse(await executar('cancelada', { acao: 'observar' }));
    await executar('cancelada', { acao: 'fechar', observacao: antesDeFechar.observacao });
    await executar('cancelada', { acao: 'abrir', url });
    const pesquisa = await app.evaluate(async () => {
        try {
            return await (globalThis as Ambiente).navegadorValidacao.pesquisar(
                'Electron BrowserWindow documentation',
                new AbortController().signal,
            );
        } catch (erro) {
            return JSON.stringify({ erro: (erro as Error).message });
        }
    });
    const resultado = JSON.parse(pesquisa);
    console.log(
        JSON.stringify(
            {
                navegador: 'validado',
                mecanismo: resultado.mecanismo,
                fontes: resultado.resultados?.length,
                erro: resultado.erro,
            },
            null,
            4,
        ),
    );
    assert(resultado.resultados?.length, resultado.erro);
    const fonte = await app.evaluate(async () =>
        (globalThis as Ambiente).navegadorValidacao.ler(
            'https://www.electronjs.org/docs/latest/api/browser-window',
            new AbortController().signal,
        ),
    );
    assert(JSON.parse(fonte).texto.includes('BrowserWindow'));
} finally {
    await app.close();
    servidor.closeAllConnections();
    await new Promise<void>((resolver) => servidor.close(() => resolver()));
}
