import { useState } from 'react';
import { PatchDiff } from '@pierre/diffs/react';

const estilos = [
    { valor: 'unified', nome: 'Unificado' },
    { valor: 'split', nome: 'Lado a lado' },
] as const;

/** Mostra um patch salvo com destaque de sintaxe, alternando entre os layouts unificado e lado a lado. */
export default function VisualizadorDiff({ patch }: { patch: string }) {
    const [estilo, definirEstilo] = useState<(typeof estilos)[number]['valor']>('unified');
    return (
        <div className="flex flex-col gap-[12px]">
            <div role="group" aria-label="Layout do diff" className="flex gap-[4px]">
                {estilos.map((item) => (
                    <button
                        type="button"
                        key={item.valor}
                        aria-pressed={estilo === item.valor}
                        onClick={() => definirEstilo(item.valor)}
                        className={[
                            'rounded-[6px] px-[10px] py-[5px] text-[12px] border-0',
                            estilo === item.valor
                                ? 'bg-borda text-principal'
                                : 'bg-transparent text-secundario hover:text-principal',
                        ].join(' ')}
                    >
                        {item.nome}
                    </button>
                ))}
            </div>
            <PatchDiff
                patch={patch}
                disableWorkerPool
                className="text-[12px] rounded-[9px] overflow-hidden"
                options={{
                    diffStyle: estilo,
                    themeType: 'dark',
                    overflow: 'wrap',
                    lineDiffType: 'word',
                    disableFileHeader: true,
                }}
            />
        </div>
    );
}
