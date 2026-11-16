import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MotorLocal } from '../electron/services/motor';
import { esquemaConfiguracao } from '../shared/contratos';
import { parametrosRaciocinio } from '../shared/raciocinio';

const raiz = join(process.env.APPDATA!, 'Selene');
const modelo = { id: 'medicao-lfm3', nome: 'LFM3 Omni 2B', catalogoId: 'lfm3-omni-2b-q4',
    caminho: join(raiz, 'models', 'lfm3-omni-2b-q4.gguf'), tamanho: 1099630080 };
const motor = new MotorLocal(join(raiz, 'runtime'), () => {});
const medicoes = [];
try {
    for (const backend of ['cpu', 'vulkan'] as const) {
        const configuracao = esquemaConfiguracao.parse({ backend, limitesAutomaticos: false,
            contexto: 4096, camadasGpu: backend === 'cpu' ? 0 : 999 });
        await motor.carregar(modelo, configuracao);
        if (motor.estado.backendAtivo !== backend) throw new Error('Backend diferente do solicitado.');
        for (let repeticao = 0; repeticao < 3; repeticao++) {
            const resposta = await motor.completar({ messages: [{ role: 'user', content:
                'Escreva uma lista numerada de cem fatos curtos sobre astronomia, sem introdução.' }],
                max_tokens: 256, temperature: 0, cache_prompt: false,
                ...parametrosRaciocinio(modelo, 'desativado', 256) }, AbortSignal.timeout(120000));
            if (!resposta.ok) throw new Error(await resposta.text());
            const dados = await resposta.json();
            const medicao = { backend, dispositivo: motor.estado.dispositivo, repeticao,
                tokens: dados.timings?.predicted_n, tokensPorSegundo: dados.timings?.predicted_per_second,
                tempoEntradaMs: dados.timings?.prompt_ms, contexto: 4096 };
            if (!medicao.tokens || !medicao.tokensPorSegundo) throw new Error('Motor não informou a velocidade.');
            medicoes.push(medicao);
            console.log(JSON.stringify(medicao));
        }
        motor.parar();
    }
} finally {
    motor.parar();
}
await mkdir('artifacts/lfm3', { recursive: true });
await writeFile('artifacts/lfm3/desempenho-gpu.json', JSON.stringify(medicoes, null, 4));
