import type { Conversa, PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';

/** Abre o site para login ou revisão de um envio cuja confirmação não chegou. */
export function ControleChatGpt({
    conversa,
    persistida,
    emExecucao,
    ponte,
    executar,
}: {
    conversa?: Conversa;
    persistida: boolean;
    emExecucao: boolean;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    return (
        <div className="flex items-center gap-3 text-xs text-secundario">
            <button
                type="button"
                className="hover:text-principal"
                disabled={!ponte}
                onClick={() => void executar(() => ponte!.abrirChatGptWeb(persistida ? conversa?.id : undefined))}
            >
                Abrir ChatGPT
            </button>
            {conversa?.chatgptWeb?.envioIncerto && !emExecucao && (
                <button
                    type="button"
                    className="text-[#d8bf96] hover:text-principal"
                    disabled={!ponte}
                    onClick={() => void executar(() => ponte!.confirmarRevisaoChatGpt(conversa.id))}
                >
                    Conferi o envio no site
                </button>
            )}
        </div>
    );
}
