import { useEffect, useState, type ReactNode } from 'react';
import { ArrowClockwiseIcon, CheckIcon, MoonIcon, PlusIcon, ShareNetworkIcon } from '@phosphor-icons/react';
import type { Modelo, PonteSelene } from '../../shared/contratos';
import {
    provedoresApresentacao,
    provedoresModelo,
    type EstadoAssinatura,
    type ModelosAssinatura,
    type ProvedorAssinatura,
    type ProvedorModelo,
    modelosAssinatura,
} from '../../shared/assinaturas';
import openai from '../assets/modelos/openai.svg';
import anthropic from '../assets/modelos/anthropic.svg';
import type { Executar } from './Configuracoes';
import { ConfiguracaoOpenRouter } from './ConfiguracaoOpenRouter';
import { Cartao, Linha, Ponto, Secao, botaoPequeno } from './PainelConfiguracoes';

const rotuloEstado: Record<EstadoAssinatura['estado'], string> = {
    pronto: 'Conectado',
    'nao-autenticado': 'Não conectado',
    'nao-instalado': 'CLI não instalado',
};

function IconeProvedor({ provedor }: { provedor: ProvedorModelo }) {
    if (provedor === 'selene') return <MoonIcon size={16} weight="fill" className="shrink-0 text-principal/80" />;
    if (provedor === 'openrouter') return <ShareNetworkIcon size={16} className="shrink-0 text-principal/80" />;
    return (
        <img
            src={provedor === 'chatgpt' ? openai : anthropic}
            width={16}
            height={16}
            alt=""
            aria-hidden="true"
            className="shrink-0 brightness-0 invert opacity-80"
        />
    );
}

/** Lista de provedores à esquerda e detalhes do selecionado à direita, como no T3 Code. */
export function ProvedoresConfiguracoes({
    ponte,
    executar,
    ocupado,
    openrouterConfigurado,
    modelos,
    adicionarModelo,
    motor,
    respostas,
    alvo,
    removerModelo,
}: {
    ponte?: PonteSelene;
    executar: Executar;
    ocupado: boolean;
    openrouterConfigurado: boolean;
    modelos: Modelo[];
    adicionarModelo: (entrada: {
        nome: string;
        assinatura: { provedor: ProvedorAssinatura; id: string };
    }) => Promise<boolean>;
    motor: ReactNode;
    respostas: ReactNode;
    alvo: string | null;
    removerModelo: (id: string) => Promise<void>;
}) {
    const [selecionado, definirSelecionado] = useState<ProvedorModelo>(
        alvo === 'config-openrouter' ? 'openrouter' : 'selene',
    );
    useEffect(() => {
        if (alvo === 'config-openrouter') definirSelecionado('openrouter');
        else if (alvo && alvo !== 'config-provedores') definirSelecionado('selene');
    }, [alvo]);
    const [assinaturas, definirAssinaturas] = useState<Partial<Record<ProvedorAssinatura, EstadoAssinatura>>>({});
    const [verificando, definirVerificando] = useState(false);
    const [verificadoEm, definirVerificadoEm] = useState<Date>();
    const [adicionando, definirAdicionando] = useState<string | null>(null);
    const [erro, definirErro] = useState('');
    const [disponiveis, definirDisponiveis] = useState<ModelosAssinatura>(modelosAssinatura);

    async function verificar() {
        if (!ponte) return;
        definirVerificando(true);
        definirErro('');
        try {
            const [resultado, lista] = await Promise.all([ponte.verificarAssinaturas(), ponte.modelosAssinatura()]);
            if (lista.ok) definirDisponiveis(lista.valor);
            if (resultado.ok) definirAssinaturas(resultado.valor);
            else definirErro(resultado.erro);
            definirVerificadoEm(new Date());
        } catch {
            definirErro('Não foi possível verificar os provedores.');
        } finally {
            definirVerificando(false);
        }
    }

    useEffect(() => {
        void verificar();
    }, [ponte]);

    const situacao = (provedor: ProvedorModelo): { tom: 'ok' | 'neutro' | 'erro'; texto: string; conta?: string } => {
        if (provedor === 'selene') return { tom: 'ok', texto: 'Local · sempre ativo' };
        if (provedor === 'openrouter')
            return openrouterConfigurado
                ? { tom: 'ok', texto: 'Chave configurada' }
                : { tom: 'neutro', texto: 'Sem chave de API' };
        const estado = assinaturas[provedor as ProvedorAssinatura];
        if (!estado) return { tom: 'neutro', texto: verificando ? 'Verificando' : 'Desconhecido' };
        return {
            tom: estado.estado === 'pronto' ? 'ok' : 'neutro',
            texto: rotuloEstado[estado.estado],
            conta: estado.estado === 'pronto' ? estado.conta : undefined,
        };
    };

    const atual = situacao(selecionado);
    const apresentacao = provedoresApresentacao[selecionado];
    let detalhe: ReactNode;
    if (selecionado === 'selene') {
        detalhe = (
            <>
                {motor}
                {respostas}
            </>
        );
    } else if (selecionado === 'openrouter') {
        detalhe = (
            <>
                <Secao titulo="Conexão">
                    <Linha
                        id="config-openrouter"
                        titulo="Chave de API"
                        descricao="Guardada criptografada neste computador. A chave salva nunca volta para a interface."
                    >
                        <ConfiguracaoOpenRouter
                            configurado={openrouterConfigurado}
                            ocupado={ocupado}
                            ponte={ponte}
                            executar={executar}
                        />
                    </Linha>
                    <Linha
                        titulo="Modelos adicionados"
                        descricao={
                            modelos.some((modelo) => modelo.openrouter)
                                ? 'Adicione outros pelo seletor de modelos da conversa.'
                                : 'Nenhum ainda. Adicione pelo seletor de modelos da conversa.'
                        }
                    >
                        {modelos.some((modelo) => modelo.openrouter) ? (
                            <ListaModelos
                                itens={modelos
                                    .filter((modelo) => modelo.openrouter)
                                    .map((modelo) => ({ chave: modelo.id, nome: modelo.nome, cadastrado: modelo }))}
                                ocupado={ocupado || !!adicionando}
                                remover={removerModelo}
                            />
                        ) : undefined}
                    </Linha>
                </Secao>
                {respostas}
            </>
        );
    } else {
        const provedor = selecionado;
        const estado = assinaturas[provedor];
        detalhe = (
            <Secao titulo="Conta">
                <Linha
                    titulo="Autenticação"
                    descricao={
                        estado?.estado === 'pronto' ? (
                            estado.mensagem
                        ) : (
                            <>
                                {estado?.mensagem ? `${estado.mensagem} ` : ''}Entre pelo terminal com{' '}
                                <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-secundario">
                                    {provedor === 'chatgpt' ? 'codex login' : 'claude auth login'}
                                </code>
                                .
                            </>
                        )
                    }
                />
                <Linha
                    titulo="Instruções"
                    descricao={`A Selene não envia instruções próprias. Valem as do ${
                        provedor === 'chatgpt'
                            ? 'Codex (AGENTS.md e config.toml)'
                            : 'Claude Code (CLAUDE.md e settings.json)'
                    }.`}
                />
                <Linha titulo="Modelos" descricao="Adicione os modelos que quer ver no seletor da conversa.">
                    <ListaModelos
                        itens={disponiveis[provedor].map((modelo) => ({
                            chave: `${provedor}:${modelo.id}`,
                            nome: modelo.nome,
                            cadastrado: modelos.find(
                                (item) => item.assinatura?.provedor === provedor && item.assinatura.id === modelo.id,
                            ),
                            adicionar: async () => {
                                definirAdicionando(`${provedor}:${modelo.id}`);
                                try {
                                    await adicionarModelo({
                                        nome: modelo.nome,
                                        assinatura: { provedor, id: modelo.id },
                                    });
                                } finally {
                                    definirAdicionando(null);
                                }
                            },
                        }))}
                        adicionando={adicionando}
                        ocupado={ocupado || !!adicionando}
                        remover={removerModelo}
                    />
                </Linha>
            </Secao>
        );
    }

    return (
        <section
            id="config-provedores"
            tabIndex={-1}
            data-ui="provedores"
            className="flex flex-col gap-2.5 outline-none"
        >
            <div className="flex min-h-7 items-center justify-between gap-4 px-4 max-sm:px-3">
                <h2 className="text-sm font-normal text-principal/70">Provedores</h2>
                <button type="button" className={botaoPequeno} disabled={verificando} onClick={() => void verificar()}>
                    <ArrowClockwiseIcon size={13} className={verificando ? 'animate-spin' : ''} />
                    {verificando
                        ? 'Verificando'
                        : verificadoEm
                          ? `Verificado às ${verificadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Verificar'}
                </button>
            </div>
            <Cartao className="grid grid-cols-[14rem_minmax(0,1fr)] [&>*+*]:border-t-0 max-sm:grid-cols-1">
                <ul
                    role="tablist"
                    aria-label="Provedores"
                    aria-orientation="vertical"
                    className="flex flex-col border-r border-white/[0.06] p-1.5 max-sm:border-r-0 max-sm:border-b"
                >
                    {provedoresModelo.map((provedor) => {
                        const estado = situacao(provedor);
                        return (
                            <li key={provedor} role="presentation">
                                <button
                                    role="tab"
                                    data-ui="provedor"
                                    data-provedor={provedor}
                                    aria-selected={selecionado === provedor}
                                    onClick={() => definirSelecionado(provedor)}
                                    className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left
                                        hover:bg-white/[0.03] aria-selected:bg-white/[0.06]"
                                >
                                    <span className="mt-0.5">
                                        <IconeProvedor provedor={provedor} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[13px] font-medium text-principal">
                                            {provedoresApresentacao[provedor].nome}
                                        </span>
                                        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-discreto">
                                            <Ponto tom={estado.tom} />
                                            <span className="truncate">{estado.texto}</span>
                                        </span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
                <div role="tabpanel" className="flex min-w-0 flex-col p-1.5">
                    <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-1">
                        <IconeProvedor provedor={selecionado} />
                        <h3 className="text-sm font-medium">{apresentacao.nome}</h3>
                        <span className="ml-auto flex items-center gap-1.5 text-xs text-discreto">
                            <Ponto tom={atual.tom} />
                            {atual.texto}
                        </span>
                    </div>
                    <p className="px-2.5 pb-1 text-xs text-discreto">
                        {apresentacao.descricao}
                        {atual.conta && /^[\p{L}\d]/u.test(atual.conta) ? ` ${atual.conta}.` : ''}
                    </p>
                    <div className="mt-3 flex flex-col gap-6 px-1 pb-2">{detalhe}</div>
                </div>
            </Cartao>
            {erro && (
                <p role="alert" className="px-4 text-xs text-[#eab1aa]">
                    {erro}
                </p>
            )}
            <p className="px-4 text-xs text-discreto">
                ChatGPT e Claude usam o CLI oficial já autenticado neste computador. A Selene não lê nem guarda a sua
                credencial.
            </p>
        </section>
    );
}

/** Linhas de modelo com adicionar/remover; remover só tira da lista da Selene. */
function ListaModelos({
    itens,
    adicionando,
    ocupado,
    remover,
}: {
    itens: { chave: string; nome: string; cadastrado?: Modelo; adicionar?: () => Promise<void> }[];
    adicionando?: string | null;
    ocupado: boolean;
    remover: (id: string) => Promise<void>;
}) {
    return (
        <div className="flex flex-col">
            {itens.map((item) => (
                <div
                    key={item.chave}
                    className="flex h-9 items-center justify-between gap-3 border-t border-white/[0.05] first:border-t-0"
                >
                    <span className="flex min-w-0 items-center gap-2 truncate text-[13px]">
                        {item.cadastrado && <CheckIcon size={12} className="shrink-0 text-sucesso" />}
                        <span className="truncate">{item.nome}</span>
                    </span>
                    {item.cadastrado ? (
                        <button
                            type="button"
                            className={`${botaoPequeno} hover:text-[#eab1aa]`}
                            disabled={ocupado}
                            aria-label={`Remover ${item.nome}`}
                            onClick={() => void remover(item.cadastrado!.id)}
                        >
                            Remover
                        </button>
                    ) : (
                        <button
                            type="button"
                            className={botaoPequeno}
                            disabled={ocupado}
                            aria-label={`Adicionar ${item.nome}`}
                            onClick={() => void item.adicionar?.()}
                        >
                            <PlusIcon size={12} />
                            {adicionando === item.chave ? 'Adicionando' : 'Adicionar'}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
