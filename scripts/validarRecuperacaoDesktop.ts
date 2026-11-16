import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { _electron } from 'playwright';
import { esquemaDados } from '../shared/contratos';
import { executarProcesso } from '../electron/services/processos';

await mkdir('.teste-dados', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'recuperacao-'));
const projeto = join(pasta, 'projeto');
await mkdir(projeto);
await writeFile(join(projeto, 'original.txt'), 'original');
for (const argumentos of [
    ['init'],
    ['add', '.'],
    ['-c', 'user.name=Teste', '-c', 'user.email=teste@example.invalid', 'commit', '-m', 'Cria projeto'],
]) {
    const resultado = await executarProcesso('git', argumentos, projeto, new AbortController().signal);
    assert.equal(resultado.codigo, 0, resultado.saida);
}
const conversaId = randomUUID();
const modeloId = randomUUID();
const projetoId = randomUUID();
await writeFile(
    join(pasta, 'selene.json'),
    JSON.stringify(
        esquemaDados.parse({
            versao: 1,
            configuracao: {},
            modelos: [
                {
                    id: modeloId,
                    nome: 'Teste',
                    caminho: 'teste',
                    tamanho: 0,
                    openrouter: {
                        id: 'teste/code',
                        contexto: 65536,
                        imagens: false,
                        ferramentas: true,
                        raciocinio: false,
                    },
                },
            ],
            projetos: [{ id: projetoId, nome: 'Projeto', caminho: projeto, criadoEm: new Date().toISOString() }],
            conversas: [
                {
                    id: conversaId,
                    titulo: 'Recuperação',
                    modo: 'code',
                    projetoId,
                    projeto,
                    acessoCompleto: true,
                    modeloId,
                    rascunho: 'Pedido de teste',
                    atualizadoEm: new Date().toISOString(),
                },
            ],
        }),
    ),
);
const env = Object.fromEntries(
    Object.entries({ ...process.env, SELENE_TESTE: '1', SELENE_TESTE_DADOS: pasta }).filter(
        (entrada): entrada is [string, string] => typeof entrada[1] === 'string',
    ),
);
delete env.ELECTRON_RUN_AS_NODE;
delete env.SELENE_VITE_URL;
const executavel = resolve(process.env.SELENE_TESTE_EXECUTAVEL ?? 'node_modules/electron/dist/electron.exe');
const argumentos = process.env.SELENE_TESTE_EXECUTAVEL ? [] : ['.'];
const app = await _electron.launch({ executablePath: executavel, args: argumentos, env });
try {
    const pagina = await app.firstWindow();
    pagina.setDefaultTimeout(20000);
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('button', { name: 'Recuperação', exact: true }).click();
    await pagina.getByRole('button', { name: 'Recuperação', exact: true }).click({ button: 'right' });
    await pagina.getByRole('menuitem', { name: 'Isolar em worktree', exact: true }).click();
    let isolada: string | undefined;
    for (let tentativa = 0; tentativa < 100; tentativa++) {
        const estado = await pagina.evaluate(() => window.selene!.estado());
        if (estado.ok) isolada = estado.valor.conversas.find((item) => item.id === conversaId)?.pastaRepositorio;
        if (isolada) break;
        await esperar(100);
    }
    assert.equal(typeof isolada, 'string');
    assert(isolada);
    assert.notEqual(isolada, projeto);
    const outra = spawn(executavel, argumentos, { env, windowsHide: true, stdio: 'ignore' });
    await new Promise<void>((resolver, rejeitar) => {
        const prazo = setTimeout(() => {
            outra.kill();
            rejeitar(new Error('A segunda instância não encerrou.'));
        }, 15000);
        outra.on('error', rejeitar);
        outra.on('exit', (codigo) => {
            clearTimeout(prazo);
            assert.equal(codigo, 0);
            resolver();
        });
    });
    const terminal = await pagina.evaluate(
        async (id) =>
            window.selene!.abrirTerminal(id, { colunas: 80, linhas: 24 }, "Write-Output ('SELENE_' + 'TERMINAL_OK')"),
        projetoId,
    );
    assert(terminal.ok, terminal.ok ? '' : terminal.erro);
    let respondeuTerminal = false;
    for (let tentativa = 0; tentativa < 100; tentativa++) {
        const resultado = await pagina.evaluate((id) => window.selene!.historicoTerminal(id), terminal.valor);
        respondeuTerminal = resultado.ok && resultado.valor.includes('SELENE_TERMINAL_OK');
        if (respondeuTerminal) break;
        await esperar(100);
    }
    assert(respondeuTerminal, 'O terminal precisa executar o comando e devolver o resultado.');
    assert((await pagina.evaluate((id) => window.selene!.fecharTerminal(id), terminal.valor)).ok);
    await app.evaluate(() => {
        const original = globalThis.fetch;
        globalThis.fetch = Object.assign(async (entrada: RequestInfo | URL, opcoes?: RequestInit) => {
            if (String(entrada) !== 'https://openrouter.ai/api/v1/chat/completions') return original(entrada, opcoes);
            const corpo = JSON.parse(String(opcoes?.body));
            const concluiu = corpo.messages.some((item: { role: string }) => item.role === 'tool');
            const delta = concluiu
                ? { content: 'Arquivo criado para recuperação.' }
                : {
                      tool_calls: [
                          {
                              index: 0,
                              id: 'escrita',
                              type: 'function',
                              function: {
                                  name: 'escrever_arquivo',
                                  arguments: JSON.stringify({ caminho: 'novo.txt', conteudo: 'novo' }),
                              },
                          },
                      ],
                  };
            return new Response(
                `data: ${JSON.stringify({
                    choices: [{ delta, finish_reason: concluiu ? 'stop' : 'tool_calls' }],
                })}\n\ndata: [DONE]\n\n`,
            );
        }, original);
    });
    assert((await pagina.evaluate(() => window.selene!.configurarOpenRouter('teste-local'))).ok);
    await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Crie um arquivo de teste');
    await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await pagina.getByText('Arquivo criado para recuperação.', { exact: true }).waitFor();
    assert.equal(await readFile(join(isolada, 'novo.txt'), 'utf8'), 'novo');
    await pagina.getByRole('button', { name: 'Restaurar arquivos deste turno', exact: true }).click();
    await pagina.getByRole('dialog').getByText('novo.txt', { exact: true }).waitFor();
    await pagina.getByRole('button', { name: 'Confirmar restauração', exact: true }).click();
    await pagina.getByText('Arquivos restaurados.', { exact: true }).waitFor();
    assert.equal(await readFile(join(projeto, 'original.txt'), 'utf8'), 'original');
    const existe = await import('node:fs/promises').then(async ({ stat }) =>
        stat(join(isolada, 'novo.txt')).then(
            () => true,
            () => false,
        ),
    );
    assert.equal(existe, false);
    console.log('Instância única, terminal nativo e restauração pela interface validados no Electron.');
} finally {
    await app.close();
}
