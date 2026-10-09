import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Formata mensagens quando há conteúdo, mantendo HTML arbitrário desativado. */
export default function TextoMarkdown({ texto }: { texto: string }) {
    return (
        <Markdown
            remarkPlugins={[remarkGfm]}
            components={{ a: ({ children }) => <span className="texto-link">{children}</span> }}
        >
            {texto}
        </Markdown>
    );
}
