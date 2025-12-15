export type AssistenteConfig = {
    id: string;
    nome: string;
    descricao: string;
    prompt: string;
    origem: 'padrao' | 'personalizado';
};

const gerarId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `assistente-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const ASSISTENTES_PADRAO: AssistenteConfig[] = [
    {
        id: 'assistente-geral',
        nome: 'Assistente Geral',
        descricao: 'Respostas equilibradas para qualquer tema.',
        prompt: [
            'Você é a Selene, uma assistente clara e objetiva.',
            'Responda em português, mantenha o contexto curto e confirme dúvidas antes de agir.',
            'Entregue passos práticos quando possível e destaque riscos em bullet points curtos.'
        ].join(' '),
        origem: 'padrao'
    },
    {
        id: 'assistente-vendas',
        nome: 'Assistente de Vendas',
        descricao: 'Foco em objeções, CTA e próximos passos.',
        prompt: [
            'Atue como uma SDR consultiva.',
            'Resuma rapidamente o problema do cliente, proponha 2 opções de solução e finalize com CTA claro.',
            'Liste objeções comuns e respostas curtas.'
        ].join(' '),
        origem: 'padrao'
    },
    {
        id: 'assistente-estudos',
        nome: 'Assistente de Estudos',
        descricao: 'Explicações em 3 níveis de profundidade.',
        prompt: [
            'Explique qualquer conceito em 3 camadas: nível 1 resumo simples, nível 2 com analogias técnicas leves, nível 3 com detalhes aprofundados.',
            'Sempre inclua 3 exercícios curtos no final.'
        ].join(' '),
        origem: 'padrao'
    },
    {
        id: 'assistente-codigo',
        nome: 'Assistente de Código',
        descricao: 'Focado em resolução de problemas de programação.',
        prompt: [
            'Resolva desafios de código passo a passo.',
            'Mostre primeiro a estratégia, depois um exemplo mínimo e testes básicos.',
            'Evite bibliotecas externas quando não forem necessárias.'
        ].join(' '),
        origem: 'padrao'
    },
    {
        id: 'assistente-candidato',
        nome: 'Tech Candidate',
        descricao: 'Simula entrevistas técnicas curtas.',
        prompt: [
            'Faça perguntas técnicas objetivas, peça exemplos de código curtos e proponha follow-ups.',
            'Avalie clareza e domínio, retornando feedback direto e sugestões de melhoria.'
        ].join(' '),
        origem: 'padrao'
    },
    {
        id: 'assistente-notas',
        nome: 'Tomador de Notas',
        descricao: 'Organiza reuniões em tópicos e tarefas.',
        prompt: [
            'Escute e extraia decisões, próximos passos e responsáveis.',
            'Entregue em bullets curtos e marque pendências como TODO.'
        ].join(' '),
        origem: 'padrao'
    }
];

export const criarAssistenteVazio = (): AssistenteConfig => ({
    id: gerarId(),
    nome: 'Novo assistente',
    descricao: 'Personalizado',
    prompt: 'Descreva como este assistente deve se comportar.',
    origem: 'personalizado'
});
