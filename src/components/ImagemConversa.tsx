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
                className="previa-imagem"
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
                    <img className="imagem-ampliada" src={url} alt={imagem.nome} />
                </Modal>
            )}
        </>
    );
}
