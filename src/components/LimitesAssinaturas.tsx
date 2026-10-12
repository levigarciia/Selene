import { useCallback, useEffect, useState } from 'react';
import { ArrowClockwiseIcon } from '@phosphor-icons/react';
import type { PonteSelene } from '../../shared/contratos';
import { provedoresApresentacao, provedoresAssinatura, type ProvedorAssinatura } from '../../shared/assinaturas';
import { formatarReinicio, type JanelaLimite, type LimitesAssinatura } from '../../shared/limites';

const horario = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dataHora = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
});
const planos: Record<string, string> = {
    free: 'Free',
    go: 'Go',
    plus: 'Plus',
    pro: 'Pro',
    max: 'Max',
    team: 'Team',
    business: 'Business',
    enterprise: 'Enterprise',
};

/** Cor da barra conforme o consumo: neutra, alerta a partir de 80% e crítica ao esgotar. */
function corDaBarra(percentual: number): string {
    if (percentual >= 100) return '#e5736a';
    if (percentual >= 80) return '#e0b25a';
    return '#ededed';
}

function Janela({ janela }: { janela: JanelaLimite }) {
    const restante = Math.max(0, 100 - janela.percentualUsado);
    const reinicio = janela.reiniciaEm ? new Date(janela.reiniciaEm) : undefined;
    const mesmoDia = reinicio && reinicio.toDateString() === new Date().toDateString();
    return (
        <li data-ui="janela-limite" data-janela={janela.id}>
            <div className="flex items-baseline gap-3 text-[13px]">
                <span className="font-medium">{janela.rotulo}</span>
                <strong className="ml-auto font-semibold tabular-nums">{Math.round(restante)}% restante</strong>
            </div>
            <div
                className="mt-2 h-[3px] w-full bg-[#1c1c1c]"
                role="progressbar"
                aria-label={`${janela.rotulo}: ${Math.round(restante)}% restante`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(restante)}
            >
                {/* A barra representa o que resta e diminui até zerar. */}
                <div
                    className="h-[3px]"
                    style={{ width: `${restante}%`, background: corDaBarra(janela.percentualUsado) }}
                />
            </div>
            <p className="mt-1.5 text-[12px] text-principal/60">
                {Math.round(janela.percentualUsado)}% usado
                {reinicio &&
                    ` · reinicia em ${formatarReinicio(janela.reiniciaEm!)} (${
                        mesmoDia ? horario.format(reinicio) : dataHora.format(reinicio)
                    })`}
            </p>
        </li>
    );
}

function Cartao({ provedor, limites }: { provedor: ProvedorAssinatura; limites?: LimitesAssinatura }) {
    const esgotada = limites?.estado === 'ok' && limites.janelas.some((janela) => janela.percentualUsado >= 100);
    return (
        <section data-ui="limites-provedor" data-provedor={provedor} aria-label={provedoresApresentacao[provedor].nome}>
            <div className="mb-5 flex items-baseline gap-3">
                <h2 className="text-[14px] font-semibold">{provedoresApresentacao[provedor].nome}</h2>
                {limites?.estado === 'ok' && limites.plano && (
                    <span className="rounded bg-[#1c1c1c] px-1.5 py-0.5 text-[11px] text-principal/70">
                        {planos[limites.plano.toLowerCase()] ?? limites.plano}
                    </span>
                )}
            </div>
            {!limites && <p className="text-[12px] text-principal/60">Consultando limites</p>}
            {limites?.estado === 'indisponivel' && (
                <p role="status" className="text-[12px] text-principal/60">
                    {limites.motivo}
                </p>
            )}
            {limites?.estado === 'ok' && (
                <>
                    {esgotada && (
                        <p role="alert" className="mb-4 text-[12px] text-[#e5736a]">
                            O limite desta inscrição foi atingido. Novas mensagens esperam o reinício da janela.
                        </p>
                    )}
                    <ul className="space-y-5">
                        {limites.janelas.map((janela) => (
                            <Janela key={janela.id} janela={janela} />
                        ))}
                    </ul>
                    {limites.janelas.length === 0 && (
                        <p className="text-[12px] text-principal/60">Nenhuma janela de uso informada.</p>
                    )}
                    {!!limites.reiniciosDisponiveis && (
                        <p className="mt-4 text-[12px] text-principal/60">
                            {limites.reiniciosDisponiveis === 1
                                ? '1 reinício gratuito disponível na conta.'
                                : `${limites.reiniciosDisponiveis} reinícios gratuitos disponíveis na conta.`}
                        </p>
                    )}
                </>
            )}
        </section>
    );
}

/** Consulta os limites das inscrições ChatGPT e Claude pelos CLIs oficiais já autenticados. */
export function LimitesAssinaturas({ ponte }: { ponte?: PonteSelene }) {
    const [limites, definirLimites] = useState<Partial<Record<ProvedorAssinatura, LimitesAssinatura>>>({});
    const [erro, definirErro] = useState('');
    const [consultando, definirConsultando] = useState(false);

    const consultar = useCallback(async () => {
        if (!ponte) return;
        definirConsultando(true);
        definirErro('');
        try {
            const resultado = await ponte.limitesAssinaturas();
            if (resultado.ok) definirLimites(resultado.valor);
            else definirErro(resultado.erro);
        } catch {
            definirErro('Não foi possível consultar os limites.');
        } finally {
            definirConsultando(false);
        }
    }, [ponte]);

    useEffect(() => {
        void consultar();
    }, [consultar]);

    const verificadoEm = Object.values(limites)
        .map((item) => item.verificadoEm)
        .sort()
        .at(-1);
    return (
        <div data-ui="limites-assinaturas">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <p className="max-w-[560px] text-[12px] leading-relaxed text-principal/60">
                    Uso das inscrições informado pelo Codex e pelo Claude Code. A Selene só lê as porcentagens, sem
                    acessar a sua credencial.
                </p>
                <div className="flex items-center gap-3 text-[12px] text-principal/60">
                    {verificadoEm && <span>Atualizado às {horario.format(new Date(verificadoEm))}</span>}
                    <button
                        type="button"
                        disabled={consultando}
                        onClick={() => void consultar()}
                        aria-label="Atualizar limites"
                        className="inline-flex items-center gap-1.5 rounded-md bg-[#121212] px-3 py-1.5 font-medium text-principal/70 hover:text-principal disabled:opacity-40"
                    >
                        <ArrowClockwiseIcon size={13} className={consultando ? 'animate-spin' : ''} />
                        {consultando ? 'Consultando' : 'Atualizar'}
                    </button>
                </div>
            </div>
            {erro && (
                <p role="alert" className="mb-6 text-[12px] text-[#eab1aa]">
                    {erro}
                </p>
            )}
            <div className="grid gap-12 md:grid-cols-2">
                {provedoresAssinatura.map((provedor) => (
                    <Cartao key={provedor} provedor={provedor} limites={limites[provedor]} />
                ))}
            </div>
        </div>
    );
}
