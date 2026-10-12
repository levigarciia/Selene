import { _electron as electron } from 'playwright';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { esquemaDados } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'pull-requests-'));
const projetoId = randomUUID();
const conversaId = randomUUID();
const grupoId = randomUUID();
const pastaGrupo = resolve(pasta, 'Grupo');
const pastaRepositorio = resolve(pastaGrupo, 'DomeLauncher');
await mkdir(pastaRepositorio, { recursive: true });
execFileSync('git', ['init', '-q', pastaRepositorio]);
execFileSync('git', [
    '-C',
    pastaRepositorio,
    'remote',
    'add',
    'origin',
    'https://github.com/levigarciia/DomeLauncher.git',
]);
const url = 'https://github.com/levigarciia/Selene/pull/1';
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [],
    projetos: [
        { id: projetoId, nome: 'Selene', caminho: resolve('.'), criadoEm: new Date().toISOString() },
        { id: grupoId, nome: 'Grupo', caminho: pastaGrupo, criadoEm: new Date().toISOString() },
    ],
    conversas: [
        {
            id: conversaId,
            titulo: 'Conversa com PR vinculado',
            modo: 'code',
            projetoId,
            projeto: resolve('.'),
            atualizadoEm: new Date().toISOString(),
            mensagens: [
                {
                    id: randomUUID(),
                    papel: 'assistant',
                    texto: 'PR criado.',
                    estado: 'concluida',
                    criadoEm: new Date().toISOString(),
                    acoes: [
                        {
                            id: randomUUID(),
                            nome: 'executar_terminal',
                            argumentos: { comando: 'gh pr create --fill' },
                            estado: 'concluida',
                            resultado: `Código de saída: 0\n${url}\n`,
                        },
                    ],
                },
            ],
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
    await pagina.setViewportSize({ width: 1280, height: 820 });
    await pagina.getByRole('button', { name: 'Code', exact: true }).first().click();
    const sidebar = pagina.locator('[data-ui~=sidebar]');
    await sidebar.getByRole('link', { name: 'Pull request levigarciia/Selene #1' }).waitFor();
    await pagina.getByRole('button', { name: 'Conversa com PR vinculado', exact: true }).click();
    const cabecalho = pagina.locator('[data-ui~=barra-superior]');
    const link = cabecalho.getByRole('link', { name: 'Pull request levigarciia/Selene #1' });
    await link.waitFor();
    const atualizacao = await pagina.evaluate(async (id) => window.selene!.atualizarPullRequests(id), conversaId);
    assert.ok(atualizacao.ok, 'A consulta do estado pelo IPC deve funcionar.');
    if (atualizacao.ok) {
        assert.equal(atualizacao.valor[0].url, url);
        assert.ok(atualizacao.valor[0].estado, 'O estado deve vir do GitHub.');
    }
    await sidebar.getByText('branch-pr-teste', { exact: true }).waitFor();
    await app.evaluate(({ shell }) => {
        (globalThis as typeof globalThis & { prAberto?: string }).prAberto = '';
        shell.openExternal = async (url) => {
            (globalThis as typeof globalThis & { prAberto?: string }).prAberto = url;
        };
    });
    await link.click();
    const painel = pagina.getByRole('complementary', { name: 'Painel do pull request' });
    await painel.getByRole('heading', { name: 'PR de teste vazio', exact: true }).waitFor();
    assert.equal(await app.evaluate(() => (globalThis as typeof globalThis & { prAberto?: string }).prAberto), '');
    await painel.getByText('Pull request de teste para testes', { exact: true }).waitFor();
    await pagina.screenshot({ path: 'artifacts/pull-requests-painel-resumo.png' });
    await painel.getByRole('button', { name: 'Mesclar', exact: true }).click();
    await painel.getByRole('button', { name: 'Confirmar mesclagem', exact: true }).waitFor();
    await painel.getByRole('button', { name: 'Cancelar', exact: true }).click();
    const revisaoAntiga = await pagina.evaluate(
        async ({ id, url }) => window.selene!.mesclarPullRequest(id, url, '0'.repeat(40), 'merge'),
        { id: conversaId, url },
    );
    assert.ok(!revisaoAntiga.ok && revisaoAntiga.erro.includes('novos commits'));
    await painel.getByRole('tab', { name: 'Atividade', exact: true }).click();
    await painel.getByText('PR de teste vazio para testes', { exact: true }).waitFor();
    await painel.getByRole('tab', { name: 'Código', exact: true }).click();
    await painel.locator('details summary').first().waitFor({ timeout: 60000 });
    await painel.locator('details summary').first().click();
    await painel.locator('pre').first().waitFor();
    await pagina.screenshot({ path: 'artifacts/pull-requests-painel-codigo.png' });
    await painel.getByRole('button', { name: 'Ações do PR', exact: true }).click();
    await pagina.getByRole('menuitem', { name: 'Explicar este PR', exact: true }).click();
    assert.ok((await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).inputValue()).includes(url));
    await painel.getByRole('button', { name: 'Fechar painel do PR' }).click();
    await sidebar.getByRole('link', { name: 'Pull request levigarciia/Selene #1' }).click();
    await painel.getByRole('heading', { name: 'PR de teste vazio', exact: true }).waitFor();
    await painel.getByRole('button', { name: 'Abrir PR no GitHub' }).click();
    assert.equal(await app.evaluate(() => (globalThis as typeof globalThis & { prAberto?: string }).prAberto), url);
    await pagina.screenshot({ path: 'artifacts/pull-requests-conversa.png' });
    const persistidos = esquemaDados.parse(JSON.parse(await readFile(resolve(pasta, 'selene.json'), 'utf8')));
    assert.equal(persistidos.conversas[0].pullRequests?.length, 1);
    assert.equal(persistidos.conversas[0].pullRequests?.[0].url, url);
    const duplicado = await pagina.evaluate(async ({ id, url }) => window.selene!.vincularPullRequest(id, url), {
        id: conversaId,
        url,
    });
    assert.ok(duplicado.ok, 'Vincular novamente deve ser idempotente.');
    await painel.getByRole('button', { name: 'Fechar painel do PR' }).click();
    await pagina.getByRole('button', { name: 'Pull requests e issues', exact: true }).click();
    await pagina.getByRole('heading', { name: 'levigarciia/Selene', exact: true }).waitFor({ timeout: 60000 });
    const acoesPr = pagina.getByRole('button', { name: 'Ações de PR #1', exact: true });
    await acoesPr.focus();
    assert.ok(await acoesPr.isVisible(), 'O menu deve estar disponível pelo teclado.');
    await acoesPr.click();
    await pagina.getByRole('menuitem', { name: 'Abrir no chat', exact: true }).click();
    await pagina.getByRole('button', { name: 'Revisar PR #1', exact: true }).waitFor({ timeout: 60000 });
    const instrucaoPr = await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).inputValue();
    assert.ok(instrucaoPr.includes('seguro para merge') && instrucaoPr.includes(url));
    await pagina.getByRole('button', { name: 'Pull requests e issues', exact: true }).click();
    await pagina.getByRole('tab', { name: 'Issues', exact: true }).click();
    await pagina.getByRole('button', { name: 'Filtros', exact: true }).click();
    await pagina.getByRole('group', { name: 'Estado', exact: true })
        .getByRole('menuitemradio', { name: 'Todos', exact: true }).click();
    await pagina.getByRole('group', { name: 'Projeto', exact: true })
        .getByRole('menuitemradio', { name: 'Grupo', exact: true }).click();
    await pagina.keyboard.press('Escape');
    const acoesIssue = pagina.getByRole('button', { name: 'Ações de issue #22', exact: true });
    await acoesIssue.waitFor({ timeout: 60000 });
    await acoesIssue.focus();
    await acoesIssue.click();
    await pagina.screenshot({ path: 'artifacts/github-menu-issue.png' });
    await pagina.getByRole('menuitem', { name: 'Abrir no chat', exact: true }).click();
    await pagina.getByRole('button', { name: 'Investigar issue #22', exact: true }).waitFor({ timeout: 60000 });
    const instrucaoIssue = await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).inputValue();
    assert.ok(instrucaoIssue.includes('Investigue essa issue'));
    assert.ok(instrucaoIssue.includes('https://github.com/DomeStudios-BR/DomeLauncher/issues/22'));
    const finais = esquemaDados.parse(JSON.parse(await readFile(resolve(pasta, 'selene.json'), 'utf8')));
    const novaIssue = finais.conversas.find((conversa) => conversa.titulo === 'Investigar issue #22');
    assert.ok(novaIssue);
    assert.equal(novaIssue.modo, 'code');
    assert.equal(novaIssue.projetoId, grupoId);
    assert.equal(novaIssue.projeto, pastaGrupo);
    assert.equal(novaIssue.pastaRepositorio, pastaRepositorio);
    assert.equal(novaIssue.mensagens.length, 0);
    console.log('Painel, menus, ferramentas, diffs reais e novas conversas Code validados no Electron.');
} catch (erro) {
    await (await app.firstWindow()).screenshot({ path: 'artifacts/pull-requests-falha.png' });
    throw erro;
} finally {
    await app.close();
}
