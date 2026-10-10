import { BrainIcon, CodeIcon, EyeIcon, WrenchIcon } from '@phosphor-icons/react';

const capacidades = {
    raciocinio: { nome: 'Raciocínio', Icone: BrainIcon, cor: 'text-[#b6a3ea] bg-[#27213c]' },
    ferramentas: { nome: 'Ferramentas', Icone: WrenchIcon, cor: 'text-[#92bbed] bg-[#1f2b3b]' },
    code: { nome: 'Código', Icone: CodeIcon, cor: 'text-[#b6a3ea] bg-[#29243a]' },
    imagens: { nome: 'Imagens', Icone: EyeIcon, cor: 'text-[#a9c7af] bg-[#213129]' },
};
export type CapacidadeModelo = keyof typeof capacidades;

/** Exibe as capacidades declaradas do modelo com a mesma identificação em catálogos locais e remotos. */
export function CapacidadesModelo({ itens }: { itens: CapacidadeModelo[] }) {
    return (
        <div data-ui="capacidades-modelo" className="flex shrink-0 gap-[2px]">
            {itens.map((capacidade) => {
                const { nome, Icone, cor } = capacidades[capacidade];
                return (
                    <span
                        key={capacidade}
                        title={nome}
                        data-ui={`capacidade capacidade-${capacidade}`}
                        className={`grid size-[23px] place-items-center rounded-full ${cor}`}
                    >
                        <Icone size={14} aria-label={nome} />
                    </span>
                );
            })}
        </div>
    );
}
