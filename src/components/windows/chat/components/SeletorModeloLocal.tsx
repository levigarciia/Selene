import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    Brain,
    Check,
    ChevronDown,
    Code2,
    Download,
    Filter,
    List,
    Search,
    Star,
    Trash2,
    Wrench,
} from 'lucide-react'

type ModeloLocal = NonNullable<Awaited<ReturnType<NonNullable<typeof window.electronAPI.localLLM>['listModels']>>['models']>[number]
type FamiliaLocal = ModeloLocal['familia'] | 'todos' | 'favoritos'

interface SeletorModeloLocalProps {
    modeloSelecionado: string
    modeloAtivo: string
    aoSelecionarModelo: (modelo: string) => void
}

// ── Configuração das famílias com logo real ──────────────────
const LOGO_SIMPLE = 'https://cdn.simpleicons.org'
const LOGO_JSDELIVR = 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons'

interface FamiliaVisual {
    id: Exclude<FamiliaLocal, 'todos' | 'favoritos'>
    nome: string
    logoUrl: string
    inverterLogo?: boolean
    dessaturarLogo?: boolean
}

// Logos reais — mesmos CDNs do seletor OpenRouter
const FAMILIAS_VISUAIS: FamiliaVisual[] = [
    {
        id: 'llama',
        nome: 'Llama',
        logoUrl: `${LOGO_SIMPLE}/meta/FFFFFF`,
    },
    {
        id: 'qwen',
        nome: 'Qwen',
        logoUrl: 'https://img.alicdn.com/imgextra/i1/O1CN013ltlI61OTOnTStXfj_!!6000000001706-55-tps-330-327.svg',
        dessaturarLogo: true,
    },
    {
        id: 'gemma',
        nome: 'Gemma',
        logoUrl: `${LOGO_SIMPLE}/googlegemini/FFFFFF`,
    },
    {
        id: 'phi',
        nome: 'Phi',
        logoUrl: `${LOGO_JSDELIVR}/microsoft.svg`,
        inverterLogo: true,
    },
    {
        id: 'deepseek',
        nome: 'DeepSeek',
        logoUrl: `${LOGO_SIMPLE}/deepseek/FFFFFF`,
    },
]

// Mapa rápido para lookup
const FAMILIA_POR_ID = new Map<Exclude<FamiliaLocal, 'todos' | 'favoritos'>, FamiliaVisual>(
    FAMILIAS_VISUAIS.map((f) => [f.id, f])
)

// ── Componente de logo da família ────────────────────────────
const LogoFamilia: React.FC<{
    familiaId: string
    ativo: boolean
    tamanho?: 'normal' | 'pequeno'
}> = ({ familiaId, ativo, tamanho = 'normal' }) => {
    const familia = FAMILIA_POR_ID.get(familiaId as Exclude<FamiliaLocal, 'todos' | 'favoritos'>)
    const dim = tamanho === 'pequeno' ? 'h-4 w-4' : 'h-5 w-5'

    if (!familia) {
        // Fallback para famílias desconhecidas — duas letras
        return (
            <span className={`${dim} flex shrink-0 items-center justify-center text-[9px] font-bold ${ativo ? 'text-white' : 'text-[#596273]'}`}>
                {familiaId.slice(0, 2).toUpperCase()}
            </span>
        )
    }

    return (
        <>
            <img
                src={familia.logoUrl}
                alt=""
                className={`${dim} object-contain transition-opacity ${
                    familia.inverterLogo ? 'invert' : ''
                } ${
                    familia.dessaturarLogo ? 'grayscale brightness-125 contrast-75' : ''
                } ${
                    ativo ? 'opacity-100' : 'opacity-55'
                }`}
                onError={(evento) => {
                    const alvo = evento.currentTarget
                    alvo.style.display = 'none'
                    alvo.nextElementSibling?.classList.remove('hidden')
                }}
            />
            <span className={`hidden ${tamanho === 'pequeno' ? 'h-4 w-4 text-[9px]' : 'text-[10px]'} shrink-0 font-bold ${ativo ? 'text-white' : 'text-[#747b89]'}`}>
                {familia.nome.slice(0, 2).toUpperCase()}
            </span>
        </>
    )
}

// ── Ícone da sidebar ─────────────────────────────────────────
const IconeSidebar: React.FC<{ familiaId: string; ativo: boolean }> = ({ familiaId, ativo }) => {
    const base = 'flex h-9 w-9 items-center justify-center rounded-xl transition-colors'
    const estilo = ativo ? 'bg-white/[0.09]' : 'hover:bg-white/[0.04]'

    return (
        <span className={`${base} ${estilo}`}>
            <span className={ativo ? 'text-white' : 'text-[#87909f]'}>
                <LogoFamilia familiaId={familiaId} ativo={ativo} />
            </span>
        </span>
    )
}

// ── Badge de capacidade — mesmo padrão do seletor OpenRouter ─
const BadgeCapacidade: React.FC<{
    ativo?: boolean
    titulo: string
    children: React.ReactNode
    destaque?: 'verde' | 'roxo' | 'azul'
}> = ({ ativo, titulo, children, destaque = 'verde' }) => {
    const cores = {
        verde: ativo ? 'bg-[#153027] text-[#7dd7aa]' : 'bg-white/[0.035] text-[#3e4755]',
        roxo: ativo ? 'bg-[#211b37] text-[#b8a8ff]' : 'bg-white/[0.035] text-[#3e4755]',
        azul: ativo ? 'bg-[#17253a] text-[#91b9f4]' : 'bg-white/[0.035] text-[#3e4755]',
    }

    return (
        <span
            title={titulo}
            className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${cores[destaque]}`}
        >
            {children}
        </span>
    )
}

// ── Favoritos ────────────────────────────────────────────────
function carregarFavoritos(): string[] {
    try {
        const bruto = localStorage.getItem('selene_modelos_locais_favoritos')
        const parsed = bruto ? JSON.parse(bruto) : []
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch {
        return []
    }
}

function salvarFavoritos(favoritos: string[]): void {
    localStorage.setItem('selene_modelos_locais_favoritos', JSON.stringify(favoritos))
}

// ── Componente principal ─────────────────────────────────────
export const SeletorModeloLocal: React.FC<SeletorModeloLocalProps> = ({
    modeloSelecionado,
    modeloAtivo,
    aoSelecionarModelo,
}) => {
    const [aberto, setAberto] = useState(false)
    const [busca, setBusca] = useState('')
    const [familia, setFamilia] = useState<FamiliaLocal>('todos')
    const [modelos, setModelos] = useState<ModeloLocal[]>([])
    const [favoritos, setFavoritos] = useState<string[]>(carregarFavoritos)
    const [progresso, setProgresso] = useState<Record<string, number>>({})
    const containerRef = useRef<HTMLDivElement | null>(null)
    const inputBuscaRef = useRef<HTMLInputElement | null>(null)

    const modeloResolvido = modeloSelecionado || modeloAtivo || 'qwen3.5-4b-q4'
    const favoritosSet = useMemo(() => new Set(favoritos), [favoritos])
    const modeloAtual = modelos.find((modelo) => modelo.id === modeloResolvido)

    // Famílias disponíveis — extraídas dos modelos carregados
    const familiasDisponiveis = useMemo(() => {
        const ids = new Set(modelos.map((m) => m.familia))
        return FAMILIAS_VISUAIS.filter((f) => ids.has(f.id))
    }, [modelos])

    const recarregar = useCallback(async () => {
        const resposta = await window.electronAPI?.localLLM?.listModels()
        if (resposta?.success && resposta.models) {
            setModelos(resposta.models)
        }
    }, [])

    useEffect(() => {
        const id = window.setTimeout(() => void recarregar(), 0)
        const removerProgresso = window.electronAPI?.localLLM?.onModelProgress((data) => {
            setProgresso((atual) => ({ ...atual, [data.modelId]: data.percent }))
        })
        return () => {
            window.clearTimeout(id)
            removerProgresso?.()
        }
    }, [recarregar])

    useEffect(() => {
        if (!aberto) return
        const lidarClique = (evento: MouseEvent) => {
            if (!containerRef.current?.contains(evento.target as Node)) setAberto(false)
        }
        const lidarTecla = (evento: KeyboardEvent) => {
            if (evento.key === 'Escape') setAberto(false)
        }
        document.addEventListener('mousedown', lidarClique)
        document.addEventListener('keydown', lidarTecla)
        window.setTimeout(() => inputBuscaRef.current?.focus(), 0)
        const id = window.setTimeout(() => void recarregar(), 0)
        return () => {
            window.clearTimeout(id)
            document.removeEventListener('mousedown', lidarClique)
            document.removeEventListener('keydown', lidarTecla)
        }
    }, [aberto, recarregar])

    const modelosFiltrados = useMemo(() => {
        const termo = busca.trim().toLowerCase()
        return modelos.filter((modelo) => {
            if (familia === 'favoritos' && !favoritosSet.has(modelo.id)) return false
            if (familia !== 'todos' && familia !== 'favoritos' && modelo.familia !== familia) return false
            if (!termo) return true
            return modelo.nome.toLowerCase().includes(termo)
                || modelo.id.toLowerCase().includes(termo)
                || modelo.repoId.toLowerCase().includes(termo)
        })
    }, [busca, familia, favoritosSet, modelos])

    const alternarFavorito = (id: string) => {
        setFavoritos((atuais) => {
            const proximos = atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]
            salvarFavoritos(proximos)
            return proximos
        })
    }

    const baixarModelo = async (id: string) => {
        setProgresso((atual) => ({ ...atual, [id]: 1 }))
        await window.electronAPI?.localLLM?.downloadModel(id)
        setProgresso((atual) => {
            const proximo = { ...atual }
            delete proximo[id]
            return proximo
        })
        await recarregar()
    }

    const apagarModelo = async (id: string) => {
        await window.electronAPI?.localLLM?.deleteModel(id)
        await recarregar()
    }

    // Detecta a família do modelo selecionado para abrir na aba certa
    const obterFamiliaDoModelo = (id: string): FamiliaLocal => {
        const modelo = modelos.find((m) => m.id === id)
        return modelo?.familia || 'todos'
    }

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => {
                    const novoValor = !aberto
                    if (novoValor) {
                        const familiaModelo = obterFamiliaDoModelo(modeloResolvido)
                        setFamilia(familiaModelo)
                    }
                    setAberto(novoValor)
                }}
                className={`flex h-7 max-w-[190px] items-center gap-1.5 rounded-lg px-1.5 text-xs transition-colors ${
                    aberto ? 'bg-white/[0.05] text-[#edf1f8]' : 'text-[#9ca6b8] hover:bg-white/[0.04] hover:text-[#d7dce6]'
                }`}
                aria-label="Selecionar modelo local"
            >
                <span className="shrink-0 text-[#9ca6b8]">
                    {modeloAtual
                        ? <LogoFamilia familiaId={modeloAtual.familia} ativo={aberto} tamanho="pequeno" />
                        : <LogoFamilia familiaId="qwen" ativo={aberto} tamanho="pequeno" />
                    }
                </span>
                <span className="min-w-0 truncate">{modeloAtual?.nome || modeloResolvido}</span>
                <ChevronDown size={13} className="shrink-0 opacity-70" />
            </button>

            <AnimatePresence>
                {aberto && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="absolute bottom-full right-0 z-50 mb-3 flex h-[480px] w-[460px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101114] shadow-2xl"
                    >
                        {/* Sidebar — mesmo estilo do OpenRouter */}
                        <aside className="flex w-[58px] shrink-0 flex-col items-center gap-1 border-r border-white/[0.05] bg-[#0d0e11] px-2 py-3">
                            {/* Todos */}
                            <button
                                type="button"
                                onClick={() => setFamilia('todos')}
                                title="Todos os modelos"
                                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                                    familia === 'todos'
                                        ? 'bg-white/[0.09] text-white'
                                        : 'text-[#747b89] hover:bg-white/[0.04] hover:text-[#cfd5df]'
                                }`}
                            >
                                <List size={18} />
                            </button>

                            {/* Favoritos */}
                            <button
                                type="button"
                                onClick={() => setFamilia('favoritos')}
                                title="Favoritos salvos"
                                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                                    familia === 'favoritos'
                                        ? 'bg-white/[0.09] text-[#d0a318]'
                                        : 'text-[#747b89] hover:bg-white/[0.04] hover:text-[#d0a318]'
                                }`}
                            >
                                <Star size={17} className={familia === 'favoritos' ? 'fill-[#d0a318]' : ''} />
                            </button>

                            {/* Separador */}
                            <span className="my-1 h-px w-7 bg-white/[0.07]" />

                            {/* Famílias com logo real */}
                            {familiasDisponiveis.map((fam) => (
                                <button
                                    key={fam.id}
                                    type="button"
                                    onClick={() => setFamilia(fam.id as FamiliaLocal)}
                                    title={fam.nome}
                                >
                                    <IconeSidebar familiaId={fam.id} ativo={familia === fam.id} />
                                </button>
                            ))}
                        </aside>

                        {/* Conteúdo principal */}
                        <div className="flex min-w-0 flex-1 flex-col">
                            {/* Barra de busca */}
                            <div className="border-b border-white/[0.05] p-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex min-w-0 flex-1 items-center gap-2 border-b border-white/[0.08] pb-2">
                                        <Search size={15} className="text-[#7e8797]" />
                                        <input
                                            ref={inputBuscaRef}
                                            value={busca}
                                            onChange={(evento) => setBusca(evento.target.value)}
                                            placeholder="Buscar modelos..."
                                            className="min-w-0 flex-1 bg-transparent text-sm text-[#dfe4ed] outline-none placeholder:text-[#626b7b]"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a93a2] transition-colors hover:bg-white/[0.05] hover:text-white"
                                        title="Use o rail lateral para filtrar por família"
                                    >
                                        <Filter size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* Lista de modelos */}
                            <div className="min-h-0 flex-1 overflow-y-auto py-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
                                {modelosFiltrados.length === 0 ? (
                                    <div className="px-4 py-12 text-center text-sm text-[#717b8d]">
                                        Nenhum modelo encontrado.
                                    </div>
                                ) : modelosFiltrados.map((modelo) => {
                                    const selecionado = modelo.id === modeloResolvido
                                    const baixando = typeof progresso[modelo.id] === 'number' || modelo.downloading

                                    return (
                                        <div
                                            key={modelo.id}
                                            className={`group grid w-full grid-cols-[1fr_auto] gap-3 px-4 py-3 text-left transition-colors ${
                                                selecionado
                                                    ? 'bg-white/[0.06] text-white'
                                                    : 'text-[#9097a4] hover:bg-white/[0.035] hover:text-[#eef2f8]'
                                            }`}
                                        >
                                            {/* Info do modelo */}
                                            <button
                                                type="button"
                                                disabled={!modelo.downloaded}
                                                onClick={() => {
                                                    aoSelecionarModelo(modelo.id)
                                                    setAberto(false)
                                                }}
                                                className="min-w-0 text-left disabled:cursor-not-allowed disabled:opacity-45"
                                            >
                                                <span className="flex min-w-0 items-center gap-2">
                                                    {/* Logo real da família */}
                                                    <span className="shrink-0 text-[#8d95a3]">
                                                        <LogoFamilia familiaId={modelo.familia} ativo={selecionado} tamanho="pequeno" />
                                                    </span>
                                                    <span className={`truncate text-[15px] font-semibold ${selecionado ? 'text-white' : 'text-[#8d929d] group-hover:text-[#f1f3f7]'}`}>
                                                        {modelo.nome}
                                                    </span>
                                                    <span className="shrink-0 text-[11px] text-[#5ed79a]">
                                                        {modelo.tamanhoFormatado}
                                                    </span>
                                                </span>
                                                <span className="mt-1 block truncate text-[12px] text-[#686f7c]">
                                                    {modelo.descricao}
                                                </span>
                                            </button>

                                            {/* Ações e badges */}
                                            <span className="flex items-center gap-2">
                                                {/* Favorito */}
                                                <button
                                                    type="button"
                                                    onClick={() => alternarFavorito(modelo.id)}
                                                    className="flex h-7 w-7 items-center justify-center rounded-full text-[#5b6270] transition-colors hover:bg-white/[0.05] hover:text-[#d0a318]"
                                                    title={favoritosSet.has(modelo.id) ? 'Remover dos favoritos' : 'Salvar como favorito'}
                                                >
                                                    <Star size={14} className={favoritosSet.has(modelo.id) ? 'fill-[#d0a318] text-[#d0a318]' : ''} />
                                                </button>

                                                {/* Badges de capacidades */}
                                                <span className="flex items-center gap-1 rounded-full bg-white/[0.03] px-1.5 py-1">
                                                    <BadgeCapacidade ativo={modelo.capacidades.reasoning} titulo="Reasoning" destaque="roxo">
                                                        <Brain size={13} />
                                                    </BadgeCapacidade>
                                                    <BadgeCapacidade ativo={modelo.capacidades.ferramentas} titulo="Tool calling" destaque="azul">
                                                        <Wrench size={13} />
                                                    </BadgeCapacidade>
                                                    {modelo.capacidades.estruturado && (
                                                        <BadgeCapacidade ativo titulo="Saída estruturada" destaque="roxo">
                                                            <Code2 size={13} />
                                                        </BadgeCapacidade>
                                                    )}
                                                </span>

                                                {/* Download / Apagar */}
                                                {modelo.downloaded ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => apagarModelo(modelo.id)}
                                                        className="flex h-7 w-7 items-center justify-center rounded-full text-[#69707d] transition-colors hover:bg-white/[0.05] hover:text-[#e89ca8]"
                                                        title="Apagar modelo local"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => baixarModelo(modelo.id)}
                                                        disabled={baixando}
                                                        className="flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[#8aa8e8] transition-colors hover:bg-white/[0.05] disabled:text-[#69707d]"
                                                        title="Baixar modelo"
                                                    >
                                                        {baixando ? `${progresso[modelo.id] || 0}%` : <Download size={14} />}
                                                    </button>
                                                )}

                                                {selecionado && <Check size={15} className="text-[#b9c8ff]" />}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
