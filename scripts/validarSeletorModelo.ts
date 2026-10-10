import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { _electron as electron, type Page } from 'playwright';
import { esquemaDados } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'seletor-modelo-'));
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [],
    conversas: ['chat', 'code'].map((modo) => ({
        id: randomUUID(),
        titulo: `Histórico ${modo}`,
        modo,
        atualizadoEm: new Date().toISOString(),
        mensagens: [
            {
                id: randomUUID(),
                papel: 'assistant',
                texto: 'Conversa existente.',
                estado: 'concluida',
                criadoEm: new Date().toISOString(),
            },
        ],
    })),
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

async function verificarLimites(pagina: Page) {
    const catalogo = pagina.getByRole('dialog', { name: 'Catálogo de modelos' });
    await catalogo.waitFor();
    const limites = await catalogo.evaluate((elemento) => {
        const painel = elemento.getBoundingClientRect();
        const gatilho = elemento
            .closest('[data-ui~="seletor-catalogo"]')!
            .querySelector('[data-ui~="gatilho-catalogo"]')!
            .getBoundingClientRect();
        const busca = elemento.querySelector('[data-ui~="busca-catalogo"]')!.getBoundingClientRect();
        const rodape = elemento.querySelector('[data-ui~="rodape-catalogo"]')!.getBoundingClientRect();
        const lista = elemento.querySelector('[data-ui~="itens-catalogo"]')!;
        return {
            topo: painel.top,
            esquerda: painel.left,
            direita: painel.right,
            altura: painel.height,
            larguraJanela: document.documentElement.clientWidth,
            distanciaGatilho: gatilho.top - painel.bottom,
            buscaVisivel: busca.top >= painel.top && busca.bottom <= painel.bottom,
            rodapeVisivel: rodape.top >= painel.top && rodape.bottom <= painel.bottom,
            listaRolavel: lista.scrollHeight > lista.clientHeight && lista.clientHeight > 0,
        };
    });
    assert.ok(limites.topo >= 68, JSON.stringify(limites));
    assert.ok(limites.esquerda >= 12 && limites.direita <= limites.larguraJanela - 12);
    assert.ok(limites.altura > 100 && limites.altura <= 480);
    assert.ok(Math.abs(limites.distanciaGatilho - 16) < 1, JSON.stringify(limites));
    assert.ok(limites.buscaVisivel && limites.rodapeVisivel && limites.listaRolavel);
    await catalogo.locator('[data-ui~="itens-catalogo"]').evaluate((elemento) => {
        elemento.scrollTop = elemento.scrollHeight;
    });
    await catalogo.locator('[data-ui~="item-catalogo"]').last().getByRole('button').last().click({ trial: true });
}

try {
    const pagina = await aplicativo.firstWindow();
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    for (const modo of ['Chat', 'Code']) {
        await pagina.getByRole('button', { name: modo, exact: true }).click();
        for (const historico of [false, true]) {
            if (historico) {
                await pagina.getByRole('button', { name: `Histórico ${modo.toLowerCase()}`, exact: true }).click();
            }
            await pagina.getByRole('button', { name: 'Modelo da conversa', exact: true }).click();
            for (const dimensoes of [
                { width: 1280, height: 840 },
                { width: 1000, height: 760 },
                { width: 840, height: 620 },
                { width: 420, height: 500 },
            ]) {
                await pagina.setViewportSize(dimensoes);
                await verificarLimites(pagina);
            }
            await pagina.screenshot({ path: `artifacts/seletor-modelo-${modo.toLowerCase()}-${historico}.png` });
            await pagina.keyboard.press('Escape');
            await pagina.getByRole('dialog', { name: 'Catálogo de modelos' }).waitFor({ state: 'hidden' });
            await pagina.setViewportSize({ width: 1280, height: 840 });
        }
    }
    assert.deepEqual(erros, []);
    console.log('Seletor: limites, busca, rodapé, rolagem e redimensionamento passaram em Chat e Code.');
} finally {
    await aplicativo.close();
}
