import { useState } from 'react';
import type { PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';
import { botaoSecundario, campo } from './PainelConfiguracoes';

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
        <div className="flex flex-col gap-2">
            <div className="flex gap-2 max-sm:flex-col">
                <input
                    type="password"
                    aria-label="Chave de API"
                    autoComplete="off"
                    value={chave}
                    disabled={ocupado || salvando}
                    placeholder={configurado ? 'Chave salva. Digite para substituir' : 'Cole sua chave de API'}
                    className={`${campo} min-w-0 flex-1`}
                    onChange={(evento) => {
                        definirChave(evento.target.value);
                        definirSalvou(false);
                    }}
                />
                <button
                    type="button"
                    disabled={ocupado || salvando || !chave.trim()}
                    className={botaoSecundario}
                    onClick={() => void salvar(chave.trim())}
                >
                    Salvar chave
                </button>
                {configurado && (
                    <button
                        type="button"
                        className="px-2 text-xs text-secundario hover:text-[#eab1aa] disabled:opacity-40"
                        disabled={ocupado || salvando}
                        onClick={() => void salvar('')}
                    >
                        Remover chave
                    </button>
                )}
            </div>
            {(salvando || salvou) && (
                <span role="status" className="text-xs text-discreto">
                    {salvando ? 'Salvando' : 'Chave atualizada'}
                </span>
            )}
        </div>
    );
}
