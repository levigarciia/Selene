import { _electron as electron, type ElectronApplication } from 'playwright';
import { mkdir, mkdtemp, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { setTimeout as esperar } from 'node:timers/promises';
import { esquemaBackend, type PonteSelene } from '../shared/contratos';
import { validarCatalogo, validarDownloadReal } from './validarCatalogo';
import { validarNavegacao } from './validarNavegacao';
import { pidMotor, validarSalvamento } from './validarSalvamento';
import { validarControlesEntrada } from './validarControlesEntrada';

const raiz = resolve('.teste-dados');
await mkdir(raiz, { recursive: true });
await mkdir('artifacts', { recursive: true });
const dados = await mkdtemp(resolve(raiz, 'desktop-'));
if (process.env.SELENE_TESTE_RUNTIME) {
    await symlink(resolve(process.env.SELENE_TESTE_RUNTIME), resolve(dados, 'runtime'), 'junction');
}
const ambiente: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, SELENE_TESTE: '1', SELENE_TESTE_DADOS: dados }).filter(
        (entrada): entrada is [string, string] => typeof entrada[1] === 'string',
    ),
);
delete ambiente.ELECTRON_RUN_AS_NODE;
if (process.env.SELENE_TESTE_VITE === '1') ambiente.SELENE_VITE_URL = 'http://127.0.0.1:5173';
let aplicativo: ElectronApplication | undefined;
const abrir = () =>
    electron.launch({
        executablePath: resolve(process.env.SELENE_TESTE_EXECUTAVEL ?? 'node_modules/electron/dist/electron.exe'),
        args: process.env.SELENE_TESTE_EXECUTAVEL ? [] : ['.'],
        env: ambiente,
        timeout: 30000,
    });
try {
    aplicativo = await abrir();
    let pagina = await aplicativo.firstWindow();
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => {
        erros.push(erro.message);
        console.error(erro.message);
    });
    pagina.on('console', (mensagem) => {
        if (mensagem.type() === 'error') console.error(mensagem.text());
    });
    await pagina.getByRole('heading', { name: 'O que vamos explorar?' }).waitFor({ timeout: 10000 });
    const ponteDisponivel = await pagina.evaluate(() => !!window.selene);
    assert.equal(ponteDisponivel, true, 'A ponte desktop deve estar disponível.');
    await pagina.screenshot({ path: 'artifacts/selene-chat.png' });
    await validarCatalogo(pagina);
    await pagina.getByRole('button', { name: 'Nova conversa', exact: true }).click();
    await pagina.getByRole('textbox', { name: 'Título da conversa' }).waitFor();
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('heading', { name: 'Em que vamos trabalhar?' }).waitFor();
    await pagina.getByRole('button', { name: 'Permissão da conversa', exact: true }).click();
    assert.equal(await pagina.getByRole('dialog').count(), 0);
    await pagina.getByRole('menuitemradio', { name: /^Acesso completo/ }).click();
    await pagina.waitForFunction(
        () => document.querySelector('[aria-label="Permissão da conversa"]')?.textContent === 'Acesso completo',
    );
    const id = await pagina.evaluate(async () => {
        const resultado = await window.selene!.estado();
        if (!resultado.ok) throw new Error(resultado.erro);
        return resultado.valor.conversas[0].id;
    });
    const titulo = 'Conversa persistida no desktop';
    await pagina.getByRole('textbox', { name: 'Título da conversa' }).fill(titulo);
    await pagina.getByRole('textbox', { name: 'Título da conversa' }).press('Enter');
    await pagina.getByRole('button', { name: titulo, exact: true }).waitFor();
    await pagina.screenshot({ path: 'artifacts/selene-code.png' });
    const dimensoes = pagina.viewportSize();
    await pagina.setViewportSize({ width: 420, height: 760 });
    const entradaDentroDaTela = await pagina.locator('[data-ui~="entrada"]:visible').evaluate((elemento) => {
        const limites = elemento.getBoundingClientRect();
        return limites.left >= 0 && limites.right <= window.innerWidth && elemento.scrollWidth <= elemento.clientWidth;
    });
    assert.ok(entradaDentroDaTela, 'A entrada deve caber na janela estreita sem transbordar.');
    await pagina.screenshot({ path: 'artifacts/selene-code-estreito.png' });
    await pagina.setViewportSize(dimensoes ?? { width: 1280, height: 840 });
    await pagina.getByRole('button', { name: 'Recolher sidebar' }).click();
    await aplicativo.close();
    const caminhoHistorico = resolve(dados, 'selene.json');
    const historico = JSON.parse(await readFile(caminhoHistorico, 'utf8'));
    historico.conversas[0].mensagens = [
        {
            id: randomUUID(),
            papel: 'assistant',
            texto: 'Resposta salva com velocidade de geração',
            estado: 'concluida',
            acoes: [],
            criadoEm: new Date().toISOString(),
            desempenho: { tokensGerados: 55, tempoGeracaoMs: 1000, tokensPorSegundo: 55 },
        },
    ];
    await writeFile(caminhoHistorico, JSON.stringify(historico));
    aplicativo = await abrir();
    pagina = await aplicativo.firstWindow();
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await pagina.getByRole('button', { name: 'Expandir sidebar' }).waitFor();
    await pagina.getByRole('button', { name: 'Expandir sidebar' }).click();
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('button', { name: titulo, exact: true }).click();
    await pagina.getByText('Resposta salva com velocidade de geração', { exact: true }).waitFor();
    await pagina.getByRole('button', { name: 'Mostrar tokens por segundo', exact: true }).click();
    await pagina.getByRole('tooltip').getByText('55 tokens/s', { exact: true }).waitFor();
    await pagina.getByRole('button', { name: 'Esconder tokens por segundo', exact: true }).click();
    await pagina.getByRole('tooltip').waitFor({ state: 'hidden' });
    await pagina.waitForFunction(
        () => document.querySelector('[aria-label="Permissão da conversa"]')?.textContent === 'Acesso completo',
    );
    const persistidos = JSON.parse(await readFile(resolve(dados, 'selene.json'), 'utf8'));
    assert.equal(persistidos.conversas[0].id, id);
    assert.equal(persistidos.conversas[0].acessoCompleto, true);
    assert.ok(persistidos.favoritosCatalogo.includes('qwen3.5-9b-q4'));
    await validarNavegacao(pagina, aplicativo, dados);
    assert.equal(erros.length, 0, erros.join('\n'));
    console.log('Desktop: ponte IPC, modos, acesso completo, persistência, reinício e diálogos validados.');
    await validarControlesEntrada();

    const gguf = process.env.SELENE_TESTE_DOWNLOAD
        ? await validarDownloadReal(pagina, process.env.SELENE_TESTE_DOWNLOAD)
        : process.env.SELENE_TESTE_GGUF;
    if (gguf) {
        await aplicativo.evaluate(({ dialog }, caminho) => {
            dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [caminho] });
        }, gguf);
        await pagina.evaluate(async () => {
            const resultado = await window.selene!.importarModelo();
            if (!resultado.ok) throw new Error(resultado.erro);
        });
        const backend = esquemaBackend.parse(process.env.SELENE_TESTE_BACKEND ?? 'auto');
        console.log('Carregando o GGUF real, com instalação automática do motor se necessário.');
        await pagina.evaluate(async (backend) => {
            const ponte = window.selene as PonteSelene;
            const resultado = await ponte.estado();
            if (!resultado.ok) throw new Error(resultado.erro);
            const configuracao = {
                ...resultado.valor.configuracao,
                backend,
                contexto: 8192,
                maxTokens: 128,
                temperatura: 0,
            };
            const salvo = await ponte.configurar(configuracao);
            if (!salvo.ok) throw new Error(salvo.erro);
            const carregado = await ponte.carregarModelo(resultado.valor.modelos[0].id);
            if (!carregado.ok) throw new Error(carregado.erro);
        }, backend);
        const motorAntesDoEnvio = await validarSalvamento(pagina, aplicativo);
        console.log('Modelo pronto. Validando inferência e histórico.');
        await pagina.evaluate(async () => {
            const ponte = window.selene as PonteSelene;
            const estado = await ponte.estado();
            if (!estado.ok) throw new Error(estado.erro);
            const conversa = await ponte.novaConversa('chat');
            if (!conversa.ok) throw new Error(conversa.erro);
            const alterada = await ponte.alterarConversa(conversa.valor.id, { modeloId: estado.valor.modelos[0].id });
            if (!alterada.ok) throw new Error(alterada.erro);
            const enviada = await ponte.enviar(
                conversa.valor.id,
                'Responda em uma frase curta: quanto é dois mais dois?',
            );
            if (!enviada.ok) throw new Error(enviada.erro);
        });
        assert.notEqual(await pidMotor(aplicativo), motorAntesDoEnvio, 'O próximo envio deve aplicar o novo contexto.');
        const recarregado = await pagina.evaluate(() => window.selene!.estado());
        assert.ok(recarregado.ok);
        assert.equal(recarregado.valor.motor.recarregamentoPendente, false);
        let concluiu = false;
        for (let tentativa = 0; tentativa < 180; tentativa++) {
            const terminou = await pagina.evaluate(async () => {
                const resultado = await window.selene!.estado();
                return (
                    resultado.ok &&
                    !resultado.valor.conversaEmExecucao &&
                    resultado.valor.conversas[0].mensagens[1]?.estado !== 'gerando'
                );
            });
            if (terminou) {
                concluiu = true;
                break;
            }
            await esperar(1000);
        }
        assert.equal(concluiu, true, 'A geração deve terminar dentro de 180 segundos.');
        const gerada = await pagina.evaluate(async () => {
            const resultado = await window.selene!.estado();
            if (!resultado.ok) throw new Error(resultado.erro);
            return resultado.valor.conversas[0];
        });
        assert.equal(gerada.mensagens[1].estado, 'concluida', gerada.mensagens[1].texto);
        assert.match(gerada.mensagens[1].texto, /4|quatro/i);
        assert.ok(gerada.mensagens[1].desempenho?.tokensPorSegundo! > 0, 'O motor deve informar tempos reais.');
        await pagina.getByRole('button', { name: gerada.titulo, exact: true }).click();
        await pagina.screenshot({ path: 'artifacts/selene-inferencia.png' });
        console.log(`Inferência GGUF validada: ${gerada.mensagens[1].texto}`);
        const projeto = resolve(dados, 'projeto-validacao');
        await mkdir(projeto);
        await aplicativo.evaluate(({ dialog }, caminho) => {
            dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [caminho] });
        }, projeto);
        const codigoId = await pagina.evaluate(async () => {
            const ponte = window.selene as PonteSelene;
            const configuracao = await ponte.estado();
            if (!configuracao.ok) throw new Error(configuracao.erro);
            const ajuste = await ponte.configurar({ ...configuracao.valor.configuracao, maxTokens: 512 });
            if (!ajuste.ok) throw new Error(ajuste.erro);
            const nova = await ponte.novaConversa('code');
            if (!nova.ok) throw new Error(nova.erro);
            const modelo = await ponte.alterarConversa(nova.valor.id, { modeloId: configuracao.valor.modelos[0].id });
            if (!modelo.ok) throw new Error(modelo.erro);
            const escolha = await ponte.escolherProjeto(nova.valor.id);
            if (!escolha.ok) throw new Error(escolha.erro);
            const enviada = await ponte.enviar(
                nova.valor.id,
                'Use apenas escrever_arquivo para criar resultado.txt com o conteúdo exato "teste local". ' +
                    'Não use terminal. Depois confirme que o arquivo foi criado.',
            );
            if (!enviada.ok) throw new Error(enviada.erro);
            return nova.valor.id;
        });
        console.log('Modo code real: aguardando a proposta de escrita do modelo.');
        let aprovada = false;
        let codigoConcluiu = false;
        for (let tentativa = 0; tentativa < 180; tentativa++) {
            const situacao = await pagina.evaluate(async (id) => {
                const resultado = await window.selene!.estado();
                if (!resultado.ok) throw new Error(resultado.erro);
                return {
                    conversa: resultado.valor.conversas.find((item) => item.id === id)!,
                    ativa: resultado.valor.conversaEmExecucao,
                };
            }, codigoId);
            const mensagem = situacao.conversa.mensagens[1];
            const pendente = mensagem?.acoes.find((acao) => acao.estado === 'aguardando');
            if (pendente) {
                assert.equal(pendente.nome, 'escrever_arquivo');
                assert.equal(resolve(projeto, String(pendente.argumentos.caminho)), resolve(projeto, 'resultado.txt'));
                await assert.rejects(readFile(resolve(projeto, 'resultado.txt')));
                await pagina.getByRole('button', { name: situacao.conversa.titulo }).click();
                await pagina.getByRole('button', { name: 'Aprovar', exact: true }).waitFor();
                await pagina.screenshot({ path: 'artifacts/selene-aprovacao.png' });
                await pagina.getByRole('button', { name: 'Aprovar', exact: true }).click();
                aprovada = true;
            }
            if (!situacao.ativa && mensagem?.estado !== 'gerando') {
                assert.equal(mensagem.estado, 'concluida', mensagem.texto);
                codigoConcluiu = true;
                break;
            }
            await esperar(1000);
        }
        assert.equal(aprovada && codigoConcluiu, true, 'O modo code real deve aguardar aprovação e concluir.');
        assert.equal((await readFile(resolve(projeto, 'resultado.txt'), 'utf8')).trim(), 'teste local');
        await pagina.screenshot({ path: 'artifacts/selene-code-real.png' });
        console.log('Modo code GGUF validado: escrita aguardou aprovação e foi executada no projeto isolado.');
        await pagina.evaluate(async () => {
            const ponte = window.selene!;
            const nova = await ponte.novaConversa('chat');
            if (!nova.ok) throw new Error(nova.erro);
            const enviada = await ponte.enviar(nova.valor.id, 'Escreva um livro detalhado sobre TypeScript.');
            if (!enviada.ok) throw new Error(enviada.erro);
        });
        await esperar(500);
        await pagina.evaluate(async () => {
            const resultado = await window.selene!.cancelar();
            if (!resultado.ok) throw new Error(resultado.erro);
        });
        await pagina.waitForFunction(async () => {
            const resultado = await window.selene!.estado();
            return resultado.ok && !resultado.valor.conversaEmExecucao;
        });
        const cancelada = await pagina.evaluate(async () => {
            const resultado = await window.selene!.estado();
            if (!resultado.ok) throw new Error(resultado.erro);
            return resultado.valor.conversas[0].mensagens[1].estado;
        });
        assert.equal(cancelada, 'interrompida');
        console.log('Cancelamento da geração real validado.');
        await pagina.evaluate(async () => {
            const resultado = await window.selene!.pararMotor();
            if (!resultado.ok) throw new Error(resultado.erro);
        });
        if (process.env.SELENE_TESTE_DOWNLOAD) {
            await aplicativo.close();
            aplicativo = await abrir();
            pagina = await aplicativo.firstWindow();
            await pagina.getByRole('button', { name: 'Modelo da conversa', exact: true }).waitFor();
            const resultado = await pagina.evaluate(() => window.selene!.estado());
            assert.ok(resultado.ok);
            const modelo = resultado.valor.modelos.find(
                (item) => item.catalogoId === process.env.SELENE_TESTE_DOWNLOAD,
            );
            assert.ok(modelo, 'O cadastro do modelo baixado deve sobreviver ao reinício.');
            assert.equal(modelo.caminho, gguf);
            await pagina.getByRole('button', { name: 'Configurações', exact: true }).click();
            await pagina
                .getByRole('navigation', { name: 'Seções das configurações' })
                .getByRole('button', { name: 'Modelos', exact: true })
                .click();
            await pagina.getByText('Opções de ' + modelo.nome, { exact: true }).click();
            await pagina.getByRole('button', { name: 'Excluir download de ' + modelo.nome, exact: true }).click();
            await pagina.getByRole('heading', { name: 'Excluir ' + modelo.nome + '?' }).waitFor();
            await pagina.getByRole('button', { name: 'Excluir download', exact: true }).click();
            await pagina.getByRole('heading', { name: 'Excluir ' + modelo.nome + '?' }).waitFor({ state: 'hidden' });
            await assert.rejects(stat(gguf));
            await pagina.getByRole('button', { name: 'Voltar à conversa' }).click();
            const importado = resolve(dados, 'importado.gguf');
            await writeFile(importado, Buffer.from('GGUFarquivo de teste'));
            await aplicativo.evaluate(({ dialog }, caminho) => {
                dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [caminho] });
            }, importado);
            await pagina.evaluate(async () => {
                const ponte = window.selene as PonteSelene;
                const importacao = await ponte.importarModelo();
                if (!importacao.ok) throw new Error(importacao.erro);
                const estado = await ponte.estado();
                if (!estado.ok) throw new Error(estado.erro);
                const remocao = await ponte.removerModelo(estado.valor.modelos[0].id);
                if (!remocao.ok) throw new Error(remocao.erro);
            });
            assert.equal((await stat(importado)).size, 20);
            console.log(
                'Download persistido após reinício, exclusão gerenciada e preservação de importação validados.',
            );
        }
    }
} finally {
    await aplicativo?.close();
}
