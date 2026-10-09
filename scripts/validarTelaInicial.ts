import assert from 'node:assert/strict';
import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { esquemaDados } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'inicio-'));
const projeto = resolve(pasta, 'Projeto recente');
const outraPasta = resolve(pasta, 'Outra pasta');
await mkdir(projeto);
await mkdir(outraPasta);
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [],
    conversas: [
        {
            id: randomUUID(),
            titulo: 'Anterior',
            modo: 'code',
            projeto,
            atualizadoEm: new Date().toISOString(),
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
const abrir = () =>
    electron.launch({
        executablePath: resolve('node_modules/electron/dist/electron.exe'),
        args: ['.'],
        env: ambiente,
    });
let app = await abrir();
try {
    let pagina = await app.firstWindow();
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    const seletor = pagina.getByRole('combobox', { name: 'Projeto da conversa' });
    await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Crie um exemplo');
    await seletor.selectOption('sem');
    await pagina.waitForFunction(
        () => document.querySelector<HTMLSelectElement>('.seletor-projeto select')?.value === 'sem',
    );
    const obter = () => pagina.evaluate(() => window.selene!.estado());
    let estado = await obter();
    assert.ok(estado.ok);
    const conversa = estado.valor.conversas[0];
    assert.equal(conversa.projeto, null);
    assert.ok(conversa.pastaTrabalho && (await stat(conversa.pastaTrabalho)).isDirectory());
    assert.equal(conversa.acessoCompleto, false);
    assert.equal(await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).inputValue(), 'Crie um exemplo');
    await seletor.selectOption(projeto);
    await pagina.waitForFunction(
        (caminho) => document.querySelector<HTMLSelectElement>('.seletor-projeto select')?.value === caminho,
        projeto,
    );
    const recusado = await pagina.evaluate(async () => {
        const resultado = await window.selene!.estado();
        if (!resultado.ok) throw new Error(resultado.erro);
        return window.selene!.escolherProjeto(resultado.valor.conversas[0].id, 'C:\\pasta-nao-cadastrada');
    });
    assert.equal(recusado.ok, false);
    await app.evaluate(({ dialog }) => {
        dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    });
    await seletor.selectOption('abrir');
    await pagina.waitForFunction(
        (caminho) => document.querySelector<HTMLSelectElement>('.seletor-projeto select')?.value === caminho,
        projeto,
    );
    await app.evaluate(({ dialog }, caminho) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [caminho] });
    }, outraPasta);
    await seletor.selectOption('abrir');
    await pagina.waitForFunction(
        (caminho) => document.querySelector<HTMLSelectElement>('.seletor-projeto select')?.value === caminho,
        outraPasta,
    );
    await seletor.selectOption('sem');
    await pagina.waitForFunction(
        () => document.querySelector<HTMLSelectElement>('.seletor-projeto select')?.value === 'sem',
    );
    await pagina.screenshot({ path: 'artifacts/selene-inicio-code.png' });
    await pagina.setViewportSize({ width: 420, height: 760 });
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await pagina.screenshot({ path: 'artifacts/selene-inicio-estreito.png' });
    await pagina.getByRole('button', { name: 'Chat', exact: true }).click();
    assert.equal(await seletor.isVisible(), false);
    await app.close();
    app = await abrir();
    pagina = await app.firstWindow();
    estado = await obter();
    assert.ok(estado.ok);
    const restaurada = estado.valor.conversas.find((item) => item.id === conversa.id)!;
    assert.equal(restaurada.projeto, null);
    assert.equal(restaurada.pastaTrabalho, conversa.pastaTrabalho);
    console.log('Tela inicial: seleção, cancelamento, projetos recentes, rascunho, modo Chat e reinício validados.');
} finally {
    await app.close();
}
