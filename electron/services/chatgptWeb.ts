import { BrowserWindow, session } from 'electron';
import { setTimeout as esperar } from 'node:timers/promises';
import { navegacaoChatGptPermitida, urlConversaChatGpt, type ObservacaoChatGpt } from '../../shared/chatgptWeb';
import { enviarPaginaChatGpt, focarEditorChatGpt, observarPaginaChatGpt, pararPaginaChatGpt } from './paginaChatGpt';
import { validarDestinoPublico } from './enderecoWeb';

const particao = 'persist:selene-chatgpt-web';
const mundo = 1901;

/** Mantém o site do ChatGPT numa sessão separada, sem preload, Node, MCP ou operações do computador. */
export class ChatGptWeb {
    private janela?: BrowserWindow;
    private readonly popups = new Set<BrowserWindow>();
    private preparada = false;
    private ocupada = false;

    private proteger(janela: BrowserWindow): void {
        const conteudo = janela.webContents;
        const impedir = (evento: Electron.Event, url: string) => {
            if (!navegacaoChatGptPermitida(url)) evento.preventDefault();
        };
        conteudo.on('will-navigate', impedir);
        conteudo.on('will-redirect', impedir);
        conteudo.on('will-attach-webview', (evento) => evento.preventDefault());
        conteudo.setWindowOpenHandler(({ url }) => {
            if (!navegacaoChatGptPermitida(url)) return { action: 'deny' };
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    autoHideMenuBar: true,
                    webPreferences: {
                        partition: particao,
                        contextIsolation: true,
                        nodeIntegration: false,
                        sandbox: true,
                    },
                },
            };
        });
        conteudo.on('did-create-window', (popup) => {
            this.popups.add(popup);
            this.proteger(popup);
            popup.once('closed', () => this.popups.delete(popup));
        });
    }

    private obterJanela(): BrowserWindow {
        if (this.janela && !this.janela.isDestroyed()) return this.janela;
        const sessao = session.fromPartition(particao);
        if (!this.preparada) {
            sessao.setPermissionRequestHandler((_conteudo, _permissao, responder) => responder(false));
            sessao.setPermissionCheckHandler(() => false);
            sessao.on('will-download', (evento) => evento.preventDefault());
            sessao.webRequest.onBeforeRequest((pedido, responder) => {
                if (/^(data:|blob:|about:blank$)/.test(pedido.url)) return responder({ cancel: false });
                void validarDestinoPublico(pedido.url).then(
                    () => responder({ cancel: !pedido.url.startsWith('https://') }),
                    () => responder({ cancel: true }),
                );
            });
            this.preparada = true;
        }
        const janela = new BrowserWindow({
            title: 'ChatGPT',
            width: 1024,
            height: 800,
            show: false,
            autoHideMenuBar: true,
            webPreferences: { session: sessao, contextIsolation: true, nodeIntegration: false, sandbox: true },
        });
        this.janela = janela;
        this.proteger(janela);
        return janela;
    }

    async abrir(url?: string): Promise<void> {
        const janela = this.obterJanela();
        janela.show();
        janela.focus();
        if (this.ocupada) return;
        const destino = url ? urlConversaChatGpt(url) : null;
        if (url && !destino) throw new Error('O link salvo da conversa do ChatGPT é inválido.');
        const atual = janela.webContents.getURL();
        if (!atual || (destino && destino !== urlConversaChatGpt(atual) && (await this.podeTrocarPagina(janela)))) {
            await janela.loadURL(destino ?? 'https://chatgpt.com/');
        }
    }

    private async podeTrocarPagina(janela: BrowserWindow): Promise<boolean> {
        const url = janela.webContents.getURL();
        if (!url || url === 'about:blank') return true;
        if (new URL(url).origin !== 'https://chatgpt.com' || /^\/(auth|login)(\/|$)/.test(new URL(url).pathname)) {
            janela.show();
            throw new Error('Conclua o login na janela do ChatGPT antes de trocar de conversa.');
        }
        const observacao = await this.executar<ObservacaoChatGpt>(observarPaginaChatGpt);
        if (observacao.textoEditor || observacao.gerando) {
            janela.show();
            throw new Error('Há uma geração ou um rascunho no ChatGPT. Conclua isso antes de trocar de conversa.');
        }
        return true;
    }

    private executar<T>(funcao: (...argumentos: never[]) => unknown, argumentos: unknown[] = []): Promise<T> {
        const janela = this.obterJanela();
        if (new URL(janela.webContents.getURL() || 'about:blank').origin !== 'https://chatgpt.com') {
            janela.show();
            throw new Error('Entre no ChatGPT na janela de conexão antes de enviar.');
        }
        return janela.webContents.executeJavaScriptInIsolatedWorld(mundo, [
            {
                code: `(${funcao.toString()})(...${JSON.stringify(argumentos)})`,
            },
        ]) as Promise<T>;
    }

    async responder(pedido: {
        texto: string;
        url?: string;
        sinal: AbortSignal;
        antesDeEnviar: () => Promise<void>;
        registrarConversa: (url: string) => Promise<void>;
        confirmarEnvio: (url: string | null) => Promise<void>;
        publicar: (texto: string) => void;
    }): Promise<string> {
        if (this.ocupada) throw new Error('Aguarde a resposta atual do ChatGPT.');
        const janela = this.obterJanela();
        this.ocupada = true;
        let enviado = false;
        let concluido = false;
        let usuariosAnteriores = 0;
        let urlEnviada: string | null = null;
        const normalizar = (texto: string) => texto.replace(/\s+/g, ' ').trim();
        const pararCarregamento = () => {
            if (!janela.isDestroyed() && janela.webContents.isLoadingMainFrame()) janela.webContents.stop();
        };
        pedido.sinal.addEventListener('abort', pararCarregamento, { once: true });
        try {
            pedido.sinal.throwIfAborted();
            const destino = pedido.url ? urlConversaChatGpt(pedido.url) : null;
            if (pedido.url && !destino) throw new Error('O link salvo da conversa do ChatGPT é inválido.');
            const atual = janela.webContents.getURL();
            if (
                !atual ||
                (destino && urlConversaChatGpt(atual) !== destino) ||
                (!destino && urlConversaChatGpt(atual))
            ) {
                await this.podeTrocarPagina(janela);
                await janela.loadURL(destino ?? 'https://chatgpt.com/');
            }
            let observacao: ObservacaoChatGpt | undefined;
            let prontaDesde = 0;
            let historicoAnterior = '';
            for (let tentativa = 0; tentativa < 100; tentativa++) {
                pedido.sinal.throwIfAborted();
                observacao = await this.executar<ObservacaoChatGpt>(observarPaginaChatGpt);
                if (observacao.login) {
                    janela.show();
                    throw new Error('Entre no ChatGPT na janela de conexão e envie novamente após o login.');
                }
                const historico = JSON.stringify([observacao.usuarios, observacao.respostaId]);
                const paginaCorreta = !destino || urlConversaChatGpt(janela.webContents.getURL()) === destino;
                if (historico !== historicoAnterior) prontaDesde = 0;
                historicoAnterior = historico;
                if (observacao.editor && paginaCorreta && (!destino || observacao.usuarios.length > 0)) {
                    prontaDesde ||= Date.now();
                    if (Date.now() - prontaDesde >= 1500) break;
                } else prontaDesde = 0;
                await esperar(300, undefined, { signal: pedido.sinal });
            }
            if (!observacao?.editor || !prontaDesde || Date.now() - prontaDesde < 1500) {
                janela.show();
                throw new Error('A conversa do ChatGPT ainda não carregou. Confira a janela antes de enviar.');
            }
            if (observacao.gerando || !(await this.executar<boolean>(focarEditorChatGpt))) {
                janela.show();
                throw new Error('Há uma geração ou um rascunho no ChatGPT. Conclua isso na janela antes de enviar.');
            }
            usuariosAnteriores = observacao.usuarios.length;
            await janela.webContents.insertText(pedido.texto);
            pedido.sinal.throwIfAborted();
            await pedido.antesDeEnviar();
            pedido.sinal.throwIfAborted();
            enviado = await this.executar<boolean>(enviarPaginaChatGpt, [pedido.texto]);
            if (!enviado)
                throw new Error('O ChatGPT não confirmou o clique de envio. Confira a janela antes de repetir.');
            let confirmado = false;
            let urlRegistrada = destino;
            let resposta = '';
            let ultimaMudanca = Date.now();
            const inicio = Date.now();
            for (;;) {
                pedido.sinal.throwIfAborted();
                if (janela.isDestroyed()) throw new Error('A janela do ChatGPT foi fechada durante a resposta.');
                const urlAtual = urlConversaChatGpt(janela.webContents.getURL());
                if (urlAtual && !urlRegistrada) {
                    await pedido.registrarConversa(urlAtual);
                    urlRegistrada = urlAtual;
                }
                const atualizada = await this.executar<ObservacaoChatGpt>(observarPaginaChatGpt);
                if (!confirmado && atualizada.usuarios.length > observacao.usuarios.length) {
                    if (normalizar(atualizada.usuarios.at(-1) ?? '') !== normalizar(pedido.texto)) {
                        throw new Error(
                            'Outro envio apareceu na janela do ChatGPT. Confira a conversa antes de continuar.',
                        );
                    }
                    confirmado = true;
                    urlEnviada = urlConversaChatGpt(janela.webContents.getURL());
                    await pedido.confirmarEnvio(urlEnviada);
                }
                if (
                    confirmado &&
                    (atualizada.usuarios.length !== usuariosAnteriores + 1 ||
                        normalizar(atualizada.usuarios.at(-1) ?? '') !== normalizar(pedido.texto) ||
                        (urlEnviada && urlConversaChatGpt(janela.webContents.getURL()) !== urlEnviada))
                ) {
                    throw new Error(
                        'A conversa foi alterada na janela do ChatGPT. Confira a resposta diretamente no site.',
                    );
                }
                if (!confirmado && Date.now() - inicio > 15000) {
                    throw new Error('O site não confirmou o envio. Confira o ChatGPT antes de reenviar.');
                }
                if (
                    confirmado &&
                    atualizada.respostaId !== observacao.respostaId &&
                    atualizada.resposta &&
                    atualizada.resposta !== resposta
                ) {
                    resposta = atualizada.resposta;
                    ultimaMudanca = Date.now();
                    pedido.publicar(resposta);
                }
                if (confirmado && resposta && !atualizada.gerando && Date.now() - ultimaMudanca >= 1500) {
                    const url = urlConversaChatGpt(janela.webContents.getURL());
                    if (!url)
                        throw new Error('O ChatGPT não informou o endereço da conversa. Confira o envio no site.');
                    await pedido.confirmarEnvio(url);
                    pedido.sinal.throwIfAborted();
                    concluido = true;
                    return resposta;
                }
                if (atualizada.erro && !atualizada.gerando) throw new Error(atualizada.erro);
                if (Date.now() - inicio > 10 * 60000)
                    throw new Error('O ChatGPT não concluiu a resposta em dez minutos.');
                await esperar(300, undefined, { signal: pedido.sinal });
            }
        } finally {
            pedido.sinal.removeEventListener('abort', pararCarregamento);
            if (enviado && !concluido && !janela.isDestroyed()) {
                const observacao = await Promise.resolve()
                    .then(() => this.executar<ObservacaoChatGpt>(observarPaginaChatGpt))
                    .catch(() => null);
                if (
                    observacao?.usuarios.length === usuariosAnteriores + 1 &&
                    normalizar(observacao.usuarios.at(-1) ?? '') === normalizar(pedido.texto) &&
                    (!urlEnviada || urlConversaChatGpt(janela.webContents.getURL()) === urlEnviada)
                ) {
                    await Promise.resolve()
                        .then(() => this.executar(pararPaginaChatGpt))
                        .catch(() => undefined);
                }
            }
            this.ocupada = false;
        }
    }

    encerrar(): void {
        for (const popup of this.popups) if (!popup.isDestroyed()) popup.destroy();
        this.popups.clear();
        if (this.janela && !this.janela.isDestroyed()) this.janela.destroy();
        this.janela = undefined;
    }
}
