import { app, BrowserWindow, ipcMain } from 'electron';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { esquemaDados, type Estado } from '../../shared/contratos';
import { Computador } from '../../electron/services/computador';
import { Operacoes } from '../../electron/services/operacoes';
import { AcessoWeb } from '../../electron/services/acessoWeb';

void app
    .whenReady()
    .then(async () => {
        const pasta = process.env.SELENE_TESTE_DADOS!;
        const dados = esquemaDados.parse(JSON.parse(await readFile(resolve(pasta, 'selene.json'), 'utf8')));
        const estado: Estado = {
            ...dados,
            downloads: [],
            conversaEmExecucao: dados.conversas[0].id,
            motor: {
                fase: 'desligado',
                detalhe: 'Teste nativo',
                instalado: { cpu: false, vulkan: false, rocm: false },
            },
        };
        const janela = new BrowserWindow({
            width: 1100,
            height: 850,
            webPreferences: { sandbox: true, preload: resolve('dist-electron/preload.cjs') },
        });
        const operacoes = new Operacoes();
        const web = new AcessoWeb(resolve(pasta, 'web.json'), resolve('dist'), operacoes, () => ({
            tipo: 'estado',
            estado,
        }));
        const computador = new Computador(
            (previa) => {
                janela.webContents.send('selene:evento', { tipo: 'computador', previa });
                web.publicar({ tipo: 'computador', previa });
            },
            pathToFileURL(resolve('dist/index.html')).href,
        );
        const registrar = <T extends z.ZodType>(
            nome: string,
            esquema: T,
            executar: (argumentos: z.infer<T>) => unknown,
        ) => {
            operacoes.registrar(nome, esquema, executar);
            ipcMain.handle(`selene:${nome}`, (_evento, ...argumentos) => operacoes.executar(nome, argumentos));
        };
        registrar('estado', z.tuple([]), () => estado);
        registrar('previasNavegador', z.tuple([]), () => []);
        registrar('previasComputador', z.tuple([]), () => computador.listarPrevias());
        registrar('pararComputador', z.tuple([z.string().uuid()]), ([id]) => computador.fecharConversa(id));
        registrar('alterar', z.tuple([z.string(), z.unknown()]), () => estado);
        const acesso = await web.configurar({
            ativo: true,
            porta: Number(process.env.SELENE_TESTE_PORTA),
            exigirChave: true,
        });
        Object.assign(globalThis, { computadorValidacao: computador, chaveValidacao: acesso.chave });
        app.on('before-quit', () => {
            computador.encerrar();
            void web.encerrar();
        });
        await janela.loadFile(resolve('dist/index.html'));
    })
    .catch((erro) => {
        console.error(erro);
        app.exit(1);
    });
