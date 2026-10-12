import { useEffect } from 'react';
import { GitMergeIcon, GitPullRequestIcon } from '@phosphor-icons/react';
import type { Conversa, PonteSelene } from '../../shared/contratos';
import type { PullRequest } from '../../shared/pullRequests';

const nomesEstados = { aberto: 'Aberto', fechado: 'Fechado', mesclado: 'Mesclado' };
const coresEstados = {
    aberto: 'text-[#7acb9e]',
    fechado: 'text-[#f0b2ae]',
    mesclado: 'text-[#b5a2dc]',
};

/** Mostra o vínculo persistente do PR com acesso direto ao GitHub e o último estado consultado. */
export function LinkPullRequest({
    pr,
    abrir,
    compacto = false,
}: {
    pr: PullRequest;
    abrir?: (url: string) => void;
    compacto?: boolean;
}) {
    const Icone = pr.estado === 'mesclado' ? GitMergeIcon : GitPullRequestIcon;
    const estado = pr.estado ? nomesEstados[pr.estado] : 'Estado ainda não consultado';
    const consulta = pr.atualizadoEm ? ` Consultado em ${new Date(pr.atualizadoEm).toLocaleString('pt-BR')}.` : '';
    return (
        <a
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Pull request ${pr.repositorio} #${pr.numero}`}
            title={`${pr.repositorio} #${pr.numero}${pr.titulo ? `: ${pr.titulo}` : ''}. ${estado}.${consulta}`}
            onClick={(evento) => {
                evento.stopPropagation();
                if (!abrir) return;
                evento.preventDefault();
                abrir(pr.url);
            }}
            className={[
                'inline-flex shrink-0 items-center gap-1 rounded-md hover:bg-hover focus-visible:outline',
                'focus-visible:outline-1 focus-visible:outline-secundario',
                compacto ? 'px-1 text-[10px]' : 'px-2 py-1 text-[12px]',
                pr.estado ? coresEstados[pr.estado] : 'text-secundario',
            ].join(' ')}
        >
            <Icone size={compacto ? 13 : 15} />
            <span>#{pr.numero}</span>
        </a>
    );
}

/** Atualiza os estados enquanto a conversa está aberta, preservando os vínculos sem acesso à rede. */
export function PullRequestsConversa({ conversa, ponte, abrir }: {
    conversa: Conversa; ponte?: PonteSelene; abrir?: (url: string) => void;
}) {
    const quantidade = conversa.pullRequests?.length ?? 0;
    useEffect(() => {
        if (!ponte || !quantidade) return;
        let ativo = true;
        let consultando = false;
        const atualizar = async () => {
            if (!ativo || consultando) return;
            consultando = true;
            try {
                await ponte.atualizarPullRequests(conversa.id);
            } catch {
                return;
            } finally {
                consultando = false;
            }
        };
        void atualizar();
        const intervalo = setInterval(() => void atualizar(), 60000);
        return () => {
            ativo = false;
            clearInterval(intervalo);
        };
    }, [conversa.id, quantidade, ponte]);
    if (!quantidade) return null;
    return (
        <div aria-label="Pull requests da conversa" className="flex max-w-[240px] items-center gap-1 overflow-x-auto">
            {conversa.pullRequests!.map((pr) => (
                <LinkPullRequest
                    key={pr.url}
                    pr={pr}
                    abrir={abrir}
                />
            ))}
        </div>
    );
}
