import { afterEach, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esquemaConversa } from '../shared/contratos';
import { prepararPastaTrabalho } from '../electron/services/projetos';
import { prepararFerramenta } from '../electron/services/ferramentas';
import { Persistencia } from '../electron/services/persistencia';

const pastas: string[] = [];
afterEach(async () => {
    for (const pasta of pastas.splice(0)) await rm(pasta, { recursive: true, force: true });
});

test('conversas sem projeto isolam arquivos, exigem aprovação e retomam a mesma pasta', async () => {
    const dados = await mkdtemp(join(tmpdir(), 'selene-projetos-'));
    pastas.push(dados);
    const criar = () =>
        esquemaConversa.parse({
            id: randomUUID(),
            titulo: 'Sem projeto',
            modo: 'code',
            atualizadoEm: new Date().toISOString(),
        });
    const primeira = criar();
    const segunda = criar();
    const pasta = await prepararPastaTrabalho(primeira, dados);
    const outra = await prepararPastaTrabalho(segunda, dados);
    expect(pasta).not.toBe(outra);
    expect(primeira.projeto).toBeNull();
    const escrita = await prepararFerramenta(
        'escrever_arquivo',
        {
            caminho: 'exemplo.txt',
            conteudo: 'Persistente',
        },
        primeira,
    );
    expect(escrita.aprovacao).toBe(true);
    await escrita.executar(new AbortController().signal);
    expect(await readFile(join(pasta, 'exemplo.txt'), 'utf8')).toBe('Persistente');
    const leituraExterna = await prepararFerramenta(
        'ler_arquivo',
        {
            caminho: join(pasta, 'exemplo.txt'),
        },
        segunda,
    );
    await expect(leituraExterna.executar(new AbortController().signal)).rejects.toThrow('fora do projeto');
    const persistencia = new Persistencia(dados);
    persistencia.dados.conversas.push(primeira);
    await persistencia.salvar();
    const reaberta = new Persistencia(dados);
    await reaberta.abrir();
    expect(await prepararPastaTrabalho(reaberta.dados.conversas[0], dados)).toBe(pasta);
    const leitura = await prepararFerramenta('ler_arquivo', { caminho: 'exemplo.txt' }, primeira);
    expect(leitura.aprovacao).toBe(false);
    expect(await leitura.executar(new AbortController().signal)).toContain('Persistente');
    primeira.id = '../fora';
    await expect(prepararPastaTrabalho(primeira, dados)).rejects.toThrow();
});
