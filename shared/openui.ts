/** Descreve os componentes OpenUI disponíveis nas respostas. */
export const instrucaoOpenUI = `Quando o usuário pedir uma interface, produza somente um bloco openui.
Monte o conteúdo conforme o pedido atual, sem copiar o exemplo nem repetir painéis.
Em novos exemplos, varie o tema e os componentes. Não repita indicadores com o mesmo significado.
Demonstrações locais não precisam de pesquisa na web.
Todo bloco deve começar com root = Painel([...]), listando as variáveis dos componentes definidos abaixo.
Exemplo de sintaxe, não de conteúdo para a resposta:
\`\`\`openui
root = Painel([aviso, total])
aviso = Texto("Demonstração com dados fictícios")
total = Indicador("Pedidos", "42")
\`\`\`
Componentes: Texto(conteudo), Indicador(nome, valor), Grafico(titulo, nomes, valores), Pergunta(pergunta).
Grafico recebe nomes como lista de textos e valores como lista de números de mesmo tamanho.
Para dashboards, combine indicadores e gráficos relevantes. Inclua Pergunta somente se precisar de uma resposta.
Use dados fornecidos pelo usuário. Em demonstrações, identifique os dados como fictícios usando Texto.
Não invente dados como se fossem reais. Encerre após o bloco. Para código, use Markdown.`;

const tiposInterface = '(?:openui|opneui|interfaces?|dashboards?|graficos?|formularios?|paineis|painel)';
const padraoPedidoInterface = new RegExp(`\\b${tiposInterface}\\b`);
const padraoRecusaInterface = new RegExp(
    '\\b(?:sem|nao quero|n quero|nao mostre|nao gere)\\s+' + `(?:(?:uma?|mais|nenhuma?)\\s+)?${tiposInterface}\\b`,
);

/** Inclui o formato de interfaces quando o pedido atual trata dessa apresentação. */
export function instrucoesOpenUIParaPedido(pedido: string): string {
    const normalizado = pedido.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const solicitaInterface = padraoPedidoInterface.test(normalizado);
    const recusaInterface = padraoRecusaInterface.test(normalizado);
    const orientacao =
        'Responda ao pedido mais recente considerando o diálogo. Reconheça comentários sobre a resposta anterior. ' +
        'Pedidos antigos de interface não se aplicam ' +
        'automaticamente aos próximos turnos. Respostas a formulários devem ser reconhecidas em texto, ' +
        'sem reapresentar o formulário. Se o usuário pedir para parar, confirme brevemente em texto.';
    return solicitaInterface && !recusaInterface ? `${orientacao}\n\n${instrucaoOpenUI}` : orientacao;
}

/** Permite reapresentar uma interface quando o usuário pede explicitamente sua repetição. */
export function pedeRepeticaoInterface(pedido: string): boolean {
    const normalizado = pedido.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
    return /^(?:repita|repete|reenvie|reenvia|mostre novamente|mostra de novo)\b/.test(normalizado);
}

/** Identifica uma interface inteira reapresentada sem um pedido explícito de repetição. */
export function repeteInterfaceAnterior(texto: string, anterior: string, pedido: string): boolean {
    if (pedeRepeticaoInterface(pedido)) return false;
    const extrair = (conteudo: string) =>
        Array.from(conteudo.matchAll(/```openui\s*([\s\S]*?)```/g), (parte) =>
            parte[1]
                .trim()
                .split('\n')
                .map((linha) => linha.trim())
                .join('\n'),
        );
    const atuais = extrair(texto);
    const anteriores = new Set(extrair(anterior));
    const descricao = descreverInterfacesAnteriores(anterior).trim();
    if (
        anterior.includes('```openui') &&
        descricao.length >= 80 &&
        !descricao.includes('```') &&
        texto.includes(descricao)
    )
        return true;
    return atuais.length > 0 && atuais.every((bloco) => anteriores.has(bloco));
}

/** Preserva dados dos componentes sem reenviar seu código como exemplo de resposta. */
export function descreverInterfacesAnteriores(texto: string): string {
    const apresentadas = new Set<string>();
    return texto.replace(/```openui\s*([\s\S]*?)(?:```|$)/g, (_bloco, codigo: string) => {
        const dados = Array.from(
            codigo.matchAll(/^\s*\w+\s*=\s*(Texto|Indicador|Grafico|Pergunta)\((.*)\)\s*$/gm),
            (parte) => descreverComponente(parte[1], parte[2]),
        );
        const descricao = dados.length
            ? `Interface apresentada anteriormente:\n${[...new Set(dados)].join('\n')}`
            : 'Foi apresentada uma interface OpenUI.';
        if (apresentadas.has(descricao)) return '';
        apresentadas.add(descricao);
        return descricao;
    });
}

function descreverComponente(nome: string, argumentos: string): string {
    let valores: unknown[];
    try {
        valores = JSON.parse(`[${argumentos}]`) as unknown[];
    } catch {
        return `Dados anteriores de ${nome}: ${argumentos}`;
    }
    const [titulo, segundo, terceiro] = valores;
    if (nome === 'Texto' && typeof titulo === 'string') return titulo;
    if (nome === 'Pergunta' && typeof titulo === 'string') return `Pergunta feita: ${titulo}`;
    if (nome === 'Indicador' && typeof titulo === 'string' && typeof segundo === 'string') {
        return `${titulo}: ${segundo}.`;
    }
    if (
        nome === 'Grafico' &&
        typeof titulo === 'string' &&
        Array.isArray(segundo) &&
        Array.isArray(terceiro) &&
        segundo.every((item) => typeof item === 'string') &&
        terceiro.every((item) => typeof item === 'number') &&
        segundo.length === terceiro.length
    ) {
        return `Gráfico ${titulo}: ${segundo.map((item, indice) => `${item}: ${terceiro[indice]}`).join(', ')}.`;
    }
    return `Dados anteriores de ${nome}: ${argumentos}`;
}
