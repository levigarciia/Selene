import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { _electron as electron, chromium } from 'playwright';
import { esquemaDados } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'acesso-web-'));
const projeto = resolve(pasta, 'projeto');
await mkdir(projeto);
const modeloId = randomUUID();
const projetoId = randomUUID();
const chatId = randomUUID();
const codeId = randomUUID();
const mensagemInicial = () => ({
    id: randomUUID(),
    papel: 'assistant',
    texto: 'Histórico do computador',
    estado: 'concluida',
    acoes: [],
    criadoEm: new Date().toISOString(),
});
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
                    caminho: 'teste/modelo',
                    tamanho: 0,
                    openrouter: {
                        id: 'teste/modelo',
                        contexto: 8192,
                        imagens: true,
                        ferramentas: true,
                        raciocinio: true,
                    },
                },
            ],
            projetos: [
                { id: projetoId, nome: 'Projeto de teste', caminho: projeto, criadoEm: new Date().toISOString() },
            ],
            conversas: [
                {
                    id: chatId,
                    titulo: 'Chat do computador',
                    modo: 'chat',
                    modeloId,
                    mensagens: [mensagemInicial()],
                    atualizadoEm: new Date().toISOString(),
                },
                {
                    id: codeId,
                    titulo: 'Code do computador',
                    modo: 'code',
                    modeloId,
                    projeto,
                    projetoId,
                    mensagens: [mensagemInicial()],
                    atualizadoEm: new Date().toISOString(),
                },
            ],
        }),
    ),
);
const reserva = createServer();
await new Promise<void>((resolve) => reserva.listen(0, '127.0.0.1', resolve));
const porta = (reserva.address() as { port: number }).port;
await new Promise<void>((resolve) => reserva.close(() => resolve()));
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
const navegador = await chromium.launch({ channel: 'chrome', headless: true });
try {
    const desktop = await app.firstWindow();
    desktop.setDefaultTimeout(15000);
    await desktop.getByRole('button', { name: 'Configurações', exact: true }).waitFor();
    await app.evaluate(() => {
        const original = globalThis.fetch;
        globalThis.fetch = Object.assign(
            async (entrada: RequestInfo | URL, opcoes?: RequestInit) => {
                if (String(entrada) !== 'https://openrouter.ai/api/v1/chat/completions')
                    return original(entrada, opcoes);
                const corpo = JSON.parse(String(opcoes?.body));
                const criarArquivo = corpo.messages.some(
                    (item: { role: string; content: unknown }) =>
                        item.role === 'user' && String(item.content).includes('Criar arquivo pelo celular'),
                );
                const respondeuFerramenta = corpo.messages.some((item: { role: string }) => item.role === 'tool');
                const delta =
                    criarArquivo && !respondeuFerramenta
                        ? {
                              tool_calls: [
                                  {
                                      index: 0,
                                      id: 'chamada-web',
                                      type: 'function',
                                      function: {
                                          name: 'escrever_arquivo',
                                          arguments: JSON.stringify({
                                              caminho: 'celular.txt',
                                              conteudo: 'Aprovado pelo navegador',
                                          }),
                                      },
                                  },
                              ],
                          }
                        : { content: 'Resposta recebida pelo celular' };
                return new Response(
                    `data: ${JSON.stringify({
                        choices: [
                            { delta, finish_reason: criarArquivo && !respondeuFerramenta ? 'tool_calls' : 'stop' },
                        ],
                    })}\n\n` + 'data: [DONE]\n\n',
                );
            },
            { preconnect: original.preconnect },
        );
    });
    assert((await desktop.evaluate(() => window.selene!.configurarOpenRouter('chave-ficticia-web'))).ok);
    await desktop.getByRole('button', { name: 'Configurações', exact: true }).click();
    await desktop.getByRole('button', { name: 'Acesso web', exact: true }).click();
    await desktop.getByLabel('Porta', { exact: true }).fill(String(porta));
    await desktop.getByRole('button', { name: 'Ativar acesso', exact: true }).click();
    await desktop.getByRole('button', { name: 'Desativar acesso', exact: true }).waitFor();
    const acesso = await desktop.evaluate(() => window.selene!.acessoWeb());
    assert(acesso.ok);
    const endereco = acesso.valor.enderecos[0] ?? `http://127.0.0.1:${porta}`;
    const pagina = await navegador.newPage({ viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true });
    pagina.setDefaultTimeout(15000);
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await pagina.goto(endereco);
    assert(
        await pagina
            .getByLabel('Chave de acesso', { exact: true })
            .evaluate((campo) => parseFloat(getComputedStyle(campo).fontSize) >= 16),
        'O login deve evitar zoom ao receber foco no iPhone.',
    );
    assert.equal((await pagina.request.get(endereco + '/api/sessao')).status(), 401);
    await pagina.getByLabel('Chave de acesso', { exact: true }).fill(acesso.valor.chave);
    await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
    await pagina.locator('textarea[aria-label="Mensagem"]:visible').waitFor();
    assert.equal(await pagina.evaluate(() => typeof crypto.randomUUID), 'undefined');
    const conversaNova = await pagina.evaluate(() => window.selene!.novaConversa('chat'));
    assert(conversaNova.ok, 'Argumentos opcionais devem continuar opcionais no transporte web.');
    await pagina.getByRole('button', { name: 'Abrir navegação' }).click();
    await pagina.getByRole('button', { name: 'Chat do computador', exact: true }).click();
    await pagina.getByRole('button', { name: 'Nível de raciocínio', exact: true }).tap();
    await pagina.getByRole('menuitemradio', { name: 'Alto', exact: true }).tap();
    await pagina.getByRole('button', { name: 'Nível de raciocínio', exact: true }).getByText('Alto').waitFor();
    const raciocinioSalvo = await desktop.evaluate(() => window.selene!.estado());
    assert(
        raciocinioSalvo.ok &&
            raciocinioSalvo.valor.conversas.find((item) => item.id === chatId)?.nivelRaciocinio === 'alto',
    );
    const imagem = await pagina.evaluate(() => {
        const tela = document.createElement('canvas');
        tela.width = tela.height = 16;
        const pincel = tela.getContext('2d')!;
        pincel.fillStyle = 'green';
        pincel.fillRect(0, 0, 16, 16);
        return tela.toDataURL('image/png').split(',')[1];
    });
    await pagina
        .locator('[data-ui~="tela-conversa"]:visible')
        .getByLabel('Selecionar imagens')
        .setInputFiles({ name: 'imagem.png', mimeType: 'image/png', buffer: Buffer.from(imagem, 'base64') });
    await pagina.getByRole('button', { name: 'Remover imagem.png', exact: true }).waitFor();
    await pagina.locator('textarea[aria-label="Mensagem"]:visible').fill('Mensagem pelo celular');
    await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await pagina.getByText('Resposta recebida pelo celular', { exact: true }).filter({ visible: true }).waitFor();
    const sincronizado = await desktop.evaluate(() => window.selene!.estado());
    assert(
        sincronizado.ok &&
            sincronizado.valor.conversas
                .find((item) => item.id === chatId)
                ?.mensagens.some((item) => item.texto === 'Mensagem pelo celular'),
    );
    assert(
        sincronizado.ok &&
            sincronizado.valor.conversas
                .find((item) => item.id === chatId)
                ?.mensagens.some((item) => item.imagens?.length === 1),
    );
    const baixar = pagina.waitForEvent('download');
    const exportado = await pagina.evaluate((id) => window.selene!.exportarConversa(id), chatId);
    assert(exportado.ok);
    const download = await baixar;
    await download.saveAs(resolve('artifacts/selene-exportacao-web.md'));
    assert((await readFile(resolve('artifacts/selene-exportacao-web.md'), 'utf8')).includes('data:image/jpeg;base64,'));
    const semTransbordamento = await pagina.evaluate(() => {
        const entrada = document.querySelector('textarea')!.getBoundingClientRect();
        return document.documentElement.scrollWidth <= innerWidth && entrada.bottom <= innerHeight;
    });
    assert(semTransbordamento, 'A entrada e o conteúdo devem caber na tela móvel.');
    assert(
        await pagina
            .locator('textarea[aria-label="Mensagem"]:visible')
            .evaluate((entrada) => parseFloat(getComputedStyle(entrada).fontSize) >= 16),
        'A fonte deve evitar zoom automático no iPhone.',
    );
    assert.equal(await pagina.locator('body').evaluate((corpo) => getComputedStyle(corpo).touchAction), 'manipulation');
    await pagina.screenshot({ path: 'artifacts/selene-acesso-celular.png' });
    await pagina.getByRole('group', { name: 'Modo no celular' }).getByRole('button', { name: 'Code' }).click();
    await pagina.getByRole('button', { name: 'Abrir navegação' }).click();
    await pagina.getByRole('button', { name: 'Code do computador', exact: true }).click();
    const permissao = pagina.getByRole('button', { name: 'Permissão da conversa', exact: true });
    await permissao.tap();
    await pagina.evaluate(() => {
        document.querySelector('[data-ui="menu-opcoes-entrada"] button')?.dispatchEvent(
            new FocusEvent('focusout', { bubbles: true, relatedTarget: null }),
        );
        window.dispatchEvent(new Event('resize'));
    });
    await pagina.getByRole('menuitemradio', { name: /^Acesso completo/ }).tap();
    await permissao.getByText('Acesso completo').waitFor();
    const permissaoSalva = await desktop.evaluate(() => window.selene!.estado());
    assert(
        permissaoSalva.ok &&
            permissaoSalva.valor.conversas.find((item) => item.id === codeId)?.acessoCompleto === true,
    );
    await pagina.reload();
    await pagina.getByRole('group', { name: 'Modo no celular' }).getByRole('button', { name: 'Code' }).tap();
    await pagina.getByRole('button', { name: 'Abrir navegação' }).tap();
    await pagina.getByRole('button', { name: 'Code do computador', exact: true }).tap();
    await permissao.getByText('Acesso completo').waitFor();
    await permissao.tap();
    await pagina.getByRole('menuitemradio', { name: /^Pedir aprovação/ }).tap();
    await permissao.getByText('Pedir aprovação').waitFor();
    await permissao.tap();
    await pagina.getByRole('button', { name: 'Abrir navegação' }).tap();
    await pagina.getByRole('menu', { name: 'Permissão da conversa' }).waitFor({ state: 'hidden' });
    await pagina.getByRole('button', { name: 'Code do computador', exact: true }).tap();
    await permissao.focus();
    await pagina.keyboard.press('Enter');
    assert(
        await pagina.getByRole('menuitemradio', { name: /^Pedir aprovação/ })
            .evaluate((item) => item === document.activeElement),
    );
    await pagina.keyboard.press('ArrowDown');
    assert(
        await pagina.getByRole('menuitemradio', { name: /^Acesso completo/ })
            .evaluate((item) => item === document.activeElement),
    );
    await pagina.keyboard.press('Escape');
    await pagina.getByRole('menu', { name: 'Permissão da conversa' }).waitFor({ state: 'hidden' });
    await pagina.locator('textarea[aria-label="Mensagem"]:visible').fill('Criar arquivo pelo celular');
    await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await pagina.getByRole('button', { name: 'Aprovar', exact: true }).waitFor();
    await assert.rejects(readFile(resolve(projeto, 'celular.txt')));
    await pagina.getByRole('button', { name: 'Aprovar', exact: true }).click();
    await pagina.getByText('Resposta recebida pelo celular', { exact: true }).filter({ visible: true }).waitFor();
    assert.equal(await readFile(resolve(projeto, 'celular.txt'), 'utf8'), 'Aprovado pelo navegador');
    await pagina.reload();
    await pagina.locator('textarea[aria-label="Mensagem"]:visible').waitFor();
    assert.equal((await pagina.request.get(endereco + '/api/sessao')).status(), 200);
    await pagina.context().setOffline(true);
    await pagina.getByText('Reconectando ao computador', { exact: true }).waitFor();
    await pagina.context().setOffline(false);
    await pagina.getByText('Reconectando ao computador', { exact: true }).waitFor({ state: 'hidden' });
    const antiga = acesso.valor.chave;
    assert((await desktop.evaluate(() => window.selene!.renovarChaveWeb())).ok);
    await pagina.getByLabel('Chave de acesso', { exact: true }).waitFor();
    assert.equal(
        (
            await pagina.request.post(endereco + '/api/entrar', {
                headers: { Origin: endereco },
                data: { chave: antiga },
            })
        ).status(),
        401,
    );
    await desktop.getByLabel('Exigir chave de acesso', { exact: true }).uncheck();
    await desktop.getByRole('button', { name: 'Aplicar alterações', exact: true }).click();
    await desktop.getByRole('button', { name: 'Desativar acesso', exact: true }).waitFor();
    const livre = await navegador.newPage({ viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true });
    livre.on('pageerror', (erro) => erros.push(erro.message));
    await livre.goto(endereco);
    await livre.locator('textarea[aria-label="Mensagem"]:visible').waitFor();
    assert.equal(await livre.getByLabel('Chave de acesso', { exact: true }).count(), 0);
    assert.equal((await livre.request.get(endereco + '/api/sessao')).status(), 200);
    const novaConversa = livre.getByRole('button', { name: 'Nova conversa', exact: true }).filter({ visible: true });
    assert.equal(await novaConversa.innerText(), '');
    assert.equal(await novaConversa.locator('svg').count(), 1);
    await livre.locator('textarea[aria-label="Mensagem"]:visible').fill('Rascunho anterior');
    await novaConversa.click();
    assert.equal(await livre.locator('textarea[aria-label="Mensagem"]:visible').inputValue(), '');
    const salvo = JSON.parse(await readFile(resolve(pasta, 'acessoWeb.json'), 'utf8'));
    assert.equal(salvo.exigirChave, false);
    await desktop.getByLabel('Exigir chave de acesso', { exact: true }).check();
    await desktop.getByRole('button', { name: 'Aplicar alterações', exact: true }).click();
    await livre.getByLabel('Chave de acesso', { exact: true }).waitFor();
    assert.equal((await livre.request.get(endereco + '/api/sessao')).status(), 401);
    await livre.close();
    assert.deepEqual(erros, []);
    await desktop.screenshot({ path: 'artifacts/selene-configuracao-acesso-web.png' });
    console.log('Acesso móvel, Chat, Code, aprovação, anexos, exportação, conexão e chave opcional validados.');
} finally {
    await navegador.close();
    await app.close();
}
