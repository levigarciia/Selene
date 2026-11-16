import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { esquemaDados, type Dados } from '../../shared/contratos';
import { reunirRegistrosUso } from '../../shared/estatisticas';
import { migrarProjetos } from './projetos';
import { recuperarPullRequests } from '../../shared/pullRequests';
import { gravarAtomico } from './arquivosSeguros';
import { comBloqueioDados } from './bloqueioDados';

/**
 * Remove entradas de modelos remotos gravadas sem o vínculo OpenRouter. Elas aparecem como modelos locais
 * porque não têm arquivo nem catálogo; conversas que as usavam passam ao cadastro OpenRouter equivalente.
 */
export function removerModelosRemotosOrfaos(dados: Dados): boolean {
    const orfaos = dados.modelos.filter(
        (modelo) => !modelo.openrouter && !modelo.assinatura && !modelo.chatgptWeb
            && !modelo.catalogoId && modelo.tamanho === 0,
    );
    if (!orfaos.length) return false;
    const substitutos = new Map<string, string>();
    for (const orfao of orfaos) {
        const cadastrado = dados.modelos.find((modelo) => modelo.openrouter && modelo.caminho === orfao.caminho);
        if (cadastrado) substitutos.set(orfao.id, cadastrado.id);
    }
    const removidos = new Set(orfaos.map((orfao) => orfao.id));
    for (const conversa of dados.conversas) {
        if (!conversa.modeloId || !removidos.has(conversa.modeloId)) continue;
        conversa.modeloId = substitutos.get(conversa.modeloId) ?? null;
    }
    dados.modelos = dados.modelos.filter((modelo) => !removidos.has(modelo.id));
    return true;
}

/** Mantém os dados pessoais em arquivo validado, com gravações atômicas e sequenciais. */
export class Persistencia {
    dados: Dados = esquemaDados.parse({ versao: 1, configuracao: {}, modelos: [], conversas: [] });
    private fila: Promise<void> = Promise.resolve();
    private versaoDisco: string | null = null;
    avisoRecuperacao?: string;

    constructor(private readonly pasta: string) {}

    async abrir(): Promise<void> {
        await mkdir(this.pasta, { recursive: true });
        try {
            const texto = await this.lerDados();
            this.versaoDisco = texto;
            const bruto = JSON.parse(texto);
            if (bruto.perfilMotor === undefined && bruto.configuracao?.backend === 'vulkan') {
                bruto.configuracao.backend = 'auto';
            }
            this.dados = esquemaDados.parse(bruto);
            const projetosMigrados = migrarProjetos(this.dados);
            const modelosMigrados = removerModelosRemotosOrfaos(this.dados);
            const prsMigrados = this.dados.conversas.map(recuperarPullRequests).some(Boolean);
            if (bruto.projetos === undefined || projetosMigrados || modelosMigrados || prsMigrados) {
                await this.salvar();
            }
            for (const conversa of this.dados.conversas) {
                for (const envio of conversa.enviosPendentes ?? []) envio.tipo = 'fila';
                if (conversa.modo === 'chat') conversa.acessoCompleto = false;
                for (const mensagem of conversa.mensagens) {
                    delete mensagem.faseContexto;
                    delete mensagem.faseGeracao;
                    if (mensagem.estado === 'gerando') mensagem.estado = 'interrompida';
                    for (const acao of mensagem.acoes) {
                        if (['preparando', 'aguardando', 'executando'].includes(acao.estado)) {
                            acao.estado = 'interrompida';
                        }
                    }
                }
            }
            const corrigidos = reunirRegistrosUso(this.dados);
            const anteriores = new Map(this.dados.registrosUso.map((registro) => [registro.mensagemId, registro]));
            const corrigiuModelo = corrigidos.some((registro) => {
                const anterior = anteriores.get(registro.mensagemId);
                return anterior && anterior.modeloId !== registro.modeloId;
            });
            this.dados.registrosUso = corrigidos;
            if (corrigiuModelo) {
                const instante = new Date().toISOString().replace(/[:.]/g, '');
                await writeFile(join(this.pasta, `selene.antesCorrecaoUso.${instante}.json`), texto, { flag: 'wx' });
                await this.salvar();
            }
        } catch (erro) {
            if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw new Error('Não foi possível ler os dados locais. O arquivo original foi preservado.', {
                    cause: erro,
                });
            }
        }
    }

    private async lerDados(): Promise<string> {
        const destino = join(this.pasta, 'selene.json');
        let original: string | null = null;
        let falha: unknown;
        try {
            original = await readFile(destino, 'utf8');
            esquemaDados.parse(JSON.parse(original));
            return original;
        } catch (erro) {
            falha = erro;
        }
        for (let indice = 1; indice <= 3; indice++) {
            let copia: string;
            try {
                copia = await readFile(join(this.pasta, `selene.backup.${indice}.json`), 'utf8');
                esquemaDados.parse(JSON.parse(copia));
            } catch {
                continue;
            }
            await comBloqueioDados(join(this.pasta, 'selene.lock'), async () => {
                const atual = await this.lerAtual();
                if (atual !== original) throw new Error('Os dados mudaram durante a recuperação.');
                if (original !== null) {
                    const instante = new Date().toISOString().replace(/[:.]/g, '');
                    await writeFile(join(this.pasta, `selene.corrompido.${instante}.json`), original, { flag: 'wx' });
                }
                await gravarAtomico(destino, copia);
            });
            this.avisoRecuperacao = 'Histórico recuperado de uma cópia local. O arquivo danificado foi preservado.';
            return copia;
        }
        throw falha;
    }

    private async lerAtual(): Promise<string | null> {
        try {
            return await readFile(join(this.pasta, 'selene.json'), 'utf8');
        } catch (erro) {
            if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return null;
            throw erro;
        }
    }

    salvar(): Promise<void> {
        this.dados.registrosUso = reunirRegistrosUso(this.dados);
        const texto = JSON.stringify(esquemaDados.parse(this.dados), null, 4);
        const gravar = () => comBloqueioDados(join(this.pasta, 'selene.lock'), async () => {
            const atual = await this.lerAtual();
            if (atual !== this.versaoDisco) {
                throw new Error('Outra instância alterou o histórico. Reabra a Selene antes de salvar.');
            }
            if (atual !== null) {
                esquemaDados.parse(JSON.parse(atual));
                for (let indice = 2; indice >= 1; indice--) {
                    const anterior = await readFile(join(this.pasta, `selene.backup.${indice}.json`), 'utf8')
                        .catch((erro: NodeJS.ErrnoException) => {
                            if (erro.code !== 'ENOENT') throw erro;
                            return null;
                        });
                    if (anterior !== null) {
                        await gravarAtomico(join(this.pasta, `selene.backup.${indice + 1}.json`), anterior);
                    }
                }
                await gravarAtomico(join(this.pasta, 'selene.backup.1.json'), atual);
            }
            await gravarAtomico(join(this.pasta, 'selene.json'), texto);
            this.versaoDisco = texto;
        });
        const proxima = this.fila.then(gravar, gravar);
        this.fila = proxima;
        return proxima;
    }
}
