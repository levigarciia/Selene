import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { esquemaDados } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'limites-'));
await writeFile(
    resolve(pasta, 'selene.json'),
    JSON.stringify(esquemaDados.parse({ versao: 1, configuracao: {}, conversas: [], modelos: [], registrosUso: [] })),
);
const ambiente = Object.fromEntries(
    Object.entries({ ...process.env, SELENE_TESTE: '1', SELENE_TESTE_DADOS: pasta }).filter(
        (item): item is [string, string] => typeof item[1] === 'string',
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
    pagina.setDefaultTimeout(30000);
    await pagina.setViewportSize({ width: 1440, height: 1000 });
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await pagina.getByRole('button', { name: 'Estatísticas', exact: true }).click();
    const tela = pagina.getByRole('region', { name: 'Estatísticas', exact: true });
    await tela.waitFor();
    await tela.getByRole('button', { name: 'Limites', exact: true }).click();
    const limites = tela.locator('[data-ui="limites-assinaturas"]');
    await limites.waitFor();
    // Os dados vêm dos CLIs reais da máquina: valida a estrutura, não os valores.
    await pagina.waitForFunction(() => !document.body.innerText.includes('Consultando limites'));
    assert.equal(await limites.locator('[data-ui="limites-provedor"]').count(), 2);
    assert.equal(await tela.getByRole('group', { name: 'Período das estatísticas' }).count(), 0);
    assert((await limites.innerText()).includes('Sessão de 5 horas') || (await limites.innerText()).includes('não'));
    await pagina.screenshot({ path: 'artifacts/selene-limites.png' });
    await pagina.setViewportSize({ width: 420, height: 900 });
    assert(await tela.evaluate((elemento) => elemento.scrollWidth <= elemento.clientWidth));
    await pagina.screenshot({ path: 'artifacts/selene-limites-mobile.png' });
    await tela.getByRole('button', { name: 'Custo', exact: true }).click();
    await limites.waitFor({ state: 'detached' });
    assert.deepEqual(erros, []);
    console.log('Aba de limites validada.');
} finally {
    await app.close();
}
