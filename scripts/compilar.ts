import { build, type BuildOptions } from 'esbuild';

const comum: BuildOptions = {
    outdir: 'dist-electron',
    outExtension: { '.js': '.cjs' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron', 'electron-updater', 'node-pty'],
    sourcemap: true,
    target: 'node22',
};

await Promise.all([
    build({
        ...comum,
        entryPoints: ['electron/principal.ts'],
        // O Agent SDK do Claude é ESM e usa import.meta.url; no pacote CJS ele aponta para o próprio arquivo.
        // Fica só no processo principal: o preload roda em sandbox e não pode carregar `node:url`.
        define: { 'import.meta.url': '__urlModulo' },
        banner: { js: "const __urlModulo = require('node:url').pathToFileURL(__filename).href;" },
    }),
    build({ ...comum, entryPoints: ['electron/preload.ts'] }),
]);
