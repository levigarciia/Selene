import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { _electron, type ElectronApplication, type Page } from 'playwright';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts/chatgpt', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'chatgpt-web-'));
const env = Object.fromEntries(
    Object.entries({ ...process.env, SELENE_TESTE: '1', SELENE_TESTE_DADOS: pasta }).filter(
        (entrada): entrada is [string, string] => typeof entrada[1] === 'string',
    ),
);
delete env.ELECTRON_RUN_AS_NODE;
delete env.SELENE_VITE_URL;
const htmlOriginal = await readFile(resolve('scripts/fixtures/paginaChatGpt.html'), 'utf8');
const html =
    process.env.SELENE_TESTE_CHATGPT_MODERNO === '1'
        ? htmlOriginal.replace('<html lang="pt-BR">', '<html lang="pt-BR" data-chatgpt-teste-moderno>')
        : htmlOriginal;
async function abrir() {
    const app = await _electron.launch({
        executablePath: process.env.SELENE_TESTE_EXECUTAVEL ?? resolve('node_modules/electron/dist/electron.exe'),
        args: process.env.SELENE_TESTE_EXECUTAVEL ? [] : ['.'],
        env,
    });
    await app.evaluate(async ({ session }, pagina) => {
        session
            .fromPartition('persist:selene-chatgpt-web')
            .protocol.handle(
                'https',
                () => new Response(pagina, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
            );
    }, html);
    return app;
}
async function aguardarConversa(pagina: Page, condicao: (estado: Awaited<ReturnType<typeof estadoAtual>>) => boolean) {
    for (let tentativa = 0; tentativa < 250; tentativa++) {
        const estado = await estadoAtual(pagina);
        if (condicao(estado)) return estado;
        await esperar(100);
    }
    throw new Error('A conversa não atingiu o estado esperado.');
}
async function estadoAtual(pagina: Page) {
    const estado = await pagina.evaluate(() => window.selene!.estado());
    assert(estado.ok, estado.ok ? '' : estado.erro);
    return estado.valor;
}
async function paginaRemota(app: ElectronApplication) {
    for (let tentativa = 0; tentativa < 100; tentativa++) {
        const pagina = app.windows().find((item) => item.url().startsWith('https://chatgpt.com'));
        if (pagina) return pagina;
        await esperar(100);
    }
    throw new Error('A janela isolada não abriu.');
}
let app = await abrir();
try {
    let pagina = await app.firstWindow();
    pagina.setDefaultTimeout(20000);
    await pagina.getByRole('button', { name: 'Modelo da conversa', exact: true }).click();
    await pagina.getByRole('dialog').getByRole('button', { name: 'ChatGPT', exact: true }).click();
    await pagina.getByRole('button', { name: 'Conectar conta', exact: true }).click();
    const remoto = await paginaRemota(app);
    assert.deepEqual(
        await remoto.evaluate(() => ({
            ponte: typeof window.selene,
            node: typeof (window as unknown as { require?: unknown }).require,
        })),
        { ponte: 'undefined', node: 'undefined' },
    );
    const preferencias = await app.evaluate(({ BrowserWindow }) => {
        const janela = BrowserWindow.getAllWindows().find((item) =>
            item.webContents.getURL().startsWith('https://chatgpt.com'),
        )!;
        const conteudo = janela.webContents as typeof janela.webContents & {
            getLastWebPreferences(): {
                sandbox?: boolean;
                contextIsolation?: boolean;
                nodeIntegration?: boolean;
                preload?: string;
            };
        };
        const preferencias = conteudo.getLastWebPreferences();
        return {
            sandbox: preferencias.sandbox,
            isolamento: preferencias.contextIsolation,
            node: preferencias.nodeIntegration,
            preload: preferencias.preload ?? '',
        };
    });
    assert.deepEqual(preferencias, { sandbox: true, isolamento: true, node: false, preload: '' });
    await pagina.getByRole('button', { name: 'Usar ChatGPT', exact: true }).click();
    const enviar = async (texto: string) => {
        await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).fill(texto);
        await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    };
    await remoto.evaluate(() => {
        const botao = document.createElement('button');
        botao.id = 'login-teste';
        botao.textContent = 'Entrar';
        document.body.append(botao);
    });
    await enviar('Mensagem antes do login');
    await aguardarConversa(
        pagina,
        (estado) =>
            !estado.conversaEmExecucao &&
            estado.conversas.some((item) => item.mensagens.at(-1)?.texto.includes('após o login')),
    );
    assert.equal(await remoto.evaluate(() => (window as unknown as { enviosTeste: number }).enviosTeste), 0);
    await remoto.evaluate(() => document.getElementById('login-teste')!.remove());
    await enviar('Olá, ChatGPT');
    let estado = await aguardarConversa(
        pagina,
        (estado) =>
            !estado.conversaEmExecucao &&
            estado.conversas.some((item) => item.mensagens.at(-1)?.texto === 'Resposta de teste 1'),
    );
    const conversa = estado.conversas.find((item) => item.chatgptWeb?.url)!;
    assert(conversa);
    assert.equal(conversa.chatgptWeb?.url, 'https://chatgpt.com/c/conversa-teste');
    assert.deepEqual(conversa.mensagens.at(-1)?.acoes, []);
    assert.equal(await pagina.getByRole('button', { name: 'Anexar arquivos', exact: true }).isDisabled(), true);
    await pagina.setViewportSize({ width: 420, height: 900 });
    assert(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await pagina.screenshot({ path: resolve('artifacts/chatgpt/conversaCompacta.png') });
    await pagina.setViewportSize({ width: 1280, height: 840 });
    await enviar('Continue a conversa');
    await aguardarConversa(
        pagina,
        (estado) =>
            !estado.conversaEmExecucao &&
            estado.conversas.find((item) => item.id === conversa.id)?.mensagens.at(-1)?.texto === 'Resposta de teste 2',
    );
    assert.equal(await remoto.evaluate(() => (window as unknown as { enviosTeste: number }).enviosTeste), 2);
    await remoto.getByRole('textbox', { name: 'Mensagem no site', exact: true }).fill('Rascunho escrito no site');
    await enviar('Não sobrescreva o rascunho');
    await aguardarConversa(
        pagina,
        (estado) =>
            !estado.conversaEmExecucao &&
            estado.conversas.find((item) => item.id === conversa.id)?.mensagens.at(-1)?.estado === 'erro',
    );
    assert.equal(
        await remoto.getByRole('textbox', { name: 'Mensagem no site', exact: true }).innerText(),
        'Rascunho escrito no site',
    );
    assert.equal(await remoto.evaluate(() => (window as unknown as { enviosTeste: number }).enviosTeste), 2);
    await remoto.evaluate(() => {
        const editor = document.getElementById('prompt-textarea')!;
        const novo = document.createElement('textarea');
        novo.setAttribute('data-mobile-composer-prompt', '');
        novo.setAttribute('aria-label', 'Mensagem no site');
        editor.replaceWith(novo);
    });
    await enviar('Faça uma geração longa');
    await aguardarConversa(
        pagina,
        (estado) =>
            estado.conversas.find((item) => item.id === conversa.id)?.mensagens.at(-1)?.texto === 'Resposta parcial',
    );
    await pagina.getByRole('button', { name: 'Interromper tarefa', exact: true }).click();
    estado = await aguardarConversa(pagina, (estado) => !estado.conversaEmExecucao);
    assert.equal(estado.conversas.find((item) => item.id === conversa.id)?.mensagens.at(-1)?.estado, 'interrompida');
    assert.equal(await remoto.evaluate(() => (window as unknown as { cancelouTeste: boolean }).cancelouTeste), true);
    await enviar('Enviar sem confirmação');
    estado = await aguardarConversa(
        pagina,
        (estado) =>
            !estado.conversaEmExecucao &&
            !!estado.conversas.find((item) => item.id === conversa.id)?.chatgptWeb?.envioIncerto,
    );
    assert.equal(await remoto.evaluate(() => (window as unknown as { enviosTeste: number }).enviosTeste), 4);
    await pagina.getByRole('button', { name: 'Conferi o envio no site', exact: true }).click();
    await aguardarConversa(
        pagina,
        (estado) => !estado.conversas.find((item) => item.id === conversa.id)?.chatgptWeb?.envioIncerto,
    );
    const preservado = await readFile(resolve(pasta, 'selene.json'), 'utf8');
    assert(preservado.includes('https://chatgpt.com/c/conversa-teste'));
    await app.close();
    app = await abrir();
    pagina = await app.firstWindow();
    const reaberto = await estadoAtual(pagina);
    assert.equal(
        reaberto.conversas.find((item) => item.id === conversa.id)?.chatgptWeb?.url,
        'https://chatgpt.com/c/conversa-teste',
    );
    const retomada = await pagina.evaluate(
        (id) => window.selene!.enviar(id, 'Continue após reiniciar', []),
        conversa.id,
    );
    assert(retomada.ok, retomada.ok ? '' : retomada.erro);
    await aguardarConversa(
        pagina,
        (estado) =>
            !estado.conversaEmExecucao &&
            estado.conversas.find((item) => item.id === conversa.id)?.mensagens.at(-1)?.texto === 'Resposta de teste 4',
    );
    const siteRetomado = await paginaRemota(app);
    assert.equal(siteRetomado.url(), 'https://chatgpt.com/c/conversa-teste');
    assert.equal(
        await siteRetomado.evaluate(() => (window as unknown as { ultimoTextoTeste: string }).ultimoTextoTeste),
        'Continue após reiniciar',
    );
    const invalido = await pagina.evaluate(async (modeloId) => {
        const nova = await window.selene!.novaConversa('code');
        if (!nova.ok) return nova;
        await window.selene!.alterarConversa(nova.valor.id, { modeloId });
        return window.selene!.enviar(nova.valor.id, 'Não pode executar no Code', []);
    }, conversa.modeloId!);
    assert.equal(invalido.ok, false);
    const cargaLocal = await pagina.evaluate((modeloId) => window.selene!.carregarModelo(modeloId), conversa.modeloId!);
    assert.equal(cargaLocal.ok, false);
    assert(!cargaLocal.ok && cargaLocal.erro.includes('Modelo remoto'));
    await writeFile(
        resolve('artifacts/chatgpt/desktop.json'),
        JSON.stringify(
            {
                isolamento: preferencias,
                envio: true,
                continuidade: true,
                cancelamento: true,
                envioIncerto: true,
                persistencia: true,
                bloqueioCode: true,
            },
            null,
            4,
        ),
    );
    console.log(
        'ChatGPT no Electron: envio, continuidade, cancelamento, confirmação, persistência e isolamento validados.',
    );
} finally {
    await app.close();
}
