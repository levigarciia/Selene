import type { Conversa, PonteSelene } from '../../shared/contratos';

/** Permite revisar e entregar os envios preservados enquanto o agente trabalha. */
export function FilaCode({
    conversa,
    ativa,
    ocupado,
    ponte,
    executar,
}: {
    conversa: Conversa;
    ativa: boolean;
    ocupado: boolean;
    ponte: PonteSelene;
    executar: (operacao: () => ReturnType<PonteSelene['gerenciarEnvioCode']>) => Promise<unknown>;
}) {
    if (!conversa.enviosPendentes?.length) return null;
    return (
        <div data-ui="fila-code" className="mb-3 flex flex-col gap-2 text-xs text-secundario" aria-live="polite">
            {conversa.enviosPendentes.map((envio, indice) => (
                <div key={envio.id} className="flex items-center gap-2 rounded-lg bg-superficie px-3 py-2">
                    <span className="shrink-0">
                        {ativa && envio.tipo === 'direcao' ? 'Redirecionando' : `Na fila: ${indice + 1}`}
                    </span>
                    <span className="min-w-0 flex-1 truncate" title={envio.texto}>
                        {envio.texto}
                    </span>
                    <button
                        type="button"
                        disabled={ocupado || (ativa && envio.tipo === 'direcao')}
                        className="shrink-0 text-principal disabled:opacity-40"
                        onClick={() =>
                            void executar(() =>
                                ponte.gerenciarEnvioCode(conversa.id, envio.id, ativa ? 'direcao' : 'executar'),
                            )
                        }
                    >
                        {ativa ? 'Redirecionar' : 'Enviar'}
                    </button>
                    <button
                        type="button"
                        className="shrink-0"
                        aria-label={`Remover envio ${indice + 1}`}
                        onClick={() => void executar(() => ponte.gerenciarEnvioCode(conversa.id, envio.id, 'remover'))}
                    >
                        Remover
                    </button>
                </div>
            ))}
        </div>
    );
}
