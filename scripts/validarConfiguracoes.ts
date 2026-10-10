import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { esquemaDados } from '../shared/contratos';
import { pidMotor } from './validarSalvamento';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'configuracoes-'));
const modeloId = randomUUID();
const realId = randomUUID();
const caminhoReal = process.env.SELENE_TESTE_GGUF;
const runtime = process.env.SELENE_TESTE_RUNTIME;
assert.ok(runtime, 'Informe um runtime instalado para validar falhas sem downloads.');
await symlink(resolve(runtime), resolve(pasta, 'runtime'), 'junction');
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: { backend: 'rocm', limitesAutomaticos: false, contexto: 4096, maxTokens: 128 },
    modelos: [{ id: modeloId, nome: 'Modelo indisponível', caminho: resolve(pasta, 'ausente.gguf'), tamanho: 1024 }],
    conversas: [],
});
if (caminhoReal) {
    dados.modelos.push({
        id: realId,
        nome: 'Modelo de validação',
        caminho: resolve(caminhoReal),
        tamanho: (await stat(caminhoReal)).size,
    });
}
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
const abrir = () =>
    electron.launch({
        executablePath: resolve('node_modules/electron/dist/electron.exe'),
        args: ['.'],
        env: ambiente,
    });
let aplicativo = await abrir();
try {
    let pagina = await aplicativo.firstWindow();
    pagina.setDefaultTimeout(15000);
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await pagina.getByRole('button', { name: 'Configurações', exact: true }).click();
    const tela = pagina.getByRole('region', { name: 'Configurações', exact: true });
    await tela.getByRole('button', { name: 'Instalados', exact: true }).waitFor();
    await tela.getByText('Opções de Modelo indisponível', { exact: true }).click();
    const linha = pagina.locator('[data-ui="linha-modelo"]').filter({ hasText: 'Modelo indisponível' });
    await linha.getByText('Avançado', { exact: true }).click();
    await linha.getByLabel('Contexto', { exact: true }).fill('8192');
    await linha.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
    await linha.getByText('Perfil salvo. Aplicado na próxima carga.', { exact: true }).waitFor();
    const persistido = JSON.parse(await readFile(resolve(pasta, 'selene.json'), 'utf8'));
    assert.equal(persistido.modelos[0].perfil.contexto, 8192);
    assert.equal(persistido.configuracao.contexto, 4096);
    const invalido = await pagina.evaluate(
        async (id) =>
            window.selene!.configurarModelo(id, {
                backend: 'cpu',
                limitesAutomaticos: false,
                contexto: 0,
                camadasGpu: 0,
            }),
        modeloId,
    );
    assert.equal(invalido.ok, false);
    await tela.getByRole('button', { name: 'Catálogo', exact: true }).click();
    await tela.getByText('Sobre a estimativa', { exact: true }).first().waitFor();
    await tela
        .getByText(/Estimado: .* tokens\/s/)
        .first()
        .waitFor();
    await pagina.screenshot({ path: 'artifacts/selene-catalogo-compatibilidade.png' });
    await tela.getByRole('button', { name: 'Instalados', exact: true }).click();
    const falha = await pagina.evaluate(async (id) => window.selene!.carregarModelo(id), modeloId);
    assert.equal(falha.ok, false);
    await pagina
        .getByRole('navigation', { name: 'Seções das configurações' })
        .getByRole('button', { name: 'Motor', exact: true })
        .click();
    await tela.getByText('Detalhes técnicos', { exact: true }).waitFor();
    assert.equal(await tela.locator('pre:visible').count(), 0);
    await tela.getByRole('button', { name: 'Tentar novamente', exact: true }).waitFor();
    await pagina.screenshot({ path: 'artifacts/selene-motor-diagnostico.png' });
    await tela.getByText('Detalhes técnicos', { exact: true }).click();
    assert.equal(await tela.locator('pre:visible').count(), 1);
    if (caminhoReal) {
        await pagina.evaluate(async (id) => {
            const resultado = await window.selene!.configurarModelo(id, {
                backend: 'rocm',
                limitesAutomaticos: false,
                contexto: 2048,
                camadasGpu: 99,
            });
            if (!resultado.ok) throw new Error(resultado.erro);
        }, realId);
        const carga = pagina.evaluate(async (id) => window.selene!.carregarModelo(id), realId);
        await tela.getByRole('button', { name: 'Cancelar', exact: true }).waitFor();
        await tela.getByRole('button', { name: 'Cancelar', exact: true }).click();
        assert.equal((await carga).ok, false);
        const cancelado = await pagina.evaluate(() => window.selene!.estado());
        assert.ok(cancelado.ok);
        assert.equal(cancelado.valor.motor.fase, 'desligado');
        const carregado = await pagina.evaluate(async (id) => window.selene!.carregarModelo(id), realId);
        assert.ok(carregado.ok, carregado.ok ? '' : carregado.erro);
        const antes = await pidMotor(aplicativo);
        const estadoReal = await pagina.evaluate(() => window.selene!.estado());
        assert.ok(estadoReal.ok);
        assert.equal(estadoReal.valor.motor.contextoDisponivel, 2048);
        await pagina
            .getByRole('navigation', { name: 'Seções das configurações' })
            .getByRole('button', { name: 'Modelos', exact: true })
            .click();
        const linhaReal = pagina.locator('[data-ui="linha-modelo"]').filter({ hasText: 'Modelo de validação' });
        await linhaReal.getByText('Opções de Modelo de validação', { exact: true }).click();
        await linhaReal.getByText('Avançado', { exact: true }).click();
        await linhaReal.getByLabel('Contexto', { exact: true }).fill('4096');
        await linhaReal.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
        await linhaReal.getByText('Perfil salvo. Aplicado na próxima carga.', { exact: true }).waitFor();
        assert.equal(await pidMotor(aplicativo), antes);
        const pendente = await pagina.evaluate(() => window.selene!.estado());
        assert.ok(pendente.ok);
        assert.equal(pendente.valor.motor.recarregamentoPendente, true);
        await pagina.evaluate(async (id) => {
            const resultado = await window.selene!.novaConversa('chat');
            if (!resultado.ok) throw new Error(resultado.erro);
            await window.selene!.alterarConversa(resultado.valor.id, { modeloId: id });
            const enviado = await window.selene!.enviar(resultado.valor.id, 'Responda apenas: pronto');
            if (!enviado.ok) throw new Error(enviado.erro);
        }, realId);
        const prazo = Date.now() + 120000;
        while (Date.now() < prazo) {
            const atual = await pagina.evaluate(() => window.selene!.estado());
            assert.ok(atual.ok);
            if (
                atual.valor.conversaEmExecucao === null &&
                atual.valor.conversas[0]?.mensagens.at(-1)?.estado !== 'gerando'
            )
                break;
            await pagina.waitForTimeout(500);
        }
        const depois = await pagina.evaluate(() => window.selene!.estado());
        assert.ok(depois.ok);
        assert.equal(depois.valor.motor.contextoDisponivel, 4096);
        assert.equal(depois.valor.motor.recarregamentoPendente, false);
        assert.equal(depois.valor.conversas[0].mensagens.at(-1)?.estado, 'concluida');
        await pagina.evaluate(() => window.selene!.pararMotor());
        console.log('GGUF real: cancelamento, carga, perfil sem descarga, recarga no chat e encerramento validados.');
    }
    await aplicativo.close();
    aplicativo = await abrir();
    pagina = await aplicativo.firstWindow();
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await pagina.getByRole('button', { name: 'Configurações', exact: true }).click();
    await pagina.getByText('Opções de Modelo indisponível', { exact: true }).click();
    const reaberta = pagina.locator('[data-ui="linha-modelo"]').filter({ hasText: 'Modelo indisponível' });
    await reaberta.getByText('Avançado', { exact: true }).click();
    assert.equal(await reaberta.getByLabel('Contexto', { exact: true }).inputValue(), '8192');
    await reaberta.getByRole('button', { name: 'Usar preferências gerais', exact: true }).click();
    await reaberta.getByText('Preferências gerais restauradas.', { exact: true }).waitFor();
    assert.equal(await reaberta.getByLabel('Contexto', { exact: true }).inputValue(), '4096');
    await pagina.screenshot({ path: 'artifacts/selene-modelos-perfil.png' });
    const final = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(final.ok);
    assert.equal(final.valor.modelos[0].perfil, undefined);
    await pagina.setViewportSize({ width: 420, height: 760 });
    assert.ok(
        await pagina
            .locator('[data-ui="tela-configuracoes"]')
            .evaluate((elemento) => elemento.scrollWidth <= elemento.clientWidth),
    );
    await pagina.screenshot({ path: 'artifacts/selene-configuracoes-estreitas.png' });
    assert.deepEqual(erros, []);
    console.log(
        'Desktop: perfil persistido, isolamento global, validação IPC, diagnóstico e layout estreito validados.',
    );
} finally {
    await aplicativo.close();
}
