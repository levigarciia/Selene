import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { _electron as electron } from 'playwright';
import { esquemaDados } from '../shared/contratos';

await mkdir('.teste-dados', { recursive: true });
await mkdir('artifacts', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados', 'esforco-anexos-'));
const conversaId = randomUUID();
const modeloId = randomUUID();
const dados = esquemaDados.parse({
    versao: 1,
    configuracao: {},
    modelos: [
        {
            id: modeloId,
            nome: 'Codex de validação',
            caminho: 'chatgpt:gpt-6.1-sol',
            tamanho: 0,
            assinatura: { provedor: 'chatgpt', id: 'gpt-6.1-sol' },
        },
    ],
    conversas: [
        {
            id: conversaId,
            titulo: 'Validação de esforço e anexos',
            modo: 'code',
            projeto: pasta,
            modeloId,
            atualizadoEm: new Date().toISOString(),
            rascunho: 'Validação',
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
const aplicativo = await electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'),
    args: ['.'],
    env: ambiente,
});
try {
    const pagina = await aplicativo.firstWindow();
    const erros: string[] = [];
    pagina.on('pageerror', (erro) => erros.push(erro.message));
    await pagina.getByRole('button', { name: 'Code', exact: true }).click();
    await pagina.getByRole('button', { name: 'Validação de esforço e anexos', exact: true }).click();
    const seletor = pagina.getByRole('button', { name: 'Nível de raciocínio', exact: true });
    await seletor.click();
    assert.equal(await pagina.getByRole('menuitemradio').count(), 6);
    await pagina.getByRole('menuitemradio', { name: 'Baixo', exact: true }).click();
    const imagem = await pagina.evaluate(() => {
        const tela = document.createElement('canvas');
        tela.width = 120;
        tela.height = 120;
        const contexto = tela.getContext('2d')!;
        contexto.fillStyle = '#00cc00';
        contexto.fillRect(0, 0, 120, 120);
        return tela.toDataURL('image/png');
    });
    const arquivos = Array.from({ length: 6 }, (_, indice) => ({
        name: `verde${indice + 1}.png`,
        mimeType: 'image/png',
        buffer: Buffer.from(imagem.split(',')[1], 'base64'),
    }));
    await pagina.locator('[data-ui~="tela-conversa"]:visible').getByLabel('Selecionar anexos').setInputFiles(arquivos);
    await pagina.waitForFunction(() => document.querySelectorAll('[data-ui="anexo-rascunho"]').length === 6);
    await pagina
        .locator('textarea[aria-label="Mensagem"]:visible')
        .fill(
            'Qual é a cor predominante das imagens anexadas? Responda somente com o nome da cor, sem usar ferramentas.',
        );
    await pagina.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    const prazo = Date.now() + 120000;
    while (true) {
        const atual = await pagina.evaluate(() => window.selene!.estado());
        assert(atual.ok);
        const ultima = atual.valor.conversas.find((item) => item.id === conversaId)?.mensagens.at(-1);
        if (ultima?.papel === 'assistant' && ultima.estado !== 'gerando' && !atual.valor.conversaEmExecucao) break;
        assert(Date.now() < prazo, 'O Codex não concluiu o envio dentro de dois minutos.');
        await esperar(250);
    }
    const estado = await pagina.evaluate(() => window.selene!.estado());
    assert(estado.ok);
    const conversa = estado.valor.conversas.find((item) => item.id === conversaId)!;
    assert.equal(conversa.nivelRaciocinio, 'baixo');
    assert.equal(conversa.mensagens[0].imagens?.length, 6);
    assert.equal(conversa.mensagens.at(-1)?.estado, 'concluida', conversa.mensagens.at(-1)?.texto ?? 'Sem resposta.');
    assert.match(conversa.mensagens.at(-1)!.texto, /verde|green/i);
    assert.deepEqual(erros, []);
    const salvo = esquemaDados.parse(JSON.parse(await readFile(resolve(pasta, 'selene.json'), 'utf8')));
    assert.equal(salvo.conversas[0].mensagens[0].imagens?.length, 6);
    await pagina.screenshot({ path: 'artifacts/esforco-anexos-assinatura.png' });
    console.log('Codex real: seletor com seis níveis, esforço baixo, seis imagens e histórico persistido validados.');
} finally {
    await aplicativo.close();
}
