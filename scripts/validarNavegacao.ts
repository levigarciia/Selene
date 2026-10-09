import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ElectronApplication, Page } from 'playwright';

/** Verifica navegação entre telas, rascunhos, sidebar e ações sobre uma conversa não selecionada. */
export async function validarNavegacao(pagina: Page, aplicativo: ElectronApplication, dados: string): Promise<void> {
    const tituloAtivo = await pagina.getByRole('textbox', { name: 'Título da conversa' }).inputValue();
    await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Rascunho preservado ao navegar');
    await pagina.getByRole('button', { name: 'Recolher sidebar' }).click();
    assert.equal(
        await pagina.locator('[data-ui~="sidebar"]').evaluate((elemento) => elemento.getBoundingClientRect().width),
        72,
    );
    await pagina.screenshot({ path: 'artifacts/selene-sidebar-recolhida.png' });
    await pagina.getByRole('button', { name: 'Expandir sidebar' }).click();
    await pagina.getByRole('button', { name: 'Configurações', exact: true }).click();
    await pagina.getByRole('heading', { name: 'Configurações', exact: true }).waitFor();
    assert.equal(await pagina.getByRole('dialog').count(), 0);
    await pagina.getByRole('heading', { name: 'Geração', exact: true }).waitFor();
    await pagina.screenshot({ path: 'artifacts/selene-configuracoes.png' });
    await aplicativo.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(840, 620));
    await pagina.waitForFunction(() => window.innerWidth === 840);
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await pagina.screenshot({ path: 'artifacts/selene-configuracoes-compacta.png' });
    await aplicativo.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 840));
    await pagina.waitForFunction(() => window.innerWidth === 1280);
    const secoes = pagina.getByRole('navigation', { name: 'Seções das configurações' });
    await secoes.getByRole('button', { name: 'Modelos', exact: true }).click();
    await pagina.getByRole('button', { name: 'Baixar modelos', exact: true }).click();
    const catalogo = pagina.getByRole('region', { name: 'Catálogo de modelos' });
    await catalogo.waitFor();
    await catalogo.getByRole('textbox', { name: 'Buscar modelos' }).fill('9B');
    assert.equal(await catalogo.locator('[data-ui~="item-catalogo"]').count(), 1);
    await pagina.screenshot({ path: 'artifacts/selene-configuracoes-modelos.png' });
    await secoes.getByRole('button', { name: 'Motor', exact: true }).click();
    await pagina.getByRole('heading', { name: 'Motor local', exact: true }).waitFor();
    await pagina.screenshot({ path: 'artifacts/selene-configuracoes-motor.png' });
    await secoes.getByRole('button', { name: 'Geral', exact: true }).click();
    await pagina.getByLabel('Temperatura', { exact: true }).fill('0.6');
    await pagina.getByRole('button', { name: 'Voltar à conversa' }).click();
    assert.equal(
        await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).inputValue(),
        'Rascunho preservado ao navegar',
    );
    await pagina.getByRole('button', { name: 'Configurações', exact: true }).click();
    assert.equal(await pagina.getByLabel('Temperatura', { exact: true }).inputValue(), '0.6');
    await pagina.getByLabel('Temperatura', { exact: true }).fill('0.7');
    await pagina.getByRole('button', { name: 'Voltar à conversa' }).click();
    assert.equal(await pagina.getByRole('button', { name: 'Exportar conversa', exact: true }).count(), 0);
    assert.equal(await pagina.getByRole('button', { name: 'Excluir conversa', exact: true }).count(), 0);
    const titulo = 'Conversa para menu de contexto';
    const id = await pagina.evaluate(async (titulo) => {
        const ponte = window.selene!;
        const nova = await ponte.novaConversa('code');
        if (!nova.ok) throw new Error(nova.erro);
        const alterada = await ponte.alterarConversa(nova.valor.id, { titulo });
        if (!alterada.ok) throw new Error(alterada.erro);
        return nova.valor.id;
    }, titulo);
    const botao = pagina.getByRole('button', { name: titulo, exact: true });
    await botao.click({ button: 'right' });
    await pagina.getByRole('menu').waitFor();
    assert.equal(await pagina.getByRole('textbox', { name: 'Título da conversa' }).inputValue(), tituloAtivo);
    await pagina.screenshot({ path: 'artifacts/selene-menu-conversa.png' });
    await pagina.keyboard.press('Escape');
    assert.equal(await botao.evaluate((elemento) => elemento === document.activeElement), true);
    await botao.press('Shift+F10');
    await pagina.getByRole('menu').waitFor();
    const destino = resolve(dados, 'exportacao.md');
    await aplicativo.evaluate(({ dialog }, caminho) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: caminho });
    }, destino);
    await pagina.getByRole('menuitem', { name: 'Exportar conversa' }).click();
    for (let tentativa = 0; tentativa < 30; tentativa++) {
        if ((await readFile(destino, 'utf8').catch(() => '')) === `# ${titulo}`) break;
        await new Promise((resolver) => setTimeout(resolver, 100));
    }
    assert.equal(await readFile(destino, 'utf8'), `# ${titulo}`);
    await botao.click({ button: 'right' });
    await pagina.getByRole('menuitem', { name: 'Excluir conversa' }).click();
    await pagina.getByRole('heading', { name: 'Excluir esta conversa?' }).waitFor();
    await pagina.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await botao.waitFor();
    await botao.click({ button: 'right' });
    await pagina.getByRole('menuitem', { name: 'Excluir conversa' }).click();
    await pagina.getByRole('button', { name: 'Excluir', exact: true }).click();
    await botao.waitFor({ state: 'hidden' });
    const estado = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(estado.ok);
    assert.equal(
        estado.valor.conversas.some((conversa) => conversa.id === id),
        false,
    );
    assert.equal(await pagina.getByRole('textbox', { name: 'Título da conversa' }).inputValue(), tituloAtivo);
    await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('');
    console.log(
        'Navegação: telas, catálogo, rascunhos, sidebar, menu por mouse e teclado, exportação e exclusão validados.',
    );
}
