import type { ToolHandler, ToolCallResult, ToolResultItem } from '../../../types/tools'
import { v4 as uuidv4 } from 'uuid'

interface MemoriaLocal {
    id: string
    content: string
    createdAt: number
}

/**
 * Handler para a ferramenta ask_user_input_v0. Solicita seleção de opções pelo usuário.
 */
export const askUserInputHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const pergunta = args.prompt as string
    const opcoes = args.options as string[]
    const multiplo = !!args.multiple

    if (!pergunta || !opcoes || !Array.isArray(opcoes) || opcoes.length === 0) {
        return { success: false, error: 'Os parâmetros "prompt" e "options" (lista não vazia) são obrigatórios.' }
    }

    const formattedForAI = `[Solicitação de Input do Usuário]:\n` +
        `Pergunta: "${pergunta}"\n` +
        `Opções apresentadas: ${opcoes.map((o, idx) => `[${idx + 1}] "${o}"`).join(', ')}\n` +
        `Aguardando interação do usuário na interface do chat.`

    const displayResults: ToolResultItem[] = [
        {
            type: 'json',
            title: 'Interação de Usuário Pendente',
            content: JSON.stringify({
                tipoWidget: 'escolha-opcoes',
                pergunta,
                opcoes,
                multiplo
            }, null, 2)
        }
    ]

    return {
        success: true,
        data: {
            status: 'aguardando_input',
            pergunta,
            opcoes,
            multiplo,
            formattedForAI,
            displayResults
        }
    }
}

/**
 * Handler para a ferramenta message_compose_v1. Rascunha mensagens ou abre o e-mail padrão do sistema.
 */
export const messageComposeHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const destinatario = args.recipient as string || ''
    const assunto = args.subject as string || ''
    const corpo = args.body as string
    const tipo = args.type as string || 'email' // 'email', 'slack', 'sms'

    if (!corpo) {
        return { success: false, error: 'O parâmetro "body" é obrigatório.' }
    }

    try {
        if (tipo === 'email' && window.electronAPI.openExternal) {
            // Constrói mailto link e abre o app de e-mail padrão do sistema
            const mailtoUrl = `mailto:${encodeURIComponent(destinatario)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`
            console.log('[MessageCompose] Abrindo aplicativo de email:', mailtoUrl)
            await window.electronAPI.openExternal(mailtoUrl)
        }

        const formattedForAI = `[Rascunho de ${tipo.toUpperCase()} criado]:\n` +
            (destinatario ? `Destinatário: ${destinatario}\n` : '') +
            (assunto ? `Assunto: ${assunto}\n` : '') +
            `Corpo:\n${corpo}`

        const displayResults: ToolResultItem[] = [
            {
                type: 'text',
                title: `Rascunho de ${tipo.toUpperCase()} Criado`,
                content: (destinatario ? `Para: ${destinatario}\n` : '') +
                    (assunto ? `Assunto: ${assunto}\n\n` : '') +
                    corpo
            }
        ]

        return {
            success: true,
            data: {
                tipo,
                destinatario,
                assunto,
                corpo,
                formattedForAI,
                displayResults
            }
        }
    } catch (erro: unknown) {
        return {
            success: false,
            error: erro instanceof Error ? erro.message : String(erro)
        }
    }
}

/**
 * Handler para a ferramenta recipe_display_v0. Retorna receita interativa.
 */
export const recipeDisplayHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const titulo = args.title as string
    const porcoes = Number(args.servings || 2)
    const ingredientes = args.ingredients as Array<{ name: string; quantity: number; unit: string }>
    const instrucoes = args.instructions as string[]

    if (!titulo || !ingredientes || !Array.isArray(ingredientes) || !instrucoes || !Array.isArray(instrucoes)) {
        return { success: false, error: 'Os parâmetros "title", "ingredients" (lista) e "instructions" (lista) são obrigatórios.' }
    }

    const formattedForAI = `[Receita Estruturada: ${titulo} (${porcoes} porções)]:\n` +
        `Ingredientes:\n` +
        ingredientes.map(i => `- ${i.quantity} ${i.unit} de ${i.name}`).join('\n') +
        `\n\nInstruções:\n` +
        instrucoes.map((ins, idx) => `${idx + 1}. ${ins}`).join('\n')

    const displayResults: ToolResultItem[] = [
        {
            type: 'json',
            title: `Receita: ${titulo}`,
            content: JSON.stringify({
                tipoWidget: 'receita',
                titulo,
                porcoes,
                ingredientes,
                instrucoes
            }, null, 2)
        }
    ]

    return {
        success: true,
        data: {
            titulo,
            porcoes,
            ingredientes,
            instrucoes,
            formattedForAI,
            displayResults
        }
    }
}

/**
 * Handler para a ferramenta memory_user_edits. Gerencia as memórias e dados pessoais guardados localmente.
 */
export const memoryUserEditsHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const acao = args.action as 'add' | 'remove' | 'list'
    const conteudo = args.content as string
    const id = args.id as string

    if (!acao) {
        return { success: false, error: 'O parâmetro "action" (add, remove ou list) é obrigatório.' }
    }

    try {
        const MEMORIES_KEY = 'selene_memories'
        const obterMemoriasLocais = (): MemoriaLocal[] => {
            const salvas = localStorage.getItem(MEMORIES_KEY)
            return salvas ? JSON.parse(salvas) : []
        }

        const salvarMemoriasLocais = (memorias: MemoriaLocal[]) => {
            localStorage.setItem(MEMORIES_KEY, JSON.stringify(memorias))
            // Dispara evento de storage para sincronizar em outros hooks do React
            window.dispatchEvent(new Event('storage'))
        }

        if (acao === 'add') {
            if (!conteudo) return { success: false, error: 'O parâmetro "content" é obrigatório para a ação "add".' }
            const memorias = obterMemoriasLocais()
            const novaMemoria = {
                id: uuidv4(),
                content: conteudo,
                createdAt: Date.now()
            }
            memorias.push(novaMemoria)
            salvarMemoriasLocais(memorias)

            const formattedForAI = `[Nova memória adicionada com sucesso]:\nID: ${novaMemoria.id}\nConteúdo: "${conteudo}"`
            return {
                success: true,
                data: {
                    novaMemoria,
                    formattedForAI,
                    displayResults: [{ type: 'text', title: 'Memória Adicionada', content: conteudo }]
                }
            }
        }

        if (acao === 'remove') {
            if (!id) return { success: false, error: 'O parâmetro "id" é obrigatório para a ação "remove".' }
            const memorias = obterMemoriasLocais()
            const filtradas = memorias.filter(m => m.id !== id)
            
            if (memorias.length === filtradas.length) {
                return { success: false, error: `Memória com o ID ${id} não foi encontrada.` }
            }

            salvarMemoriasLocais(filtradas)
            const formattedForAI = `[Memória removida com sucesso]: ID ${id}`
            return {
                success: true,
                data: {
                    idRemovido: id,
                    formattedForAI,
                    displayResults: [{ type: 'text', title: 'Memória Removida', content: `ID: ${id}` }]
                }
            }
        }

        // Caso padrão: list
        const memorias = obterMemoriasLocais()
        const formattedForAI = `[Lista de Memórias do Usuário (${memorias.length})]:\n` +
            (memorias.length > 0 
                ? memorias.map(m => `- ID: ${m.id} | Criado em: ${new Date(m.createdAt).toLocaleDateString()} | Conteúdo: "${m.content}"`).join('\n')
                : 'Nenhuma memória cadastrada no momento.')

        const displayResults: ToolResultItem[] = [
            {
                type: 'json',
                title: `Memórias Cadastradas (${memorias.length})`,
                content: JSON.stringify(memorias, null, 2)
            }
        ]

        return {
            success: true,
            data: {
                memorias,
                formattedForAI,
                displayResults
            }
        }

    } catch (erro: unknown) {
        return {
            success: false,
            error: erro instanceof Error ? erro.message : String(erro)
        }
    }
}
