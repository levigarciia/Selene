import { randomUUID } from 'node:crypto';
import type { Conversa, Dados } from '../../shared/contratos';
import {
    encontrarDuplicada,
    esquemaEsquecer,
    esquemaLembrar,
    esquemaMemoria,
    instrucaoExtracaoMemoria,
    interpretarExtracao,
    limiteFixadasAutomaticas,
    selecionarMemorias,
    type Memoria,
} from '../../shared/memoria';
import type { FerramentaPreparada } from './ferramentas';

type Dependencias = {
    dados: () => Dados;
    salvar: () => Promise<void>;
    /** Envia uma solicitação sem streaming ao modelo de extração e devolve o texto da resposta. */
    completarExtracao?: (mensagens: { role: string; content: string }[], sinal: AbortSignal) => Promise<string>;
};

const mensagensPorExtracao = 4;
const janelaExtracao = 6;
const maximoMemorias = 2000;

/**
 * Guarda o que a Selene aprende sobre o usuário. O modelo principal registra fatos com as ferramentas `lembrar`
 * e `esquecer`; quando o OpenRouter está configurado, uma extração gratuita em segundo plano complementa o registro.
 */
export class Memorias {
    private extraindo = false;

    constructor(private readonly dependencias: Dependencias) {}

    get ativa(): boolean {
        return this.dependencias.dados().configuracao.memoria;
    }

    /** Memórias relevantes para a mensagem atual, ou nenhuma quando o recurso está desligado. */
    selecionar(consulta: string): Memoria[] {
        return this.ativa ? selecionarMemorias(consulta, this.dependencias.dados().memorias) : [];
    }

    /** Valida a chamada de ferramenta antes de qualquer efeito, seguindo o contrato das demais ferramentas. */
    preparar(nome: string, entrada: unknown, conversa: Conversa): FerramentaPreparada {
        if (nome === 'lembrar') {
            const argumentos = esquemaLembrar.parse(entrada);
            return {
                argumentos,
                aprovacao: false,
                previa: argumentos.texto,
                executar: async () => {
                    const salva = await this.registrar([argumentos], 'ferramenta', conversa.id);
                    return salva.length ? 'Memória salva.' : 'Esta informação já estava salva.';
                },
            };
        }
        const { id } = esquemaEsquecer.parse(entrada);
        return {
            argumentos: { id },
            aprovacao: false,
            previa: id,
            executar: async () => {
                await this.remover(id);
                return 'Memória apagada.';
            },
        };
    }

    async fixar(id: string, fixada: boolean): Promise<void> {
        const memoria = this.obter(id);
        const anterior = memoria.fixada;
        memoria.fixada = fixada;
        try {
            await this.dependencias.salvar();
        } catch (erro) {
            memoria.fixada = anterior;
            throw erro;
        }
    }

    async remover(id: string): Promise<void> {
        this.obter(id);
        const dados = this.dependencias.dados();
        const anteriores = dados.memorias;
        dados.memorias = anteriores.filter((memoria) => memoria.id !== id);
        try {
            await this.dependencias.salvar();
        } catch (erro) {
            dados.memorias = anteriores;
            throw erro;
        }
    }

    /**
     * Extrai fatos das mensagens recentes a cada poucos turnos. Roda em segundo plano, nunca bloqueia a conversa
     * e ignora falhas, pois a memória é complementar à resposta.
     */
    async extrair(conversa: Conversa): Promise<void> {
        const completar = this.dependencias.completarExtracao;
        const configuracao = this.dependencias.dados().configuracao;
        if (conversa.modo !== 'chat' || !completar || this.extraindo) return;
        if (!configuracao.memoria || !configuracao.extracaoMemoria) return;
        const enviadas = conversa.mensagens.filter((mensagem) => mensagem.papel === 'user').length;
        if (enviadas === 0 || enviadas % mensagensPorExtracao !== 0) return;
        const transcricao = conversa.mensagens
            .filter((mensagem) => mensagem.estado === 'concluida' && mensagem.texto.trim())
            .slice(-janelaExtracao)
            .map((mensagem) => `${mensagem.papel === 'user' ? 'usuário' : 'assistente'}: ${mensagem.texto}`)
            .join('\n\n');
        if (!transcricao) return;
        this.extraindo = true;
        try {
            const resposta = await completar(
                [
                    { role: 'system', content: instrucaoExtracaoMemoria },
                    {
                        role: 'user',
                        content: `Transcrição para analisar:\n\n${transcricao}\n\nRetorne o array JSON agora.`,
                    },
                ],
                AbortSignal.timeout(60000),
            );
            await this.registrar(interpretarExtracao(resposta).slice(0, 2), 'extracao', conversa.id);
        } catch {
            return;
        } finally {
            this.extraindo = false;
        }
    }

    private obter(id: string): Memoria {
        const memoria = this.dependencias.dados().memorias.find((item) => item.id === id);
        if (!memoria) throw new Error('Memória não encontrada.');
        return memoria;
    }

    private async registrar(
        fatos: { texto: string; categoria: Memoria['categoria'] }[],
        origem: Memoria['origem'],
        conversaId: string,
    ): Promise<Memoria[]> {
        const dados = this.dependencias.dados();
        if (!dados.configuracao.memoria) throw new Error('A memória está desativada nas configurações.');
        const anteriores = dados.memorias;
        const novas: Memoria[] = [];
        let fixadas = anteriores.filter((memoria) => memoria.fixada).length;
        for (const fato of fatos) {
            if (encontrarDuplicada(fato.texto, [...anteriores, ...novas])) continue;
            const automatica = ['identidade', 'contato'].includes(fato.categoria) && fixadas < limiteFixadasAutomaticas;
            if (automatica) fixadas++;
            novas.push(
                esquemaMemoria.parse({
                    id: randomUUID(),
                    ...fato,
                    fixada: automatica,
                    origem,
                    conversaId,
                    criadoEm: new Date().toISOString(),
                }),
            );
        }
        if (!novas.length) return [];
        dados.memorias = [...anteriores, ...novas].slice(-maximoMemorias);
        try {
            await this.dependencias.salvar();
        } catch (erro) {
            dados.memorias = anteriores;
            throw erro;
        }
        return novas;
    }
}
