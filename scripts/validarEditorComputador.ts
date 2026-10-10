import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { ControladorComputador } from '../electron/services/controladorComputador';

const ambiente = Object.fromEntries(
    Object.entries(process.env).filter((item): item is [string, string] => typeof item[1] === 'string'),
);
delete ambiente.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'),
    args: [resolve('artifacts/editorComputador.cjs')],
    env: ambiente,
});
const controlador = new ControladorComputador();
try {
    const pagina = await app.firstWindow();
    await pagina.getByRole('textbox', { name: 'Mensagem de validação' }).waitFor();
    const janela = await app.evaluate(({ BrowserWindow }) => {
        const janela = BrowserWindow.getAllWindows()[0];
        janela.focus();
        return String(janela.getNativeWindowHandle().readUInt32LE(0));
    });
    const sinal = new AbortController().signal;
    const observacao = await controlador.executar({ acao: 'observar', janela }, sinal);
    const campo = observacao.elementos.find((item) => item.editavel && item.nome === 'Mensagem de validação');
    assert.ok(campo, 'A árvore extensa deve preservar o editor Chromium.');
    const texto = 'Olá, teste {real} + ^ %';
    const preenchida = await controlador.executar({
        acao: 'digitar', observacao: observacao.observacao, referencia: campo.referencia, texto,
    }, sinal);
    assert.equal(await pagina.getByRole('textbox').innerText(), texto);
    assert.equal(await pagina.locator('#envios').innerText(), '0');
    const campoAtual = preenchida.elementos.find((item) => item.editavel && item.nome === campo.nome);
    assert.ok(campoAtual);
    assert.equal(campoAtual.valor, texto);
    const enviada = await controlador.executar({
        acao: 'pressionar', observacao: preenchida.observacao, referencia: campoAtual.referencia, tecla: 'Enter',
    }, sinal);
    assert.equal(await pagina.locator('#envios').innerText(), '1');
    assert.equal(await pagina.locator('#mensagem').innerText(), texto);
    assert.equal(await pagina.getByRole('textbox').innerText(), '');
    assert.equal(enviada.elementos.find((item) => item.editavel && item.nome === campo.nome)?.valor, '');
    console.log('Editor Chromium: campo preservado, texto Unicode e Enter recebidos em ações separadas.');
} finally {
    controlador.encerrar();
    await app.close();
}
