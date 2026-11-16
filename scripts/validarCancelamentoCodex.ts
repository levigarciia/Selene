import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { responderCodexAppServer } from '../electron/services/codexAppServer';

const pasta = await mkdtemp(join(tmpdir(), 'selene-cancelamento-real-'));
await writeFile(
    join(pasta, 'esperar.ps1'),
    [
        '$PID | Set-Content -LiteralPath processo.txt',
        'Start-Sleep -Seconds 60',
        "Set-Content -LiteralPath concluiu.txt -Value 'não deveria concluir'",
    ].join('\n'),
);
const controle = new AbortController();
const prazo = setTimeout(() => controle.abort(), 120000);
let pid: number | undefined;
let erro = '';
const observar = (async () => {
    while (!controle.signal.aborted) {
        const texto = await readFile(join(pasta, 'processo.txt'), 'utf8').catch(() => '');
        if (texto.trim()) {
            pid = Number(texto.trim());
            await esperar(300);
            controle.abort();
            return;
        }
        await esperar(100);
    }
})();
try {
    await responderCodexAppServer(
        'gpt-6.1-sol',
        'Execute exatamente powershell.exe -NoProfile -ExecutionPolicy Bypass -File esperar.ps1 nesta pasta. ' +
            'Não altere o script nem use subagentes. Aguarde o comando terminar.',
        controle.signal,
        pasta,
        true,
        () => {},
    );
    throw new Error('A tarefa terminou sem ser cancelada.');
} catch (falha) {
    erro = falha instanceof Error ? falha.message : String(falha);
} finally {
    clearTimeout(prazo);
    controle.abort();
    await observar;
}
const ativo = () => {
    if (!pid) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
};
for (let tentativa = 0; tentativa < 50 && ativo(); tentativa++) await esperar(100);
const concluiu = await readFile(join(pasta, 'concluiu.txt'), 'utf8').then(
    () => true,
    () => false,
);
const resultado = { pidCapturado: !!pid, processoEncerrado: !ativo(), concluiu, erro };
await writeFile(resolve('artifacts/auditoria20261115/cancelamentoReal.json'), JSON.stringify(resultado, null, 4));
assert(pid, 'O modelo precisa iniciar o processo real antes do cancelamento.');
assert(!ativo(), 'O subprocesso não pode continuar após o cancelamento.');
assert(!concluiu);
assert.match(erro, /interrompida/);
console.log('Cancelamento do Codex e encerramento do subprocesso real validados.');
