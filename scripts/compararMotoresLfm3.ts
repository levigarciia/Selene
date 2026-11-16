import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:net';

const raiz = join(process.env.APPDATA!, 'Selene');
const usarQ8 = process.argv.includes('--q8');
const capturas = JSON.parse(await readFile('artifacts/lfm3/diagnostico-repeticao.json', 'utf8'));
const legado = capturas.find((item: { corpo?: { messages?: { content: string }[] } }) =>
    item.corpo?.messages?.some((mensagem) => mensagem.content.includes('```openui')),
)?.corpo;
if (!legado) throw new Error('Captura de reprodução ausente.');
const servidores = [
    {
        nome: 'original',
        caminho: join(raiz, 'runtime/lfm3-19ff817fb25e9a1b838b1d7f9f4325f7bf9779c4-cpu/llama-server.exe'),
    },
    { nome: 'b12110', caminho: join(process.cwd(), 'artifacts/lfm3/b12110-cpu/llama-server.exe') },
];
const registros: unknown[] = [];
for (const servidor of usarQ8 ? servidores.slice(1) : servidores) {
    const porta = await new Promise<number>((resolver) => {
        const teste = createServer();
        teste.listen(0, '127.0.0.1', () => {
            const endereco = teste.address();
            if (!endereco || typeof endereco === 'string') throw new Error('Porta inválida.');
            teste.close(() => resolver(endereco.port));
        });
    });
    const chave = randomUUID();
    let log = '';
    const caminhoModelo = usarQ8
        ? join(process.cwd(), 'artifacts/lfm3/lfm3-omni-2b-q8.gguf')
        : join(raiz, 'models/lfm3-omni-2b-q4.gguf');
    const processo = spawn(
        servidor.caminho,
        [
            '-m',
            caminhoModelo,
            '--mmproj',
            join(raiz, 'models/lfm3-omni-2b-q4.mmproj.gguf'),
            '--host',
            '127.0.0.1',
            '--port',
            String(porta),
            '--api-key',
            chave,
            '-c',
            '8192',
            '-ngl',
            '0',
            '-np',
            '1',
            '--jinja',
            '--reasoning',
            'off',
            '--no-webui',
        ],
        { windowsHide: true },
    );
    processo.stderr.on('data', (dados) => {
        log += dados.toString();
    });
    processo.stdout.on('data', (dados) => {
        log += dados.toString();
    });
    let erro: Error | undefined;
    processo.on('error', (falha) => {
        erro = falha;
    });
    const cabecalhos = { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' };
    try {
        let pronto = false;
        for (let tentativa = 0; tentativa < 300; tentativa++) {
            if (erro) throw erro;
            if (processo.exitCode !== null) throw new Error(log.slice(-2500));
            pronto = await fetch(`http://127.0.0.1:${porta}/health`, { headers: cabecalhos })
                .then((r) => r.ok)
                .catch(() => false);
            if (pronto) break;
            await Bun.sleep(200);
        }
        if (!pronto) throw new Error('Motor não iniciou.');
        for (const [nome, corpo] of [
            [
                'aritmética',
                {
                    ...legado,
                    messages: [
                        { role: 'user', content: 'Quanto é 2 + 2?' },
                        { role: 'assistant', content: '4' },
                        { role: 'user', content: 'Quanto é 3 + 3?' },
                    ],
                },
            ],
            ['repetição', legado],
            ['repetição sem cache', { ...legado, cache_prompt: false }],
        ] as const) {
            const pedido = { ...corpo, stream: false, seed: 42, max_tokens: 256 };
            const resposta = await fetch(`http://127.0.0.1:${porta}/v1/chat/completions`, {
                method: 'POST',
                headers: cabecalhos,
                body: JSON.stringify(pedido),
                signal: AbortSignal.timeout(120000),
            });
            const dados = await resposta.json();
            registros.push({
                servidor: servidor.nome,
                precisao: usarQ8 ? 'q8' : 'q4',
                nome,
                pedido,
                status: resposta.status,
                dados,
            });
            console.log(
                JSON.stringify({
                    servidor: servidor.nome,
                    nome,
                    status: resposta.status,
                    texto: dados.choices?.[0]?.message?.content,
                    erro: dados.error,
                }),
            );
        }
    } finally {
        processo.kill();
        const sufixo = usarQ8 ? '-q8' : '';
        await writeFile(
            `artifacts/lfm3/motor-${servidor.nome}${sufixo}.log`,
            log.replaceAll(chave, '[credencial omitida]'),
        );
        await writeFile(`artifacts/lfm3/comparacao-motores${sufixo}.json`, JSON.stringify(registros, null, 4));
    }
}
