import { _electron as electron } from 'playwright';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { esquemaDados, type Estado, type Mensagem } from '../shared/contratos';
import type { ItemGitHub } from '../shared/repositorio';

await mkdir('.teste-dados', { recursive: true });
await mkdir('public/screenshots', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'readme-'));
const projetoId = randomUUID();
const modeloId = randomUUID();
const agora = new Date().toISOString();

function mensagem(papel: Mensagem['papel'], texto: string, campos: Partial<Mensagem> = {}): Mensagem {
    return { id: randomUUID(), papel, texto, estado: 'concluida', acoes: [], criadoEm: agora, ...campos };
}

function conversa(titulo: string, mensagens: Mensagem[], concluida = false) {
    return {
        id: randomUUID(), titulo, modo: 'code', projetoId, projeto: resolve('.'), modeloId,
        atualizadoEm: agora, acessoCompleto: false, concluida, mensagens,
        ...(concluida ? { encerradaEm: agora } : {}),
    };
}

const prontas = [
    conversa('Melhorar a busca de tarefas', [
        mensagem('user', 'Adicione busca por título e descrição, sem diferenciar maiúsculas ou acentos.'),
        mensagem('assistant', 'A busca agora encontra tarefas pelo título e pela descrição, ' +
            'inclusive ao digitar palavras sem acentos.\n\n' +
            '* A filtragem mantém a ordem original das tarefas.\n' +
            '* O estado vazio sugere ajustar os termos da busca.\n' +
            '* A verificação de tipos e os 12 testes da busca passaram.', {
            criadoEm: new Date(Date.now() - 94000).toISOString(), concluidoEm: agora,
            acoes: [
                { id: 'ler', nome: 'ler_arquivo', argumentos: { caminho: 'src/utils/busca.ts' },
                    estado: 'concluida', resultado: 'Arquivo consultado.' },
                { id: 'editar', nome: 'editar_arquivo', argumentos: { caminho: 'src/utils/busca.ts' },
                    estado: 'concluida', resultado: 'Busca atualizada.' },
                { id: 'validar', nome: 'executar_terminal', argumentos: { comando: 'bun test tests/busca.test.ts' },
                    estado: 'concluida', resultado: '12 testes passaram.' },
            ],
        }),
    ]),
    conversa('Revisar o formulário de cadastro', [
        mensagem('user', 'Revise os campos e a navegação por teclado.'),
        mensagem('assistant', 'Vou conferir os campos, as mensagens de erro e a ordem de foco.', {
            estado: 'gerando',
            acoes: [{ id: 'revisar', nome: 'ler_arquivo', argumentos: { caminho: 'src/components/Cadastro.tsx' },
                estado: 'executando', resultado: '' }],
        }),
    ]),
    conversa('Adicionar testes de integração', [
        mensagem('user', 'Crie os testes da API de tarefas e execute a suíte.'),
        mensagem('assistant', 'Os cenários de criação, atualização e exclusão estão prontos. ' +
            'Vou executar os testes antes de concluir.', {
            estado: 'gerando',
            acoes: [{ id: 'aprovar', nome: 'executar_terminal', argumentos: { comando: 'bun test tests/api.test.ts' },
                estado: 'aguardando', resultado: '' }],
        }),
    ]),
    conversa('Atualizar as dependências', [
        mensagem('user', 'Confira se as dependências estão compatíveis.'),
        mensagem('assistant', 'A consulta foi interrompida porque o registro de pacotes não respondeu. ' +
            'Os arquivos do projeto foram preservados.', { estado: 'erro' }),
    ]),
    conversa('Documentar a API de tarefas', [
        mensagem('assistant', 'A documentação inclui exemplos de criação, filtros e paginação.'),
    ], true),
];
const chat = {
    id: randomUUID(), titulo: 'Um roteiro para aprender TypeScript', modo: 'chat', modeloId, atualizadoEm: agora,
    mensagens: [
        mensagem('user', 'Já conheço JavaScript. Como posso começar a usar TypeScript nos meus projetos?'),
        mensagem('assistant', 'Comece por um projeto pequeno que você já conhece. Assim, você aprende os tipos ' +
            'enquanto melhora algo útil.\n\n' +
            '### Um caminho prático\n\n' +
            '1. Ative o modo estrito e tipifique os parâmetros das funções.\n' +
            '2. Modele os dados com `type` e `interface`.\n' +
            '3. Use uniões para representar estados de carregamento, sucesso e erro.\n' +
            '4. Valide dados externos antes de usá los no aplicativo.\n\n' +
            'Um bom primeiro exercício é converter a lista de tarefas de um projeto seu. ' +
            'Podemos começar pelo tipo de uma tarefa e pela função que filtra a lista.'),
    ],
};
const dados = esquemaDados.parse({
    versao: 1, configuracao: {},
    modelos: [{ id: modeloId, nome: 'Qwen3.5 9B', caminho: resolve(pasta, 'qwen.gguf'),
        tamanho: 5_700_000_000, catalogoId: 'qwen3.5-9b-q4' }],
    projetos: [{ id: projetoId, nome: 'Lista de tarefas', caminho: resolve('.'), criadoEm: agora }],
    conversas: [chat, ...prontas],
});
await writeFile(resolve(pasta, 'qwen.gguf'), '');
await writeFile(resolve(pasta, 'selene.json'), JSON.stringify(dados));
const ambiente = Object.fromEntries(Object.entries({ ...process.env,
    SELENE_TESTE: '1', SELENE_TESTE_DADOS: pasta,
}).filter((entrada): entrada is [string, string] => typeof entrada[1] === 'string'));
delete ambiente.ELECTRON_RUN_AS_NODE;
delete ambiente.SELENE_VITE_URL;
const app = await electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'), args: ['.'], env: ambiente,
});
try {
    const pagina = await app.firstWindow();
    pagina.setDefaultTimeout(15000);
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await pagina.setViewportSize({ width: 1440, height: 900 });
    await pagina.getByRole('button', { name: chat.titulo, exact: true }).waitFor();
    const resultado = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(resultado.ok);
    const estado: Estado = { ...resultado.valor, conversas: dados.conversas,
        modelos: dados.modelos, conversaEmExecucao: null };
    async function publicar(execucao: string | null = null) {
        await app.evaluate(({ BrowserWindow }, estado) => {
            BrowserWindow.getAllWindows()[0].webContents.send('selene:evento', { tipo: 'estado', estado });
        }, { ...estado, conversaEmExecucao: execucao });
    }
    async function capturar(nome: string) {
        await pagina.mouse.move(1430, 890);
        await pagina.evaluate(() => document.fonts.ready);
        await pagina.waitForTimeout(500);
        await pagina.screenshot({ path: `public/screenshots/${nome}.png` });
    }
    await publicar();
    await pagina.getByRole('button', { name: chat.titulo, exact: true }).click();
    await pagina.getByText('Um caminho prático', { exact: true }).waitFor();
    await capturar('chat');
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await publicar();
    await pagina.getByRole('button', { name: prontas[0].titulo, exact: true }).click();
    await publicar(prontas[1].id);
    await pagina.getByRole('button', { name: 'Concluídas', exact: true }).click();
    await pagina.getByText('A filtragem mantém a ordem original das tarefas.', { exact: true }).waitFor();
    await capturar('code');
    await pagina.getByRole('button', { name: prontas[1].titulo, exact: true }).click();
    await publicar(prontas[1].id);
    await pagina.locator('[data-ui~=grupo-trabalhando]').waitFor();
    await capturar('code-trabalhando');
    await pagina.getByRole('button', { name: prontas[2].titulo, exact: true }).click();
    await publicar(prontas[2].id);
    await pagina.locator('[data-ui~=aprovacao]').waitFor();
    await capturar('code-aprovacao');
    await publicar();
    const itens: ItemGitHub[] = [
        ['Melhora a busca por título e descrição', 'aberto', 'feat/busca', 'melhoria', '5fb3a1'],
        ['Adiciona testes da API de tarefas', 'rascunho', 'test/api', 'testes', 'a89cdb'],
        ['Corrige a navegação por teclado no cadastro', 'aberto', 'fix/cadastro', 'acessibilidade', '80a9db'],
        ['Documenta os filtros e a paginação', 'mesclado', 'docs/api', 'documentação', 'd3b36c'],
    ].map(([titulo, estado, branch, nome, cor], indice) => ({
        repositorio: 'exemplo/lista-de-tarefas', numero: 42 - indice, titulo,
        url: `https://github.com/exemplo/lista-de-tarefas/pull/${42 - indice}`,
        autor: 'exemplo', estado: estado as ItemGitHub['estado'], branch,
        criadoEm: agora, atualizadoEm: agora, rotulos: [{ nome, cor }],
    }));
    await app.evaluate(({ ipcMain }, itens) => {
        ipcMain.removeHandler('selene:listarGitHub');
        ipcMain.handle('selene:listarGitHub', () => ({ ok: true, valor: {
            repositorios: ['exemplo/lista-de-tarefas'], itens, avisos: [],
        } }));
    }, itens);
    await pagina.getByRole('button', { name: 'Pull requests e issues', exact: true }).click();
    await pagina.getByText(itens[0].titulo, { exact: true }).waitFor();
    await capturar('pull-requests');
    await pagina.getByRole('button', { name: 'Voltar à conversa', exact: true }).click();
    await pagina.getByRole('button', { name: 'Chat', exact: true }).click();
    await pagina.getByRole('button', { name: chat.titulo, exact: true }).click();
    await publicar();
    await pagina.getByRole('button', { name: 'Modelo da conversa', exact: true }).click();
    await pagina.getByRole('dialog', { name: 'Catálogo de modelos' }).waitFor();
    await pagina.getByRole('button', { name: 'Família Qwen', exact: true }).click();
    await capturar('modelos');
    assert.deepEqual(erros, []);
    console.log('Seis screenshots do README capturadas com dados fictícios no Electron.');
} finally {
    await app.close();
}
