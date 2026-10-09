import { useState } from 'react';
import type { Projeto } from '../../shared/contratos';
import { coresProjeto, simbolosProjeto, type IconeDeProjeto } from '../../shared/iconesProjetos';
import { IconeProjeto } from './IconeProjeto';

const nomesSimbolos = {
    pasta: 'Pasta',
    codigo: 'Código',
    terminal: 'Terminal',
    cubo: 'Cubo',
    globo: 'Globo',
    livro: 'Livro',
    jogo: 'Jogo',
    foguete: 'Foguete',
};

/** Permite atribuir um símbolo, iniciais ou imagem ao projeto e restaurar a pasta padrão. */
export function EscolherIconeProjeto({
    projeto,
    ocupado,
    salvar,
    importar,
}: {
    projeto: Projeto;
    ocupado: boolean;
    salvar: (icone: IconeDeProjeto | null) => Promise<void>;
    importar: () => Promise<void>;
}) {
    const [iniciais, definirIniciais] = useState(projeto.icone?.tipo === 'iniciais' ? projeto.icone.texto : '');
    const cor = projeto.icone && projeto.icone.tipo !== 'imagem' ? projeto.icone.cor : 'verde';
    return (
        <section
            data-ui="aparencia-projeto"
            className={['pt-[28px] pb-0 border-t border-solid border-t-[#292b30] px-0 mx-0', 'my-[28px]'].join(' ')}
            aria-label="Ícone do projeto"
        >
            <div
                data-ui="identidade-projeto"
                className={[
                    'flex items-center gap-[20px] [@media(width<=600px)]:items-start',
                    '[@media(width<=600px)]:gap-[14px]',
                ].join(' ')}
            >
                <IconeProjeto projeto={projeto} tamanho={48} />
                <div>
                    <h2>Ícone do projeto</h2>
                    <div data-ui="acoes-identidade-projeto" className="flex flex-wrap gap-[10px]">
                        <button
                            data-ui="botao"
                            className={[
                                'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                                'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                                '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                [
                                    '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                    '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                ].join(' '),
                                '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                            ].join(' ')}
                            disabled={ocupado}
                            onClick={() => void importar()}
                        >
                            Escolher imagem
                        </button>
                        <button
                            data-ui="botao"
                            className={[
                                'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                                'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                                '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                [
                                    '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                    '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                ].join(' '),
                                '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                            ].join(' ')}
                            disabled={ocupado || !projeto.icone}
                            onClick={() => void salvar(null)}
                        >
                            Restaurar padrão
                        </button>
                    </div>
                </div>
            </div>
            <div
                data-ui="simbolos-projeto"
                className="flex flex-wrap gap-[10px] mt-[24px] mb-[16px] mx-0"
                role="group"
                aria-label="Símbolos do projeto"
            >
                {simbolosProjeto.map((nome) => (
                    <button
                        key={nome}
                        data-ui="opcao-icone-projeto"
                        className={[
                            'flex items-center justify-center w-[42px] h-[42px] rounded-[8px] bg-[#141517] border',
                            "border-solid border-[#292b30] [&[aria-pressed='true']]:bg-[#252d29]",
                            "[&[aria-pressed='true']]:border-[#94b7a5]",
                        ].join(' ')}
                        aria-label={`Ícone ${nomesSimbolos[nome]}`}
                        title={nomesSimbolos[nome]}
                        disabled={ocupado}
                        aria-pressed={projeto.icone?.tipo === 'simbolo' && projeto.icone.nome === nome}
                        onClick={() => void salvar({ tipo: 'simbolo', nome, cor })}
                    >
                        <IconeProjeto projeto={{ ...projeto, icone: { tipo: 'simbolo', nome, cor } }} tamanho={22} />
                    </button>
                ))}
            </div>
            <div data-ui="cores-projeto" className="flex flex-wrap gap-[10px]" role="group" aria-label="Cor do ícone">
                {Object.entries(coresProjeto).map(([nome, valor]) => (
                    <button
                        key={nome}
                        data-ui="cor-projeto"
                        className={[
                            'w-[21px] h-[21px] rounded-full border-[2px] border-solid border-transparent',
                            "[&[aria-pressed='true']]:[outline:1px_solid_#e6e7e9]",
                            "[&[aria-pressed='true']]:[outline-offset:3px]",
                        ].join(' ')}
                        aria-label={`Cor ${nome}`}
                        title={nome}
                        aria-pressed={cor === nome}
                        disabled={ocupado || projeto.icone?.tipo === 'imagem'}
                        style={{ background: valor }}
                        onClick={() => {
                            const escolhida = nome as keyof typeof coresProjeto;
                            void salvar(
                                projeto.icone?.tipo === 'iniciais'
                                    ? { ...projeto.icone, cor: escolhida }
                                    : {
                                          tipo: 'simbolo',
                                          nome: projeto.icone?.tipo === 'simbolo' ? projeto.icone.nome : 'pasta',
                                          cor: escolhida,
                                      },
                            );
                        }}
                    />
                ))}
            </div>
            <form
                data-ui="iniciais-projeto-formulario"
                className="flex items-end gap-[12px] mt-[24px]"
                onSubmit={(evento) => {
                    evento.preventDefault();
                    if (iniciais.trim()) void salvar({ tipo: 'iniciais', texto: iniciais.trim(), cor });
                }}
            >
                <label
                    data-ui="campo"
                    className={[
                        '[[data-ui~=tela-projetos]_&]:flex [[data-ui~=tela-projetos]_&]:flex-col',
                        '[[data-ui~=tela-projetos]_&]:gap-[9px] [[data-ui~=tela-projetos]_&]:min-w-0',
                        '[[data-ui~=tela-projetos]_&]:text-[#a1a5ad] [[data-ui~=tela-projetos]_&]:text-[12px]',
                        '[[data-ui~=nome-projeto-formulario]_&]:flex-1',
                        '[[data-ui~=iniciais-projeto-formulario]_&]:max-w-[120px]',
                        '[@media(width<=600px)]:[[data-ui~=nome-projeto-formulario]_&]:[flex-basis:100%]',
                    ].join(' ')}
                >
                    Iniciais
                    <input
                        value={iniciais}
                        maxLength={3}
                        disabled={ocupado}
                        onChange={(evento) => definirIniciais(evento.target.value)}
                    />
                </label>
                <button
                    data-ui="botao"
                    className={[
                        'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                        'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                        '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                        '[[data-ui~=lista-projetos]_>_&]:justify-start [[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                        '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                    ].join(' ')}
                    disabled={ocupado || !iniciais.trim()}
                >
                    Usar iniciais
                </button>
            </form>
        </section>
    );
}
