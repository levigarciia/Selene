import { describe, expect, test } from 'vitest'
import { selecionarMemoriasManuais } from '../UserMemorySearch'

const perfil = {
    name: 'Levi',
    occupation: 'Designer e programador',
    aboutMe: 'Trabalha com interfaces e aplicações desktop.',
}

const memorias = [
    { content: 'Prefere respostas curtas e diretas.' },
    { content: 'Usa azul como cor principal do produto.' },
]

describe('selecionarMemoriasManuais', () => {
    test('não injeta perfil em uma saudação comum', () => {
        expect(selecionarMemoriasManuais('Oi Selene!', perfil, memorias)).toBe('')
    })

    test('retorna o perfil quando o usuário pergunta o que é lembrado', () => {
        const resultado = selecionarMemoriasManuais('O que você sabe sobre mim?', perfil, memorias)

        expect(resultado).toContain('Nome preferido: Levi')
        expect(resultado).toContain('Ocupação: Designer e programador')
        expect(resultado).toContain('Prefere respostas curtas e diretas.')
    })

    test('não retorna ocupação em uma busca por preferência de resposta', () => {
        const resultado = selecionarMemoriasManuais('Como eu gosto das respostas?', perfil, memorias)

        expect(resultado).toContain('Prefere respostas curtas e diretas.')
        expect(resultado).not.toContain('Designer e programador')
    })
})
