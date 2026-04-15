import React from 'react'
import type { WebSource } from '../types'

interface FontePillProps {
    rotulo: string
    fonte?: WebSource
}

export const FontePill: React.FC<FontePillProps> = ({ rotulo, fonte }) => {
    const resumoBase = fonte?.resumo?.replace(/\s+/g, ' ').trim() || ''
    const resumoCurto = resumoBase.length > 160 ? `${resumoBase.slice(0, 160)}...` : resumoBase

    return (
        <span className="relative inline-flex group/fonte align-middle">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-900/70 border border-white/10 text-[10px] text-neutral-200">
                {fonte?.favicon ? (
                    <img
                        src={fonte.favicon}
                        alt=""
                        className="w-3 h-3 rounded-full"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E'
                        }}
                    />
                ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-500" />
                )}
                <span className="text-[10px] font-medium">{rotulo}</span>
            </span>
            {fonte && (
                <div className="absolute left-0 top-full mt-2 w-64 z-50 opacity-0 pointer-events-none translate-y-1 group-hover/fonte:opacity-100 group-hover/fonte:pointer-events-auto group-hover/fonte:translate-y-0 transition-all">
                    <a
                        href={fonte.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl bg-neutral-900 border border-white/10 shadow-xl overflow-hidden"
                    >
                        <div className="p-3 space-y-1.5">
                            <div className="flex items-center gap-2">
                                <img
                                    src={fonte.favicon || `https://www.google.com/s2/favicons?domain=${new URL(fonte.url).hostname}&sz=32`}
                                    alt=""
                                    className="w-4 h-4 rounded"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E'
                                    }}
                                />
                                <span className="text-[10px] text-neutral-400 truncate">{fonte.dominio || new URL(fonte.url).hostname}</span>
                            </div>
                            <div className="text-xs text-neutral-200 font-semibold leading-snug">
                                {fonte.title}
                            </div>
                            {resumoCurto && (
                                <div className="text-[11px] text-neutral-400 leading-snug">
                                    {resumoCurto}
                                </div>
                            )}
                        </div>
                    </a>
                </div>
            )}
        </span>
    )
}
