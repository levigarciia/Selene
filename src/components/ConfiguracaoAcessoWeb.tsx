import { useEffect, useState } from 'react';
import type { EstadoAcessoWeb } from '../../shared/acessoWeb';
import type { PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';
import { Alternar, Linha, Ponto, Secao, botaoPequeno, botaoSecundario, campo } from './PainelConfiguracoes';

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
            <Secao titulo="Esta sessão">
                <Linha
                    titulo="Conectado à Selene do computador"
                    descricao={
                        exigirChave
                            ? 'Sair encerra o acesso deste navegador.'
                            : 'O acesso nesta rede está liberado sem chave.'
                    }
                    controle={
                        exigirChave ? (
                            <button
                                className={botaoSecundario}
                                onClick={async () => {
                                    const resposta = await fetch('/api/sair', { method: 'POST' });
                                    if (resposta.ok) window.dispatchEvent(new Event('selene:sessaoEncerrada'));
                                }}
                            >
                                Sair deste navegador
                            </button>
                        ) : undefined
                    }
                />
            </Secao>
        );

    const alterado = !!estado && (porta !== estado.porta || exigirChave !== estado.exigirChave);
    const portaValida = Number.isInteger(porta) && porta >= 1024 && porta <= 65535;
    async function aplicar() {
        definirOcupado(true);
        try {
            const atualizado = await executar(() =>
                ponte!.configurarAcessoWeb({ ativo: !estado?.ativo || alterado, porta, exigirChave }),
            );
            if (atualizado) definirEstado(atualizado);
        } finally {
            definirOcupado(false);
        }
    }
    return (
        <>
            <Secao titulo="Acesso pelo celular">
                <Linha
                    id="config-acesso"
                    titulo={
                        <>
                            <Ponto tom={estado?.ativo ? 'ok' : 'neutro'} />
                            {estado?.ativo ? 'Ativo' : 'Desativado'}
                        </>
                    }
                    descricao="Abra a Selene pelo navegador do celular na mesma rede Wi Fi, com o aplicativo aberto."
                    controle={
                        <button
                            disabled={ocupado || !estado || !portaValida}
                            className={
                                estado?.ativo && !alterado
                                    ? botaoSecundario
                                    : `${botaoSecundario} border-transparent bg-[#e0d8ef] text-[#251b38] hover:bg-[#ece6f6]`
                            }
                            onClick={() => void aplicar()}
                        >
                            {ocupado
                                ? 'Aplicando'
                                : estado?.ativo
                                  ? alterado
                                      ? 'Aplicar alterações'
                                      : 'Desativar acesso'
                                  : 'Ativar acesso'}
                        </button>
                    }
                >
                    {estado?.erro ? (
                        <p role="alert" className="text-xs text-[#eab1aa]">
                            {estado.erro}
                        </p>
                    ) : undefined}
                </Linha>
                <Linha
                    id="config-porta"
                    titulo="Porta"
                    descricao="Entre 1024 e 65535."
                    controle={
                        <input
                            type="number"
                            aria-label="Porta"
                            min={1024}
                            max={65535}
                            value={porta}
                            disabled={ocupado}
                            className={`${campo} w-24 text-right tabular-nums`}
                            onChange={(evento) => definirPorta(Number(evento.target.value))}
                        />
                    }
                />
                <Linha
                    id="config-chave-web"
                    titulo="Exigir chave de acesso"
                    descricao={
                        exigirChave
                            ? 'A chave muda ao reiniciar o aplicativo.'
                            : 'Qualquer pessoa nesta rede poderá operar a Selene.'
                    }
                    controle={
                        <Alternar
                            rotulo="Exigir chave de acesso"
                            marcado={exigirChave}
                            desativado={ocupado || !estado}
                            alterar={definirExigirChave}
                        />
                    }
                />
            </Secao>
            {estado?.ativo && (
                <Secao titulo="Conexão">
                    <Linha
                        titulo="Endereço no celular"
                        descricao={estado.enderecos.length ? undefined : 'Nenhuma conexão de rede local encontrada.'}
                    >
                        {estado.enderecos.length ? (
                            <div className="flex flex-col gap-1">
                                {estado.enderecos.map((endereco) => (
                                    <code key={endereco} className="select-all text-[13px] text-secundario">
                                        {endereco}
                                    </code>
                                ))}
                            </div>
                        ) : undefined}
                    </Linha>
                    {estado.exigirChave && (
                        <Linha
                            titulo="Chave de acesso"
                            controle={
                                <>
                                    <button className={botaoPequeno} onClick={() => definirMostrar(!mostrar)}>
                                        {mostrar ? 'Ocultar chave' : 'Mostrar chave'}
                                    </button>
                                    <button
                                        disabled={ocupado}
                                        className={botaoPequeno}
                                        onClick={async () => {
                                            const atualizado = await executar(() => ponte!.renovarChaveWeb());
                                            if (atualizado) definirEstado(atualizado);
                                        }}
                                    >
                                        Renovar chave e encerrar sessões
                                    </button>
                                </>
                            }
                        >
                            <input
                                readOnly
                                aria-label="Chave de acesso"
                                type={mostrar ? 'text' : 'password'}
                                value={estado.chave}
                                className={`${campo} w-full font-mono`}
                            />
                        </Linha>
                    )}
                </Secao>
            )}
            <p className="-mt-5 px-4 text-xs text-discreto">
                Use em uma rede de confiança. O acesso usa HTTP local. Se o Windows solicitar, permita a Selene em redes
                privadas no firewall.
            </p>
        </>
    );
}
