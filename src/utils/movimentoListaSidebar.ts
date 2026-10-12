const temporizacao: KeyframeAnimationOptions = { duration: 150, easing: 'ease-out' };
const MAXIMO_LINHAS_ESMAECIDAS = 40;
const SELETOR_LINHAS = '[data-ui~="linha-sidebar"], [data-movimento-sidebar]';

type PosicaoLinha = { topo: number; esquerda: number; largura: number; altura: number };
type MapaPosicoes = Map<HTMLElement, PosicaoLinha>;

const deslocamentoProprio = (altura: number) => Math.min(altura, 40);

function progresso(animacao: Animation) {
    return animacao.playState === 'finished' ? 1 : (animacao.effect?.getComputedTiming().progress ?? 0);
}

function criarCopiaInerte(linha: HTMLElement) {
    const copia = linha.cloneNode(true) as HTMLElement;
    for (const elemento of [copia, ...copia.querySelectorAll('*')]) {
        if (elemento.namespaceURI !== 'http://www.w3.org/2000/svg') elemento.removeAttribute('id');
        elemento.removeAttribute('data-movimento-sidebar');
    }
    copia.setAttribute('aria-hidden', 'true');
    copia.inert = true;
    return copia;
}

/**
 * Anima as linhas da sidebar entre posições de layout, no mesmo estilo do T3 Code: linhas deslocadas deslizam,
 * linhas novas surgem com esmaecimento e linhas removidas saem por uma cópia inerte. Use em um contêiner
 * posicionado (`relative`) cujas linhas sejam marcadas por `data-ui~="linha-sidebar"` ou `data-movimento-sidebar`.
 */
export function criarMovimentoListaSidebar(contenedor: HTMLElement) {
    let posicoes: MapaPosicoes | null = null;
    let descartado = false;
    const movimentoReduzido = contenedor.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
    const emMovimento = new Map<HTMLElement, { animacao: Animation; deslocamento: number }>();
    const entrando = new Map<HTMLElement, { animacao: Animation; percurso: number }>();
    const saindo = new Map<HTMLElement, Animation>();

    const deslocamentoRestante = (linha: HTMLElement) => {
        const atual = emMovimento.get(linha);
        const movimento = atual ? atual.deslocamento * (1 - progresso(atual.animacao)) : 0;
        const entrada = entrando.get(linha);
        return movimento + (entrada ? entrada.percurso * (1 - progresso(entrada.animacao)) : 0);
    };

    const medirLinhas = () => {
        const origem = contenedor.getBoundingClientRect();
        const linhas = Array.from(contenedor.querySelectorAll<HTMLElement>(SELETOR_LINHAS)).filter(
            (linha) => !saindo.has(linha),
        );
        return new Map(
            linhas.map((linha) => {
                const caixa = linha.getBoundingClientRect();
                const transformacao = deslocamentoRestante(linha);
                return [
                    linha,
                    {
                        topo: caixa.top - origem.top + contenedor.scrollTop - transformacao,
                        esquerda: caixa.left - origem.left + contenedor.scrollLeft,
                        largura: linha.offsetWidth,
                        altura: linha.offsetHeight,
                    },
                ];
            }),
        );
    };

    const limparEsmaecimentos = () => {
        for (const entrada of entrando.values()) entrada.animacao.cancel();
        for (const animacao of saindo.values()) animacao.cancel();
        for (const copia of saindo.keys()) copia.remove();
        entrando.clear();
        saindo.clear();
    };

    const esmaecerSaida = (linha: HTMLElement, posicao: PosicaoLinha, percurso: number) => {
        if (posicao.altura === 0) return;
        const copia = criarCopiaInerte(linha);
        Object.assign(copia.style, {
            position: 'absolute',
            top: `${posicao.topo + deslocamentoRestante(linha)}px`,
            left: `${posicao.esquerda}px`,
            width: `${posicao.largura}px`,
            height: `${posicao.altura}px`,
            margin: '0',
            boxSizing: 'border-box',
            transform: 'none',
            transition: 'none',
            pointerEvents: 'none',
        });
        contenedor.append(copia);
        const entrada = entrando.get(linha);
        const opacidadeInicial = entrada ? progresso(entrada.animacao) : 1;
        const animacao = copia.animate(
            [
                { opacity: opacidadeInicial, transform: 'translateY(0px)' },
                { opacity: 0, transform: `translateY(${percurso}px)` },
            ],
            temporizacao,
        );
        saindo.set(copia, animacao);
        animacao.addEventListener(
            'finish',
            () => {
                copia.remove();
                saindo.delete(copia);
            },
            { once: true },
        );
    };

    const cancelar = (linha: HTMLElement) => {
        emMovimento.get(linha)?.animacao.cancel();
        emMovimento.delete(linha);
    };

    const mover = (linha: HTMLElement, deslocamento: number) => {
        cancelar(linha);
        const entrada = entrando.get(linha);
        if (entrada) entrada.percurso = 0;
        if (deslocamento === 0 && !entrada) return;
        const animacao = linha.animate(
            [{ transform: `translateY(${deslocamento}px)` }, { transform: 'translateY(0px)' }],
            temporizacao,
        );
        emMovimento.set(linha, { animacao, deslocamento });
        animacao.addEventListener(
            'finish',
            () => {
                if (emMovimento.get(linha)?.animacao === animacao) emMovimento.delete(linha);
            },
            { once: true },
        );
    };

    const animarEntrada = (linha: HTMLElement, percurso: number) => {
        const animacao = linha.animate(
            [
                { opacity: 0, transform: `translateY(${percurso}px)` },
                { opacity: 1, transform: 'translateY(0px)' },
            ],
            temporizacao,
        );
        entrando.set(linha, { animacao, percurso });
        animacao.addEventListener(
            'finish',
            () => {
                if (entrando.get(linha)?.animacao === animacao) entrando.delete(linha);
            },
            { once: true },
        );
    };

    const contarEsmaecimentos = (anteriores: MapaPosicoes, proximas: MapaPosicoes) => {
        let total = 0;
        for (const [linha, posicao] of anteriores) if (!proximas.has(linha) && posicao.altura > 0) total++;
        for (const [linha, posicao] of proximas) if (!anteriores.has(linha) && posicao.altura > 0) total++;
        return total;
    };

    const suspender = () => {
        for (const linha of emMovimento.keys()) cancelar(linha);
        limparEsmaecimentos();
        posicoes = null;
    };

    return {
        /** Mede as linhas e, se `animar` for verdadeiro, anima a transição desde a última medição. */
        atualizar(animar: boolean) {
            if (descartado) return;
            const proximas = medirLinhas();
            const anteriores = posicoes;
            const deveAnimar =
                animar &&
                anteriores !== null &&
                !movimentoReduzido?.matches &&
                contarEsmaecimentos(anteriores, proximas) <= MAXIMO_LINHAS_ESMAECIDAS;
            posicoes = proximas;
            for (const [linha, entrada] of entrando) {
                if (proximas.has(linha)) continue;
                entrada.animacao.cancel();
                entrando.delete(linha);
            }
            if (!deveAnimar) {
                for (const linha of emMovimento.keys()) cancelar(linha);
                limparEsmaecimentos();
                return;
            }
            for (const linha of emMovimento.keys()) if (!proximas.has(linha)) cancelar(linha);
            const deslocamentos = new Map<HTMLElement, number>();
            for (const [linha, posicao] of proximas) {
                const topoAnterior = anteriores.get(linha)?.topo;
                if (topoAnterior === undefined || topoAnterior === posicao.topo) continue;
                deslocamentos.set(linha, topoAnterior + deslocamentoRestante(linha) - posicao.topo);
            }
            const deslocamentoVizinho = (
                ordem: readonly HTMLElement[],
                indice: number,
                mantida: (linha: HTMLElement) => boolean,
            ) => {
                for (let cursor = indice - 1; cursor >= 0; cursor--) {
                    const linha = ordem[cursor]!;
                    const deslocamento = deslocamentos.get(linha);
                    if (deslocamento !== undefined) return deslocamento;
                    if (mantida(linha)) return deslocamentoRestante(linha);
                }
                return undefined;
            };
            const ordemAnterior = [...anteriores.keys()];
            for (const [indice, linha] of ordemAnterior.entries()) {
                if (proximas.has(linha)) continue;
                const posicao = anteriores.get(linha)!;
                const vizinho = deslocamentoVizinho(ordemAnterior, indice, (item) => proximas.has(item));
                esmaecerSaida(linha, posicao, vizinho === undefined ? deslocamentoProprio(posicao.altura) : -vizinho);
            }
            const ordemNova = [...proximas.keys()];
            for (const [indice, linha] of ordemNova.entries()) {
                const posicao = proximas.get(linha)!;
                if (anteriores.has(linha)) {
                    const deslocamento = deslocamentos.get(linha);
                    if (deslocamento !== undefined) mover(linha, deslocamento);
                    continue;
                }
                if (posicao.altura === 0) continue;
                const vizinho = deslocamentoVizinho(ordemNova, indice, (item) => anteriores.has(item));
                animarEntrada(linha, vizinho === undefined ? -deslocamentoProprio(posicao.altura) : vizinho);
            }
        },
        descartar() {
            suspender();
            descartado = true;
        },
    };
}
