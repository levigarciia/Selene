import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { safeStorage } from 'electron';
import { interpretarErroOpenRouter, solicitarOpenRouter } from './solicitacaoOpenRouter';
import {
    esquemaModeloOpenRouter,
    type ModeloOpenRouter,
    type OrdenacaoOpenRouter,
    type SaldoOpenRouter,
} from '../../shared/openrouter';

/** Mantém a credencial no processo principal e consulta o catálogo oficial para enviar solicitações. */
export class OpenRouter {
    private chave = '';
    private catalogos = new Map<OrdenacaoOpenRouter, { modelos: ModeloOpenRouter[]; consultadoEm: number }>();

    constructor(private readonly pasta: string) {}

    get configurado(): boolean {
        return !!this.chave;
    }

    async abrir(): Promise<void> {
        try {
            const dados = await readFile(join(this.pasta, 'openrouter.key'));
            if (!safeStorage.isEncryptionAvailable()) throw new Error('Proteção da chave indisponível.');
            this.chave = safeStorage.decryptString(dados);
        } catch (erro) {
            if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro;
        }
    }

    async configurar(chave: string): Promise<void> {
        if (!safeStorage.isEncryptionAvailable()) throw new Error('Proteção da chave indisponível.');
        const destino = join(this.pasta, 'openrouter.key');
        await writeFile(`${destino}.tmp`, safeStorage.encryptString(chave));
        await rename(`${destino}.tmp`, destino);
        this.chave = chave;
    }

    async modelos(atualizar = false, ordenacao: OrdenacaoOpenRouter = 'most-popular'): Promise<ModeloOpenRouter[]> {
        const anterior = this.catalogos.get(ordenacao);
        if (!atualizar && anterior && Date.now() - anterior.consultadoEm < 300000) return anterior.modelos;
        const resposta = await fetch(`https://openrouter.ai/api/v1/models?sort=${ordenacao}`, {
            signal: AbortSignal.timeout(30000),
        });
        if (!resposta.ok) throw new Error(`Não foi possível consultar o catálogo: HTTP ${resposta.status}.`);
        const bruto = (await resposta.json()) as { data?: unknown[] };
        if (!Array.isArray(bruto.data)) throw new Error('Catálogo OpenRouter inválido.');
        const modelos = bruto.data.flatMap((item) => {
            const validado = esquemaModeloOpenRouter.safeParse(item);
            if (!validado.success) return [];
            const modelo = validado.data;
            const precos = [Number(modelo.pricing.prompt), Number(modelo.pricing.completion)];
            return modelo.architecture.output_modalities.includes('text') &&
                precos.every((preco) => Number.isFinite(preco) && preco >= 0)
                ? [modelo]
                : [];
        });
        if (!modelos.length) throw new Error('O catálogo não retornou modelos de texto válidos.');
        this.catalogos.set(ordenacao, { modelos, consultadoEm: Date.now() });
        return modelos;
    }

    /** Consulta o saldo da conta com a chave configurada, sem expor a credencial ao renderer. */
    async saldo(): Promise<SaldoOpenRouter> {
        if (!this.chave) throw new Error('Configure a chave de API do OpenRouter nas configurações.');
        const resposta = await fetch('https://openrouter.ai/api/v1/credits', {
            headers: { Authorization: `Bearer ${this.chave}` },
            signal: AbortSignal.timeout(15000),
        });
        if (!resposta.ok) throw new Error(`Não foi possível consultar o saldo: HTTP ${resposta.status}.`);
        const bruto = (await resposta.json()) as { data?: { total_credits?: unknown; total_usage?: unknown } };
        const creditos = Number(bruto.data?.total_credits);
        const usado = Number(bruto.data?.total_usage);
        if (!Number.isFinite(creditos) || !Number.isFinite(usado)) throw new Error('Saldo OpenRouter inválido.');
        return { creditos, usado, restante: creditos - usado };
    }

    async completar(
        modelo: string,
        corpo: unknown,
        sinal: AbortSignal,
        registrarCusto: (custo: number) => Promise<void>,
    ): Promise<Response> {
        if (!this.chave) throw new Error('Configure a chave de API do OpenRouter nas configurações.');
        const entrada = corpo as Record<string, unknown>;
        const parametros = Object.fromEntries(
            Object.entries(entrada).filter(
                ([nome]) =>
                    ![
                        'cache_prompt',
                        'chat_template_kwargs',
                        'reasoning_budget_tokens',
                        'reasoning_format',
                        'stream_options',
                    ].includes(nome),
            ),
        );
        const resposta = await solicitarOpenRouter({
            method: 'POST',
            signal: sinal,
            headers: { Authorization: `Bearer ${this.chave}`, 'Content-Type': 'application/json', 'X-Title': 'Selene' },
            body: JSON.stringify({ ...parametros, model: modelo }),
        });
        if (!resposta.body) throw new Error('O OpenRouter retornou uma resposta vazia.');
        const decodificador = new TextDecoder();
        let pendente = '';
        let registrado = false;
        const observar = async (texto: string) => {
            pendente += texto;
            const linhas = pendente.split('\n');
            pendente = linhas.pop() ?? '';
            for (const linha of linhas) {
                if (!linha.startsWith('data:')) continue;
                const dados = linha.slice(5).trim();
                if (!dados || dados === '[DONE]') continue;
                const evento = JSON.parse(dados);
                if (evento.error) {
                    const status = typeof evento.error.code === 'number' ? evento.error.code : 500;
                    throw new Error(interpretarErroOpenRouter(status, evento).mensagem);
                }
                const custo = evento.usage?.cost;
                if (!registrado && typeof custo === 'number' && Number.isFinite(custo) && custo >= 0) {
                    registrado = true;
                    await registrarCusto(custo);
                }
            }
        };
        const fluxo = resposta.body.pipeThrough(
            new TransformStream<Uint8Array, Uint8Array>({
                transform: async (parte, controlador) => {
                    await observar(decodificador.decode(parte, { stream: true }));
                    controlador.enqueue(parte);
                },
                flush: async () => {
                    await observar(`${decodificador.decode()}\n`);
                },
            }),
        );
        return new Response(fluxo, { headers: resposta.headers });
    }
}
