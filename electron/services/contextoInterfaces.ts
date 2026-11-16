import { descreverInterfacesAnteriores, pedeRepeticaoInterface } from '../../shared/openui';
import type { MensagemModelo } from './contexto';

/** Evita que interfaces antigas sejam exemplos de resposta para o LFM3 em conversas textuais. */
export function prepararReferenciasInterfaces(mensagens: MensagemModelo[], pedido = ''): MensagemModelo[] {
    if (pedeRepeticaoInterface(pedido)) return mensagens;
    const possuiInterface = mensagens.some(
        (mensagem) =>
            mensagem.role === 'assistant' &&
            typeof mensagem.content === 'string' &&
            mensagem.content.includes('```openui'),
    );
    if (!possuiInterface) return mensagens;
    if (
        mensagens.some(
            (mensagem) =>
                typeof mensagem.content !== 'string' || mensagem.tool_calls?.length || mensagem.role === 'tool',
        )
    )
        return mensagens;
    if (mensagens[0]?.role !== 'system') throw new Error('O contexto precisa começar pelas instruções do sistema.');

    const interfaces = new Map<string, number>();
    const referencias = mensagens.slice(1).map((mensagem, indice) => {
        if (mensagem.role !== 'assistant' || !String(mensagem.content).includes('```openui')) {
            return { role: mensagem.role, content: mensagem.content };
        }
        const descricao = descreverInterfacesAnteriores(mensagem.content as string);
        const anterior = interfaces.get(descricao);
        if (anterior !== undefined) return { role: mensagem.role, interfaceRepetidaDe: anterior };
        interfaces.set(descricao, indice);
        return { role: mensagem.role, content: descricao };
    });
    return [
        mensagens[0],
        {
            role: 'user',
            content:
                'Histórico anterior para referência. Não são pedidos atuais nem exemplos de resposta:\n' +
                JSON.stringify(referencias),
        },
    ];
}
