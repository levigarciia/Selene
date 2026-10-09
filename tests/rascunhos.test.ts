import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { esquemaConversa, esquemaDados, type Estado } from '../shared/contratos';
import { lerRascunhos, possuiRascunho, reunirRascunhos } from '../shared/rascunhos';
import { agruparHistorico, obterAtividadeConversa } from '../shared/historico';

const criar = () =>
    esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Composição',
        modo: 'chat',
        atualizadoEm: new Date().toISOString(),
    });

test('somente rascunhos com conteúdo aparecem no histórico', () => {
    const vazia = criar();
    const texto = { ...criar(), rascunho: 'Texto não enviado' };
    const espacos = { ...criar(), rascunho: ' \n\t ' };
    const imagem = { ...criar(), anexosRascunho: 1 };
    expect(possuiRascunho(espacos)).toBe(false);
    const grupos = agruparHistorico([vazia, espacos, texto, imagem], 'chat', null);
    expect(
        grupos
            .flatMap((item) => item.itens)
            .map((item) => item.id)
            .sort(),
    ).toEqual([texto.id, imagem.id].sort());
    expect(obterAtividadeConversa(texto, null).nome).toBe('Rascunho');
});

test('a promoção não duplica a sidebar nem sobrescreve mensagens confirmadas', () => {
    const rascunho = { ...criar(), rascunho: 'Próxima mensagem' };
    const confirmada = {
        ...rascunho,
        rascunho: undefined,
        mensagens: [
            {
                id: randomUUID(),
                papel: 'assistant' as const,
                texto: 'Resposta real',
                estado: 'concluida' as const,
                criadoEm: new Date().toISOString(),
                acoes: [],
            },
        ],
    };
    const estado: Estado = {
        ...esquemaDados.parse({ versao: 1, configuracao: {}, modelos: [], conversas: [confirmada] }),
        motor: { fase: 'desligado', detalhe: '', instalado: { cpu: false, vulkan: false, rocm: false } },
        conversaEmExecucao: null,
        downloads: [],
    };
    const combinado = reunirRascunhos(estado, [rascunho]);
    expect(combinado.conversas).toHaveLength(1);
    expect(combinado.conversas[0].mensagens[0].texto).toBe('Resposta real');
    expect(combinado.conversas[0].rascunho).toBe('Próxima mensagem');
    expect(reunirRascunhos(estado, []).conversas[0].rascunho).toBeUndefined();
    expect(lerRascunhos(JSON.stringify([rascunho]))[0].rascunho).toBe('Próxima mensagem');
    expect(() => lerRascunhos('{inválido')).toThrow();
});
