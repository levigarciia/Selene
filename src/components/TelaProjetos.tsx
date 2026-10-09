import { PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import type { Projeto, Resultado } from '../../shared/contratos';
import type { useSelene } from '../hooks/useSelene';
import { possuiRascunho } from '../../shared/rascunhos';
import { IconeProjeto } from './IconeProjeto';
import { EscolherIconeProjeto } from './EscolherIconeProjeto';

/** Gerencia a identidade e as conversas dos projetos sem descartar a composição em andamento. */
export function TelaProjetos({
    dados,
    projetoId,
    selecionarProjeto,
    adicionar,
    criar,
    selecionarConversa,
}: {
    dados: ReturnType<typeof useSelene>;
    projetoId: string | null;
    selecionarProjeto: (id: string) => void;
    adicionar: () => void;
    criar: (projeto: Projeto) => void;
    selecionarConversa: (id: string) => void;
}) {
    const [ocupado, definirOcupado] = useState(false);
    const [mensagem, definirMensagem] = useState('');
    const projetos = dados.estado.projetos;
    const projeto = projetos.find((item) => item.id === projetoId) ?? projetos[0];
    const conversas = dados.estado.conversas.filter(
        (item) =>
            projeto &&
            item.modo === 'code' &&
            (item.projetoId === projeto.id || item.projeto === projeto.caminho) &&
            (item.mensagens.length || possuiRascunho(item)),
    );

    async function executar(operacao: () => Promise<Resultado<unknown>>) {
        if (ocupado) return;
        definirOcupado(true);
        definirMensagem('');
        try {
            if (!dados.ponte) throw new Error('Gerencie os projetos no aplicativo desktop.');
            const resultado = await operacao();
            if (!resultado.ok) throw new Error(resultado.erro);
        } catch (erro) {
            definirMensagem(erro instanceof Error ? erro.message : 'Não foi possível atualizar o projeto.');
        } finally {
            definirOcupado(false);
        }
    }

    return (
        <div className="tela-projetos">
            <nav className="lista-projetos" aria-label="Projetos cadastrados">
                <button className="botao" onClick={adicionar}>
                    <PlusIcon size={16} /> Adicionar projeto
                </button>
                {projetos.map((item) => (
                    <button
                        key={item.id}
                        className="linha-projeto-gerenciamento"
                        aria-current={item.id === projeto?.id ? 'page' : undefined}
                        onClick={() => {
                            definirMensagem('');
                            selecionarProjeto(item.id);
                        }}
                    >
                        <IconeProjeto projeto={item} tamanho={20} />
                        <span className="truncate">{item.nome}</span>
                    </button>
                ))}
            </nav>
            {projeto ? (
                <div className="detalhes-projeto" key={projeto.id}>
                    <form
                        className="nome-projeto-formulario"
                        onSubmit={(evento) => {
                            evento.preventDefault();
                            const nome = new FormData(evento.currentTarget).get('nome')?.toString().trim();
                            if (nome && nome !== projeto.nome)
                                void executar(() => dados.ponte!.alterarProjeto(projeto.id, nome));
                        }}
                    >
                        <label className="campo">
                            Nome do projeto
                            <input
                                name="nome"
                                key={projeto.nome}
                                defaultValue={projeto.nome}
                                required
                                maxLength={100}
                                disabled={ocupado}
                            />
                        </label>
                        <button className="botao" disabled={ocupado}>
                            Salvar nome
                        </button>
                    </form>
                    <label className="campo caminho-projeto">
                        Pasta
                        <input readOnly value={projeto.caminho} />
                    </label>
                    <EscolherIconeProjeto
                        key={`${projeto.id}:${projeto.icone?.tipo}`}
                        projeto={projeto}
                        ocupado={ocupado}
                        salvar={(icone) => executar(() => dados.ponte!.salvarIconeProjeto(projeto.id, icone))}
                        importar={() => executar(() => dados.ponte!.importarIconeProjeto(projeto.id))}
                    />
                    <section className="conversas-projeto" aria-label="Conversas do projeto">
                        <div className="cabecalho-conversas-projeto">
                            <h2>Conversas</h2>
                            <button className="botao" onClick={() => criar(projeto)}>
                                Nova conversa neste projeto
                            </button>
                        </div>
                        {conversas.map((conversa) => (
                            <button
                                className="conversa-no-projeto"
                                key={conversa.id}
                                onClick={() => selecionarConversa(conversa.id)}
                            >
                                <span className="truncate">{conversa.titulo}</span>
                                {possuiRascunho(conversa) && <small>Rascunho</small>}
                            </button>
                        ))}
                    </section>
                    <button
                        className="botao texto-erro"
                        disabled={ocupado}
                        title="Preserva arquivos e conversas"
                        onClick={() => void executar(() => dados.ponte!.removerProjeto(projeto.id))}
                    >
                        Remover da lista
                    </button>
                    {mensagem && (
                        <p className="aviso-erro" role="alert">
                            {mensagem}
                        </p>
                    )}
                    {ocupado && (
                        <span className="texto-secundario" role="status">
                            Salvando projeto
                        </span>
                    )}
                </div>
            ) : (
                <p className="texto-secundario">Adicione um projeto para começar.</p>
            )}
        </div>
    );
}
