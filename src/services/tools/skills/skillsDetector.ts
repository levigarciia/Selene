import { SKILLS_DATA } from './skillsData'

/**
 * Normaliza um texto para facilitar a busca por correspondências.
 * Remove acentos, caracteres especiais e converte para letras minúsculas.
 */
function normalizarTexto(texto: string): string {
    return (texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^\w\s]/g, ' ')       // Substitui pontuação por espaço
        .replace(/\s+/g, ' ')            // Remove múltiplos espaços seguidos
        .trim()
}

/**
 * Detecta quais Habilidades (Skills) são relevantes para a mensagem do usuário.
 * Retorna as diretrizes em Markdown das skills ativas.
 * 
 * @param mensagemUsuario Mensagem que o usuário enviou ao chat.
 * @returns String formatada em Markdown com as diretrizes das skills ativas, ou string vazia se nenhuma for relevante.
 */
export function detectarSkillsRelevantes(mensagemUsuario: string): string {
    const mensagemNormalizada = normalizarTexto(mensagemUsuario)
    if (!mensagemNormalizada) return ''

    const skillsAtivas: string[] = []

    for (const chave in SKILLS_DATA) {
        const skill = SKILLS_DATA[chave]
        // Verifica se alguma palavra-chave da skill está presente na mensagem do usuário
        const corresponde = skill.palavrasChave.some(palavraChave => {
            const palavraChaveNormalizada = normalizarTexto(palavraChave)
            // Busca por palavra exata ou correspondência no texto
            return mensagemNormalizada.includes(palavraChaveNormalizada)
        })

        if (corresponde) {
            skillsAtivas.push(skill.diretrizes)
        }
    }

    if (skillsAtivas.length === 0) {
        return ''
    }

    let resultado = '\n\n---\n📌 **DIRETRIZES DE BOAS PRÁTICAS (SKILLS ATIVAS)**\n'
    resultado += 'Para responder à solicitação do usuário e executar as tarefas correlacionadas, leia e siga estritamente as melhores práticas abaixo:\n\n'
    resultado += skillsAtivas.join('\n\n')
    resultado += '\n\n---\n'

    console.log(`[SkillsDetector] Habilidades ativadas: ${skillsAtivas.length}`)
    return resultado
}
