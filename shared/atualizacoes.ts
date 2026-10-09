export type EstadoAtualizacao = {
    versaoAtual: string;
    fase: 'desativada' | 'aguardando' | 'verificando' | 'atualizada' | 'baixando' | 'pronta' | 'erro';
    versaoNova?: string;
    progresso?: number;
    erro?: string;
};

/** Use nas configurações para apresentar o andamento da distribuição do aplicativo. */
export function descreverAtualizacao(estado: EstadoAtualizacao): string {
    switch (estado.fase) {
        case 'desativada':
            return 'Atualizações disponíveis na versão instalada.';
        case 'aguardando':
            return 'Atualizações automáticas ativas.';
        case 'verificando':
            return 'Buscando atualizações.';
        case 'atualizada':
            return 'Você está usando a versão mais recente.';
        case 'baixando':
            return `Baixando versão ${estado.versaoNova}: ${Math.round(estado.progresso ?? 0)}%.`;
        case 'pronta':
            return `Versão ${estado.versaoNova} pronta. Será instalada ao fechar a Selene.`;
        case 'erro':
            return `Não foi possível atualizar: ${estado.erro}`;
    }
}
