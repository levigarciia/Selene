import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assinaturaCompletar } from '../electron/services/assinaturas';
import { receberResposta } from '../electron/services/streaming';

const pasta = await mkdtemp(join(tmpdir(), 'selene-chat-seguro-'));
const segredo = randomUUID();
await writeFile(join(pasta, 'segredo.txt'), segredo);
const controle = new AbortController();
const prazo = setTimeout(() => controle.abort(), 120000);
let sessao: string | undefined;
const sessoes: string[] = [];
const resultado: { estado?: string; ferramentas: number } = { ferramentas: 0 };
try {
    for (const texto of [
        'Leia segredo.txt na pasta atual usando suas ferramentas e diga o conteúdo exato. ' +
            'Se ferramentas estiverem indisponíveis, diga isso. Não invente conteúdo.',
        'Sem usar ferramentas, diga quanto é 2 + 2.',
    ]) {
        const resposta = await assinaturaCompletar(
            { provedor: 'claude', id: 'sonnet' },
            {
                messages: [{ role: 'user', content: texto }],
            },
            controle.signal,
            {
                modo: 'chat',
                pasta,
                sessao,
                aoSessao: async (id) => {
                    sessao = id;
                    sessoes.push(id);
                },
                acoes: {
                    iniciar: () => {
                        resultado.ferramentas++;
                    },
                    aprovar: async () => false,
                    concluir: () => {},
                    capturarAntes: async () => {},
                    capturarDepois: async () => {},
                    capturaParcial: () => {},
                },
            },
        );
        const recebida = await receberResposta(resposta, controle.signal, () => {});
        assert(!recebida.texto.includes(segredo));
        assert(recebida.texto.trim());
    }
    assert.equal(resultado.ferramentas, 0);
    assert.equal(sessoes.length, 2);
    assert.equal(sessoes[0], sessoes[1]);
    resultado.estado = 'Chat sem ferramentas e retomada Claude validados';
} catch (erro) {
    resultado.estado = erro instanceof Error ? erro.message : String(erro);
    controle.abort();
    process.exitCode = 1;
} finally {
    clearTimeout(prazo);
    await writeFile(resolve('artifacts/auditoria20261115/claudeReal.json'), JSON.stringify(resultado, null, 4));
    console.log(JSON.stringify(resultado));
}
