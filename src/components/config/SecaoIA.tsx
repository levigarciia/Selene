/**
 * Seção de IA — provedor, credenciais, modelo e latência.
 * Mostra apenas campos relevantes ao provedor ativo.
 */

import React from 'react'
import { Check } from 'lucide-react'
import { CabecalhoGrupo, Divisor, LinhaConfig, classeInput, classePill } from './ComponentesConfig'
import type { PerfilLatencia } from '../../services/ai/types'

export interface SecaoIAProps {
    apiKey: string; setApiKey: (v: string) => void
    geminiKey: string; setGeminiKey: (v: string) => void
    openRouterKey: string; setOpenRouterKey: (v: string) => void
    provedorAtivo: 'openai' | 'gemini' | 'openrouter' | 'lmstudio'
    setProvedorAtivo: (v: 'openai' | 'gemini' | 'openrouter' | 'lmstudio') => void
    modeloOpenRouter: string; setModeloOpenRouter: (v: string) => void
    modeloLmStudio: string; setModeloLmStudio: (v: string) => void
    baseUrlLmStudio: string; setBaseUrlLmStudio: (v: string) => void
    perfilLatencia: PerfilLatencia; setPerfilLatencia: (v: PerfilLatencia) => void
}

const PROVEDORES = [
    { id: 'openai', label: 'OpenAI' },
    { id: 'gemini', label: 'Gemini' },
    { id: 'openrouter', label: 'OpenRouter' },
    { id: 'lmstudio', label: 'LM Studio' },
] as const

const PERFIS = [
    { id: 'rapido', label: 'Rápido', desc: 'Menor latência, menos contexto extra.' },
    { id: 'equilibrado', label: 'Equilibrado', desc: 'Bom meio-termo para a maioria dos casos.' },
    { id: 'completo', label: 'Completo', desc: 'Mais contexto e assistências, porém mais lento.' },
] as const

export const SecaoIA: React.FC<SecaoIAProps> = (props) => {
    const { provedorAtivo, setProvedorAtivo, perfilLatencia, setPerfilLatencia } = props

    // Campo de API contextual ao provedor ativo
    const campoApi = {
        openai: { label: 'OpenAI API Key', valor: props.apiKey, onChange: props.setApiKey, ph: 'sk-...' },
        gemini: { label: 'Gemini API Key', valor: props.geminiKey, onChange: props.setGeminiKey, ph: 'AIza...' },
        openrouter: { label: 'OpenRouter API Key', valor: props.openRouterKey, onChange: props.setOpenRouterKey, ph: 'sk-or-...' },
        lmstudio: null,
    }[provedorAtivo]

    return (
        <>
            <CabecalhoGrupo titulo="Provedor" />

            <div className="flex flex-wrap gap-2 py-3">
                {PROVEDORES.map((p) => (
                    <button key={p.id} type="button" onClick={() => setProvedorAtivo(p.id)} className={classePill(provedorAtivo === p.id)}>
                        {p.label}
                    </button>
                ))}
            </div>

            {campoApi && (
                <>
                    <Divisor />
                    <LinhaConfig titulo={campoApi.label} vertical>
                        <input type="password" value={campoApi.valor}
                            onChange={(e) => campoApi.onChange(e.target.value)}
                            placeholder={campoApi.ph} className={classeInput} />
                    </LinhaConfig>
                </>
            )}

            {provedorAtivo === 'lmstudio' && (
                <>
                    <Divisor />
                    <p className="py-2 text-[11px] text-[#4e5768]">LM Studio conecta via endpoint local — sem chave necessária.</p>
                </>
            )}

            {/* Modelo — só para provedores que precisam */}
            {(provedorAtivo === 'openrouter' || provedorAtivo === 'lmstudio') && (
                <>
                    <CabecalhoGrupo titulo="Modelo" />
                    {provedorAtivo === 'openrouter' && (
                        <LinhaConfig titulo="Modelo OpenRouter" vertical>
                            <input type="text" value={props.modeloOpenRouter}
                                onChange={(e) => props.setModeloOpenRouter(e.target.value)}
                                placeholder="ex: openai/gpt-4o" className={classeInput} />
                        </LinhaConfig>
                    )}
                    {provedorAtivo === 'lmstudio' && (
                        <>
                            <LinhaConfig titulo="Modelo" vertical>
                                <input type="text" value={props.modeloLmStudio}
                                    onChange={(e) => props.setModeloLmStudio(e.target.value)}
                                    placeholder="ex: local-model-id" className={classeInput} />
                            </LinhaConfig>
                            <Divisor />
                            <LinhaConfig titulo="Endpoint" vertical>
                                <input type="text" value={props.baseUrlLmStudio}
                                    onChange={(e) => props.setBaseUrlLmStudio(e.target.value)}
                                    placeholder="ex: http://localhost:1234/v1" className={classeInput} />
                            </LinhaConfig>
                        </>
                    )}
                </>
            )}

            <CabecalhoGrupo titulo="Perfil de latência" />
            <div className="space-y-1 py-2">
                {PERFIS.map((p) => (
                    <button
                        key={p.id} type="button"
                        onClick={() => setPerfilLatencia(p.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-100 ${
                            perfilLatencia === p.id ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                        }`}
                    >
                        <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            perfilLatencia === p.id ? 'border-white/[0.25] bg-white/[0.12]' : 'border-white/[0.08]'
                        }`}>
                            {perfilLatencia === p.id && <Check size={9} className="text-white" />}
                        </div>
                        <div className="min-w-0">
                            <span className="text-[13px] text-[#cdd4e0]">{p.label}</span>
                            <span className="ml-2 text-[11px] text-[#4e5768]">{p.desc}</span>
                        </div>
                    </button>
                ))}
            </div>
        </>
    )
}
