import { readdir } from 'node:fs/promises';

const versao = process.env.SELENE_VERSAO;
const commit = process.env.GITHUB_SHA;
const repositorio = process.env.GITHUB_REPOSITORY;
if (!versao || !/^1\.0\.\d+$/.test(versao) || !commit || repositorio !== 'levigarciia/Selene') {
    throw new Error('Contexto de publicação inválido.');
}
const tag = `v${versao}`;

async function executar(argumentos: string[]): Promise<string> {
    const processo = Bun.spawn(['gh', ...argumentos], { stdout: 'pipe', stderr: 'pipe' });
    const [saida, erro, codigo] = await Promise.all([
        new Response(processo.stdout).text(),
        new Response(processo.stderr).text(),
        processo.exited,
    ]);
    if (codigo !== 0) throw new Error(erro || `GitHub CLI encerrou com código ${codigo}.`);
    return saida;
}

const arquivos = (await readdir('release'))
    .filter((nome) => nome.endsWith('.exe') || nome.endsWith('.blockmap') || nome === 'latest.yml')
    .map((nome) => `release/${nome}`);
if (arquivos.length !== 3) throw new Error('A distribuição precisa de instalador, blockmap e latest.yml.');
await Bun.write(
    'release/notas.md',
    `Distribuição automática da Selene para Windows x64.\n\n` +
        `Código publicado: ${commit}.\n\n` +
        `Instale o arquivo Selene Setup para receber as próximas atualizações automaticamente.\n` +
        `A versão anterior permanece na branch [old](https://github.com/${repositorio}/tree/old).\n` +
        `Os dados antigos permanecem no computador, sem migração automática para esta versão.\n`,
);
const consulta = Bun.spawn(['gh', 'release', 'view', tag, '--json', 'isDraft'], { stdout: 'pipe', stderr: 'pipe' });
const [conteudo, erroConsulta, codigoConsulta] = await Promise.all([
    new Response(consulta.stdout).text(),
    new Response(consulta.stderr).text(),
    consulta.exited,
]);
if (codigoConsulta === 0) {
    if (!JSON.parse(conteudo).isDraft) {
        console.log(`A release ${tag} já está publicada.`);
        process.exit(0);
    }
} else {
    if (!erroConsulta.includes('release not found')) throw new Error(erroConsulta);
    await executar([
        'release',
        'create',
        tag,
        '--draft',
        '--target',
        commit,
        '--title',
        `Selene ${versao}`,
        '--notes-file',
        'release/notas.md',
    ]);
}
await executar(['release', 'upload', tag, ...arquivos, '--clobber']);
const commitMain = (await executar(['api', `repos/${repositorio}/git/ref/heads/main`, '--jq', '.object.sha'])).trim();
await executar(['release', 'edit', tag, '--draft=false', `--latest=${commitMain === commit}`]);
console.log(`Release publicada: https://github.com/${repositorio}/releases/tag/${tag}`);
