import { useState } from 'react';
import { FolderOpenIcon, GitBranchIcon, PlusIcon } from '@phosphor-icons/react';
import type { useSelene } from '../hooks/useSelene';
import type { NovoProjeto, Projeto } from '../../shared/contratos';

const botao =
    'inline-flex items-center justify-center gap-2 rounded-md border border-borda ' +
    'bg-superficie px-3 py-2 text-xs hover:enabled:bg-borda';

/** Adiciona projetos na própria tela, por pasta, nome ou repositório. */
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
        } catch (erro) {
            definirErro(erro instanceof Error ? erro.message : 'Não foi possível adicionar o projeto.');
        } finally {
            definirOcupado(false);
        }
    }

    return (
        <section data-ui="adicionar-projeto">
            <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
                <h2 className="m-0 text-lg font-medium">
                    {tipo === 'criar' ? 'Novo projeto' : tipo === 'clonar' ? 'Clonar repositório' : 'Adicionar projeto'}
                </h2>
                <button className={botao} disabled={ocupado} onClick={fechar}>
                    Cancelar
                </button>
            </header>
            {tipo ? (
                <form
                    onSubmit={(evento) => {
                        evento.preventDefault();
                        void adicionar(tipo === 'criar' ? { tipo, nome: valor.trim() } : { tipo, url: valor.trim() });
                    }}
                >
                    <label className="flex flex-col gap-3 text-xs text-secundario">
                        {tipo === 'criar' ? 'Nome do projeto' : 'URL HTTPS do repositório'}
                        <input
                            autoFocus
                            value={valor}
                            disabled={ocupado}
                            required
                            type={tipo === 'clonar' ? 'url' : 'text'}
                            maxLength={tipo === 'criar' ? 100 : 2000}
                            placeholder={tipo === 'criar' ? 'Meu projeto' : 'https://github.com/usuario/repositorio'}
                            onChange={(evento) => definirValor(evento.target.value)}
                        />
                    </label>
                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            type="button"
                            className={botao}
                            disabled={ocupado}
                            onClick={() => {
                                definirTipo(null);
                                definirErro('');
                            }}
                        >
                            Voltar
                        </button>
                        <button
                            className={`${botao} bg-principal! text-superficie hover:enabled:bg-white!`}
                            disabled={ocupado || !valor.trim()}
                        >
                            {ocupado ? 'Preparando projeto' : tipo === 'criar' ? 'Criar projeto' : 'Clonar repositório'}
                        </button>
                    </div>
                </form>
            ) : (
                <div
                    data-ui="opcoes-projetos"
                    className={[
                        'overflow-hidden rounded-lg border border-borda [&_button]:flex [&_button]:w-full',
                        '[&_button]:items-center [&_button]:gap-3 [&_button]:p-4 [&_button]:text-left',
                        '[&_button]:text-sm [&_button+button]:border-t [&_button+button]:border-borda',
                        '[&_button:hover:enabled]:bg-superficie',
                    ].join(' ')}
                >
                    <button disabled={ocupado} onClick={() => void adicionar({ tipo: 'pasta' })}>
                        <FolderOpenIcon size={20} /> Abrir pasta existente
                    </button>
                    <button
                        disabled={ocupado}
                        onClick={() => {
                            definirTipo('criar');
                            definirValor('');
                            definirErro('');
                        }}
                    >
                        <PlusIcon size={20} /> Novo projeto
                    </button>
                    <button
                        disabled={ocupado}
                        onClick={() => {
                            definirTipo('clonar');
                            definirValor('');
                            definirErro('');
                        }}
                    >
                        <GitBranchIcon size={20} /> Clonar repositório
                    </button>
                </div>
            )}
            {ocupado && (
                <p className="mt-4 text-xs text-secundario" role="status">
                    Preparando projeto
                </p>
            )}
            {erro && (
                <p className="mt-4 rounded-md bg-[#33201f] p-3 text-xs text-[#f0b2ae]" role="alert">
                    {erro}
                </p>
            )}
        </section>
    );
}
