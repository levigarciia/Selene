import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { esquemaDados } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'edicao-chat-'));
const conversaId = randomUUID();
const mensagemId = randomUUID();
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [],
    conversas: [
        {
            id: conversaId,
            titulo: 'Teste de edição',
            modo: 'chat',
            atualizadoEm: new Date().toISOString(),
            mensagens: [
                {
                    id: mensagemId,
                    papel: 'user',
                    texto: 'Mensagem original',
                    estado: 'concluida',
                    criadoEm: new Date().toISOString(),
                },
                {
                    id: randomUUID(),
                    papel: 'assistant',
                    texto: 'Resposta original',
                    estado: 'concluida',
                    desempenho: { tokensGerados: 10, tempoGeracaoMs: 1000, tokensPorSegundo: 10 },
                    criadoEm: new Date().toISOString(),
                },
            ],
        },
    ],
});
await writeFile(resolve(pasta, 'selene.json'), JSON.stringify(dados));
const ambiente = Object.fromEntries(
    Object.entries({ ...process.env, SELENE_TESTE: '1', SELENE_TESTE_DADOS: pasta }).filter(
        (entrada): entrada is [string, string] => typeof entrada[1] === 'string',
    ),
);
delete ambiente.ELECTRON_RUN_AS_NODE;
delete ambiente.SELENE_VITE_URL;
const aplicativo = await electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'),
    args: ['.'],
    env: ambiente,
});
try {
    const pagina = await aplicativo.firstWindow();
    pagina.setDefaultTimeout(10000);
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await pagina.getByRole('button', { name: 'Teste de edição', exact: true }).click();
    assert.equal(await pagina.locator('[data-ui~="estado-motor"]').count(), 0);
    const regerar = pagina.getByRole('button', { name: 'Regerar mensagem', exact: true });
    const info = pagina.getByRole('button', { name: 'Mostrar tokens por segundo', exact: true });
    await regerar.waitFor();
    const botoesResposta = pagina.locator('[data-ui~="velocidade-mensagem"]');
    assert.equal(await botoesResposta.evaluate((elemento) => getComputedStyle(elemento).opacity), '0');
    await pagina.getByText('Resposta original', { exact: true }).hover();
    assert.equal(await botoesResposta.evaluate((elemento) => getComputedStyle(elemento).opacity), '1');
    const posicaoInfo = await info.boundingBox();
    const posicaoRegerar = await regerar.boundingBox();
    assert.ok(posicaoInfo && posicaoRegerar && posicaoRegerar.x > posicaoInfo.x);
    await regerar.click();
    await pagina.getByText('Selecione um modelo GGUF.', { exact: true }).waitFor();
    await pagina.getByText('Mensagem original', { exact: true }).hover();
    await pagina.screenshot({ path: 'artifacts/selene-edicao-hover.png' });
    await pagina.getByRole('button', { name: 'Editar e reenviar mensagem', exact: true }).click();
    const editor = pagina.getByRole('textbox', { name: 'Editar mensagem', exact: true });
    assert.equal(await editor.inputValue(), 'Mensagem original');
    await editor.fill('Mensagem corrigida');
    await pagina.screenshot({ path: 'artifacts/selene-edicao-chat.png' });
    await pagina.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await pagina.getByText('Mensagem original', { exact: true }).waitFor();
    await pagina.getByText('Mensagem original', { exact: true }).hover();
    await pagina.getByRole('button', { name: 'Editar e reenviar mensagem', exact: true }).click();
    await editor.fill('');
    assert.equal(await pagina.getByRole('button', { name: 'Salvar e reenviar', exact: true }).isDisabled(), true);
    await editor.fill('Mensagem corrigida');
    await pagina.getByRole('button', { name: 'Salvar e reenviar', exact: true }).click();
    await pagina.getByText('Selecione um modelo GGUF.', { exact: true }).waitFor();
    assert.equal(await editor.inputValue(), 'Mensagem corrigida');
    const estado = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(estado.ok);
    assert.deepEqual(estado.valor.conversas[0].mensagens, dados.conversas[0].mensagens);
    await editor.press('Escape');
    await editor.waitFor({ state: 'detached' });
    await aplicativo.evaluate(({ BrowserWindow }, dados) => {
        const estado = {
            ...dados,
            motor: {
                fase: 'carregando',
                detalhe: 'Carregando modelo',
                instalado: { cpu: false, vulkan: false, rocm: false },
            },
            conversaEmExecucao: dados.conversas[0].id,
            downloads: [],
        };
        estado.conversas[0].mensagens[1].estado = 'gerando';
        estado.conversas[0].mensagens[1].texto = '';
        estado.conversas[0].mensagens[1].faseGeracao = 'ligandoModelo';
        BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', { tipo: 'estado', estado });
    }, structuredClone(dados));
    await pagina.getByText('Ligando modelo', { exact: true }).waitFor();
    assert.equal(await pagina.locator('[data-ui~="ligando-modelo"] [data-ui~="texto-em-andamento"]').count(), 1);
    assert.equal(await pagina.getByRole('button', { name: 'Regerar mensagem', exact: true }).count(), 0);
    await pagina.screenshot({ path: 'artifacts/selene-ligando-modelo.png' });
    await aplicativo.evaluate(({ BrowserWindow }, dados) => {
        dados.conversas[0].modo = 'code';
        BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', {
            tipo: 'estado',
            estado: {
                ...dados,
                motor: { fase: 'desligado', detalhe: '', instalado: { cpu: false, vulkan: false, rocm: false } },
                conversaEmExecucao: null,
                downloads: [],
            },
        });
    }, structuredClone(dados));
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('button', { name: 'Teste de edição', exact: true }).click();
    assert.equal(await pagina.getByRole('button', { name: 'Regerar mensagem', exact: true }).count(), 0);
    assert.deepEqual(erros, []);
    console.log('Edição no Electron: abertura, cancelamento, texto vazio e falha sem alterar o histórico passaram.');
} finally {
    await aplicativo.close();
}
