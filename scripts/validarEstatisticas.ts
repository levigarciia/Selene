import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { esquemaDados } from '../shared/contratos';
import { montarPainelEstatisticas } from '../shared/painelEstatisticas';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'estatisticas-'));
const modeloA = randomUUID();
const modeloB = randomUUID();
const conversaA = randomUUID();
const conversaB = randomUUID();
const agora = new Date();
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    conversas: [],
    modelos: [
        { id: modeloA, nome: 'Qwen 3.5 9B', caminho: resolve(pasta, 'qwen.gguf'), tamanho: 1024 },
        { id: modeloB, nome: 'Gemma 3 4B', caminho: resolve(pasta, 'gemma.gguf'), tamanho: 1024 },
    ],
    registrosUso: Array.from({ length: 30 }, (_, indice) => {
        const data = new Date(agora);
        data.setDate(data.getDate() - 29 + indice);
        data.setHours(0, 0, 0, 0);
        const entrada = indice > 25 ? [150000, 700000, 1800000, 450000][indice - 26] : indice * 230;
        return {
            mensagemId: randomUUID(),
            conversaId: indice % 4 ? conversaA : conversaB,
            modo: indice % 4 ? 'code' : 'chat',
            modeloId: indice % 4 ? modeloA : modeloB,
            criadoEm: data.toISOString(),
            tokensEntrada: entrada,
            tokensEntradaCache: Math.floor(entrada * 0.8),
            tokensGerados: indice * 80 + 100,
            tempoGeracaoMs: 10000,
            tokensPorSegundo: (indice * 80 + 100) / 10,
        };
    }),
});
await writeFile(resolve(pasta, 'selene.json'), JSON.stringify(dados));
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
    pagina.setDefaultTimeout(15000);
    await pagina.setViewportSize({ width: 1440, height: 1000 });
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await pagina.getByRole('button', { name: 'Estatísticas', exact: true }).click();
    const tela = pagina.getByRole('region', { name: 'Estatísticas', exact: true });
    await tela.waitFor();
    assert(await pagina.locator('[data-ui~="sidebar"]').isVisible());
    assert(await tela.evaluate((elemento) => elemento.closest('[data-ui="area-principal"]') !== null));
    const total = tela.locator('[data-ui="total-estatisticas"]');
    const esperado = montarPainelEstatisticas(dados.registrosUso, '30dias', agora);
    assert.equal(
        await total.getAttribute('title'),
        `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(esperado.tokensRegistrados)} tokens`,
    );
    assert.equal(await tela.locator('tbody tr').count(), 2);
    const ponto = tela.locator('[data-ui="grafico-tokens"] [role="button"]').last();
    await ponto.focus();
    assert((await tela.locator('[aria-live="polite"]').innerText()).includes('tokens'));
    await ponto.blur();
    await pagina.screenshot({ path: 'artifacts/selene-estatisticas.png' });
    await tela.getByRole('button', { name: 'Dia', exact: true }).click();
    await pagina.waitForFunction(
        () => document.querySelector('[data-ui="detalhamento-estatisticas"] tbody')?.children.length === 30,
    );
    await tela.getByRole('button', { name: '7 dias', exact: true }).click();
    await pagina.waitForFunction(
        () => document.querySelector('[data-ui="detalhamento-estatisticas"] tbody')?.children.length === 7,
    );
    await tela.getByRole('combobox', { name: 'Modo das estatísticas' }).selectOption('chat');
    await tela.getByRole('button', { name: 'Modelo', exact: true }).click();
    await pagina.waitForFunction(
        () => document.querySelector('[data-ui="detalhamento-estatisticas"] tbody')?.children.length === 1,
    );
    assert((await tela.locator('tbody').innerText()).includes('Gemma 3 4B'));
    await tela.getByRole('combobox', { name: 'Modelo das estatísticas' }).selectOption(modeloA);
    await tela.getByText('Nenhuma medição neste período.', { exact: true }).waitFor();
    await tela.getByRole('combobox', { name: 'Modelo das estatísticas' }).selectOption('todos');
    await tela.getByRole('combobox', { name: 'Modo das estatísticas' }).selectOption('todos');
    await pagina.setViewportSize({ width: 420, height: 900 });
    assert(await tela.evaluate((elemento) => elemento.scrollWidth <= elemento.clientWidth));
    await pagina.screenshot({ path: 'artifacts/selene-estatisticas-mobile.png' });
    await pagina.keyboard.press('Escape');
    await tela.waitFor({ state: 'detached' });
    assert.deepEqual(erros, []);
    console.log(
        'Estatísticas validadas no Electron: totais, períodos, grupos, filtros, gráfico, vazio, responsividade e teclado.',
    );
} finally {
    await app.close();
}
