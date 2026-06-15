/**
 * MCP Panel Component
 * 
 * Full-screen panel for managing MCP server connections.
 * Includes marketplace to browse and install servers from Docker MCP Hub.
 * Segue o padrão de painel em tela cheia usado nas configurações.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    Brain,
    Camera,
    Globe,
    Plug, 
    Plus, 
    Trash2, 
    Power, 
    PowerOff, 
    ChevronDown, 
    ChevronRight,
    Terminal,
    Loader2,
    AlertCircle,
    CheckCircle2,
    X,
    Settings,
    Store,
    Search,
    Download,
    ExternalLink,
    Github,
    RefreshCw
} from 'lucide-react'
import { getBuiltInToolDefinitions } from '../../services/tools/builtin'
import { mcpToolBridge } from '../../services/tools/MCPToolBridge'
import { toolRegistry } from '../../services/tools/ToolRegistry'
import type { ToolDefinition } from '../../types/tools'

interface MCPServerConfig {
    id: string
    name: string
    command?: string
    args?: string[]
    env?: Record<string, string>
    headers?: Record<string, string>
    transport?: 'stdio' | 'streamable-http'
    url?: string
    enabled: boolean
    autoConnect?: boolean
    icon?: string
}

interface MCPTool {
    id?: string
    name: string
    description: string
    inputSchema: Record<string, unknown>
}

interface MCPServerState {
    config: MCPServerConfig
    status: 'disconnected' | 'connecting' | 'connected' | 'error'
    toolCount: number
}

// Docker MCP Registry types
interface DockerMCPServer {
    name: string
    path: string
    sha: string
    meta?: {
        name?: string
        title: string
        description: string
        icon?: string
        category?: string
        tags?: string[]
        image?: string
        source?: {
            project?: string
        }
    }
}

interface RegistroMCPChaveValor {
    name: string
    description?: string
    value?: string
    placeholder?: string
    format?: string
    isSecret?: boolean
    isRequired?: boolean
}

interface RegistroMCPArgumento {
    type: string
    name?: string
    value?: string
    valueHint?: string
    description?: string
    placeholder?: string
    isRequired?: boolean
    isSecret?: boolean
    isRepeated?: boolean
    format?: string
    choices?: string[]
}

interface RegistroMCPPacote {
    registryType: string
    identifier: string
    version?: string
    registryBaseUrl?: string
    runtimeHint?: string
    runtimeArguments?: RegistroMCPArgumento[]
    packageArguments?: RegistroMCPArgumento[]
    environmentVariables?: RegistroMCPChaveValor[]
    transport?: {
        type: string
        url?: string
        headers?: RegistroMCPChaveValor[]
    }
}

interface RegistroMCPTransporte {
    type: string
    url?: string
    headers?: RegistroMCPChaveValor[]
    parameters?: RegistroMCPChaveValor[]
}

interface RegistroMCPServidorInfo {
    name: string
    title?: string
    description?: string
    version: string
    icons?: Array<{
        src: string
        theme?: 'light' | 'dark'
        sizes?: string[]
        mimeType?: string
    }>
    repository?: {
        url?: string
        source?: string
        subfolder?: string
    }
    websiteUrl?: string
    packages?: RegistroMCPPacote[]
    remotes?: RegistroMCPTransporte[]
    tools?: MCPTool[]
}

interface RegistroMCPServidor {
    server: RegistroMCPServidorInfo
    _meta?: {
        'io.modelcontextprotocol.registry/official'?: {
            status?: 'active' | 'deprecated' | 'deleted'
            publishedAt?: string
            updatedAt?: string
            isLatest?: boolean
        }
    }
}

interface RespostaListaRegistroMCP {
    servers?: RegistroMCPServidor[]
    metadata?: {
        nextCursor?: string | null
    }
}

interface MCPPanelProps {
    onClose: () => void
}

type TabType = 'installed' | 'marketplace'
type FiltroFonteMarketplace = 'todas' | 'docker' | 'registro'

const DOCKER_MCP_CATEGORIES = [
    { id: 'all', label: 'Todos' },
    { id: 'search', label: 'Busca' },
    { id: 'devops', label: 'DevTools' },
    { id: 'database', label: 'Database' },
    { id: 'ai', label: 'AI Tools' },
    { id: 'productivity', label: 'Produtividade' },
    { id: 'communication', label: 'Mensagens' },
    { id: 'monitoring', label: 'Monitoramento' },
    { id: 'finance', label: 'Finanças' }
]

const REGISTRO_MCP_CATEGORIES = [
    { id: 'all', label: 'Todos' },
    { id: 'npm', label: 'NPM' },
    { id: 'pypi', label: 'PyPI' },
    { id: 'oci', label: 'OCI' },
    { id: 'mcpb', label: 'MCPB' },
    { id: 'remoto', label: 'Remotos' }
]

function obterMensagemErro(erro: unknown, fallback: string): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    if (typeof erro === 'object' && erro !== null && 'message' in erro) {
        const mensagem = (erro as { message?: unknown }).message
        if (typeof mensagem === 'string' && mensagem.trim()) {
            return mensagem
        }
    }
    return fallback
}

const POPULAR_SERVERS = [
    'brave', 'github-official', 'playwright', 'notion', 'mongodb', 
    'elasticsearch', 'grafana', 'desktop-commander', 'context7', 'stripe'
]

const MAPA_ICONES_FERRAMENTA: Record<string, React.ElementType> = {
    Globe,
    Brain,
    Camera,
    Plug
}

const obterIconeFerramenta = (icone?: string) => {
    if (!icone) return Plug
    return MAPA_ICONES_FERRAMENTA[icone] || Plug
}

const formatarNomeMcp = (nome: string) => {
    const base = nome.split('/').pop() || nome
    const semSeparadores = base.replace(/[-_.]+/g, ' ')
    return semSeparadores.replace(/\b\w/g, (letra) => letra.toUpperCase())
}

const normalizarTexto = (valor?: string) => (valor || '').toLowerCase().trim()

const obterImagemSemTag = (imagem?: string) => imagem?.split(':')[0]

const obterIconeRegistro = (icons?: RegistroMCPServidorInfo['icons']) => {
    if (!icons || icons.length === 0) return undefined
    const preferido = icons.find((icon) => icon.theme === 'dark') ?? icons[0]
    return preferido?.src
}

const formatarDataCurta = (valor?: string) => {
    if (!valor) return '-'
    const data = new Date(valor)
    return Number.isNaN(data.getTime())
        ? '-'
        : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(data)
}

const isFilesystemConfig = (config: MCPServerConfig) => {
    const argsTexto = (config.args || []).join(' ').toLowerCase()
    return argsTexto.includes('server-filesystem') || config.name.toLowerCase().includes('filesystem')
}

const extrairDirsFilesystem = (config: MCPServerConfig): string[] => {
    if (!isFilesystemConfig(config)) return []
    const args = config.args || []
    return args.filter((arg) => !arg.startsWith('-') && !arg.toLowerCase().includes('server-filesystem'))
}

const construirArgsFilesystem = (config: MCPServerConfig, dirs: string[]): string[] => {
    const base = (config.args || []).filter((arg) => arg.startsWith('-') || arg.toLowerCase().includes('server-filesystem'))
    if (base.length === 0) {
        base.push('-y', '@modelcontextprotocol/server-filesystem')
    }
    return [...base, ...dirs]
}

const formatarEnvTexto = (env?: Record<string, string>) => {
    if (!env) return ''
    return Object.entries(env)
        .map(([chave, valor]) => `${chave}=${valor}`)
        .join('\n')
}

const formatarHeadersTexto = (headers?: Record<string, string>) => {
    if (!headers) return ''
    return Object.entries(headers)
        .map(([chave, valor]) => `${chave}: ${valor}`)
        .join('\n')
}

const parsearChaveValorTexto = (texto: string) => {
    const linhas = texto
        .split('\n')
        .map((linha) => linha.trim())
        .filter(Boolean)
    if (linhas.length === 0) return undefined

    const resultado: Record<string, string> = {}
    for (const linha of linhas) {
        const indiceIgual = linha.indexOf('=')
        const indiceDoisPontos = linha.indexOf(':')
        const indiceSeparador = indiceIgual >= 0 && (indiceDoisPontos === -1 || indiceIgual < indiceDoisPontos)
            ? indiceIgual
            : indiceDoisPontos
        if (indiceSeparador <= 0) continue
        const chave = linha.slice(0, indiceSeparador).trim()
        const valor = linha.slice(indiceSeparador + 1).trim()
        if (!chave) continue
        resultado[chave] = valor
    }

    return Object.keys(resultado).length > 0 ? resultado : undefined
}

const converterArgumentoEmLista = (argumento: RegistroMCPArgumento) => {
    if (argumento.type === 'named') {
        if (!argumento.name) return []
        if (argumento.value) return [argumento.name, argumento.value]
        return [argumento.name]
    }
    const valor = argumento.value || argumento.valueHint
    return valor ? [valor] : []
}

const obterComandoRegistro = (pacote: RegistroMCPPacote) => {
    if (pacote.runtimeHint) return pacote.runtimeHint
    if (pacote.registryType === 'oci') return 'docker'
    if (pacote.registryType === 'npm') return 'npx'
    if (pacote.registryType === 'pypi') return 'python'
    if (pacote.registryType === 'mcpb') return 'mcpb'
    return ''
}

const criarConfigRegistro = (registro: RegistroMCPServidor) => {
    const pacotes = registro.server.packages || []
    const remotos = registro.server.remotes || []

    // PRIMEIRO: Priorizar pacotes (npm, pypi, oci) - rodam localmente, sem auth
    if (pacotes.length > 0) {
        // Ordem de preferência: npm > pypi > oci > outros
        const pacotePreferido = 
            pacotes.find((pacote) => pacote.registryType === 'npm') ||
            pacotes.find((pacote) => pacote.registryType === 'pypi') ||
            pacotes.find((pacote) => pacote.registryType === 'oci') ||
            pacotes[0]
        
        const comando = obterComandoRegistro(pacotePreferido)
        if (comando) {
            const argumentosRuntime = (pacotePreferido.runtimeArguments || []).flatMap(converterArgumentoEmLista)
            const argumentosPacote = (pacotePreferido.packageArguments || []).flatMap(converterArgumentoEmLista)
            const args: string[] = []

            if (argumentosRuntime.length > 0) {
                args.push(...argumentosRuntime)
            } else if (pacotePreferido.registryType === 'oci' && comando === 'docker') {
                args.push('run', '-i', '--rm')
            } else if (pacotePreferido.registryType === 'pypi' && comando === 'python') {
                args.push('-m')
            } else if (pacotePreferido.registryType === 'npm' && comando === 'npx') {
                args.push('-y')
            }

            const identificador = pacotePreferido.registryType === 'npm' && pacotePreferido.version
                ? `${pacotePreferido.identifier}@${pacotePreferido.version}`
                : pacotePreferido.identifier

            if (identificador) {
                args.push(identificador)
            }

            if (argumentosPacote.length > 0) {
                args.push(...argumentosPacote)
            }

            const env = pacotePreferido.environmentVariables?.reduce<Record<string, string>>((acc, variavel) => {
                acc[variavel.name] = variavel.value || variavel.placeholder || ''
                return acc
            }, {})

            const idBase = registro.server.name.replace(/[^a-zA-Z0-9-_]/g, '-')
            return {
                id: `mcp-registry-${idBase}-${Date.now()}`,
                name: registro.server.title || formatarNomeMcp(registro.server.name),
                command: comando,
                args,
                env: env && Object.keys(env).length > 0 ? env : undefined,
                transport: 'stdio' as const,
                enabled: true,
                autoConnect: false,
                icon: obterIconeRegistro(registro.server.icons)
            }
        }
    }

    // SEGUNDO: Tentar remotos (streamable-http) - geralmente precisam de auth
    if (remotos.length > 0) {
        const remotoPreferido = remotos.find(r => r.type === 'streamable-http') || remotos[0]
        if (remotoPreferido.url && (remotoPreferido.type === 'streamable-http' || remotoPreferido.type === 'sse')) {
            const headers = remotoPreferido.headers?.reduce<Record<string, string>>((acc, header) => {
                // Remove chaves {} de placeholders (ex: {token} -> token)
                let valor = header.value || header.placeholder || ''
                valor = valor.replace(/^\{(.+)\}$/, '$1')
                acc[header.name] = valor
                return acc
            }, {})

            const idBase = registro.server.name.replace(/[^a-zA-Z0-9-_]/g, '-')
            return {
                id: `mcp-registry-${idBase}-${Date.now()}`,
                name: registro.server.title || formatarNomeMcp(registro.server.name),
                transport: 'streamable-http' as const,
                url: remotoPreferido.url,
                headers: headers && Object.keys(headers).length > 0 ? headers : undefined,
                enabled: true,
                autoConnect: false,
                icon: obterIconeRegistro(registro.server.icons)
            }
        }
    }

    return null
}


const verificarInstaladoDocker = (server: DockerMCPServer, configs: MCPServerConfig[]) => {
    const meta = server.meta
    const titulo = normalizarTexto(meta?.title || server.name)
    const nomeOriginal = normalizarTexto(server.name)
    const imagem = meta?.image || `mcp/${server.name}`
    const imagemSemTag = obterImagemSemTag(imagem)
    const imagensPossiveis = [imagem, imagemSemTag, `mcp/${server.name}`]
        .filter(Boolean)
        .map(normalizarTexto)

    return configs.some((config) => {
        const nomeConfig = normalizarTexto(config.name)
        if (nomeConfig && (nomeConfig === titulo || nomeConfig === nomeOriginal)) {
            return true
        }
        if (normalizarTexto(config.command) !== 'docker') return false
        const argsTexto = normalizarTexto((config.args || []).join(' '))
        return imagensPossiveis.some((img) => img && argsTexto.includes(img))
    })
}

const obterIdentificadoresRegistro = (servidor: RegistroMCPServidor) => {
    const pacotes = servidor.server.packages || []
    const identificadores = pacotes.flatMap((pacote) => {
        const lista = [pacote.identifier]
        if (pacote.registryType === 'oci') {
            const semTag = obterImagemSemTag(pacote.identifier)
            if (semTag && semTag !== pacote.identifier) {
                lista.push(semTag)
            }
        }
        return lista
    })
    return identificadores.filter(Boolean)
}

const obterUrlsRegistro = (servidor: RegistroMCPServidor) => {
    return (servidor.server.remotes || [])
        .map((remoto) => remoto.url)
        .filter(Boolean) as string[]
}

const verificarInstaladoRegistro = (servidor: RegistroMCPServidor, configs: MCPServerConfig[]) => {
    const titulo = normalizarTexto(servidor.server.title || formatarNomeMcp(servidor.server.name))
    const nomeOriginal = normalizarTexto(servidor.server.name)
    const identificadores = obterIdentificadoresRegistro(servidor).map(normalizarTexto)
    const urls = obterUrlsRegistro(servidor).map(normalizarTexto)

    return configs.some((config) => {
        const nomeConfig = normalizarTexto(config.name)
        if (nomeConfig && (nomeConfig === titulo || nomeConfig === nomeOriginal)) {
            return true
        }
        if (config.transport === 'streamable-http') {
            const urlConfig = normalizarTexto(config.url)
            if (urlConfig && urls.includes(urlConfig)) {
                return true
            }
        }
        const argsTexto = normalizarTexto((config.args || []).join(' '))
        return identificadores.some((id) => id && argsTexto.includes(id))
    })
}

type SelecionadoMcp =
    | { origem: 'docker'; servidor: DockerMCPServer }
    | { origem: 'registro'; servidor: RegistroMCPServidor }

export const MCPPanel: React.FC<MCPPanelProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<TabType>('installed')
    const [servers, setServers] = useState<MCPServerState[]>([])
    const [expandedServer, setExpandedServer] = useState<string | null>(null)
    const [serverTools, setServerTools] = useState<Record<string, MCPTool[]>>({})
    const [permissoesFerramentas, setPermissoesFerramentas] = useState<Record<string, 'permitir' | 'bloquear'>>(() => {
        try {
            const salvo = localStorage.getItem('selene_mcp_tool_permissions')
            if (!salvo) return {}
            return JSON.parse(salvo) as Record<string, 'permitir' | 'bloquear'>
        } catch {
            return {}
        }
    })
    const [dirsFilesystem, setDirsFilesystem] = useState<Record<string, string[]>>({})
    const [salvandoDirs, setSalvandoDirs] = useState<Record<string, boolean>>({})
    const [showAddModal, setShowAddModal] = useState(false)
    const [loading, setLoading] = useState(false)

    // Modal de aviso MCP em desenvolvimento
    const [showWarningModal, setShowWarningModal] = useState(() => {
        return localStorage.getItem('selene_mcp_warning_dismissed') !== 'true'
    })

    // Marketplace state
    const [registryServers, setRegistryServers] = useState<DockerMCPServer[]>([])
    const [filteredServers, setFilteredServers] = useState<DockerMCPServer[]>([])
    const [registryLoading, setRegistryLoading] = useState(false)
    const [registryError, setRegistryError] = useState<string | null>(null)
    const [selectedCategory, setSelectedCategory] = useState('all')

    const [registroServidores, setRegistroServidores] = useState<RegistroMCPServidor[]>([])
    const [registroFiltrados, setRegistroFiltrados] = useState<RegistroMCPServidor[]>([])
    const [registroLoading, setRegistroLoading] = useState(false)
    const [registroError, setRegistroError] = useState<string | null>(null)
    const [registroCategoria, setRegistroCategoria] = useState('all')

    const [buscaMarketplace, setBuscaMarketplace] = useState('')

    const atualizarPermissaoFerramenta = (toolId: string, permitir: boolean) => {
        toolRegistry.setEnabled(toolId, permitir)
        setPermissoesFerramentas((atual) => {
            const novo: Record<string, 'permitir' | 'bloquear'> = {
                ...atual,
                [toolId]: permitir ? 'permitir' : 'bloquear'
            }
            localStorage.setItem('selene_mcp_tool_permissions', JSON.stringify(novo))
            return novo
        })
    }

    const handleAlterarPermissaoTool = (serverId: string, tool: MCPTool, permitir: boolean) => {
        const toolId = `mcp:${serverId}:${tool.name}`
        atualizarPermissaoFerramenta(toolId, permitir)
    }

    const atualizarDirsFilesystem = (serverId: string, dirs: string[]) => {
        setDirsFilesystem((atual) => ({ ...atual, [serverId]: dirs }))
    }
    const [filtroFonte, setFiltroFonte] = useState<FiltroFonteMarketplace>('todas')

    const [mcpSelecionado, setMcpSelecionado] = useState<SelecionadoMcp | null>(null)
    const [servidorEmEdicao, setServidorEmEdicao] = useState<MCPServerConfig | null>(null)
    const mcpNativosExtras = useMemo(() => ([
        {
            id: 'mcp:nativo:filesystem',
            name: 'Filesystem (MCP)',
            description: 'Conecte e escolha os diretórios permitidos para ler e escrever arquivos.',
            category: 'file' as const,
            parameters: [],
            source: { type: 'mcp' as const },
            enabled: true,
            icon: 'Folder'
        },
        {
            id: 'mcp:nativo:windows',
            name: 'Windows-MCP',
            description: 'Ferramentas de automação no Windows. Configure manualmente antes de conectar.',
            category: 'system' as const,
            parameters: [],
            source: { type: 'mcp' as const },
            enabled: false,
            icon: 'Monitor'
        }
    ]), [])

    const ferramentasNativas = useMemo(
        () => [...getBuiltInToolDefinitions(), ...mcpNativosExtras],
        [mcpNativosExtras]
    )
    const configsInstalados = useMemo(() => servers.map((server) => server.config), [servers])

    // Load servers on mount
    useEffect(() => {
        loadServers()
    }, [])

    const parseSimpleYaml = useCallback((yaml: string): DockerMCPServer['meta'] => {
        type MetaDocker = NonNullable<DockerMCPServer['meta']>

        const result: Partial<MetaDocker> = {}
        const lines = yaml.split('\n')
        let currentSection = ''
        const tags: string[] = []

        for (const line of lines) {
            if (line.startsWith('name:')) result.name = line.split(':')[1]?.trim()
            if (line.startsWith('image:')) result.image = line.split(':')[1]?.trim()
            if (line.startsWith('  category:')) result.category = line.split(':')[1]?.trim()
            if (line.startsWith('  title:')) result.title = line.split(':').slice(1).join(':').trim()
            if (line.startsWith('  description:')) result.description = line.split(':').slice(1).join(':').trim()
            if (line.startsWith('  icon:')) result.icon = line.split('icon:')[1]?.trim()
            if (line.includes('project:')) {
                result.source = { project: line.split('project:')[1]?.trim() }
            }
            if (line.trim().startsWith('- ') && currentSection === 'tags') {
                tags.push(line.trim().replace('- ', ''))
            }
            if (line.includes('tags:')) currentSection = 'tags'
            else if (line.match(/^\s*\w+:/) && !line.includes('-')) currentSection = ''
        }

        if (tags.length > 0) result.tags = tags

        return Object.keys(result).length > 0 ? result as MetaDocker : undefined
    }, [])

    const loadDockerMCPRegistry = useCallback(async () => {
        setRegistryLoading(true)
        setRegistryError(null)
        try {
            const response = await fetch('https://api.github.com/repos/docker/mcp-registry/contents/servers')
            if (!response.ok) throw new Error(`Erro da API do GitHub: ${response.status}`)

            const dirs = await response.json() as Array<{ name: string; path: string; sha: string }>

            const serversWithMeta: DockerMCPServer[] = []
            const batchSize = 10

            for (let i = 0; i < dirs.length; i += batchSize) {
                const batch = dirs.slice(i, i + batchSize)
                const metaPromises = batch.map(async (dir) => {
                    try {
                        const yamlUrl = `https://raw.githubusercontent.com/docker/mcp-registry/main/servers/${dir.name}/server.yaml`
                        const yamlRes = await fetch(yamlUrl)
                        if (!yamlRes.ok) return { ...dir, meta: undefined }

                        const yamlText = await yamlRes.text()
                        const meta = parseSimpleYaml(yamlText)
                        return { ...dir, meta }
                    } catch {
                        return { ...dir, meta: undefined }
                    }
                })

                const batchResults = await Promise.all(metaPromises)
                serversWithMeta.push(...batchResults.filter((server) => server.meta))
            }

            setRegistryServers(serversWithMeta)
        } catch (error: unknown) {
            console.error('[MCPPanel] Docker MCP Registry error:', error)
            setRegistryError(obterMensagemErro(error, 'Falha ao carregar marketplace'))
        }
        setRegistryLoading(false)
    }, [parseSimpleYaml])

    const carregarRegistroOficial = useCallback(async () => {
        setRegistroLoading(true)
        setRegistroError(null)
        try {
            const servidores: RegistroMCPServidor[] = []
            let cursor: string | null = null
            let paginasCarregadas = 0

            do {
                const url = new URL('https://registry.modelcontextprotocol.io/v0.1/servers')
                url.searchParams.set('limit', '100')
                url.searchParams.set('version', 'latest')
                if (cursor) url.searchParams.set('cursor', cursor)

                const response = await fetch(url.toString())
                if (!response.ok) throw new Error(`Erro da API do MCP Registry: ${response.status}`)

                const data = await response.json() as RespostaListaRegistroMCP
                if (Array.isArray(data.servers)) {
                    servidores.push(...data.servers)
                }

                cursor = data.metadata?.nextCursor ?? null
                paginasCarregadas += 1
                if (paginasCarregadas > 200) {
                    cursor = null
                }
            } while (cursor)

            setRegistroServidores(servidores)
        } catch (error: unknown) {
            console.error('[MCPPanel] MCP Registry error:', error)
            setRegistroError(obterMensagemErro(error, 'Falha ao carregar MCP Registry'))
        }
        setRegistroLoading(false)
    }, [])

    // Load marketplace when tab changes
    useEffect(() => {
        if (activeTab !== 'marketplace') return
        if (registryServers.length === 0) {
            loadDockerMCPRegistry()
        }
        if (registroServidores.length === 0) {
            carregarRegistroOficial()
        }
    }, [
        activeTab,
        loadDockerMCPRegistry,
        carregarRegistroOficial,
        registroServidores.length,
        registryServers.length
    ])

    // Filter servers when search or category changes
    useEffect(() => {
        let filtered = registryServers
        
        if (buscaMarketplace) {
            const search = buscaMarketplace.toLowerCase()
            filtered = filtered.filter(s => 
                s.name.toLowerCase().includes(search) ||
                s.meta?.title?.toLowerCase().includes(search) ||
                s.meta?.description?.toLowerCase().includes(search) ||
                s.meta?.tags?.some(t => t.toLowerCase().includes(search))
            )
        }
        
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(s => s.meta?.category === selectedCategory)
        }
        
        // Sort popular first
        filtered = [...filtered].sort((a, b) => {
            const aPopular = POPULAR_SERVERS.includes(a.name) ? 0 : 1
            const bPopular = POPULAR_SERVERS.includes(b.name) ? 0 : 1
            return aPopular - bPopular
        })
        
        setFilteredServers(filtered)
    }, [registryServers, buscaMarketplace, selectedCategory])

    useEffect(() => {
        let filtrados = registroServidores

        if (buscaMarketplace) {
            const busca = buscaMarketplace.toLowerCase()
            filtrados = filtrados.filter((item) => {
                const servidor = item.server
                return (
                    servidor.name.toLowerCase().includes(busca) ||
                    servidor.title?.toLowerCase().includes(busca) ||
                    servidor.description?.toLowerCase().includes(busca) ||
                    servidor.repository?.url?.toLowerCase().includes(busca)
                )
            })
        }

        if (registroCategoria !== 'all') {
            filtrados = filtrados.filter((item) => {
                const servidor = item.server
                if (registroCategoria === 'remoto') {
                    return (servidor.remotes?.length || 0) > 0
                }
                return servidor.packages?.some((pacote) => pacote.registryType === registroCategoria)
            })
        }

        const ordenados = [...filtrados].sort((a, b) => {
            const nomeA = a.server.title || formatarNomeMcp(a.server.name)
            const nomeB = b.server.title || formatarNomeMcp(b.server.name)
            return nomeA.localeCompare(nomeB)
        })

        setRegistroFiltrados(ordenados)
    }, [registroServidores, buscaMarketplace, registroCategoria])

    useEffect(() => {
        Object.entries(serverTools).forEach(([serverId, tools]) => {
            tools.forEach((tool) => {
                const permissao = permissoesFerramentas[tool.name] ||
                    (tool.id ? permissoesFerramentas[tool.id] : undefined)
                if (permissao === 'bloquear') {
                    toolRegistry.setEnabled(`mcp:${serverId}:${tool.name}`, false)
                }
            })
        })
    }, [serverTools, permissoesFerramentas])

    const loadServers = async () => {
        setLoading(true)
        try {
            const result = await window.electronAPI?.mcp?.getServers()
            const lista = result || []

            setServers(lista)

            // Sincronizar diretórios para Filesystem
            const dirsState: Record<string, string[]> = {}
            lista.forEach((srv) => {
                if (isFilesystemConfig(srv.config)) {
                    dirsState[srv.config.id] = extrairDirsFilesystem(srv.config)
                }
            })
            setDirsFilesystem(dirsState)
        } catch (error) {
            console.error('[MCPPanel] Failed to load servers:', error)
        }
        setLoading(false)
    }

    const handleSalvarDirsFilesystem = async (serverId: string) => {
        const serverState = servers.find((srv) => srv.config.id === serverId)
        if (!serverState) return
        const dirs = (dirsFilesystem[serverId] || []).filter(Boolean)
        if (dirs.length === 0) {
            alert('Informe pelo menos um diretório permitido.')
            return
        }
        const config = serverState.config
        if (!isFilesystemConfig(config)) return

        setSalvandoDirs((prev) => ({ ...prev, [serverId]: true }))
        try {
            const novosArgs = construirArgsFilesystem(config, dirs)
            await window.electronAPI?.mcp?.addServer({
                ...config,
                args: novosArgs
            })
            await loadServers()
        } catch (error) {
            console.error('[MCPPanel] Erro ao salvar diretórios:', error)
            alert('Falha ao salvar diretórios permitidos.')
        }
        setSalvandoDirs((prev) => ({ ...prev, [serverId]: false }))
    }

    const handleConnect = async (serverId: string) => {
        try {
            setServers(prev => prev.map(s => 
                s.config.id === serverId ? { ...s, status: 'connecting' } : s
            ))
            
            const result = await window.electronAPI?.mcp?.connect(serverId)
            if (result?.success) {
                await loadServers()
                const tools = await window.electronAPI?.mcp?.getTools(serverId)
                if (tools) {
                    setServerTools(prev => ({ ...prev, [serverId]: tools }))
                }
                // Sync MCP tools to the tool registry so AI can use them
                await mcpToolBridge.syncServerTools(serverId)
            } else {
                setServers(prev => prev.map(s => 
                    s.config.id === serverId ? { ...s, status: 'error' } : s
                ))
            }
        } catch (error) {
            console.error('[MCPPanel] Connect error:', error)
        }
    }

    const handleDisconnect = async (serverId: string) => {
        try {
            await window.electronAPI?.mcp?.disconnect(serverId)
            await loadServers()
            setServerTools(prev => {
                const copy = { ...prev }
                delete copy[serverId]
                return copy
            })
            // Remove MCP tools from registry
            mcpToolBridge.removeServerTools(serverId)
        } catch (error) {
            console.error('[MCPPanel] Disconnect error:', error)
        }
    }

    const handleSalvarConfig = async (config: MCPServerConfig) => {
        const statusAtual = servers.find((server) => server.config.id === config.id)?.status
        try {
            if (statusAtual === 'connected' || statusAtual === 'connecting') {
                await window.electronAPI?.mcp?.disconnect(config.id)
            }
            await window.electronAPI?.mcp?.addServer(config)
            await loadServers()
        } catch (error) {
            console.error('[MCPPanel] Save config error:', error)
            alert('Erro ao salvar a configuração do servidor.')
        }
    }

    const handleRemove = async (serverId: string) => {
        if (!confirm('Tem certeza que deseja remover este servidor?')) return
        try {
            await window.electronAPI?.mcp?.removeServer(serverId)
            await loadServers()
        } catch (error) {
            console.error('[MCPPanel] Remove error:', error)
        }
    }

    const toggleExpand = async (serverId: string) => {
        if (expandedServer === serverId) {
            setExpandedServer(null)
        } else {
            setExpandedServer(serverId)
            if (!serverTools[serverId]) {
                try {
                    const tools = await window.electronAPI?.mcp?.getTools(serverId)
                    if (tools) {
                        setServerTools(prev => ({ ...prev, [serverId]: tools }))
                    }
                } catch (error) {
                    console.error('[MCPPanel] Failed to load tools:', error)
                }
            }
        }
    }

    const instalarDoDocker = async (server: DockerMCPServer) => {
        const meta = server.meta
        if (!meta) return

        const imageName = meta.image || `mcp/${server.name}`
        if (verificarInstaladoDocker(server, configsInstalados)) {
            setActiveTab('installed')
            return
        }
        
        try {
            await window.electronAPI?.mcp?.addServer({
                id: `mcp-${Date.now()}`,
                name: meta.title || server.name,
                command: 'docker',
                args: ['run', '-i', '--rm', imageName],
                transport: 'stdio',
                enabled: true,
                autoConnect: false,
                icon: meta.icon
            })
            await loadServers()
            setActiveTab('installed')
        } catch (error) {
            console.error('[MCPPanel] Install error:', error)
            alert('Erro ao adicionar servidor. Verifique se o Docker está instalado.')
        }
    }

    const instalarDoRegistro = async (server: RegistroMCPServidor) => {
        const config = criarConfigRegistro(server)
        if (!config) {
            alert('Este servidor não possui pacote instalável no momento.')
            return
        }

        if (verificarInstaladoRegistro(server, configsInstalados)) {
            setActiveTab('installed')
            return
        }

        // Verificar se é um MCP remoto do Smithery - requer OAuth
        if (config.transport === 'streamable-http' && config.url?.includes('server.smithery.ai')) {
            const confirmacao = confirm(
                `⚠️ MCPs hospedados no Smithery requerem autenticação OAuth.\n\n` +
                `Isso significa que você precisará:\n` +
                `1. Obter tokens através do fluxo OAuth do Smithery\n` +
                `2. Ou usar a versão local (NPM/Docker) deste MCP\n\n` +
                `Deseja continuar mesmo assim?`
            )
            if (!confirmacao) return
        }

        // Se o MCP remoto tem headers definidos, verificar se precisa de autenticação
        const remotos = server.server.remotes || []
        const temHeadersObrigatorios = remotos.some(remoto => 
            remoto.headers?.some(h => h.isRequired || h.isSecret)
        )
        
        // Se precisa de autenticação, abrir editor para o usuário configurar
        if (config.transport === 'streamable-http' && temHeadersObrigatorios) {
            setServidorEmEdicao(config)
            setShowAddModal(true)
            return
        }

        try {
            await window.electronAPI?.mcp?.addServer(config)
            await loadServers()
            setActiveTab('installed')
        } catch (error) {
            console.error('[MCPPanel] Install registry error:', error)
            alert('Erro ao adicionar servidor do registry.')
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'connected': return 'bg-green-500'
            case 'connecting': return 'bg-yellow-500 animate-pulse'
            case 'error': return 'bg-red-500'
            default: return 'bg-neutral-500'
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute inset-0 bg-[#0a0a0c] z-20 flex flex-col pointer-events-auto"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
            {/* Modal de Aviso - Feature em Desenvolvimento */}
            <AnimatePresence>
                {showWarningModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-neutral-900 border border-white/10 rounded-2xl p-6 max-w-md mx-4 shadow-2xl"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 rounded-xl bg-amber-500/20">
                                    <AlertCircle size={22} className="text-amber-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-white">Feature em Desenvolvimento</h3>
                            </div>

                            <p className="text-neutral-300 text-sm leading-relaxed mb-6">
                                A conexão com servidores MCP ainda está em desenvolvimento.
                                Algumas funcionalidades podem não funcionar como esperado.
                                <span className="text-amber-400 font-medium"> Prossiga com cuidado.</span>
                            </p>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => setShowWarningModal(false)}
                                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                                >
                                    Entendi, continuar
                                </button>
                                <button
                                    onClick={() => {
                                        localStorage.setItem('selene_mcp_warning_dismissed', 'true')
                                        setShowWarningModal(false)
                                    }}
                                    className="w-full py-2 px-4 rounded-xl text-neutral-500 hover:text-neutral-300 text-sm transition-colors"
                                >
                                    Não me avise novamente
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex-none h-14 flex items-center justify-between px-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/20">
                        <Plug size={18} className="text-blue-400" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-neutral-100">MCP Tools</h2>
                        <p className="text-[10px] text-neutral-500">Model Context Protocol</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex-none flex border-b border-white/5 px-5">
                <button
                    onClick={() => setActiveTab('installed')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                        activeTab === 'installed' 
                            ? 'text-white' 
                            : 'text-neutral-400 hover:text-white'
                    }`}
                >
                    <Terminal size={16} />
                    Instalados
                    {servers.length > 0 && (
                        <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                            {servers.length}
                        </span>
                    )}
                    {activeTab === 'installed' && (
                        <motion.div 
                            layoutId="mcp-tab"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                        />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('marketplace')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                        activeTab === 'marketplace' 
                            ? 'text-white' 
                            : 'text-neutral-400 hover:text-white'
                    }`}
                >
                    <Store size={16} />
                    Marketplace
                    {activeTab === 'marketplace' && (
                        <motion.div 
                            layoutId="mcp-tab"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                        />
                    )}
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'installed' ? (
                    <InstalledTab
                        servers={servers}
                        loading={loading}
                        expandedServer={expandedServer}
                        serverTools={serverTools}
                        dirsFilesystem={dirsFilesystem}
                        salvandoDirs={salvandoDirs}
                        permissoesFerramentas={permissoesFerramentas}
                        atualizarDirsFilesystem={atualizarDirsFilesystem}
                        handleSalvarDirsFilesystem={handleSalvarDirsFilesystem}
                        handleAlterarPermissaoTool={handleAlterarPermissaoTool}
                        ferramentasNativas={ferramentasNativas}
                        onConnect={handleConnect}
                        onDisconnect={handleDisconnect}
                        onRemove={handleRemove}
                        onToggleExpand={toggleExpand}
                        onEditar={(server) => {
                            setShowAddModal(false)
                            setServidorEmEdicao(server.config)
                        }}
                        onAddClick={() => setShowAddModal(true)}
                        onConfigurarNativo={(config) => {
                            setServidorEmEdicao(config)
                            setShowAddModal(true)
                        }}
                        onRefresh={loadServers}
                        getStatusColor={getStatusColor}
                    />
                ) : (
                    <MarketplaceTab
                        busca={buscaMarketplace}
                        filtroFonte={filtroFonte}
                        onBuscaChange={setBuscaMarketplace}
                        onFiltroFonteChange={setFiltroFonte}
                        configsInstalados={configsInstalados}
                        dockerServers={filteredServers}
                        dockerLoading={registryLoading}
                        dockerError={registryError}
                        dockerCategoria={selectedCategory}
                        onDockerCategoriaChange={setSelectedCategory}
                        onDockerInstall={instalarDoDocker}
                        onDockerRefresh={loadDockerMCPRegistry}
                        registroServers={registroFiltrados}
                        registroLoading={registroLoading}
                        registroError={registroError}
                        registroCategoria={registroCategoria}
                        onRegistroCategoriaChange={setRegistroCategoria}
                        onRegistroRefresh={carregarRegistroOficial}
                        onRegistroInstall={instalarDoRegistro}
                        onAbrirDetalhes={setMcpSelecionado}
                    />
                )}
            </div>

            {/* Add Server Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <AddServerModal 
                        key="novo-servidor"
                        onClose={() => setShowAddModal(false)}
                        onAdd={async (config) => {
                            await window.electronAPI?.mcp?.addServer(config)
                            await loadServers()
                            setShowAddModal(false)
                        }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {servidorEmEdicao && (
                    <AddServerModal 
                        key={servidorEmEdicao.id}
                        configInicial={servidorEmEdicao}
                        titulo="Configurar Servidor MCP"
                        textoConfirmar="Salvar"
                        onClose={() => setServidorEmEdicao(null)}
                        onAdd={async (config) => {
                            await handleSalvarConfig(config)
                            setServidorEmEdicao(null)
                        }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {mcpSelecionado && (
                    <DetalhesMcpModal
                        selecionado={mcpSelecionado}
                        onClose={() => setMcpSelecionado(null)}
                        onInstalarDocker={instalarDoDocker}
                        onInstalarRegistro={instalarDoRegistro}
                        configsInstalados={configsInstalados}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    )
}

// ============================================================================
// INSTALLED TAB
// ============================================================================

interface InstalledTabProps {
    servers: MCPServerState[]
    loading: boolean
    expandedServer: string | null
    serverTools: Record<string, MCPTool[]>
    dirsFilesystem: Record<string, string[]>
    salvandoDirs: Record<string, boolean>
    permissoesFerramentas: Record<string, 'permitir' | 'bloquear'>
    atualizarDirsFilesystem: (serverId: string, dirs: string[]) => void
    handleSalvarDirsFilesystem: (serverId: string) => void
    handleAlterarPermissaoTool: (serverId: string, tool: MCPTool, permitir: boolean) => void
    ferramentasNativas: ToolDefinition[]
    onConnect: (id: string) => void
    onDisconnect: (id: string) => void
    onRemove: (id: string) => void
    onToggleExpand: (id: string) => void
    onEditar: (server: MCPServerState) => void
    onAddClick: () => void
    onConfigurarNativo: (config: MCPServerConfig) => void
    onRefresh: () => void
    getStatusColor: (status: string) => string
}

const InstalledTab: React.FC<InstalledTabProps> = ({
    servers,
    loading,
    expandedServer,
    serverTools,
    dirsFilesystem,
    salvandoDirs,
    permissoesFerramentas,
    atualizarDirsFilesystem,
    handleSalvarDirsFilesystem,
    handleAlterarPermissaoTool,
    ferramentasNativas,
    onConnect,
    onDisconnect,
    onRemove,
    onToggleExpand,
    onEditar,
    onAddClick,
    onConfigurarNativo,
    onRefresh,
    getStatusColor
}) => (
    <div className="h-full overflow-y-auto p-5 space-y-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
        {/* Actions */}
        <div className="flex gap-3">
            <button
                onClick={onAddClick}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium text-white transition-colors"
            >
                <Plus size={18} />
                Adicionar Servidor
            </button>
            <button
                onClick={onRefresh}
                className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-neutral-400 hover:text-white transition-colors"
                title="Atualizar"
            >
                <RefreshCw size={18} />
            </button>
        </div>

                        <FerramentasNativas
                            ferramentas={ferramentasNativas}
                            onConfigurar={(id) => {
                                if (id === 'mcp:nativo:filesystem') {
                                    onConfigurarNativo({
                                        id: 'mcp-nativo-filesystem',
                                        name: 'Filesystem',
                                        command: 'npx',
                                        args: ['-y', '@modelcontextprotocol/server-filesystem'],
                                        enabled: true,
                                        autoConnect: false,
                                        transport: 'stdio'
                                    })
                                    return
                                }
                                if (id === 'mcp:nativo:windows') {
                                    onConfigurarNativo({
                                        id: 'mcp-nativo-windows',
                                        name: 'Windows-MCP',
                                        command: 'npx',
                                        args: [],
                                        enabled: false,
                                        autoConnect: false,
                                        transport: 'stdio'
                                    })
                                    return
                                }
                            }}
                        />

        {loading ? (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="text-blue-400 animate-spin" />
            </div>
        ) : servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-2xl bg-neutral-800/50 flex items-center justify-center mb-4">
                    <Plug size={40} className="text-neutral-600" />
                </div>
                <h3 className="text-lg font-medium text-neutral-200 mb-2">Nenhum servidor MCP</h3>
                <p className="text-sm text-neutral-500 mb-6 max-w-md">
                    Adicione servidores MCP para extender as capacidades da Selene com ferramentas externas.
                </p>
                <button
                    onClick={onAddClick}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium text-white transition-colors"
                >
                    <Plus size={16} />
                    Adicionar Servidor
                </button>
            </div>
        ) : (
            <div className="space-y-2">
                {servers.map(server => (
                    <div 
                        key={server.config.id}
                        className="bg-white/5 border border-white/5 rounded-xl overflow-hidden transition-colors group"
                    >
                        <div className="flex items-center gap-4 px-4 py-3">
                            {/* Icon - usa ícone do marketplace ou fallback para inicial */}
                            <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0 overflow-hidden">
                                {server.config.icon ? (
                                    <img 
                                        src={server.config.icon} 
                                        alt="" 
                                        className="w-6 h-6 object-contain" 
                                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} 
                                    />
                                ) : (
                                    <span className="text-lg font-semibold text-neutral-400">
                                        {server.config.name.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                        
                            {/* Name and status */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white truncate">
                                    {server.config.name}
                                </span>
                                <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(server.status)}`} />
                            </div>
                            {server.status === 'connected' && server.toolCount > 0 && (
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    {server.toolCount} ferramentas disponíveis
                                </p>
                            )}
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => onEditar(server)}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-neutral-300 hover:text-white transition-colors"
                            >
                                Configurar
                            </button>
                            
                            <div className="flex items-center">
                                {server.status === 'connected' ? (
                                    <button
                                        onClick={() => onDisconnect(server.config.id)}
                                        className="p-2 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
                                        title="Desconectar"
                                    >
                                        <PowerOff size={16} />
                                    </button>
                                ) : server.status === 'connecting' ? (
                                    <button disabled className="p-2 text-yellow-400 rounded-lg">
                                        <Loader2 size={16} className="animate-spin" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onConnect(server.config.id)}
                                        className="p-2 hover:bg-green-500/20 text-neutral-400 hover:text-green-400 rounded-lg transition-colors"
                                        title="Conectar"
                                    >
                                        <Power size={16} />
                                    </button>
                                )}
                                
                                <button
                                    onClick={() => onToggleExpand(server.config.id)}
                                    className="p-2 hover:bg-white/10 text-neutral-400 hover:text-white rounded-lg transition-colors"
                                    title="Ver detalhes"
                                >
                                    {expandedServer === server.config.id ? (
                                        <ChevronDown size={16} />
                                    ) : (
                                        <ChevronRight size={16} />
                                    )}
                                </button>
                                
                                <button
                                    onClick={() => onRemove(server.config.id)}
                                    className="p-2 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
                                    title="Remover"
                                >
                                <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        </div>
                        
                        {/* Expanded tools section */}
                        <AnimatePresence>
                            {expandedServer === server.config.id && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-4 pb-4 pt-3 border-t border-white/5 ml-14">
                                        {isFilesystemConfig(server.config) && (
                                            <div className="mb-4 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm text-white font-semibold">Diretórios permitidos</p>
                                                        <p className="text-xs text-neutral-500">Obrigatório para o Filesystem MCP</p>
                                                    </div>
                                                    <button
                                                        onClick={() => atualizarDirsFilesystem(server.config.id, [...(dirsFilesystem[server.config.id] || []), ''])}
                                                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white transition-colors"
                                                    >
                                                        + Adicionar
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {(dirsFilesystem[server.config.id] || ['']).map((dir, idx) => (
                                                        <div key={`${server.config.id}-dir-${idx}`} className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={dir}
                                                                onChange={(e) => {
                                                                    const novaLista = [...(dirsFilesystem[server.config.id] || [])]
                                                                    novaLista[idx] = e.target.value
                                                                    atualizarDirsFilesystem(server.config.id, novaLista)
                                                                }}
                                                                placeholder="C:\\Users\\voce\\Downloads"
                                                                className="flex-1 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const novaLista = (dirsFilesystem[server.config.id] || []).filter((_, i) => i !== idx)
                                                                    atualizarDirsFilesystem(server.config.id, novaLista)
                                                                }}
                                                                className="p-2 rounded-lg hover:bg-red-500/20 text-red-300"
                                                                title="Remover"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={() => handleSalvarDirsFilesystem(server.config.id)}
                                                        disabled={salvandoDirs[server.config.id]}
                                                        className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                                                    >
                                                        {salvandoDirs[server.config.id] ? 'Salvando...' : 'Salvar diretórios'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {serverTools[server.config.id]?.length > 0 ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm text-white font-semibold">Permissões de ferramentas</p>
                                                    <p className="text-xs text-neutral-500">Ative ou bloqueie cada ferramenta</p>
                                                </div>
                                                <div className="space-y-1">
                                                    {serverTools[server.config.id].map(tool => {
                                                        const toolId = `mcp:${server.config.id}:${tool.name}`
                                                        const status = permissoesFerramentas[toolId] || 'permitir'
                                                        return (
                                                            <div key={toolId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-900/70 border border-white/5">
                                                                <div className="min-w-0">
                                                                    <p className="text-sm text-white truncate">{tool.name}</p>
                                                                    <p className="text-xs text-neutral-500 line-clamp-1">{tool.description || 'Sem descrição'}</p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => handleAlterarPermissaoTool(server.config.id, tool, true)}
                                                                        className={`px-2 py-1 rounded-lg text-xs ${status === 'permitir' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-white/60'}`}
                                                                    >
                                                                        Permitir
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleAlterarPermissaoTool(server.config.id, tool, false)}
                                                                        className={`px-2 py-1 rounded-lg text-xs ${status === 'bloquear' ? 'bg-red-500/20 text-red-300' : 'bg-white/5 text-white/60'}`}
                                                                    >
                                                                        Bloquear
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ) : server.status === 'connected' ? (
                                            <p className="text-xs text-neutral-500 py-2">Nenhuma ferramenta disponível</p>
                                        ) : (
                                            <p className="text-xs text-neutral-500 py-2">Conecte para ver as ferramentas</p>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
        )}
    </div>
)

interface FerramentasNativasProps {
    ferramentas: ToolDefinition[]
    onConfigurar: (id: string) => void
}

const FerramentasNativas: React.FC<FerramentasNativasProps> = ({ ferramentas, onConfigurar }) => {
    if (ferramentas.length === 0) return null

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-sm font-semibold text-white">Ferramentas nativas</h3>
                    <p className="text-xs text-neutral-500">Disponiveis sem configuracao extra</p>
                </div>
                <span className="text-xs text-neutral-500">{ferramentas.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {ferramentas.map((ferramenta) => {
                    const Icone = obterIconeFerramenta(ferramenta.icon)
                    return (
                        <div
                            key={ferramenta.id}
                            className="flex items-start gap-3 p-3 bg-neutral-800/50 rounded-lg cursor-pointer hover:bg-neutral-800/80 transition-colors"
                            onClick={() => onConfigurar(ferramenta.id)}
                        >
                            <Icone size={16} className="text-blue-400 mt-0.5" />
                            <div className="min-w-0">
                                <p className="text-sm text-white truncate">{ferramenta.name}</p>
                                <p className="text-xs text-neutral-500 line-clamp-2">{ferramenta.description}</p>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-500">
                                    <span className="px-1.5 py-0.5 rounded bg-white/5 uppercase">{ferramenta.category}</span>
                                    <span className={ferramenta.enabled ? 'text-emerald-400' : 'text-neutral-500'}>
                                        {ferramenta.enabled ? 'Ativa' : 'Desativada'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ============================================================================
// MARKETPLACE TAB
// ============================================================================

interface MarketplaceTabProps {
    busca: string
    filtroFonte: FiltroFonteMarketplace
    onBuscaChange: (valor: string) => void
    onFiltroFonteChange: (fonte: FiltroFonteMarketplace) => void
    configsInstalados: MCPServerConfig[]
    dockerServers: DockerMCPServer[]
    dockerLoading: boolean
    dockerError: string | null
    dockerCategoria: string
    onDockerCategoriaChange: (cat: string) => void
    onDockerInstall: (server: DockerMCPServer) => void
    onDockerRefresh: () => void
    registroServers: RegistroMCPServidor[]
    registroLoading: boolean
    registroError: string | null
    registroCategoria: string
    onRegistroCategoriaChange: (cat: string) => void
    onRegistroRefresh: () => void
    onRegistroInstall: (server: RegistroMCPServidor) => void
    onAbrirDetalhes: (selecionado: SelecionadoMcp) => void
}

const MarketplaceTab: React.FC<MarketplaceTabProps> = ({
    busca,
    filtroFonte,
    onBuscaChange,
    onFiltroFonteChange,
    configsInstalados,
    dockerServers,
    dockerLoading,
    dockerError,
    dockerCategoria,
    onDockerCategoriaChange,
    onDockerInstall,
    onDockerRefresh,
    registroServers,
    registroLoading,
    registroError,
    registroCategoria,
    onRegistroCategoriaChange,
    onRegistroRefresh,
    onRegistroInstall,
    onAbrirDetalhes
}) => {
    const carregando = dockerLoading || registroLoading
    const erros = [dockerError, registroError].filter(Boolean)
    const mostrarFiltroDocker = filtroFonte !== 'registro'
    const mostrarFiltroRegistro = filtroFonte !== 'docker'

    const listaCombinada = [
        ...dockerServers.map((server) => ({ origem: 'docker' as const, docker: server })),
        ...registroServers.map((server) => ({ origem: 'registro' as const, registro: server }))
    ]

    const listaFiltrada = listaCombinada.filter((item) => {
        if (filtroFonte === 'todas') return true
        return item.origem === filtroFonte
    })
    const mostrarLoader = carregando && listaFiltrada.length === 0

    const handleRefresh = () => {
        onDockerRefresh()
        onRegistroRefresh()
    }

    return (
        <div className="h-full flex flex-col">
            {/* Search */}
            <div className="flex-none px-5 py-4 border-b border-white/5 space-y-3">
                <div className="flex gap-3">
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <input
                            type="text"
                            value={busca}
                            onChange={e => onBuscaChange(e.target.value)}
                            placeholder="Buscar servidores MCP..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-500/50 transition-colors"
                        />
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={carregando}
                        className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                        title="Atualizar"
                    >
                        <RefreshCw size={16} className={carregando ? 'animate-spin' : ''} />
                    </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500">Fonte</span>
                        <select
                            value={filtroFonte}
                            onChange={(event) => onFiltroFonteChange(event.target.value as FiltroFonteMarketplace)}
                            style={{ colorScheme: 'dark' }}
                            className="bg-neutral-900 border border-white/10 rounded-lg text-xs text-neutral-200 px-2 py-1.5 focus:outline-none focus:border-blue-500/50"
                        >
                            <option value="todas">Todas</option>
                            <option value="docker">Docker</option>
                            <option value="registro">Registry</option>
                        </select>
                    </div>
                    {mostrarFiltroDocker && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-500">Categoria Docker</span>
                            <select
                                value={dockerCategoria}
                                onChange={(event) => onDockerCategoriaChange(event.target.value)}
                                style={{ colorScheme: 'dark' }}
                                className="bg-neutral-900 border border-white/10 rounded-lg text-xs text-neutral-200 px-2 py-1.5 focus:outline-none focus:border-blue-500/50"
                            >
                                {DOCKER_MCP_CATEGORIES.map((categoria) => (
                                    <option key={categoria.id} value={categoria.id}>
                                        {categoria.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {mostrarFiltroRegistro && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-500">Tipo Registry</span>
                            <select
                                value={registroCategoria}
                                onChange={(event) => onRegistroCategoriaChange(event.target.value)}
                                style={{ colorScheme: 'dark' }}
                                className="bg-neutral-900 border border-white/10 rounded-lg text-xs text-neutral-200 px-2 py-1.5 focus:outline-none focus:border-blue-500/50"
                            >
                                {REGISTRO_MCP_CATEGORIES.map((categoria) => (
                                    <option key={categoria.id} value={categoria.id}>
                                        {categoria.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Server List */}
            <div className="flex-1 overflow-y-auto p-5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                {erros.map((erro, index) => (
                    <div key={index} className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
                        <AlertCircle size={16} className="text-red-400" />
                        <span className="text-sm text-red-400">{erro}</span>
                    </div>
                ))}

                {mostrarLoader ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 size={32} className="text-blue-400 animate-spin mb-3" />
                        <p className="text-neutral-500 text-sm">Carregando servidores...</p>
                    </div>
                ) : listaFiltrada.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Store size={48} className="text-neutral-600 mb-4" />
                        <p className="text-neutral-400">Nenhum servidor encontrado</p>
                    </div>
                ) : (
                    <>
                        <p className="text-xs text-neutral-500 mb-4">{listaFiltrada.length} servidores encontrados</p>
                        <div className="grid grid-cols-2 gap-3">
                            {listaFiltrada.map((item, idx) => {
                                const instalado = item.origem === 'docker'
                                    ? verificarInstaladoDocker(item.docker, configsInstalados)
                                    : verificarInstaladoRegistro(item.registro, configsInstalados)

                                if (item.origem === 'docker') {
                                    return (
                                        <MarketplaceCard 
                                            key={`${item.docker.name}-${idx}`}
                                            server={item.docker}
                                            instalado={instalado}
                                            onInstall={() => onDockerInstall(item.docker)}
                                            onDetalhes={() => onAbrirDetalhes({ origem: 'docker', servidor: item.docker })}
                                        />
                                    )
                                }

                                return (
                                    <CartaoRegistroMcp
                                        key={`${item.registro.server.name}-${idx}`}
                                        servidor={item.registro}
                                        instalado={instalado}
                                        onDetalhes={() => onAbrirDetalhes({ origem: 'registro', servidor: item.registro })}
                                        onInstall={() => onRegistroInstall(item.registro)}
                                    />
                                )
                            })}
                        </div>
                    </>
                )}

                <div className="text-center pt-6 mt-6 border-t border-white/5 flex flex-wrap items-center justify-center gap-4">
                    <a
                        href="https://hub.docker.com/mcp/explore"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-neutral-500 hover:text-blue-400 transition-colors inline-flex items-center gap-1.5"
                    >
                        <ExternalLink size={12} />
                        Docker MCP Hub
                    </a>
                    <a
                        href="https://registry.modelcontextprotocol.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-neutral-500 hover:text-blue-400 transition-colors inline-flex items-center gap-1.5"
                    >
                        <ExternalLink size={12} />
                        MCP Registry
                    </a>
                </div>
            </div>
        </div>
    )
}

interface MarketplaceCardProps {
    server: DockerMCPServer
    instalado: boolean
    onInstall: () => void
    onDetalhes: () => void
}

const MarketplaceCard: React.FC<MarketplaceCardProps> = ({ server, instalado, onInstall, onDetalhes }) => {
    const meta = server.meta
    const isPopular = POPULAR_SERVERS.includes(server.name)

    return (
        <div
            onClick={onDetalhes}
            className={`flex flex-col p-4 bg-white/5 border rounded-xl hover:border-blue-500/30 transition-colors cursor-pointer ${
                isPopular ? 'border-blue-500/20' : 'border-white/10'
            }`}
        >
            <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0 overflow-hidden">
                    {meta?.icon ? (
                        <img 
                            src={meta.icon} 
                            alt="" 
                            className="w-6 h-6 object-contain" 
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} 
                        />
                    ) : (
                        <Plug size={18} className="text-neutral-500" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-medium text-white truncate">
                            {meta?.title || server.name}
                        </h3>
                        {isPopular && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-medium">
                                Popular
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-2">
                        {meta?.description || 'Sem descricao'}
                    </p>
                </div>
            </div>

            {meta?.tags && meta.tags.length > 0 && (
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    {meta.tags.slice(0, 3).map(tag => (
                        <span 
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between mt-auto pt-2">
                {meta?.source?.project && (
                    <a
                        href={meta.source.project}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="text-xs text-neutral-500 hover:text-white transition-colors flex items-center gap-1"
                    >
                        <Github size={12} />
                        GitHub
                    </a>
                )}
                <button
                    onClick={(event) => {
                        event.stopPropagation()
                        if (!instalado) {
                            onInstall()
                        }
                    }}
                    disabled={instalado}
                    className={`ml-auto px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium ${
                        instalado
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400'
                    }`}
                >
                    {instalado ? <CheckCircle2 size={12} /> : <Download size={12} />}
                    {instalado ? 'Instalado' : 'Instalar'}
                </button>
            </div>
        </div>
    )
}

interface CartaoRegistroMcpProps {
    servidor: RegistroMCPServidor
    instalado: boolean
    onDetalhes: () => void
    onInstall: () => void
}

const CartaoRegistroMcp: React.FC<CartaoRegistroMcpProps> = ({ servidor, instalado, onDetalhes, onInstall }) => {
    const info = servidor.server
    const titulo = info.title || formatarNomeMcp(info.name)
    const icone = obterIconeRegistro(info.icons)
    const pacotes = info.packages || []
    const tiposPacote = Array.from(new Set(pacotes.map((pacote) => pacote.registryType)))
    const status = servidor._meta?.['io.modelcontextprotocol.registry/official']?.status
    const remotos = info.remotes?.length ? ['Remoto'] : []
    const etiquetas = [...tiposPacote.map((tipo) => tipo.toUpperCase()), ...remotos].slice(0, 3)
    const podeInstalar = pacotes.length > 0 || (info.remotes || []).some((remoto) => remoto.type === 'streamable-http')

    return (
        <div
            onClick={onDetalhes}
            className="flex flex-col p-4 bg-white/5 border border-white/10 rounded-xl hover:border-blue-500/30 transition-colors cursor-pointer"
        >
            <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0 overflow-hidden">
                    {icone ? (
                        <img 
                            src={icone}
                            alt=""
                            className="w-6 h-6 object-contain"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                    ) : (
                        <Plug size={18} className="text-neutral-500" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-medium text-white truncate">
                            {titulo}
                        </h3>
                        {status && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                status === 'active'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : status === 'deprecated'
                                        ? 'bg-yellow-500/20 text-yellow-400'
                                        : 'bg-red-500/20 text-red-400'
                            }`}>
                                {status}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-2">
                        {info.description || 'Sem descricao'}
                    </p>
                </div>
            </div>

            {etiquetas.length > 0 && (
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    {etiquetas.map(tag => (
                        <span 
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between mt-auto pt-2 text-xs text-neutral-500 gap-3">
                <span className="truncate">{info.name}</span>
                <div className="flex items-center gap-2">
                    <span className="text-neutral-400">v{info.version}</span>
                    <button
                        onClick={(event) => {
                            event.stopPropagation()
                            if (!instalado) {
                                onInstall()
                            }
                        }}
                        disabled={!podeInstalar || instalado}
                        className={`px-2.5 py-1 rounded-lg transition-colors text-[10px] font-medium disabled:opacity-50 ${
                            instalado
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 disabled:hover:bg-blue-500/20'
                        }`}
                    >
                        {instalado ? 'Instalado' : 'Instalar'}
                    </button>
                </div>
            </div>
        </div>
    )
}

interface LinhaInfoProps {
    titulo: string
    valor?: React.ReactNode
}

const LinhaInfo: React.FC<LinhaInfoProps> = ({ titulo, valor }) => (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
        <span className="text-neutral-500">{titulo}</span>
        <span className="text-neutral-200 break-words">{valor || '-'}</span>
    </div>
)

interface DetalhesMcpModalProps {
    selecionado: SelecionadoMcp
    onClose: () => void
    onInstalarDocker: (server: DockerMCPServer) => void
    onInstalarRegistro: (server: RegistroMCPServidor) => void
    configsInstalados: MCPServerConfig[]
}

const DetalhesMcpModal: React.FC<DetalhesMcpModalProps> = ({
    selecionado,
    onClose,
    onInstalarDocker,
    onInstalarRegistro,
    configsInstalados
}) => {
    const [abaAtiva, setAbaAtiva] = useState<'visao' | 'ferramentas' | 'config'>('visao')
    const [registroDetalhado, setRegistroDetalhado] = useState<RegistroMCPServidor | null>(null)
    const [detalhesCarregando, setDetalhesCarregando] = useState(false)
    const [detalhesErro, setDetalhesErro] = useState<string | null>(null)

    useEffect(() => {
        setAbaAtiva('visao')
    }, [selecionado])

    useEffect(() => {
        if (selecionado.origem !== 'registro') {
            setRegistroDetalhado(null)
            setDetalhesErro(null)
            setDetalhesCarregando(false)
            return
        }

        let ativo = true
        const base = selecionado.servidor
        setRegistroDetalhado(base)
        setDetalhesErro(null)

        const nome = base.server.name
        const versao = base.server.version || 'latest'
        const url = `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(nome)}/versions/${encodeURIComponent(versao)}`

        const carregarDetalhes = async () => {
            setDetalhesCarregando(true)
            try {
                const response = await fetch(url)
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`)
                }
                const data = await response.json() as RegistroMCPServidor
                if (ativo) {
                    setRegistroDetalhado(data)
                }
            } catch (error: unknown) {
                if (ativo) {
                    setDetalhesErro(obterMensagemErro(error, 'Falha ao carregar detalhes'))
                }
            } finally {
                if (ativo) {
                    setDetalhesCarregando(false)
                }
            }
        }

        carregarDetalhes()
        return () => {
            ativo = false
        }
    }, [selecionado])

    const ehDocker = selecionado.origem === 'docker'
    const dadosDocker = ehDocker ? selecionado.servidor : null
    const dadosRegistro = !ehDocker ? (registroDetalhado || selecionado.servidor) : null

    const titulo = dadosDocker
        ? dadosDocker.meta?.title || formatarNomeMcp(dadosDocker.name)
        : dadosRegistro?.server.title || formatarNomeMcp(dadosRegistro?.server.name || '')
    const descricao = dadosDocker
        ? dadosDocker.meta?.description || 'Sem descricao'
        : dadosRegistro?.server.description || 'Sem descricao'
    const icone = dadosDocker
        ? dadosDocker.meta?.icon
        : obterIconeRegistro(dadosRegistro?.server.icons)

    const nomeOriginal = dadosDocker ? dadosDocker.name : dadosRegistro?.server.name || ''
    const versao = dadosDocker ? undefined : dadosRegistro?.server.version
    const statusRegistro = dadosRegistro?._meta?.['io.modelcontextprotocol.registry/official']?.status
    const publicado = dadosRegistro
        ? formatarDataCurta(dadosRegistro._meta?.['io.modelcontextprotocol.registry/official']?.publishedAt)
        : undefined
    const atualizado = dadosRegistro
        ? formatarDataCurta(dadosRegistro._meta?.['io.modelcontextprotocol.registry/official']?.updatedAt)
        : undefined

    const repositorio = dadosDocker
        ? dadosDocker.meta?.source?.project
        : dadosRegistro?.server.repository?.url
    const website = dadosRegistro?.server.websiteUrl
    const imagemDocker = dadosDocker
        ? dadosDocker.meta?.image || `mcp/${dadosDocker.name}`
        : undefined
    const imagemDockerSemTag = imagemDocker?.split(':')[0]
    const urlDockerHub = imagemDockerSemTag ? `https://hub.docker.com/r/${imagemDockerSemTag}` : null

    const pacotesRegistro = dadosRegistro?.server.packages || []
    const remotosRegistro = dadosRegistro?.server.remotes || []
    const variaveisAmbiente = pacotesRegistro.flatMap((pacote) => pacote.environmentVariables || [])
    const headersRemotos = remotosRegistro.flatMap((remoto) => remoto.headers || [])
    const argumentosRuntime = pacotesRegistro.flatMap((pacote) => pacote.runtimeArguments || [])
    const argumentosPacote = pacotesRegistro.flatMap((pacote) => pacote.packageArguments || [])
    const ferramentas = dadosRegistro?.server.tools || []

    const abrirRegistry = !ehDocker
        ? `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(nomeOriginal)}/versions/${encodeURIComponent(versao || 'latest')}`
        : null
    const podeInstalarRegistro = pacotesRegistro.length > 0 || remotosRegistro.some((remoto) => remoto.type === 'streamable-http')
    const estaInstalado = ehDocker
        ? (dadosDocker ? verificarInstaladoDocker(dadosDocker, configsInstalados) : false)
        : (dadosRegistro ? verificarInstaladoRegistro(dadosRegistro, configsInstalados) : false)

    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="w-[980px] max-w-[94vw] h-[82vh] bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
                <div className="flex-none p-6 border-b border-white/5 flex items-start gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center shrink-0 overflow-hidden">
                        {icone ? (
                            <img
                                src={icone}
                                alt=""
                                className="w-10 h-10 object-contain"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                        ) : (
                            <Plug size={28} className="text-neutral-500" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-semibold text-white truncate">{titulo}</h3>
                            {statusRegistro && (
                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                    statusRegistro === 'active'
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : statusRegistro === 'deprecated'
                                            ? 'bg-yellow-500/20 text-yellow-400'
                                            : 'bg-red-500/20 text-red-400'
                                }`}>
                                    {statusRegistro}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">{nomeOriginal}</p>
                        <p className="text-sm text-neutral-300 mt-3 max-w-3xl whitespace-pre-wrap">{descricao}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-4 text-xs text-neutral-500">
                            {versao && <span className="px-2 py-0.5 rounded bg-white/5">v{versao}</span>}
                            {imagemDocker && <span className="px-2 py-0.5 rounded bg-white/5">Imagem: {imagemDocker}</span>}
                            {publicado && <span className="px-2 py-0.5 rounded bg-white/5">Publicado: {publicado}</span>}
                            {atualizado && <span className="px-2 py-0.5 rounded bg-white/5">Atualizado: {atualizado}</span>}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                        {ehDocker ? (
                            <>
                                <button
                                    onClick={() => {
                                        if (dadosDocker) {
                                            onInstalarDocker(dadosDocker)
                                        }
                                        onClose()
                                    }}
                                    disabled={estaInstalado}
                                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${
                                        estaInstalado
                                            ? 'bg-emerald-500/20 text-emerald-200'
                                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                                    }`}
                                >
                                    {estaInstalado ? <CheckCircle2 size={14} /> : <Download size={14} />}
                                    {estaInstalado ? 'Instalado' : 'Instalar'}
                                </button>
                                <div className="flex items-center gap-2">
                                    {urlDockerHub && (
                                        <a
                                            href={urlDockerHub}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-neutral-200 rounded-lg transition-colors flex items-center gap-2 text-xs"
                                        >
                                            <ExternalLink size={12} />
                                            Docker Hub
                                        </a>
                                    )}
                                    {repositorio && (
                                        <a
                                            href={repositorio}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-neutral-200 rounded-lg transition-colors flex items-center gap-2 text-xs"
                                        >
                                            <Github size={12} />
                                            GitHub
                                        </a>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        if (dadosRegistro) {
                                            onInstalarRegistro(dadosRegistro)
                                        }
                                        onClose()
                                    }}
                                    disabled={!podeInstalarRegistro || estaInstalado}
                                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium disabled:opacity-50 ${
                                        estaInstalado
                                            ? 'bg-emerald-500/20 text-emerald-200'
                                            : 'bg-blue-600 hover:bg-blue-500 text-white disabled:hover:bg-blue-600'
                                    }`}
                                >
                                    {estaInstalado ? <CheckCircle2 size={12} /> : <Download size={12} />}
                                    {estaInstalado ? 'Instalado' : 'Instalar'}
                                </button>
                                {repositorio && (
                                    <a
                                        href={repositorio}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-2 bg-white/5 hover:bg-white/10 text-neutral-200 rounded-lg transition-colors flex items-center gap-2 text-xs"
                                    >
                                        <Github size={12} />
                                        GitHub
                                    </a>
                                )}
                                {abrirRegistry && (
                                    <a
                                        href={abrirRegistry}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-2 bg-white/5 hover:bg-white/10 text-neutral-200 rounded-lg transition-colors flex items-center gap-2 text-xs"
                                    >
                                        <ExternalLink size={12} />
                                        Registry
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-none px-6 pt-4 flex items-center gap-3">
                    {(['visao', 'ferramentas', 'config'] as const).map((aba) => (
                        <button
                            key={aba}
                            onClick={() => setAbaAtiva(aba)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                abaAtiva === aba
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {aba === 'visao' ? 'Visão geral' : aba === 'ferramentas' ? 'Ferramentas' : 'Config'}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4 space-y-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                    {abaAtiva === 'visao' && (
                        <div className="space-y-4">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                <LinhaInfo titulo="Descrição" valor={descricao} />
                                {repositorio && (
                                    <LinhaInfo
                                        titulo="Repositório"
                                        valor={
                                            <a
                                                href={repositorio}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-400 hover:text-blue-300 transition-colors"
                                            >
                                                {repositorio}
                                            </a>
                                        }
                                    />
                                )}
                                {website && (
                                    <LinhaInfo
                                        titulo="Website"
                                        valor={
                                            <a
                                                href={website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-400 hover:text-blue-300 transition-colors"
                                            >
                                                {website}
                                            </a>
                                        }
                                    />
                                )}
                                {imagemDocker && <LinhaInfo titulo="Imagem Docker" valor={imagemDocker} />}
                            </div>

                            {ferramentas.length > 0 && (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-white">Ferramentas</h4>
                                        <span className="text-xs text-neutral-500">{ferramentas.length}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {ferramentas.map((tool) => (
                                            <span
                                                key={tool.name}
                                                className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300"
                                            >
                                                {tool.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!ehDocker && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                        <h4 className="text-sm font-semibold text-white">Pacotes</h4>
                                        {pacotesRegistro.length > 0 ? (
                                            <div className="space-y-3">
                                                {pacotesRegistro.map((pacote, index) => (
                                                    <div key={`${pacote.identifier}-${index}`} className="text-xs text-neutral-300">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 rounded bg-white/5 text-neutral-200 uppercase">
                                                                {pacote.registryType}
                                                            </span>
                                                            <span className="text-neutral-400">{pacote.version || 'sem versão'}</span>
                                                        </div>
                                                        <p className="mt-1 break-all">{pacote.identifier}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-neutral-500">Nenhum pacote informado.</p>
                                        )}
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                        <h4 className="text-sm font-semibold text-white">Remotos</h4>
                                        {remotosRegistro.length > 0 ? (
                                            <div className="space-y-3">
                                                {remotosRegistro.map((remoto, index) => (
                                                    <div key={`${remoto.type}-${index}`} className="text-xs text-neutral-300">
                                                        <span className="px-2 py-0.5 rounded bg-white/5 text-neutral-200 uppercase">
                                                            {remoto.type}
                                                        </span>
                                                        {remoto.url && <p className="mt-1 break-all text-neutral-400">{remoto.url}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-neutral-500">Nenhum remoto informado.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {abaAtiva === 'ferramentas' && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                            {detalhesCarregando && ferramentas.length === 0 ? (
                                <div className="flex items-center gap-2 text-sm text-neutral-500">
                                    <Loader2 size={16} className="animate-spin text-blue-400" />
                                    Carregando ferramentas...
                                </div>
                            ) : ferramentas.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {ferramentas.map((tool) => (
                                        <div key={tool.name} className="flex items-start gap-3 p-3 bg-neutral-800/50 rounded-lg">
                                            <Settings size={14} className="text-blue-400 mt-0.5" />
                                            <div className="min-w-0">
                                                <p className="text-sm text-white truncate">{tool.name}</p>
                                                <p className="text-xs text-neutral-500 line-clamp-2">{tool.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <Terminal size={32} className="mx-auto text-neutral-600 mb-3" />
                                    <p className="text-sm text-neutral-400 mb-2">
                                        {detalhesErro
                                            ? `Falha ao carregar detalhes: ${detalhesErro}`
                                            : 'Ferramentas não listadas no registry'}
                                    </p>
                                    <p className="text-xs text-neutral-500 max-w-lg mx-auto">
                                        As ferramentas disponíveis são descobertas dinamicamente quando você <strong className="text-neutral-400">instala e conecta</strong> ao servidor MCP.
                                        Instale o servidor e clique em "Conectar" para ver a lista completa de ferramentas.
                                    </p>
                                    {repositorio && (
                                        <a
                                            href={repositorio}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-neutral-300 transition-colors"
                                        >
                                            <Github size={16} />
                                            Ver documentação no GitHub
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {abaAtiva === 'config' && (
                        <div className="space-y-4">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-white">Variáveis de ambiente</h4>
                                {variaveisAmbiente.length > 0 ? (
                                    <div className="space-y-2 text-xs text-neutral-300">
                                        {variaveisAmbiente.map((variavel, index) => (
                                            <div key={`${variavel.name}-${index}`} className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-neutral-200">{variavel.name}</p>
                                                    <p className="text-neutral-500">{variavel.description || variavel.placeholder || '-'}</p>
                                                </div>
                                                {variavel.isSecret && (
                                                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] uppercase">
                                                        Secreto
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-neutral-500">Nenhuma variável listada.</p>
                                )}
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-white">Headers</h4>
                                {headersRemotos.length > 0 ? (
                                    <div className="space-y-2 text-xs text-neutral-300">
                                        {headersRemotos.map((header, index) => (
                                            <div key={`${header.name}-${index}`} className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-neutral-200">{header.name}</p>
                                                    <p className="text-neutral-500">{header.description || header.placeholder || '-'}</p>
                                                </div>
                                                {header.isSecret && (
                                                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] uppercase">
                                                        Secreto
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-neutral-500">Nenhum header configurado.</p>
                                )}
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-white">Argumentos</h4>
                                {argumentosRuntime.length + argumentosPacote.length > 0 ? (
                                    <div className="space-y-2 text-xs text-neutral-300">
                                        {argumentosRuntime.map((arg, index) => (
                                            <div key={`runtime-${arg.name}-${index}`}>
                                                <p className="text-neutral-200">{arg.name || arg.valueHint || 'Argumento'}</p>
                                                <p className="text-neutral-500">{arg.description || arg.placeholder || '-'}</p>
                                            </div>
                                        ))}
                                        {argumentosPacote.map((arg, index) => (
                                            <div key={`pacote-${arg.name}-${index}`}>
                                                <p className="text-neutral-200">{arg.name || arg.valueHint || 'Argumento'}</p>
                                                <p className="text-neutral-500">{arg.description || arg.placeholder || '-'}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-neutral-500">Nenhum argumento listado.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    )
}

// ============================================================================
// ADD SERVER MODAL
// ============================================================================

interface AddServerModalProps {
    onClose: () => void
    onAdd: (config: MCPServerConfig) => Promise<void>
    configInicial?: MCPServerConfig
    titulo?: string
    textoConfirmar?: string
}

const AddServerModal: React.FC<AddServerModalProps> = ({
    onClose,
    onAdd,
    configInicial,
    titulo,
    textoConfirmar
}) => {
    const [name, setName] = useState(configInicial?.name || '')
    const [command, setCommand] = useState(configInicial?.command || 'docker')
    const [transporte, setTransporte] = useState<'stdio' | 'streamable-http'>(configInicial?.transport || 'stdio')
    const [urlRemota, setUrlRemota] = useState(configInicial?.url || '')
    const [headersTexto, setHeadersTexto] = useState(formatarHeadersTexto(configInicial?.headers))
    const [args, setArgs] = useState(configInicial?.args?.join(' ') || 'run -i --rm')
    const [envTexto, setEnvTexto] = useState(formatarEnvTexto(configInicial?.env))
    const [enabled, setEnabled] = useState(configInicial?.enabled ?? true)
    const [autoConnect, setAutoConnect] = useState(configInicial?.autoConnect ?? false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name || !command) return

        setLoading(true)
        try {
            const env = transporte === 'stdio' ? parsearChaveValorTexto(envTexto) : undefined
            const headers = transporte === 'streamable-http' ? parsearChaveValorTexto(headersTexto) : undefined
            await onAdd({
                id: configInicial?.id || `mcp-${Date.now()}`,
                name,
                command: transporte === 'stdio' ? command : undefined,
                args: transporte === 'stdio' ? args.split(/\s+/).filter(Boolean) : undefined,
                env,
                headers,
                transport: transporte === 'stdio' ? 'stdio' : 'streamable-http',
                url: transporte === 'streamable-http' ? urlRemota : undefined,
                enabled,
                autoConnect,
                icon: configInicial?.icon
            })
        } catch (error) {
            console.error('[AddServerModal] Error:', error)
        }
        setLoading(false)
    }

    return (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSubmit}
                className="w-[450px] bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                        {titulo || 'Adicionar Servidor MCP'}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm text-neutral-400 mb-1.5">Transporte</label>
                        <select
                            value={transporte}
                            onChange={(event) => setTransporte(event.target.value as 'stdio' | 'streamable-http')}
                            style={{ colorScheme: 'dark' }}
                            className="w-full bg-neutral-900 border border-white/10 rounded-xl text-sm text-neutral-200 px-3 py-2.5 focus:outline-none focus:border-blue-500/50"
                        >
                            <option value="stdio">STDIO</option>
                            <option value="streamable-http">Streamable HTTP</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-neutral-400 mb-1.5">Nome</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Meu Servidor"
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                        />
                    </div>

                    {transporte === 'stdio' ? (
                        <>
                            <div>
                                <label className="block text-sm text-neutral-400 mb-1.5">Comando</label>
                                <input
                                    type="text"
                                    value={command}
                                    onChange={e => setCommand(e.target.value)}
                                    placeholder="docker"
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-neutral-400 mb-1.5">Argumentos</label>
                                <input
                                    type="text"
                                    value={args}
                                    onChange={e => setArgs(e.target.value)}
                                    placeholder="run -i --rm mcp/server-name"
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                                />
                                <p className="text-[10px] text-neutral-600 mt-1.5">Separados por espaco</p>
                            </div>

                            <div>
                                <label className="block text-sm text-neutral-400 mb-1.5">Variaveis de ambiente</label>
                                <textarea
                                    value={envTexto}
                                    onChange={e => setEnvTexto(e.target.value)}
                                    placeholder="CHAVE=valor"
                                    rows={4}
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                                />
                                <p className="text-[10px] text-neutral-600 mt-1.5">Uma por linha no formato CHAVE=valor</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm text-neutral-400 mb-1.5">URL remota</label>
                                <input
                                    type="text"
                                    value={urlRemota}
                                    onChange={e => setUrlRemota(e.target.value)}
                                    placeholder="https://servidor.exemplo.com/mcp"
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-neutral-400 mb-1.5">Headers</label>
                                <textarea
                                    value={headersTexto}
                                    onChange={e => setHeadersTexto(e.target.value)}
                                    placeholder="Authorization: Bearer token"
                                    rows={3}
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                                />
                                <p className="text-[10px] text-neutral-600 mt-1.5">Uma por linha no formato Header: valor</p>
                            </div>
                        </>
                    )}

                    <div className="flex items-center gap-4 text-sm text-neutral-300">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(event) => setEnabled(event.target.checked)}
                                className="accent-blue-500"
                            />
                            Ativo
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoConnect}
                                onChange={(event) => setAutoConnect(event.target.checked)}
                                className="accent-blue-500"
                            />
                            Conectar automaticamente
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !name || (transporte === 'stdio' ? !command : !urlRemota)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-xl transition-colors flex items-center gap-2"
                    >
                        {loading && <Loader2 size={14} className="animate-spin" />}
                        {textoConfirmar || 'Adicionar'}
                    </button>
                </div>
            </motion.form>
        </div>
    )
}

export default MCPPanel
