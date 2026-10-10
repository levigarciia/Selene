import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { ControladorComputador } from '../electron/services/controladorComputador';
import { encerrarProcesso } from '../electron/services/processos';
import { aplicativoComputador } from './fixtures/aplicativoComputador';

const aplicativo = spawn(
    'powershell.exe',
    ['-NoProfile', '-Sta', '-EncodedCommand', Buffer.from(aplicativoComputador, 'utf16le').toString('base64')],
    { windowsHide: true },
);
const controlador = new ControladorComputador();
try {
    const janela = await new Promise<string>((resolver, rejeitar) => {
        const tempo = setTimeout(() => rejeitar(new Error('O aplicativo de teste não abriu.')), 15000);
        createInterface({ input: aplicativo.stdout! }).once('line', (linha) => {
            clearTimeout(tempo);
            resolver(linha);
        });
        aplicativo.once('error', rejeitar);
    });
    const sinal = new AbortController().signal;
    let observacao = await controlador.executar({ acao: 'observar', janela }, sinal);
    const campo = observacao.elementos.find((item) => /EDIT/i.test(item.tipo));
    assert(campo, 'Campo encontrado pela acessibilidade real do Windows');
    observacao = await controlador.executar(
        { acao: 'digitar', observacao: observacao.observacao, referencia: campo.referencia, texto: 'Controle real' },
        sinal,
    );
    const botao = observacao.elementos.find((item) => item.nome === 'Confirmar');
    assert(botao);
    observacao = await controlador.executar(
        { acao: 'clicar', observacao: observacao.observacao, referencia: botao.referencia },
        sinal,
    );
    assert.equal(observacao.titulo, 'Confirmado: Controle real');
    await assert.rejects(
        controlador.executar({ acao: 'clicar', observacao: crypto.randomUUID(), referencia: botao.referencia }, sinal),
        /observação mudou/,
    );
    const cancelamento = new AbortController();
    cancelamento.abort();
    await assert.rejects(controlador.executar({ acao: 'observar', janela }, cancelamento.signal));
    const cancelamentoEmExecucao = new AbortController();
    const executando = controlador.executar({ acao: 'observar', janela }, cancelamentoEmExecucao.signal);
    cancelamentoEmExecucao.abort();
    await assert.rejects(executando, /interrompido/);
    console.log('Controle nativo validado: observação, preenchimento, clique, referência antiga e cancelamento.');
} finally {
    controlador.encerrar();
    encerrarProcesso(aplicativo);
}
