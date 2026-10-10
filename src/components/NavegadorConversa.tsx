import { useState } from 'react';
import {
    ArrowsOutSimpleIcon,
    ArrowsInSimpleIcon,
    ArrowClockwiseIcon,
    CaretDownIcon,
    CaretRightIcon,
} from '@phosphor-icons/react';
import type { PreviaNavegador } from '../../shared/web';
import type { PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';
import { IconeAcao } from './IconeAcao';

/** Acompanha a página real dentro da conversa, sem carregar sites remotos na interface da Selene. */
export function NavegadorConversa({
    previa,
    ponte,
    executar,
}: {
    previa: PreviaNavegador;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    const [recolhido, definirRecolhido] = useState(false);
    const [ampliado, definirAmpliado] = useState(false);
    const [atualizando, definirAtualizando] = useState(false);
    const botao = 'p-[7px] rounded-[5px] text-secundario hover:bg-hover hover:text-primario disabled:opacity-40';
    async function atualizar() {
        if (!ponte || atualizando) return;
        definirAtualizando(true);
        try {
            await executar(() => ponte.atualizarNavegador(previa.conversaId));
        } finally {
            definirAtualizando(false);
        }
    }
    return (
        <section
            data-ui="navegador-inline"
            className="my-[16px] w-full overflow-hidden rounded-[8px] border border-borda bg-[#0c0d10]"
        >
            <div className="flex items-center gap-[8px] px-[10px] py-[5px] text-[11px] min-w-0">
                <button
                    type="button"
                    onClick={() => definirRecolhido(!recolhido)}
                    aria-label={recolhido ? 'Mostrar navegador' : 'Recolher navegador'}
                    aria-expanded={!recolhido}
                    className="flex min-w-0 flex-1 items-center gap-[8px] py-[6px] text-left text-secundario"
                >
                    <IconeAcao nome="navegador" />
                    <span className="truncate" title={previa.url}>
                        {previa.url || 'Abrindo página'}
                    </span>
                    {recolhido ? <CaretRightIcon size={12} /> : <CaretDownIcon size={12} />}
                </button>
                {previa.carregando && (
                    <span
                        role="status"
                        className="size-[10px] shrink-0 rounded-full border border-secundario border-t-transparent motion-safe:animate-spin"
                        aria-label="Carregando página"
                    />
                )}
                {!previa.aberto && !previa.carregando && (
                    <span className="text-secundario">
                        {previa.origem === 'pesquisa'
                            ? 'Pesquisa'
                            : previa.origem === 'leitura'
                              ? 'Leitura'
                              : 'Fechado'}
                    </span>
                )}
                {!recolhido && (
                    <button
                        type="button"
                        className={botao}
                        onClick={() => definirAmpliado(!ampliado)}
                        aria-label={ampliado ? 'Reduzir navegador' : 'Ampliar navegador'}
                    >
                        {ampliado ? <ArrowsInSimpleIcon size={14} /> : <ArrowsOutSimpleIcon size={14} />}
                    </button>
                )}
                <button
                    type="button"
                    className={botao}
                    onClick={() => void atualizar()}
                    disabled={!ponte || !previa.aberto || atualizando}
                    aria-label="Atualizar visualização do navegador"
                >
                    <ArrowClockwiseIcon size={14} className={atualizando ? 'motion-safe:animate-spin' : ''} />
                </button>
            </div>
            {!recolhido && (
                <div data-ui="quadro-navegador" className="border-t border-borda bg-[#101114]">
                    {previa.imagem?.startsWith('data:image/jpeg;base64,') ? (
                        <img
                            data-ui="pagina-navegador"
                            src={previa.imagem}
                            alt={previa.titulo || 'Página do navegador'}
                            className={
                                ampliado ? 'block w-full h-auto' : 'block w-full h-[300px] object-cover object-top'
                            }
                        />
                    ) : (
                        <div
                            className="flex h-[300px] items-center justify-center text-[12px] text-secundario"
                            role="status"
                        >
                            {previa.carregando || previa.aberto
                                ? 'Carregando página'
                                : previa.origem && previa.origem !== 'navegador'
                                  ? 'Visualização indisponível'
                                  : 'Navegador fechado'}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
