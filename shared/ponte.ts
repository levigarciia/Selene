import type { Evento, PonteSelene, Resultado } from './contratos';

interface Transporte {
    invocar<T>(nome: string, ...argumentos: unknown[]): Promise<Resultado<T>>;
    janela(acao: 'minimizar' | 'maximizar' | 'fechar'): void;
    assinar(callback: (evento: Evento) => void): () => void;
}

/** Mantém os mesmos contratos no desktop e no navegador. */
export function criarPonte(transporte: Transporte): PonteSelene {
    return {
        acessoWeb: () => transporte.invocar('acessoWeb'),
        configurarAcessoWeb: (configuracao) => transporte.invocar('configurarAcessoWeb', configuracao),
        renovarChaveWeb: () => transporte.invocar('renovarChaveWeb'),
        previasNavegador: () => transporte.invocar('previasNavegador'),
        previasComputador: () => transporte.invocar('previasComputador'),
        pararComputador: (id) => transporte.invocar('pararComputador', id),
        atualizarNavegador: (id) => transporte.invocar('atualizarNavegador', id),
        criarProjetoChat: (nome) => transporte.invocar('criarProjetoChat', nome),
        editarProjetoChat: (id, edicao) => transporte.invocar('editarProjetoChat', id, edicao),
        removerProjetoChat: (id) => transporte.invocar('removerProjetoChat', id),
        importarArquivosProjetoChat: (id) => transporte.invocar('importarArquivosProjetoChat', id),
        removerArquivoProjetoChat: (id, arquivoId) => transporte.invocar('removerArquivoProjetoChat', id, arquivoId),
        moverConversaProjetoChat: (id, projetoId) => transporte.invocar('moverConversaProjetoChat', id, projetoId),
        salvarIconeProjeto: (id, icone) => transporte.invocar('salvarIconeProjeto', id, icone),
        importarIconeProjeto: (id) => transporte.invocar('importarIconeProjeto', id),
        adicionarProjeto: (entrada) => transporte.invocar('adicionarProjeto', entrada),
        alterarProjeto: (id, nome) => transporte.invocar('alterarProjeto', id, nome),
        removerProjeto: (id) => transporte.invocar('removerProjeto', id),
        promoverRascunho: (entrada) => transporte.invocar('promoverRascunho', entrada),
        verificarAtualizacao: () => transporte.invocar('verificarAtualizacao'),
        reiniciarAtualizacao: () => transporte.invocar('reiniciarAtualizacao'),
        abrirRelease: (versao) => transporte.invocar('abrirRelease', versao),
        estado: () => transporte.invocar('estado'),
        consultarHardware: () => transporte.invocar('consultarHardware'),
        configurarModelo: (id, perfil) => transporte.invocar('configurarModelo', id, perfil),
        novaConversa: (modo, origemId) => transporte.invocar('nova', modo, origemId),
        alterarConversa: (id, alteracao) => transporte.invocar('alterar', id, alteracao),
        excluirConversa: (id) => transporte.invocar('excluir', id),
        excluirConcluidas: () => transporte.invocar('excluirConcluidas'),
        escolherProjeto: (id, caminho) => transporte.invocar('projeto', id, caminho),
        importarModelo: () => transporte.invocar('importar'),
        importarProjetor: (id) => transporte.invocar('importarProjetor', id),
        anexarImagens: (imagens) => transporte.invocar('anexarImagens', imagens),
        lerImagem: (id) => transporte.invocar('lerImagem', id),
        descartarImagens: (ids) => transporte.invocar('descartarImagens', ids),
        baixarModelo: (id) => transporte.invocar('baixarModelo', id),
        cancelarDownload: (id) => transporte.invocar('cancelarDownload', id),
        favoritarModelo: (id, favorito) => transporte.invocar('favoritarModelo', id, favorito),
        removerModelo: (id) => transporte.invocar('removerModelo', id),
        instalarMotor: (backend) => transporte.invocar('instalar', backend),
        carregarModelo: (id) => transporte.invocar('carregar', id),
        pararMotor: () => transporte.invocar('pararMotor'),
        configurarOpenRouter: (chave) => transporte.invocar('configurarOpenRouter', chave),
        catalogoOpenRouter: (atualizar = false, ordenacao = 'most-popular') =>
            transporte.invocar('catalogoOpenRouter', atualizar, ordenacao),
        cadastrarModeloOpenRouter: (id) => transporte.invocar('cadastrarModeloOpenRouter', id),
        configurar: (configuracao) => transporte.invocar('configurar', configuracao),
        enviar: (id, texto, imagens = []) => transporte.invocar('enviar', id, texto, imagens),
        acompanharCode: (...entrada) => transporte.invocar('acompanharCode', ...entrada),
        gerenciarEnvioCode: (...entrada) => transporte.invocar('gerenciarEnvioCode', ...entrada),
        editarEReenviar: (id, mensagemId, texto) => transporte.invocar('editarEReenviar', id, mensagemId, texto),
        regerar: (id, mensagemId) => transporte.invocar('regerar', id, mensagemId),
        cancelar: () => transporte.invocar('cancelar'),
        aprovar: (id, aprovada) => transporte.invocar('aprovar', id, aprovada),
        exportarConversa: (id) => transporte.invocar('exportar', id),
        janela: (acao) => transporte.janela(acao),
        aoEvento: (callback) => transporte.assinar(callback),
    };
}
