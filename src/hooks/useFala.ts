import { useCallback, useEffect, useRef, useState } from 'react';
import type { PonteSelene } from '../../shared/contratos';
import { dividirFala, textoParaFala } from '../../shared/audio';

/** Lê respostas em voz pelo motor local, sintetizando o trecho seguinte enquanto o atual toca. */
export function useFala(ponte: PonteSelene | undefined, definirErro: (erro: string) => void) {
    const [mensagemFalando, definirMensagemFalando] = useState<string | null>(null);
    const sessao = useRef(0);
    const interromper = useRef<(() => void) | null>(null);

    const parar = useCallback(() => {
        sessao.current++;
        interromper.current?.();
        interromper.current = null;
        definirMensagemFalando(null);
    }, []);

    const tocar = useCallback((url: string) => new Promise<void>((resolver) => {
        const audio = new Audio(url);
        const encerrar = () => {
            audio.pause();
            resolver();
        };
        interromper.current = encerrar;
        audio.onended = encerrar;
        audio.onerror = encerrar;
        void audio.play().catch(encerrar);
    }), []);

    const falar = useCallback(async (mensagemId: string, texto: string) => {
        if (!ponte) return;
        parar();
        const atual = sessao.current;
        const trechos = dividirFala(textoParaFala(texto));
        definirMensagemFalando(mensagemId);
        let pendente = trechos.length ? ponte.sintetizarFala(trechos[0]!) : null;
        for (let indice = 1; pendente; indice++) {
            const resultado = await pendente;
            if (sessao.current !== atual) return;
            if (!resultado.ok) {
                definirErro(resultado.erro);
                break;
            }
            pendente = indice < trechos.length ? ponte.sintetizarFala(trechos[indice]!) : null;
            await tocar(resultado.valor);
            if (sessao.current !== atual) return;
        }
        definirMensagemFalando(null);
    }, [ponte, parar, tocar, definirErro]);

    const falando = useRef(mensagemFalando);
    falando.current = mensagemFalando;
    const alternar = useCallback((mensagemId: string, texto: string) => {
        if (falando.current === mensagemId) parar();
        else void falar(mensagemId, texto);
    }, [falar, parar]);

    useEffect(() => parar, [parar]);

    return { mensagemFalando, falar, parar, alternar };
}
