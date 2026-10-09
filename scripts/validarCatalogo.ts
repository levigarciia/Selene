import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { setTimeout as esperar } from 'node:timers/promises';
import type { Page } from 'playwright';
import { catalogoModelos } from '../shared/catalogo';
import type { Estado } from '../shared/contratos';

async function aguardarEstado(pagina: Page, condicao: (estado: Estado) => boolean, prazo = 15000): Promise<Estado> {
    const inicio = Date.now();
    let ultimoAviso = inicio;
    while (Date.now() - inicio < prazo) {
        const resultado = await pagina.evaluate(() => window.selene!.estado());
        assert.ok(resultado.ok);
        if (condicao(resultado.valor)) return resultado.valor;
        if (Date.now() - ultimoAviso >= 20000) {
            const download = resultado.valor.downloads.at(-1);
            console.log(`Download: ${download?.fase}, ${Math.floor((download?.recebido ?? 0) / 1024 ** 2)} MB.`);
            ultimoAviso = Date.now();
        }
        await esperar(200);
    }
    throw new Error('O estado esperado não foi atingido no prazo da validação.');
}

/** Verifica navegação, busca, filtros, favoritos e validação IPC do catálogo no aplicativo desktop. */
export async function validarCatalogo(pagina: Page): Promise<void> {
    await pagina.getByRole('button', { name: 'Explorar modelos', exact: true }).click();
    const catalogo = pagina.getByRole('dialog', { name: 'Catálogo de modelos' });
    await catalogo.waitFor();
    assert.equal(await catalogo.locator('.item-catalogo').count(), catalogoModelos.length);
    await pagina.getByRole('button', { name: 'Família Qwen', exact: true }).click();
    assert.equal(await catalogo.locator('.item-catalogo').count(), 4);
    await pagina.getByRole('textbox', { name: 'Buscar modelos' }).fill('9B');
    assert.equal(await catalogo.locator('.item-catalogo').count(), 1);
    await pagina.getByRole('button', { name: 'Favoritar Qwen3.5 9B', exact: true }).click();
    await aguardarEstado(pagina, (estado) => estado.favoritosCatalogo.includes('qwen3.5-9b-q4'));
    await pagina.getByRole('textbox', { name: 'Buscar modelos' }).fill('');
    await pagina.getByRole('button', { name: 'Modelos favoritos', exact: true }).click();
    await catalogo.locator('.item-catalogo').first().waitFor();
    assert.equal(await catalogo.locator('.item-catalogo').count(), 1);
    await pagina.getByRole('button', { name: 'Todos os modelos', exact: true }).click();
    assert.equal(await catalogo.locator('.item-catalogo').first().locator('strong').innerText(), 'Qwen3.5 9B');
    const icones = catalogo.locator('.item-catalogo .icone-modelo');
    assert.equal(await icones.count(), catalogoModelos.length);
    assert.ok(await icones.first().evaluate((elemento) => getComputedStyle(elemento).maskImage !== 'none'));
    await pagina.screenshot({ path: 'artifacts/selene-catalogo.png' });
    await pagina.getByRole('button', { name: 'Mostrar somente disponíveis', exact: true }).click();
    await pagina.getByText('Nenhum modelo encontrado', { exact: true }).waitFor();
    await pagina.getByRole('button', { name: 'Mostrar somente disponíveis', exact: true }).click();
    await pagina.getByRole('textbox', { name: 'Buscar modelos' }).fill('modelo inexistente');
    await pagina.getByText('Nenhum modelo encontrado', { exact: true }).waitFor();
    await pagina.getByRole('textbox', { name: 'Buscar modelos' }).fill('');
    const invalido = await pagina.evaluate(() => window.selene!.baixarModelo('../modelo-arbitrario'));
    assert.equal(invalido.ok, false);
    await pagina.keyboard.press('Escape');
    assert.equal(await catalogo.count(), 0);
    console.log('Catálogo: lista, famílias, busca, favoritos, filtros e IPC validados.');
}

/** Valida um download externo completo e a seleção do modelo, sem substituir arquivos do usuário. */
export async function validarDownloadReal(pagina: Page, id: string): Promise<string> {
    const item = catalogoModelos.find((modelo) => modelo.id === id);
    assert.ok(item, 'O modelo de validação deve pertencer ao catálogo.');
    await pagina.getByRole('button', { name: 'Modelo da conversa', exact: true }).click();
    await pagina.getByRole('button', { name: 'Baixar ' + item.nome, exact: true }).click();
    await pagina.getByRole('button', { name: 'Cancelar download de ' + item.nome, exact: true }).waitFor();
    await pagina.getByRole('button', { name: 'Cancelar download de ' + item.nome, exact: true }).click();
    await aguardarEstado(pagina, (estado) =>
        estado.downloads.some((download) => download.catalogoId === id && download.fase === 'cancelado'),
    );
    await pagina.getByRole('button', { name: 'Baixar ' + item.nome, exact: true }).click();
    console.log(`Download externo iniciado: ${item.nome}.`);
    await aguardarEstado(
        pagina,
        (estado) =>
            estado.downloads.some(
                (download) => download.catalogoId === id && ['concluido', 'erro'].includes(download.fase),
            ),
        900000,
    );
    const resultado = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(resultado.ok);
    const download = resultado.valor.downloads.find((atual) => atual.catalogoId === id);
    assert.equal(download?.fase, 'concluido', download?.erro ?? 'O download deve terminar sem erros.');
    const modelo = resultado.valor.modelos.find((atual) => atual.catalogoId === id);
    assert.ok(modelo);
    assert.equal((await stat(modelo.caminho)).size, item.tamanho);
    await pagina.screenshot({ path: 'artifacts/selene-catalogo-baixado.png' });
    await pagina.getByRole('button', { name: 'Usar ' + item.nome, exact: true }).click();
    await aguardarEstado(pagina, (estado) => estado.conversas.some((conversa) => conversa.modeloId === modelo.id));
    console.log(`Download GGUF, cancelamento, SHA 256 e seleção validados: ${item.nome}.`);
    return modelo.caminho;
}
