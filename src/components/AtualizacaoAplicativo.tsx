import type { PonteSelene } from '../../shared/contratos';
import { descreverAtualizacao, type EstadoAtualizacao } from '../../shared/atualizacoes';
import type { Executar } from './Configuracoes';

/** Use na área Geral para consultar a versão e o andamento das atualizações automáticas. */
export function AtualizacaoAplicativo({
    estado,
    ponte,
    executar,
}: {
    estado?: EstadoAtualizacao;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    if (!estado) return null;
    const ocupado = ['desativada', 'verificando', 'baixando', 'pronta'].includes(estado.fase);
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
                <span>Selene {estado.versaoAtual}</span>
                <span
                    data-ui="texto-secundario"
                    className={[
                        'text-[#a1a5ad] text-[12px] leading-[1.7]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#a1a5ad]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                        '[[data-ui~=usuario-direita]_&]:text-[#a1a5ad]',
                        '[[data-ui~=usuario-direita]_&]:text-[12px]',
                        '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                    ].join(' ')}
                    role="status"
                >
                    {descreverAtualizacao(estado)}
                </span>
            </div>
            <button
                type="button"
                data-ui="botao"
                className={[
                    'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                    'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                    '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                    '[[data-ui~=lista-projetos]_>_&]:justify-start [[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                    '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                ].join(' ')}
                disabled={!ponte || ocupado}
                onClick={() => void executar(() => ponte!.verificarAtualizacao())}
            >
                Buscar atualização
            </button>
        </div>
    );
}
