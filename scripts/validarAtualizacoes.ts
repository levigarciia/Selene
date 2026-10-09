import { _electron as electron } from 'playwright';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import type { EstadoAtualizacao } from '../shared/atualizacoes';

await mkdir('.teste-dados', { recursive: true });
const dados = await mkdtemp(resolve('.teste-dados', 'atualizacoes-'));
const ambiente: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, SELENE_TESTE: '1', SELENE_TESTE_DADOS: dados }).filter(
        (item): item is [string, string] => typeof item[1] === 'string',
    ),
);
delete ambiente.ELECTRON_RUN_AS_NODE;
const aplicativo = await electron.launch({ args: ['.'], env: ambiente });
try {
    const pagina = await aplicativo.firstWindow();
    await pagina.getByRole('button', { name: 'Procurar atualizações' }).waitFor();
    const botao = pagina.getByRole('button', { name: 'Procurar atualizações' });
    const painel = pagina.getByRole('dialog', { name: 'Detalhes da atualização' });
    await botao.hover();
    await painel.getByText('Versão instalada: 1.0.0').waitFor();
    await painel.getByText('Atualizações disponíveis na versão instalada.').waitFor();
    await pagina.mouse.move(800, 100);
    await painel.waitFor({ state: 'hidden' });

    async function publicar(atualizacao: EstadoAtualizacao) {
        const resultado = await pagina.evaluate(() => window.selene!.estado());
        if (!resultado.ok) throw new Error(resultado.erro);
        await aplicativo.evaluate(
            ({ BrowserWindow }, estado) => {
                BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', { tipo: 'estado', estado });
            },
            { ...resultado.valor, atualizacao },
        );
    }

    const notas = [
        {
            versao: '1.0.22',
            itens: ['Mostra detalhes da release na sidebar', 'Preserva notas durante o download'],
            total: 2,
        },
    ];
    await publicar({ versaoAtual: '1.0.21', fase: 'baixando', versaoNova: '1.0.22', progresso: 42, notas });
    await botao.hover();
    await painel.getByText('Novidades da versão 1.0.22').waitFor();
    await painel.getByText('Mostra detalhes da release na sidebar').waitFor();
    assert.equal(await painel.getByRole('progressbar').getAttribute('value'), '42');
    await pagina.screenshot({ path: 'artifacts/selene-atualizacao-download.png' });

    await publicar({ versaoAtual: '1.0.21', fase: 'pronta', versaoNova: '1.0.22', notas });
    await painel.getByText('Versão 1.0.22 pronta.', { exact: false }).waitFor();
    await botao.focus();
    await botao.press('Tab');
    assert.equal(
        await painel
            .getByRole('button', { name: 'Ver release no GitHub' })
            .evaluate((elemento) => elemento === document.activeElement),
        true,
    );
    await aplicativo.evaluate(({ shell }) => {
        shell.openExternal = async (url) => {
            (globalThis as typeof globalThis & { releaseAberta?: string }).releaseAberta = url;
        };
    });
    await painel.getByRole('button', { name: 'Ver release no GitHub' }).click();
    assert.equal(
        await aplicativo.evaluate(() => (globalThis as typeof globalThis & { releaseAberta?: string }).releaseAberta),
        'https://github.com/levigarciia/Selene/releases/tag/v1.0.22',
    );
    await painel.getByRole('button', { name: 'Ver release no GitHub' }).press('Escape');
    await painel.waitFor({ state: 'hidden' });
    assert.equal(await botao.evaluate((elemento) => elemento === document.activeElement), true);

    await pagina.getByRole('button', { name: 'Recolher sidebar' }).click();
    await botao.hover();
    await painel.waitFor();
    await pagina.screenshot({ path: 'artifacts/selene-atualizacao-sidebar-recolhida.png' });
    await aplicativo.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(840, 620));
    await painel.waitFor({ state: 'hidden' });
    await botao.hover();
    await painel.waitFor();
    assert.equal(
        await painel.evaluate((elemento) => {
            const limites = elemento.getBoundingClientRect();
            return (
                limites.left >= 0 &&
                limites.right <= window.innerWidth &&
                limites.top >= 0 &&
                limites.bottom <= window.innerHeight &&
                elemento.scrollWidth <= elemento.clientWidth
            );
        }),
        true,
    );
    await pagina.screenshot({ path: 'artifacts/selene-atualizacao-compacta.png' });
    await publicar({
        versaoAtual: '1.0.21',
        fase: 'pronta',
        versaoNova: '1.0.27',
        releasesOmitidas: 3,
        notas: Array.from({ length: 6 }, (_, indice) => ({
            versao: `1.0.${27 - indice}`,
            itens: Array.from({ length: 8 }, (_, item) => `Melhoria ${item + 1} da versão ${27 - indice}`),
            total: 12,
        })),
    });
    await painel.getByText('Novidades da versão 1.0.27').waitFor();
    assert.equal(await painel.locator('li').count(), 48);
    assert.equal(
        await painel
            .locator('.notas-atualizacao')
            .evaluate((elemento) => elemento.scrollHeight > elemento.clientHeight),
        true,
    );
    await painel.getByRole('button', { name: 'Ver versões anteriores no GitHub' }).click();
    assert.equal(
        await aplicativo.evaluate(() => (globalThis as typeof globalThis & { releaseAberta?: string }).releaseAberta),
        'https://github.com/levigarciia/Selene/releases',
    );
    const invalida = await pagina.evaluate(() => window.selene!.abrirRelease('../../outro'));
    assert.equal(invalida.ok, false);
    console.log('Atualizações: hover, notas, progresso, teclado, link oficial e sidebar recolhida validados.');
} finally {
    await aplicativo.close();
}
