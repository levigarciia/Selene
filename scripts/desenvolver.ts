import { spawn } from 'node:child_process';
import { encerrarProcesso } from '../electron/services/processos';
import './compilar';

const ambiente = { ...process.env };
delete ambiente.ELECTRON_RUN_AS_NODE;
const vite = spawn('bun', ['run', 'dev:web'], { stdio: 'inherit', env: ambiente });
let desktop: ReturnType<typeof spawn> | undefined;
let encerrando = false;

function encerrar() {
    if (encerrando) return;
    encerrando = true;
    if (desktop) encerrarProcesso(desktop);
    encerrarProcesso(vite);
}

process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
vite.on('error', (erro) => {
    console.error(erro.message);
    encerrar();
});
vite.on('exit', encerrar);

for (let tentativa = 0; tentativa < 100 && !encerrando; tentativa++) {
    const pronto = await fetch('http://127.0.0.1:5173')
        .then((resposta) => resposta.ok)
        .catch(() => false);
    if (pronto) {
        desktop = spawn('node_modules/electron/dist/electron.exe', ['.'], {
            stdio: 'inherit',
            env: { ...ambiente, SELENE_VITE_URL: 'http://127.0.0.1:5173' },
        });
        desktop.on('exit', encerrar);
        desktop.on('error', (erro) => {
            console.error(erro.message);
            encerrar();
        });
        break;
    }
    await Bun.sleep(200);
}
if (!desktop) {
    encerrar();
    throw new Error('O servidor de desenvolvimento não iniciou.');
}
