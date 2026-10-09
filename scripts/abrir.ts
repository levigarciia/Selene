import { spawn } from 'node:child_process';

const ambiente = { ...process.env };
delete ambiente.ELECTRON_RUN_AS_NODE;
const desktop = spawn('node_modules/electron/dist/electron.exe', ['.'], { stdio: 'inherit', env: ambiente });
desktop.once('error', (erro) => {
    console.error(erro.message);
    process.exitCode = 1;
});
desktop.once('exit', (codigo) => {
    process.exitCode = codigo ?? 1;
});
