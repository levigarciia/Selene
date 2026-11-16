import { createLibrary, defineComponent, Renderer } from '@openuidev/react-lang';
import { createContext, useContext, useState } from 'react';
import { z } from 'zod/v4';

const ContextoEnvio = createContext<((texto: string) => void) | undefined>(undefined);

const Texto = defineComponent({
    name: 'Texto',
    description: 'Texto explicativo.',
    props: z.object({ conteudo: z.string() }),
    component: ({ props }) => <p className="my-2 whitespace-pre-wrap">{props.conteudo}</p>,
});

const Indicador = defineComponent({
    name: 'Indicador',
    description: 'Indicador com nome e valor.',
    props: z.object({ nome: z.string(), valor: z.string() }),
    component: ({ props }) => (
        <div className="rounded-lg border border-borda p-4">
            <div className="text-xs text-secundario">{props.nome}</div>
            <strong className="text-lg">{props.valor}</strong>
        </div>
    ),
});

const Grafico = defineComponent({
    name: 'Grafico',
    description: 'Gráfico de barras para comparar valores numéricos.',
    props: z.object({ titulo: z.string(), nomes: z.array(z.string()), valores: z.array(z.number()) }),
    component: ({ props }) => {
        const maximo = Math.max(1, ...props.valores.map(Math.abs));
        return (
            <figure className="my-3 rounded-lg border border-borda p-4">
                <figcaption className="mb-3 font-semibold">{props.titulo}</figcaption>
                {props.nomes.map((nome, indice) => (
                    <div key={indice} className="my-2 grid grid-cols-[minmax(70px,1fr)_3fr_auto] items-center gap-2">
                        <span>{nome}</span>
                        <progress className="w-full accent-[#b5a2dc]" max={maximo} value={Math.abs(props.valores[indice] ?? 0)} />
                        <span>{props.valores[indice] ?? 0}</span>
                    </div>
                ))}
            </figure>
        );
    },
});

const Pergunta = defineComponent({
    name: 'Pergunta',
    description: 'Pergunta com campo editável e envio à conversa.',
    props: z.object({ pergunta: z.string() }),
    component: ({ props }) => {
        const enviar = useContext(ContextoEnvio);
        const [valor, definirValor] = useState('');
        return (
            <form className="my-3 flex flex-col gap-2" onSubmit={(evento) => {
                evento.preventDefault();
                if (valor.trim() && enviar) enviar(`${props.pergunta}\n${valor.trim()}`);
            }}>
                <label>{props.pergunta}<input className="mt-2 w-full rounded border border-borda bg-transparent p-2"
                    value={valor} onChange={(evento) => definirValor(evento.target.value)} /></label>
                <button type="submit" disabled={!enviar || !valor.trim()}
                    className="self-start rounded border border-borda px-3 py-1 disabled:opacity-40">Enviar</button>
            </form>
        );
    },
});

const Painel = defineComponent({
    name: 'Painel',
    description: 'Agrupa os componentes da interface.',
    props: z.object({ itens: z.array(z.union([Texto.ref, Indicador.ref, Grafico.ref, Pergunta.ref])) }),
    component: ({ props, renderNode }) => <div className="space-y-3">{renderNode(props.itens)}</div>,
});

const biblioteca = createLibrary({ root: 'Painel', components: [Painel, Texto, Indicador, Grafico, Pergunta] });

/** Apresenta uma interface OpenUI com componentes locais e envio pela conversa existente. */
export default function InterfaceOpenUI({ codigo, gerando, enviar }: {
    codigo: string;
    gerando: boolean;
    enviar?: (texto: string) => void;
}) {
    const [erro, definirErro] = useState(false);
    return <ContextoEnvio.Provider value={gerando ? undefined : enviar}>
        <Renderer response={codigo} library={biblioteca} isStreaming={gerando} publishObservability={false}
            onError={(erros) => definirErro(erros.some((item) => item.severity !== 'warning'))} />
        {erro && !gerando && <details className="text-sm text-secundario">
            <summary>Não foi possível apresentar toda a interface</summary>
            <pre className="overflow-auto whitespace-pre-wrap">{codigo}</pre>
        </details>}
    </ContextoEnvio.Provider>;
}

