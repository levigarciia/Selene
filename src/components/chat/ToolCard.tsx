/**
/**
 * ToolCard Component
 * 
 * Generic card for displaying any tool call with expandable results.
 * Supports different tool types with dynamic icons.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    Globe, 
    Brain, 
    File, 
    Plug, 
    Terminal, 
    Camera, 
    Database,
    Search,
    ChevronDown, 
    ExternalLink,
    AlertCircle,
    Loader2,
    Sun,
    Cloud,
    CloudRain,
    Wind,
    Droplets,
    Trophy,
    MapPin,
    Plus,
    Minus,
    Check,
    Trash2
} from 'lucide-react'
import type { ToolCardData, ToolResultItem, ToolCallStatus } from '../../types/tools'

// ============================================================================
// COMPONENTES DE VISUALIZAÇÃO DE WIDGETS INTERATIVOS
// ============================================================================

interface DadosWidget {
    tipoWidget: string
    [key: string]: unknown
}

interface JogoEsportivoWidget {
    status: string
    timeCasa: string
    golsCasa: string | number
    golsFora: string | number
    timeFora: string
}

interface ClassificacaoWidget {
    pos: string | number
    time: string
    p: string | number
    j: string | number
    v: string | number
    e: string | number
    d: string | number
}

interface IngredienteWidget {
    name: string
    quantity: number
    unit: string
}

interface SerieGraficoWidget {
    label?: string
    value?: number | string
}

function listaTipada<T>(valor: unknown): T[] {
    return Array.isArray(valor) ? valor as T[] : []
}

const WidgetEscolhaOpcoes: React.FC<{ pergunta: unknown; opcoes: unknown }> = ({ pergunta, opcoes }) => {
    const opcoesDisponiveis = listaTipada<string>(opcoes)
    const [clicados, setClicados] = useState<string[]>([])

    const handleOpcaoClick = (opcao: string) => {
        setClicados(prev => [...prev, opcao])
        window.dispatchEvent(new CustomEvent('selene:send-chat-message', {
            detail: { text: opcao }
        }))
    }

    return (
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/40 p-4 backdrop-blur-md my-2 space-y-3">
            <p className="text-sm font-semibold text-neutral-200">{String(pergunta || '')}</p>
            <div className="flex flex-wrap gap-2 pt-1">
                {opcoesDisponiveis.map((opcao, idx) => {
                    const jaClicado = clicados.includes(opcao)
                    return (
                        <button
                            key={idx}
                            disabled={jaClicado}
                            onClick={() => handleOpcaoClick(opcao)}
                            className={`text-xs px-3 py-2 rounded-xl border font-medium transition-all duration-200 flex items-center gap-1.5 ${
                                jaClicado
                                    ? 'bg-purple-500/20 border-purple-500/30 text-purple-400 cursor-default'
                                    : 'bg-neutral-800/40 border-white/5 text-neutral-300 hover:bg-neutral-800 hover:border-white/15 hover:text-white cursor-pointer active:scale-95'
                            }`}
                        >
                            {jaClicado && <Check size={12} className="shrink-0" />}
                            <span>{opcao}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

const WidgetReceita: React.FC<{ dados: DadosWidget }> = ({ dados }) => {
    const titulo = String(dados.titulo || '')
    const porcoesBase = Number(dados.porcoes || 2)
    const [porcoes, setPorcoes] = useState<number>(porcoesBase)
    const ingredientes = listaTipada<IngredienteWidget>(dados.ingredientes)
    const instrucoes = listaTipada<string>(dados.instrucoes)
    const fator = porcoes / porcoesBase

    const formatarQuantidade = (q: number) => {
        const val = q * fator
        if (Number.isInteger(val)) return String(val)
        return val.toFixed(1).replace(/\.0$/, '')
    }

    return (
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/40 p-5 backdrop-blur-md my-2 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h4 className="text-base font-bold text-white tracking-wide">{titulo}</h4>
                <div className="flex items-center gap-2 bg-neutral-950/40 rounded-xl px-2.5 py-1 border border-white/5 shrink-0">
                    <button
                        onClick={() => setPorcoes(p => Math.max(1, p - 1))}
                        className="p-1 rounded hover:bg-white/5 text-neutral-400 hover:text-white transition-colors cursor-pointer active:scale-90"
                    >
                        <Minus size={12} />
                    </button>
                    <span className="text-xs font-mono font-bold text-purple-400 w-16 text-center">{porcoes} {porcoes === 1 ? 'porção' : 'porções'}</span>
                    <button
                        onClick={() => setPorcoes(p => Math.min(20, p + 1))}
                        className="p-1 rounded hover:bg-white/5 text-neutral-400 hover:text-white transition-colors cursor-pointer active:scale-90"
                    >
                        <Plus size={12} />
                    </button>
                </div>
            </div>

            <div className="space-y-1.5">
                <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Ingredientes</h5>
                <ul className="space-y-1">
                    {ingredientes.map((i, idx) => (
                        <li key={idx} className="flex justify-between items-baseline text-xs text-neutral-300">
                            <span>{i.name}</span>
                            <span className="border-b border-dotted border-neutral-700 flex-1 mx-2 h-1"></span>
                            <span className="font-mono text-neutral-400 font-semibold text-right">{formatarQuantidade(i.quantity)} {i.unit}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="space-y-2">
                <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Instruções</h5>
                <ol className="space-y-2">
                    {instrucoes.map((ins, idx) => (
                        <li key={idx} className="flex gap-2.5 text-xs text-neutral-300">
                            <span className="font-mono font-bold text-purple-500 shrink-0">{idx + 1}.</span>
                            <span>{ins}</span>
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    )
}

const WidgetInterativo: React.FC<{ dados: DadosWidget }> = ({ dados }) => {
    // 1. WIDGET DE CLIMA
    if (dados.tipoWidget === 'clima') {
        const temp = Number(dados.temperatura || 0)
        const sensacao = Number(dados.sensacao || temp)
        const umidade = Number(dados.umidade || 0)
        const vento = Number(dados.vento || 0)
        const local = String(dados.local || '')
        const condicao = String(dados.condicao || '')

        const obterIconeClima = (desc: string) => {
            const d = desc.toLowerCase()
            if (d.includes('chuva') || d.includes('garoa') || d.includes('tempestade')) {
                return <CloudRain className="text-blue-400" size={36} />
            }
            if (d.includes('nublado') || d.includes('coberto') || d.includes('névoa') || d.includes('nevoa')) {
                return <Cloud className="text-neutral-400" size={36} />
            }
            return <Sun className="text-yellow-400 animate-pulse" size={36} />
        }

        return (
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/40 p-5 backdrop-blur-md my-2 hover:bg-neutral-900/60 transition-all duration-300">
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="text-base font-semibold text-white tracking-wide">{local}</h4>
                        <p className="text-xs text-neutral-400 capitalize mt-0.5">{condicao}</p>
                    </div>
                    {obterIconeClima(condicao)}
                </div>
                
                <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-white tracking-tighter">{temp}°C</span>
                    <span className="text-xs text-neutral-500">Sensação: {sensacao}°C</span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                    <div className="flex items-center gap-2">
                        <Droplets size={16} className="text-blue-400/80" />
                        <div>
                            <p className="text-[10px] text-neutral-500 uppercase font-medium">Umidade</p>
                            <p className="text-xs font-semibold text-neutral-200">{umidade}%</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Wind size={16} className="text-teal-400/80" />
                        <div>
                            <p className="text-[10px] text-neutral-500 uppercase font-medium">Vento</p>
                            <p className="text-xs font-semibold text-neutral-200">{vento} km/h</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // 2. WIDGET DE ESPORTES
    if (dados.tipoWidget === 'esportes') {
        const jogos = listaTipada<JogoEsportivoWidget>(dados.jogos)
        const classificacao = listaTipada<ClassificacaoWidget>(dados.classificacao)
        const nomeLiga = String(dados.nomeLiga || '')

        return (
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-900/40 p-4 backdrop-blur-md my-2 space-y-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <Trophy className="text-yellow-500" size={16} />
                    <h4 className="text-sm font-bold text-neutral-200">{nomeLiga}</h4>
                </div>

                {/* Jogos */}
                <div className="space-y-2">
                    <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Partidas</h5>
                    <div className="grid gap-2">
                        {jogos.map((j, idx) => {
                            const aoVivo = j.status.toLowerCase().includes('vivo') || j.status.toLowerCase().includes('prorroga')
                            return (
                                <div key={idx} className="flex justify-between items-center bg-neutral-950/30 rounded-xl px-3 py-2 border border-white/5">
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className="text-xs font-semibold text-neutral-200 truncate w-24 text-right">{j.timeCasa}</span>
                                        <span className="text-xs bg-neutral-800 px-2 py-0.5 rounded font-mono text-white">{j.golsCasa}</span>
                                        <span className="text-xs text-neutral-600 font-mono">x</span>
                                        <span className="text-xs bg-neutral-800 px-2 py-0.5 rounded font-mono text-white">{j.golsFora}</span>
                                        <span className="text-xs font-semibold text-neutral-200 truncate w-24 text-left">{j.timeFora}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-2">
                                        {aoVivo && (
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                            </span>
                                        )}
                                        <span className={`text-[10px] ${aoVivo ? 'text-emerald-400 font-bold' : 'text-neutral-500'}`}>{j.status}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Tabela de Classificação */}
                {classificacao.length > 0 && (
                    <div className="space-y-1.5">
                        <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Classificação</h5>
                        <div className="overflow-x-auto rounded-xl border border-white/5 bg-neutral-950/20">
                            <table className="min-w-full text-[11px] text-neutral-300">
                                <thead>
                                    <tr className="border-b border-white/5 bg-neutral-950/40 text-neutral-500 text-[10px] uppercase font-bold text-left">
                                        <th className="py-1 px-3 w-8">#</th>
                                        <th className="py-1 px-2">Clube</th>
                                        <th className="py-1 px-2 text-center w-8">P</th>
                                        <th className="py-1 px-2 text-center w-8">J</th>
                                        <th className="py-1 px-2 text-center w-8">V</th>
                                        <th className="py-1 px-2 text-center w-8">E</th>
                                        <th className="py-1 px-2 text-center w-8">D</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {classificacao.map((c, idx) => (
                                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="py-1.5 px-3 font-mono font-bold text-neutral-500">{c.pos}</td>
                                            <td className="py-1.5 px-2 font-semibold text-neutral-200 truncate max-w-[120px]">{c.time}</td>
                                            <td className="py-1.5 px-2 text-center font-bold text-purple-400">{c.p}</td>
                                            <td className="py-1.5 px-2 text-center font-mono">{c.j}</td>
                                            <td className="py-1.5 px-2 text-center font-mono text-neutral-400">{c.v}</td>
                                            <td className="py-1.5 px-2 text-center font-mono text-neutral-400">{c.e}</td>
                                            <td className="py-1.5 px-2 text-center font-mono text-neutral-400">{c.d}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // 3. WIDGET DE MAPA
    if (dados.tipoWidget === 'mapa') {
        const lat = Number(dados.latitude)
        const lon = Number(dados.longitude)
        const label = String(dados.label || '')
        // Bounding box para iframe embed
        const delta = 0.003
        const bbox = `${lon - delta}%2C${lat - delta}%2C${lon + delta}%2C${lat + delta}`

        return (
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/40 overflow-hidden backdrop-blur-md my-2">
                <iframe
                    width="100%"
                    height="220"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`}
                    style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)' }}
                ></iframe>
                <div className="p-3 flex items-center gap-2 bg-neutral-950/50 text-xs text-neutral-400 border-t border-white/5">
                    <MapPin size={14} className="text-purple-400 shrink-0" />
                    <span className="truncate flex-1 font-semibold text-neutral-300">{label}</span>
                    <span className="text-[10px] text-neutral-500 font-mono">{lat.toFixed(4)}, {lon.toFixed(4)}</span>
                </div>
            </div>
        )
    }

    // 4. WIDGET DE ESCOLHA DE OPÇÕES
    if (dados.tipoWidget === 'escolha-opcoes') {
        return <WidgetEscolhaOpcoes pergunta={dados.pergunta} opcoes={dados.opcoes} />
    }

    // 5. WIDGET DE RECEITA INTERATIVA
    if (dados.tipoWidget === 'receita') {
        return <WidgetReceita dados={dados} />
    }

    // 6. WIDGET DE GRAPH/SVG (VISUALIZE:SHOW_WIDGET)
    if (dados.tipoWidget === 'widget-render') {
        const visual = dados.tipoWidgetVisual
        const titulo = String(dados.titulo || '')
        const dadosGrafico = (dados.dados && typeof dados.dados === 'object' ? dados.dados : {}) as Record<string, unknown>
        const svgContent = typeof dados.conteudoSvg === 'string' ? dados.conteudoSvg : ''

        // Caso A: Renderização de SVG inline
        if ((visual === 'svg' || visual === 'diagram') && svgContent) {
            // Remove scripts por segurança
            const svgLimpo = svgContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

            return (
                <div className="w-full rounded-2xl border border-white/10 bg-neutral-900/40 p-4 backdrop-blur-md my-2 space-y-2">
                    <h4 className="text-xs font-bold text-neutral-400 tracking-wide">{titulo}</h4>
                    <div 
                        className="w-full flex justify-center bg-neutral-950/20 p-2 rounded-xl border border-white/5 overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: svgLimpo }}
                    />
                </div>
            )
        }

        // Caso B: Gráfico CSS Puro (Chart)
        if (visual === 'chart' && dadosGrafico.series && Array.isArray(dadosGrafico.series)) {
            const series = listaTipada<SerieGraficoWidget | number>(dadosGrafico.series)
            const labels = listaTipada<string>(dadosGrafico.labels)
            const maxVal = Math.max(...series.map((s) => Number(typeof s === 'number' ? s : s.value || 0)), 1)

            return (
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/40 p-4 backdrop-blur-md my-2 space-y-3">
                    <h4 className="text-xs font-bold text-neutral-400 tracking-wide">{titulo}</h4>
                    <div className="space-y-2.5 pt-1">
                        {series.map((s, idx) => {
                            const label = (typeof s === 'number' ? undefined : s.label) || labels[idx] || `Item ${idx + 1}`
                            const valor = Number(typeof s === 'number' ? s : s.value || 0)
                            const porcentagem = Math.min(100, Math.max(5, (valor / maxVal) * 100))

                            return (
                                <div key={idx} className="space-y-1">
                                    <div className="flex justify-between text-[11px] text-neutral-300">
                                        <span className="font-medium truncate">{label}</span>
                                        <span className="font-mono font-bold text-purple-400">{valor}</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-neutral-950/60 overflow-hidden border border-white/5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${porcentagem}%` }}
                                            transition={{ duration: 0.8, ease: 'easeOut' }}
                                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )
        }
    }

    // Fallback nulo se não bate com nenhum tipo específico
    return null
}

const renderToolIcon = (iconName: string, className: string) => {
    switch (iconName) {
        case 'Globe':
            return <Globe size={18} className={className} />
        case 'Brain':
            return <Brain size={18} className={className} />
        case 'File':
            return <File size={18} className={className} />
        case 'Plug':
            return <Plug size={18} className={className} />
        case 'Terminal':
            return <Terminal size={18} className={className} />
        case 'Camera':
            return <Camera size={18} className={className} />
        case 'Database':
            return <Database size={18} className={className} />
        case 'Search':
            return <Search size={18} className={className} />
        case 'AlertCircle':
            return <AlertCircle size={18} className={className} />
        case 'Trash':
        case 'Trash2':
            return <Trash2 size={18} className={className} />
        default:
            return <Plug size={18} className={className} />
    }
}

const getStatusColor = (status: ToolCallStatus): string => {
    switch (status) {
        case 'executing':
            return 'text-yellow-400'
        case 'completed':
            return 'text-green-400'
        case 'failed':
            return 'text-red-400'
        case 'cancelled':
            return 'text-neutral-500'
        default:
            return 'text-neutral-400'
    }
}

interface ToolCardProps {
    data: ToolCardData
    onExpand?: () => void
    compact?: boolean
}

export const ToolCard: React.FC<ToolCardProps> = ({
    data,
    onExpand,
    compact = false
}) => {
    const [expanded, setExpanded] = useState(false)
    const isLoading = data.status === 'pending' || data.status === 'executing'
    const hasResults = data.results.length > 0
    const canExpand = hasResults && !isLoading

    const handleClick = () => {
        if (canExpand) {
            setExpanded(!expanded)
            onExpand?.()
        }
    }

    return (
        <div className={`min-w-0 max-w-full ${compact ? 'my-1' : 'my-2'}`}>
            <button
                onClick={handleClick}
                disabled={!canExpand}
                className={`flex w-full min-w-0 max-w-full items-center gap-3 rounded-xl border px-4 ${compact ? 'py-2' : 'py-3'} transition-all ${
                    expanded 
                        ? 'bg-neutral-800/80 border-white/15' 
                        : 'bg-neutral-800/50 border-white/10 hover:bg-neutral-800/70'
                } ${isLoading ? 'animate-pulse' : ''} ${!canExpand ? 'cursor-default' : 'cursor-pointer'}`}
            >
                {isLoading ? (
                    <Loader2 size={18} className="text-purple-400 animate-spin shrink-0" />
                ) : (
                    renderToolIcon(data.toolIcon, `shrink-0 ${getStatusColor(data.status)}`)
                )}
                
                <div className="flex-1 min-w-0 text-left">
                    {data.statusText && (
                        <span className="text-xs text-neutral-400 block mb-1 truncate">
                            {data.statusText}
                        </span>
                    )}
                    <span className={`${compact ? 'text-xs' : 'text-sm'} text-neutral-300 truncate block`}>
                        {data.query}
                    </span>
                    {!compact && data.toolName && (
                        <span className="text-[10px] text-neutral-500">
                            {data.toolName}
                        </span>
                    )}
                </div>
                
                {data.status === 'executing' ? (
                    <span className="text-xs text-neutral-500">executando...</span>
                ) : data.status === 'failed' ? (
                    <div className="flex items-center gap-1 text-xs text-red-400">
                        <AlertCircle size={12} />
                        <span>erro</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                        {data.resultCount > 0 && (
                            <span>{data.resultCount} resultado{data.resultCount !== 1 ? 's' : ''}</span>
                        )}
                        {data.durationMs && (
                            <span className="text-neutral-600">• {(data.durationMs / 1000).toFixed(1)}s</span>
                        )}
                        {canExpand && (
                            <ChevronDown 
                                size={14} 
                                className={`transition-transform ${expanded ? 'rotate-180' : ''}`} 
                            />
                        )}
                    </div>
                )}
            </button>
            
            <AnimatePresence>
                {expanded && hasResults && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-2 ml-4 max-w-full space-y-2 border-l-2 border-neutral-700 pl-4">
                            {data.results.map((result, idx) => (
                                <ToolResultItemView key={idx} result={result} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Error message */}
            {data.status === 'failed' && data.error && (
                <div className="mt-1 ml-4 pl-4 border-l-2 border-red-500/30 py-2">
                    <p className="text-xs text-red-400">{data.error}</p>
                </div>
            )}
        </div>
    )
}

// Individual result item
const ToolResultItemView: React.FC<{ result: ToolResultItem }> = ({ result }) => {
    if (result.type === 'link') {
        return (
            <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors group"
            >
                {result.favicon ? (
                    <img
                        src={result.favicon}
                        alt=""
                        className="w-4 h-4 rounded mt-0.5 shrink-0"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E'
                        }}
                    />
                ) : (
                    <Globe size={14} className="text-neutral-500 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-200 truncate flex-1">
                            {result.title}
                        </span>
                        <ExternalLink 
                            size={12} 
                            className="text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" 
                        />
                    </div>
                    {result.content && (
                        <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">
                            {result.content}
                        </p>
                    )}
                </div>
            </a>
        )
    }

    if (result.type === 'code') {
        return (
            <div className="p-2 rounded-lg bg-neutral-900/50 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                    <Terminal size={12} className="text-neutral-500" />
                    <span className="text-xs text-neutral-400">{result.title}</span>
                </div>
                <pre className="max-w-full overflow-x-auto text-xs text-neutral-300 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-purple-400/40">
                    <code>{result.content}</code>
                </pre>
            </div>
        )
    }

    if (result.type === 'json') {
        // Tenta renderizar um widget interativo se houver JSON estruturado
        let dadosWidget: DadosWidget | null = null
        try {
            const dadosParseados: unknown = JSON.parse(result.content)
            if (dadosParseados && typeof dadosParseados === 'object' && 'tipoWidget' in dadosParseados) {
                dadosWidget = dadosParseados as DadosWidget
            }
        } catch {
            // Em caso de erro, cai na renderização de JSON padrão abaixo
        }

        if (dadosWidget) {
            return <WidgetInterativo dados={dadosWidget} />
        }

        return (
            <div className="p-2 rounded-lg bg-neutral-900/50 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                    <Database size={12} className="text-neutral-500" />
                    <span className="text-xs text-neutral-400">{result.title}</span>
                </div>
                <pre className="max-w-full overflow-x-auto text-xs text-neutral-300 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-purple-400/40">
                    <code>{result.content}</code>
                </pre>
            </div>
        )
    }

    if (result.type === 'error') {
        return (
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2">
                    <AlertCircle size={12} className="text-red-400" />
                    <span className="text-xs text-red-400">{result.title}</span>
                </div>
                {result.content && (
                    <p className="text-xs text-red-300/70 mt-1">{result.content}</p>
                )}
            </div>
        )
    }

    // Default: text
    return (
        <div className="p-2">
            <span className="text-sm text-neutral-200">{result.title}</span>
            {result.content && (
                <p className="text-xs text-neutral-500 mt-0.5">{result.content}</p>
            )}
        </div>
    )
}

export default ToolCard
