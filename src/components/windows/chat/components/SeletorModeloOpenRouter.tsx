import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    Brain,
    Check,
    ChevronDown,
    Code2,
    Eye,
    FileText,
    Filter,
    Image as ImageIcon,
    List,
    Search,
    Star,
    Wrench,
} from 'lucide-react'

interface CapacidadesModelo {
    imagem?: boolean
    documento?: boolean
    reasoning?: boolean
    ferramentas?: boolean
    estruturado?: boolean
    imagemGeracao?: boolean
}

interface ModeloFixoOpenRouter {
    rotulo: string
    slug: string
    descricao: string
    preco: '$' | '$$' | '$$$'
    favorito?: boolean
    indisponivel?: boolean
    capacidades: CapacidadesModelo
}

interface ProvedorFixoOpenRouter {
    id: string
    nome: string
    logoUrl: string
    inverterLogo?: boolean
    dessaturarLogo?: boolean
    iconeSvg?: 'zai'
    modelos: ModeloFixoOpenRouter[]
}

interface SeletorModeloOpenRouterProps {
    modeloSelecionado: string
    modeloAtivo: string
    openRouterKey: string
    aoSelecionarModelo: (modelo: string) => void
}

const LOGO_SIMPLE = 'https://cdn.simpleicons.org'
const LOGO_JSDELIVR = 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons'

const PROVEDORES: ProvedorFixoOpenRouter[] = [
    {
        id: 'openai',
        nome: 'OpenAI',
        logoUrl: `${LOGO_JSDELIVR}/openai.svg`,
        inverterLogo: true,
        modelos: [
            modelo('GPT-5.5', 'openai/gpt-5.5', 'OpenAI general-purpose model', '$$$', {
                reasoning: true,
                ferramentas: true,
                estruturado: true,
            }, true),
            modelo('GPT-5.4', 'openai/gpt-5.4', 'Fast OpenAI model for everyday chat and tools', '$$$', {
                reasoning: true,
                ferramentas: true,
                estruturado: true,
            }, true),
            modelo('GPT OSS 20B', 'openai/gpt-oss-20b', 'OpenAI open-weight model', '$', {
                reasoning: true,
                ferramentas: true,
            }),
        ],
    },
    {
        id: 'anthropic',
        nome: 'Anthropic',
        logoUrl: `${LOGO_SIMPLE}/anthropic/FFFFFF`,
        modelos: [
            modelo('Claude Sonnet 4.6', 'anthropic/claude-sonnet-4.6', 'Anthropic Sonnet model for real-world work', '$$$', {
                imagem: true,
                documento: true,
                reasoning: true,
                ferramentas: true,
            }, true),
            modelo('Claude Opus 4.8', 'anthropic/claude-opus-4.8', 'Anthropic Opus model for demanding reasoning', '$$$', {
                imagem: true,
                documento: true,
                reasoning: true,
                ferramentas: true,
            }, true),
            modelo('Claude Haiku 4.5', 'anthropic/claude-haiku-4.5', 'Fast Anthropic model for concise work', '$$', {
                imagem: true,
                documento: true,
                ferramentas: true,
            }),
        ],
    },
    {
        id: 'google',
        nome: 'Gemini',
        logoUrl: `${LOGO_SIMPLE}/googlegemini/FFFFFF`,
        modelos: [
            modelo('3 Flash', 'google/gemini-3-flash-preview', 'Lightning-fast model with strong multimodal capability', '$', {
                imagem: true,
                documento: true,
                reasoning: true,
                ferramentas: true,
            }, true),
            modelo('3.5 Flash', 'google/gemini-3.5-flash', 'Next-gen Flash speed with stronger quality', '$$', {
                imagem: true,
                documento: true,
                reasoning: true,
                ferramentas: true,
            }, true),
        ],
    },
    {
        id: 'deepseek',
        nome: 'DeepSeek',
        logoUrl: `${LOGO_SIMPLE}/deepseek/FFFFFF`,
        modelos: [
            modelo('v4 Flash', 'deepseek/deepseek-v4-flash', 'Efficiency-optimized DeepSeek model', '$', {
                reasoning: true,
                ferramentas: true,
                estruturado: true,
            }, true),
            modelo('v4 Pro', 'deepseek/deepseek-v4-pro', 'Higher-quality DeepSeek model', '$$', {
                reasoning: true,
                ferramentas: true,
                estruturado: true,
            }),
        ],
    },
    {
        id: 'alibaba',
        nome: 'Alibaba',
        logoUrl: 'https://img.alicdn.com/imgextra/i1/O1CN013ltlI61OTOnTStXfj_!!6000000001706-55-tps-330-327.svg',
        dessaturarLogo: true,
        modelos: [
            modelo('Qwen 3.5 9B', 'qwen/qwen3.5-9b', 'Compact Qwen model for fast chat', '$', {
                ferramentas: true,
            }),
            modelo('Qwen 3.6 Plus', 'qwen/qwen3.6-plus', 'Balanced Qwen model for general use', '$$', {
                reasoning: true,
                ferramentas: true,
            }),
            modelo('Qwen 3.7 Max', 'qwen/qwen3.7-max', 'Large Qwen model for higher quality', '$$$', {
                reasoning: true,
                ferramentas: true,
                estruturado: true,
            }, true),
        ],
    },
    {
        id: 'moonshot',
        nome: 'Moonshot',
        logoUrl: `${LOGO_SIMPLE}/moonshotai/FFFFFF`,
        modelos: [
            modelo('Kimi K2', 'moonshotai/kimi-k2', 'Moonshot Kimi model for long-form work', '$$', {
                ferramentas: true,
            }),
            modelo('Kimi K2.5', 'moonshotai/kimi-k2.5', 'Updated Kimi model for stronger chat', '$$', {
                reasoning: true,
                ferramentas: true,
            }),
            modelo('Kimi K2.6', 'moonshotai/kimi-k2.6', 'Latest Kimi model for agentic work', '$$', {
                reasoning: true,
                ferramentas: true,
                estruturado: true,
            }, true),
        ],
    },
    {
        id: 'z-ai',
        nome: 'Z.AI',
        logoUrl: 'https://z-cdn.chatglm.cn/z-ai/static/logo.svg',
        dessaturarLogo: true,
        iconeSvg: 'zai',
        modelos: [
            modelo('GLM 5.1', 'z-ai/glm-5.1', 'Z.ai GLM model for reasoning and tools', '$$', {
                reasoning: true,
                ferramentas: true,
            }, true),
            modelo('GLM 5V Turbo', 'z-ai/glm-5v-turbo', 'Ainda não listado no OpenRouter', '$$', {
                imagem: true,
                reasoning: true,
            }, false, true),
        ],
    },
    {
        id: 'xiaomi',
        nome: 'Xiaomi',
        logoUrl: `${LOGO_SIMPLE}/xiaomi/FFFFFF`,
        modelos: [
            modelo('Mimo 2.5', 'xiaomi/mimo-v2.5', 'Xiaomi MiMo model for general chat', '$$', {
                reasoning: true,
                ferramentas: true,
            }, true),
            modelo('Mimo 2.5 Pro', 'xiaomi/mimo-v2.5-pro', 'Higher-quality Xiaomi MiMo model', '$$', {
                reasoning: true,
                ferramentas: true,
                estruturado: true,
            }),
            modelo('Mimo 2 Flash', 'xiaomi/mimo-v2-flash', 'Fast Xiaomi MiMo model', '$', {
                ferramentas: true,
            }),
        ],
    },
    {
        id: 'openrouter',
        nome: 'OpenRouter',
        logoUrl: `${LOGO_SIMPLE}/openrouter/FFFFFF`,
        modelos: [
            modelo('Owl Alpha', 'openrouter/owl-alpha', 'OpenRouter experimental model', '$$', {
                reasoning: true,
                ferramentas: true,
            }, true),
            modelo('Free', 'openrouter/free', 'Roteia para modelos gratuitos compatíveis', '$', {
                ferramentas: true,
            }, true),
            modelo('Auto', 'openrouter/auto', 'Escolhe automaticamente o melhor endpoint disponível', '$$', {
                ferramentas: true,
                estruturado: true,
            }, true),
        ],
    },
]

function modelo(
    rotulo: string,
    slug: string,
    descricao: string,
    preco: '$' | '$$' | '$$$',
    capacidades: CapacidadesModelo,
    favorito = false,
    indisponivel = false
): ModeloFixoOpenRouter {
    return {
        rotulo,
        slug,
        descricao,
        preco,
        capacidades,
        favorito,
        indisponivel,
    }
}

function obterRotuloBotao(modeloSelecionado: string, modeloAtivo: string): string {
    const modeloAtual = modeloSelecionado.trim() || modeloAtivo || 'openrouter/auto'
    const encontrado = PROVEDORES
        .flatMap((provedor) => provedor.modelos)
        .find((modeloItem) => modeloItem.slug === modeloAtual)

    if (encontrado) return encontrado.rotulo

    const slug = modeloAtual.split('/').at(-1) || modeloAtual
    return slug.replace(':free', '')
}

function obterProvedorDoModelo(slug: string): string | null {
    return PROVEDORES.find((provedor) => (
        provedor.modelos.some((modeloItem) => modeloItem.slug === slug)
    ))?.id || null
}

function obterProvedorCompletoDoModelo(slug: string): ProvedorFixoOpenRouter {
    return PROVEDORES.find((provedor) => (
        provedor.modelos.some((modeloItem) => modeloItem.slug === slug)
    )) || PROVEDORES[0]
}

function carregarFavoritos(): string[] {
    try {
        const bruto = localStorage.getItem('selene_openrouter_modelos_favoritos')
        const parsed = bruto ? JSON.parse(bruto) : []
        return Array.isArray(parsed) ? parsed.filter((valor): valor is string => typeof valor === 'string') : []
    } catch {
        return []
    }
}

function salvarFavoritos(favoritos: string[]): void {
    try {
        localStorage.setItem('selene_openrouter_modelos_favoritos', JSON.stringify(favoritos))
    } catch (erro) {
        console.warn('[SeletorModeloOpenRouter] Falha ao salvar favoritos:', erro)
    }
}

const MarcaProvedor: React.FC<{ provedor: ProvedorFixoOpenRouter; ativo?: boolean; pequeno?: boolean }> = ({
    provedor,
    ativo,
    pequeno,
}) => {
    const tamanho = pequeno ? 'h-4 w-4' : 'h-5 w-5'

    if (provedor.iconeSvg === 'zai') {
        return (
            <svg
                viewBox="0 0 30 30"
                aria-hidden="true"
                className={`${tamanho} object-contain transition-opacity ${ativo ? 'opacity-100' : 'opacity-60'}`}
            >
                <path fill="currentColor" d="M15.47,7.1l-1.3,1.85c-0.2,0.29-0.54,0.47-0.9,0.47h-7.1V7.09C6.16,7.1,15.47,7.1,15.47,7.1z" />
                <path fill="currentColor" d="M24.3,7.1 13.14,22.91 5.7,22.91 16.86,7.1z" />
                <path fill="currentColor" d="M14.53,22.91l1.31-1.86c0.2-0.29,0.54-0.47,0.9-0.47h7.09v2.33H14.53z" />
            </svg>
        )
    }

    return (
        <>
            <img
                src={provedor.logoUrl}
                alt=""
                className={`${tamanho} object-contain transition-opacity ${
                    provedor.inverterLogo ? 'invert' : ''
                } ${
                    provedor.dessaturarLogo ? 'grayscale brightness-125 contrast-75' : ''
                } ${
                    ativo ? 'opacity-100' : 'opacity-55'
                }`}
                onError={(evento) => {
                    const alvo = evento.currentTarget
                    alvo.style.display = 'none'
                    alvo.nextElementSibling?.classList.remove('hidden')
                }}
            />
            <span className={`hidden ${pequeno ? 'h-4 w-4 text-[9px]' : 'text-[10px]'} shrink-0 font-bold ${ativo ? 'text-white' : 'text-[#747b89]'}`}>
                {provedor.nome.slice(0, 2).toUpperCase()}
            </span>
        </>
    )
}

const LogoProvedor: React.FC<{ provedor: ProvedorFixoOpenRouter; ativo: boolean }> = ({ provedor, ativo }) => (
    <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
            ativo
                ? 'bg-white/[0.09]'
                : 'hover:bg-white/[0.04]'
        }`}
    >
        <span className={ativo ? 'text-white' : 'text-[#87909f]'}>
            <MarcaProvedor provedor={provedor} ativo={ativo} />
        </span>
    </span>
)

const BotaoCapacidade: React.FC<{
    ativo?: boolean
    titulo: string
    children: React.ReactNode
    destaque?: 'verde' | 'roxo' | 'azul' | 'laranja'
}> = ({ ativo, titulo, children, destaque = 'verde' }) => {
    const cores = {
        verde: ativo ? 'bg-[#153027] text-[#7dd7aa]' : 'bg-white/[0.035] text-[#3e4755]',
        roxo: ativo ? 'bg-[#211b37] text-[#b8a8ff]' : 'bg-white/[0.035] text-[#3e4755]',
        azul: ativo ? 'bg-[#17253a] text-[#91b9f4]' : 'bg-white/[0.035] text-[#3e4755]',
        laranja: ativo ? 'bg-[#342217] text-[#d8a16a]' : 'bg-white/[0.035] text-[#3e4755]',
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

export const SeletorModeloOpenRouter: React.FC<SeletorModeloOpenRouterProps> = ({
    modeloSelecionado,
    modeloAtivo,
    aoSelecionarModelo,
}) => {
    const [aberto, setAberto] = useState(false)
    const [busca, setBusca] = useState('')
    const [provedorSelecionado, setProvedorSelecionado] = useState(PROVEDORES[0].id)
    const [favoritos, setFavoritos] = useState<string[]>(carregarFavoritos)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const inputBuscaRef = useRef<HTMLInputElement | null>(null)

    const modeloResolvido = modeloSelecionado.trim() || modeloAtivo || 'openrouter/auto'
    const rotuloBotao = obterRotuloBotao(modeloSelecionado, modeloAtivo)
    const provedorModeloResolvido = obterProvedorCompletoDoModelo(modeloResolvido)
    const provedorAtivo = PROVEDORES.find((provedor) => provedor.id === provedorSelecionado) || PROVEDORES[0]
    const favoritosSet = useMemo(() => new Set(favoritos), [favoritos])

    useEffect(() => {
        if (!aberto) return

        const lidarComClique = (evento: MouseEvent) => {
            if (!containerRef.current?.contains(evento.target as Node)) {
                setAberto(false)
            }
        }
        const lidarComTecla = (evento: KeyboardEvent) => {
            if (evento.key === 'Escape') {
                setAberto(false)
            }
        }

        document.addEventListener('mousedown', lidarComClique)
        document.addEventListener('keydown', lidarComTecla)
        window.setTimeout(() => inputBuscaRef.current?.focus(), 0)

        return () => {
            document.removeEventListener('mousedown', lidarComClique)
            document.removeEventListener('keydown', lidarComTecla)
        }
    }, [aberto])

    const modelosFiltrados = useMemo(() => {
        const termo = busca.trim().toLowerCase()
        const todosModelos = PROVEDORES.flatMap((provedor) => (
            provedor.modelos.map((modeloItem) => ({ ...modeloItem, provedor }))
        ))
        const modelos = provedorSelecionado === 'todos'
            ? todosModelos
            : provedorSelecionado === 'favoritos'
            ? todosModelos.filter((modeloItem) => favoritosSet.has(modeloItem.slug))
            : provedorAtivo.modelos.map((modeloItem) => ({ ...modeloItem, provedor: provedorAtivo }))

        return modelos.filter((modeloItem) => {
            if (!termo) return true
            return modeloItem.rotulo.toLowerCase().includes(termo)
                || modeloItem.slug.toLowerCase().includes(termo)
                || modeloItem.provedor.nome.toLowerCase().includes(termo)
        })
    }, [busca, favoritosSet, provedorAtivo, provedorSelecionado])

    const alternarFavorito = (slug: string) => {
        setFavoritos((atuais) => {
            const proximos = atuais.includes(slug)
                ? atuais.filter((item) => item !== slug)
                : [...atuais, slug]
            salvarFavoritos(proximos)
            return proximos
        })
    }

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => {
                    const novoValor = !aberto
                    const provedorDoModelo = obterProvedorDoModelo(modeloResolvido)
                    if (novoValor && provedorDoModelo) {
                        setProvedorSelecionado(provedorDoModelo)
                    }
                    setAberto(novoValor)
                }}
                className={`flex h-7 max-w-[190px] items-center gap-1.5 rounded-lg px-1.5 text-xs transition-colors ${
                    aberto
                        ? 'bg-white/[0.05] text-[#edf1f8]'
                        : 'text-[#9ca6b8] hover:bg-white/[0.04] hover:text-[#d7dce6]'
                }`}
                aria-label="Selecionar modelo OpenRouter"
            >
                <span className="shrink-0 text-[#9ca6b8]">
                    <MarcaProvedor provedor={provedorModeloResolvido} ativo={aberto} pequeno />
                </span>
                <span className="min-w-0 truncate">{rotuloBotao}</span>
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
                        <aside className="flex w-[58px] shrink-0 flex-col items-center gap-1 border-r border-white/[0.05] bg-[#0d0e11] px-2 py-3">
                            <button
                                type="button"
                                onClick={() => setProvedorSelecionado('todos')}
                                title="Todos os modelos"
                                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                                    provedorSelecionado === 'todos'
                                        ? 'bg-white/[0.09] text-white'
                                        : 'text-[#747b89] hover:bg-white/[0.04] hover:text-[#cfd5df]'
                                }`}
                            >
                                <List size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setProvedorSelecionado('favoritos')}
                                title="Favoritos salvos"
                                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                                    provedorSelecionado === 'favoritos'
                                        ? 'bg-white/[0.09] text-[#d0a318]'
                                        : 'text-[#747b89] hover:bg-white/[0.04] hover:text-[#d0a318]'
                                }`}
                            >
                                <Star size={17} className={provedorSelecionado === 'favoritos' ? 'fill-[#d0a318]' : ''} />
                            </button>
                            <span className="my-1 h-px w-7 bg-white/[0.07]" />
                            {PROVEDORES.map((provedor) => (
                                <button
                                    key={provedor.id}
                                    type="button"
                                    onClick={() => setProvedorSelecionado(provedor.id)}
                                    title={provedor.nome}
                                >
                                    <LogoProvedor provedor={provedor} ativo={provedorSelecionado === provedor.id} />
                                </button>
                            ))}
                        </aside>

                        <div className="flex min-w-0 flex-1 flex-col">
                            <div className="border-b border-white/[0.05] p-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex min-w-0 flex-1 items-center gap-2 border-b border-white/[0.08] pb-2">
                                        <Search size={15} className="text-[#7e8797]" />
                                        <input
                                            ref={inputBuscaRef}
                                            value={busca}
                                            onChange={(evento) => setBusca(evento.target.value)}
                                            placeholder="Search models..."
                                            className="min-w-0 flex-1 bg-transparent text-sm text-[#dfe4ed] outline-none placeholder:text-[#626b7b]"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a93a2] transition-colors hover:bg-white/[0.05] hover:text-white"
                                        title="Use o rail lateral para filtrar por empresa"
                                    >
                                        <Filter size={15} />
                                    </button>
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto py-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
                                {modelosFiltrados.length === 0 ? (
                                    <div className="px-4 py-12 text-center text-sm text-[#717b8d]">
                                        Nenhum modelo encontrado.
                                    </div>
                                ) : modelosFiltrados.map((modeloItem) => {
                                    const selecionado = modeloItem.slug === modeloResolvido
                                    const favoritoSalvo = favoritosSet.has(modeloItem.slug)

                                    return (
                                        <div
                                            key={`${modeloItem.provedor.id}-${modeloItem.slug}`}
                                            className={`group grid w-full grid-cols-[1fr_auto] gap-3 px-4 py-3 text-left transition-colors ${
                                                selecionado
                                                    ? 'bg-white/[0.06] text-white'
                                                    : 'text-[#9097a4] hover:bg-white/[0.035] hover:text-[#eef2f8]'
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                disabled={modeloItem.indisponivel}
                                                onClick={() => {
                                                    if (modeloItem.indisponivel) return
                                                    aoSelecionarModelo(modeloItem.slug)
                                                    setAberto(false)
                                                }}
                                                className="min-w-0 text-left disabled:cursor-not-allowed disabled:opacity-45"
                                            >
                                                <span className="flex min-w-0 items-center gap-2">
                                                    <span className="shrink-0 text-[#8d95a3]">
                                                        <MarcaProvedor provedor={modeloItem.provedor} ativo={selecionado} pequeno />
                                                    </span>
                                                    <span className={`truncate text-[15px] font-semibold ${selecionado ? 'text-white' : 'text-[#8d929d] group-hover:text-[#f1f3f7]'}`}>
                                                        {modeloItem.rotulo}
                                                    </span>
                                                    <span className={`shrink-0 text-[11px] ${modeloItem.preco === '$' ? 'text-[#5ed79a]' : 'text-[#b95f67]'}`}>
                                                        {modeloItem.preco}
                                                    </span>
                                                </span>
                                                <span className="mt-1 block truncate text-[12px] text-[#686f7c]">
                                                    {modeloItem.indisponivel ? 'Indisponível no OpenRouter agora' : modeloItem.descricao}
                                                </span>
                                            </button>

                                            <span className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => alternarFavorito(modeloItem.slug)}
                                                    className="flex h-7 w-7 items-center justify-center rounded-full text-[#5b6270] transition-colors hover:bg-white/[0.05] hover:text-[#d0a318]"
                                                    title={favoritoSalvo ? 'Remover dos favoritos' : 'Salvar como favorito'}
                                                >
                                                    <Star
                                                        size={14}
                                                        className={favoritoSalvo ? 'fill-[#d0a318] text-[#d0a318]' : ''}
                                                    />
                                                </button>
                                                <span className="flex items-center gap-1 rounded-full bg-white/[0.03] px-1.5 py-1">
                                                    <BotaoCapacidade ativo={modeloItem.capacidades.imagem} titulo="Aceita imagem">
                                                        <Eye size={13} />
                                                    </BotaoCapacidade>
                                                    <BotaoCapacidade ativo={modeloItem.capacidades.documento} titulo="Aceita documento" destaque="azul">
                                                        <FileText size={13} />
                                                    </BotaoCapacidade>
                                                    <BotaoCapacidade ativo={modeloItem.capacidades.reasoning} titulo="Reasoning" destaque="roxo">
                                                        <Brain size={13} />
                                                    </BotaoCapacidade>
                                                    <BotaoCapacidade ativo={modeloItem.capacidades.ferramentas} titulo="Tool calling" destaque="azul">
                                                        <Wrench size={13} />
                                                    </BotaoCapacidade>
                                                    {modeloItem.capacidades.imagemGeracao && (
                                                        <BotaoCapacidade ativo titulo="Gera imagem" destaque="laranja">
                                                            <ImageIcon size={13} />
                                                        </BotaoCapacidade>
                                                    )}
                                                    {modeloItem.capacidades.estruturado && (
                                                        <BotaoCapacidade ativo titulo="Saída estruturada" destaque="roxo">
                                                            <Code2 size={13} />
                                                        </BotaoCapacidade>
                                                    )}
                                                </span>
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

// eslint-disable-next-line react-refresh/only-export-components
export function verificarSuporteReasoningOpenRouter(slug: string): boolean {
    const modeloAtual = slug.trim() || 'openrouter/auto'
    const encontrado = PROVEDORES
        .flatMap((provedor) => provedor.modelos)
        .find((modeloItem) => modeloItem.slug === modeloAtual)

    return encontrado ? !!encontrado.capacidades.reasoning : false
}

export default SeletorModeloOpenRouter
