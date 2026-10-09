export type EstadoAtualizacao = {
    versaoAtual: string;
    fase: 'desativada' | 'aguardando' | 'verificando' | 'atualizada' | 'baixando' | 'pronta' | 'reiniciando' | 'erro';
    versaoNova?: string;
    progresso?: number;
    erro?: string;
    notas?: NotaRelease[];
    releasesOmitidas?: number;
};

export type NotaRelease = { versao: string; itens: string[]; total: number };

function limparTexto(texto: string): string {
    const entidades: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    return texto
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<li\b[^>]*>|<br\s*\/?>|<\/(?:p|div|li|h[1-6])>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&([a-z]+|#\d+|#x[\da-f]+);/gi, (original, entidade: string) => {
            if (!entidade.startsWith('#')) return entidades[entidade] ?? original;
            const numero = entidade.startsWith('#x')
                ? Number.parseInt(entidade.slice(2), 16)
                : Number.parseInt(entidade.slice(1), 10);
            return numero >= 0 && numero <= 0x10ffff ? String.fromCodePoint(numero) : original;
        })
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_`]/g, '');
}

/** Converte notas recebidas do atualizador em resumos seguros e limitados para a sidebar. */
export function normalizarNotasRelease(
    entrada: unknown,
    versao: string,
): {
    notas: NotaRelease[];
    releasesOmitidas: number;
} {
    const grupos = typeof entrada === 'string' ? [{ version: versao, note: entrada }] : entrada;
    if (!Array.isArray(grupos)) return { notas: [], releasesOmitidas: 0 };
    const notas: NotaRelease[] = [];
    const versoes = new Set<string>();
    for (const grupo of grupos) {
        if (
            !grupo ||
            typeof grupo !== 'object' ||
            typeof grupo.version !== 'string' ||
            typeof grupo.note !== 'string' ||
            !/^\d+\.\d+\.\d+(?:[+\-][\w.\-]+)?$/.test(grupo.version) ||
            versoes.has(grupo.version)
        )
            continue;
        const itens = limparTexto(grupo.note.slice(0, 100000))
            .split('\n')
            .map((linha) =>
                linha
                    .trim()
                    .replace(/^(?:[-+]\s+|\d+[.)]\s+)/, '')
                    .replace(/\s+/g, ' '),
            )
            .filter(
                (linha) =>
                    linha &&
                    !/^#{1,6}\s|^novidades$|^what.?s changed$|^full changelog|^compare:|^consulte.*alterações completas/i.test(
                        linha,
                    ),
            );
        if (!itens.length) continue;
        versoes.add(grupo.version);
        notas.push({
            versao: grupo.version,
            itens: itens.slice(0, 8).map((item) => (item.length > 220 ? `${item.slice(0, 217)}...` : item)),
            total: itens.length,
        });
    }
    notas.sort((a, b) => b.versao.localeCompare(a.versao, 'en', { numeric: true }));
    return { notas: notas.slice(0, 6), releasesOmitidas: Math.max(0, notas.length - 6) };
}

/** Identifica a página oficial de uma release sem aceitar destinos externos do renderer. */
export function urlRelease(versao?: string): string {
    const raiz = 'https://github.com/levigarciia/Selene/releases';
    if (!versao) return raiz;
    if (!/^\d+\.\d+\.\d+(?:[+\-][\w.\-]+)?$/.test(versao)) throw new Error('Versão de release inválida.');
    return `${raiz}/tag/v${versao}`;
}

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
            return `Versão ${estado.versaoNova} pronta. Clique para reiniciar e atualizar.`;
        case 'reiniciando':
            return 'Salvando dados e reiniciando para atualizar.';
        case 'erro':
            return `Não foi possível atualizar: ${estado.erro}`;
    }
}
