import { _electron as electron } from 'playwright';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { esquemaDados, type Evento } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'sidebar-'));
const projeto = resolve(pasta, 'Selene');
const outroProjeto = resolve(pasta, 'Outro', 'Selene');
await mkdir(projeto, { recursive: true });
await mkdir(outroProjeto, { recursive: true });
const conversas = Array.from({ length: 9 }, (_, indice) => ({
    id: randomUUID(),
    titulo: `Conversa Code ${indice + 1}`,
    modo: 'code',
    concluida: indice > 0,
    encerradaEm: indice > 0 ? new Date(Date.now() - indice * 60000).toISOString() : undefined,
    projeto,
    atualizadoEm: new Date(Date.now() - indice * 60000).toISOString(),
    mensagens: [
        {
            id: randomUUID(),
            papel: 'assistant',
            texto: 'Resposta salva.',
            estado: 'concluida',
            criadoEm: new Date().toISOString(),
            desempenho:
                indice === 1
                    ? { tokensGerados: 100, tokensEntrada: 50, tempoGeracaoMs: 2000, tokensPorSegundo: 50 }
                    : undefined,
        },
    ],
}));
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [],
    conversas: [
        ...conversas,
        { ...conversas[0], id: randomUUID(), titulo: 'Projeto homônimo', projeto: outroProjeto },
        { ...conversas[0], id: randomUUID(), titulo: 'Chat pessoal', modo: 'chat' },
    ],
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
    electron.launch({ executablePath: resolve('node_modules/electron/dist/electron.exe'), args: ['.'], env: ambiente });
let app = await abrir();
try {
    let pagina = await app.firstWindow();
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await pagina.getByRole('button', { name: 'Chat pessoal', exact: true }).waitFor();
    assert.equal(await pagina.getByRole('button', { name: 'Conversa Code 1', exact: true }).count(), 0);
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('button', { name: 'Conversa Code 1', exact: true }).click();
    assert.equal(
        await pagina
            .getByRole('button', { name: 'Conversa Code 1', exact: true })
            .getByText('Pronto', { exact: true })
            .evaluate((elemento) => getComputedStyle(elemento).color),
        'rgb(52, 211, 153)',
    );
    assert.equal(await pagina.getByRole('button', { name: 'Chat pessoal', exact: true }).count(), 0);
    assert.equal(await pagina.locator('[data-ui~="cabecalho-grupo"]').count(), 0);
    assert.equal(await pagina.locator('[data-ui~="ceu-sidebar"] i').count(), 38);
    assert.equal(await pagina.getByRole('button', { name: 'Trabalhando', exact: true }).count(), 0);
    assert.equal(await pagina.locator('[data-ui~="linha-separador"]').count(), 0);
    const posicoes = await pagina.evaluate(() => ({
        atual: document.querySelector('[data-ui~="grupo-atuais"]')!.getBoundingClientRect().bottom,
        concluidas: document.querySelector('[data-ui~="grupo-concluidas"]')!.getBoundingClientRect().top,
        rodape: document.querySelector('[data-ui~="rodape-sidebar"]')!.getBoundingClientRect().top,
    }));
    assert.ok(posicoes.concluidas - posicoes.atual > 200);
    assert.equal(await pagina.locator('[data-ui~="grupo-projeto"]').count(), 0);
    assert.ok(posicoes.rodape - posicoes.concluidas < 80);
    assert.equal(await pagina.locator('[data-ui~="rodape-sidebar"] button').count(), 3);
    assert.equal((await pagina.locator('[data-ui~="rodape-sidebar"]').innerText()).trim(), '');
    await pagina.getByRole('button', { name: 'Concluídas', exact: true }).click();
    await pagina.getByRole('button', { name: 'Mostrar mais 2', exact: true }).click();
    await pagina.getByRole('button', { name: 'Conversa Code 9', exact: true }).waitFor();
    const grupo = pagina.getByRole('region', { name: 'Concluídas', exact: true });
    await grupo.getByRole('button', { name: 'Concluídas', exact: true }).click();
    await pagina.getByRole('button', { name: 'Conversa Code 9', exact: true }).waitFor({ state: 'hidden' });
    await grupo.getByRole('button', { name: 'Concluídas', exact: true }).click();
    await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Rascunho Code preservado');
    await pagina.getByRole('button', { name: 'Chat', exact: true }).click();
    await pagina.getByRole('button', { name: 'Chat pessoal', exact: true }).click();
    await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Rascunho Chat preservado');
    await pagina.getByRole('textbox', { name: 'Buscar conversas', exact: true }).fill('Conversa Code');
    assert.equal(await pagina.locator('[data-ui~="item-conversa"]').count(), 0);
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    assert.equal(
        await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).inputValue(),
        'Rascunho Code preservado',
    );
    await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('');
    await pagina.getByRole('button', { name: 'Conversa Code 1', exact: true }).click({ button: 'right' });
    await pagina.getByRole('menuitem', { name: 'Concluir conversa', exact: true }).click();
    await grupo.getByRole('button', { name: 'Conversa Code 1', exact: true }).waitFor();
    await grupo.getByRole('button', { name: 'Conversa Code 1', exact: true }).click({ button: 'right' });
    await pagina.getByRole('menuitem', { name: 'Retomar conversa', exact: true }).click();
    await pagina
        .locator('[data-ui~="historico"]')
        .getByRole('button', { name: 'Conversa Code 1', exact: true })
        .waitFor();
    const linha = pagina.locator('[data-ui~="linha-sidebar"]').filter({
        has: pagina.getByRole('button', { name: 'Conversa Code 1', exact: true }),
    });
    await linha.hover();
    await linha.getByRole('button', { name: 'Concluir conversa: Conversa Code 1', exact: true }).click();
    await grupo.getByRole('button', { name: 'Conversa Code 1', exact: true }).waitFor();
    await linha.hover();
    await linha.getByRole('button', { name: 'Retomar conversa: Conversa Code 1', exact: true }).click();
    await pagina
        .locator('[data-ui~="historico"]')
        .getByRole('button', { name: 'Conversa Code 1', exact: true })
        .waitFor();
    await pagina.getByRole('button', { name: 'Nova conversa', exact: true }).click();
    const estadoNovo = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(estadoNovo.ok);
    assert.equal(estadoNovo.valor.conversas[0].modo, 'code');
    assert.equal(estadoNovo.valor.conversas[0].projeto?.toLowerCase(), projeto.toLowerCase());
    assert.equal(estadoNovo.valor.conversas[0].acessoCompleto, false);
    await app.evaluate(({ dialog }) => {
        dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    });
    await pagina.getByRole('button', { name: 'Projeto da conversa', exact: true }).click();
    await pagina.getByRole('menuitem', { name: 'Adicionar projeto', exact: true }).click();
    await pagina.getByRole('button', { name: 'Abrir pasta existente', exact: true }).click();
    await pagina.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await pagina.getByRole('button', { name: 'Voltar à conversa', exact: true }).click();
    await pagina.waitForFunction(
        (quantidade) =>
            window
                .selene!.estado()
                .then((resultado) => resultado.ok && resultado.valor.conversas.length === quantidade),
        estadoNovo.valor.conversas.length,
    );
    const base = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(base.ok);
    const alvo = base.valor.conversas.find((item) => item.titulo === 'Conversa Code 1')!;
    const mensagem = alvo.mensagens[0];
    await grupo.getByRole('button', { name: 'Concluídas', exact: true }).click();
    for (const [estadoAcao, texto] of [
        ['preparando', 'Trabalhando'],
        ['aguardando', 'Aprovação'],
        ['executando', 'Comando'],
    ] as const) {
        mensagem.estado = 'gerando';
        mensagem.acoes = [
            { id: 'terminal', nome: 'executar_terminal', argumentos: {}, estado: estadoAcao, resultado: '' },
        ];
        const evento: Evento = { tipo: 'estado', estado: { ...base.valor, conversaEmExecucao: alvo.id } };
        await app.evaluate(({ BrowserWindow }, evento) => {
            BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', evento);
        }, evento);
        await pagina
            .getByRole('button', { name: 'Conversa Code 1', exact: true })
            .locator('[data-ui~="linha-projeto-conversa"]')
            .getByText(texto, { exact: true })
            .waitFor();
        const secaoEsperada =
            estadoAcao === 'aguardando' ? '[data-ui~="grupo-atuais"]' : '[data-ui~="grupo-trabalhando"]';
        await pagina.locator(secaoEsperada).getByRole('button', { name: 'Conversa Code 1', exact: true }).waitFor();
        if (estadoAcao === 'executando') {
            await pagina.getByRole('img', { name: 'Comando em execução', exact: true }).waitFor();
            const ordem = await pagina.evaluate(() => ({
                trabalhando: document.querySelector('[data-ui~="grupo-trabalhando"]')!.getBoundingClientRect().top,
                concluidas: document.querySelector('[data-ui~="grupo-concluidas"]')!.getBoundingClientRect().top,
            }));
            assert.ok(ordem.trabalhando < ordem.concluidas);
        }
        await pagina.mouse.move(700, 300);
        await pagina.screenshot({ path: 'artifacts/selene-sidebar-' + estadoAcao + '.png' });
    }
    await app.evaluate(
        ({ BrowserWindow }, estado) => {
            BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', { tipo: 'estado', estado });
        },
        { ...base.valor, conversaEmExecucao: null },
    );
    mensagem.estado = 'concluida';
    mensagem.acoes = [];
    await app.evaluate(
        ({ BrowserWindow }, estado) => {
            BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', { tipo: 'estado', estado });
        },
        { ...base.valor, conversaEmExecucao: null },
    );
    await pagina
        .locator('[data-ui~="historico"]')
        .getByRole('button', { name: 'Conversa Code 1', exact: true })
        .getByText('Pronto', { exact: true })
        .waitFor();
    await pagina.getByRole('button', { name: 'Chat', exact: true }).click();
    assert.equal(
        await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).inputValue(),
        'Rascunho Chat preservado',
    );
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.screenshot({ path: 'artifacts/selene-sidebar-estados.png' });
    await pagina.getByRole('button', { name: 'Recolher sidebar' }).click();
    assert.equal(
        await pagina.locator('[data-ui~="sidebar"]').evaluate((item) => item.getBoundingClientRect().width),
        72,
    );
    await app.close();
    app = await abrir();
    pagina = await app.firstWindow();
    await pagina.getByRole('button', { name: 'Expandir sidebar' }).click();
    const persistidos = JSON.parse(await readFile(resolve(pasta, 'selene.json'), 'utf8'));
    assert.equal(persistidos.conversas.length, base.valor.conversas.length);
    assert.equal(persistidos.conversas[0].projeto?.toLowerCase(), projeto.toLowerCase());
    assert.equal(
        persistidos.conversas.find((item: { titulo: string }) => item.titulo === 'Conversa Code 2').concluida,
        true,
    );
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('button', { name: 'Estatísticas', exact: true }).click();
    const estatisticas = pagina.getByRole('dialog', { name: 'Estatísticas', exact: true });
    assert.equal(await estatisticas.locator('[data-ui~="total-estatisticas"] strong').innerText(), '150');
    await estatisticas.getByRole('button', { name: 'Mês', exact: true }).click();
    await estatisticas.getByRole('button', { name: 'Total', exact: true }).click();
    await pagina.keyboard.press('Escape');
    assert.equal(
        await pagina.getByRole('button', { name: 'Procurar atualizações', exact: true }).getAttribute('aria-disabled'),
        'true',
    );
    await pagina.getByRole('button', { name: 'Concluídas', exact: true }).click({ button: 'right' });
    await pagina.getByRole('menuitem', { name: 'Apagar todos os chats concluídos', exact: true }).click();
    await pagina.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await pagina.getByRole('button', { name: 'Concluídas', exact: true }).focus();
    await pagina.keyboard.press('Shift+F10');
    await pagina.getByRole('menuitem', { name: 'Apagar todos os chats concluídos', exact: true }).click();
    await pagina.getByRole('button', { name: 'Apagar todos', exact: true }).click();
    await pagina.getByRole('button', { name: 'Concluídas', exact: true }).waitFor({ state: 'hidden' });
    const restantes = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(restantes.ok);
    assert.equal(restantes.valor.conversas.length, base.valor.conversas.length - 8);
    assert.ok(restantes.valor.conversas.some((item) => item.titulo === 'Chat pessoal'));
    assert.ok(restantes.valor.conversas.some((item) => item.titulo === 'Conversa Code 1'));
    assert.equal(restantes.valor.registrosUso.length, 1);
    await pagina.getByRole('button', { name: 'Estatísticas', exact: true }).click();
    assert.equal(await estatisticas.locator('[data-ui~="total-estatisticas"] strong').innerText(), '150');
    await pagina.keyboard.press('Escape');
    await pagina.screenshot({ path: 'artifacts/selene-sidebar-final.png' });
    const dimensoes = pagina.viewportSize();
    await pagina.setViewportSize({ width: 420, height: 760 });
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('heading', { name: 'Em que vamos trabalhar?', exact: true }).waitFor();
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await pagina.screenshot({ path: 'artifacts/selene-sidebar-estreita.png' });
    await pagina.setViewportSize(dimensoes ?? { width: 1280, height: 840 });
    assert.equal(erros.length, 0, erros.join('\n'));
    console.log('Sidebar: modos separados, rascunhos, estados, conclusão, retomada e reinício passaram no Electron.');
    console.log('Estados: eventos IPC controlados de preparação, aprovação e comando passaram na interface.');
    console.log('Rodapé, posição das categorias, hover, exclusão em lote e preservação de estatísticas passaram.');
} finally {
    await app.close();
}
