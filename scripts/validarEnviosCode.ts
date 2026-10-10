import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { esquemaDados } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'envios-code-'));
const conversaId = randomUUID();
const modeloId = randomUUID();
await writeFile(
    resolve(pasta, 'selene.json'),
    JSON.stringify(
        esquemaDados.parse({
            versao: 1,
            configuracao: {},
            modelos: [
                {
                    id: modeloId,
                    nome: 'Modelo de teste',
                    caminho: 'openrouter:teste',
                    tamanho: 0,
                    openrouter: {
                        id: 'teste/code',
                        contexto: 32768,
                        imagens: false,
                        ferramentas: true,
                        raciocinio: false,
                    },
                },
            ],
            conversas: [
                {
                    id: conversaId,
                    titulo: 'Envios Code',
                    modo: 'code',
                    modeloId,
                    atualizadoEm: new Date().toISOString(),
                    mensagens: [
                        {
                            id: randomUUID(),
                            papel: 'user',
                            texto: 'Contexto inicial',
                            estado: 'concluida',
                            criadoEm: new Date().toISOString(),
                        },
                    ],
                },
            ],
        }),
    ),
);
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
    pagina.setDefaultTimeout(15000);
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await app.evaluate(() => {
        const controle = globalThis as typeof globalThis & {
            enviosTeste: { corpos: unknown[]; liberar?: () => void };
        };
        controle.enviosTeste = { corpos: [] };
        const original = globalThis.fetch;
        globalThis.fetch = Object.assign(async (entrada: RequestInfo | URL, opcoes?: RequestInit) => {
            if (String(entrada) !== 'https://openrouter.ai/api/v1/chat/completions') return original(entrada, opcoes);
            const corpo = JSON.parse(String(opcoes?.body));
            controle.enviosTeste.corpos.push(corpo);
            await new Promise<void>((resolver, rejeitar) => {
                const sinal = opcoes?.signal;
                const cancelar = () => rejeitar(sinal?.reason);
                controle.enviosTeste.liberar = () => {
                    sinal?.removeEventListener('abort', cancelar);
                    resolver();
                };
                if (sinal?.aborted) cancelar();
                else sinal?.addEventListener('abort', cancelar, { once: true });
            });
            const evento = {
                choices: [
                    { delta: { content: `Resposta ${controle.enviosTeste.corpos.length}` }, finish_reason: 'stop' },
                ],
            };
            return new Response(`data: ${JSON.stringify(evento)}\n\ndata: [DONE]\n\n`);
        }, original);
    });
    assert((await pagina.evaluate(() => window.selene!.configurarOpenRouter('chave-ficticia-teste'))).ok);
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('button', { name: 'Envios Code', exact: true }).click();
    const mensagem = pagina.getByRole('textbox', { name: 'Mensagem', exact: true });
    await mensagem.fill('Investigue o projeto');
    await mensagem.press('Enter');
    await pagina.getByRole('button', { name: 'Redirecionar', exact: true }).waitFor();
    await mensagem.fill('Primeiro da fila');
    await mensagem.press('Alt+Enter');
    await pagina.locator('[data-ui="fila-code"]').getByText('Primeiro da fila', { exact: true }).waitFor();
    await mensagem.fill('Segundo da fila');
    await pagina.getByRole('button', { name: 'Na fila', exact: true }).click();
    await pagina.locator('[data-ui="fila-code"]').getByText('Segundo da fila', { exact: true }).waitFor();
    await mensagem.fill('Use Bun');
    await mensagem.press('Enter');
    await pagina.getByText('Redirecionando', { exact: true }).waitFor();
    await pagina.screenshot({ path: 'artifacts/selene-envios-code.png' });
    await pagina.setViewportSize({ width: 420, height: 900 });
    assert(
        await pagina
            .locator('[data-ui="fila-code"]')
            .evaluate((elemento) => elemento.scrollWidth <= elemento.clientWidth),
    );
    await pagina.screenshot({ path: 'artifacts/selene-envios-code-mobile.png' });
    await pagina.setViewportSize({ width: 1280, height: 840 });
    const liberar = () =>
        app.evaluate(() => {
            (globalThis as typeof globalThis & { enviosTeste: { liberar?: () => void } }).enviosTeste.liberar?.();
        });
    const aguardarChamada = async (quantidade: number) => {
        for (let tentativa = 0; tentativa < 100; tentativa++) {
            const atual = await app.evaluate(
                () =>
                    (globalThis as typeof globalThis & { enviosTeste: { corpos: unknown[] } }).enviosTeste.corpos
                        .length,
            );
            if (atual >= quantidade) return;
            await new Promise((resolver) => setTimeout(resolver, 50));
        }
        throw new Error(`Não iniciou a chamada ${quantidade}.`);
    };
    await aguardarChamada(1);
    await liberar();
    await aguardarChamada(2);
    const corpos = await app.evaluate(
        () => (globalThis as typeof globalThis & { enviosTeste: { corpos: unknown[] } }).enviosTeste.corpos,
    );
    assert(JSON.stringify(corpos[1]).includes('Use Bun'));
    assert(!JSON.stringify(corpos[1]).includes('Primeiro da fila'));
    await liberar();
    await aguardarChamada(3);
    await liberar();
    await aguardarChamada(4);
    await liberar();
    await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).waitFor();
    const resultado = await pagina.evaluate(() => window.selene!.estado());
    assert(resultado.ok);
    const conversa = resultado.valor.conversas.find((item) => item.id === conversaId)!;
    assert.equal(conversa.mensagens.filter((item) => item.papel === 'assistant').length, 3);
    assert.deepEqual(conversa.enviosPendentes, []);
    await mensagem.fill('Outra tarefa');
    await mensagem.press('Enter');
    await aguardarChamada(5);
    await mensagem.fill('Preservar na fila');
    await mensagem.press('Alt+Enter');
    await pagina.getByText('Preservar na fila', { exact: true }).waitFor();
    await pagina.getByRole('button', { name: 'Interromper tarefa', exact: true }).click();
    await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).waitFor();
    await pagina.locator('[data-ui="fila-code"]').getByRole('button', { name: 'Enviar', exact: true }).waitFor();
    const preservado = await pagina.evaluate(() => window.selene!.estado());
    assert(preservado.ok);
    assert.equal(
        preservado.valor.conversas.find((item) => item.id === conversaId)?.enviosPendentes?.[0].texto,
        'Preservar na fila',
    );
    await pagina.locator('[data-ui="fila-code"]').getByRole('button', { name: 'Enviar', exact: true }).click();
    await aguardarChamada(6);
    await mensagem.fill('Converter em instrução');
    await mensagem.press('Alt+Enter');
    const fila = pagina.locator('[data-ui="fila-code"]');
    await fila.getByText('Converter em instrução', { exact: true }).waitFor();
    await fila.getByRole('button', { name: 'Redirecionar', exact: true }).click();
    await fila.getByText('Redirecionando', { exact: true }).waitFor();
    await liberar();
    await aguardarChamada(7);
    await liberar();
    await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).waitFor();
    await pagina.locator('[data-ui="fila-code"]').waitFor({ state: 'detached' });
    assert.deepEqual(erros, []);
    console.log('Envios Code validados no Electron com modelo simulado.');
} finally {
    await app.close();
}
