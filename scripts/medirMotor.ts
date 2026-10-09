import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { encerrarProcesso } from '../electron/services/processos';

type Perfil = {
    nome: string;
    executavel: string;
    dispositivo: string;
    argumentos: string[];
    ambiente?: NodeJS.ProcessEnv;
};
type Medicao = {
    perfil: string;
    repeticao: number;
    contexto: number;
    tokens: number;
    tempoTotalMs: number;
    timings: Record<string, number>;
};

async function reservarPorta(): Promise<number> {
    const servidor = createServer();
    await new Promise<void>((resolver) => servidor.listen(0, '127.0.0.1', resolver));
    const endereco = servidor.address();
    if (!endereco || typeof endereco === 'string') throw new Error('Porta de teste inválida.');
    await new Promise<void>((resolver, rejeitar) => servidor.close((erro) => (erro ? rejeitar(erro) : resolver())));
    return endereco.port;
}

async function encerrar(processo: ChildProcess): Promise<void> {
    if (processo.exitCode !== null) return;
    const terminou = new Promise<void>((resolver) => processo.once('close', () => resolver()));
    encerrarProcesso(processo);
    await terminou;
}

async function medirPerfil(perfil: Perfil, modelo: string): Promise<Medicao[]> {
    const porta = await reservarPorta();
    const chave = randomUUID();
    const contexto = Number(process.env.SELENE_BENCH_CONTEXTO ?? 8192);
    const tokens = Number(process.env.SELENE_BENCH_TOKENS ?? 128);
    const repeticoes = Number(process.env.SELENE_BENCH_REPETICOES ?? 2);
    const argumentos = [
        '-m',
        modelo,
        '--host',
        '127.0.0.1',
        '--port',
        String(porta),
        '--api-key',
        chave,
        '-c',
        String(contexto),
        '-np',
        '1',
        '-ngl',
        '99',
        '--jinja',
        '--no-webui',
        '--device',
        perfil.dispositivo,
        ...perfil.argumentos,
    ];
    const processo = spawn(perfil.executavel, argumentos, {
        cwd: dirname(perfil.executavel),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...perfil.ambiente },
    });
    let registro = '';
    let falha: Error | null = null;
    processo.once('error', (erro) => {
        falha = erro;
    });
    const adicionar = (trecho: Buffer) => {
        registro += trecho.toString();
    };
    processo.stdout.on('data', adicionar);
    processo.stderr.on('data', adicionar);
    const base = `http://127.0.0.1:${porta}`;
    const headers = { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' };
    try {
        const inicio = Date.now();
        let pronto = false;
        while (Date.now() - inicio < 180000) {
            if (falha) throw falha;
            if (processo.exitCode !== null) throw new Error(`O motor encerrou: ${processo.exitCode}.`);
            const resposta = await fetch(`${base}/health`, { headers, signal: AbortSignal.timeout(1000) }).catch(
                () => null,
            );
            if (resposta?.ok) {
                pronto = true;
                break;
            }
            await esperar(250);
        }
        if (!pronto) throw new Error('O motor não iniciou no prazo da medição.');
        console.log(`${perfil.nome}: modelo carregado.`);
        const resultados: Medicao[] = [];
        const prompt =
            'Escreva um guia detalhado sobre como organizar um projeto TypeScript, ' +
            'explicando cada etapa com exemplos simples e recomendações práticas.';
        for (let repeticao = 1; repeticao <= repeticoes; repeticao++) {
            const inicioResposta = performance.now();
            const resposta = await fetch(`${base}/completion`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    prompt,
                    n_predict: tokens,
                    temperature: 0,
                    seed: 42,
                    ignore_eos: true,
                    cache_prompt: false,
                }),
                signal: AbortSignal.timeout(180000),
            });
            const resultado = await resposta.json();
            if (!resposta.ok) throw new Error(`Falha na medição: HTTP ${resposta.status}.`);
            if (!resultado.timings || resultado.timings.predicted_n !== tokens) {
                throw new Error('O servidor retornou uma medição incompleta.');
            }
            const medicao = {
                perfil: perfil.nome,
                repeticao,
                contexto,
                tokens,
                tempoTotalMs: performance.now() - inicioResposta,
                timings: resultado.timings,
            };
            resultados.push(medicao);
            console.log(
                `${perfil.nome}, execução ${repeticao}: ` +
                    `${resultado.timings.predicted_per_second.toFixed(2)} tokens/s, ` +
                    `${resultado.timings.prompt_per_second.toFixed(2)} tokens/s de entrada.`,
            );
        }
        return resultados;
    } finally {
        await encerrar(processo);
        const seguro = registro.replaceAll(chave, '[oculto]');
        await writeFile(join('artifacts', `motor-${perfil.nome}.log`), seguro);
    }
}

const appData = process.env.APPDATA;
if (!appData) throw new Error('Pasta de dados do Windows indisponível.');
const dados = JSON.parse(await readFile(join(appData, 'SeleneRemake', 'selene.json'), 'utf8'));
const modelo =
    process.env.SELENE_TESTE_GGUF ??
    dados.modelos.find((item: { catalogoId?: string }) => item.catalogoId === 'qwen3.5-9b-q4')?.caminho;
if (!modelo) throw new Error('Informe SELENE_TESTE_GGUF ou disponibilize Qwen3.5 9B na Selene.');
const vulkan = join(appData, 'SeleneRemake/runtime/b11521-vulkan/llama-server.exe');
const rocm = process.env.SELENE_BENCH_ROCM ?? join(appData, 'SeleneRemake/runtime/b10327-rocm/llama-server.exe');
const perfis: Perfil[] = [
    { nome: 'vulkan-original', executavel: vulkan, dispositivo: 'Vulkan0', argumentos: [] },
    { nome: 'vulkan-flash', executavel: vulkan, dispositivo: 'Vulkan0', argumentos: ['-fa', 'on'] },
    {
        nome: 'vulkan-q8',
        executavel: vulkan,
        dispositivo: 'Vulkan0',
        argumentos: ['-fa', 'on', '-ctk', 'q8_0', '-ctv', 'q8_0'],
    },
    {
        nome: 'vulkan-threads',
        executavel: vulkan,
        dispositivo: 'Vulkan0',
        argumentos: ['-fa', 'on', '-t', '4', '-tb', '8', '--poll', '0'],
    },
    { nome: 'rocm-flash', executavel: rocm, dispositivo: 'ROCm0', argumentos: ['-fa', 'on'] },
    {
        nome: 'rocm-q8',
        executavel: rocm,
        dispositivo: 'ROCm0',
        argumentos: ['-fa', 'on', '-ctk', 'q8_0', '-ctv', 'q8_0'],
    },
    {
        nome: 'rocm-mmq',
        executavel: rocm,
        dispositivo: 'ROCm0',
        argumentos: ['-fa', 'on'],
        ambiente: { GGML_CUDA_FORCE_MMQ: '1' },
    },
    {
        nome: 'rocm-threads',
        executavel: rocm,
        dispositivo: 'ROCm0',
        argumentos: ['-fa', 'on', '-t', '4', '-tb', '8', '--poll', '0'],
    },
    {
        nome: 'rocm-batch',
        executavel: rocm,
        dispositivo: 'ROCm0',
        argumentos: ['-fa', 'on', '-b', '1024', '-ub', '256'],
    },
];
await mkdir('artifacts', { recursive: true });
const escolhidos = process.env.SELENE_BENCH_PERFIS?.split(',');
const resultados: Medicao[] = [];
for (const perfil of perfis.filter((item) => !escolhidos || escolhidos.includes(item.nome))) {
    try {
        resultados.push(...(await medirPerfil(perfil, modelo)));
    } catch (erro) {
        console.error(`${perfil.nome}: ${erro instanceof Error ? erro.message : 'Falha na medição.'}`);
    }
    await writeFile('artifacts/desempenho-motor.json', JSON.stringify(resultados, null, 4));
}
