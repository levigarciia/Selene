import React from 'react'
import { CitationLink, type Citation } from './CitationLink'

export function renderTextWithCitations(
    text: string,
    citations: Citation[]
): React.ReactNode[] {
    const citationRegex = /\[(\d+)\]/g
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = citationRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index))
        }

        const number = parseInt(match[1], 10)
        const citation = citations.find((item) => item.marker === `[${number}]`)

        parts.push(
            <CitationLink
                key={`citation-${match.index}`}
                marker={match[0]}
                citation={citation}
            />
        )

        lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex))
    }

    return parts
}
