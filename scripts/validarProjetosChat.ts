import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { esquemaDados } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'projetos-chat-'));
const conversaId = randomUUID();
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [],
    conversas: [
        {
            id: conversaId,
            titulo: 'Chat existente',
            modo: 'chat',
            atualizadoEm: new Date().toISOString(),
            mensagens: [
                {
                    id: randomUUID(),
                    papel: 'assistant',
                    texto: 'Histórico preservado',
                    estado: 'concluida',
                    criadoEm: new Date().toISOString(),
                },
            ],
        },
    ],
});
await writeFile(resolve(pasta, 'selene.json'), JSON.stringify(dados));
const referencia = resolve(pasta, 'referencia.md');
await writeFile(referencia, 'O projeto estuda astronomia.');
const ambiente = Object.fromEntries(
    Object.entries({ ...process.env, SELENE_TESTE: '1', SELENE_TESTE_DADOS: pasta }).filter(
        (entrada): entrada is [string, string] => typeof entrada[1] === 'string',
    ),
);
delete ambiente.ELECTRON_RUN_AS_NODE;
delete ambiente.SELENE_VITE_URL;
const abrir = () =>
    electron.launch({ executablePath: resolve('node_modules/electron/dist/electron.exe'), args: ['.'], env: ambiente });
let app = await abrir();
try {
    let pagina = await app.firstWindow();
    pagina.setDefaultTimeout(10000);
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await pagina.getByRole('button', { name: 'Novo projeto de Chat', exact: true }).click();
    await pagina.getByLabel('Nome do projeto', { exact: true }).fill('Estudos');
    await pagina.getByRole('button', { name: 'Criar projeto', exact: true }).click();
    await pagina.getByRole('heading', { name: 'Estudos', exact: true }).waitFor();
    await pagina.getByText('Instruções e configurações', { exact: true }).click();
    await pagina.getByLabel('Instruções do projeto', { exact: true }).fill('Seja meu tutor de astronomia.');
    await pagina.getByRole('button', { name: 'Salvar configurações', exact: true }).click();
    await app.evaluate(({ dialog }, caminho) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [caminho] });
    }, referencia);
    await pagina.getByRole('button', { name: 'Adicionar arquivos', exact: true }).click();
    await pagina.getByText('referencia.md', { exact: true }).waitFor();
    await pagina.getByRole('button', { name: 'Novo chat neste projeto', exact: true }).click();
    await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Rascunho de astronomia');
    await pagina
        .getByRole('region', { name: 'Projeto de Chat Estudos', exact: true })
        .getByRole('button', { name: 'Rascunho de astronomia', exact: true })
        .waitFor();
    const chat = pagina.getByRole('button', { name: 'Chat existente', exact: true });
    const dimensoes = await chat.boundingBox();
    assert.ok(dimensoes && dimensoes.height <= 36);
    assert.equal(await chat.locator('[data-ui~="detalhes-item-conversa"]').count(), 0);
    const opcoes = pagina.getByRole('button', { name: 'Opções da conversa: Chat existente', exact: true });
    assert.equal(await opcoes.evaluate((elemento) => getComputedStyle(elemento).opacity), '0');
    await chat.hover();
    assert.equal(await opcoes.evaluate((elemento) => getComputedStyle(elemento).opacity), '1');
    await opcoes.click();
    await pagina.getByRole('menuitem', { name: 'Mover para Estudos', exact: true }).click();
    await pagina
        .getByRole('region', { name: 'Projeto de Chat Estudos', exact: true })
        .getByRole('button', { name: 'Chat existente', exact: true })
        .waitFor();
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    assert.equal(await pagina.getByRole('button', { name: 'Abrir projeto Estudos', exact: true }).count(), 0);
    await pagina.getByRole('button', { name: 'Chat', exact: true }).click();
    await pagina
        .locator('[data-ui~="sidebar"]')
        .getByRole('button', { name: 'Abrir projeto Estudos', exact: true })
        .click();
    await pagina.screenshot({ path: 'artifacts/selene-projetos-chat.png' });
    const estado = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(estado.ok);
    assert.equal(estado.valor.projetos.length, 0);
    assert.equal(estado.valor.projetosChat[0].instrucao, 'Seja meu tutor de astronomia.');
    const projetoId = estado.valor.projetosChat[0].id;
    const recusa = await pagina.evaluate(async (id) => {
        const rascunho = JSON.parse(localStorage.getItem('selene.rascunhos.v1')!)[0];
        return window.selene!.promoverRascunho({ ...rascunho, modo: 'code', projetoChatId: id });
    }, projetoId);
    assert.equal(recusa.ok, false);
    await app.close();
    app = await abrir();
    pagina = await app.firstWindow();
    pagina.setDefaultTimeout(10000);
    await pagina.getByRole('button', { name: 'Rascunho de astronomia', exact: true }).click();
    assert.equal(
        await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).inputValue(),
        'Rascunho de astronomia',
    );
    await pagina.getByRole('button', { name: 'Chat existente', exact: true }).click();
    assert.equal(await pagina.getByText('Histórico preservado', { exact: true }).count(), 1);
    await pagina.locator('[data-ui~="breadcrumb-projeto-chat"]').click();
    await pagina.getByRole('button', { name: 'Remover arquivo referencia.md', exact: true }).click();
    await pagina.getByText('referencia.md', { exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await readFile(referencia, 'utf8'), 'O projeto estuda astronomia.');
    await pagina.setViewportSize({ width: 420, height: 760 });
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await pagina.screenshot({ path: 'artifacts/selene-projetos-chat-estreito.png' });
    await pagina.getByRole('button', { name: 'Remover projeto', exact: true }).click();
    await pagina.getByRole('button', { name: 'Confirmar remoção', exact: true }).click();
    await pagina.getByRole('button', { name: 'Abrir projeto Estudos', exact: true }).waitFor({ state: 'hidden' });
    await pagina.setViewportSize({ width: 1280, height: 840 });
    await pagina.getByRole('button', { name: 'Nova conversa', exact: true }).click();
    await pagina.getByRole('button', { name: 'Rascunho de astronomia', exact: true }).click();
    assert.equal(
        await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).inputValue(),
        'Rascunho de astronomia',
    );
    const rascunho = await pagina.evaluate(() => JSON.parse(localStorage.getItem('selene.rascunhos.v1')!)[0]);
    assert.equal(rascunho.projetoChatId, null);
    const promovida = await pagina.evaluate((entrada) => window.selene!.promoverRascunho(entrada), rascunho);
    assert.ok(promovida.ok);
    assert.equal(promovida.valor.projetoChatId, null);
    assert.equal(erros.length, 0, erros.join('\n'));
    console.log(
        'Projetos de Chat: cadastro, contexto, arquivos, movimento, isolamento de Code, '
            + 'reinício e rascunhos validados.',
    );
} finally {
    await app.close();
}
