import { randomUUID } from 'node:crypto';
import type { Conversa, Mensagem } from '../../shared/contratos';
import { pedidoInicialChatGpt } from '../../shared/chatgptWeb';
import type { ChatGptWeb } from './chatgptWeb';

/** Executa apenas conversas de texto pelo site, sem criar agentes ou disponibilizar ferramentas locais. */
export class ConversaChatGpt {
    private controle?: AbortController;
    conversaId: string | null = null;

    constructor(
        private readonly dependencias: {
            navegador: Pick<ChatGptWeb, 'responder'>;
            salvar: () => Promise<void>;
            publicar: () => void;
        },
    ) {}

    async executar(conversa: Conversa, texto: string): Promise<void> {
        if (!texto.trim() || texto.length > 30000) throw new Error('Escreva uma mensagem com até 30000 caracteres.');
        if (conversa.modo !== 'chat') throw new Error('ChatGPT pelo site está disponível somente no Chat.');
        if (this.controle) throw new Error('Aguarde a resposta atual do ChatGPT.');
        if (conversa.chatgptWeb?.envioIncerto) {
            throw new Error('Confira o último envio na janela do ChatGPT antes de continuar.');
        }
        const controle = new AbortController();
        this.controle = controle;
        this.conversaId = conversa.id;
        const anteriores = [...conversa.mensagens];
        const usuario: Mensagem = {
            id: randomUUID(),
            papel: 'user',
            texto,
            estado: 'concluida',
            acoes: [],
            criadoEm: new Date().toISOString(),
        };
        const resposta: Mensagem = {
            id: randomUUID(),
            papel: 'assistant',
            texto: '',
            estado: 'gerando',
            acoes: [],
            criadoEm: new Date().toISOString(),
            inicioTextoFinal: 0,
        };
        conversa.mensagens.push(usuario, resposta);
        conversa.atualizadoEm = usuario.criadoEm;
        let salvo = false;
        try {
            await this.dependencias.salvar();
            salvo = true;
            this.dependencias.publicar();
            const vinculo = (conversa.chatgptWeb ??= { envioIncerto: false });
            const pedido = vinculo.url ? texto : pedidoInicialChatGpt([...anteriores, usuario]);
            resposta.texto = await this.dependencias.navegador.responder({
                texto: pedido,
                url: vinculo.url,
                sinal: controle.signal,
                antesDeEnviar: async () => {
                    vinculo.envioIncerto = true;
                    await this.dependencias.salvar();
                },
                registrarConversa: async (url) => {
                    vinculo.url = url;
                    await this.dependencias.salvar();
                    this.dependencias.publicar();
                },
                confirmarEnvio: async (url) => {
                    if (url) {
                        vinculo.url = url;
                        vinculo.envioIncerto = false;
                        await this.dependencias.salvar();
                    }
                },
                publicar: (texto) => {
                    resposta.texto = texto;
                    this.dependencias.publicar();
                },
            });
            controle.signal.throwIfAborted();
            resposta.estado = 'concluida';
        } catch (erro) {
            if (!salvo) {
                conversa.mensagens = anteriores;
                throw erro;
            }
            resposta.estado = controle.signal.aborted ? 'interrompida' : 'erro';
            const detalhe = controle.signal.aborted
                ? 'Conversa interrompida pelo usuário.'
                : erro instanceof Error
                  ? erro.message
                  : 'Não foi possível conversar com o ChatGPT.';
            resposta.texto += `${resposta.texto ? '\n\n' : ''}${detalhe}`;
        } finally {
            resposta.concluidoEm = new Date().toISOString();
            try {
                if (salvo) await this.dependencias.salvar();
            } finally {
                this.controle = undefined;
                this.conversaId = null;
                this.dependencias.publicar();
            }
        }
    }

    cancelar(): void {
        this.controle?.abort();
    }
}
