import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { esquemaDados } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'envio-rascunho-'));
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    conversas: [],
    modelos: [
        {
            id: randomUUID(),
            nome: 'Modelo de teste',
            caminho: resolve(pasta, 'modelo.gguf'),
            tamanho: 1,
        },
    ],
});
await writeFile(resolve(pasta, 'selene.json'), JSON.stringify(dados));
const ambiente = Object.fromEntries(
    Object.entries({
        ...process.env,
        SELENE_TESTE: '1',
        SELENE_TESTE_DADOS: pasta,
    }).filter((entrada): entrada is [string, string] => typeof entrada[1] === 'string'),
);
delete ambiente.ELECTRON_RUN_AS_NODE;
delete ambiente.SELENE_VITE_URL;
const app = await electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'),
    args: ['.'],
    env: ambiente,
});
try {
    const pagina = await app.firstWindow();
    pagina.setDefaultTimeout(10000);
    const resultado = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(resultado.ok);
    await app.evaluate(({ ipcMain, BrowserWindow }, estado) => {
        let tentativas = 0;
        ipcMain.removeHandler('selene:enviar');
        ipcMain.handle('selene:enviar', async (_evento, id: string, texto: string) => {
            tentativas++;
            if (tentativas === 1) return { ok: false, erro: 'Falha de envio simulada' };
            await new Promise((resolver) => setTimeout(resolver, 300));
            const conversa = {
                id,
                modo: 'chat' as const,
                titulo: 'Pedido de teste',
                projeto: null,
                modeloId: estado.modelos[0].id,
                acessoCompleto: false,
                atualizadoEm: new Date().toISOString(),
                mensagens: [
                    {
                        id: crypto.randomUUID(),
                        papel: 'user' as const,
                        texto,
                        estado: 'concluida' as const,
                        criadoEm: new Date().toISOString(),
                        acoes: [],
                    },
                    {
                        id: crypto.randomUUID(),
                        papel: 'assistant' as const,
                        texto: 'Resposta controlada',
                        estado: 'concluida' as const,
                        criadoEm: new Date().toISOString(),
                        acoes: [],
                    },
                ],
            };
            BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', {
                tipo: 'estado',
                estado: { ...estado, conversas: [conversa] },
            });
            return { ok: true, valor: undefined };
        });
    }, resultado.valor);
    const campo = pagina.getByRole('textbox', { name: 'Mensagem', exact: true });
    await campo.fill('Pedido de teste');
    await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await pagina.getByRole('alert').getByText('Falha de envio simulada', { exact: true }).waitFor();
    assert.equal(await campo.inputValue(), 'Pedido de teste');
    assert.equal(await pagina.locator('[data-ui~="item-conversa"]').count(), 1);
    const promovida = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(promovida.ok);
    assert.equal(promovida.valor.conversas.length, 1);
    const id = promovida.valor.conversas[0].id;
    await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await pagina.getByText('Resposta controlada', { exact: true }).waitFor();
    assert.equal(await campo.inputValue(), '');
    assert.equal(await pagina.locator('[data-ui~="item-conversa"]').count(), 1);
    assert.equal(await pagina.locator('[data-ui~="item-conversa"]').getByText('Rascunho', { exact: true }).count(), 0);
    assert.equal(await pagina.evaluate(() => JSON.parse(localStorage.getItem('selene.rascunhos.v1')!).length), 0);
    const final = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(final.ok);
    assert.equal(final.valor.conversas.length, 1);
    assert.equal(final.valor.conversas[0].id, id);
    await campo.fill('Texto em envio');
    await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await campo.fill('Texto escrito enquanto envia');
    await pagina.getByText('Texto em envio', { exact: true }).waitFor();
    assert.equal(await campo.inputValue(), 'Texto escrito enquanto envia');
    await pagina
        .getByRole('button', { name: 'Pedido de teste', exact: true })
        .getByText('Rascunho', { exact: true })
        .waitFor();
    console.log(
        'Envio controlado: falha preserva texto, nova tentativa mantém o identificador e sucesso limpa somente o rascunho.',
    );
} finally {
    await app.close();
}
