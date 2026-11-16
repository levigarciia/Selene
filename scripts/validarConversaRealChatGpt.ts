import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { _electron } from 'playwright';

assert(process.env.SELENE_VALIDAR_CONTA_REAL === '1', 'A validação precisa ser solicitada explicitamente.');
const env = Object.fromEntries(
    Object.entries(process.env).filter((entrada): entrada is [string, string] => typeof entrada[1] === 'string'),
);
delete env.ELECTRON_RUN_AS_NODE;
delete env.SELENE_VITE_URL;
delete env.SELENE_TESTE;
delete env.SELENE_TESTE_DADOS;
await mkdir('artifacts/chatgpt', { recursive: true });
const app = await _electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'),
    args: ['.'],
    env,
});
try {
    const pagina = await app.firstWindow();
    const abertura = await pagina.evaluate(() => window.selene!.abrirChatGptWeb());
    assert(abertura.ok, abertura.ok ? '' : abertura.erro);
    const site = app.windows().find((item) => item.url().startsWith('https://chatgpt.com'))!;
    assert(site);
    const editor = site.locator(
        '#prompt-textarea, textarea[data-mobile-composer-prompt], ' +
            'form[data-chatgpt-composer] [contenteditable="true"][role="textbox"]',
    );
    await editor.waitFor({ state: 'visible', timeout: 300000 });
    await esperar(3000);
    const rascunho = await editor.evaluate((elemento) =>
        elemento instanceof HTMLTextAreaElement ? elemento.value : (elemento as HTMLElement).innerText,
    );
    if (rascunho.startsWith('Teste de integração.')) await editor.fill('');
    const id = await pagina.evaluate(async () => {
        const ponte = window.selene!;
        const modelo = await ponte.cadastrarChatGptWeb();
        if (!modelo.ok) throw new Error(modelo.erro);
        const nova = await ponte.novaConversa('chat');
        if (!nova.ok) throw new Error(nova.erro);
        const alteracao = await ponte.alterarConversa(nova.valor.id, {
            modeloId: modelo.valor.id,
            titulo: 'Validação real do ChatGPT',
        });
        if (!alteracao.ok) throw new Error(alteracao.erro);
        return nova.valor.id;
    });
    const respostas: string[] = [];
    let url: string | undefined;
    for (const texto of [
        'Teste de integração. Use o código SELENE7429 apenas nesta conversa, sem salvar na memória. ' +
            'Responda somente: SELENE7429',
        'Qual é o código de teste desta conversa? Responda somente o código, sem salvar na memória.',
    ]) {
        const envio = await pagina.evaluate(({ id, texto }) => window.selene!.enviar(id, texto, []), { id, texto });
        assert(envio.ok, envio.ok ? '' : envio.erro);
        let terminou = false;
        for (let tentativa = 0; tentativa < 600; tentativa++) {
            const resultado = await pagina.evaluate(async (id) => {
                const estado = await window.selene!.estado();
                if (!estado.ok) throw new Error(estado.erro);
                const conversa = estado.valor.conversas.find((item) => item.id === id)!;
                return {
                    ocupada: estado.valor.conversaEmExecucao === id,
                    resposta: conversa.mensagens.at(-1),
                    vinculo: conversa.chatgptWeb,
                };
            }, id);
            if (!resultado.ocupada && resultado.resposta?.papel === 'assistant') {
                assert.equal(resultado.resposta.estado, 'concluida', resultado.resposta.texto);
                assert.match(resultado.resposta.texto, /SELENE7429/);
                assert.deepEqual(resultado.resposta.acoes, []);
                assert(resultado.vinculo?.url);
                assert.equal(resultado.vinculo.envioIncerto, false);
                if (url) assert.equal(resultado.vinculo.url, url);
                url = resultado.vinculo.url;
                respostas.push(resultado.resposta.texto);
                terminou = true;
                break;
            }
            await esperar(500);
        }
        assert(terminou, 'O ChatGPT não concluiu a resposta no prazo.');
    }
    const remoto = app.windows().find((item) => item.url().startsWith('https://chatgpt.com'))!;
    assert(remoto);
    const isolamento = await remoto.evaluate(() => ({
        ponte: typeof window.selene,
        node: typeof (window as unknown as { require?: unknown }).require,
    }));
    assert.deepEqual(isolamento, { ponte: 'undefined', node: 'undefined' });
    await writeFile(
        resolve('artifacts/chatgpt/conversaReal.json'),
        JSON.stringify({ respostas, continuidade: true, ferramentas: 0, isolamento }, null, 4),
    );
    console.log('Conversa autenticada real: dois envios, memória de contexto e isolamento validados.');
} finally {
    await app.close();
}
