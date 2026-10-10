import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { formatarCusto } from '../shared/openrouter';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'openrouter-'));
const ambiente = Object.fromEntries(
    Object.entries({ ...process.env, SELENE_TESTE: '1', SELENE_TESTE_DADOS: pasta }).filter(
        (item): item is [string, string] => typeof item[1] === 'string',
    ),
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
    await app.evaluate(() => {
        const original = globalThis.fetch;
        let solicitacoes = 0;
        const simular: typeof fetch = Object.assign(
            async (entrada: RequestInfo | URL, opcoes?: RequestInit) => {
                const url = String(entrada);
                if (url.startsWith('https://openrouter.ai/api/v1/models?')) {
                    const modelos = [
                        {
                            id: 'anthropic/modelo',
                            name: 'Anthropic: Modelo remoto de teste',
                            context_length: 32768,
                            pricing: { prompt: '0.000001', completion: '0.000002' },
                            architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] },
                            supported_parameters: ['tools', 'reasoning'],
                            top_provider: { max_completion_tokens: 4096 },
                        },
                        {
                            id: 'google/novo',
                            name: 'Gemini recente',
                            context_length: 65536,
                            pricing: { prompt: '0', completion: '0' },
                            architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] },
                            supported_parameters: ['tools'],
                        },
                    ];
                    const ordenacao = new URL(url).searchParams.get('sort');
                    return Response.json({ data: ordenacao === 'newest' ? modelos.reverse() : modelos });
                }
                if (url === 'https://openrouter.ai/api/v1/chat/completions') {
                    solicitacoes++;
                    if (solicitacoes === 1)
                        return Response.json(
                            { error: { code: 429, message: 'Rate limit exceeded' } },
                            { status: 429, headers: { 'Retry-After': '1' } },
                        );
                    const corpo = JSON.parse(String(opcoes?.body));
                    if (
                        corpo.model !== 'anthropic/modelo' ||
                        corpo.max_tokens > 4096 ||
                        corpo.cache_prompt !== undefined
                    )
                        throw new Error('Solicitação remota inválida.');
                    const eventos = [
                        { choices: [{ delta: { reasoning: 'Raciocínio remoto' } }] },
                        { choices: [{ delta: { content: 'Resposta OpenRouter validada' }, finish_reason: 'stop' }] },
                        { choices: [], usage: { prompt_tokens: 100, completion_tokens: 10, cost: 0.003 } },
                    ];
                    return new Response(
                        eventos.map((evento) => `data: ${JSON.stringify(evento)}\n\n`).join('') + 'data: [DONE]\n\n',
                    );
                }
                return original(entrada, opcoes);
            },
            { preconnect: original.preconnect },
        );
        globalThis.fetch = simular;
    });
    await pagina.getByRole('button', { name: 'Configurações', exact: true }).click();
    await pagina.getByRole('button', { name: 'Geral', exact: true }).click();
    await pagina.getByLabel('Chave de API', { exact: true }).fill('chave-ficticia-validacao');
    await pagina.getByRole('button', { name: 'Salvar chave', exact: true }).click();
    await pagina.getByText('Chave atualizada', { exact: true }).waitFor();
    const chave = await readFile(resolve(pasta, 'openrouter.key'));
    assert(!chave.toString().includes('chave-ficticia-validacao'));
    await pagina.getByRole('button', { name: 'Nova conversa', exact: true }).click();
    await pagina.getByRole('button', { name: 'Modelo da conversa', exact: true }).click();
    await pagina.getByRole('button', { name: 'OpenRouter', exact: true }).click();
    const catalogo = pagina.getByRole('dialog', { name: 'Catálogo de modelos', exact: true });
    await catalogo.getByRole('button', { name: 'Selecionar Modelo remoto de teste', exact: true }).waitFor();
    const linhas = catalogo.locator('[data-ui~="modelo-openrouter"]');
    assert.equal(await linhas.count(), 2);
    assert.equal(await linhas.first().locator('[data-ui="familia-modelo"] img').count(), 1);
    assert.equal(await linhas.first().getByLabel('Raciocínio', { exact: true }).count(), 1);
    assert.equal(await linhas.first().getByLabel('Ferramentas', { exact: true }).count(), 1);
    assert.equal(await linhas.first().getByLabel('Imagens', { exact: true }).count(), 1);
    assert((await linhas.first().innerText()).includes('Modelo remoto de teste'));
    await catalogo.getByRole('combobox', { name: 'Ordenar modelos OpenRouter' }).selectOption('newest');
    await pagina.waitForFunction(
        () => document.querySelector('[data-ui~="modelo-openrouter"] strong')?.textContent === 'Gemini recente',
    );
    await catalogo.getByRole('combobox', { name: 'Ordenar modelos OpenRouter' }).selectOption('most-popular');
    await pagina.waitForFunction(
        () => document.querySelector('[data-ui~="modelo-openrouter"] strong')?.textContent === 'Modelo remoto de teste',
    );
    await catalogo.getByRole('button', { name: 'Favoritar Modelo remoto de teste', exact: true }).click();
    await catalogo.getByRole('button', { name: 'Modelos favoritos', exact: true }).click();
    await pagina.waitForFunction(() => document.querySelectorAll('[data-ui~="modelo-openrouter"]').length === 1);
    await catalogo.getByRole('button', { name: 'Todos os modelos', exact: true }).click();
    await catalogo.getByRole('button', { name: 'Provedor Google', exact: true }).click();
    assert((await linhas.first().innerText()).includes('Gemini recente'));
    await catalogo.getByRole('button', { name: 'Todos os modelos', exact: true }).click();
    await pagina.getByRole('button', { name: 'Selecionar Modelo remoto de teste', exact: true }).waitFor();
    await pagina.screenshot({ path: 'artifacts/selene-openrouter-catalogo.png' });
    await pagina.setViewportSize({ width: 420, height: 900 });
    await pagina.getByRole('button', { name: 'Modelo da conversa', exact: true }).click();
    await pagina.getByRole('button', { name: 'Modelo da conversa', exact: true }).click();
    assert(await catalogo.evaluate((elemento) => elemento.scrollWidth <= elemento.clientWidth));
    await pagina.screenshot({ path: 'artifacts/selene-openrouter-catalogo-mobile.png' });
    await pagina.setViewportSize({ width: 1280, height: 840 });
    await pagina.getByRole('textbox', { name: 'Buscar modelos', exact: true }).fill('anthropic/modelo');
    await pagina.getByRole('button', { name: 'Selecionar Modelo remoto de teste', exact: true }).click();
    await pagina.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Teste remoto');
    await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await pagina.getByText('Resposta OpenRouter validada', { exact: true }).waitFor();
    await pagina.getByRole('button', { name: 'Mostrar informações da resposta', exact: true }).click({ force: true });
    await pagina.getByText(`OpenRouter: ${formatarCusto(0.003)}`, { exact: true }).waitFor();
    const resultado = await pagina.evaluate(() => window.selene!.estado());
    assert(resultado.ok);
    assert.equal(resultado.valor.motor.fase, 'desligado');
    assert.equal(resultado.valor.registrosUso[0].custoUsd, 0.003);
    assert.equal(resultado.valor.registrosUso[0].tokensGerados, 10);
    assert(!JSON.stringify(resultado).includes('chave-ficticia-validacao'));
    await pagina.screenshot({ path: 'artifacts/selene-openrouter-resposta.png' });
    await pagina.getByRole('button', { name: 'Estatísticas', exact: true }).click();
    await pagina.getByText('Gasto OpenRouter na Selene', { exact: true }).waitFor();
    assert((await pagina.locator('[data-ui="tela-estatisticas"]').innerText()).includes(formatarCusto(0.003)));
    await pagina.screenshot({ path: 'artifacts/selene-openrouter-estatisticas.png' });
    await pagina.evaluate(async () => {
        const resultado = await window.selene!.estado();
        if (!resultado.ok) throw new Error(resultado.erro);
        await window.selene!.excluirConversa(resultado.valor.conversas[0].id);
    });
    const excluida = await pagina.evaluate(() => window.selene!.estado());
    assert(excluida.ok && excluida.valor.registrosUso[0].custoUsd === 0.003);
    console.log('OpenRouter validado no Electron com API simulada, chave criptografada e gastos persistidos.');
} finally {
    await app.close();
}
const reaberto = await electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'),
    args: ['.'],
    env: ambiente,
});
try {
    const pagina = await reaberto.firstWindow();
    const estado = await pagina.evaluate(() => window.selene!.estado());
    assert(estado.ok && estado.valor.openrouterConfigurado);
    assert(estado.ok && estado.valor.registrosUso[0].custoUsd === 0.003);
    assert(estado.ok && estado.valor.favoritosCatalogo.includes('openrouter:anthropic/modelo'));
    const removida = await pagina.evaluate(() => window.selene!.configurarOpenRouter(''));
    assert(removida.ok);
    const semChave = await pagina.evaluate(() => window.selene!.estado());
    assert(semChave.ok && !semChave.valor.openrouterConfigurado);
    console.log('Reinício preserva chave protegida, favoritos e gastos. Remoção da chave validada.');
} finally {
    await reaberto.close();
}
