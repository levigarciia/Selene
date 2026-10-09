import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ElectronApplication, Page } from 'playwright';

const executar = promisify(execFile);

/** Identifica somente o processo de inferência pertencente ao aplicativo isolado do teste. */
export async function pidMotor(aplicativo: ElectronApplication): Promise<number> {
    const pai = await aplicativo.evaluate(() => process.pid);
    assert.ok(Number.isInteger(pai) && pai > 0);
    const resultado = await executar(
        'powershell.exe',
        [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            '(Get-CimInstance Win32_Process | Where-Object { ' +
                `$_.Name -eq 'llama-server.exe' -and $_.ParentProcessId -eq ${pai} }).ProcessId`,
        ],
        { windowsHide: true },
    );
    const pid = Number(resultado.stdout.trim());
    assert.ok(Number.isInteger(pid) && pid > 0, 'O aplicativo de teste deve manter seu motor em execução.');
    return pid;
}

/** Salva pela interface e confirma que nem parâmetros de geração nem do motor descarregam os pesos. */
export async function validarSalvamento(pagina: Page, aplicativo: ElectronApplication): Promise<number> {
    const pid = await pidMotor(aplicativo);
    await pagina.getByRole('button', { name: 'Configurações', exact: true }).click();
    const secoes = pagina.getByRole('navigation', { name: 'Seções das configurações' });
    await secoes.getByRole('button', { name: 'Geral', exact: true }).click();
    await pagina.getByLabel('Temperatura', { exact: true }).fill('0.3');
    await pagina.getByRole('button', { name: 'Salvar', exact: true }).click();
    await pagina.getByText('Configurações salvas', { exact: true }).waitFor();
    assert.equal(await pidMotor(aplicativo), pid, 'Salvar temperatura deve manter o mesmo processo.');
    const geracaoSalva = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(geracaoSalva.ok);
    assert.equal(geracaoSalva.valor.motor.recarregamentoPendente, false);
    await secoes.getByRole('button', { name: 'Motor', exact: true }).click();
    await pagina.getByLabel('Contexto', { exact: true }).selectOption('4096');
    await pagina.getByRole('button', { name: 'Salvar', exact: true }).click();
    await pagina.getByText('Configurações salvas', { exact: true }).waitFor();
    const resultado = await pagina.evaluate(() => window.selene!.estado());
    assert.ok(resultado.ok);
    assert.equal(resultado.valor.motor.fase, 'pronto');
    assert.equal(resultado.valor.motor.recarregamentoPendente, true);
    assert.equal(
        await pidMotor(aplicativo),
        pid,
        'Salvar contexto deve manter o modelo carregado até o próximo envio.',
    );
    await pagina.screenshot({ path: 'artifacts/selene-configuracoes-salvas.png' });
    await pagina.getByRole('button', { name: 'Voltar à conversa' }).click();
    console.log('Salvar pela interface manteve o mesmo motor; contexto ficou pendente para a próxima carga.');
    return pid;
}
