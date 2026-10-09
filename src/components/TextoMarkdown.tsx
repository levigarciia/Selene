import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Formata mensagens quando há conteúdo, mantendo HTML arbitrário desativado. */
export default function TextoMarkdown({ texto }: { texto: string }) {
    return (
        <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
                a: ({ children }) => (
                    <span data-ui="texto-link" className="text-[#94b7a5]">
                        {children}
                    </span>
                ),
            }}
        >
            {texto}
        </Markdown>
    );
}
