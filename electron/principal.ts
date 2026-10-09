import { app, BrowserWindow, dialog, ipcMain, nativeImage, type IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'node:crypto';
import { open, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { esquemaIconeProjeto } from '../shared/iconesProjetos';
import { esquemaProjetoChat, esquemaEdicaoProjetoChat } from '../shared/projetosChat';
import { ProjetosChat, contextoProjetoChat } from './services/projetosChat';
import {
    esquemaNovoProjeto,
    esquemaProjeto,
    esquemaRascunho,
    esquemaAlteracao,
    esquemaBackend,
    esquemaConfiguracao,
    esquemaEntradaImagem,
    type Estado,
    type Evento,
    type Resultado,
} from '../shared/contratos';
import { Persistencia } from './services/persistencia';
import { MotorLocal } from './services/motor';
import { Agente } from './services/agente';
import { obterPedidoParaRegerarChat, prepararReenvioChat } from './services/reenvioChat';
import { catalogoModelos, encontrarModeloLocal, type ModeloCatalogo } from '../shared/catalogo';
import { DownloadsModelos } from './services/downloadModelos';
import { AnexosImagens } from './services/anexosImagens';
import { prepararPastaTrabalho, cadastrarProjeto, criarProjetoGerenciado } from './services/projetos';
import { Atualizacoes } from './services/atualizacoes';
import electronUpdater from 'electron-updater';
import { shell } from 'electron';
import { urlRelease } from '../shared/atualizacoes';

app.setName('Selene');
app.setPath('userData', join(app.getPath('appData'), 'Selene'));
const pastaTeste = process.env.SELENE_TESTE_DADOS;
if (pastaTeste && process.env.SELENE_TESTE === '1') app.setPath('userData', pastaTeste);
let janela: BrowserWindow | null = null;
let persistencia: Persistencia;
let motor: MotorLocal;
let agente: Agente;
let downloads: DownloadsModelos;
let anexos: AnexosImagens;
let atualizacoes: Atualizacoes;
let tarefa: Promise<void> | null = null;
let encerramentoAutorizado = false;
const uuid = z.string().uuid();
const urlDesenvolvimento = !app.isPackaged ? process.env.SELENE_VITE_URL : undefined;
if (urlDesenvolvimento && urlDesenvolvimento !== 'http://127.0.0.1:5173') {
    throw new Error('Origem de desenvolvimento inválida.');
}
const urlInterface = urlDesenvolvimento ?? pathToFileURL(join(__dirname, '../dist/index.html')).href;

function estado(): Estado {
    return structuredClone({
        ...persistencia.dados,
        motor: motor.estado,
        conversaEmExecucao: agente?.conversaId ?? null,
        downloads: downloads?.estadosAtuais ?? [],
        atualizacao: atualizacoes?.estado,
    });
}

function publicar(evento: Evento): void {
    if (janela && !janela.isDestroyed()) janela.webContents.send('selene:evento', evento);
}

function publicarEstado(): void {
    if (persistencia && motor) publicar({ tipo: 'estado', estado: estado() });
}

function validarRemetente(evento: IpcMainInvokeEvent): void {
    if (
        !janela ||
        evento.sender !== janela.webContents ||
        evento.senderFrame !== janela.webContents.mainFrame ||
        (evento.senderFrame.url !== urlInterface && evento.senderFrame.url !== `${urlInterface}/`)
    ) {
        throw new Error('Origem IPC não autorizada.');
    }
}

function registrar<T extends z.ZodType>(
    nome: string,
    esquema: T,
    executar: (argumentos: z.infer<T>) => Promise<unknown> | unknown,
): void {
    ipcMain.handle(`selene:${nome}`, async (evento, ...entrada): Promise<Resultado<unknown>> => {
        try {
            validarRemetente(evento);
            const argumentos = esquema.parse(entrada);
            return { ok: true, valor: await executar(argumentos) };
        } catch (erro) {
            return { ok: false, erro: erro instanceof Error ? erro.message : 'Operação não concluída.' };
        }
    });
}

function conversaPorId(id: string) {
    const conversa = persistencia.dados.conversas.find((item) => item.id === id);
    if (!conversa) throw new Error('Conversa não encontrada.');
    return conversa;
}

function exigirLivre(id?: string): void {
    if (agente.conversaId && (!id || agente.conversaId === id)) {
        throw new Error('Interrompa a tarefa antes de alterar esta configuração.');
    }
}

async function salvar(): Promise<void> {
    await persistencia.salvar();
    publicarEstado();
}

async function excluirConversas(ids: string[]): Promise<void> {
    for (const id of ids) exigirLivre(id);
    const idsImagens = [
        ...new Set(
            ids.flatMap((id) =>
                conversaPorId(id).mensagens.flatMap((mensagem) => mensagem.imagens?.map((imagem) => imagem.id) ?? []),
            ),
        ),
    ];
    const anteriores = persistencia.dados.conversas;
    const removidas = new Set(ids);
    persistencia.dados.conversas = anteriores.filter((conversa) => !removidas.has(conversa.id));
    try {
        await salvar();
    } catch (erro) {
        persistencia.dados.conversas = anteriores;
        throw erro;
    }
    await anexos.excluirSemReferencia(idsImagens);
}

function itemCatalogo(id: string): ModeloCatalogo {
    const item = catalogoModelos.find((modelo) => modelo.id === id);
    if (!item) throw new Error('Modelo não encontrado no catálogo.');
    return item;
}

async function registrarDownload(item: ModeloCatalogo, caminho: string): Promise<void> {
    const existente = persistencia.dados.modelos.find((modelo) => modelo.catalogoId === item.id);
    if (existente) return;
    const modelo = {
        id: randomUUID(),
        nome: item.nome,
        caminho,
        tamanho: item.tamanho,
        catalogoId: item.id,
    };
    persistencia.dados.modelos.push(modelo);
    try {
        await salvar();
    } catch (erro) {
        persistencia.dados.modelos = persistencia.dados.modelos.filter((item) => item.id !== modelo.id);
        throw erro;
    }
}

async function carregarModelo(id: string): Promise<void> {
    const modelo = persistencia.dados.modelos.find((item) => item.id === id);
    if (!modelo) throw new Error('Modelo não encontrado.');
    const configuracao = persistencia.dados.configuracao;
    await motor.carregar(modelo, configuracao);
}

function registrarOperacoes(): void {
    const projetosChat = new ProjetosChat(persistencia.dados, salvar, () => agente.conversaId);
    registrar('criarProjetoChat', z.tuple([esquemaProjetoChat.shape.nome]), ([nome]) => projetosChat.criar(nome));
    registrar('editarProjetoChat', z.tuple([uuid, esquemaEdicaoProjetoChat]), ([id, edicao]) =>
        projetosChat.editar(id, edicao),
    );
    registrar('removerProjetoChat', z.tuple([uuid]), ([id]) => projetosChat.remover(id));
    registrar('removerArquivoProjetoChat', z.tuple([uuid, uuid]), ([id, arquivoId]) =>
        projetosChat.removerArquivo(id, arquivoId),
    );
    registrar('moverConversaProjetoChat', z.tuple([uuid, uuid.nullable()]), ([id, projetoId]) =>
        projetosChat.mover(conversaPorId(id), projetoId),
    );
    registrar('importarArquivosProjetoChat', z.tuple([uuid]), async ([id]) => {
        projetosChat.obter(id);
        const escolha = await dialog.showOpenDialog(janela!, {
            title: 'Adicionar referências ao projeto de Chat',
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Texto', extensions: ['txt', 'md', 'csv', 'json'] }],
        });
        if (!escolha.canceled) await projetosChat.importar(id, escolha.filePaths);
    });
    const vazio = z.tuple([]);
    registrar('estado', vazio, estado);
    registrar('verificarAtualizacao', vazio, () => atualizacoes.verificar());
    registrar('reiniciarAtualizacao', vazio, () => atualizacoes.reiniciar());
    registrar('abrirRelease', z.tuple([z.string().max(80).optional()]), async ([versao]) => {
        await shell.openExternal(urlRelease(versao));
    });
    registrar('anexarImagens', z.tuple([z.array(esquemaEntradaImagem).min(1).max(4)]), ([imagens]) =>
        anexos.importar(imagens),
    );
    registrar('lerImagem', z.tuple([uuid]), ([id]) => anexos.ler(id));
    registrar('descartarImagens', z.tuple([z.array(uuid).max(32)]), ([ids]) => anexos.descartar(ids));
    registrar('importarProjetor', z.tuple([uuid]), async ([id]) => {
        exigirLivre();
        const modelo = persistencia.dados.modelos.find((item) => item.id === id);
        if (!modelo) throw new Error('Modelo não encontrado.');
        const escolha = await dialog.showOpenDialog(janela!, {
            properties: ['openFile'],
            title: 'Importar projetor visual correspondente ao modelo',
            filters: [{ name: 'GGUF', extensions: ['gguf'] }],
        });
        exigirLivre();
        if (escolha.canceled) return;
        const caminho = await realpath(escolha.filePaths[0]);
        const arquivo = await open(caminho, 'r');
        try {
            const assinatura = Buffer.alloc(4);
            await arquivo.read(assinatura, 0, 4, 0);
            if (assinatura.toString() !== 'GGUF') throw new Error('Projetor visual GGUF inválido.');
        } finally {
            await arquivo.close();
        }
        modelo.projetorVisual = caminho;
        await salvar();
        if (motor.estado.modeloId === id) {
            motor.estado.recarregamentoPendente = true;
            publicarEstado();
        }
    });
    registrar('adicionarProjeto', z.tuple([esquemaNovoProjeto]), async ([entrada]) => {
        if (entrada.tipo !== 'pasta') {
            const projeto = await criarProjetoGerenciado(persistencia.dados, app.getPath('userData'), entrada);
            await salvar();
            return projeto;
        }
        const escolha = await dialog.showOpenDialog(janela!, {
            properties: ['openDirectory'],
            title: 'Adicionar projeto',
        });
        if (escolha.canceled) return null;
        const projeto = await cadastrarProjeto(persistencia.dados, escolha.filePaths[0]);
        await salvar();
        return projeto;
    });
    registrar('alterarProjeto', z.tuple([uuid, esquemaProjeto.shape.nome]), async ([id, nome]) => {
        const projeto = persistencia.dados.projetos.find((item) => item.id === id);
        if (!projeto) throw new Error('Projeto não encontrado.');
        projeto.nome = nome;
        await salvar();
    });
    registrar('salvarIconeProjeto', z.tuple([uuid, esquemaIconeProjeto.nullable()]), async ([id, icone]) => {
        const projeto = persistencia.dados.projetos.find((item) => item.id === id);
        if (!projeto) throw new Error('Projeto não encontrado.');
        projeto.icone = icone;
        await salvar();
    });
    registrar('importarIconeProjeto', z.tuple([uuid]), async ([id]) => {
        const projeto = persistencia.dados.projetos.find((item) => item.id === id);
        if (!projeto) throw new Error('Projeto não encontrado.');
        const escolha = await dialog.showOpenDialog(janela!, {
            title: 'Escolher ícone do projeto',
            properties: ['openFile'],
            filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'ico'] }],
        });
        if (escolha.canceled) return false;
        const arquivo = escolha.filePaths[0];
        const metadados = await stat(arquivo);
        if (!metadados.isFile() || metadados.size > 2 * 1024 ** 2) {
            throw new Error('Escolha uma imagem de até 2 MB.');
        }
        const imagem = nativeImage.createFromPath(arquivo);
        if (imagem.isEmpty()) throw new Error('Não foi possível abrir a imagem do ícone.');
        const tamanho = imagem.getSize();
        const escala = Math.min(1, 96 / Math.max(tamanho.width, tamanho.height));
        projeto.icone = esquemaIconeProjeto.parse({
            tipo: 'imagem',
            dados: imagem
                .resize({
                    width: Math.max(1, Math.round(tamanho.width * escala)),
                    height: Math.max(1, Math.round(tamanho.height * escala)),
                })
                .toDataURL(),
        });
        await salvar();
        return true;
    });
    registrar('removerProjeto', z.tuple([uuid]), async ([id]) => {
        const projeto = persistencia.dados.projetos.find((item) => item.id === id);
        if (!projeto) throw new Error('Projeto não encontrado.');
        projeto.oculto = true;
        await salvar();
    });
    registrar('promoverRascunho', z.tuple([esquemaRascunho]), async ([entrada]) => {
        const existente = persistencia.dados.conversas.find((item) => item.id === entrada.id);
        if (existente) return existente;
        if (entrada.modeloId && !persistencia.dados.modelos.some((item) => item.id === entrada.modeloId)) {
            throw new Error('Modelo não encontrado.');
        }
        const projeto = entrada.projetoId
            ? persistencia.dados.projetos.find((item) => item.id === entrada.projetoId)
            : persistencia.dados.projetos.find((item) => item.caminho === entrada.projeto);
        if ((entrada.projetoId || entrada.projeto) && !projeto) throw new Error('Projeto não encontrado.');
        if (entrada.projetoChatId) {
            if (entrada.modo !== 'chat') throw new Error('Projetos de Chat exigem conversas Chat.');
            projetosChat.obter(entrada.projetoChatId);
        }
        const { rascunho, ...opcoes } = entrada;
        const caminhoProjeto = entrada.modo === 'code' && projeto ? await realpath(projeto.caminho) : null;
        const promovida = persistencia.dados.conversas.find((item) => item.id === entrada.id);
        if (promovida) return promovida;
        const conversa = {
            ...opcoes,
            projeto: caminhoProjeto,
            projetoId: entrada.modo === 'code' ? (projeto?.id ?? null) : null,
            acessoCompleto: entrada.modo === 'code' && entrada.acessoCompleto,
            mensagens: [],
            atualizadoEm: new Date().toISOString(),
        };
        persistencia.dados.conversas.unshift(conversa);
        await salvar();
        return conversa;
    });
    registrar('nova', z.tuple([z.enum(['chat', 'code']), uuid.optional()]), async ([modo, origemId]) => {
        const origem = origemId ? conversaPorId(origemId) : undefined;
        const projeto =
            modo === 'code' && origem?.modo === 'code' && origem.projeto ? await realpath(origem.projeto) : null;
        const conversa = {
            id: randomUUID(),
            titulo: 'Nova conversa',
            modo,
            projeto,
            projetoId: origem?.projetoId ?? null,
            projetoChatId: modo === 'chat' && origem?.modo === 'chat' ? origem.projetoChatId : null,
            acessoCompleto: false,
            modeloId: motor.estado.modeloId ?? null,
            mensagens: [],
            atualizadoEm: new Date().toISOString(),
        };
        persistencia.dados.conversas.unshift(conversa);
        await salvar();
        return conversa;
    });
    registrar('alterar', z.tuple([uuid, esquemaAlteracao]), async ([id, alteracao]) => {
        exigirLivre(id);
        const conversa = conversaPorId(id);
        if (alteracao.modeloId && !persistencia.dados.modelos.some((modelo) => modelo.id === alteracao.modeloId)) {
            throw new Error('Modelo não encontrado.');
        }
        if (alteracao.concluida !== undefined && conversa.modo !== 'code') {
            throw new Error('Somente conversas Code podem ser encerradas.');
        }
        Object.assign(conversa, alteracao, { atualizadoEm: new Date().toISOString() });
        if (alteracao.concluida !== undefined) {
            if (alteracao.concluida) conversa.encerradaEm = conversa.atualizadoEm;
            else delete conversa.encerradaEm;
        }
        if (conversa.modo === 'chat') conversa.acessoCompleto = false;
        await salvar();
    });
    registrar('excluir', z.tuple([uuid]), async ([id]) => {
        await excluirConversas([id]);
    });
    registrar('excluirConcluidas', vazio, async () => {
        const ids = persistencia.dados.conversas
            .filter((conversa) => conversa.modo === 'code' && conversa.concluida)
            .map((conversa) => conversa.id);
        await excluirConversas(ids);
        return ids;
    });
    registrar('projeto', z.tuple([uuid, z.string().min(1).nullable().optional()]), async ([id, caminho]) => {
        exigirLivre(id);
        const conversa = conversaPorId(id);
        if (conversa.modo !== 'code') throw new Error('Projetos estão disponíveis somente no modo Code.');
        if (caminho === null) {
            await prepararPastaTrabalho(conversa, app.getPath('userData'));
            conversa.projeto = null;
            conversa.projetoId = null;
            conversa.atualizadoEm = new Date().toISOString();
            await salvar();
            return true;
        }
        if (caminho !== undefined) {
            if (!persistencia.dados.projetos.some((item) => item.caminho === caminho)) {
                throw new Error('Projeto recente não encontrado. Escolha a pasta novamente.');
            }
            const projeto = await realpath(caminho);
            if (!(await stat(projeto)).isDirectory()) throw new Error('O projeto precisa ser uma pasta.');
            conversa.projeto = projeto;
            conversa.projetoId = persistencia.dados.projetos.find((item) => item.caminho === projeto)!.id;
            conversa.atualizadoEm = new Date().toISOString();
            await salvar();
            return true;
        }
        const escolha = await dialog.showOpenDialog(janela!, {
            properties: ['openDirectory'],
            title: 'Escolher projeto',
        });
        exigirLivre(id);
        if (escolha.canceled) return false;
        conversa.projeto = await realpath(escolha.filePaths[0]);
        conversa.projetoId = (await cadastrarProjeto(persistencia.dados, conversa.projeto)).id;
        conversa.atualizadoEm = new Date().toISOString();
        await salvar();
        return true;
    });
    registrar('importar', vazio, async () => {
        const escolha = await dialog.showOpenDialog(janela!, {
            properties: ['openFile'],
            title: 'Importar modelo GGUF',
            filters: [{ name: 'GGUF', extensions: ['gguf'] }],
        });
        if (escolha.canceled) return;
        const caminho = await realpath(escolha.filePaths[0]);
        if (persistencia.dados.modelos.some((modelo) => modelo.caminho === caminho)) return;
        const arquivo = await open(caminho, 'r');
        try {
            const assinatura = Buffer.alloc(4);
            await arquivo.read(assinatura, 0, 4, 0);
            if (assinatura.toString() !== 'GGUF') throw new Error('O arquivo não tem uma assinatura GGUF válida.');
        } finally {
            await arquivo.close();
        }
        const metadados = await stat(caminho);
        persistencia.dados.modelos.push({
            id: randomUUID(),
            nome: basename(caminho),
            caminho,
            tamanho: metadados.size,
        });
        await salvar();
    });
    registrar('removerModelo', z.tuple([uuid]), async ([id]) => {
        exigirLivre();
        const modelo = persistencia.dados.modelos.find((item) => item.id === id);
        if (!modelo) throw new Error('Modelo não encontrado.');
        if (motor.estado.modeloId === id) motor.parar();
        if (modelo.catalogoId) {
            const item = itemCatalogo(modelo.catalogoId);
            const destino = join(app.getPath('userData'), 'models', `${item.id}.gguf`);
            if (modelo.caminho !== destino) throw new Error('Caminho do download inválido.');
            await rm(destino, { force: true });
        }
        persistencia.dados.modelos = persistencia.dados.modelos.filter((modelo) => modelo.id !== id);
        for (const conversa of persistencia.dados.conversas) if (conversa.modeloId === id) conversa.modeloId = null;
        await salvar();
    });
    registrar('baixarModelo', z.tuple([z.string().min(1).max(120)]), ([id]) => {
        const item = itemCatalogo(id);
        if (encontrarModeloLocal(item, persistencia.dados.modelos)) return;
        downloads.iniciar(item);
    });
    registrar('cancelarDownload', z.tuple([z.string().min(1).max(120)]), ([id]) => {
        itemCatalogo(id);
        downloads.cancelar(id);
    });
    registrar('favoritarModelo', z.tuple([z.string().min(1).max(120), z.boolean()]), async ([id, favorito]) => {
        itemCatalogo(id);
        const favoritos = persistencia.dados.favoritosCatalogo.filter((atual) => atual !== id);
        persistencia.dados.favoritosCatalogo = favorito ? [...favoritos, id] : favoritos;
        await salvar();
    });
    registrar('instalar', z.tuple([esquemaBackend]), async ([backend]) => {
        exigirLivre();
        await motor.instalar(backend);
    });
    registrar('carregar', z.tuple([uuid]), async ([id]) => {
        exigirLivre();
        await carregarModelo(id);
    });
    registrar('pararMotor', vazio, () => {
        exigirLivre();
        motor.parar();
    });
    registrar('configurar', z.tuple([esquemaConfiguracao]), async ([configuracao]) => {
        exigirLivre();
        if (!configuracao.limitesAutomaticos && configuracao.maxTokens > configuracao.contexto / 2) {
            throw new Error('O limite de resposta deve ocupar no máximo metade do contexto.');
        }
        if (['carregando', 'instalando'].includes(motor.estado.fase)) throw new Error('Aguarde a operação do motor.');
        persistencia.dados.configuracao = configuracao;
        await salvar();
        motor.aplicarConfiguracao(configuracao);
    });
    async function enviarMensagem(id: string, texto: string, ids: string[], mensagemId?: string): Promise<void> {
        exigirLivre();
        if (['carregando', 'instalando'].includes(motor.estado.fase)) throw new Error('Aguarde o motor local.');
        const conversa = conversaPorId(id);
        const preparada = mensagemId ? prepararReenvioChat(conversa, mensagemId, texto) : conversa;
        const imagens = mensagemId ? (preparada.mensagens.at(-1)?.imagens ?? []) : anexos.obter(ids);
        if (!texto && !imagens.length) throw new Error('Escreva uma mensagem ou anexe uma imagem.');
        if (!conversa.modeloId) throw new Error('Selecione um modelo GGUF.');
        if (conversa.modo === 'code' && !conversa.projeto) {
            await prepararPastaTrabalho(conversa, app.getPath('userData'));
            await salvar();
        }
        const modelo = persistencia.dados.modelos.find((item) => item.id === conversa.modeloId);
        if (!modelo) throw new Error('Modelo não encontrado.');
        const precisaLigar =
            motor.estado.fase !== 'pronto' ||
            motor.estado.modeloId !== modelo.id ||
            motor.precisaRecarregar(persistencia.dados.configuracao, modelo);
        const indiceResumo = preparada.contextoCompactado
            ? preparada.mensagens.findIndex((mensagem) => mensagem.id === preparada.contextoCompactado!.ateMensagemId)
            : -1;
        const possuiImagens =
            imagens.length || preparada.mensagens.slice(indiceResumo + 1).some((mensagem) => mensagem.imagens?.length);
        tarefa = agente
            .executar(conversa, texto, persistencia.dados.configuracao, imagens, modelo, mensagemId, {
                ligandoModelo: precisaLigar,
                executar: async (sinal) => {
                    sinal.throwIfAborted();
                    if (precisaLigar) await carregarModelo(modelo.id);
                    sinal.throwIfAborted();
                    if (possuiImagens && !motor.estado.suportaImagens) {
                        throw new Error(
                            'O motor está carregado sem suporte visual ativo. ' +
                                'Para modelos importados, vincule o projetor visual compatível nas configurações de Modelos.',
                        );
                    }
                    if (!motor.estado.contextoDisponivel)
                        throw new Error('O motor não informou o contexto disponível.');
                    return {
                        ...persistencia.dados.configuracao,
                        contexto: motor.estado.contextoDisponivel,
                    };
                },
            })
            .catch((erro: Error) => {
                publicar({ tipo: 'erro', erro: `Falha ao persistir a conversa: ${erro.message}` });
            })
            .finally(() => {
                tarefa = null;
                publicarEstado();
            });
        publicarEstado();
        await anexos.descartar(ids);
    }
    registrar('enviar', z.tuple([uuid, z.string().trim().max(30000), z.array(uuid).max(4)]), ([id, texto, ids]) =>
        enviarMensagem(id, texto, ids),
    );
    registrar('editarEReenviar', z.tuple([uuid, uuid, z.string().trim().max(30000)]), ([id, mensagemId, texto]) =>
        enviarMensagem(id, texto, [], mensagemId),
    );
    registrar('regerar', z.tuple([uuid, uuid]), ([id, mensagemId]) => {
        exigirLivre();
        const pedido = obterPedidoParaRegerarChat(conversaPorId(id), mensagemId);
        return enviarMensagem(id, pedido.texto, [], pedido.id);
    });
    registrar('cancelar', vazio, () => {
        agente.cancelar();
        if (['instalando', 'carregando'].includes(motor.estado.fase)) motor.parar();
    });
    registrar('aprovar', z.tuple([z.string().min(1), z.boolean()]), ([id, aprovada]) => agente.aprovar(id, aprovada));
    registrar('exportar', z.tuple([uuid]), async ([id]) => {
        const conversa = conversaPorId(id);
        const escolha = await dialog.showSaveDialog(janela!, {
            defaultPath: `${conversa.titulo.replace(/[<>:"/\\|?*]/g, '').slice(0, 70)}.md`,
            filters: [{ name: 'Markdown', extensions: ['md'] }],
        });
        if (escolha.canceled || !escolha.filePath) return;
        const texto = [`# ${conversa.titulo}`];
        for (const mensagem of conversa.mensagens) {
            texto.push(`## ${mensagem.papel === 'user' ? 'Você' : 'Selene'}\n\n${mensagem.texto}`);
            for (const imagem of mensagem.imagens ?? []) {
                texto.push(`![${imagem.nome.replace(/[\[\]\\]/g, '')}](${await anexos.ler(imagem.id)})`);
            }
            texto.push(
                mensagem.acoes.map((acao) => `### ${acao.nome}: ${acao.estado}\n\n${acao.resultado}`).join('\n\n'),
            );
        }
        await writeFile(escolha.filePath, texto.join('\n\n'), 'utf8');
    });
    ipcMain.on('selene:janela', (evento, acao) => {
        try {
            validarRemetente(evento);
        } catch {
            return;
        }
        if (acao === 'minimizar') janela?.minimize();
        if (acao === 'maximizar') janela?.isMaximized() ? janela.unmaximize() : janela?.maximize();
        if (acao === 'fechar') janela?.close();
    });
}

async function criarJanela(): Promise<void> {
    janela = new BrowserWindow({
        width: 1280,
        height: 840,
        minWidth: 840,
        minHeight: 620,
        frame: false,
        backgroundColor: '#0a0a0a',
        title: 'Selene',
        show: false,
        icon: app.isPackaged ? join(process.resourcesPath, 'selene.ico') : join(__dirname, '../public/selene.ico'),
        webPreferences: {
            preload: join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
        },
    });
    janela.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    janela.webContents.on('will-navigate', (evento, url) => {
        if (url !== urlInterface) evento.preventDefault();
    });
    janela.webContents.session.setPermissionRequestHandler((_conteudo, _permissao, responder) => responder(false));
    janela.once('ready-to-show', () => janela?.show());
    await janela.loadURL(urlInterface);
}

app.whenReady()
    .then(async () => {
        persistencia = new Persistencia(app.getPath('userData'));
        await persistencia.abrir();
        anexos = new AnexosImagens(
            join(app.getPath('userData'), 'attachments'),
            () => persistencia.dados.conversas,
            (bytes) => {
                const imagem = nativeImage.createFromBuffer(bytes);
                if (imagem.isEmpty()) throw new Error('O arquivo não contém uma imagem válida.');
                const { width, height } = imagem.getSize();
                if (width * height > 64 * 1024 ** 2) throw new Error('A imagem excede o limite de resolução.');
                const escala = Math.min(1, 1536 / Math.max(width, height));
                const largura = Math.max(1, Math.round(width * escala));
                const altura = Math.max(1, Math.round(height * escala));
                return { bytes: imagem.resize({ width: largura, height: altura }).toJPEG(85), largura, altura };
            },
        );
        await anexos.preparar();
        motor = new MotorLocal(join(app.getPath('userData'), 'runtime'), publicarEstado);
        await motor.verificar();
        downloads = new DownloadsModelos(join(app.getPath('userData'), 'models'), publicarEstado, registrarDownload);
        await downloads.preparar(catalogoModelos);
        agente = new Agente({
            contextoProjetoChat: (conversa) => contextoProjetoChat(persistencia.dados, conversa),
            completar: (corpo, sinal) => motor.completar(corpo, sinal),
            lerImagem: (id) => anexos.ler(id),
            salvar,
            publicar: (mensagem) => {
                const conversaId =
                    agente.conversaId ??
                    persistencia.dados.conversas.find((conversa) =>
                        conversa.mensagens.some((item) => item.id === mensagem.id),
                    )?.id;
                if (conversaId) publicar({ tipo: 'mensagem', conversaId, mensagem });
                if (!agente.conversaId) publicarEstado();
            },
        });
        registrarOperacoes();
        atualizacoes = new Atualizacoes(
            electronUpdater.autoUpdater,
            app.isPackaged && process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_DIR,
            app.getVersion(),
            publicarEstado,
            prepararEncerramento,
        );
        await criarJanela();
        atualizacoes.iniciar();
    })
    .catch((erro: Error) => {
        dialog.showErrorBox('Selene', erro.message);
        app.quit();
    });
app.on('window-all-closed', () => app.quit());
async function prepararEncerramento(): Promise<void> {
    atualizacoes?.encerrar();
    agente?.cancelar();
    motor?.parar();
    await downloads?.encerrar();
    await tarefa;
    await persistencia.salvar();
}

app.on('before-quit', (evento) => {
    if (encerramentoAutorizado || !persistencia) return;
    evento.preventDefault();
    void prepararEncerramento()
        .catch((erro: Error) => dialog.showErrorBox('Erro ao salvar dados', erro.message))
        .finally(() => {
            encerramentoAutorizado = true;
            app.quit();
        });
});
