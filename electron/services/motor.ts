import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import type { BackendMotor, BackendRuntime, Configuracao, EstadoMotor, Modelo } from '../../shared/contratos';
import { instalarRuntime, localizarServidor, pastaRuntime } from './instalador';
import { encerrarProcesso } from './processos';
import { detectarBackend, detectarDispositivo } from './dispositivosMotor';
import { mesmaConfiguracaoMotor } from '../../shared/configuracaoMotor';
import { argumentosMemoriaMotor, contextoAposFalha, contextoDoServidor } from './limitesModelo';
import { prepararProjetorVisual } from './projetorVisual';

async function reservarPorta(): Promise<number> {
    const servidor = createServer();
    return new Promise((resolver, rejeitar) => {
        servidor.once('error', rejeitar);
        servidor.listen(0, '127.0.0.1', () => {
            const endereco = servidor.address();
            if (!endereco || typeof endereco === 'string') {
                servidor.close();
                rejeitar(new Error('Porta inválida.'));
                return;
            }
            servidor.close((erro) => (erro ? rejeitar(erro) : resolver(endereco.port)));
        });
    });
}

/** Gerencia o motor local autenticado em loopback e o ciclo de vida do GGUF carregado. */
export class MotorLocal {
    estado: EstadoMotor = {
        fase: 'desligado',
        detalhe: 'Nenhum modelo carregado',
        instalado: { cpu: false, vulkan: false, rocm: false },
    };
    private processo: ChildProcess | null = null;
    private operacao: AbortController | null = null;
    private porta = 0;
    private chave = '';
    private backendAutomatico: BackendRuntime | null = null;
    private configuracaoCarregada: Configuracao | null = null;
    private projetorCarregado?: string;

    constructor(
        private readonly raiz: string,
        private readonly publicar: () => void,
    ) {}

    async verificar(): Promise<void> {
        this.estado.instalado = {
            cpu: !!(await localizarServidor(pastaRuntime(this.raiz, 'cpu'))),
            vulkan: !!(await localizarServidor(pastaRuntime(this.raiz, 'vulkan'))),
            rocm: !!(await localizarServidor(pastaRuntime(this.raiz, 'rocm'))),
        };
    }

    async instalar(backend: BackendMotor): Promise<void> {
        if (this.operacao) throw new Error('Já existe uma operação do motor em andamento.');
        const controle = new AbortController();
        this.operacao = controle;
        this.atualizar({ fase: 'instalando', detalhe: 'Baixando motor oficial', progresso: 0 });
        try {
            const resolvido = await this.resolverBackend(backend, controle.signal);
            await this.prepararRuntime(resolvido, controle.signal);
            await this.verificar();
            this.atualizar({
                fase: this.processo ? 'pronto' : 'desligado',
                detalhe: 'Motor instalado',
                progresso: undefined,
                backendAtivo: resolvido,
            });
        } catch (erro) {
            if (!controle.signal.aborted) {
                this.atualizar({ fase: 'erro', detalhe: erro instanceof Error ? erro.message : 'Falha na instalação' });
            }
            throw erro;
        } finally {
            this.operacao = null;
        }
    }

    async carregar(
        modelo: Modelo,
        configuracao: Configuracao,
        alternativa = false,
        contextoTentado = 0,
    ): Promise<void> {
        if (this.operacao) throw new Error('Aguarde a operação atual do motor.');
        this.parar();
        const controle = new AbortController();
        this.operacao = controle;
        this.atualizar({
            fase: 'carregando',
            detalhe: `Carregando ${modelo.nome}`,
            modeloId: modelo.id,
            contextoDisponivel: undefined,
        });
        let registro = '';
        let falha: Error | null = null;
        let backend: BackendRuntime | null = null;
        try {
            let ultimaPublicacao = 0;
            const projetorVisual = await prepararProjetorVisual(
                join(dirname(this.raiz), 'models'),
                modelo,
                controle.signal,
                (fase, recebido, total) => {
                    if (fase === 'baixando' && Date.now() - ultimaPublicacao < 200 && recebido !== total) return;
                    ultimaPublicacao = Date.now();
                    this.atualizar({
                        fase: 'carregando',
                        detalhe: fase === 'baixando' ? 'Baixando suporte visual' : 'Verificando suporte visual',
                        progresso: (recebido / total) * 100,
                    });
                },
            );
            controle.signal.throwIfAborted();
            backend = await this.resolverBackend(configuracao.backend, controle.signal);
            const executavel = await this.prepararRuntime(backend, controle.signal);
            this.atualizar({
                fase: 'carregando',
                progresso: undefined,
                detalhe: `Carregando ${modelo.nome}`,
                backendAtivo: backend,
            });
            const argumentosGpu: string[] = [];
            if (backend !== 'cpu') {
                const dispositivo = await detectarDispositivo(executavel, backend, controle.signal);
                argumentosGpu.push('--device', dispositivo.id, '--flash-attn', backend === 'rocm' ? 'on' : 'auto');
                this.atualizar({ dispositivo: dispositivo.nome });
            }
            controle.signal.throwIfAborted();
            this.porta = await reservarPorta();
            this.chave = randomUUID();
            const processo = spawn(
                executavel,
                [
                    '-m',
                    modelo.caminho,
                    '--host',
                    '127.0.0.1',
                    '--port',
                    String(this.porta),
                    '--api-key',
                    this.chave,
                    '-np',
                    '1',
                    ...argumentosMemoriaMotor(configuracao, backend, contextoTentado, !!projetorVisual),
                    '--jinja',
                    '--no-webui',
                    ...(projetorVisual ? ['--mmproj', projetorVisual] : []),
                    ...argumentosGpu,
                ],
                { cwd: dirname(executavel), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
            );
            this.processo = processo;
            const registrar = (trecho: Buffer) => {
                registro = (registro + trecho.toString()).slice(-6000);
            };
            processo.stdout.on('data', registrar);
            processo.stderr.on('data', registrar);
            processo.once('error', (erro) => {
                falha = erro;
            });
            processo.once('exit', (codigo) => {
                falha = new Error(`O motor encerrou com código ${codigo}. ${registro}`);
                if (this.processo === processo) {
                    this.processo = null;
                    this.atualizar({ fase: 'erro', detalhe: falha.message, modeloId: modelo.id });
                }
            });
            const inicio = Date.now();
            while (Date.now() - inicio < 180000) {
                controle.signal.throwIfAborted();
                if (falha) throw falha;
                const resposta = await fetch(`http://127.0.0.1:${this.porta}/health`, {
                    headers: { Authorization: `Bearer ${this.chave}` },
                    signal: AbortSignal.any([controle.signal, AbortSignal.timeout(2000)]),
                }).catch(() => null);
                if (resposta?.ok) {
                    const propriedades = await fetch(`http://127.0.0.1:${this.porta}/props`, {
                        headers: { Authorization: `Bearer ${this.chave}` },
                        signal: AbortSignal.any([controle.signal, AbortSignal.timeout(5000)]),
                    })
                        .then(async (resposta) => (resposta.ok ? await resposta.json() : null))
                        .catch(() => null);
                    controle.signal.throwIfAborted();
                    const contextoDisponivel = contextoDoServidor(propriedades);
                    this.configuracaoCarregada = { ...configuracao };
                    this.projetorCarregado = modelo.projetorVisual;
                    this.atualizar({
                        fase: 'pronto',
                        recarregamentoPendente: false,
                        contextoDisponivel,
                        progresso: undefined,
                        suportaImagens: propriedades?.modalities?.vision === true,
                        detalhe: alternativa ? `${modelo.nome}. ROCm indisponível; usando Vulkan.` : modelo.nome,
                    });
                    return;
                }
                await new Promise((resolver) => setTimeout(resolver, 300));
            }
            throw new Error(`Tempo limite ao carregar o GGUF. ${registro}`);
        } catch (erro) {
            this.encerrarServidor();
            const contextoMenor = contextoAposFalha(registro, contextoTentado);
            if (configuracao.limitesAutomaticos && contextoMenor && !controle.signal.aborted) {
                this.operacao = null;
                await this.carregar(modelo, configuracao, alternativa, contextoMenor);
                return;
            }
            if (configuracao.backend === 'auto' && backend === 'rocm' && !controle.signal.aborted) {
                this.operacao = null;
                this.backendAutomatico = 'vulkan';
                await this.carregar(modelo, { ...configuracao, backend: 'vulkan' }, true, contextoTentado);
                this.configuracaoCarregada = { ...configuracao };
                return;
            }
            if (!controle.signal.aborted) {
                this.atualizar({ fase: 'erro', detalhe: erro instanceof Error ? erro.message : 'Falha na carga' });
            }
            throw erro;
        } finally {
            this.operacao = null;
        }
    }

    parar(): void {
        this.operacao?.abort(new Error('Operação interrompida pelo usuário.'));
        this.encerrarServidor();
        this.configuracaoCarregada = null;
        this.projetorCarregado = undefined;
        this.atualizar({
            fase: 'desligado',
            detalhe: 'Nenhum modelo carregado',
            modeloId: undefined,
            progresso: undefined,
            dispositivo: undefined,
            recarregamentoPendente: false,
            suportaImagens: false,
            contextoDisponivel: undefined,
        });
    }

    /** Marca parâmetros salvos para a próxima carga, mantendo os pesos disponíveis para a sessão atual. */
    aplicarConfiguracao(configuracao: Configuracao): void {
        this.atualizar({
            recarregamentoPendente: this.estado.fase === 'pronto' && this.precisaRecarregar(configuracao),
        });
    }

    /** Confere a carga vigente antes de iniciar uma geração com configurações salvas. */
    precisaRecarregar(configuracao: Configuracao, modelo?: Modelo): boolean {
        return (
            !this.configuracaoCarregada ||
            !mesmaConfiguracaoMotor(this.configuracaoCarregada, configuracao) ||
            (!!modelo && modelo.projetorVisual !== this.projetorCarregado)
        );
    }

    async completar(corpo: unknown, sinal: AbortSignal): Promise<Response> {
        if (this.estado.fase !== 'pronto') throw new Error('Carregue um modelo GGUF para conversar.');
        return fetch(`http://127.0.0.1:${this.porta}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.chave}` },
            body: JSON.stringify(corpo),
            signal: sinal,
        });
    }

    private async resolverBackend(backend: BackendMotor, sinal: AbortSignal): Promise<BackendRuntime> {
        if (backend !== 'auto') return backend;
        this.backendAutomatico ??= await detectarBackend(sinal);
        return this.backendAutomatico;
    }

    private async prepararRuntime(backend: BackendRuntime, sinal: AbortSignal): Promise<string> {
        const existente = await localizarServidor(pastaRuntime(this.raiz, backend));
        if (existente) return existente;
        const servidor = await instalarRuntime(this.raiz, backend, sinal, (progresso) => {
            this.atualizar({
                fase: 'instalando',
                progresso,
                backendAtivo: backend,
                detalhe: progresso >= 90 ? 'Verificando e extraindo motor' : `Baixando motor ${backend.toUpperCase()}`,
            });
        });
        await this.verificar();
        return servidor;
    }

    private encerrarServidor(): void {
        const processo = this.processo;
        this.processo = null;
        if (processo) encerrarProcesso(processo);
    }

    private atualizar(alteracao: Partial<EstadoMotor>): void {
        this.estado = { ...this.estado, ...alteracao };
        this.publicar();
    }
}
