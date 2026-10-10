import { useState } from 'react';
import type { PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';

/** Permite substituir ou remover a credencial sem devolver a chave salva à interface. */
export function ConfiguracaoOpenRouter({
    configurado,
    ocupado,
    ponte,
    executar,
}: {
    configurado: boolean;
    ocupado: boolean;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    const [chave, definirChave] = useState('');
    const [salvando, definirSalvando] = useState(false);
    const [salvou, definirSalvou] = useState(false);
    async function salvar(valor: string) {
        definirSalvando(true);
        definirSalvou(false);
        try {
            await executar(async () => {
                const resultado = await ponte!.configurarOpenRouter(valor);
                if (resultado.ok) {
                    definirChave('');
                    definirSalvou(true);
                }
                return resultado;
            });
        } finally {
            definirSalvando(false);
        }
    }
    return (
        <fieldset className="flex flex-col gap-3 border-t border-borda pt-5">
            <legend className="text-sm">OpenRouter</legend>
            <label>
                Chave de API
                <input
                    type="password"
                    autoComplete="off"
                    value={chave}
                    disabled={ocupado || salvando}
                    placeholder={configurado ? 'Chave salva. Digite para substituir' : 'Cole sua chave de API'}
                    onChange={(evento) => {
                        definirChave(evento.target.value);
                        definirSalvou(false);
                    }}
                />
            </label>
            <div className="flex items-center gap-3 text-xs">
                <button
                    type="button"
                    disabled={ocupado || salvando || !chave.trim()}
                    className="rounded-md bg-hover px-3 py-2 disabled:opacity-40"
                    onClick={() => void salvar(chave.trim())}
                >
                    Salvar chave
                </button>
                {configurado && (
                    <button type="button" disabled={ocupado || salvando} onClick={() => void salvar('')}>
                        Remover chave
                    </button>
                )}
                <span role="status" className="text-secundario">
                    {salvando ? 'Salvando' : salvou ? 'Chave atualizada' : configurado ? 'Configurado' : ''}
                </span>
            </div>
        </fieldset>
    );
}
