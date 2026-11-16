import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { _electron } from 'playwright';
import { observarPaginaChatGpt } from '../electron/services/paginaChatGpt';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts/chatgpt', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'chatgpt-real-'));
const env = Object.fromEntries(
    Object.entries({ ...process.env, SELENE_TESTE: '1', SELENE_TESTE_DADOS: pasta }).filter(
        (entrada): entrada is [string, string] => typeof entrada[1] === 'string',
    ),
);
delete env.ELECTRON_RUN_AS_NODE;
delete env.SELENE_VITE_URL;
const app = await _electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'),
    args: ['.'],
    env,
});
try {
    const principal = await app.firstWindow();
    const resultado = await principal.evaluate(() => window.selene!.abrirChatGptWeb());
    assert(resultado.ok, resultado.ok ? '' : resultado.erro);
    let remota = app.windows().find((pagina) => pagina.url().startsWith('https://chatgpt.com'));
    for (let tentativa = 0; tentativa < 30 && !remota; tentativa++) {
        await esperar(200);
        remota = app.windows().find((pagina) => pagina.url().startsWith('https://chatgpt.com'));
    }
    assert(remota, 'A janela do site precisa abrir.');
    await remota.waitForLoadState('domcontentloaded');
    await esperar(1500);
    const estado = await remota.evaluate(() => ({
        titulo: document.title,
        origem: location.origin,
        editor: !!document.querySelector('#prompt-textarea'),
        login: !!document.querySelector('[data-testid="login-button"], a[href^="/auth/login"]'),
        ponte: typeof window.selene,
        node: typeof (window as unknown as { require?: unknown }).require,
        campos: [...document.querySelectorAll('[contenteditable], textarea')].map((elemento) => ({
            tag: elemento.tagName,
            id: elemento.id,
            papel: elemento.getAttribute('role'),
            atributos: [...elemento.attributes]
                .filter((atributo) => atributo.name.startsWith('data-'))
                .map((atributo) => atributo.name),
        })),
        botoes: [...document.querySelectorAll('button')]
            .map((botao) => ({
                texto: botao.innerText.trim().slice(0, 50),
                rotulo: botao.getAttribute('aria-label'),
                teste: botao.getAttribute('data-testid'),
                tipo: botao.getAttribute('type'),
            }))
            .filter(
                (botao) =>
                    /entrar|log in|send|enviar/i.test(botao.texto + ' ' + botao.rotulo) ||
                    botao.teste ||
                    botao.tipo === 'submit',
            ),
        formulario: !!document.querySelector('form[data-chatgpt-composer]'),
    }));
    const observacao = await remota.evaluate(observarPaginaChatGpt);
    assert(observacao.login || observacao.editor, 'O adaptador precisa reconhecer o estado atual da página real.');
    Object.assign(estado, {
        loginReconhecido: observacao.login,
        compositorReconhecido: !!observacao.textoEditor || observacao.editor || !!estado.campos.length,
    });
    await writeFile(resolve('artifacts/chatgpt/siteReal.json'), JSON.stringify(estado, null, 4));
    assert.equal(estado.ponte, 'undefined');
    assert.equal(estado.node, 'undefined');
    await remota.screenshot({ path: resolve('artifacts/chatgpt/siteReal.png') });
    console.log(JSON.stringify(estado));
} finally {
    await app.close();
}
