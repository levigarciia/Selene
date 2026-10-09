import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { setTimeout as esperar } from 'node:timers/promises';
import { esquemaDados, type Conversa } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'contexto-imagens-'));
const modelo = process.env.SELENE_TESTE_GGUF;
const projetor = process.env.SELENE_TESTE_PROJETOR;
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: { backend: 'vulkan', contexto: 16384, maxTokens: 512, temperatura: 0 },
    modelos: [],
    conversas: [],
});
const conversaId = randomUUID();
const cancelamentoId = randomUUID();
if (modelo) {
    dados.modelos.push({ id: randomUUID(), nome: 'Modelo de validação', caminho: resolve(modelo), tamanho: 0 });
    dados.conversas.push({
        id: conversaId,
        titulo: 'Validação de compactação',
        modo: 'chat',
        projeto: null,
        acessoCompleto: false,
        modeloId: dados.modelos[0].id,
        atualizadoEm: new Date().toISOString(),
        mensagens: [
            {
                id: randomUUID(),
                papel: 'user',
                texto:
                    'A senha fictícia da tarefa é turquesa. Preserve essa palavra. ' +
                    'Registro de diagnóstico sem alteração de arquivos. '.repeat(420),
                estado: 'concluida',
                acoes: [],
                criadoEm: new Date().toISOString(),
            },
            {
                id: randomUUID(),
                papel: 'assistant',
                texto: 'Registrado: turquesa. A escrita foi recusada. ' + 'Aguardando revisão. '.repeat(180),
                estado: 'concluida',
                acoes: [],
                criadoEm: new Date().toISOString(),
            },
        ],
    });
    dados.conversas.push({
        ...structuredClone(dados.conversas[0]),
        id: cancelamentoId,
        titulo: 'Validação de cancelamento',
    });
}
await writeFile(resolve(pasta, 'selene.json'), JSON.stringify(dados));
if (process.env.SELENE_TESTE_RUNTIME)
    await symlink(resolve(process.env.SELENE_TESTE_RUNTIME), resolve(pasta, 'runtime'), 'junction');
const ambiente: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, SELENE_TESTE: '1', SELENE_TESTE_DADOS: pasta }).filter(
        (entrada): entrada is [string, string] => typeof entrada[1] === 'string',
    ),
);
delete ambiente.ELECTRON_RUN_AS_NODE;
let aplicativo: ElectronApplication | undefined;
const abrir = () =>
    electron.launch({
        executablePath: resolve('node_modules/electron/dist/electron.exe'),
        args: ['.'],
        env: ambiente,
        timeout: 30000,
    });

async function concluida(pagina: Page, id: string): Promise<Conversa> {
    for (let tentativa = 0; tentativa < 480; tentativa++) {
        const estado = await pagina.evaluate(() => window.selene!.estado());
        if (!estado.ok) throw new Error(estado.erro);
        const conversa = estado.valor.conversas.find((conversa) => conversa.id === id)!;
        const ultima = conversa.mensagens.at(-1);
        if (!estado.valor.conversaEmExecucao && ultima?.papel === 'assistant' && ultima.estado !== 'gerando') {
            assert.equal(ultima.estado, 'concluida', ultima.texto);
            return conversa;
        }
        await esperar(500);
    }
    throw new Error('A geração não terminou dentro de quatro minutos.');
}

try {
    aplicativo = await abrir();
    let pagina = await aplicativo.firstWindow();
    const erros: string[] = [];
    const observar = (pagina: Page) => pagina.on('pageerror', (erro) => erros.push(erro.message));
    observar(pagina);
    await pagina.getByRole('button', { name: 'Anexar imagens', exact: true }).waitFor();
    const desenho = await pagina.evaluate(() => {
        const tela = document.createElement('canvas');
        tela.width = 480;
        tela.height = 360;
        const pincel = tela.getContext('2d')!;
        pincel.fillStyle = 'white';
        pincel.fillRect(0, 0, 480, 360);
        pincel.fillStyle = '#ef2222';
        pincel.beginPath();
        pincel.arc(240, 180, 110, 0, Math.PI * 2);
        pincel.fill();
        return tela.toDataURL('image/png');
    });
    const arquivo = resolve(pasta, 'circulo.png');
    await writeFile(arquivo, Buffer.from(desenho.split(',')[1], 'base64'));
    await pagina.locator('[data-ui~="tela-conversa"]:visible').getByLabel('Selecionar imagens').setInputFiles(arquivo);
    await pagina.getByRole('button', { name: 'Ampliar circulo.png' }).waitFor();
    await pagina.getByRole('button', { name: 'Ampliar circulo.png' }).click();
    await pagina.getByRole('dialog').waitFor();
    await pagina.getByRole('button', { name: 'Fechar diálogo', exact: true }).click();
    await pagina.getByRole('button', { name: 'Remover circulo.png' }).click();
    await pagina.getByRole('button', { name: 'Ampliar circulo.png' }).waitFor({ state: 'detached' });

    for (const tipo of ['paste', 'drop']) {
        await pagina.evaluate(
            ({ desenho, tipo }) => {
                const bytes = Uint8Array.from(atob(desenho.split(',')[1]), (caractere) => caractere.charCodeAt(0));
                const transferencia = new DataTransfer();
                transferencia.items.add(new File([bytes], `${tipo}.png`, { type: 'image/png' }));
                const alvo =
                    tipo === 'paste'
                        ? document.querySelector('textarea')!
                        : document.querySelector('form[data-ui~="entrada"]')!;
                alvo.dispatchEvent(
                    tipo === 'paste'
                        ? new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transferencia })
                        : new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transferencia }),
                );
            },
            { desenho, tipo },
        );
        await pagina.getByRole('button', { name: `Ampliar ${tipo}.png` }).waitFor();
    }
    await pagina.screenshot({ path: 'artifacts/selene-anexos.png' });
    await pagina.getByRole('button', { name: 'Remover paste.png' }).click();
    await pagina.getByRole('button', { name: 'Remover drop.png' }).click();
    const invalida = await pagina.evaluate(() =>
        window.selene!.anexarImagens([{ nome: 'Inválida.png', dados: 'data:image/png;base64,aW52YWxpZG8=' }]),
    );
    assert.equal(invalida.ok, false);
    for (const mime of ['image/png', 'image/jpeg', 'image/webp']) {
        const formato = await pagina.evaluate((mime) => {
            const tela = document.createElement('canvas');
            tela.width = 2000;
            tela.height = 1000;
            const pincel = tela.getContext('2d')!;
            pincel.fillStyle = 'red';
            pincel.fillRect(0, 0, 2000, 1000);
            return tela.toDataURL(mime);
        }, mime);
        const nome = `Formato.${mime.split('/')[1]}`;
        await pagina
            .locator('[data-ui~="tela-conversa"]:visible')
            .getByLabel('Selecionar imagens')
            .setInputFiles({ name: nome, mimeType: mime, buffer: Buffer.from(formato.split(',')[1], 'base64') });
        const previa = pagina.getByRole('button', { name: `Ampliar ${nome}`, exact: true });
        await previa.waitFor();
        const tamanho = await previa.locator('img').evaluate(async (imagem: HTMLImageElement) => {
            if (!imagem.complete)
                await new Promise<void>((resolver) =>
                    imagem.addEventListener('load', () => resolver(), { once: true }),
                );
            return { largura: imagem.naturalWidth, altura: imagem.naturalHeight };
        });
        assert.equal(tamanho.largura, 1536);
        assert.equal(tamanho.altura, 768);
        await pagina.getByRole('button', { name: `Remover ${nome}`, exact: true }).click();
    }
    console.log('Imagens: seleção, colagem, arraste, remoção, ampliação e validação nativa passaram.');

    if (modelo) {
        await pagina.getByRole('button', { name: 'Validação de compactação', exact: true }).click();
        await pagina
            .getByRole('textbox', { name: 'Mensagem', exact: true })
            .fill('Qual é a palavra fictícia? Responda só a palavra.');
        await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
        await pagina.getByText('Compactando contexto', { exact: true }).waitFor({ timeout: 180000 });
        const conversa = await concluida(pagina, conversaId);
        assert.ok(conversa.contextoCompactado);
        assert.equal(conversa.mensagens.length, 4);
        assert.match(conversa.mensagens.at(-1)!.texto, /turquesa/i);
        assert.ok(conversa.mensagens.at(-1)?.compactacoes?.length);
        await pagina.getByText('Contexto compactado automaticamente', { exact: true }).waitFor();
        await pagina.screenshot({ path: 'artifacts/selene-compactacao.png' });
        console.log('Compactação com GGUF real: resumo, continuação e preservação da palavra passaram.');
        await pagina.getByRole('button', { name: 'Validação de cancelamento', exact: true }).click();
        await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Continue a revisão.');
        await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
        await pagina.getByText('Compactando contexto', { exact: true }).waitFor();
        await pagina.getByRole('button', { name: 'Interromper tarefa', exact: true }).click();
        let cancelada = false;
        for (let tentativa = 0; tentativa < 60; tentativa++) {
            const estado = await pagina.evaluate(() => window.selene!.estado());
            if (estado.ok && !estado.valor.conversaEmExecucao) {
                const conversa = estado.valor.conversas.find((conversa) => conversa.id === cancelamentoId)!;
                assert.equal(conversa.mensagens.at(-1)?.estado, 'interrompida');
                assert.equal(conversa.contextoCompactado, undefined);
                cancelada = true;
                break;
            }
            await esperar(250);
        }
        assert.equal(cancelada, true);
        console.log('Cancelamento durante a compactação real preservou o histórico e liberou a conversa.');
        const semVisao = await pagina.evaluate(async (desenho) => {
            const ponte = window.selene!;
            const imagens = await ponte.anexarImagens([{ nome: 'circulo.png', dados: desenho }]);
            if (!imagens.ok) throw new Error(imagens.erro);
            const conversa = await ponte.novaConversa('chat');
            if (!conversa.ok) throw new Error(conversa.erro);
            const envio = await ponte.enviar(conversa.valor.id, '', [imagens.valor[0].id]);
            await ponte.descartarImagens([imagens.valor[0].id]);
            return envio;
        }, desenho);
        assert.equal(semVisao.ok, false);
        if (!semVisao.ok) assert.match(semVisao.erro, /sem suporte visual ativo/);

        if (projetor) {
            const idModelo = dados.modelos[0].id;
            await aplicativo.evaluate(({ dialog }, caminho) => {
                dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [caminho] });
            }, resolve(projetor));
            const importado = await pagina.evaluate((id) => window.selene!.importarProjetor(id), idModelo);
            assert.ok(importado.ok, !importado.ok ? importado.erro : '');
            await pagina.getByRole('button', { name: 'Nova conversa', exact: true }).first().click();
            await pagina.getByLabel('Selecionar imagens').setInputFiles(arquivo);
            await pagina.getByRole('button', { name: 'Ampliar circulo.png', exact: true }).waitFor();
            await pagina
                .getByRole('textbox', { name: 'Mensagem', exact: true })
                .fill('Qual é a cor e a forma da figura no centro? Responda em uma frase curta.');
            await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
            let visualId = '';
            for (let tentativa = 0; tentativa < 60; tentativa++) {
                const estado = await pagina.evaluate(() => window.selene!.estado());
                if (!estado.ok) throw new Error(estado.erro);
                const conversa = estado.valor.conversas.find((conversa) => conversa.mensagens[0]?.imagens?.length);
                if (conversa) {
                    visualId = conversa.id;
                    break;
                }
                await esperar(500);
            }
            assert.ok(visualId, 'O envio pela interface deve registrar a imagem na nova conversa.');
            const visual = await concluida(pagina, visualId);
            assert.match(visual.mensagens.at(-1)!.texto, /vermelh|red/i);
            assert.match(visual.mensagens.at(-1)!.texto, /c[ií]rculo|circular|circle/i);
            const renomeada = await pagina.evaluate(
                (id) => window.selene!.alterarConversa(id, { titulo: 'Validação visual' }),
                visualId,
            );
            assert.ok(renomeada.ok);
            await pagina.getByRole('button', { name: 'Validação visual', exact: true }).click();
            await pagina.getByRole('button', { name: 'Ampliar circulo.png' }).waitFor();
            await pagina.screenshot({ path: 'artifacts/selene-visao.png' });
            console.log('Visão com GGUF real: projetor importado e círculo vermelho identificado.');
        }
    }
    assert.equal(erros.length, 0, erros.join('\n'));
    await aplicativo.close();
    aplicativo = await abrir();
    pagina = await aplicativo.firstWindow();
    observar(pagina);
    await pagina.getByRole('button', { name: 'Anexar imagens', exact: true }).waitFor();
    const restaurados = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(restaurados.ok);
    if (modelo) {
        assert.equal(restaurados.valor.conversas.find((conversa) => conversa.id === conversaId)?.mensagens.length, 4);
        assert.ok(
            restaurados.valor.conversas.find((conversa) => conversa.id === conversaId)?.contextoCompactado?.resumo,
        );
    }
    if (projetor) {
        const visual = restaurados.valor.conversas.find((conversa) => conversa.titulo === 'Validação visual')!;
        assert.ok(visual.mensagens[0].imagens?.length);
        await pagina.getByRole('button', { name: 'Validação visual', exact: true }).click();
        await pagina.getByRole('button', { name: 'Ampliar circulo.png' }).waitFor();
        const exportacao = resolve(pasta, 'visual.md');
        await aplicativo.evaluate(({ dialog }, caminho) => {
            dialog.showSaveDialog = async () => ({ canceled: false, filePath: caminho });
        }, exportacao);
        const exportada = await pagina.evaluate((id) => window.selene!.exportarConversa(id), visual.id);
        assert.ok(exportada.ok);
        assert.match(await readFile(exportacao, 'utf8'), /data:image\/jpeg;base64/);
        console.log('Anexos persistentes e exportação com imagens passaram.');
    }
    await pagina.setViewportSize({ width: 840, height: 620 });
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    assert.equal(erros.length, 0, erros.join('\n'));
    console.log('Reinício e janela mínima passaram.');
    console.log(`Perfil isolado: ${pasta}`);
} finally {
    await aplicativo?.close();
}
