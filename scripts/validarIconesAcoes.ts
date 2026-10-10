import { _electron as electron } from 'playwright';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { esquemaDados, type Acao, type Evento } from '../shared/contratos';
import { interpretarPreviaArgumentos } from '../electron/services/argumentos';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'icones-acoes-'));
const exemplos: { nome: string; argumentos: Record<string, unknown>; icone: string }[] = [
    { nome: 'listar_arquivos', argumentos: { caminho: 'src' }, icone: 'leitura' },
    { nome: 'ler_arquivo', argumentos: { caminho: 'package.json' }, icone: 'leitura' },
    { nome: 'escrever_arquivo', argumentos: { caminho: 'novo.ts' }, icone: 'edicao' },
    { nome: 'editar_arquivo', argumentos: { caminho: 'agente.ts' }, icone: 'edicao' },
    { nome: 'pesquisar_web', argumentos: { consulta: 'Documentação do Electron' }, icone: 'web' },
    { nome: 'ler_pagina_web', argumentos: { url: 'https://www.electronjs.org' }, icone: 'web' },
    { nome: 'controlar_navegador', argumentos: { acao: 'observar' }, icone: 'navegador' },
    { nome: 'executar_terminal', argumentos: { comando: 'bun run dev' }, icone: 'terminal' },
    { nome: 'executar_terminal', argumentos: { comando: 'rg motor electron' }, icone: 'pesquisa' },
    { nome: 'executar_terminal', argumentos: { comando: 'bun run build' }, icone: 'compilacao' },
    { nome: 'atualizar_plano', argumentos: { etapas: [] }, icone: 'concluido' },
    { nome: 'ferramenta_desconhecida', argumentos: {}, icone: 'ferramenta' },
];
const acoes: Acao[] = exemplos.map((exemplo) => ({
    id: randomUUID(),
    nome: exemplo.nome,
    argumentos: exemplo.argumentos,
    estado: 'concluida',
    resultado: 'Exemplo visual, sem executar ferramenta.',
    posicaoTexto: 'Ícones contextuais da Selene.'.length,
}));
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [],
    conversas: [
        {
            id: randomUUID(),
            titulo: 'Ícones de ações',
            modo: 'chat',
            atualizadoEm: new Date().toISOString(),
            mensagens: [
                {
                    id: randomUUID(),
                    papel: 'assistant',
                    texto: 'Ícones contextuais da Selene.',
                    estado: 'concluida',
                    acoes,
                    criadoEm: new Date().toISOString(),
                },
            ],
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
const app = await electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'),
    args: ['.'],
    env: ambiente,
});
try {
    const pagina = await app.firstWindow();
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await pagina.getByRole('button', { name: 'Ícones de ações', exact: true }).click();
    await pagina.locator('[data-ui~="icone-acao"]').first().waitFor();
    const icones = () =>
        pagina
            .locator('[data-ui~="icone-acao"]')
            .evaluateAll((elementos) => elementos.map((elemento) => elemento.getAttribute('data-icone')));
    const esperados = exemplos.map((exemplo) => exemplo.icone);
    assert.deepEqual(await icones(), esperados);
    assert.equal(await pagina.locator('[data-icone="t3-code"]').count(), 0);
    await pagina.screenshot({ path: 'artifacts/selene-icones-acoes.png' });
    const atual = await pagina.evaluate(() => window.selene!.estado());
    assert(atual.ok);
    const estado = atual.valor;
    const escrita = estado.conversas[0].mensagens[0].acoes.find((acao) => acao.nome === 'escrever_arquivo')!;
    escrita.estado = 'preparando';
    const fragmentos = [
        '{"caminho":"clientes.txt","conteudo":"Primeiro cliente',
        '{"caminho":"clientes.txt","conteudo":"Primeiro cliente\\nSegundo cliente',
    ];
    for (const fragmento of fragmentos) {
        escrita.argumentos = interpretarPreviaArgumentos(fragmento);
        await app.evaluate(({ BrowserWindow }, evento: Evento) => {
            BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', evento);
        }, { tipo: 'estado', estado });
        const bloco = pagina.locator('[data-ui~="acao"][data-estado="preparando"]');
        const previa = bloco.locator('[data-ui="previa-acao"]');
        await pagina.waitForFunction((conteudo) => {
            const elemento = document.querySelector('[data-estado="preparando"] [data-ui="previa-acao"]');
            return elemento?.textContent === conteudo;
        }, escrita.argumentos.conteudo);
        assert(await previa.isVisible());
        assert.equal(await bloco.locator('details').getAttribute('open'), '');
        assert.equal(await previa.textContent(), escrita.argumentos.conteudo);
    }
    await pagina.screenshot({ path: 'artifacts/selene-escrita-progressiva.png' });
    for (const situacao of ['preparando', 'executando', 'aguardando', 'erro', 'recusada', 'interrompida'] as const) {
        estado.conversas[0].mensagens[0].acoes.forEach((acao) => {
            acao.estado = situacao;
        });
        const evento: Evento = { tipo: 'estado', estado };
        await app.evaluate(({ BrowserWindow }, evento) => {
            BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', evento);
        }, evento);
        await pagina.locator(`[data-ui~="acao"][data-estado="${situacao}"]`).first().waitFor();
        assert.deepEqual(await icones(), esperados);
    }
    assert.deepEqual(erros, []);
    const mensagem = estado.conversas[0].mensagens[0];
    mensagem.acoes.forEach((acao) => { acao.estado = 'concluida'; });
    mensagem.texto += '\n\nResultado final das ações.';
    await app.evaluate(({ BrowserWindow }, evento: Evento) => {
        BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', evento);
    }, { tipo: 'estado', estado });
    const grupo = pagina.locator('[data-ui="grupo-acoes"]');
    await grupo.waitFor();
    assert.equal(await grupo.getAttribute('open'), null);
    assert.equal(await pagina.locator('[data-ui~="icone-acao"]').first().isVisible(), false);
    await grupo.locator(':scope > summary').click();
    assert(await pagina.locator('[data-ui~="icone-acao"]').first().isVisible());
    assert.deepEqual(await icones(), esperados);
    await grupo.locator(':scope > summary').click();
    assert.equal(await grupo.getAttribute('open'), null);
    assert(await pagina.getByText('Resultado final das ações.', { exact: true }).isVisible());
    await pagina.screenshot({ path: 'artifacts/selene-acoes-agrupadas.png' });
    console.log('Ícones contextuais e conteúdo progressivo de arquivo validados no Electron.');
} finally {
    await app.close();
}
