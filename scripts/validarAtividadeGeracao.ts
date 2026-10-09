import { _electron as electron } from 'playwright';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { esquemaDados, type Estado, type Evento } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'atividade-'));
const id = randomUUID();
const mensagemId = randomUUID();
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [],
    conversas: [
        {
            id,
            titulo: 'Validação de atividade',
            modo: 'chat',
            atualizadoEm: new Date().toISOString(),
            mensagens: [
                {
                    id: mensagemId,
                    papel: 'assistant',
                    texto: 'Resultado preservado.',
                    estado: 'concluida',
                    raciocinio: 'Vou conferir os dados antes de responder.',
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
    }).filter((entrada): entrada is [string, string] => typeof entrada[1] === 'string'),
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
    await pagina.getByRole('button', { name: 'Validação de atividade', exact: true }).click();
    await pagina.locator('[data-ui~="raciocinio-mensagem"]').waitFor();
    const resultado = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(resultado.ok);
    const estado: Estado = resultado.valor;
    const mensagem = estado.conversas[0].mensagens[0];
    async function publicar() {
        const evento: Evento = { tipo: 'estado', estado };
        await app.evaluate(({ BrowserWindow }, evento) => {
            BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', evento);
        }, evento);
    }
    mensagem.estado = 'gerando';
    mensagem.texto = '';
    mensagem.faseGeracao = 'raciocinando';
    estado.conversaEmExecucao = id;
    await publicar();
    await pagina.locator('[data-ui~="raciocinio-mensagem"][open] [data-ui~="texto-em-andamento"]').waitFor();
    assert.equal(
        await pagina.locator('[data-ui~="conteudo"]').getByText('Trabalhando', { exact: true }).count(),
        0,
    );
    await pagina.screenshot({ path: 'artifacts/selene-raciocinio-ativo.png' });
    mensagem.faseGeracao = 'respondendo';
    mensagem.texto = 'Resposta final em streaming.';
    await publicar();
    await pagina.locator('[data-ui~="raciocinio-mensagem"]:not([open])').waitFor();
    assert.equal(await pagina.locator('[data-ui~="texto-em-andamento"]').count(), 0);
    mensagem.acoes = [
        {
            id: 'acao',
            nome: 'ler_arquivo',
            argumentos: { caminho: 'exemplo.txt' },
            estado: 'executando',
            resultado: '',
        },
    ];
    await publicar();
    await pagina.locator('[data-ui~="acao"] [data-ui~="texto-em-andamento"]').waitFor();
    estado.conversaEmExecucao = null;
    await publicar();
    await pagina.waitForFunction(() => document.querySelectorAll('[data-ui~="texto-em-andamento"]').length === 0);
    mensagem.estado = 'concluida';
    mensagem.acoes[0].estado = 'concluida';
    delete mensagem.faseGeracao;
    await publicar();
    await pagina.locator('[data-ui~="raciocinio-mensagem"] summary').click();
    await pagina.locator('[data-ui~="raciocinio-mensagem"][open]').waitFor();
    await pagina.screenshot({ path: 'artifacts/selene-raciocinio-concluido.png' });
    assert.deepEqual(erros, []);
    console.log('Interface validada: raciocínio em streaming, resposta, ação e encerramento sem brilho residual.');
} finally {
    await app.close();
}
