import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { esquemaDados } from '../shared/contratos';

/** Confere seletores, persistência e teclado com modelos de teste sem carregar pesos. */
export async function validarControlesEntrada(): Promise<void> {
    const pasta = await mkdtemp(resolve('.teste-dados', 'controles-'));
    const qwen = randomUUID();
    const llama = randomUUID();
    const dados = esquemaDados.parse({
        versao: 1,
        configuracao: {},
        modelos: [
            {
                id: qwen,
                nome: 'Qwen3.5 4B',
                caminho: resolve(pasta, 'qwen.gguf'),
                tamanho: 1,
                catalogoId: 'qwen3.5-4b-q4',
            },
            {
                id: llama,
                nome: 'Llama 3.2 1B',
                caminho: resolve(pasta, 'llama.gguf'),
                tamanho: 1,
                catalogoId: 'llama-3.2-1b-q4',
            },
        ],
        conversas: [
            {
                id: randomUUID(),
                titulo: 'Controles da entrada',
                modo: 'code',
                modeloId: qwen,
                atualizadoEm: new Date().toISOString(),
            },
        ],
    });
    await writeFile(resolve(pasta, 'selene.json'), JSON.stringify(dados));
    const ambiente: Record<string, string> = Object.fromEntries(
        Object.entries({ ...process.env, SELENE_TESTE: '1', SELENE_TESTE_DADOS: pasta }).filter(
            (entrada): entrada is [string, string] => typeof entrada[1] === 'string',
        ),
    );
    delete ambiente.ELECTRON_RUN_AS_NODE;
    delete ambiente.SELENE_VITE_URL;
    const aplicativo = await electron.launch({
        executablePath: resolve('node_modules/electron/dist/electron.exe'),
        args: ['.'],
        env: Object.fromEntries(Object.entries(ambiente).filter(([_, v]) => v !== undefined) as [string, string][]),
    });
    try {
        const pagina = await aplicativo.firstWindow();
        await pagina.getByRole('button', { name: 'Code', exact: true }).click();
        await pagina.getByRole('button', { name: 'Controles da entrada', exact: true }).click();
        const raciocinio = pagina.getByRole('button', { name: 'Nível de raciocínio', exact: true });
        await raciocinio.click();
        assert.equal(await pagina.getByRole('menuitemradio').count(), 4);
        await pagina.getByRole('menuitemradio', { name: 'Alto', exact: true }).click();
        await pagina.waitForFunction(
            () =>
                document.querySelector('.area-tela:not([hidden]) > .tela-conversa [aria-label="Nível de raciocínio"]')
                    ?.textContent === 'Alto',
        );
        const estado = await pagina.evaluate(() => window.selene!.estado());
        assert.ok(estado.ok);
        assert.equal(estado.valor.conversas[0].nivelRaciocinio, 'alto');
        await raciocinio.click();
        await pagina.keyboard.press('ArrowUp');
        assert.equal(
            await pagina
                .getByRole('menuitemradio', { name: 'Médio', exact: true })
                .evaluate((elemento) => elemento === document.activeElement),
            true,
        );
        await pagina.keyboard.press('Escape');
        assert.equal(await raciocinio.evaluate((elemento) => elemento === document.activeElement), true);
        const permissao = pagina.getByRole('button', { name: 'Permissão da conversa', exact: true });
        await permissao.click();
        await pagina.screenshot({ path: 'artifacts/selene-menu-permissao.png' });
        await pagina.getByRole('menuitemradio', { name: /^Acesso completo/ }).click();
        await pagina.waitForFunction(
            () => document.querySelector('[aria-label="Permissão da conversa"]')?.textContent === 'Acesso completo',
        );
        assert.equal(await pagina.getByRole('dialog').count(), 0);
        await pagina.getByRole('button', { name: 'Modelo da conversa', exact: true }).click();
        await pagina.getByRole('button', { name: 'Selecionar Llama 3.2 1B', exact: true }).click();
        await raciocinio.waitFor({ state: 'hidden' });
        await pagina.getByRole('button', { name: 'Modelo da conversa', exact: true }).click();
        await pagina.getByRole('button', { name: 'Selecionar Qwen3.5 4B', exact: true }).click();
        await raciocinio.waitFor();
        await raciocinio.click();
        await pagina.screenshot({ path: 'artifacts/selene-menu-raciocinio.png' });
        await pagina.keyboard.press('Escape');
        await pagina.setViewportSize({ width: 420, height: 760 });
        await permissao.click();
        const limites = await pagina.getByRole('menu').boundingBox();
        assert.ok(limites && limites.x >= 0 && limites.x + limites.width <= 420);
        await pagina.screenshot({ path: 'artifacts/selene-controles-estreitos.png' });
        console.log('Entrada: níveis por modelo, persistência, permissões, teclado e janela estreita validados.');
    } finally {
        await aplicativo.close();
    }
}
