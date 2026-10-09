import type { Conversa, Mensagem } from '../../shared/contratos';

/** Localiza o pedido original para substituir uma resposta do modelo no chat. */
export function obterPedidoParaRegerarChat(conversa: Conversa, mensagemId: string): Mensagem {
    if (conversa.modo !== 'chat') throw new Error('A regeneração está disponível somente no modo chat.');
    const indice = conversa.mensagens.findIndex((mensagem) => mensagem.id === mensagemId);
    const resposta = conversa.mensagens[indice];
    if (!resposta || resposta.papel !== 'assistant' || resposta.estado === 'gerando') {
        throw new Error('Escolha uma resposta encerrada para regerar.');
    }
    const pedido = conversa.mensagens
        .slice(0, indice)
        .reverse()
        .find((mensagem) => mensagem.papel === 'user');
    if (!pedido) throw new Error('Não foi encontrado o pedido original desta resposta.');
    return pedido;
}

/** Prepara a continuação de um chat a partir de uma mensagem corrigida pelo usuário. */
export function prepararReenvioChat(conversa: Conversa, mensagemId: string, texto: string): Conversa {
    if (conversa.modo !== 'chat') throw new Error('A edição de mensagens está disponível somente no modo chat.');
    if (texto.length > 30000) throw new Error('A mensagem deve ter até 30000 caracteres.');
    const indice = conversa.mensagens.findIndex((mensagem) => mensagem.id === mensagemId);
    const mensagem = conversa.mensagens[indice];
    if (!mensagem || mensagem.papel !== 'user') throw new Error('Escolha uma mensagem do usuário para editar.');
    if (!texto.trim() && !mensagem.imagens?.length) throw new Error('Escreva uma mensagem ou mantenha uma imagem.');
    const preparada = structuredClone(conversa);
    preparada.mensagens = preparada.mensagens.slice(0, indice + 1);
    preparada.mensagens[indice].texto = texto.trim();
    delete preparada.contextoCompactado;
    return preparada;
}
