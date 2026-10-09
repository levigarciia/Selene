import { build } from 'esbuild';

await build({
    entryPoints: ['electron/principal.ts', 'electron/preload.ts'],
    outdir: 'dist-electron',
    outExtension: { '.js': '.cjs' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron', 'electron-updater'],
    sourcemap: true,
    target: 'node22',
});
