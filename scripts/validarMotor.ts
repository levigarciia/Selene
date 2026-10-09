import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { esquemaConfiguracao, type Modelo } from '../shared/contratos';
import { MotorLocal } from '../electron/services/motor';
import { receberResposta } from '../electron/services/streaming';

const arquivo = process.env.SELENE_TESTE_GGUF;
const runtime = process.env.SELENE_TESTE_RUNTIME;
if (!arquivo || !runtime) throw new Error('Informe SELENE_TESTE_GGUF e SELENE_TESTE_RUNTIME.');
await mkdir('.teste-dados', { recursive: true });
const pasta = await mkdtemp(resolve('.teste-dados/motor-'));
const modelo: Modelo = {
    id: crypto.randomUUID(),
    nome: 'Modelo de validação',
    caminho: arquivo,
    tamanho: 0,
};
const configuracao = esquemaConfiguracao.parse({ backend: 'auto', temperatura: 0 });
let cancelarCarga = false;
const motor = new MotorLocal(runtime, () => {
    if (cancelarCarga && motor.estado.fase === 'carregando') {
        cancelarCarga = false;
        motor.parar();
    }
});
try {
    await motor.verificar();
    cancelarCarga = true;
    await assert.rejects(motor.carregar(modelo, configuracao), /interrompida/);
    assert.equal(motor.estado.fase, 'desligado');
    const invalido = join(pasta, 'invalido.gguf');
    await writeFile(invalido, 'GGUFmodelo inválido');
    await assert.rejects(motor.carregar({ ...modelo, caminho: invalido }, { ...configuracao, backend: 'rocm' }));
    assert.equal(motor.estado.fase, 'erro');
    await motor.carregar(modelo, configuracao);
    assert.equal(motor.estado.backendAtivo, 'rocm');
    assert.match(motor.estado.dispositivo!, /RX 7700 XT/);
    console.log('Motor real: carga cancelada, GGUF inválido e recuperação validados.');
    const resultados = [];
    for (let repeticao = 1; repeticao <= 3; repeticao++) {
        const inicio = performance.now();
        const resultado = await receberResposta(
            await motor.completar(
                {
                    model: 'local',
                    stream: true,
                    temperature: 0,
                    seed: 42,
                    max_tokens: 256,
                    ignore_eos: true,
                    cache_prompt: true,
                    stream_options: { include_usage: true },
                    chat_template_kwargs: { enable_thinking: false },
                    messages: [{ role: 'user', content: 'Escreva um guia detalhado sobre projetos TypeScript.' }],
                },
                new AbortController().signal,
            ),
            new AbortController().signal,
            () => {},
        );
        assert.ok(resultado.texto.length > 0);
        assert.ok(resultado.desempenho!.tokensPorSegundo > 0);
        resultados.push({ repeticao, tempoTotalMs: performance.now() - inicio, ...resultado.desempenho });
        console.log(
            `Motor integrado, execução ${repeticao}: ${resultado.desempenho!.tokensPorSegundo.toFixed(2)} tokens/s.`,
        );
    }
    await writeFile('artifacts/desempenho-integrado.json', JSON.stringify(resultados, null, 4));
} finally {
    motor.parar();
}
await assert.rejects(motor.completar({}, new AbortController().signal), /Carregue um modelo/);
assert.equal(motor.estado.fase, 'desligado');
console.log('Encerramento do motor validado.');
