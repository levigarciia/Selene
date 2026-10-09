import { useState } from 'react';

/** Edita o texto de uma mensagem enviada, mantendo seus anexos no reenvio. */
export function EditorMensagem({
    texto,
    possuiImagens,
    ocupado,
    cancelar,
    reenviar,
}: {
    texto: string;
    possuiImagens: boolean;
    ocupado: boolean;
    cancelar: () => void;
    reenviar: (texto: string) => Promise<boolean>;
}) {
    const [edicao, definirEdicao] = useState(texto);
    const [enviando, definirEnviando] = useState(false);
    const desativado = ocupado || enviando;

    async function salvar() {
        if (desativado || (!edicao.trim() && !possuiImagens)) return;
        definirEnviando(true);
        try {
            if (await reenviar(edicao)) cancelar();
        } finally {
            definirEnviando(false);
        }
    }

    return (
        <form
            data-ui="editor-mensagem"
            className="w-[min(600px,100%)] rounded-[12px] border border-borda bg-superficie p-[14px]"
            onSubmit={(evento) => {
                evento.preventDefault();
                void salvar();
            }}
        >
            <textarea
                aria-label="Editar mensagem"
                autoFocus
                rows={4}
                maxLength={30000}
                disabled={desativado}
                value={edicao}
                onChange={(evento) => definirEdicao(evento.target.value)}
                onKeyDown={(evento) => {
                    if (evento.nativeEvent.isComposing) return;
                    if (evento.key === 'Escape' && !desativado) cancelar();
                    if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
                        evento.preventDefault();
                        void salvar();
                    }
                }}
                className="w-full resize-y bg-transparent text-principal outline-none min-h-[100px] max-h-[300px]"
            />
            <p className="text-[11px] text-secundario mt-[8px] mb-[12px]">
                Ao reenviar, as mensagens seguintes serão substituídas.
            </p>
            <div className="flex justify-end gap-[10px] text-[12px]">
                <button
                    type="button"
                    disabled={desativado}
                    onClick={cancelar}
                    className="rounded-[7px] px-[12px] py-[7px] text-secundario hover:bg-hover disabled:opacity-50"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={desativado || (!edicao.trim() && !possuiImagens)}
                    className="rounded-[7px] px-[12px] py-[7px] bg-[#e0d8ef] text-[#251b38] disabled:opacity-50"
                >
                    Salvar e reenviar
                </button>
            </div>
        </form>
    );
}
