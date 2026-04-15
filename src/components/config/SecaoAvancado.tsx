/**
 * Seção avançado — overlay inteligente, atalhos e atualizações.
 * Agrupa 3 pequenos grupos em uma única seção.
 */

import React, { useEffect, useState } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import { CabecalhoGrupo, Divisor, LinhaConfig, Toggle, classeInput } from './ComponentesConfig'
import type { ConfiguracaoOverlayProativo, NivelIntervencaoOverlay } from '../../types/overlayProativo'

function construirAtalho(e: React.KeyboardEvent<HTMLInputElement>) {
    e.preventDefault(); e.stopPropagation()
    if (e.key === 'Escape') return ''
    const t: string[] = []
    if (e.ctrlKey) t.push('Ctrl')
    if (e.metaKey) t.push('Meta')
    if (e.altKey) t.push('Alt')
    if (e.shiftKey) t.push('Shift')
    const especiais = ['Control', 'Meta', 'Alt', 'Shift']
    if (!especiais.includes(e.key)) t.push(e.key.length === 1 ? e.key.toUpperCase() : e.key)
    else return ''
    return t.slice(0, 4).join('+')
}

const NIVEIS = [
    { id: 'conservador', label: 'Conservador', desc: 'Forte evidência de travamento ou erro.' },
    { id: 'equilibrado', label: 'Equilibrado', desc: 'Intervenção moderada para dúvidas claras.' },
    { id: 'agressivo', label: 'Agressivo', desc: 'Mais proativo, threshold menor.' },
] as const

export interface SecaoAvancadoProps {
    overlayProativoConfig?: ConfiguracaoOverlayProativo
    setOverlayProativoHabilitado?: (v: boolean) => void
    setOverlayProativoNivelIntervencao?: (v: NivelIntervencaoOverlay) => void
    setOverlayProativoSonecaAte?: (v: number | null) => void
    atalhoGramatical?: string; setAtalhoGramatical?: (v: string) => void
    atalhoScreenshot?: string; setAtalhoScreenshot?: (v: string) => void
}

export const SecaoAvancado: React.FC<SecaoAvancadoProps> = ({
    overlayProativoConfig, setOverlayProativoHabilitado,
    setOverlayProativoNivelIntervencao, setOverlayProativoSonecaAte,
    atalhoGramatical, setAtalhoGramatical,
    atalhoScreenshot, setAtalhoScreenshot,
}) => {
    // Atalhos
    const [capG, setCapG] = useState(false)
    const [capS, setCapS] = useState(false)
    const [prevG, setPrevG] = useState(atalhoGramatical || '')
    const [prevS, setPrevS] = useState(atalhoScreenshot || '')
    useEffect(() => { setPrevG(atalhoGramatical || '') }, [atalhoGramatical])
    useEffect(() => { setPrevS(atalhoScreenshot || '') }, [atalhoScreenshot])

    // Update
    const [autoUpdate, setAutoUpdate] = useState(false)
    const [versao, setVersao] = useState('')
    const [verificando, setVerificando] = useState(false)
    const [statusUp, setStatusUp] = useState<{ status: string; version?: string; progress?: { percent: number }; error?: string } | null>(null)

    useEffect(() => {
        window.electronAPI?.getAutoUpdateStatus?.().then((s: { enabled: boolean }) => setAutoUpdate(s.enabled))
        window.electronAPI?.getAppVersion?.().then((v: string) => setVersao(v))
        const rem = window.electronAPI?.onUpdateStatus?.((s) => { setStatusUp(s); setVerificando(s.status === 'checking') })
        return () => rem?.()
    }, [])

    const sonecaAtiva = Boolean(overlayProativoConfig?.sonecaAte && overlayProativoConfig.sonecaAte > Date.now())

    const handleAtalho = (e: React.KeyboardEvent<HTMLInputElement>, tipo: 'g' | 's') => {
        const at = construirAtalho(e)
        if (tipo === 'g') { setPrevG(at); setAtalhoGramatical?.(at) }
        else { setPrevS(at); setAtalhoScreenshot?.(at) }
    }

    return (
        <>
            {/* Overlay inteligente */}
            {overlayProativoConfig && setOverlayProativoHabilitado && setOverlayProativoNivelIntervencao && (
                <>
                    <CabecalhoGrupo titulo="Overlay inteligente" />
                    <LinhaConfig titulo="Overlay proativo" descricao="Escuta voz + contexto e interfere quando detectar utilidade.">
                        <Toggle ativo={overlayProativoConfig.habilitado} aoAlternar={() => setOverlayProativoHabilitado(!overlayProativoConfig.habilitado)} />
                    </LinhaConfig>
                    <Divisor />

                    <div className="space-y-1 py-2">
                        {NIVEIS.map((n) => (
                            <button key={n.id} type="button" onClick={() => setOverlayProativoNivelIntervencao(n.id)}
                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                                    overlayProativoConfig.nivelIntervencao === n.id ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                                }`}>
                                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                    overlayProativoConfig.nivelIntervencao === n.id ? 'border-white/[0.25] bg-white/[0.12]' : 'border-white/[0.08]'
                                }`}>
                                    {overlayProativoConfig.nivelIntervencao === n.id && <Check size={9} className="text-white" />}
                                </div>
                                <div>
                                    <span className="text-[13px] text-[#cdd4e0]">{n.label}</span>
                                    <span className="ml-2 text-[11px] text-[#4e5768]">{n.desc}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {sonecaAtiva && setOverlayProativoSonecaAte && (
                        <>
                            <Divisor />
                            <LinhaConfig titulo="Soneca ativa" descricao={`Pausado até ${new Date(overlayProativoConfig.sonecaAte!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`}>
                                <button type="button" onClick={() => setOverlayProativoSonecaAte(null)}
                                    className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-[#838d9e] transition-colors hover:bg-white/[0.03]">
                                    Reativar
                                </button>
                            </LinhaConfig>
                        </>
                    )}
                </>
            )}

            {/* Atalhos */}
            {(atalhoGramatical !== undefined || atalhoScreenshot !== undefined) && (
                <>
                    <CabecalhoGrupo titulo="Atalhos" />
                    {atalhoGramatical !== undefined && (
                        <>
                            <LinhaConfig titulo="Assistente gramatical" descricao="Clique no campo e pressione até 4 teclas." vertical>
                                <input value={prevG} readOnly
                                    onFocus={() => setCapG(true)} onBlur={() => setCapG(false)}
                                    onKeyDown={(e) => handleAtalho(e, 'g')}
                                    className={`${classeInput} ${capG ? 'border-white/[0.12]' : ''}`}
                                    placeholder="Ctrl+Alt+X" />
                            </LinhaConfig>
                            <Divisor />
                        </>
                    )}
                    {atalhoScreenshot !== undefined && (
                        <LinhaConfig titulo="Screenshot" descricao="Combinação rápida para perguntas com imagem." vertical>
                            <input value={prevS} readOnly
                                onFocus={() => setCapS(true)} onBlur={() => setCapS(false)}
                                onKeyDown={(e) => handleAtalho(e, 's')}
                                className={`${classeInput} ${capS ? 'border-white/[0.12]' : ''}`}
                                placeholder="Ctrl+Alt+S" />
                        </LinhaConfig>
                    )}
                </>
            )}

            {/* Sistema */}
            <CabecalhoGrupo titulo="Sistema" />
            <LinhaConfig titulo="Atualizações automáticas" descricao="Baixa e instala versões novas automaticamente.">
                <Toggle ativo={autoUpdate} aoAlternar={() => { setAutoUpdate(!autoUpdate); window.electronAPI?.setAutoUpdate?.(!autoUpdate) }} />
            </LinhaConfig>
            <Divisor />
            <LinhaConfig titulo="Versão" descricao={versao || '…'}>
                <button type="button" onClick={async () => { setVerificando(true); try { await window.electronAPI?.checkForUpdates?.() } finally { setTimeout(() => setVerificando(false), 3000) } }}
                    disabled={verificando}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-[#838d9e] transition-colors disabled:opacity-50 hover:bg-white/[0.03]">
                    <RefreshCw size={12} className={verificando ? 'animate-spin' : ''} />
                    {verificando ? 'Verificando…' : 'Verificar'}
                </button>
            </LinhaConfig>

            {statusUp && (
                <div className={`mt-2 rounded-lg px-3 py-2.5 text-xs ${
                    statusUp.status === 'error' ? 'bg-[#1a1012] text-[#c4808f]'
                        : statusUp.status === 'downloaded' ? 'bg-white/[0.03] text-[#cdd4e0]'
                        : 'text-[#838d9e]'
                }`}>
                    {statusUp.status === 'checking' && 'Verificando…'}
                    {statusUp.status === 'not-available' && 'Versão mais recente.'}
                    {statusUp.status === 'available' && `Disponível: ${statusUp.version}`}
                    {statusUp.status === 'downloading' && `Baixando… ${statusUp.progress?.percent.toFixed(0)}%`}
                    {statusUp.status === 'downloaded' && (
                        <span className="flex items-center justify-between">
                            Pronta: {statusUp.version}
                            <button type="button" onClick={() => window.electronAPI?.installUpdate?.()} className="ml-3 rounded-lg border border-white/[0.08] px-2.5 py-1 text-[11px] hover:bg-white/[0.04]">Reiniciar</button>
                        </span>
                    )}
                    {statusUp.status === 'error' && `Erro: ${statusUp.error}`}
                </div>
            )}
        </>
    )
}
