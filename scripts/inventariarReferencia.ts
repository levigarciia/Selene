import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const referencia = process.env.SELENE_ODYSSEUS ?? 'D:/Saas/odysseus-dev';
async function listarPython(pasta: string): Promise<string[]> {
    const arquivos: string[] = [];
    for (const entrada of await readdir(join(referencia, pasta), { withFileTypes: true })) {
        const caminho = `${pasta}/${entrada.name}`;
        if (entrada.isDirectory()) arquivos.push(...(await listarPython(caminho)));
        else if (entrada.isFile() && entrada.name.endsWith('.py')) arquivos.push(caminho);
    }
    return arquivos.sort();
}
const modulos: {
    modulo: string;
    sha256: string;
    operacoes: { metodo: string; caminho: string }[];
}[] = [];
for (const caminho of await listarPython('routes')) {
    const conteudo = await readFile(join(referencia, caminho), 'utf8');
    const padrao = /@[\w.]+\.(get|post|put|patch|delete|websocket)\(\s*["']([^"']+)/g;
    const operacoes = [...conteudo.matchAll(padrao)].map((item) => ({
        metodo: item[1].toUpperCase(),
        caminho: item[2],
    }));
    if (operacoes.length)
        modulos.push({
            modulo: caminho,
            sha256: createHash('sha256').update(conteudo).digest('hex'),
            operacoes,
        });
}
await writeFile(
    'docs/REFERENCIA_ODYSSEUS.json',
    JSON.stringify(
        {
            referencia,
            inspecionadoEm: new Date().toISOString().slice(0, 10),
            observacao:
                'Declarações estáticas nos arquivos canônicos, incluindo subpastas. ' +
                'Consulte prefixos e fábricas de roteadores; a contagem não representa todas as rotas em execução.',
            modulos,
        },
        null,
        4,
    ) + '\n',
);
console.log(
    `${modulos.length} módulos e ${modulos.reduce((total, modulo) => total + modulo.operacoes.length, 0)} operações.`,
);
