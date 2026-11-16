import { lazy, Suspense, useState } from 'react';
import { CaretRightIcon, FileIcon, FolderIcon } from '@phosphor-icons/react';
import type { AlteracoesTurno as Alteracoes, ArquivoAlterado } from '../../shared/alteracoesTurno';
import type { PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';
import { Modal } from './Modal';

const VisualizadorDiff = lazy(() => import('./VisualizadorDiff'));

type Pasta = { nome: string; arquivos: ArquivoAlterado[] };

function agruparPorPasta(arquivos: ArquivoAlterado[]): Pasta[] {
    const pastas = new Map<string, ArquivoAlterado[]>();
    for (const arquivo of arquivos) {
        const fim = arquivo.caminho.lastIndexOf('/');
        const nome = fim < 0 ? '' : arquivo.caminho.slice(0, fim);
        pastas.set(nome, [...(pastas.get(nome) ?? []), arquivo]);
    }
    return [...pastas].map(([nome, itens]) => ({ nome, arquivos: itens }));
}

function Contagem({ arquivo }: { arquivo: Pick<ArquivoAlterado, 'adicionadas' | 'removidas'> }) {
    if (arquivo.adicionadas === null || arquivo.removidas === null) {
        return <span className="text-secundario">sem contagem</span>;
    }
    return (
        <span className="font-mono">
            <span className="text-[#8fd19e]">+{arquivo.adicionadas}</span>{' '}
            <span className="text-[#e9aaa7]">-{arquivo.removidas}</span>
        </span>
    );
}

/** Card com os arquivos escritos pelas ferramentas em uma resposta e acesso ao diff salvo de cada um. */
export function AlteracoesTurno({
    alteracoes,
    conversaId,
    mensagemId,
    ponte,
    executar,
}: {
    alteracoes: Alteracoes;
    conversaId: string;
    mensagemId: string;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    const [aberto, definirAberto] = useState<{ caminho: string; patch: string | null } | null>(null);
    const total = alteracoes.arquivos.reduce(
        (soma, arquivo) => ({
            adicionadas: soma.adicionadas + (arquivo.adicionadas ?? 0),
            removidas: soma.removidas + (arquivo.removidas ?? 0),
        }),
        { adicionadas: 0, removidas: 0 },
    );

    async function abrir(caminho: string) {
        if (!ponte) return;
        const patch = await executar(() => ponte.lerPatchTurno(conversaId, mensagemId, caminho));
        if (patch !== undefined) definirAberto({ caminho, patch });
    }

    return (
        <details
            className="group/alteracoes mt-[12px] rounded-[10px] border border-solid border-[#2b2d31] text-[12px]"
        >
            <summary className="flex items-center gap-[8px] px-[12px] py-[9px] cursor-pointer list-none">
                <CaretRightIcon size={12} className="transition-transform group-open/alteracoes:rotate-90" />
                <span>
                    {alteracoes.arquivos.length} {alteracoes.arquivos.length === 1 ? 'arquivo alterado' : 'arquivos alterados'}
                </span>
                <Contagem arquivo={total} />
                {alteracoes.parcial && (
                    <span className="text-secundario" title="Comandos de terminal podem ter alterado outros arquivos.">
                        parcial
                    </span>
                )}
            </summary>
            <ul className="px-[12px] pb-[10px] space-y-[6px]">
                {agruparPorPasta(alteracoes.arquivos).map((pasta) => (
                    <li key={pasta.nome}>
                        {pasta.nome && (
                            <div className="flex items-center gap-[6px] text-secundario py-[2px]">
                                <FolderIcon size={13} />
                                <span className="truncate">{pasta.nome}</span>
                            </div>
                        )}
                        <ul className={pasta.nome ? 'pl-[19px]' : ''}>
                            {pasta.arquivos.map((arquivo) => (
                                <li key={arquivo.caminho}>
                                    <button
                                        type="button"
                                        disabled={!ponte}
                                        onClick={() => void abrir(arquivo.caminho)}
                                        className={[
                                            'flex items-center gap-[6px] w-full rounded-[6px] px-[4px] py-[3px]',
                                            'bg-transparent border-0 text-left text-[#d1d5dd] hover:bg-hover',
                                        ].join(' ')}
                                    >
                                        <FileIcon size={13} className="shrink-0 text-secundario" />
                                        <span className="truncate flex-1">{arquivo.caminho.split('/').at(-1)}</span>
                                        {arquivo.tipo !== 'alterado' && (
                                            <span className="text-secundario">{arquivo.tipo}</span>
                                        )}
                                        <Contagem arquivo={arquivo} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
            {aberto && (
                <Modal titulo={aberto.caminho} fechar={() => definirAberto(null)} amplo>
                    {aberto.patch === null ? (
                        <p className="text-secundario text-[13px]">
                            O diff deste arquivo não foi guardado porque excede os limites de tamanho.
                        </p>
                    ) : (
                        <Suspense fallback={<p className="text-secundario text-[13px]">Carregando diff</p>}>
                            <VisualizadorDiff patch={aberto.patch} />
                        </Suspense>
                    )}
                </Modal>
            )}
        </details>
    );
}
