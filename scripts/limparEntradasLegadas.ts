import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { esquemaDados } from '../shared/contratos';
import { descartarEntradasLegadas } from '../shared/limpezaUso';

const caminho = process.argv[2];
if (!caminho) throw new Error('Informe o caminho de selene.json, com a Selene fechada.');
const destino = resolve(caminho);
const original = await readFile(destino, 'utf8');
const bruto = JSON.parse(original);
const dados = esquemaDados.parse(bruto);
if (dados.conversas.some((conversa) => conversa.mensagens.some((mensagem) => mensagem.estado === 'gerando'))) {
    throw new Error('Encerre a geração e feche a Selene antes da limpeza.');
}
const resultado = descartarEntradasLegadas(dados);
if (!resultado.registros) {
    console.log('Nenhuma entrada legada para descartar.');
    process.exit(0);
}
const instante = new Date().toISOString().replace(/[:.]/g, '');
const backup = `${destino}.antesLimpezaEntrada.${instante}.json`;
await writeFile(backup, original, { flag: 'wx' });
const conversas = new Map(dados.conversas.map((conversa) => [conversa.id, conversa]));
for (const conversa of bruto.conversas) {
    const limpa = conversas.get(conversa.id);
    if (!limpa) continue;
    const mensagens = new Map(limpa.mensagens.map((mensagem) => [mensagem.id, mensagem]));
    for (const mensagem of conversa.mensagens) {
        const corrigida = mensagens.get(mensagem.id);
        if (corrigida?.desempenho && mensagem.desempenho) {
            mensagem.desempenho = { ...mensagem.desempenho, ...corrigida.desempenho };
            if (corrigida.desempenho.tokensEntrada === undefined) delete mensagem.desempenho.tokensEntrada;
            if (corrigida.desempenho.tokensEntradaCache === undefined) delete mensagem.desempenho.tokensEntradaCache;
        }
    }
}
bruto.registrosUso = dados.registrosUso;
bruto.entradasUsoDescartadas = dados.entradasUsoDescartadas;
esquemaDados.parse(bruto);
const temporario = `${destino}.limpeza.tmp`;
await writeFile(temporario, JSON.stringify(bruto, null, 4), { flag: 'wx' });
if ((await readFile(destino, 'utf8')) !== original) {
    throw new Error('Os dados mudaram durante a limpeza. O original foi preservado; feche a Selene e tente novamente.');
}
await rename(temporario, destino);
console.log(JSON.stringify({ ...resultado, backup }));
