import { areSimilar } from './MemoryExtractor'

interface PerfilUsuarioSalvo {
    name?: string
    occupation?: string
    aboutMe?: string
}

interface MemoriaManualSalva {
    content?: string
}

const CHAVE_PERFIL = 'selene_user_profile'
const CHAVE_MEMORIAS = 'selene_memories'

function lerJson<T>(chave: string, fallback: T): T {
    try {
        const valor = globalThis.localStorage?.getItem(chave)
        return valor ? JSON.parse(valor) as T : fallback
    } catch {
        return fallback
    }
}

function normalizar(texto: string): string {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function buscaPerfilCompleto(consulta: string): boolean {
    return /(o que|quanto|tudo).*(sabe|lembra).*(sobre mim|de mim)|quem sou|meu perfil/.test(consulta)
}

function ehRelevante(consulta: string, conteudo: string): boolean {
    if (!conteudo.trim()) return false
    if (areSimilar(consulta, conteudo, 0.25)) return true

    const termosConsulta = new Set(normalizar(consulta).split(' ').filter((termo) => termo.length >= 5))
    return normalizar(conteudo)
        .split(' ')
        .some((termo) => termo.length >= 5 && termosConsulta.has(termo))
}

/** Recupera somente dados pessoais relacionados à consulta atual. */
export function selecionarMemoriasManuais(
    consulta: string,
    perfil: PerfilUsuarioSalvo,
    memorias: MemoriaManualSalva[]
): string {
    const consultaNormalizada = normalizar(consulta)
    if (!consultaNormalizada) return ''

    const incluirTudo = buscaPerfilCompleto(consultaNormalizada)
    const linhas: string[] = []
    const nome = perfil.name?.trim() || ''
    const ocupacao = perfil.occupation?.trim() || ''
    const sobre = perfil.aboutMe?.trim() || ''

    if (nome && (incluirTudo || /\b(nome|chamar|quem sou)\b/.test(consultaNormalizada))) {
        linhas.push(`Nome preferido: ${nome}`)
    }
    if (ocupacao && (incluirTudo || /\b(profissao|ocupacao|trabalho|carreira)\b/.test(consultaNormalizada) ||
        ehRelevante(consultaNormalizada, ocupacao))) {
        linhas.push(`Ocupação: ${ocupacao}`)
    }
    if (sobre && (incluirTudo || ehRelevante(consultaNormalizada, sobre))) {
        linhas.push(`Sobre o usuário: ${sobre}`)
    }

    for (const memoria of memorias) {
        const conteudo = memoria.content?.trim() || ''
        if (conteudo && (incluirTudo || ehRelevante(consultaNormalizada, conteudo))) {
            linhas.push(`Memória: ${conteudo}`)
        }
    }

    return linhas.join('\n')
}

export function buscarMemoriasManuais(consulta: string): string {
    const perfil = lerJson<PerfilUsuarioSalvo>(CHAVE_PERFIL, {})
    const memorias = lerJson<MemoriaManualSalva[]>(CHAVE_MEMORIAS, [])
    return selecionarMemoriasManuais(consulta, perfil, memorias)
}
