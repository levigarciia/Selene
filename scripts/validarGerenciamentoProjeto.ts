import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { esquemaDados } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'gerenciamento-projeto-'));
const projetoId = randomUUID();
const projeto = { id: projetoId, nome: 'Aplicativo', caminho: pasta, criadoEm: new Date().toISOString() };
const conversa = (titulo: string, concluida = false) => ({
    id: randomUUID(),
    titulo,
    modo: 'code',
    projeto: pasta,
    projetoId,
    concluida,
    atualizadoEm: new Date().toISOString(),
    mensagens: [
        {
            id: randomUUID(),
            papel: 'assistant',
            texto: 'Resposta salva',
            estado: 'concluida',
            criadoEm: new Date().toISOString(),
        },
    ],
});
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [],
    projetos: [projeto],
    conversas: [conversa('Chat do projeto'), conversa('Chat concluído', true)],
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
const abrir = () =>
    electron.launch({
        executablePath: resolve('node_modules/electron/dist/electron.exe'),
        args: ['.'],
        env: ambiente,
    });
let app = await abrir();
try {
    let pagina = await app.firstWindow();
    pagina.setDefaultTimeout(10000);
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    const obter = async () => {
        const resultado = await pagina.evaluate(() => window.selene!.estado());
        assert.ok(resultado.ok);
        return resultado.valor.projetos.find((item) => item.id === projetoId)!;
    };
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('button', { name: 'Projetos', exact: true }).waitFor();
    await pagina.getByRole('button', { name: 'Chat do projeto', exact: true }).click();
    await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Texto pendente preservado');
    await pagina.getByRole('button', { name: 'Gerenciar projeto Aplicativo', exact: true }).click();
    await pagina.getByRole('heading', { name: 'Projetos', exact: true }).waitFor();
    assert.equal(
        await pagina.locator('.tela-projetos').evaluate((elemento) => getComputedStyle(elemento).display),
        'grid',
    );
    await pagina.getByRole('button', { name: 'Ícone Cubo', exact: true }).click();
    await pagina.waitForFunction(async () => {
        const estado = await window.selene!.estado();
        return (
            estado.ok &&
            estado.valor.projetos[0].icone?.tipo === 'simbolo' &&
            estado.valor.projetos[0].icone.nome === 'cubo'
        );
    });
    await pagina.getByRole('button', { name: 'Cor azul', exact: true }).click();
    await pagina.waitForFunction(async () => {
        const estado = await window.selene!.estado();
        return (
            estado.ok &&
            estado.valor.projetos[0].icone?.tipo === 'simbolo' &&
            estado.valor.projetos[0].icone.cor === 'azul'
        );
    });
    await pagina.screenshot({ path: 'artifacts/selene-gerenciamento-projeto.png' });
    await pagina.getByRole('button', { name: 'Voltar à conversa', exact: true }).click();
    assert.equal(
        await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).inputValue(),
        'Texto pendente preservado',
    );
    assert.equal(await pagina.locator('.breadcrumb-projeto .icone-projeto').getAttribute('fill'), '#8aaddc');
    assert.equal(await pagina.locator('.barra-contexto .gatilho-projeto').count(), 0);
    assert.equal(
        await pagina
            .getByRole('button', { name: 'Chat do projeto', exact: true })
            .locator('.icone-projeto')
            .getAttribute('fill'),
        '#8aaddc',
    );
    await pagina.getByRole('button', { name: 'Concluídas', exact: true }).click();
    assert.equal(
        await pagina
            .getByRole('button', { name: 'Chat concluído', exact: true })
            .locator('.icone-projeto')
            .getAttribute('fill'),
        '#8aaddc',
    );
    await pagina.getByRole('button', { name: 'Projetos', exact: true }).click();
    await pagina.getByLabel('Iniciais', { exact: true }).fill('AB');
    await pagina.getByRole('button', { name: 'Usar iniciais', exact: true }).click();
    await pagina.waitForFunction(async () => {
        const estado = await window.selene!.estado();
        return estado.ok && estado.valor.projetos[0].icone?.tipo === 'iniciais';
    });
    await pagina.getByLabel('Nome do projeto', { exact: true }).fill('Projeto personalizado');
    await pagina.getByRole('button', { name: 'Salvar nome', exact: true }).click();
    await pagina.getByRole('button', { name: 'Projeto personalizado', exact: true }).waitFor();
    await app.evaluate(({ dialog }) => {
        dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    });
    await pagina.getByRole('button', { name: 'Escolher imagem', exact: true }).click();
    assert.equal((await obter()).icone?.tipo, 'iniciais');
    const imagem = resolve(pasta, 'imagem.png');
    const imagemPng = await app.evaluate(({ nativeImage }) => {
        const icone = nativeImage.createFromBitmap(Buffer.from([100, 140, 210, 255]), { width: 1, height: 1 });
        return icone.toPNG().toString('base64');
    });
    await writeFile(imagem, Buffer.from(imagemPng, 'base64'));
    const original = await readFile(imagem);
    await app.evaluate(({ dialog }, caminho) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [caminho] });
    }, imagem);
    await pagina.getByRole('button', { name: 'Escolher imagem', exact: true }).click();
    await pagina.waitForFunction(async () => {
        const estado = await window.selene!.estado();
        return estado.ok && estado.valor.projetos[0].icone?.tipo === 'imagem';
    });
    assert.deepEqual(await readFile(imagem), original);
    await pagina.getByRole('button', { name: 'Voltar à conversa', exact: true }).click();
    const iconeSalvo = (await obter()).icone;
    assert.ok(iconeSalvo?.tipo === 'imagem');
    assert.equal(await pagina.locator('.breadcrumb-projeto img').getAttribute('src'), iconeSalvo.dados);
    assert.equal(
        await pagina
            .getByRole('button', { name: 'Chat do projeto', exact: true })
            .locator('img.icone-projeto')
            .getAttribute('src'),
        iconeSalvo.dados,
    );
    await pagina.getByRole('button', { name: 'Nova conversa', exact: true }).click();
    await pagina.getByRole('button', { name: 'Projeto da conversa', exact: true }).click();
    assert.equal(
        await pagina
            .getByRole('menuitemradio', { name: 'Projeto personalizado', exact: true })
            .locator('img')
            .getAttribute('src'),
        iconeSalvo.dados,
    );
    await pagina.keyboard.press('Escape');
    await app.close();
    app = await abrir();
    pagina = await app.firstWindow();
    pagina.setDefaultTimeout(10000);
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('button', { name: 'Chat do projeto', exact: true }).click();
    assert.equal(await pagina.locator('.breadcrumb-projeto img').getAttribute('src'), iconeSalvo.dados);
    assert.equal(
        await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).inputValue(),
        'Texto pendente preservado',
    );
    await pagina.getByRole('button', { name: 'Gerenciar projeto Projeto personalizado', exact: true }).click();
    await pagina.getByRole('button', { name: 'Restaurar padrão', exact: true }).click();
    await pagina.waitForFunction(async () => {
        const estado = await window.selene!.estado();
        return estado.ok && estado.valor.projetos[0].icone === null;
    });
    await pagina.setViewportSize({ width: 420, height: 760 });
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await pagina.screenshot({ path: 'artifacts/selene-gerenciamento-projeto-estreito.png' });
    assert.equal(erros.length, 0, erros.join('\n'));
    console.log(
        'Gerenciamento: pasta, breadcrumb, símbolos, cores, iniciais, imagem, chats concluídos, reinício e rascunho validados.',
    );
} finally {
    await app.close();
}
