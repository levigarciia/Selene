import type { ObservacaoChatGpt } from '../../shared/chatgptWeb';

/** Observa somente mensagens e controles de conversa, sem ler login, cookies ou armazenamento do site. */
export function observarPaginaChatGpt(): ObservacaoChatGpt {
    const markdown = (no: Node): string => {
        if (no.nodeType === Node.TEXT_NODE) return no.textContent ?? '';
        if (!(no instanceof HTMLElement)) return '';
        if (['SCRIPT', 'STYLE', 'BUTTON'].includes(no.tagName)) return '';
        if (no.tagName === 'PRE') {
            const codigo = no.querySelector('code');
            return '\n\n```\n' + (codigo?.textContent ?? no.textContent ?? '') + '\n```\n\n';
        }
        const texto = [...no.childNodes].map(markdown).join('');
        if (no.tagName === 'BR') return '\n';
        if (/^H[1-6]$/.test(no.tagName)) return '\n\n' + '#'.repeat(Number(no.tagName[1])) + ' ' + texto + '\n\n';
        if (no.tagName === 'P' || no.tagName === 'DIV') return texto + '\n\n';
        if (no.tagName === 'LI') return '* ' + texto.trim() + '\n';
        if (no.tagName === 'STRONG') return '**' + texto + '**';
        if (no.tagName === 'EM') return '*' + texto + '*';
        if (no.tagName === 'CODE') return '`' + texto + '`';
        if (no.tagName === 'A') {
            const endereco = no.getAttribute('href') ?? '';
            return /^https?:\/\//.test(endereco)
                ? '[' + texto.replace(/[\[\]]/g, '') + '](' + endereco.replace(/\)/g, '%29') + ')'
                : texto;
        }
        return texto;
    };
    const vazio: ObservacaoChatGpt = {
        editor: false,
        textoEditor: '',
        login: true,
        gerando: false,
        usuarios: [],
        resposta: '',
        respostaId: '',
        erro: '',
    };
    if (location.origin !== 'https://chatgpt.com' || /^\/(auth|login|logout)(\/|$)/.test(location.pathname))
        return vazio;
    const visivel = (elemento: Element) => elemento.getClientRects().length > 0;
    const editores = [
        ...document.querySelectorAll(
            '#prompt-textarea, textarea[data-mobile-composer-prompt], ' +
                'form[data-chatgpt-composer] [contenteditable="true"][role="textbox"]',
        ),
    ].filter(visivel);
    const editor = editores.length === 1 ? (editores[0] as HTMLElement) : null;
    const usuariosAntigos = [...document.querySelectorAll('[data-message-author-role="user"]')];
    const usuarios = usuariosAntigos.length
        ? usuariosAntigos
        : [...document.querySelectorAll('[data-user-message-bubble]')];
    const respostasAntigas = [...document.querySelectorAll('[data-message-author-role="assistant"]')];
    const respostas = respostasAntigas.length
        ? respostasAntigas
        : [...document.querySelectorAll('[data-response-body]')];
    const ultima = respostas.at(-1) as HTMLElement | undefined;
    const conteudos = [
        ...(ultima?.querySelectorAll('.markdown, [data-markdown-text-style="assistant-message"]') ?? []),
    ];
    const estadoTurno = ultima?.closest('[data-talvt-turn-state]')?.getAttribute('data-talvt-turn-state');
    const login =
        !!document.querySelector('[data-testid="login-button"], a[href^="/auth/login"]') ||
        [...document.querySelectorAll('button')]
            .filter(visivel)
            .some((botao) => /^(Entrar|Log in|Sign in)$/i.test(botao.innerText.trim()));
    const paradas = [
        ...document.querySelectorAll(
            'button[data-testid="stop-button"], button[data-testid="composer-stop-button"], ' +
                'button[aria-label="Stop generating"], ' +
                'button[aria-label="Parar de gerar"], button[aria-label="Interromper geração"]',
        ),
    ].filter(visivel);
    return {
        editor: !!editor && !login,
        textoEditor: editor instanceof HTMLTextAreaElement ? editor.value.trim() : (editor?.innerText?.trim() ?? ''),
        login,
        gerando: paradas.length > 0 || (!!estadoTurno && estadoTurno !== 'complete'),
        usuarios: usuarios.map((elemento) =>
            ((elemento.querySelector('.whitespace-pre-wrap') ?? elemento) as HTMLElement).innerText.trim(),
        ),
        resposta: (conteudos.length ? conteudos.map(markdown).join('\n\n') : ultima ? markdown(ultima) : '')
            .trim()
            .slice(0, 2000000),
        respostaId:
            ultima?.getAttribute('data-message-id') ??
            ultima?.getAttribute('data-response-body') ??
            ultima?.closest('[data-turn-id]')?.getAttribute('data-turn-id') ??
            String(respostas.length),
        erro: [...document.querySelectorAll('[role="alert"]')]
            .filter(visivel)
            .map((elemento) => (elemento as HTMLElement).innerText.trim())
            .join('\n')
            .slice(0, 2000),
    };
}

/** Foca somente um compositor vazio e recusa alterações de rascunhos escritos diretamente no site. */
export function focarEditorChatGpt(): boolean {
    if (location.origin !== 'https://chatgpt.com') return false;
    const editores = [
        ...document.querySelectorAll(
            '#prompt-textarea, textarea[data-mobile-composer-prompt], ' +
                'form[data-chatgpt-composer] [contenteditable="true"][role="textbox"]',
        ),
    ].filter((elemento) => elemento.getClientRects().length > 0);
    if (editores.length !== 1) return false;
    const editor = editores[0] as HTMLElement;
    if ((editor instanceof HTMLTextAreaElement ? editor.value : editor.innerText).trim()) return false;
    editor.focus();
    return document.activeElement === editor;
}

/** Envia uma única vez pelo botão nativo, somente se o texto digitado ainda corresponde ao pedido. */
export function enviarPaginaChatGpt(texto: string): boolean {
    if (location.origin !== 'https://chatgpt.com') return false;
    const editores = [
        ...document.querySelectorAll(
            '#prompt-textarea, textarea[data-mobile-composer-prompt], ' +
                'form[data-chatgpt-composer] [contenteditable="true"][role="textbox"]',
        ),
    ].filter((elemento) => elemento.getClientRects().length > 0);
    const editor = editores.length === 1 ? (editores[0] as HTMLElement) : null;
    const normalizar = (valor: string) => valor.replace(/\s+/g, ' ').trim();
    if (!editor) return false;
    const atual = editor instanceof HTMLTextAreaElement ? editor.value : editor.innerText;
    if (normalizar(atual) !== normalizar(texto)) return false;
    const botoes = [
        ...document.querySelectorAll<HTMLButtonElement>(
            'button[data-testid="send-button"], form[data-chatgpt-composer] button[type="submit"], ' +
                'button[aria-label="Send prompt"], ' +
                'button[aria-label="Enviar mensagem"], button[aria-label="Enviar prompt"]',
        ),
    ].filter(
        (botao) =>
            botao.getClientRects().length > 0 && !botao.disabled && botao.getAttribute('aria-disabled') !== 'true',
    );
    if (botoes.length !== 1) return false;
    botoes[0].click();
    return true;
}

/** Interrompe uma geração nativa somente na página de conversa vinculada. */
export function pararPaginaChatGpt(): void {
    if (location.origin !== 'https://chatgpt.com') return;
    const botao = document.querySelector<HTMLButtonElement>(
        'button[data-testid="stop-button"], ' +
            'button[data-testid="composer-stop-button"], ' +
            'button[aria-label="Stop generating"], button[aria-label="Parar de gerar"]',
    );
    if (botao && !botao.disabled) botao.click();
}
