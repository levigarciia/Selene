import { useEffect, useState } from 'react';
import type { ImagemAnexada, PonteSelene } from '../../shared/contratos';
import { Modal } from './Modal';

/** Permite inspecionar imagens do histórico e do rascunho sem abrir caminhos locais no renderer. */
export function ImagemConversa({
    imagem,
    previa,
    ponte,
}: {
    imagem: ImagemAnexada;
    previa?: string;
    ponte?: PonteSelene;
}) {
    const [url, definirUrl] = useState(previa ?? '');
    const [erro, definirErro] = useState('');
    const [ampliada, definirAmpliada] = useState(false);
    useEffect(() => {
        if (previa || !ponte) return;
        let ativo = true;
        void ponte
            .lerImagem(imagem.id)
            .then((resultado) => {
                if (!ativo) return;
                if (resultado.ok) definirUrl(resultado.valor);
                else definirErro(resultado.erro);
            })
            .catch(() => {
                if (ativo) definirErro('Não foi possível carregar a imagem.');
            });
        return () => {
            ativo = false;
        };
    }, [imagem.id, previa, ponte]);
    return (
        <>
            <button
                type="button"
                data-ui="previa-imagem"
                className={[
                    'w-[116px] h-[88px] overflow-hidden rounded-[8px] bg-[#191b20] cursor-zoom-in p-0',
                    'border border-solid border-[#2b2e34] [&_img]:w-full [&_img]:h-full [&_img]:object-cover',
                    '[&_span]:text-[11px] [&_span]:text-[#a1a5ad]',
                ].join(' ')}
                disabled={!url}
                onClick={() => definirAmpliada(true)}
                aria-label={`Ampliar ${imagem.nome}`}
                title={erro || imagem.nome}
            >
                {url ? (
                    <img src={url} alt={imagem.nome} />
                ) : (
                    <span>{erro ? 'Imagem indisponível' : 'Carregando imagem'}</span>
                )}
            </button>
            {ampliada && (
                <Modal titulo={imagem.nome} fechar={() => definirAmpliada(false)}>
                    <img
                        data-ui="imagem-ampliada"
                        className="block max-w-full max-h-[65vh] object-contain m-auto"
                        src={url}
                        alt={imagem.nome}
                    />
                </Modal>
            )}
        </>
    );
}
