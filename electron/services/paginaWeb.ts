type EstadoPagina = {
    observacao: string;
    url: string;
    elementos: Map<string, { elemento: HTMLElement; assinatura: string }>;
};
type JanelaPagina = Window & { seleneObservacao?: EstadoPagina };

/** Extrai evidências limitadas e guarda referências no mundo isolado da página. */
export function observarPagina(entrada: { observacao: string; inicioReferencias: number }) {
    const janela = window as JanelaPagina;
    const elementos = new Map<string, { elemento: HTMLElement; assinatura: string }>();
    const referencias: string[] = [];
    let tamanhoReferencias = 0;
    const visivel = (elemento: HTMLElement) => {
        const estilo = getComputedStyle(elemento);
        return elemento.getClientRects().length > 0 && estilo.visibility !== 'hidden' && estilo.display !== 'none';
    };
    for (const elemento of document.querySelectorAll<HTMLElement>(
        'a[href],button,input:not([type=hidden]),textarea,select,[role=button],[role=link],[tabindex],[contenteditable=true]',
    )) {
        if (!visivel(elemento) || referencias.length >= 150 || tamanhoReferencias >= 10000) continue;
        const referencia = `e${entrada.inicioReferencias + referencias.length}`;
        const nome =
            elemento.getAttribute('aria-label') ||
            elemento.getAttribute('placeholder') ||
            (elemento as HTMLInputElement).labels?.[0]?.innerText ||
            elemento.innerText ||
            elemento.tagName;
        const destino = elemento instanceof HTMLAnchorElement ? ` URL: ${elemento.href.slice(0, 1000)}` : '';
        const assinatura = JSON.stringify([
            elemento.tagName,
            elemento.getAttribute('href'),
            elemento.getAttribute('type'),
            elemento.getAttribute('aria-label'),
            elemento.innerText,
        ]);
        elementos.set(referencia, { elemento, assinatura });
        const linha = `${referencia}: ${elemento.tagName.toLowerCase()} ${nome.trim().slice(0, 200)}${destino}`;
        tamanhoReferencias += linha.length;
        referencias.push(linha);
    }
    janela.seleneObservacao = { observacao: entrada.observacao, url: location.href, elementos };
    const texto = (document.querySelector<HTMLElement>('main,article') ?? document.body)?.innerText ?? '';
    return {
        url: location.href,
        titulo: document.title,
        texto: texto.slice(0, 16000),
        parcial: texto.length > 16000,
        referencias,
        quadros: document.querySelectorAll('iframe').length,
        proximaReferencia: entrada.inicioReferencias + referencias.length,
    };
}

/** Executa apenas ações conhecidas sobre o elemento capturado na observação aprovada. */
export function interagirPagina(entrada: {
    observacao: string;
    referencia?: string;
    acao: string;
    texto?: string;
    direcao?: string;
}) {
    const estado = (window as JanelaPagina).seleneObservacao;
    if (!estado || estado.observacao !== entrada.observacao || estado.url !== location.href) {
        throw new Error('A página mudou. Observe novamente antes de agir.');
    }
    if (entrada.acao === 'rolar') {
        window.scrollBy(0, entrada.direcao === 'cima' ? -innerHeight * 0.8 : innerHeight * 0.8);
        return;
    }
    const capturado = estado.elementos.get(entrada.referencia ?? '');
    const elemento = capturado?.elemento;
    if (!elemento?.isConnected) throw new Error('O elemento mudou. Observe novamente antes de agir.');
    const assinatura = JSON.stringify([
        elemento.tagName,
        elemento.getAttribute('href'),
        elemento.getAttribute('type'),
        elemento.getAttribute('aria-label'),
        elemento.innerText,
    ]);
    if (assinatura !== capturado?.assinatura) throw new Error('O elemento mudou. Observe novamente antes de agir.');
    if (elemento.matches(':disabled') || elemento.getAttribute('aria-disabled') === 'true') {
        throw new Error('O elemento está desativado.');
    }
    const estilo = getComputedStyle(elemento);
    if (!elemento.getClientRects().length || estilo.visibility === 'hidden' || estilo.display === 'none') {
        throw new Error('O elemento não está visível. Observe novamente.');
    }
    if (entrada.acao === 'clicar') {
        if (elemento instanceof HTMLInputElement && elemento.type === 'file') {
            throw new Error('Envio de arquivos não está disponível nesta versão do navegador.');
        }
        if (elemento instanceof HTMLAnchorElement) {
            const url = new URL(elemento.href);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
                throw new Error('O link não é um endereço web permitido.');
            }
            if (elemento.target && elemento.target !== '_self') elemento.target = '_self';
        }
        elemento.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        const limites = elemento.getBoundingClientRect();
        const x = Math.round(Math.max(0, limites.left) + Math.min(limites.width, innerWidth - limites.left) / 2);
        const y = Math.round(Math.max(0, limites.top) + Math.min(limites.height, innerHeight - limites.top) / 2);
        const alvo = document.elementFromPoint(x, y);
        if (alvo !== elemento && !elemento.contains(alvo)) {
            throw new Error('Outro elemento cobre este alvo. Observe a página antes de clicar novamente.');
        }
        return { x, y };
    }
    if (entrada.acao !== 'preencher') throw new Error('Ação de página não reconhecida.');
    if (elemento instanceof HTMLInputElement || elemento instanceof HTMLTextAreaElement) {
        if (elemento instanceof HTMLInputElement && ['file', 'checkbox', 'radio', 'submit'].includes(elemento.type)) {
            throw new Error('Este campo não aceita preenchimento de texto.');
        }
        if (elemento.readOnly) throw new Error('Este campo permite somente leitura.');
        const prototipo =
            elemento instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
        Object.getOwnPropertyDescriptor(prototipo, 'value')!.set!.call(elemento, entrada.texto ?? '');
    } else if (elemento instanceof HTMLSelectElement) {
        if (![...elemento.options].some((opcao) => opcao.value === entrada.texto)) {
            throw new Error('O valor não corresponde a uma opção disponível.');
        }
        elemento.value = entrada.texto ?? '';
    } else if (elemento.isContentEditable) {
        elemento.textContent = entrada.texto ?? '';
    } else {
        throw new Error('A referência não é um campo editável.');
    }
    elemento.dispatchEvent(new Event('input', { bubbles: true }));
    elemento.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Lê resultados dos mecanismos suportados sem confundir ausência de evidência com sucesso. */
export function extrairResultadosPesquisa() {
    const resultados: { titulo: string; url: string; trecho: string }[] = [];
    for (const item of document.querySelectorAll<HTMLElement>('.result,li.b_algo')) {
        const link = item.querySelector<HTMLAnchorElement>('a.result__a,h2 a');
        if (!link) continue;
        let url = link.href;
        const parametro = new URL(url).searchParams.get('uddg');
        if (parametro) url = parametro;
        if (!/^https?:\/\//.test(url)) continue;
        resultados.push({
            titulo: link.innerText.trim().slice(0, 300),
            url: url.slice(0, 4000),
            trecho: (item.querySelector<HTMLElement>('.result__snippet,.b_caption p')?.innerText ?? '').slice(0, 1000),
        });
        if (resultados.length >= 8) break;
    }
    return resultados;
}
