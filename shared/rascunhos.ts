import { esquemaConversa, type Conversa, type Estado } from './contratos';

/** Identifica conteúdo que merece permanecer acessível no histórico, mesmo antes do envio. */
export function possuiRascunho(conversa: Conversa): boolean {
    return !!conversa.rascunho?.trim() || !!conversa.anexosRascunho;
}

/** Combina o texto local com o histórico confirmado, sem substituir mensagens recebidas do agente. */
export function reunirRascunhos(estado: Estado, rascunhos: Conversa[]): Estado {
    const existentes = new Set(estado.conversas.map((item) => item.id));
    const textos = new Map(rascunhos.map((item) => [item.id, item.rascunho]));
    const anexos = new Map(rascunhos.map((item) => [item.id, item.anexosRascunho]));
    return {
        ...estado,
        projetos: estado.projetos.filter((item) => !item.oculto),
        conversas: [
            ...rascunhos.filter((item) => !existentes.has(item.id)),
            ...estado.conversas.map((item) =>
                textos.has(item.id)
                    ? { ...item, rascunho: textos.get(item.id), anexosRascunho: anexos.get(item.id) }
                    : item,
            ),
        ],
    };
}

/** Recupera somente dados válidos de composição, preservando versões anteriores em caso de erro. */
export function lerRascunhos(texto: string | null): Conversa[] {
    if (!texto) return [];
    return esquemaConversa.array().parse(JSON.parse(texto));
}
