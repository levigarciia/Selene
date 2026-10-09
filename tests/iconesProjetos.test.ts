import { expect, test } from 'bun:test';
import { esquemaIconeProjeto } from '../shared/iconesProjetos';
import { esquemaProjeto } from '../shared/contratos';
import { randomUUID } from 'node:crypto';

test('ícones de projeto recusam fontes externas, SVG, símbolos e cores desconhecidos', () => {
    for (const icone of [
        { tipo: 'imagem', dados: 'https://servidor/imagem.png' },
        { tipo: 'imagem', dados: 'data:image/svg+xml;base64,PHN2Zz4=' },
        { tipo: 'simbolo', nome: 'desconhecido', cor: 'verde' },
        { tipo: 'simbolo', nome: 'pasta', cor: 'desconhecida' },
        { tipo: 'iniciais', texto: '   ', cor: 'verde' },
        { tipo: 'iniciais', texto: 'ABCD', cor: 'verde' },
    ])
        expect(esquemaIconeProjeto.safeParse(icone).success).toBe(false);
});

test('cadastros antigos continuam válidos e a identidade personalizada sobrevive à serialização', () => {
    const projeto = esquemaProjeto.parse({
        id: randomUUID(),
        nome: 'Exemplo',
        caminho: 'D:/Projetos/Exemplo',
        criadoEm: new Date().toISOString(),
    });
    expect(projeto.icone).toBeUndefined();
    projeto.icone = { tipo: 'simbolo', nome: 'cubo', cor: 'azul' };
    expect(esquemaProjeto.parse(JSON.parse(JSON.stringify(projeto))).icone).toEqual(projeto.icone);
});
