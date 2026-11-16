import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assinaturaCompletar } from '../electron/services/assinaturas';
import { receberResposta } from '../electron/services/streaming';
import { executarProcesso } from '../electron/services/processos';

const pasta = await mkdtemp(join(tmpdir(), 'selene-provedor-real-'));
const destino = resolve('artifacts/auditoria20261115');
await mkdir(destino, { recursive: true });
const inicial = await executarProcesso('git', ['init'], pasta, new AbortController().signal);
assert.equal(inicial.codigo, 0);
let sessao: string | undefined;
const sessoes: string[] = [];
const resultados: { pedido: number; estado: string; arquivos?: string[] }[] = [];
const pedidos = [
    'Trabalhe somente nesta pasta descartável. Crie soma.ts com a função somar(a: number, b: number), ' +
        'exportada, e soma.test.ts com dois testes usando bun:test. Rode bun test. Não faça commit nem rede. ' +
        'Responda em português com o resultado. Não use subagentes.',
    'Continue o mesmo trabalho. Sem apagar os testes anteriores, adicione um teste com números negativos. ' +
        'Execute bun test e informe o resultado. Não use subagentes nem rede.',
];
try {
    for (const [indice, texto] of pedidos.entries()) {
        const controle = new AbortController();
        const prazo = setTimeout(() => controle.abort(), 180000);
        try {
            const resposta = await assinaturaCompletar(
                { provedor: 'chatgpt', id: 'gpt-6.1-sol' },
                {
                    messages: [{ role: 'user', content: texto }],
                },
                controle.signal,
                {
                    modo: 'code',
                    pasta,
                    acessoCompleto: true,
                    sessao,
                    aoSessao: async (id) => {
                        sessao = id;
                        sessoes.push(id);
                    },
                },
            );
            const resultado = await receberResposta(resposta, controle.signal, () => {});
            assert(resultado.texto.trim());
            const teste = await executarProcesso('bun', ['test'], pasta, controle.signal);
            assert.equal(teste.codigo, 0, teste.saida);
            await writeFile(join(destino, `provedorReal${indice + 1}.txt`), teste.saida);
            resultados.push({ pedido: indice + 1, estado: 'passou', arquivos: ['soma.ts', 'soma.test.ts'] });
        } finally {
            clearTimeout(prazo);
        }
    }
    assert.equal(sessoes.length, 2);
    assert.equal(sessoes[0], sessoes[1]);
    assert.match(await readFile(join(pasta, 'soma.test.ts'), 'utf8'), /-\d/);
} catch (erro) {
    resultados.push({ pedido: resultados.length + 1, estado: erro instanceof Error ? erro.message : String(erro) });
    process.exitCode = 1;
} finally {
    await writeFile(join(destino, 'provedorReal.json'), JSON.stringify({ pasta, sessoes, resultados }, null, 4));
    console.log(JSON.stringify(resultados));
}
