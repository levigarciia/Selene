import { useEffect, useState } from 'react';
import { Aplicativo } from '../Aplicativo';
import { instalarPonteWeb } from '../services/ponteWeb';

/** Autentica o navegador antes de abrir as conversas do computador. */
export function AcessoNavegador() {
    const [autenticado, definirAutenticado] = useState(false);
    const [verificando, definirVerificando] = useState(true);
    const [chave, definirChave] = useState('');
    const [erro, definirErro] = useState('');
    const [enviando, definirEnviando] = useState(false);
    const [conectado, definirConectado] = useState(true);

    function abrir() {
        instalarPonteWeb();
        definirAutenticado(true);
        definirChave('');
        definirErro('');
    }

    useEffect(() => {
        let ativo = true;
        void fetch('/api/sessao')
            .then((resposta) => {
                if (ativo && resposta.ok) abrir();
            })
            .catch(() => {
                if (ativo) definirErro('Não foi possível conectar ao computador.');
            })
            .finally(() => {
                if (ativo) definirVerificando(false);
            });
        const encerrar = () => {
            definirAutenticado(false);
            definirErro('A sessão terminou. Informe a chave de acesso atual.');
        };
        const conexao = (evento: Event) => definirConectado((evento as CustomEvent<boolean>).detail);
        window.addEventListener('selene:sessaoEncerrada', encerrar);
        window.addEventListener('selene:conexao', conexao);
        return () => {
            ativo = false;
            window.removeEventListener('selene:sessaoEncerrada', encerrar);
            window.removeEventListener('selene:conexao', conexao);
        };
    }, []);

    if (autenticado)
        return (
            <>
                {!conectado && (
                    <div role="status" className="fixed top-0 inset-x-0 z-50 bg-[#452b23] p-2 text-center text-xs">
                        Reconectando ao computador
                    </div>
                )}
                <Aplicativo />
            </>
        );

    return (
        <main className="grid min-h-dvh place-items-center p-6">
            <form
                className="flex w-full max-w-sm flex-col gap-5"
                onSubmit={async (evento) => {
                    evento.preventDefault();
                    definirEnviando(true);
                    definirErro('');
                    try {
                        const resposta = await fetch('/api/entrar', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chave: chave.trim() }),
                        });
                        const resultado = await resposta.json();
                        if (resposta.ok) abrir();
                        else definirErro(resultado.erro);
                    } catch {
                        definirErro('Sem conexão com a Selene do computador.');
                    } finally {
                        definirEnviando(false);
                    }
                }}
            >
                <h1 className="text-xl font-medium">Selene</h1>
                <p className="text-sm text-secundario">
                    Use a chave disponível em Configurações, Acesso web, no computador.
                </p>
                <label className="flex flex-col gap-2 text-sm">
                    Chave de acesso
                    <input
                        type="password"
                        autoComplete="current-password"
                        value={chave}
                        onChange={(evento) => definirChave(evento.target.value)}
                        required
                        className="rounded-md border border-borda bg-[#0d0f12] p-3"
                    />
                </label>
                {erro && (
                    <p role="alert" className="text-sm text-[#eab1aa]">
                        {erro}
                    </p>
                )}
                <button
                    disabled={enviando || verificando}
                    type="submit"
                    className="rounded-md bg-[#e0d8ef] px-4 py-3 text-[#251b38]"
                >
                    {verificando ? 'Conectando' : enviando ? 'Entrando' : 'Entrar'}
                </button>
            </form>
        </main>
    );
}
