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
        <section className="aparencia-projeto" aria-label="Ícone do projeto">
            <div className="identidade-projeto">
                <IconeProjeto projeto={projeto} tamanho={48} />
                <div>
                    <h2>Ícone do projeto</h2>
                    <div className="acoes-identidade-projeto">
                        <button className="botao" disabled={ocupado} onClick={() => void importar()}>
                            Escolher imagem
                        </button>
                        <button
                            className="botao"
                            disabled={ocupado || !projeto.icone}
                            onClick={() => void salvar(null)}
                        >
                            Restaurar padrão
                        </button>
                    </div>
                </div>
            </div>
            <div className="simbolos-projeto" role="group" aria-label="Símbolos do projeto">
                {simbolosProjeto.map((nome) => (
                    <button
                        key={nome}
                        className="opcao-icone-projeto"
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
            <div className="cores-projeto" role="group" aria-label="Cor do ícone">
                {Object.entries(coresProjeto).map(([nome, valor]) => (
                    <button
                        key={nome}
                        className="cor-projeto"
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
                className="iniciais-projeto-formulario"
                onSubmit={(evento) => {
                    evento.preventDefault();
                    if (iniciais.trim()) void salvar({ tipo: 'iniciais', texto: iniciais.trim(), cor });
                }}
            >
                <label className="campo">
                    Iniciais
                    <input
                        value={iniciais}
                        maxLength={3}
                        disabled={ocupado}
                        onChange={(evento) => definirIniciais(evento.target.value)}
                    />
                </label>
                <button className="botao" disabled={ocupado || !iniciais.trim()}>
                    Usar iniciais
                </button>
            </form>
        </section>
    );
}
