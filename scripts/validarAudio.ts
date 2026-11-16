import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { esquemaDados } from '../shared/contratos';

const raiz = join(process.env.APPDATA!, 'Selene');
const arquivo = resolve(process.env.SELENE_TESTE_AUDIO ?? 'artifacts/audio/voz.wav');
await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts/audio', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'audio-'));
const modeloId = randomUUID();
const conversaId = randomUUID();
await writeFile(join(pasta, 'selene.json'), JSON.stringify(esquemaDados.parse({
    versao: 1,
    configuracao: { backend: 'auto', limitesAutomaticos: false, contexto: 4096, camadasGpu: 999,
        maxTokens: 256, temperatura: 0 },
    modelos: [{ id: modeloId, nome: 'LFM3 Omni 2B', catalogoId: 'lfm3-omni-2b-q4',
        caminho: join(raiz, 'models', 'lfm3-omni-2b-q4.gguf'), tamanho: 1099630080,
        projetorVisual: join(raiz, 'models', 'lfm3-omni-2b-q4.mmproj.gguf') }],
    conversas: [{ id: conversaId, titulo: 'Validação de áudio', modo: 'chat', modeloId,
        atualizadoEm: new Date().toISOString(), mensagens: [{
            id: randomUUID(), papel: 'user', texto: 'Olá', estado: 'concluida', acoes: [],
            criadoEm: new Date().toISOString(),
        }] }],
})));
await symlink(join(raiz, 'runtime'), join(pasta, 'runtime'), 'junction');
const ambiente: Record<string, string> = Object.fromEntries(Object.entries({
    ...process.env, SELENE_TESTE: '1', SELENE_TESTE_DADOS: pasta,
}).filter((entrada): entrada is [string, string] => typeof entrada[1] === 'string'));
delete ambiente.ELECTRON_RUN_AS_NODE;
delete ambiente.SELENE_VITE_URL;
if (process.env.SELENE_TESTE_URL) ambiente.SELENE_VITE_URL = process.env.SELENE_TESTE_URL;
const testarMicrofone = process.env.SELENE_TESTE_MICROFONE === '1';
const testarPergunta = process.env.SELENE_TESTE_PERGUNTA === '1';
const argumentos = testarMicrofone ? ['--use-fake-device-for-media-stream', '.'] : ['.'];
let aplicativo: ElectronApplication | undefined;
try {
    aplicativo = await electron.launch({ executablePath: resolve('node_modules/electron/dist/electron.exe'),
        args: argumentos, env: ambiente });
    let pagina = await aplicativo.firstWindow();
    pagina.setDefaultTimeout(30000);
    pagina.on('pageerror', (erro) => console.error(erro.message));
    console.log('Abrindo conversa de teste.');
    await pagina.getByText('Validação de áudio', { exact: true }).first().click();
    const formulario = pagina.locator('form:visible');
    if (testarMicrofone) {
        await pagina.evaluate((dados) => {
            const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            navigator.mediaDevices.getUserMedia = async (restricoes) => {
                const dispositivo = await original(restricoes);
                dispositivo.getTracks().forEach((trilha) => trilha.stop());
                const contexto = new AudioContext();
                const bytes = Uint8Array.from(atob(dados), (letra) => letra.charCodeAt(0));
                const fonte = contexto.createBufferSource();
                fonte.buffer = await contexto.decodeAudioData(bytes.buffer);
                const destino = contexto.createMediaStreamDestination();
                fonte.connect(destino);
                await contexto.resume();
                fonte.start();
                const fluxo = destino.stream;
                const teste = window as typeof window & { fluxoTeste?: MediaStream };
                teste.fluxoTeste = fluxo;
                return fluxo;
            };
        }, (await readFile(arquivo)).toString('base64'));
        await formulario.getByRole('button', { name: 'Gravar áudio', exact: true }).click();
        await formulario.getByRole('button', { name: 'Concluir gravação', exact: true }).waitFor();
        await pagina.getByRole('button', { name: 'Code', exact: true }).click();
        await pagina.waitForFunction(() => {
            const teste = window as typeof window & { fluxoTeste?: MediaStream };
            return teste.fluxoTeste?.getTracks().every((trilha) => trilha.readyState === 'ended');
        });
        await pagina.getByRole('button', { name: 'Chat', exact: true }).click();
        await formulario.getByRole('button', { name: 'Gravar áudio', exact: true }).click();
        await formulario.getByRole('button', { name: 'Concluir gravação', exact: true }).waitFor();
        await pagina.screenshot({ path: 'artifacts/audio/gravando.png' });
        await esperar(4000);
        await formulario.getByRole('button', { name: 'Concluir gravação', exact: true }).click();
    } else {
        await formulario.getByLabel('Selecionar anexos').setInputFiles(arquivo);
    }
    await pagina.locator('[data-ui="previa-audio"]').waitFor();
    await pagina.waitForFunction(() => Array.from(document.querySelectorAll('audio'))
        .some((audio) => audio.readyState >= 1 && audio.duration > 0));
    if (testarMicrofone) {
        assert(await pagina.evaluate(() => {
            const teste = window as typeof window & { fluxoTeste?: MediaStream };
            return teste.fluxoTeste?.getTracks().every((trilha) => trilha.readyState === 'ended');
        }));
    }
    console.log('Áudio normalizado e importado.');
    if (!testarPergunta) {
        await formulario.getByLabel('Mensagem', { exact: true }).fill('Transcribe the audio in English.');
    }
    await formulario.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    for (let tentativa = 0; tentativa < 180; tentativa++) {
        const resultado = await pagina.evaluate(() => window.selene!.estado());
        const conversa = resultado.ok && resultado.valor.conversas.find((item) => item.id === conversaId);
        if (resultado.ok && !resultado.valor.conversaEmExecucao && conversa &&
            conversa.mensagens.at(-1)?.papel === 'assistant') break;
        await esperar(1000);
    }
    const estado = await pagina.evaluate(() => window.selene!.estado());
    assert(estado.ok);
    assert.equal(estado.valor.motor.backendAtivo, 'vulkan');
    assert.match(estado.valor.motor.dispositivo ?? '', /RX 7700 XT/);
    const conversa = estado.valor.conversas.find((item) => item.id === conversaId)!;
    assert.equal(conversa.mensagens.at(-1)?.estado, 'concluida', conversa.mensagens.at(-1)?.texto ?? 'Sem resposta.');
    assert.match(conversa.mensagens.at(-1)!.texto, testarPergunta ? /\b2\b|\bdois\b/i : /seven|7/i);
    assert(conversa.mensagens.some((mensagem) => mensagem.imagens?.[0].mime === 'audio/wav'));
    await pagina.screenshot({ path: 'artifacts/audio/conversa.png' });
    await aplicativo.close();
    aplicativo = await electron.launch({ executablePath: resolve('node_modules/electron/dist/electron.exe'),
        args: argumentos, env: ambiente });
    pagina = await aplicativo.firstWindow();
    await pagina.getByText('Validação de áudio', { exact: true }).first().click();
    await pagina.locator('audio[src^="data:audio/wav"]').waitFor();
    await pagina.waitForFunction(() => Array.from(document.querySelectorAll('audio'))
        .some((audio) => audio.readyState >= 1 && audio.duration > 0));
    await pagina.locator('audio').first().evaluate(async (audio: HTMLAudioElement) => {
        audio.muted = true;
        await audio.play();
    });
    await pagina.waitForFunction(() => Array.from(document.querySelectorAll('audio'))
        .some((audio) => audio.currentTime > 0));
    await pagina.locator('audio').first().evaluate((audio: HTMLAudioElement) => audio.pause());
    console.log(testarMicrofone
        ? `Gravação, descarte ao trocar de modo, liberação do microfone, ` +
            `${testarPergunta ? 'resposta ao pedido falado' : 'transcrição'} e reprodução validados.`
        : 'Áudio enviado pela interface, transcrito pelo LFM3 Omni e reaberto após reiniciar.');
} catch (erro) {
    const pagina = aplicativo?.windows()[0];
    await pagina?.screenshot({ path: 'artifacts/audio/falha.png' });
    console.error((await pagina?.locator('body').innerText())?.slice(-2000));
    throw erro;
} finally {
    await aplicativo?.close();
}
