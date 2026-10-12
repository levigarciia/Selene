import { useEffect, useState } from 'react';
import { CheckIcon } from '@phosphor-icons/react';
import type { Estado, PonteSelene } from '../../shared/contratos';
import {
    modelosAssinatura,
    provedoresApresentacao,
    provedoresAssinatura,
    type ModelosAssinatura,
} from '../../shared/assinaturas';
import type { Executar } from './Configuracoes';
import { IconeModeloRemoto } from './IconeModeloRemoto';

const prefixoIcone = { chatgpt: 'openai/', claude: 'anthropic/' } as const;

/** Destaca a versão final do nome ("Claude Opus 5.5") em um selo, como no catálogo do OpenRouter. */
function NomeComVersao({ nome }: { nome: string }) {
    const partes = /^(.*\D)\s+(\d+(?:\.\d+)*)$/.exec(nome);
    return (
        <strong className="flex flex-1 min-w-0 items-center font-medium">
            <span className="truncate">{partes ? partes[1] : nome}</span>
            {partes && (
                <span className="ml-[6px] shrink-0 rounded-[4px] bg-[#b5a2dc1a] px-[5px] py-[1px] text-[10px] font-medium text-[#b5a2dc]">
                    {partes[2]}
                </span>
            )}
        </strong>
    );
}

/** Lista os modelos das inscrições conforme informados pelos CLIs, adicionando-os à conversa ao selecionar. */
export function CatalogoAssinaturas({
    estado,
    ponte,
    executar,
    selecionar,
    busca,
    filtro,
    modeloId,
}: {
    estado: Estado;
    ponte?: PonteSelene;
    executar: Executar;
    selecionar: (id: string) => Promise<void>;
    busca: string;
    /** Provedor escolhido na barra lateral; outros valores mostram todas as inscrições. */
    filtro: string;
    modeloId: string;
}) {
    const [disponiveis, definirDisponiveis] = useState<ModelosAssinatura>(modelosAssinatura);
    const ocupado = !!estado.conversaEmExecucao;
    const termo = busca.trim().toLocaleLowerCase('pt-BR');

    useEffect(() => {
        void ponte?.modelosAssinatura().then((resultado) => {
            if (resultado.ok) definirDisponiveis(resultado.valor);
        });
    }, [ponte]);

    async function usar(provedor: (typeof provedoresAssinatura)[number], id: string, nome: string) {
        const existente = estado.modelos.find(
            (modelo) => modelo.assinatura?.provedor === provedor && modelo.assinatura.id === id,
        );
        const modelo =
            existente ??
            (await executar(() => ponte!.adicionarModeloAssinatura({ nome, assinatura: { provedor, id } })));
        if (modelo) await selecionar(modelo.id);
    }

    const grupos = provedoresAssinatura
        .filter((provedor) => !(provedoresAssinatura as readonly string[]).includes(filtro) || filtro === provedor)
        .map((provedor) => ({
            provedor,
            modelos: disponiveis[provedor].filter((modelo) => modelo.nome.toLocaleLowerCase('pt-BR').includes(termo)),
        }))
        .filter((grupo) => grupo.modelos.length);

    if (!grupos.length)
        return (
            <p data-ui="catalogo-vazio" className="text-[12px] text-secundario px-[14px] py-[25px]">
                {termo ? 'Nenhum modelo encontrado' : 'Conecte o Codex ou o Claude Code em Configurações > Provedores.'}
            </p>
        );

    return (
        <>
            {grupos.map(({ provedor, modelos }) => (
                <section key={provedor} data-ui="grupo-assinatura">
                    <h3 className="px-[16px] pt-[10px] pb-[4px] text-[10px] uppercase tracking-wide text-secundario">
                        {provedoresApresentacao[provedor].nome}
                    </h3>
                    {modelos.map((item) => {
                        const selecionado = estado.modelos.some(
                            (modelo) =>
                                modelo.id === modeloId &&
                                modelo.assinatura?.provedor === provedor &&
                                modelo.assinatura.id === item.id,
                        );
                        return (
                            <button
                                key={item.id}
                                type="button"
                                data-ui="modelo-assinatura"
                                className={[
                                    'flex items-center gap-[9px] w-full bg-transparent text-[#d6dae2] text-left',
                                    'text-[12px] px-[16px] py-[11px] border-0 [&:hover]:bg-[#20232a]',
                                ].join(' ')}
                                disabled={ocupado}
                                aria-label={`Selecionar ${item.nome}`}
                                onClick={() => void usar(provedor, item.id, item.nome)}
                            >
                                <IconeModeloRemoto id={prefixoIcone[provedor]} nome={item.nome} />
                                <NomeComVersao nome={item.nome} />
                                {selecionado && <CheckIcon size={17} />}
                            </button>
                        );
                    })}
                </section>
            ))}
        </>
    );
}
