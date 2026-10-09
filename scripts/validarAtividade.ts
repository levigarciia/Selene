import { _electron as electron } from 'playwright';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { esquemaDados, type Mensagem } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'atividade-'));
const inicio = 'Vou conferir os arquivos.\n\nEste parágrafo deve permanecer inteiro.';
const comentario = '\n\nVou validar a alteração.';
const final = '\n\nConcluído.\n\nA alteração foi validada.';
const mensagem: Mensagem = {
    id: randomUUID(),
    papel: 'assistant',
    texto: inicio + comentario + final,
    estado: 'concluida',
    criadoEm: '2026-10-09T12:00:00.000Z',
    concluidoEm: '2026-10-09T12:01:54.000Z',
    inicioTextoFinal: inicio.length + comentario.length,
    acoes: [
        {
            id: 'plano',
            nome: 'atualizar_plano',
            argumentos: {
                etapas: [
                    { descricao: 'Conferir arquivos', estado: 'concluida' },
                    { descricao: 'Validar alteração', estado: 'concluida' },
                ],
            },
            estado: 'concluida',
            resultado: 'Plano atualizado',
            posicaoTexto: inicio.length,
        },
        {
            id: 'leitura',
            nome: 'ler_arquivo',
            argumentos: { caminho: 'src/exemplo.ts' },
            estado: 'concluida',
            resultado: 'Conteúdo do arquivo',
            posicaoTexto: inicio.length,
        },
        {
            id: 'comando',
            nome: 'executar_terminal',
            argumentos: { comando: 'bun run verificar' },
            estado: 'concluida',
            resultado: 'Validação concluída sem erros',
            posicaoTexto: inicio.length + comentario.length,
        },
    ],
    desempenho: { tokensGerados: 55, tempoGeracaoMs: 1000, tokensPorSegundo: 55 },
};
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [],
    conversas: [
        {
            id: randomUUID(),
            titulo: 'Validação da atividade Code',
            modo: 'code',
            acessoCompleto: true,
            atualizadoEm: new Date().toISOString(),
            mensagens: [mensagem],
        },
    ],
});
await writeFile(resolve(pasta, 'selene.json'), JSON.stringify(dados));
const ambiente = Object.fromEntries(
    Object.entries({
        ...process.env,
        SELENE_TESTE: '1',
        SELENE_TESTE_DADOS: pasta,
    }).filter((item): item is [string, string] => typeof item[1] === 'string'),
);
delete ambiente.ELECTRON_RUN_AS_NODE;
delete ambiente.SELENE_VITE_URL;
const aplicativo = await electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'),
    args: ['.'],
    env: ambiente,
});
try {
    const pagina = await aplicativo.firstWindow();
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await pagina.getByRole('navigation', { name: 'Conversas', exact: true }).waitFor();
    await pagina.screenshot({ path: 'artifacts/selene-atividade-inicial.png' });
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('button', { name: 'Validação da atividade Code', exact: true }).click();
    await pagina.getByText('A alteração foi validada.', { exact: true }).waitFor();
    assert.equal(await pagina.getByText('Este parágrafo deve permanecer inteiro.', { exact: true }).isVisible(), false);
    assert.equal(await pagina.locator('.historico-tarefa').getAttribute('open'), null);
    await pagina.locator('.tarefas-conversa > summary').click();
    assert.equal(await pagina.locator('.tarefas-conversa li').count(), 2);
    await pagina.getByRole('button', { name: 'Ver histórico completo', exact: true }).click();
    await pagina.getByText('Este parágrafo deve permanecer inteiro.', { exact: true }).waitFor();
    await pagina.locator('.acao').last().locator('summary').click();
    await pagina.getByText('Validação concluída sem erros', { exact: true }).waitFor();
    const estilo = await pagina
        .locator('.acao')
        .last()
        .evaluate((elemento) => ({
            borda: getComputedStyle(elemento).borderTopWidth,
            fundo: getComputedStyle(elemento).backgroundColor,
        }));
    assert.equal(estilo.borda, '0px');
    assert.equal(estilo.fundo, 'rgba(0, 0, 0, 0)');
    await pagina.screenshot({ path: 'artifacts/selene-atividade-expandida.png' });
    await pagina.getByRole('button', { name: 'Mostrar tokens por segundo', exact: true }).click();
    await pagina.getByRole('tooltip').getByText('55 tokens/s', { exact: true }).waitFor();
    await pagina.getByRole('button', { name: 'Esconder tokens por segundo', exact: true }).click();
    await pagina.locator('.historico-tarefa > summary').click();
    await pagina.locator('.tarefas-conversa > summary').click();
    await pagina.screenshot({ path: 'artifacts/selene-atividade-concluida.png' });
    await aplicativo.evaluate(({ dialog }, caminho) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [caminho] });
    }, pasta);
    await pagina.getByRole('button', { name: 'Escolher projeto', exact: true }).click();
    const estado = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(estado.ok);
    assert.equal(estado.valor.conversas[0].acessoCompleto, true);
    const emExecucao: Mensagem = {
        ...mensagem,
        estado: 'gerando',
        texto: inicio + comentario,
        concluidoEm: undefined,
        acoes: mensagem.acoes.map((acao) =>
            acao.id === 'comando' ? { ...acao, estado: 'executando', resultado: '' } : acao,
        ),
    };
    await aplicativo.evaluate(
        ({ BrowserWindow }, evento) => {
            BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', evento);
        },
        {
            tipo: 'estado',
            estado: {
                ...estado.valor,
                conversaEmExecucao: dados.conversas[0].id,
                conversas: [{ ...estado.valor.conversas[0], mensagens: [emExecucao] }],
            },
        },
    );
    await pagina.locator('.acao .texto-em-andamento').waitFor();
    assert.equal(await pagina.locator('.historico-tarefa').count(), 0);
    const animacao = await pagina
        .locator('.acao .texto-em-andamento')
        .evaluate((elemento) => getComputedStyle(elemento).animationName);
    assert.equal(animacao, 'brilho-atividade');
    await pagina.screenshot({ path: 'artifacts/selene-atividade-executando.png' });
    await pagina.setViewportSize({ width: 420, height: 760 });
    await pagina.locator('.tarefas-conversa > summary').click();
    assert.ok(
        await pagina.locator('.area-entrada').evaluate((elemento) => elemento.scrollWidth <= elemento.clientWidth),
    );
    await pagina.screenshot({ path: 'artifacts/selene-atividade-estreita.png' });
    await pagina.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(
        await pagina
            .locator('.acao .texto-em-andamento')
            .evaluate((elemento) => getComputedStyle(elemento).animationName),
        'none',
    );
    await aplicativo.evaluate(
        ({ BrowserWindow }, evento) => {
            BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', evento);
        },
        { tipo: 'estado', estado: estado.valor },
    );
    await pagina.getByText('A alteração foi validada.', { exact: true }).waitFor();
    assert.equal(await pagina.locator('.tarefas-conversa').getAttribute('open'), null);
    assert.equal(await pagina.locator('.historico-tarefa').getAttribute('open'), null);
    assert.equal(erros.length, 0, erros.join('\n'));
    console.log(
        'Atividade Code: histórico, tarefas, ações, brilho, movimento reduzido, janela estreita e permissão validados.',
    );
} finally {
    await aplicativo.close();
}
