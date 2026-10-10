import { _electron as electron } from 'playwright';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { esquemaDados, type Evento } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'resumo-trabalho-'));
const comentario = 'Vou investigar os arquivos.\n\n';
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [],
    conversas: [
        {
            id: randomUUID(),
            titulo: 'Resumo da tarefa',
            modo: 'code',
            atualizadoEm: new Date().toISOString(),
            mensagens: [
                {
                    id: randomUUID(),
                    papel: 'assistant',
                    estado: 'concluida',
                    texto: comentario + 'Alteração validada.',
                    raciocinio: 'Verificando a implementação.',
                    inicioTextoFinal: comentario.length,
                    criadoEm: '2026-10-10T10:00:00Z',
                    concluidoEm: '2026-10-10T10:04:37Z',
                    acoes: [
                        {
                            id: 'plano',
                            nome: 'atualizar_plano',
                            estado: 'concluida',
                            posicaoTexto: comentario.length,
                            argumentos: { etapas: [{ descricao: 'Corrigir interface', estado: 'concluida' }] },
                            resultado: 'concluida: Corrigir interface',
                        },
                    ],
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
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('button', { name: 'Resumo da tarefa', exact: true }).click();
    await pagina.getByText('Alteração validada.', { exact: true }).waitFor();
    const resumo = pagina.locator('[data-ui="resumo-trabalho"]');
    assert.equal(await resumo.getAttribute('open'), null);
    assert.equal(await pagina.getByText('Vou investigar os arquivos.', { exact: true }).isVisible(), false);
    await resumo.locator('summary').first().click();
    await pagina.getByText('Vou investigar os arquivos.', { exact: true }).waitFor();
    await pagina.locator('[data-ui~="acao"] summary').click();
    await pagina.getByText('concluida: Corrigir interface', { exact: true }).waitFor();
    assert.equal(await pagina.locator('[data-ui="previa-acao"]').innerText(), 'concluida: Corrigir interface');
    await pagina.screenshot({ path: 'artifacts/selene-resumo-expandido.png' });
    await resumo.locator('summary').first().click();
    await pagina.screenshot({ path: 'artifacts/selene-resumo-concluido.png' });
    const atual = await pagina.evaluate(() => window.selene!.estado());
    assert(atual.ok);
    const estado = atual.valor;
    const mensagem = estado.conversas[0].mensagens[0];
    mensagem.estado = 'gerando';
    delete mensagem.concluidoEm;
    delete mensagem.raciocinio;
    mensagem.texto = '';
    mensagem.acoes = [{ ...mensagem.acoes[0]!, estado: 'preparando', argumentos: {}, resultado: '' }];
    estado.conversaEmExecucao = estado.conversas[0].id;
    const evento: Evento = { tipo: 'estado', estado };
    await app.evaluate(({ BrowserWindow }, evento) => {
        BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', evento);
    }, evento);
    await pagina.getByText('Atualizando tarefas', { exact: true }).waitFor();
    assert.equal(await pagina.locator('[data-ui~="acao"] details').count(), 0);
    assert.equal(await pagina.locator('[data-ui="resumo-trabalho"]').count(), 0);
    await pagina.screenshot({ path: 'artifacts/selene-plano-preparando.png' });
    assert.deepEqual(erros, []);
    console.log(
        'Electron validado: resumo recolhido, resposta final, histórico expansível e plano sem detalhes vazios.',
    );
} finally {
    await app.close();
}
