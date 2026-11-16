import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assinaturaCompletar } from '../electron/services/assinaturas';
import { receberResposta } from '../electron/services/streaming';

const arquivo = process.argv[2];
assert(arquivo, 'Informe a imagem verde produzida pelo teste isolado de acesso web.');
const pasta = resolve('.teste-dados', 'visao-codex');
await mkdir(pasta, { recursive: true });
const imagem = (await readFile(arquivo)).toString('base64');
const controle = new AbortController();
const prazo = setTimeout(() => controle.abort(), 120000);
try {
    const resposta = await assinaturaCompletar({ provedor: 'chatgpt', id: 'gpt-6.1-sol' }, {
        messages: [{ role: 'user', content: [
            { type: 'text', text: 'Qual é a cor predominante desta imagem? Responda somente com a cor, sem ferramentas.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imagem}` } },
        ] }],
    }, controle.signal, { modo: 'code', pasta });
    const resultado = await receberResposta(resposta, controle.signal, () => {});
    assert.match(resultado.texto, /verde|green/i);
    await writeFile(resolve('artifacts/auditoria20261115/imagemReal.json'),
        JSON.stringify({ estado: 'passou', resposta: resultado.texto }, null, 4));
    console.log('Anexo visual reconhecido pelo Codex real.');
} finally {
    controle.abort();
    clearTimeout(prazo);
}
