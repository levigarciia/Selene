import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { buscarConversas } from '../shared/buscaConversas';
import { obterFerramentas } from '../electron/services/ferramentas';
import type { Conversa } from '../shared/contratos';

function conversa(titulo: string, modo: Conversa['modo'], ...textos: string[]): Conversa {
    return {
        id: randomUUID(),
        titulo,
        modo,
        projeto: null,
        acessoCompleto: false,
        modeloId: null,
        atualizadoEm: '2026-10-01T12:00:00.000Z',
        mensagens: textos.map((texto, indice) => ({
            id: randomUUID(),
            papel: indice % 2 ? 'assistant' : 'user',
            texto,
            estado: 'concluida',
            acoes: [],
            criadoEm: '2026-10-01T12:00:00.000Z',
        })),
    };
}

describe('busca em conversas', () => {
    const viagem = conversa('Viagem', 'chat', 'Quero conhecer Lisboa em dezembro', 'Lisboa é ótima no inverno.');
    const receita = conversa('Receita', 'chat', 'Como fazer pão de fermentação natural?');
    const codigo = conversa('Refatoração', 'code', 'Refatore Lisboa.ts');

    test('encontra trechos relevantes com título e data', () => {
        const resultado = buscarConversas('viagem para lisboa', [viagem, receita], randomUUID());
        expect(resultado).toContain('* Viagem (2026-10-01)');
        expect(resultado).toContain('usuário: Quero conhecer Lisboa em dezembro');
        expect(resultado).not.toContain('Receita');
    });

    test('ignora a conversa atual e as conversas Code', () => {
        const resultado = buscarConversas('Lisboa', [viagem, codigo], viagem.id);
        expect(resultado).toBe('Nenhuma conversa anterior menciona "Lisboa".');
    });

    test('é oferecida somente no modo Chat', () => {
        const nomes = (modo: Conversa['modo']) =>
            obterFerramentas(modo, true, true, true, true).map((item) => item.function.name);
        expect(nomes('chat')).toContain('buscar_conversas');
        expect(nomes('code')).not.toContain('buscar_conversas');
    });
});
