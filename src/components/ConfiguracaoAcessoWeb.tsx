import { useEffect, useState } from 'react';
import type { EstadoAcessoWeb } from '../../shared/acessoWeb';
import type { PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';

/** Permite habilitar o acesso local e revogar sessões pelo computador. */
export function ConfiguracaoAcessoWeb({ ponte, executar }: { ponte?: PonteSelene; executar: Executar }) {
    const [estado, definirEstado] = useState<EstadoAcessoWeb>();
    const [porta, definirPorta] = useState(4318);
    const [exigirChave, definirExigirChave] = useState(true);
    const [ocupado, definirOcupado] = useState(false);
    const [mostrar, definirMostrar] = useState(false);
    const navegador = location.protocol !== 'file:' && !navigator.userAgent.includes('Electron');

    useEffect(() => {
        let ativo = true;
        if (navegador) {
            void fetch('/api/sessao')
                .then((resposta) => resposta.json())
                .then((estado) => {
                    if (ativo) definirExigirChave(estado.exigirChave !== false);
                })
                .catch(() => {});
            return () => {
                ativo = false;
            };
        }
        if (!ponte) return;
        void executar(() => ponte.acessoWeb()).then((estado) => {
            if (!ativo || !estado) return;
            definirEstado(estado);
            definirPorta(estado.porta);
            definirExigirChave(estado.exigirChave);
        });
        return () => {
            ativo = false;
        };
    }, [ponte, navegador]);

    if (navegador)
        return (
            <div className="flex flex-col gap-4 text-sm">
                <p className="text-secundario">Você está conectado à Selene do computador.</p>
                {!exigirChave && <p className="text-secundario">O acesso nesta rede está liberado sem chave.</p>}
                {exigirChave && (
                    <button
                        className="self-start rounded-md border border-borda px-4 py-2"
                        onClick={async () => {
                            const resposta = await fetch('/api/sair', { method: 'POST' });
                            if (resposta.ok) window.dispatchEvent(new Event('selene:sessaoEncerrada'));
                        }}
                    >
                        Sair deste navegador
                    </button>
                )}
            </div>
        );

    const alterado = !!estado && (porta !== estado.porta || exigirChave !== estado.exigirChave);
    return (
        <div className="flex max-w-xl flex-col gap-5 text-sm">
            <p className="text-secundario">
                Abra a Selene pelo celular na mesma rede Wi Fi. Mantenha o aplicativo aberto.
            </p>
            <label className="flex max-w-40 flex-col gap-2">
                Porta
                <input
                    type="number"
                    min={1024}
                    max={65535}
                    value={porta}
                    disabled={ocupado}
                    className="rounded-md border border-borda bg-[#0d0f12] p-2"
                    onChange={(evento) => definirPorta(Number(evento.target.value))}
                />
            </label>
            <label className="flex items-center gap-3">
                <input
                    type="checkbox"
                    checked={exigirChave}
                    disabled={ocupado || !estado}
                    onChange={(evento) => definirExigirChave(evento.target.checked)}
                    className="size-4 accent-[#b5a2dc]"
                />
                Exigir chave de acesso
            </label>
            {!exigirChave && (
                <p className="text-xs text-secundario">Qualquer pessoa nesta rede poderá operar a Selene.</p>
            )}
            <div className="flex flex-wrap gap-3">
                <button
                    disabled={ocupado || !estado || !Number.isInteger(porta) || porta < 1024 || porta > 65535}
                    className="rounded-md bg-[#e0d8ef] px-4 py-2 text-[#251b38]"
                    onClick={async () => {
                        definirOcupado(true);
                        try {
                            const atualizado = await executar(() =>
                                ponte!.configurarAcessoWeb({
                                    ativo: !estado?.ativo || alterado,
                                    porta,
                                    exigirChave,
                                }),
                            );
                            if (atualizado) definirEstado(atualizado);
                        } finally {
                            definirOcupado(false);
                        }
                    }}
                >
                    {ocupado
                        ? 'Aplicando'
                        : estado?.ativo
                          ? alterado
                              ? 'Aplicar alterações'
                              : 'Desativar acesso'
                          : 'Ativar acesso'}
                </button>
                {estado?.ativo && estado.exigirChave && (
                    <button
                        disabled={ocupado}
                        className="rounded-md border border-borda px-4 py-2"
                        onClick={async () => {
                            const atualizado = await executar(() => ponte!.renovarChaveWeb());
                            if (atualizado) definirEstado(atualizado);
                        }}
                    >
                        Renovar chave e encerrar sessões
                    </button>
                )}
            </div>
            {estado?.erro && (
                <p role="alert" className="text-[#eab1aa]">
                    {estado.erro}
                </p>
            )}
            {estado?.ativo && (
                <>
                    <div className="flex flex-col gap-2">
                        <span className="text-secundario">Endereço no celular</span>
                        {estado.enderecos.map((endereco) => (
                            <code key={endereco} className="select-all">
                                {endereco}
                            </code>
                        ))}
                        {!estado.enderecos.length && <span>Nenhuma conexão de rede local encontrada.</span>}
                    </div>
                    {estado.exigirChave && (
                        <label className="flex flex-col gap-2">
                            Chave de acesso
                            <input
                                readOnly
                                type={mostrar ? 'text' : 'password'}
                                value={estado.chave}
                                className="w-full rounded-md border border-borda bg-[#0d0f12] p-3 font-mono"
                            />
                        </label>
                    )}
                    {estado.exigirChave && (
                        <button
                            className="self-start text-secundario hover:text-principal"
                            onClick={() => definirMostrar(!mostrar)}
                        >
                            {mostrar ? 'Ocultar chave' : 'Mostrar chave'}
                        </button>
                    )}
                    <p className="text-xs text-secundario">
                        Use em uma rede de confiança. O acesso usa HTTP local. Se o Windows solicitar, permita a Selene
                        em redes privadas no firewall. A chave muda ao reiniciar o aplicativo.
                    </p>
                </>
            )}
        </div>
    );
}
