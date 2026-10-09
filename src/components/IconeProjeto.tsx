import {
    FolderIcon,
    CodeIcon,
    TerminalIcon,
    CubeIcon,
    GlobeIcon,
    BookOpenIcon,
    GameControllerIcon,
    RocketIcon,
} from '@phosphor-icons/react';
import type { Projeto } from '../../shared/contratos';
import { coresProjeto } from '../../shared/iconesProjetos';

const simbolos = {
    pasta: FolderIcon,
    codigo: CodeIcon,
    terminal: TerminalIcon,
    cubo: CubeIcon,
    globo: GlobeIcon,
    livro: BookOpenIcon,
    jogo: GameControllerIcon,
    foguete: RocketIcon,
};

/** Usa a identidade persistida do projeto em todas as superfícies, com pasta como padrão. */
export function IconeProjeto({ projeto, tamanho = 16 }: { projeto?: Pick<Projeto, 'icone'>; tamanho?: number }) {
    const icone = projeto?.icone;
    if (icone?.tipo === 'imagem') {
        return (
            <img
                data-ui="icone-projeto"
                className="inline-flex shrink-0 object-contain align-middle"
                src={icone.dados}
                alt=""
                width={tamanho}
                height={tamanho}
            />
        );
    }
    if (icone?.tipo === 'iniciais') {
        return (
            <span
                data-ui="icone-projeto iniciais-projeto"
                className={[
                    'inline-flex shrink-0 object-contain align-middle items-center justify-center font-[650]',
                    'leading-[1]',
                ].join(' ')}
                aria-hidden="true"
                style={{ width: tamanho, height: tamanho, color: coresProjeto[icone.cor], fontSize: tamanho * 0.55 }}
            >
                {icone.texto}
            </span>
        );
    }
    const Simbolo = icone?.tipo === 'simbolo' ? simbolos[icone.nome] : FolderIcon;
    return (
        <Simbolo
            data-ui="icone-projeto"
            className="inline-flex shrink-0 object-contain align-middle"
            aria-hidden="true"
            size={tamanho}
            color={icone?.tipo === 'simbolo' ? coresProjeto[icone.cor] : undefined}
        />
    );
}
