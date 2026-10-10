import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { _electron as electron, chromium } from 'playwright';
import { esquemaDados } from '../shared/contratos';
import type { Computador } from '../electron/services/computador';
import { aplicativoComputador } from './fixtures/aplicativoComputador';
import { encerrarProcesso } from '../electron/services/processos';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'computador-'));
const id = randomUUID();
await writeFile(
    resolve(pasta, 'selene.json'),
    JSON.stringify(
        esquemaDados.parse({
            versao: 1,
            configuracao: {},
            modelos: [],
            conversas: [
                {
                    id,
                    titulo: 'Controle do computador',
                    modo: 'code',
                    atualizadoEm: new Date().toISOString(),
                    mensagens: [
                        {
                            id: randomUUID(),
                            papel: 'assistant',
                            texto: 'Usando aplicativo de validação.',
                            estado: 'gerando',
                            criadoEm: new Date().toISOString(),
                            acoes: [],
                        },
                    ],
                },
            ],
        }),
    ),
);
const reserva = createServer();
await new Promise<void>((resolver) => reserva.listen(0, '127.0.0.1', resolver));
const porta = (reserva.address() as { port: number }).port;
await new Promise<void>((resolver) => reserva.close(() => resolver()));
const aplicativo = spawn(
    'powershell.exe',
    ['-NoProfile', '-Sta', '-EncodedCommand', Buffer.from(aplicativoComputador, 'utf16le').toString('base64')],
    { windowsHide: true },
);
const janelaNativa = await new Promise<string>((resolver, rejeitar) => {
    const tempo = setTimeout(() => rejeitar(new Error('Aplicativo nativo indisponível.')), 15000);
    createInterface({ input: aplicativo.stdout! }).once('line', (linha) => {
        clearTimeout(tempo);
        resolver(linha);
    });
});
const ambiente = Object.fromEntries(
    Object.entries({ ...process.env, SELENE_TESTE_DADOS: pasta, SELENE_TESTE_PORTA: String(porta) }).filter(
        (item): item is [string, string] => typeof item[1] === 'string',
    ),
);
delete ambiente.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'),
    args: [resolve('artifacts/computador.cjs')],
    env: ambiente,
});
app.process().stderr?.on('data', (dados: Buffer) => process.stderr.write(dados));
const navegador = await chromium.launch({ channel: 'chrome', headless: true });
type Ambiente = typeof globalThis & { computadorValidacao: Computador; chaveValidacao: string };
try {
    const desktop = await app.firstWindow();
    desktop.setDefaultTimeout(20000);
    await desktop.getByRole('button', { name: 'Code', exact: true }).click();
    await desktop.getByRole('button', { name: 'Controle do computador', exact: true }).click();
    const chave = await app.evaluate(() => (globalThis as Ambiente).chaveValidacao);
    const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const mobile = await contexto.newPage();
    await mobile.goto(`http://127.0.0.1:${porta}`);
    await mobile.evaluate(async (chave) => {
        const resposta = await fetch('/api/entrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chave }),
        });
        if (!resposta.ok) throw new Error('Autenticação falhou.');
    }, chave);
    await mobile.reload();
    await mobile.getByRole('button', { name: 'Code', exact: true }).click();
    await mobile.getByRole('button', { name: 'Abrir navegação', exact: true }).click();
    await mobile.getByRole('button', { name: 'Controle do computador', exact: true }).click();
    await app.evaluate(async ({ BrowserWindow }, id) => {
        const janela = BrowserWindow.getAllWindows()[0];
        const identificador = String(janela.getNativeWindowHandle().readUInt32LE(0));
        const computador = (globalThis as Ambiente).computadorValidacao;
        const resultado = JSON.parse(
            await computador
                .preparar(id, { acao: 'observar', janela: identificador })
                .executar(new AbortController().signal),
        );
        if (resultado.elementos.length !== 0 || !resultado.janelas.length || resultado.janela !== '0') {
            throw new Error('Observar a Selene deve listar aplicativos sem expor controles próprios.');
        }
    }, id);
    await app.evaluate(
        async (_electron, { id, janela }) => {
            const computador = (globalThis as Ambiente).computadorValidacao;
            const observacao = JSON.parse(await computador
                .preparar(id, { acao: 'observar', janela })
                .executar(new AbortController().signal));
            const campo = observacao.elementos.find((item: { editavel: boolean }) => item.editavel);
            if (!campo) throw new Error('O aplicativo de validação deve expor um campo editável.');
            await computador.preparar(id, { acao: 'digitar', referencia: campo.referencia, texto: 'Teste vinculado' })
                .executar(new AbortController().signal);
            let recusada = false;
            try {
                computador.preparar(id, {
                    acao: 'digitar', referencia: campo.referencia, observacao: observacao.observacao, texto: 'Antigo',
                });
            } catch { recusada = true; }
            if (!recusada) throw new Error('Uma observação explicitamente antiga deve ser recusada.');
        },
        { id, janela: janelaNativa },
    );
    const painel = mobile.locator('[data-ui="computador-inline"]');
    await painel.getByRole('status').filter({ hasText: 'Ao vivo' }).waitFor();
    const imagem = painel.locator('img');
    await imagem.waitFor();
    await mobile.waitForFunction(() => {
        const imagem = document.querySelector<HTMLImageElement>('[data-ui="tela-computador"]');
        return imagem?.complete && imagem.naturalWidth > 0;
    });
    assert(await painel.evaluate((elemento) => elemento.getBoundingClientRect().width <= 390));
    const antes = await app.evaluate(
        () => (globalThis as Ambiente).computadorValidacao.listarPrevias()[0].atualizadoEm,
    );
    await desktop.waitForFunction(() => !!document.querySelector('[data-ui="tela-computador"]'));
    await app.evaluate(async (_electron, antes) => {
        await new Promise<void>((resolver, rejeitar) => {
            const tempo = setTimeout(() => {
                clearInterval(intervalo);
                rejeitar(new Error('Sem frames novos.'));
            }, 8000);
            const intervalo = setInterval(() => {
                if ((globalThis as Ambiente).computadorValidacao.listarPrevias()[0].atualizadoEm > antes) {
                    clearInterval(intervalo);
                    clearTimeout(tempo);
                    resolver();
                }
            }, 100);
        });
    }, antes);
    const efeitos = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
            .filter((janela) => janela.webContents.getURL().includes('efeitoComputador'))
            .map((janela) => ({ foco: janela.isFocusable(), protegida: janela.isContentProtected() })),
    );
    assert.equal(efeitos.length, 2);
    assert(efeitos.every((janela) => !janela.foco && janela.protegida));
    await painel.getByRole('button', { name: 'Ampliar computador' }).click();
    await painel.getByRole('button', { name: 'Reduzir computador' }).waitFor();
    await painel.getByRole('button', { name: 'Reduzir computador' }).click();
    await mobile.screenshot({ path: 'artifacts/selene-computador-mobile.png' });
    await mobile.reload();
    await mobile.getByRole('button', { name: 'Code', exact: true }).click();
    await mobile.getByRole('button', { name: 'Abrir navegação', exact: true }).click();
    await mobile.getByRole('button', { name: 'Controle do computador', exact: true }).click();
    await mobile.locator('[data-ui="tela-computador"]').waitFor();
    await mobile.getByRole('button', { name: 'Interromper uso do computador' }).click();
    await mobile.getByRole('status').filter({ hasText: 'Encerrado' }).waitFor();
    assert.equal(
        await app.evaluate(
            ({ BrowserWindow }) =>
                BrowserWindow.getAllWindows().filter((janela) =>
                    janela.webContents.getURL().includes('efeitoComputador'),
                ).length,
        ),
        0,
    );
    console.log('Desktop e mobile validados: tela real, frames contínuos, efeitos, reconexão e interrupção remota.');
} finally {
    await navegador.close();
    await app.close();
    encerrarProcesso(aplicativo);
}
