import { z } from 'zod';
import type { EstadoAtualizacao } from './atualizacoes';
import { esquemaIconeProjeto, type IconeDeProjeto } from './iconesProjetos';
import { esquemaProjetoChat, type ProjetoChat, type EdicaoProjetoChat } from './projetosChat';

export const esquemaBackend = z.enum(['auto', 'cpu', 'vulkan', 'rocm']);
export type BackendMotor = z.infer<typeof esquemaBackend>;
export type BackendRuntime = Exclude<BackendMotor, 'auto'>;
export const esquemaConfiguracao = z.object({
    backend: esquemaBackend.default('auto'),
    limitesAutomaticos: z.boolean().default(true),
    contexto: z.number().int().min(2048).max(16777216).default(8192),
    camadasGpu: z.number().int().min(0).max(999).default(99),
    temperatura: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().min(64).max(32768).default(2048),
    instrucao: z.string().max(20000).default('Responda em português brasileiro. Seja claro e preciso.'),
});
export const esquemaPerfilModelo = esquemaConfiguracao
    .pick({
        backend: true,
        limitesAutomaticos: true,
        contexto: true,
        camadasGpu: true,
    })
    .strict();
export type PerfilModelo = z.infer<typeof esquemaPerfilModelo>;
export const esquemaModelo = z.object({
    id: z.string().uuid(),
    nome: z.string().min(1),
    caminho: z.string().min(1),
    tamanho: z.number().nonnegative(),
    catalogoId: z.string().max(120).optional(),
    projetorVisual: z.string().min(1).optional(),
    perfil: esquemaPerfilModelo.optional(),
});
export const esquemaAcao = z.object({
    id: z.string(),
    nome: z.string(),
    argumentos: z.record(z.string(), z.unknown()),
    estado: z.enum(['preparando', 'aguardando', 'executando', 'concluida', 'recusada', 'erro', 'interrompida']),
    resultado: z.string().default(''),
    previa: z.string().optional(),
    chamadaId: z.string().optional(),
    posicaoTexto: z.number().int().nonnegative().optional(),
});
export const esquemaDesempenho = z.object({
    tokensGerados: z.number().int().nonnegative(),
    tokensEntrada: z.number().int().nonnegative().optional(),
    tokensEntradaCache: z.number().int().nonnegative().optional(),
    tempoGeracaoMs: z.number().nonnegative(),
    tokensPorSegundo: z.number().nonnegative(),
});
export type Desempenho = z.infer<typeof esquemaDesempenho>;
export const esquemaRegistroUso = esquemaDesempenho.extend({
    mensagemId: z.string().uuid(),
    conversaId: z.string().uuid(),
    modo: z.enum(['chat', 'code']),
    modeloId: z.string().uuid().nullable(),
    criadoEm: z.string().datetime(),
});
export type RegistroUso = z.infer<typeof esquemaRegistroUso>;
export const esquemaImagem = z.object({
    id: z.string().uuid(),
    nome: z.string().min(1).max(200),
    mime: z.literal('image/jpeg'),
    tamanho: z
        .number()
        .int()
        .positive()
        .max(4 * 1024 ** 2),
    largura: z.number().int().positive().max(1536),
    altura: z.number().int().positive().max(1536),
});
export const esquemaEntradaImagem = z.object({
    nome: z.string().min(1).max(200),
    dados: z
        .string()
        .max(14 * 1024 ** 2)
        .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
});
export type ImagemAnexada = z.infer<typeof esquemaImagem>;
export type EntradaImagem = z.infer<typeof esquemaEntradaImagem>;
export type ImagemRascunho = ImagemAnexada & { previa: string };
export const esquemaCompactacao = z.object({
    criadoEm: z.string(),
    tokensAntes: z.number().int().nonnegative(),
    tokensDepois: z.number().int().nonnegative(),
});
export const esquemaMensagem = z.object({
    id: z.string().uuid(),
    papel: z.enum(['user', 'assistant']),
    texto: z.string(),
    raciocinio: z.string().optional(),
    faseGeracao: z.enum(['ligandoModelo', 'raciocinando', 'respondendo']).optional(),
    estado: z.enum(['concluida', 'gerando', 'erro', 'interrompida']),
    acoes: z.array(esquemaAcao).default([]),
    criadoEm: z.string(),
    inicioTextoFinal: z.number().int().nonnegative().optional(),
    concluidoEm: z.string().optional(),
    desempenho: esquemaDesempenho.optional(),
    imagens: z.array(esquemaImagem).max(4).optional(),
    faseContexto: z.literal('compactando').optional(),
    compactacoes: z.array(esquemaCompactacao).optional(),
    usoContexto: z.object({ tokens: z.number().int().nonnegative(), limite: z.number().int().positive() }).optional(),
});
export const esquemaConversa = z.object({
    id: z.string().uuid(),
    titulo: z.string().min(1).max(120),
    modo: z.enum(['chat', 'code']),
    projeto: z.string().nullable().default(null),
    projetoId: z.string().uuid().nullable().optional(),
    projetoChatId: z.string().uuid().nullable().optional(),
    rascunho: z.string().max(30000).optional(),
    anexosRascunho: z.number().int().min(0).max(4).optional(),
    pastaTrabalho: z.string().min(1).optional(),
    acessoCompleto: z.boolean().default(false),
    modeloId: z.string().uuid().nullable().default(null),
    nivelRaciocinio: z.enum(['desativado', 'baixo', 'medio', 'alto']).optional(),
    mensagens: z.array(esquemaMensagem).default([]),
    atualizadoEm: z.string(),
    concluida: z.boolean().optional(),
    encerradaEm: z.string().datetime().optional(),
    contextoCompactado: z
        .object({
            resumo: z.string().min(1).max(20000),
            ateMensagemId: z.string().uuid(),
            criadoEm: z.string(),
        })
        .optional(),
});
export const esquemaProjeto = z.object({
    id: z.string().uuid(),
    nome: z.string().trim().min(1).max(100),
    caminho: z.string().min(1),
    origem: z.enum(['pasta', 'criado', 'clonado']).default('pasta'),
    oculto: z.boolean().optional(),
    icone: esquemaIconeProjeto.nullable().optional(),
    criadoEm: z.string().datetime(),
    aviso: z.string().optional(),
});
export type Projeto = z.infer<typeof esquemaProjeto>;
export const esquemaNovoProjeto = z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('pasta') }),
    z.object({ tipo: z.literal('criar'), nome: esquemaProjeto.shape.nome }),
    z.object({ tipo: z.literal('clonar'), url: z.string().trim().min(1).max(2000) }),
]);
export type NovoProjeto = z.infer<typeof esquemaNovoProjeto>;
export const esquemaRascunho = esquemaConversa.pick({
    id: true,
    titulo: true,
    modo: true,
    projeto: true,
    projetoId: true,
    projetoChatId: true,
    modeloId: true,
    nivelRaciocinio: true,
    acessoCompleto: true,
    rascunho: true,
});
export const esquemaDados = z.object({
    versao: z.literal(1),
    perfilMotor: z.literal(1).default(1),
    configuracao: esquemaConfiguracao,
    modelos: z.array(esquemaModelo),
    conversas: z.array(esquemaConversa),
    projetos: z.array(esquemaProjeto).default([]),
    projetosChat: z.array(esquemaProjetoChat).default([]),
    favoritosCatalogo: z.array(z.string().min(1).max(120)).default([]),
    registrosUso: z.array(esquemaRegistroUso).default([]),
});
export type Modelo = z.infer<typeof esquemaModelo>;
export type Configuracao = z.infer<typeof esquemaConfiguracao>;
export type Acao = z.infer<typeof esquemaAcao>;
export type Mensagem = z.infer<typeof esquemaMensagem>;
export type Conversa = z.infer<typeof esquemaConversa>;
export type Dados = z.infer<typeof esquemaDados>;
export type EstadoMotor = {
    fase: 'desligado' | 'instalando' | 'carregando' | 'pronto' | 'erro';
    detalhe: string;
    progresso?: number;
    modeloId?: string;
    instalado: Record<BackendRuntime, boolean>;
    backendAtivo?: BackendRuntime;
    dispositivo?: string;
    recarregamentoPendente?: boolean;
    suportaImagens?: boolean;
    contextoDisponivel?: number;
};
export type DownloadModelo = {
    catalogoId: string;
    fase: 'baixando' | 'verificando' | 'concluido' | 'cancelado' | 'erro';
    recebido: number;
    total: number;
    erro?: string;
};
export type Estado = Dados & {
    atualizacao?: EstadoAtualizacao;
    motor: EstadoMotor;
    conversaEmExecucao: string | null;
    downloads: DownloadModelo[];
};
export type Evento =
    | { tipo: 'navegador'; previa: import('./web').PreviaNavegador }
    | { tipo: 'estado'; estado: Estado }
    | { tipo: 'erro'; erro: string }
    | {
          tipo: 'mensagem';
          conversaId: string;
          mensagem: Mensagem;
      };
export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };
export const esquemaAlteracao = z
    .object({
        titulo: esquemaConversa.shape.titulo,
        modo: esquemaConversa.shape.modo,
        acessoCompleto: z.boolean(),
        modeloId: esquemaModelo.shape.id.nullable(),
        nivelRaciocinio: esquemaConversa.shape.nivelRaciocinio,
        concluida: z.boolean(),
    })
    .partial();

export interface PonteSelene {
    previasNavegador(): Promise<Resultado<import('./web').PreviaNavegador[]>>;
    atualizarNavegador(conversaId: string): Promise<Resultado<import('./web').PreviaNavegador>>;
    consultarHardware(): Promise<Resultado<import('./compatibilidadeModelo').HardwareLocal>>;
    configurarModelo(id: string, perfil: PerfilModelo | null): Promise<Resultado<void>>;
    criarProjetoChat(nome: string): Promise<Resultado<ProjetoChat>>;
    editarProjetoChat(id: string, edicao: EdicaoProjetoChat): Promise<Resultado<void>>;
    removerProjetoChat(id: string): Promise<Resultado<void>>;
    importarArquivosProjetoChat(id: string): Promise<Resultado<void>>;
    removerArquivoProjetoChat(id: string, arquivoId: string): Promise<Resultado<void>>;
    moverConversaProjetoChat(id: string, projetoId: string | null): Promise<Resultado<void>>;
    salvarIconeProjeto(id: string, icone: IconeDeProjeto | null): Promise<Resultado<void>>;
    importarIconeProjeto(id: string): Promise<Resultado<boolean>>;
    adicionarProjeto(entrada: NovoProjeto): Promise<Resultado<Projeto | null>>;
    alterarProjeto(id: string, nome: string): Promise<Resultado<void>>;
    removerProjeto(id: string): Promise<Resultado<void>>;
    promoverRascunho(entrada: z.infer<typeof esquemaRascunho>): Promise<Resultado<Conversa>>;
    verificarAtualizacao(): Promise<Resultado<void>>;
    reiniciarAtualizacao(): Promise<Resultado<void>>;
    abrirRelease(versao?: string): Promise<Resultado<void>>;
    estado(): Promise<Resultado<Estado>>;
    novaConversa(modo: 'chat' | 'code', origemId?: string): Promise<Resultado<Conversa>>;
    alterarConversa(id: string, alteracao: z.infer<typeof esquemaAlteracao>): Promise<Resultado<void>>;
    excluirConversa(id: string): Promise<Resultado<void>>;
    excluirConcluidas(): Promise<Resultado<string[]>>;
    escolherProjeto(id: string, caminho?: string | null): Promise<Resultado<boolean>>;
    importarModelo(): Promise<Resultado<void>>;
    importarProjetor(id: string): Promise<Resultado<void>>;
    anexarImagens(imagens: EntradaImagem[]): Promise<Resultado<ImagemRascunho[]>>;
    lerImagem(id: string): Promise<Resultado<string>>;
    descartarImagens(ids: string[]): Promise<Resultado<void>>;
    baixarModelo(catalogoId: string): Promise<Resultado<void>>;
    cancelarDownload(catalogoId: string): Promise<Resultado<void>>;
    favoritarModelo(catalogoId: string, favorito: boolean): Promise<Resultado<void>>;
    removerModelo(id: string): Promise<Resultado<void>>;
    instalarMotor(backend: BackendMotor): Promise<Resultado<void>>;
    carregarModelo(id: string): Promise<Resultado<void>>;
    pararMotor(): Promise<Resultado<void>>;
    configurar(configuracao: Configuracao): Promise<Resultado<void>>;
    enviar(id: string, texto: string, imagens?: string[]): Promise<Resultado<void>>;
    editarEReenviar(id: string, mensagemId: string, texto: string): Promise<Resultado<void>>;
    regerar(id: string, mensagemId: string): Promise<Resultado<void>>;
    cancelar(): Promise<Resultado<void>>;
    aprovar(acaoId: string, aprovada: boolean): Promise<Resultado<void>>;
    exportarConversa(id: string): Promise<Resultado<void>>;
    janela(acao: 'minimizar' | 'maximizar' | 'fechar'): void;
    aoEvento(callback: (evento: Evento) => void): () => void;
}
