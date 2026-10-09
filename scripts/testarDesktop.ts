import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

await mkdir('artifacts', { recursive: true });
await build({
    entryPoints: [process.argv[2] ?? 'scripts/validarDesktop.ts'],
    outfile: 'artifacts/validarDesktop.mjs',
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['playwright'],
});
const teste = spawn('node', ['artifacts/validarDesktop.mjs'], { stdio: 'inherit' });
teste.once('error', (erro) => {
    console.error(erro.message);
    process.exitCode = 1;
});
teste.once('exit', (codigo) => {
    process.exitCode = codigo ?? 1;
});
