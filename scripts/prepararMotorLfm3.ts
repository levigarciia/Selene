import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pastaRuntimeLfm3, pastaRuntimeLfm3Vulkan, revisaoRuntimeLfm3 } from '../shared/runtimeModelo';
import { localizarServidor } from '../electron/services/instalador';

if (process.platform !== 'win32' || !process.env.APPDATA) throw new Error('Este script exige Windows.');
const raiz = join(process.env.APPDATA, 'Selene', 'runtime');
const backend = process.argv[2] ?? 'vulkan';
if (!['cpu', 'vulkan'].includes(backend)) throw new Error('Escolha cpu ou vulkan.');
const destino = join(raiz, backend === 'cpu' ? pastaRuntimeLfm3 : pastaRuntimeLfm3Vulkan);
if (await localizarServidor(destino)) {
    console.log('Motor LFM3 já instalado.');
    process.exit(0);
}
const vswhere = 'C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe';
const consulta = spawnSync(vswhere, ['-latest', '-products', '*', '-property', 'installationPath'], {
    encoding: 'utf8', windowsHide: true,
});
const visualStudio = consulta.stdout?.trim();
if (consulta.status !== 0 || !visualStudio) throw new Error('Visual Studio Build Tools não encontrado.');
const cmake = join(visualStudio, 'Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe');
const trabalho = join(tmpdir(), 'selene-motor-lfm3');
await mkdir(trabalho, { recursive: true });
const zip = join(trabalho, 'fonte.zip');
const url = `https://github.com/ggml-org/llama.cpp/archive/${revisaoRuntimeLfm3}.zip`;
const hashEsperado = '3d65fda92438f015827632e142d268e917ef524b216f739cae448dd4e0ae08e5';
let bytes = await readFile(zip).catch(() => null);
if (!bytes) {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(300000) });
    if (!resposta.ok) throw new Error(`Falha ao baixar código oficial: HTTP ${resposta.status}.`);
    bytes = Buffer.from(await resposta.arrayBuffer());
    await writeFile(zip, bytes);
}
if (createHash('sha256').update(bytes).digest('hex') !== hashEsperado) {
    throw new Error('O código fonte não corresponde ao hash esperado.');
}

function executar(comando: string, argumentos: string[]): void {
    const resultado = spawnSync(comando, argumentos, { stdio: 'inherit', windowsHide: true });
    if (resultado.status !== 0) throw new Error(`Falha ao executar ${comando}.`);
}

executar('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Expand-Archive -LiteralPath '${zip.replaceAll("'", "''")}' ` +
    `-DestinationPath '${trabalho.replaceAll("'", "''")}' -Force`]);
const compilacao = join(trabalho, backend === 'cpu' ? 'build' : 'build-dinamico');
executar(cmake, ['-S', join(trabalho, `llama.cpp-${revisaoRuntimeLfm3}`), '-B', compilacao,
    '-G', 'Visual Studio 17 2022', '-A', 'x64', '-DGGML_NATIVE=OFF', '-DLLAMA_BUILD_TESTS=OFF',
    `-DGGML_BACKEND_DL=${backend === 'cpu' ? 'OFF' : 'ON'}`, '-DLLAMA_CURL=OFF', '-DLLAMA_OPENSSL=OFF']);
executar(cmake, ['--build', compilacao, '--config', 'Release', '--target', 'llama-server', '-j', '8']);
await mkdir(raiz, { recursive: true });
const temporario = await mkdtemp(join(raiz, 'lfm3-instalacao-'));
try {
    await cp(join(compilacao, 'bin', 'Release'), temporario, { recursive: true });
    if (backend === 'vulkan') {
        const urlBackend = 'https://nightly.link/ggml-org/llama.cpp/actions/artifacts/12782471507.zip';
        const resposta = await fetch(urlBackend, { signal: AbortSignal.timeout(300000) });
        if (!resposta.ok) throw new Error(`Falha no backend Vulkan oficial: HTTP ${resposta.status}.`);
        const pacote = Buffer.from(await resposta.arrayBuffer());
        const hash = '82c660e25e68ef8465191504a2dbd3ee9345fb4127a8989ee173c72703cfaa33';
        if (createHash('sha256').update(pacote).digest('hex') !== hash) {
            throw new Error('O backend Vulkan não corresponde ao hash oficial.');
        }
        const zipBackend = join(trabalho, 'vulkan.zip');
        const extraido = join(trabalho, 'vulkan');
        await writeFile(zipBackend, pacote);
        executar('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            `Expand-Archive -LiteralPath '${zipBackend.replaceAll("'", "''")}' ` +
            `-DestinationPath '${extraido.replaceAll("'", "''")}' -Force`]);
        const biblioteca = await readFile(join(extraido, 'ggml-vulkan.dll'));
        if (createHash('sha256').update(biblioteca).digest('hex') !==
            'af61df7b40f7636dc5c444135b8655dacb956c61d414d01343e79ac674644c84') {
            throw new Error('A biblioteca Vulkan não corresponde à revisão esperada.');
        }
        await writeFile(join(temporario, 'ggml-vulkan.dll'), biblioteca);
    }
    if (!(await localizarServidor(temporario))) throw new Error('Compilação sem llama-server.exe.');
    await writeFile(join(temporario, 'origem.json'), JSON.stringify({ url, revisaoRuntimeLfm3, hashEsperado,
        backend, artefatoVulkan: backend === 'vulkan' ? 12782471507 : undefined }));
    await rename(temporario, destino);
} finally {
    await rm(temporario, { recursive: true, force: true });
}
console.log(`Motor LFM3 instalado em ${backend === 'cpu' ? 'CPU' : 'Vulkan'}.`);
