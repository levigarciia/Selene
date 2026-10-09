import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { esquemaDados } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'projetos-rascunhos-'));
const projetoAntigo = resolve(pasta, 'Projeto existente');
await mkdir(projetoAntigo);
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [],
    conversas: [
        {
            id: randomUUID(),
            titulo: 'Conversa salva',
            modo: 'code',
            projeto: projetoAntigo,
            atualizadoEm: new Date().toISOString(),
            mensagens: [
                {
                    id: randomUUID(),
                    papel: 'assistant',
                    texto: 'Histórico confirmado',
                    estado: 'concluida',
                    criadoEm: new Date().toISOString(),
                },
            ],
        },
    ],
});
const { projetos, ...legado } = dados;
await writeFile(resolve(pasta, 'selene.json'), JSON.stringify(legado));
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
    pagina.setDefaultTimeout(10000);
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    const obter = async () => {
        const resultado = await pagina.evaluate(() => window.selene!.estado());
        assert.ok(resultado.ok);
        return resultado.valor;
    };
    const mensagem = () => pagina.getByRole('textbox', { name: 'Mensagem', exact: true });
    const novo = () => pagina.getByRole('button', { name: 'Nova conversa', exact: true }).click();
    await mensagem().waitFor();
    for (let indice = 0; indice < 8; indice++) await novo();
    assert.equal((await obter()).conversas.length, 1);
    assert.equal(await pagina.locator('.item-conversa').count(), 0);
    await mensagem().fill('Primeiro rascunho');
    await pagina
        .getByRole('button', { name: 'Primeiro rascunho', exact: true })
        .getByText('Rascunho', { exact: true })
        .waitFor();
    await novo();
    assert.equal(await mensagem().inputValue(), '');
    await mensagem().fill('Segundo rascunho');
    await novo();
    await mensagem().fill('   ');
    assert.equal(await pagina.locator('.item-conversa').count(), 2);
    await pagina.getByRole('button', { name: 'Primeiro rascunho', exact: true }).click();
    assert.equal(await mensagem().inputValue(), 'Primeiro rascunho');
    assert.equal((await obter()).conversas.length, 1);
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    const seletor = () => pagina.getByRole('button', { name: 'Projeto da conversa', exact: true });
    const adicionar = async () => {
        await seletor().click();
        await pagina.getByRole('menuitem', { name: 'Adicionar projeto', exact: true }).click();
    };
    assert.equal(await pagina.locator('.grupo-projeto').count(), 0);
    assert.equal(await pagina.getByRole('button', { name: 'Projeto Projeto existente', exact: true }).count(), 0);
    await seletor().click();
    await pagina.getByRole('menuitemradio', { name: 'Projeto existente', exact: true }).click();
    for (let indice = 0; indice < 5; indice++) await novo();
    assert.equal((await obter()).conversas.length, 1);
    await mensagem().fill('Rascunho do projeto');
    await pagina.getByRole('button', { name: 'Rascunho do projeto', exact: true }).waitFor();
    await pagina.getByRole('button', { name: 'Conversa salva', exact: true }).click();
    await mensagem().fill('Continuação pendente');
    await novo();
    await pagina.getByRole('button', { name: 'Conversa salva', exact: true }).click();
    assert.equal(await mensagem().inputValue(), 'Continuação pendente');
    assert.equal(await pagina.getByText('Histórico confirmado', { exact: true }).count(), 1);
    await adicionar();
    await app.evaluate(({ dialog }) => {
        dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    });
    await pagina.getByRole('button', { name: 'Abrir pasta existente', exact: true }).click();
    assert.equal((await obter()).projetos.length, 1);
    await pagina.getByRole('button', { name: 'Novo projeto', exact: true }).click();
    await pagina.getByLabel('Nome do projeto', { exact: true }).fill('Meu projeto');
    await pagina.getByRole('button', { name: 'Criar projeto', exact: true }).click();
    await seletor().getByText('Meu projeto', { exact: true }).waitFor();
    assert.equal(
        await pagina
            .getByRole('navigation', { name: 'Localização da conversa' })
            .getByText('Meu projeto', { exact: true })
            .count(),
        1,
    );
    assert.equal((await obter()).conversas.length, 1);
    let estado = await obter();
    const criado = estado.projetos.find((item) => item.nome === 'Meu projeto')!;
    assert.ok((await stat(resolve(criado.caminho, '.git'))).isDirectory());
    assert.ok((await stat(resolve(criado.caminho, 'assets/icon.svg'))).isFile());
    await mensagem().fill('Trabalho no projeto novo');
    await pagina.getByRole('button', { name: 'Trabalho no projeto novo', exact: true }).waitFor();
    await seletor().click();
    await pagina.screenshot({ path: 'artifacts/selene-projetos-rascunhos.png' });
    await pagina.keyboard.press('Escape');
    await adicionar();
    await pagina.getByRole('textbox', { name: 'Nome de Meu projeto', exact: true }).fill('Projeto renomeado');
    await pagina.getByRole('heading', { name: 'Projetos', exact: true }).click();
    await pagina.getByRole('textbox', { name: 'Nome de Projeto renomeado', exact: true }).waitFor();
    await pagina.keyboard.press('Escape');
    if (process.env.SELENE_TESTE_CLONE === '1') {
        await adicionar();
        await pagina.getByRole('button', { name: 'Clonar repositório', exact: true }).click();
        await pagina.getByLabel('URL HTTPS do repositório').fill('https://github.com/octocat/Hello-World.git');
        await pagina.getByRole('button', { name: 'Clonar repositório', exact: true }).click();
        await seletor().getByText('Hello-World', { exact: true }).waitFor({ timeout: 120000 });
        estado = await obter();
        const clonado = estado.projetos.find((item) => item.origem === 'clonado')!;
        assert.ok((await readFile(resolve(clonado.caminho, 'README'), 'utf8')).length);
    }
    await app.close();
    app = await abrir();
    pagina = await app.firstWindow();
    pagina.setDefaultTimeout(10000);
    await pagina.getByRole('button', { name: 'Primeiro rascunho', exact: true }).click();
    assert.equal(await mensagem().inputValue(), 'Primeiro rascunho');
    await pagina.getByRole('button', { name: 'Segundo rascunho', exact: true }).click();
    assert.equal(await mensagem().inputValue(), 'Segundo rascunho');
    await mensagem().fill('');
    assert.equal(await pagina.getByRole('button', { name: 'Segundo rascunho', exact: true }).count(), 0);
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('button', { name: 'Trabalho no projeto novo', exact: true }).click();
    assert.equal(await mensagem().inputValue(), 'Trabalho no projeto novo');
    assert.equal(await seletor().innerText(), 'Projeto renomeado');
    await seletor().click();
    await pagina.keyboard.press('End');
    await pagina.keyboard.press('Home');
    await pagina.keyboard.press('Enter');
    assert.equal(await seletor().innerText(), 'Sem projeto');
    await seletor().click();
    await pagina.getByRole('menuitemradio', { name: 'Projeto renomeado', exact: true }).click();
    const rascunho = await pagina.evaluate(() =>
        JSON.parse(localStorage.getItem('selene.rascunhos.v1')!).find(
            (item: { titulo: string }) => item.titulo === 'Trabalho no projeto novo',
        ),
    );
    const promovida = await pagina.evaluate((entrada) => window.selene!.promoverRascunho(entrada), rascunho);
    assert.ok(promovida.ok);
    const repetida = await pagina.evaluate((entrada) => window.selene!.promoverRascunho(entrada), rascunho);
    assert.ok(repetida.ok);
    assert.equal(repetida.valor.id, promovida.valor.id);
    assert.equal((await obter()).conversas.length, 2);
    await pagina.getByRole('button', { name: 'Conversa salva', exact: true }).click();
    assert.equal(await mensagem().inputValue(), 'Continuação pendente');
    assert.equal(await pagina.getByText('Histórico confirmado', { exact: true }).count(), 1);
    await pagina.setViewportSize({ width: 420, height: 760 });
    await novo();
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await adicionar();
    await pagina.getByRole('button', { name: 'Remover projeto Projeto renomeado', exact: true }).click();
    await pagina
        .getByRole('button', { name: 'Remover projeto Projeto renomeado', exact: true })
        .waitFor({ state: 'hidden' });
    assert.ok((await stat(criado.caminho)).isDirectory());
    assert.equal((await obter()).conversas.length, 2);
    assert.equal(erros.length, 0, erros.join('\n'));
    console.log(
        'Projetos e rascunhos: menu, teclado, breadcrumbs, sidebar sem projetos, persistência e arquivos validados.',
    );
} finally {
    await app.close();
}
