import { useEffect, useRef, useState } from 'react';
import type { EntradaImagem, ImagemRascunho, PonteSelene } from '../../shared/contratos';

async function lerArquivo(arquivo: File): Promise<EntradaImagem> {
    if (arquivo.size > 10 * 1024 ** 2) throw new Error('Cada imagem deve ter até 10 MB.');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(arquivo.type)) {
        throw new Error('Escolha imagens PNG, JPEG ou WebP.');
    }
    const imagem = await createImageBitmap(arquivo);
    try {
        if (imagem.width * imagem.height > 64 * 1024 ** 2) throw new Error('A imagem excede o limite de resolução.');
        const escala = Math.min(1, 1536 / Math.max(imagem.width, imagem.height));
        const tela = document.createElement('canvas');
        tela.width = Math.max(1, Math.round(imagem.width * escala));
        tela.height = Math.max(1, Math.round(imagem.height * escala));
        const pincel = tela.getContext('2d');
        if (!pincel) throw new Error('Não foi possível preparar a imagem.');
        pincel.fillStyle = 'white';
        pincel.fillRect(0, 0, tela.width, tela.height);
        pincel.drawImage(imagem, 0, 0, tela.width, tela.height);
        return { nome: arquivo.name || 'Imagem colada', dados: tela.toDataURL('image/png') };
    } finally {
        imagem.close();
    }
}

/** Mantém os anexos de cada rascunho até confirmar o envio pelo processo principal. */
export function useAnexos(
    ativa: string | null,
    ponte: PonteSelene | undefined,
    informarErro: (erro: string) => void,
    informarQuantidade?: (quantidade: number) => void,
) {
    const [rascunhos, definirRascunhos] = useState<Record<string, ImagemRascunho[]>>({});
    const [importando, definirImportando] = useState(false);
    const bloqueio = useRef(false);
    const chave = ativa ?? 'nova';
    const imagens = rascunhos[chave] ?? [];
    const informar = useRef(informarQuantidade);
    informar.current = informarQuantidade;
    useEffect(() => {
        informar.current?.(imagens.length);
    }, [ativa, imagens.length]);

    async function anexar(arquivos: File[]) {
        if (!arquivos.length || bloqueio.current) return;
        if (!ponte) return informarErro('Anexe imagens no aplicativo desktop.');
        if (imagens.length + arquivos.length > 4) return informarErro('Anexe até quatro imagens por mensagem.');
        bloqueio.current = true;
        definirImportando(true);
        informarErro('');
        try {
            const entradas = await Promise.all(arquivos.map(lerArquivo));
            const resultado = await ponte.anexarImagens(entradas);
            if (!resultado.ok) throw new Error(resultado.erro);
            definirRascunhos((anteriores) => ({
                ...anteriores,
                [chave]: [...(anteriores[chave] ?? []), ...resultado.valor],
            }));
        } catch (erro) {
            informarErro(erro instanceof Error ? erro.message : 'Não foi possível anexar as imagens.');
        } finally {
            bloqueio.current = false;
            definirImportando(false);
        }
    }

    async function remover(id: string) {
        if (!ponte) return;
        const resultado = await ponte.descartarImagens([id]);
        if (!resultado.ok) return informarErro(resultado.erro);
        definirRascunhos((anteriores) => ({
            ...anteriores,
            [chave]: (anteriores[chave] ?? []).filter((imagem) => imagem.id !== id),
        }));
    }

    function transferir(id: string) {
        definirRascunhos((anteriores) => ({ ...anteriores, [id]: anteriores[chave] ?? [], [chave]: [] }));
    }

    function limpar(id: string) {
        definirRascunhos((anteriores) => ({ ...anteriores, [id]: [], [chave]: [] }));
    }

    return { imagens, importando, anexar, remover, transferir, limpar };
}
