/**
 * Registro de Ferramentas Embutidas (Built-in Tools)
 * 
 * Centraliza e registra todas as definições de ferramentas locais da Selene.
 * Este arquivo é executado durante a inicialização da aplicação.
 */

import { toolRegistry } from '../ToolRegistry'
import { toolExecutor } from '../ToolExecutor'
import { webSearchHandler } from './webSearchTool'
import { memorySearchHandler } from './memorySearchTool'
import { projectInstructionsHandler } from './projectInstructionsTool'
import { projectFilesSearchHandler } from './projectFilesTool'

// Import de novos manipuladores (handlers)
import { bashToolHandler, createFileHandler, strReplaceHandler, viewHandler, presentFilesHandler, deleteFileHandler } from './fileTools'
import { webFetchHandler, imageSearchHandler } from './webTools'
import { weatherFetchHandler, fetchSportsDataHandler, placesSearchHandler, placesMapDisplayHandler } from './infoTools'
import { askUserInputHandler, messageComposeHandler, recipeDisplayHandler, memoryUserEditsHandler } from './interactiveTools'
import { visualizeShowWidgetHandler, visualizeReadMeHandler, searchMcpRegistryHandler, suggestConnectorsHandler } from './aiTools'

import type { ToolDefinition } from '../../../types/tools'

// ============================================================================
// DEFINIÇÕES DAS FERRAMENTAS
// ============================================================================

const definicoesFerramentasEmbutidas: ToolDefinition[] = [
    // --- Existentes ---
    {
        id: 'builtin:web_search',
        name: 'Busca na Web',
        description: 'Pesquisa informações atuais na internet. Use para notícias, preços, eventos recentes, e qualquer informação que precise estar atualizada.',
        category: 'search',
        parameters: [
            {
                name: 'query',
                type: 'string',
                description: 'O que pesquisar na web',
                required: true
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Globe'
    },
    {
        id: 'builtin:memory_search',
        name: 'Memória do Usuário',
        description: 'Busca informações sobre o usuário salvas em conversas anteriores. Use quando precisar lembrar preferências, projetos, ou contexto pessoal.',
        category: 'memory',
        parameters: [
            {
                name: 'query',
                type: 'string',
                description: 'O que buscar na memória',
                required: true
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Brain'
    },
    {
        id: 'builtin:project_instructions',
        name: 'Instruções do Projeto',
        description: 'Gerencia as instruções personalizadas do projeto atual. Use para atualizar, adicionar ou limpar instruções que serão aplicadas em todas as conversas do projeto.',
        category: 'project',
        parameters: [
            {
                name: 'action',
                type: 'string',
                description: 'Ação a realizar: "update" (substituir), "append" (adicionar ao final), ou "clear" (limpar)',
                required: true
            },
            {
                name: 'instructions',
                type: 'string',
                description: 'As novas instruções (obrigatório para "update" e "append")',
                required: false
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'File'
    },
    {
        id: 'builtin:project_file_search',
        name: 'Buscar Arquivos do Projeto',
        description: 'Busca trechos relevantes nos arquivos anexados ao projeto ativo. Use quando a pergunta depender de PDFs, documentos ou arquivos do projeto.',
        category: 'project',
        parameters: [
            {
                name: 'query',
                type: 'string',
                description: 'Termos ou pergunta para buscar nos arquivos do projeto.',
                required: true
            },
            {
                name: 'fileName',
                type: 'string',
                description: 'Nome parcial do arquivo para restringir a busca, se o usuário citar um documento específico.',
                required: false
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Search'
    },
    {
        id: 'builtin:analyze_screenshot',
        name: 'Analisar Tela',
        description: 'Captura e analisa o conteúdo atual da tela do usuário.',
        category: 'system',
        parameters: [
            {
                name: 'question',
                type: 'string',
                description: 'Pergunta sobre o conteúdo da tela',
                required: false
            }
        ],
        source: { type: 'builtin' },
        enabled: false,
        icon: 'Camera'
    },

    // --- Computador & Arquivos ---
    {
        id: 'builtin:bash_tool',
        name: 'Executar Comando',
        description: 'Executa um comando de terminal (PowerShell/CMD no Windows, Bash no Linux) de forma assíncrona localmente e retorna o stdout/stderr.',
        category: 'code',
        parameters: [
            {
                name: 'command',
                type: 'string',
                description: 'O comando a ser executado no console.',
                required: true
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Terminal'
    },
    {
        id: 'builtin:create_file',
        name: 'Criar Arquivo',
        description: 'Cria um novo arquivo no disco do usuário gravando o conteúdo especificado.',
        category: 'file',
        parameters: [
            {
                name: 'path',
                type: 'string',
                description: 'Caminho do arquivo a ser criado. Pode ser absoluto, relativo (ex: "poema.txt", salvo em Downloads por padrão) ou usar atalhos como "Downloads/poema.txt" ou "~/Desktop/poema.txt".',
                required: true
            },
            {
                name: 'content',
                type: 'string',
                description: 'Conteúdo completo a ser escrito no arquivo.',
                required: true
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'File'
    },
    {
        id: 'builtin:str_replace',
        name: 'Editar Arquivo',
        description: 'Edita um arquivo existente substituindo um bloco específico de texto por outro.',
        category: 'file',
        parameters: [
            {
                name: 'path',
                type: 'string',
                description: 'Caminho do arquivo a ser editado. Pode ser absoluto, relativo (ex: "documento.txt", resolvido a partir de Downloads por padrão) ou usar atalhos como "Downloads/documento.txt" ou "~/Desktop/documento.txt".',
                required: true
            },
            {
                name: 'oldText',
                type: 'string',
                description: 'O texto antigo e exato a ser substituído (deve bater linha por linha).',
                required: true
            },
            {
                name: 'newText',
                type: 'string',
                description: 'O novo texto que entrará no lugar.',
                required: true
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'File'
    },
    {
        id: 'builtin:view',
        name: 'Visualizar Arquivo ou Pasta',
        description: 'Lê o conteúdo de um arquivo de texto ou lista os arquivos contidos em um diretório.',
        category: 'file',
        parameters: [
            {
                name: 'path',
                type: 'string',
                description: 'Caminho do arquivo ou pasta a visualizar. Pode ser absoluto, relativo (resolvido em Downloads por padrão) ou usar atalhos como "Downloads/arquivo.txt" ou "~/Desktop".',
                required: true
            },
            {
                name: 'startLine',
                type: 'number',
                description: 'Linha inicial para leitura parcial (ou número da página inicial se o arquivo for um PDF) (opcional).',
                required: false
            },
            {
                name: 'endLine',
                type: 'number',
                description: 'Linha final para leitura parcial (ou número da página final se o arquivo for um PDF) (opcional).',
                required: false
            },
            {
                name: 'query',
                type: 'string',
                description: 'Termo de busca para realizar pesquisa textual dentro do arquivo se ele for um PDF ou DOCX (opcional). Use isso para encontrar seções específicas sobre assuntos sem ter que ler páginas sequencialmente.',
                required: false
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Search'
    },
    {
        id: 'builtin:present_files',
        name: 'Revelar no SO',
        description: 'Abre a pasta e destaca o arquivo especificado no gerenciador de arquivos nativo do sistema operacional.',
        category: 'file',
        parameters: [
            {
                name: 'paths',
                type: 'array',
                description: 'Lista de caminhos absolutos ou relativos a revelar no explorador de arquivos do SO.',
                required: true
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Plug'
    },
    {
        id: 'builtin:delete_file',
        name: 'Excluir Arquivo',
        description: 'Exclui um arquivo ou pasta do disco do usuário permanentemente.',
        category: 'file',
        parameters: [
            {
                name: 'path',
                type: 'string',
                description: 'Caminho do arquivo ou pasta a ser excluído. Pode ser absoluto, relativo (ex: "poema.txt", resolvido em Downloads por padrão) ou usar atalhos como "Downloads/poema.txt" ou "~/Desktop/poema.txt".',
                required: true
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Trash2'
    },

    // --- Web & Pesquisa ---
    {
        id: 'builtin:web_fetch',
        name: 'Extrair URL',
        description: 'Carrega o conteúdo bruto de texto de uma página da web para leitura.',
        category: 'search',
        parameters: [
            {
                name: 'url',
                type: 'string',
                description: 'A URL do site a carregar.',
                required: true
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Globe'
    },
    {
        id: 'builtin:image_search',
        name: 'Buscar Imagens',
        description: 'Busca fotos e imagens na web correspondentes a um termo.',
        category: 'search',
        parameters: [
            {
                name: 'query',
                type: 'string',
                description: 'Termos de busca da imagem.',
                required: true
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Camera'
    },

    // --- Clima, Esportes e Lugares ---
    {
        id: 'builtin:weather_fetch',
        name: 'Consultar Clima',
        description: 'Obtém as condições climáticas atuais e previsão do tempo para uma cidade.',
        category: 'search',
        parameters: [
            {
                name: 'location',
                type: 'string',
                description: 'Nome da cidade ou localização.',
                required: true
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Globe'
    },
    {
        id: 'builtin:fetch_sports_data',
        name: 'Dados Esportivos',
        description: 'Consulta placares, resultados e tabelas de classificação de futebol e outras ligas.',
        category: 'search',
        parameters: [
            {
                name: 'league',
                type: 'string',
                description: 'Liga ou campeonato (ex: brasileirao, premier, champions).',
                required: false
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Globe'
    },
    {
        id: 'builtin:places_search',
        name: 'Buscar Estabelecimentos',
        description: 'Busca endereços, pontos turísticos, lojas e atrações em uma localização.',
        category: 'search',
        parameters: [
            {
                name: 'query',
                type: 'string',
                description: 'O que buscar (ex: restaurantes em Moema, SP).',
                required: true
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Search'
    },
    {
        id: 'builtin:places_map_display_v0',
        name: 'Exibir Mapa',
        description: 'Gera e apresenta a marcação de um local em mapa geográfico interativo.',
        category: 'search',
        parameters: [
            {
                name: 'latitude',
                type: 'number',
                description: 'Latitude do local.',
                required: true
            },
            {
                name: 'longitude',
                type: 'number',
                description: 'Longitude do local.',
                required: true
            },
            {
                name: 'label',
                type: 'string',
                description: 'Nome ou etiqueta a mostrar sobre o ponto.',
                required: false
            },
            {
                name: 'zoom',
                type: 'number',
                description: 'Zoom do mapa (12 a 18).',
                required: false
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Search'
    },

    // --- UX & Interações ---
    {
        id: 'builtin:ask_user_input_v0',
        name: 'Obter Opção do Usuário',
        description: 'Apresenta uma lista de botões clicáveis no chat para que o usuário faça uma escolha rápida.',
        category: 'system',
        parameters: [
            {
                name: 'prompt',
                type: 'string',
                description: 'A pergunta ou instrução a exibir.',
                required: true
            },
            {
                name: 'options',
                type: 'array',
                description: 'Lista de strings contendo os textos das opções (botões).',
                required: true
            },
            {
                name: 'multiple',
                type: 'boolean',
                description: 'Permitir múltipla escolha.',
                required: false
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Plug'
    },
    {
        id: 'builtin:message_compose_v1',
        name: 'Rascunhar Mensagem',
        description: 'Escreve um rascunho de e-mail, Slack ou SMS, abrindo o cliente padrão do OS para envio se aplicável.',
        category: 'system',
        parameters: [
            {
                name: 'body',
                type: 'string',
                description: 'O texto principal da mensagem.',
                required: true
            },
            {
                name: 'recipient',
                type: 'string',
                description: 'Destinatário (e-mail ou telefone).',
                required: false
            },
            {
                name: 'subject',
                type: 'string',
                description: 'Assunto (obrigatório para e-mail).',
                required: false
            },
            {
                name: 'type',
                type: 'string',
                description: 'Canal: "email", "slack" ou "sms".',
                required: false
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Plug'
    },
    {
        id: 'builtin:recipe_display_v0',
        name: 'Exibir Receita Culinária',
        description: 'Exibe uma receita de comida estruturada de forma dinâmica, permitindo reescalar porções.',
        category: 'system',
        parameters: [
            {
                name: 'title',
                type: 'string',
                description: 'Nome do prato.',
                required: true
            },
            {
                name: 'ingredients',
                type: 'array',
                description: 'Lista de ingredientes com objetos contendo: name, quantity e unit.',
                required: true
            },
            {
                name: 'instructions',
                type: 'array',
                description: 'Passos sequenciais de preparo.',
                required: true
            },
            {
                name: 'servings',
                type: 'number',
                description: 'Rendimento inicial em porções.',
                required: false
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Plug'
    },
    {
        id: 'builtin:memory_user_edits',
        name: 'Gerenciar Memória do Perfil',
        description: 'Gerencia as preferências persistidas sobre o usuário no perfil local (adicionar, listar ou remover memórias).',
        category: 'memory',
        parameters: [
            {
                name: 'action',
                type: 'string',
                description: 'Ação a executar: "add" (adicionar), "remove" (deletar) ou "list" (listar).',
                required: true
            },
            {
                name: 'content',
                type: 'string',
                description: 'Conteúdo da memória (obrigatório para a ação "add").',
                required: false
            },
            {
                name: 'id',
                type: 'string',
                description: 'ID da memória a remover (obrigatório para a ação "remove").',
                required: false
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Brain'
    },

    // --- IA, Widgets & MCP ---
    {
        id: 'builtin:visualize:show_widget',
        name: 'Renderizar Gráfico ou Widget',
        description: 'Gera e renderiza gráficos interativos, diagramas organizacionais ou SVGs personalizados diretamente no timeline de chat.',
        category: 'code',
        parameters: [
            {
                name: 'widgetType',
                type: 'string',
                description: 'Tipo de widget: "chart" (gráfico), "svg" (arte/SVG), "diagram" (diagrama) ou "dashboard" (painel).',
                required: true
            },
            {
                name: 'title',
                type: 'string',
                description: 'Título ou cabeçalho do widget.',
                required: false
            },
            {
                name: 'svgContent',
                type: 'string',
                description: 'Código XML/SVG puro se o tipo for "svg" ou "diagram".',
                required: false
            },
            {
                name: 'data',
                type: 'object',
                description: 'Dados estruturados para alimentar gráficos ou painéis.',
                required: false
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Terminal'
    },
    {
        id: 'builtin:visualize:read_me',
        name: 'Obter Diretrizes de Widget',
        description: 'Carrega os padrões estéticos e regras de design para a criação de widgets e SVG na Selene.',
        category: 'code',
        parameters: [],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'File'
    },
    {
        id: 'builtin:search_mcp_registry',
        name: 'Buscar no Registro MCP',
        description: 'Pesquisa conectores e serviços adicionais no registro de aplicativos do Model Context Protocol.',
        category: 'mcp',
        parameters: [
            {
                name: 'query',
                type: 'string',
                description: 'Nome ou função do conector que busca.',
                required: false
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Plug'
    },
    {
        id: 'builtin:suggest_connectors',
        name: 'Sugerir Conectores',
        description: 'Sugere quais conectores MCP podem otimizar o fluxo de trabalho informado.',
        category: 'mcp',
        parameters: [
            {
                name: 'workflow',
                type: 'string',
                description: 'Área de foco: "desenvolvimento", "produtividade" ou "comunicacao".',
                required: false
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Plug'
    }
]

const builtInTools: ToolDefinition[] = definicoesFerramentasEmbutidas.map(aplicarMetadadosFerramenta)

function aplicarMetadadosFerramenta(tool: ToolDefinition): ToolDefinition {
    const id = tool.id.toLowerCase()
    const ferramentasLeitura = [
        'web_search',
        'memory_search',
        'project_file_search',
        'view',
        'web_fetch',
        'image_search',
        'weather_fetch',
        'fetch_sports_data',
        'places_search',
        'places_map_display',
        'visualize:read_me',
        'search_mcp_registry',
        'suggest_connectors',
    ]
    const ferramentasEscrita = [
        'project_instructions',
        'create_file',
        'str_replace',
        'message_compose',
        'memory_user_edits',
        'visualize:show_widget',
        'ask_user_input',
        'recipe_display',
        'present_files',
    ]
    const destrutiva = id.includes('delete_file')
    const leitura = !destrutiva && ferramentasLeitura.some((item) => id.includes(item))
    const escrita = !destrutiva && ferramentasEscrita.some((item) => id.includes(item))
    const externa = tool.category === 'search' || id.includes('web') || id.includes('mcp')

    return {
        ...tool,
        readOnly: leitura,
        supportsParallel: leitura,
        deferLoading: tool.category === 'mcp' || id.includes('visualize'),
        riskLevel: destrutiva ? 'destructive' : escrita ? 'write' : externa ? 'external' : 'read',
    }
}

// ============================================================================
// INICIALIZAÇÃO E REGISTRO
// ============================================================================

let initialized = false

/**
 * Registra as definições e os respectivos manipuladores de execução.
 */
export function initializeBuiltInTools(): void {
    if (initialized) {
        console.log('[BuiltInTools] Built-in tools already registered')
        return
    }

    console.log('[BuiltInTools] Registering built-in tools definitions...')

    // 1. Registra definições
    toolRegistry.registerMany(builtInTools)

    // 2. Registra manipuladores (handlers)
    toolExecutor.registerHandler('builtin:web_search', webSearchHandler)
    toolExecutor.registerHandler('builtin:memory_search', memorySearchHandler)
    toolExecutor.registerHandler('builtin:project_instructions', projectInstructionsHandler)
    toolExecutor.registerHandler('builtin:project_file_search', projectFilesSearchHandler)

    // Handlers do sistema de arquivos e shell
    toolExecutor.registerHandler('builtin:bash_tool', bashToolHandler)
    toolExecutor.registerHandler('builtin:create_file', createFileHandler)
    toolExecutor.registerHandler('builtin:str_replace', strReplaceHandler)
    toolExecutor.registerHandler('builtin:view', viewHandler)
    toolExecutor.registerHandler('builtin:present_files', presentFilesHandler)
    toolExecutor.registerHandler('builtin:delete_file', deleteFileHandler)

    // Handlers web
    toolExecutor.registerHandler('builtin:web_fetch', webFetchHandler)
    toolExecutor.registerHandler('builtin:image_search', imageSearchHandler)

    // Handlers de dados
    toolExecutor.registerHandler('builtin:weather_fetch', weatherFetchHandler)
    toolExecutor.registerHandler('builtin:fetch_sports_data', fetchSportsDataHandler)
    toolExecutor.registerHandler('builtin:places_search', placesSearchHandler)
    toolExecutor.registerHandler('builtin:places_map_display_v0', placesMapDisplayHandler)

    // Handlers interativos
    toolExecutor.registerHandler('builtin:ask_user_input_v0', askUserInputHandler)
    toolExecutor.registerHandler('builtin:message_compose_v1', messageComposeHandler)
    toolExecutor.registerHandler('builtin:recipe_display_v0', recipeDisplayHandler)
    toolExecutor.registerHandler('builtin:memory_user_edits', memoryUserEditsHandler)

    // Handlers de IA e MCP
    toolExecutor.registerHandler('builtin:visualize:show_widget', visualizeShowWidgetHandler)
    toolExecutor.registerHandler('builtin:visualize:read_me', visualizeReadMeHandler)
    toolExecutor.registerHandler('builtin:search_mcp_registry', searchMcpRegistryHandler)
    toolExecutor.registerHandler('builtin:suggest_connectors', suggestConnectorsHandler)

    initialized = true
    console.log('[BuiltInTools] Registered', builtInTools.length, 'built-in tools')
}

/**
 * Retorna cópia das definições.
 */
export function getBuiltInToolDefinitions(): ToolDefinition[] {
    return [...builtInTools]
}

export { webSearchHandler, memorySearchHandler, projectInstructionsHandler }
export { setProjectUpdateCallback, clearProjectUpdateCallback } from './projectInstructionsTool'
export { setProjectFilesSearchCallback, clearProjectFilesSearchCallback } from './projectFilesTool'
