import { _electron as electron } from 'playwright';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { esquemaDados } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'repositorio-'));
const projetoId = randomUUID();
const grupoId = randomUUID();
const conversaId = randomUUID();
const branchAtual = execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const pastaRemota = resolve(pasta, 't3code');
await mkdir(pastaRemota);
execFileSync('git', ['init', '-q', pastaRemota]);
execFileSync('git', ['-C', pastaRemota, 'remote', 'add', 'origin', 'https://github.com/pingdotgg/t3code.git']);
const segundaPasta = resolve(pasta, 'plugins', 'API');
await mkdir(segundaPasta, { recursive: true });
execFileSync('git', ['init', '-q', segundaPasta]);
execFileSync('git', ['-C', segundaPasta, 'remote', 'add', 'upstream', 'https://github.com/levigarciia/DomeAPI.git']);
const semRemoto = resolve(pasta, 'SemRemoto');
execFileSync('git', ['init', '-q', semRemoto]);
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [],
    projetos: [
        {
            id: projetoId,
            nome: 'Selene',
            caminho: resolve('.'),
            origem: 'pasta',
            criadoEm: new Date().toISOString(),
            scripts: [{ id: randomUUID(), nome: 'Versão do Bun', comando: 'bun --version' }],
        },
        {
            id: randomUUID(),
            nome: 'T3 Code',
            caminho: pastaRemota,
            origem: 'pasta',
            criadoEm: new Date().toISOString(),
        },
        { id: grupoId, nome: 'Grupo', caminho: pasta, origem: 'pasta', criadoEm: new Date().toISOString() },
    ],
    conversas: [
        {
            id: conversaId,
            titulo: 'Conversa do repositório',
            modo: 'code',
            projeto: resolve('.'),
            projetoId,
            atualizadoEm: new Date().toISOString(),
            mensagens: [
                {
                    id: randomUUID(),
                    papel: 'assistant',
                    texto: 'Pronto.',
                    estado: 'concluida',
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

const app = await electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'),
    args: ['.'],
    env: ambiente,
});
try {
    const pagina = await app.firstWindow();
    const errosConsole: string[] = [];
    pagina.on('console', (mensagem) => mensagem.type() === 'error' && errosConsole.push(mensagem.text()));
    pagina.on('requestfailed', (pedido) => errosConsole.push(`${pedido.url()} ${pedido.failure()?.errorText}`));
    await pagina.setViewportSize({ width: 1280, height: 820 });
    await pagina.getByRole('button', { name: 'Code', exact: true }).first().click();
    await pagina.getByText('Conversa do repositório').first().click();

    await pagina.getByRole('button', { name: 'Ações do projeto' }).click();
    const menu = pagina.getByRole('dialog', { name: 'Projeto Selene' });
    await menu.getByText('Alterações').waitFor();
    await menu.getByRole('button', { name: branchAtual, exact: true }).waitFor();
    await pagina.screenshot({ path: 'artifacts/repositorio-menu.png' });

    await menu.getByRole('button', { name: 'Versão do Bun' }).click();
    const terminal = pagina.getByRole('region', { name: 'Terminal' });
    await terminal.waitFor();
    await pagina.waitForTimeout(2500);
    await pagina.locator('textarea[aria-label="Terminal input"]').first().focus();
    await pagina.keyboard.type('echo SELENE_TERMINAL_OK');
    await pagina.keyboard.press('Enter');
    await pagina.waitForTimeout(1500);
    const historico = await pagina.evaluate(async () => {
        const selene = (window as unknown as { selene: import('../shared/contratos').PonteSelene }).selene;
        const botoes = [...document.querySelectorAll('section[aria-label="Terminal"] li button')];
        return { abas: botoes.length, selene: !!selene };
    });
    assert.ok(historico.abas >= 1, 'O terminal deveria ter ao menos uma aba.');
    await pagina.screenshot({ path: 'artifacts/repositorio-terminal.png' });

    await pagina.evaluate(() => localStorage.removeItem('selene.listaGitHub'));
    const grupo = await pagina.evaluate(async (id) => {
        const selene = (window as unknown as { selene: import('../shared/contratos').PonteSelene }).selene;
        return selene.listarGitHub(id, { tipo: 'pr', estado: 'open', envolvimento: 'todos', busca: '' });
    }, grupoId);
    assert.ok(grupo.ok, grupo.ok ? '' : `A pasta agregadora deve funcionar pelo IPC: ${grupo.erro}`);
    if (grupo.ok) {
        const api = execFileSync('gh', ['repo', 'view', 'levigarciia/DomeAPI', '--json', 'nameWithOwner',
            '--jq', '.nameWithOwner'], { encoding: 'utf8' }).trim();
        assert.deepEqual(grupo.valor.repositorios.sort(), [api, 'pingdotgg/t3code'].sort());
        assert.ok(grupo.valor.avisos.some((aviso) => aviso.includes('SemRemoto')));
    }
    await pagina.getByRole('button', { name: 'Pull requests e issues' }).click();
    assert.equal(
        await pagina.getByRole('button', { name: 'Configurações' }).getAttribute('aria-current'),
        null,
        'Configurações não deve ficar destacado na tela do GitHub.',
    );
    await pagina.getByRole('heading', { name: 'pingdotgg/t3code' }).waitFor({ timeout: 60000 });
    await pagina.waitForTimeout(2000);
    await pagina.screenshot({ path: 'artifacts/repositorio-github.png' });
    const avatares = await pagina
        .locator('main img')
        .evaluateAll((imagens) => imagens.slice(0, 3).map((imagem) => (imagem as HTMLImageElement).naturalWidth));
    console.log('Avatares:', avatares.join(', '), errosConsole.slice(0, 3).join(' | '));
    await pagina.getByRole('button', { name: 'Filtros' }).click();
    await pagina.getByRole('menuitemradio', { name: 'Grupo', exact: true }).click();
    await pagina.getByRole('heading', { name: 'pingdotgg/t3code' }).waitFor({ timeout: 60000 });
    await pagina.getByRole('status').filter({ hasText: 'Grupo: SemRemoto' }).waitFor({ timeout: 60000 });
    await pagina.screenshot({ path: 'artifacts/repositorio-filtros.png' });
    await pagina.keyboard.press('Escape');
    await pagina.getByRole('tab', { name: 'Issues' }).click();
    await pagina.getByRole('heading', { name: 'pingdotgg/t3code' }).waitFor({ timeout: 60000 });
    await pagina.waitForTimeout(1500);
    await pagina.screenshot({ path: 'artifacts/repositorio-issues.png' });
    await pagina.getByPlaceholder(/label:bug/).fill('zzzz-nada-encontrado-zzzz');
    await pagina.getByText('Nada corresponde').waitFor({ timeout: 60000 });
    await pagina.screenshot({ path: 'artifacts/repositorio-vazio.png' });
    console.log('Validação do repositório concluída.');
} catch (erro) {
    await (await app.firstWindow()).screenshot({ path: 'artifacts/repositorio-falha.png' });
    throw erro;
} finally {
    await app.close();
}
