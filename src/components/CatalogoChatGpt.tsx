import type { PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';
import { IconeModeloRemoto } from './IconeModeloRemoto';

/** Oferece a conversa pelo site sem confundir a inscrição Codex com a sessão do ChatGPT. */
export function CatalogoChatGpt({
    ponte,
    executar,
    selecionar,
}: {
    ponte?: PonteSelene;
    executar: Executar;
    selecionar: (id: string) => Promise<void>;
}) {
    async function usar() {
        if (!ponte) return;
        const modelo = await executar(() => ponte.cadastrarChatGptWeb());
        if (modelo) await selecionar(modelo.id);
    }
    return (
        <div className="px-4 py-3 space-y-3 text-sm">
            <div className="flex items-center gap-2">
                <IconeModeloRemoto id="openai/" nome="ChatGPT" />
                ChatGPT
            </div>
            <p className="text-xs text-secundario leading-relaxed">
                Use sua conta no site. O login e a escolha do modelo ficam na janela do ChatGPT. As mensagens e
                respostas aparecem nesta conversa, sem ferramentas locais.
            </p>
            <div className="flex gap-2">
                <button
                    type="button"
                    className="rounded-lg border border-borda px-3 py-2 text-xs hover:bg-hover"
                    disabled={!ponte}
                    onClick={() => void executar(() => ponte!.abrirChatGptWeb())}
                >
                    Conectar conta
                </button>
                <button
                    type="button"
                    className="rounded-lg bg-[#d3c9e8] text-[#211d28] px-3 py-2 text-xs"
                    disabled={!ponte}
                    onClick={() => void usar()}
                >
                    Usar ChatGPT
                </button>
            </div>
        </div>
    );
}
