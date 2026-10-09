import { CaretDownIcon, FolderIcon } from '@phosphor-icons/react';
import type { Conversa } from '../../shared/contratos';

/** Seleciona uma pasta recente, abre o seletor do desktop ou inicia um espaço sem projeto. */
export function SeletorProjeto({
    conversa,
    conversas,
    ocupado,
    escolher,
}: {
    conversa?: Conversa;
    conversas: Conversa[];
    ocupado: boolean;
    escolher: (caminho?: string | null) => Promise<void>;
}) {
    const projetos = [
        ...new Set(
            conversas
                .filter((item) => item.modo === 'code' && item.projeto)
                .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
                .map((item) => item.projeto!),
        ),
    ];
    const valor = conversa?.projeto ?? (conversa?.pastaTrabalho ? 'sem' : 'escolher');
    return (
        <div className="seletor-projeto" title={conversa?.projeto ?? conversa?.pastaTrabalho}>
            <FolderIcon size={18} />
            <select
                aria-label="Projeto da conversa"
                value={valor}
                disabled={ocupado}
                onChange={(evento) => {
                    const caminho = evento.target.value;
                    void escolher(caminho === 'sem' ? null : caminho === 'abrir' ? undefined : caminho);
                }}
            >
                <option value="escolher" disabled>
                    Escolher projeto
                </option>
                <option value="sem">{valor === 'sem' ? 'Sem projeto' : 'Começar sem projeto'}</option>
                {!!projetos.length && (
                    <optgroup label="Projetos recentes">
                        {projetos.map((projeto) => (
                            <option key={projeto} value={projeto}>
                                {projetos.filter((item) => item.split(/[\\/]/).at(-1) === projeto.split(/[\\/]/).at(-1))
                                    .length > 1
                                    ? projeto
                                    : projeto.split(/[\\/]/).at(-1)}
                            </option>
                        ))}
                    </optgroup>
                )}
                <option value="abrir">Escolher outra pasta...</option>
            </select>
            <CaretDownIcon size={14} />
        </div>
    );
}
