import type { Evento } from '../../shared/contratos';

/** Recupera o estado ao voltar à rede ou retornar ao navegador no celular. */
export function assinarEventosWeb(callback: (evento: Evento) => void): () => void {
    let eventos: EventSource | undefined;
    let encerrado = false;
    const conexao = (conectado: boolean) =>
        window.dispatchEvent(new CustomEvent('selene:conexao', { detail: conectado }));
    const fechar = () => {
        eventos?.close();
        eventos = undefined;
    };
    const conectar = () => {
        fechar();
        if (encerrado || !navigator.onLine || document.hidden) return;
        const fonte = new EventSource('/api/eventos');
        eventos = fonte;
        fonte.onmessage = (mensagem) => {
            if (!encerrado && eventos === fonte) callback(JSON.parse(mensagem.data) as Evento);
        };
        fonte.onopen = () => {
            conexao(true);
            void window.selene?.previasComputador().then((resultado) => {
                if (encerrado || eventos !== fonte || !resultado.ok) return;
                for (const previa of resultado.valor) callback({ tipo: 'computador', previa });
            }).catch(() => {});
        };
        fonte.onerror = () => {
            conexao(false);
            void fetch('/api/sessao')
                .then((resposta) => {
                    if (!encerrado && eventos === fonte && resposta.status === 401) {
                        fechar();
                        window.dispatchEvent(new Event('selene:sessaoEncerrada'));
                    }
                })
                .catch(() => {});
        };
    };
    const desconectar = () => {
        fechar();
        conexao(false);
    };
    const visibilidade = () => (document.hidden ? fechar() : conectar());
    window.addEventListener('offline', desconectar);
    window.addEventListener('online', conectar);
    document.addEventListener('visibilitychange', visibilidade);
    conectar();
    return () => {
        encerrado = true;
        fechar();
        window.removeEventListener('offline', desconectar);
        window.removeEventListener('online', conectar);
        document.removeEventListener('visibilitychange', visibilidade);
    };
}
