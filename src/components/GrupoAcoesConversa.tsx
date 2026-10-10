import { CaretRightIcon, HammerIcon } from '@phosphor-icons/react';
import type { Acao, PonteSelene } from '../../shared/contratos';
import { resumirAcoes } from '../../shared/atividade';
import { AcaoConversa } from './AcaoConversa';
import type { Executar } from './Configuracoes';

/** Apresenta uma sequência concluída em uma linha, permitindo consultar cada ação. */
export function GrupoAcoesConversa({
    acoes,
    ponte,
    executar,
}: {
    acoes: Acao[];
    ponte?: PonteSelene;
    executar: Executar;
}) {
    return (
        <details data-ui="grupo-acoes" className="my-[14px] text-secundario text-[12px] group/acoes">
            <summary
                className={[
                    'flex items-center gap-[9px] cursor-pointer list-none',
                    '[&::-webkit-details-marker]:hidden hover:text-principal',
                ].join(' ')}
            >
                <HammerIcon size={15} className="shrink-0" />
                <span>{resumirAcoes(acoes)}</span>
                <CaretRightIcon size={12} className="shrink-0 group-open/acoes:rotate-90" />
            </summary>
            <div className="mt-[8px]">
                {acoes.map((acao) => (
                    <AcaoConversa key={acao.id} acao={acao} ponte={ponte} executar={executar} />
                ))}
            </div>
        </details>
    );
}
