import { useState } from 'react';
import { FolderOpenIcon, GitBranchIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { useSelene } from '../hooks/useSelene';
import type { NovoProjeto, Projeto } from '../../shared/contratos';
import { Modal } from './Modal';

/** Abre pastas, cria projetos por nome e clona repositórios com cadastro independente das conversas. */
export function AdicionarProjeto({
    dados,
    fechar,
    selecionar,
}: {
    dados: ReturnType<typeof useSelene>;
    fechar: () => void;
    selecionar: (projeto: Projeto) => void;
}) {
    const [tipo, definirTipo] = useState<'criar' | 'clonar' | null>(null);
    const [valor, definirValor] = useState('');
    const [ocupado, definirOcupado] = useState(false);
    const [erro, definirErro] = useState('');

    async function adicionar(entrada: NovoProjeto) {
        if (ocupado) return;
        definirOcupado(true);
        definirErro('');
        try {
            if (!dados.ponte) throw new Error('Projetos estão disponíveis no aplicativo desktop.');
            const resultado = await dados.ponte.adicionarProjeto(entrada);
            if (!resultado.ok) throw new Error(resultado.erro);
            if (!resultado.valor) return;
            if (resultado.valor.aviso) dados.definirErro(resultado.valor.aviso);
            selecionar(resultado.valor);
            fechar();
        } catch (erro) {
            definirErro(erro instanceof Error ? erro.message : 'Não foi possível adicionar o projeto.');
        } finally {
            definirOcupado(false);
        }
    }

    return (
        <Modal
            titulo="Projetos"
            fechar={() => {
                if (!ocupado) fechar();
            }}
        >
            {tipo ? (
                <form
                    onSubmit={(evento) => {
                        evento.preventDefault();
                        void adicionar(tipo === 'criar' ? { tipo, nome: valor } : { tipo, url: valor });
                    }}
                >
                    <label className="campo">
                        {tipo === 'criar' ? 'Nome do projeto' : 'URL HTTPS do repositório'}
                        <input
                            autoFocus
                            value={valor}
                            disabled={ocupado}
                            required
                            maxLength={tipo === 'criar' ? 100 : 2000}
                            onChange={(evento) => definirValor(evento.target.value)}
                        />
                    </label>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" className="botao" disabled={ocupado} onClick={() => definirTipo(null)}>
                            Voltar
                        </button>
                        <button className="botao botao-primario" disabled={ocupado || !valor.trim()}>
                            {ocupado ? 'Preparando projeto' : tipo === 'criar' ? 'Criar projeto' : 'Clonar repositório'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="opcoes-projetos">
                    <button className="botao" disabled={ocupado} onClick={() => void adicionar({ tipo: 'pasta' })}>
                        <FolderOpenIcon size={18} /> Abrir pasta existente
                    </button>
                    <button
                        className="botao"
                        disabled={ocupado}
                        onClick={() => {
                            definirTipo('criar');
                            definirValor('');
                        }}
                    >
                        <PlusIcon size={18} /> Novo projeto
                    </button>
                    <button
                        className="botao"
                        disabled={ocupado}
                        onClick={() => {
                            definirTipo('clonar');
                            definirValor('');
                        }}
                    >
                        <GitBranchIcon size={18} /> Clonar repositório
                    </button>
                    {dados.estado.projetos.map((projeto) => (
                        <div className="projeto-cadastrado" key={projeto.id}>
                            <input
                                aria-label={`Nome de ${projeto.nome}`}
                                defaultValue={projeto.nome}
                                key={`${projeto.id}:${projeto.nome}`}
                                disabled={ocupado}
                                onBlur={(evento) => {
                                    const nome = evento.target.value.trim();
                                    if (nome && nome !== projeto.nome) {
                                        void dados.executar(() => dados.ponte!.alterarProjeto(projeto.id, nome));
                                    }
                                }}
                            />
                            <button
                                className="botao-icone"
                                aria-label={`Remover projeto ${projeto.nome}`}
                                title="Remover da lista e preservar os arquivos e as conversas"
                                disabled={ocupado}
                                onClick={() => void dados.executar(() => dados.ponte!.removerProjeto(projeto.id))}
                            >
                                <TrashIcon size={17} />
                            </button>
                            <small title={projeto.caminho}>{projeto.caminho}</small>
                        </div>
                    ))}
                </div>
            )}
            {ocupado && (
                <p className="texto-secundario mt-4" role="status">
                    Preparando projeto
                </p>
            )}
            {erro && (
                <p className="aviso-erro mt-4" role="alert">
                    {erro}
                </p>
            )}
        </Modal>
    );
}
