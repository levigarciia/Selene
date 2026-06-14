import { app, BrowserWindow, ipcMain, screen, globalShortcut, desktopCapturer, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { createRequire } from 'module'
import { initAutoUpdater, cleanupAutoUpdater } from './updater.js'
import { setupWhisperIPC } from './whisper.js'
import { setupWebSearchIPC } from './web-search.js'
import { setupLocalWhisperIPC } from './local-whisper/LocalWhisperService.js'
import { setupLocalParakeetIPC } from './local-parakeet/LocalParakeetService.js'
import { setupLocalLLMIPC } from './local-llm/LocalLLMService.js'
import { localLLMHostService } from './local-llm/LocalLLMHostService.js'
import { localLLMHttpService } from './local-llm/LocalLLMHttpService.js'
import { setupMCPIPC } from './mcp/mcpIPC.js'
import { configurarIpcSistemaArquivos } from './filesystem-ipc.js'


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const requireNativo = createRequire(import.meta.url)

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

let win: BrowserWindow | null
let chatWin: BrowserWindow | null = null
let tray: Tray | null = null
let grammarWin: BrowserWindow | null = null
let isDebugMode = false
let trackerInterval: NodeJS.Timeout | null = null
let timeoutInicialChat: NodeJS.Timeout | null = null
let modalRegions: Array<{ x: number; y: number; width: number; height: number }> = []
type JanelaEstado = 'pass_through' | 'interativo' | 'debug'
let estadoAtual: JanelaEstado = 'pass_through'
let ultimoLogEstado: { estado: JanelaEstado; relX: number; relY: number; sobre: boolean } | null = null
let atalhoGramaticalAtual: string | null = null
let atalhoScreenshotAtual: string | null = null
let atalhoScreenshotAreaAtual: string | null = null
let overlayIsVisible = true // Rastreia se o overlay está "ativo" (não escondido pelo usuário)
let updateTrayMenuCallback: (() => void) | null = null // Callback para atualizar menu do tray
const ATALHO_SCREENSHOT_PADRAO = 'Control+Alt+S'
const logDebug = (...args: unknown[]) => {
    if (isDebugMode) console.log(...args)
}
let isAreaSelectionMode = false
let areaEnforceInterval: NodeJS.Timeout | null = null
let hidratacaoPendenteChat: unknown[] | null = null
type RobotJS = {
    keyTap: (tecla: string, modificador?: string | string[]) => void
}
let robot: RobotJS | null | undefined

const obterRobot = (): RobotJS | null => {
    if (robot !== undefined) {
        return robot
    }

    try {
        robot = requireNativo('robotjs') as RobotJS
        return robot
    } catch (error) {
        robot = null
        console.error(
            '[robotjs] Falha ao carregar módulo nativo. Execute `bun run rebuild:nativos` para recompilar o binário do Electron.',
            error
        )
        return null
    }
}

// Helper para atualizar estado do overlay e menu do tray
const setOverlayVisible = (visible: boolean) => {
    overlayIsVisible = visible
    if (updateTrayMenuCallback) updateTrayMenuCallback()
}

const ocultarOverlay = () => {
    if (!win || win.isDestroyed()) return
    win.hide()
    setOverlayVisible(false)
}

const mostrarOverlay = () => {
    if (!win || win.isDestroyed()) return
    win.show()
    setOverlayVisible(true)
    win.webContents.send('collapse-toolbar')
}

const limparTimeoutInicialChat = () => {
    if (!timeoutInicialChat) return
    clearTimeout(timeoutInicialChat)
    timeoutInicialChat = null
}

const enviarHidratacaoPendenteChat = () => {
    if (!chatWin || chatWin.isDestroyed() || !hidratacaoPendenteChat) return
    chatWin.webContents.send('hydrate-chat', hidratacaoPendenteChat)
    hidratacaoPendenteChat = null
}

const vincularEventosEstadoJanela = (janela: BrowserWindow) => {
    const notificarEstado = () => {
        if (janela.isDestroyed()) return
        janela.webContents.send('window-maximized-change', janela.isMaximized())
    }

    janela.on('maximize', notificarEstado)
    janela.on('unmaximize', notificarEstado)
}

function abrirJanelaChat(messages: unknown[] = []) {
    if (messages.length > 0) {
        hidratacaoPendenteChat = messages
    }

    limparTimeoutInicialChat()
    ocultarOverlay()

    if (chatWin && !chatWin.isDestroyed()) {
        if (chatWin.isMinimized()) {
            chatWin.restore()
        }
        chatWin.show()
        chatWin.focus()

        if (!chatWin.webContents.isLoading()) {
            enviarHidratacaoPendenteChat()
        }
        return chatWin
    }

    const preloadPath = path.join(__dirname, 'preload.cjs')
    const iconPath = path.join(process.env.VITE_PUBLIC || '', 'selene.ico')
    console.log('[chatWin] icon path:', iconPath, 'exists?', fs.existsSync(iconPath))

    const appIcon = nativeImage.createFromPath(iconPath)
    console.log('[chatWin] icon isEmpty?', appIcon.isEmpty(), 'size:', appIcon.getSize())

    chatWin = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        center: true,
        icon: iconPath,
        backgroundColor: '#0a0a0c',
        frame: false,
        titleBarStyle: 'hidden',
        skipTaskbar: false,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    vincularEventosEstadoJanela(chatWin)

    if (!appIcon.isEmpty()) {
        chatWin.setIcon(appIcon)
    }

    if (VITE_DEV_SERVER_URL) {
        chatWin.loadURL(`${VITE_DEV_SERVER_URL}#chat`)
    } else {
        chatWin.loadFile(path.join(process.env.DIST || '', 'index.html'), { hash: 'chat' })
    }

    configurarMenuInspecionar(chatWin)

    chatWin.webContents.once('did-finish-load', () => {
        enviarHidratacaoPendenteChat()
    })

    chatWin.on('closed', () => {
        chatWin = null
        mostrarOverlay()
    })

    return chatWin
}

const dispararColarGlobal = () => {
    const robot = obterRobot()

    if (!robot) {
        console.error('[colagem-global] robotjs indisponível; atalho global de colagem foi ignorado')
        return
    }

    try {
        robot.keyTap('v', process.platform === 'darwin' ? 'command' : 'control')
    } catch (error) {
        console.error('[colagem-global] falha ao enviar Ctrl+V', error)
    }
}

const aguardar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Usa biblioteca nativa para obter texto selecionado
// Suporta Windows (simula Ctrl+C) e Mac (Accessibility API + fallback)
const obterTextoSelecionado = async (): Promise<string> => {
    try {
        // Importação dinâmica para compatibilidade com ESM
        const { getSelectedText } = await import('node-get-selected-text')

        logDebug('[obterTextoSelecionado] Tentando via node-get-selected-text library...')
        const texto = getSelectedText() // função síncrona retorna string

        if (texto?.trim()) {
            logDebug('[obterTextoSelecionado] Texto obtido:', texto.substring(0, 50) + '...')
            return texto
        }

        logDebug('[obterTextoSelecionado] Nenhum texto capturado')
        return ''
    } catch (error) {
        console.error('[obterTextoSelecionado] Erro:', error)
        return ''
    }
}

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
type FonteCapturaTela = Electron.DesktopCapturerSource & { display_id?: string }

function aplicarPassThrough(winAlvo: BrowserWindow, options?: Electron.IgnoreMouseEventsOptions) {
    // Mantemos focusable true para continuar recebendo eventos de ponteiro (forward) e poder sair do modo fantasma.
    winAlvo.setIgnoreMouseEvents(true, options)
    // Não reforce alwaysOnTop aqui para evitar corridas; está fixo na criação.
}

function forcarInteracao(winAlvo: BrowserWindow, ignore: boolean, options?: Electron.IgnoreMouseEventsOptions) {
    if (ignore) {
        aplicarPassThrough(winAlvo, options)
        return
    }

    winAlvo.setIgnoreMouseEvents(false)
    winAlvo.focus()
    winAlvo.setAlwaysOnTop(true, process.platform === 'win32' ? 'pop-up-menu' : 'screen-saver')
}

function definirEstado(novo: JanelaEstado) {
    if (!win || win.isDestroyed()) return
    if (estadoAtual === novo) return
    estadoAtual = novo

    switch (novo) {
        case 'pass_through':
            aplicarPassThrough(win, { forward: true })
            break
        case 'interativo':
            forcarInteracao(win, false)
            break
        case 'debug':
            forcarInteracao(win, false)
            break
    }
}

function registrarAtalhoGramatical(atalho: string) {
    if (atalhoGramaticalAtual) {
        globalShortcut.unregister(atalhoGramaticalAtual)
    }

    if (!atalho) {
        atalhoGramaticalAtual = null
        return
    }

    atalhoGramaticalAtual = atalho
    const registrado = globalShortcut.register(atalho, async () => {
        console.log('[atalho-gramatical] Atalho pressionado, capturando texto ANTES de abrir janela...')

        // IMPORTANTE: Capturar texto ANTES de abrir/focar a janela
        // Senão o foco vai para a janela Selene e perdemos o texto selecionado no app externo
        let textoAtalho = ''
        try {
            textoAtalho = await obterTextoSelecionado()
            console.log('[atalho-gramatical] Texto capturado:', textoAtalho ? textoAtalho.substring(0, 30) + '...' : '(vazio)')
        } catch (error) {
            console.warn('[atalho-gramatical] Falha ao obter seleção:', error)
        }

        // Agora sim, abre/foca a janela de gramática
        if (!grammarWin || grammarWin.isDestroyed()) {
            createGrammarWindow()
        } else {
            grammarWin.show()
            grammarWin.focus()
        }

        // Envia o texto para a janela
        if (grammarWin && !grammarWin.isDestroyed()) {
            // Pequeno delay para garantir que a janela carregou
            setTimeout(() => {
                grammarWin?.webContents.send('atalho-gramatical', textoAtalho)
            }, 300)
        }
    })

    if (!registrado) {
        console.warn('[atalho] não foi possível registrar', atalho)
        atalhoGramaticalAtual = null
    }
}

function registrarAtalhoScreenshot(atalho: string) {
    if (atalhoScreenshotAtual) {
        globalShortcut.unregister(atalhoScreenshotAtual)
    }

    if (!atalho) {
        atalhoScreenshotAtual = null
        return
    }

    atalhoScreenshotAtual = atalho
    const registrado = globalShortcut.register(atalho, () => {
        if (!win || win.isDestroyed()) return
        console.log('[atalho-screenshot] disparado', atalho)
        win.webContents.send('atalho-screenshot')
    })

    if (!registrado) {
        console.warn('[atalho-screenshot] não foi possível registrar', atalho)
        atalhoScreenshotAtual = null
    }
}

function registrarAtalhoScreenshotArea(atalho: string) {
    if (atalhoScreenshotAreaAtual) {
        globalShortcut.unregister(atalhoScreenshotAreaAtual)
    }

    if (!atalho) {
        atalhoScreenshotAreaAtual = null
        return
    }

    atalhoScreenshotAreaAtual = atalho
    const registrado = globalShortcut.register(atalho, () => {
         iniciarModoArea()
    })

    if (!registrado) {
        console.warn('[atalho-screenshot-area] não foi possível registrar', atalho)
        atalhoScreenshotAreaAtual = null
    }
}

function iniciarModoArea() {
    if (!win || win.isDestroyed()) return
    console.log('[modo-area] Iniciando...')
    
    isAreaSelectionMode = true
    pararTracker() // Stop tracker to prevent interference
    
    win.show()
    win.focus()
    
    // TRICK: Slightly increase opacity to force OS to register the window as clickable
    // #00000002 is just 1/255 more opaque than default #00000001
    win.setBackgroundColor('#00000002')

    // Force immediate interactivity
    forcarInteracao(win, false)
    win.setIgnoreMouseEvents(false) // Redundant but necessary
    definirEstado('interativo')

    // Reforço contínuo para evitar voltar a pass-through durante a seleção
    if (areaEnforceInterval) {
        clearInterval(areaEnforceInterval)
    }
    areaEnforceInterval = setInterval(() => {
        if (win && !win.isDestroyed()) {
            win.setIgnoreMouseEvents(false)
            definirEstado('interativo')
        }
    }, 60)

    win.webContents.send('atalho-screenshot-area')
}

function finalizarModoArea() {
    if (!win || win.isDestroyed()) return
    console.log('[modo-area] Finalizando...')
    
    isAreaSelectionMode = false
    if (areaEnforceInterval) {
        clearInterval(areaEnforceInterval)
        areaEnforceInterval = null
    }
    
    // Return to pass-through immediately
    win.setBackgroundColor('#00000001') // Reset to base transparency level
    aplicarPassThrough(win, { forward: true })
    definirEstado('pass_through')
    
    iniciarTracker() // Restart tracker
    checarCursor() // Check initial state
}


function atualizarRegioes(regioes: Array<{ x: number; y: number; width: number; height: number }>) {
    // Em modo de seleção de área, ignorar updates de regiões para não forçar pass-through.
    if (isAreaSelectionMode) return

    modalRegions = Array.isArray(regioes) ? regioes : []

    if (modalRegions.length > 0) {
        iniciarTracker()
    } else {
        pararTracker()
        if (win && !win.isDestroyed()) {
            aplicarPassThrough(win, { forward: true })
        }
    }
}

function checarCursor() {
    if (!win || win.isDestroyed()) {
        pararTracker()
        return
    }

    // Skip tracker if debugging or in area selection mode (keep interactive)
    if (estadoAtual === 'debug' || isAreaSelectionMode) return

    const cursor = screen.getCursorScreenPoint()
    const bounds = win.getContentBounds()

    const relX = cursor.x - bounds.x
    const relY = cursor.y - bounds.y
    const dentro = relX >= 0 && relX <= bounds.width && relY >= 0 && relY <= bounds.height

    if (!dentro) {
        definirEstado('pass_through')
        return
    }

    const sobreModal = modalRegions.some((r) => relX >= r.x && relX <= r.x + r.width && relY >= r.y && relY <= r.y + r.height)

    if (sobreModal) {
        definirEstado('interativo')
    } else {
        definirEstado('pass_through')
    }

    // Log leve apenas quando o estado muda ou a condição de hit muda.
    if (
        !ultimoLogEstado ||
        ultimoLogEstado.estado !== estadoAtual ||
        ultimoLogEstado.sobre !== sobreModal
    ) {
        ultimoLogEstado = { estado: estadoAtual, relX, relY, sobre: sobreModal }
        logDebug('[tracker]', { estado: estadoAtual, relX: Math.round(relX), relY: Math.round(relY), sobreModal, modalRegions: modalRegions.length })
    }
}

function iniciarTracker() {
    if (trackerInterval) return
    trackerInterval = setInterval(checarCursor, 120)
}

function pararTracker() {
    if (trackerInterval) {
        clearInterval(trackerInterval)
        trackerInterval = null
    }
}

function configurarMenuInspecionar(winAlvo: BrowserWindow) {
    winAlvo.webContents.on('context-menu', (_event, params) => {
        if (!isDebugMode) return
        if (winAlvo.isDestroyed()) return

        const menu = Menu.buildFromTemplate([
            {
                label: 'Inspecionar elemento',
                click: () => {
                    if (winAlvo.isDestroyed()) return
                    if (!winAlvo.webContents.isDevToolsOpened()) {
                        winAlvo.webContents.openDevTools({ mode: 'detach', activate: true })
                    }
                    winAlvo.webContents.inspectElement(params.x, params.y)
                }
            },
            {
                label: winAlvo.webContents.isDevToolsOpened() ? 'Fechar DevTools' : 'Abrir DevTools',
                click: () => {
                    if (winAlvo.isDestroyed()) return
                    if (winAlvo.webContents.isDevToolsOpened()) {
                        winAlvo.webContents.closeDevTools()
                    } else {
                        winAlvo.webContents.openDevTools({ mode: 'detach', activate: true })
                    }
                }
            }
        ])

        menu.popup({ window: winAlvo })
    })
}

function createGrammarWindow() {
    if (grammarWin && !grammarWin.isDestroyed()) {
        grammarWin.show()
        console.log('[grammarWin] show existing')
        return
    }

    const preloadPath = path.join(__dirname, 'preload.cjs')
    const iconPath = path.join(process.env.VITE_PUBLIC || '', 'selene.ico')

    console.log('[grammarWin] creating new window')

    grammarWin = new BrowserWindow({
        width: 900,
        height: 700,
        center: true,
        icon: iconPath,
        backgroundColor: '#0a0a0c',
        frame: false,
        focusable: true,
        skipTaskbar: false,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    vincularEventosEstadoJanela(grammarWin)

    if (VITE_DEV_SERVER_URL) {
        grammarWin.loadURL(`${VITE_DEV_SERVER_URL}?window=grammar`)
    } else {
        grammarWin.loadFile(path.join(process.env.DIST || '', 'index.html'), { search: 'window=grammar' })
    }

    configurarMenuInspecionar(grammarWin)

    // Opcional: esconder ao invés de fechar no evento nativo se desejar persistência
    // Mas vamos deixar o padrão (destruir) e recriar, para evitar memory leaks se não usado.
    // O IPC window-close (botão X) fará hide.
}

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    const x = screen.getPrimaryDisplay().workArea.x
    const y = screen.getPrimaryDisplay().workArea.y

    const preloadPath = path.join(__dirname, 'preload.cjs')
    console.log('[boot] preload path', preloadPath, 'exists?', fs.existsSync(preloadPath))

    win = new BrowserWindow({
        width,
        height,
        x,
        y,
        icon: path.join(process.env.VITE_PUBLIC || '', 'icon.png'),
        transparent: true,
        backgroundColor: '#00000001', // Mantem hit test mesmo com overlay quase transparente
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        focusable: true,
        hasShadow: false,
        skipTaskbar: true, // Start in tray mode, not visible in taskbar
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    vincularEventosEstadoJanela(win)

    win.webContents.on('preload-error', (_event, _preloadPath, error) => {
        console.error('[preload-error]', error)
    })

    win.setAlwaysOnTop(true, process.platform === 'win32' ? 'pop-up-menu' : 'screen-saver')
    aplicarPassThrough(win, { forward: true })
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
        // Durante seleção de área, nunca permita voltar para pass-through
        if (isAreaSelectionMode) {
            if (win && !win.isDestroyed()) {
                win.setIgnoreMouseEvents(false)
                definirEstado('interativo')
            }
            return
        }

        if (isDebugMode) {
            if (win && !win.isDestroyed()) {
                definirEstado('debug')
            }
            return
        }
        const webContents = event.sender
        const winFromEvent = BrowserWindow.fromWebContents(webContents)
        if (!winFromEvent) return
        logDebug('[ipc] set-ignore-mouse-events', { ignore, options })
        if (ignore) {
            definirEstado('pass_through')
        } else {
            definirEstado('interativo')
        }
    })

    ipcMain.on('update-modal-regions', (_event, regions) => {
        logDebug('[ipc] update-modal-regions', { qtd: Array.isArray(regions) ? regions.length : 0, exemplo: regions?.[0] })
        atualizarRegioes(regions)
    })

    ipcMain.on('registrar-atalho-gramatical', (_event, atalho: string) => {
        registrarAtalhoGramatical(atalho)
    })
    ipcMain.on('registrar-atalho-screenshot', (_event, atalho: string) => {
        registrarAtalhoScreenshot(atalho)
    })
    ipcMain.on('registrar-atalho-screenshot-area', (_event, atalho: string) => {
        registrarAtalhoScreenshotArea(atalho)
    })
    
    ipcMain.on('set-area-selection-mode', (_event, enabled: boolean) => {
        console.log('[ipc] set-area-selection-mode', enabled)
        if (enabled) {
            iniciarModoArea()
        } else {
            finalizarModoArea()
        }
    })

    ipcMain.handle('enviar-screenshot-chat', (_event, dataUrl: string) => {
        if (chatWin && !chatWin.isDestroyed() && chatWin.isVisible()) {
            chatWin.webContents.send('chat-receber-screenshot', dataUrl)
            chatWin.focus()
            return true
        }
        return false
    })

    // Atalho de screenshot (fixo por ora)
    registrarAtalhoScreenshot(ATALHO_SCREENSHOT_PADRAO)
    registrarAtalhoScreenshotArea('Control+Alt+A')

    ipcMain.on('fechar-aplicacao', () => {
        app.quit()
    })

    ipcMain.on('colar-clipboard-global', () => {
        dispararColarGlobal()
    })

    // Handler especial para aplicar texto do corretor gramatical
    ipcMain.on('aplicar-texto-gramatical', async () => {
        console.log('[aplicar-texto-gramatical] Iniciando...')

        // 1. Fechar a janela de gramática (não só esconder)
        //    Isso naturalmente devolve o foco para a janela anterior
        if (grammarWin && !grammarWin.isDestroyed()) {
            grammarWin.close()
            grammarWin = null
        }

        // 2. Aguardar a janela anterior receber foco
        await aguardar(200)

        // 3. Simular Ctrl+V para colar
        dispararColarGlobal()
        console.log('[aplicar-texto-gramatical] Ctrl+V enviado')
    })

    ipcMain.on('abrir-assistente-gramatical', () => {
        if (!grammarWin || grammarWin.isDestroyed()) {
            createGrammarWindow()
        } else {
            grammarWin.show()
            grammarWin.focus()
        }
    })

    ipcMain.on('set-always-on-top', (_event, shouldBeOnTop) => {
        if (!win || win.isDestroyed()) return
        try {
            if (shouldBeOnTop) {
                if (process.platform === 'darwin') {
                    win.setAlwaysOnTop(true, 'screen-saver', 1)
                } else {
                    win.setAlwaysOnTop(true, 'pop-up-menu')
                }
            } else {
                win.setAlwaysOnTop(false)
            }
        } catch (error) {
            console.error('set-always-on-top error', error)
        }
    })

    const focarJanelaOverlay = () => {
        if (!win || win.isDestroyed()) return
        try {
            definirEstado('interativo')
            win.focus()
        } catch (error) {
            console.error('request-window-focus error', error)
        }
    }

    ipcMain.on('request-window-focus', focarJanelaOverlay)
    // Alias para chamadas legadas
    ipcMain.on('request-focus', focarJanelaOverlay)

    ipcMain.handle('get-window-bounds', () => {
        if (!win || win.isDestroyed()) return null
        return win.getBounds()
    })

    ipcMain.handle('capturar-screenshot', async () => {
        try {
            const display = screen.getPrimaryDisplay()
            const { width, height } = display.workAreaSize
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width, height }
            })
            const principal =
                sources.find((src) => (src as FonteCapturaTela).display_id === String(display.id)) ||
                sources.find((src) => (src.name || '').toLowerCase().includes('screen')) ||
                sources[0]
            return principal?.thumbnail?.toDataURL() || null
        } catch (error) {
            console.error('[screenshot] erro ao capturar', error)
            return null
        }
    })

    // Usar a variável global chatWin declarada no topo do arquivo

    ipcMain.on('open-expanded-chat', (_event, messages) => {
        abrirJanelaChat(Array.isArray(messages) ? messages : [])
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(process.env.DIST || '', 'index.html'))
    }

    configurarMenuInspecionar(win)
}

// Drag customizado via JS — substitui -webkit-app-region: drag
// que quebra seleção de texto no Electron frameless (Windows)
let dragInterval: NodeJS.Timeout | null = null

ipcMain.on('window-start-drag', (event) => {
    const janela = BrowserWindow.fromWebContents(event.sender)
    if (!janela || janela.isDestroyed() || janela.isMaximized()) return

    const cursor = screen.getCursorScreenPoint()
    const bounds = janela.getBounds()
    const offsetX = cursor.x - bounds.x
    const offsetY = cursor.y - bounds.y

    if (dragInterval) clearInterval(dragInterval)

    dragInterval = setInterval(() => {
        if (janela.isDestroyed()) {
            if (dragInterval) clearInterval(dragInterval)
            dragInterval = null
            return
        }
        const pos = screen.getCursorScreenPoint()
        janela.setPosition(pos.x - offsetX, pos.y - offsetY)
    }, 16)
})

ipcMain.on('window-stop-drag', () => {
    if (dragInterval) {
        clearInterval(dragInterval)
        dragInterval = null
    }
})
ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
})

ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
        win.unmaximize()
    } else {
        win?.maximize()
    }
})

ipcMain.handle('window-is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
})

ipcMain.on('window-close', (event) => {
    const w = BrowserWindow.fromWebContents(event.sender)
    if (w === grammarWin) {
        w?.hide()
    } else {
        w?.close()
    }
})


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('before-quit', () => {
    void localLLMHostService.stop()
    void localLLMHttpService.stop()
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// Single instance lock - prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
    // Another instance is already running, quit this one
    console.log('[SingleInstance] Another instance is already running. Quitting.')
    app.quit()
} else {
    // This is the first/only instance
    app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window
        console.log('[SingleInstance] Second instance detected, focusing existing window.')
        if (chatWin && !chatWin.isDestroyed()) {
            if (chatWin.isMinimized()) chatWin.restore()
            chatWin.focus()
        } else if (win && !win.isDestroyed()) {
            win.show()
            win.focus()
        }
    })
}

app.whenReady().then(() => {
    createWindow()
    registrarAtalhoGramatical('Control+Alt+X')

    // Initialize Whisper IPC handlers

    // Initialize Whisper IPC handlers
    setupWhisperIPC()

    // Initialize Web Search IPC handlers
    setupWebSearchIPC()

    // Initialize MCP IPC handlers
    setupMCPIPC()

    // Initialize Filesystem IPC handlers
    configurarIpcSistemaArquivos()


    // Initialize Local Whisper Streaming IPC handlers
    if (win) {
        setupLocalWhisperIPC(win)
        setupLocalParakeetIPC(win)
        void setupLocalLLMIPC(win)
    }

    // Initialize auto-updater (respects user preference)
    initAutoUpdater(win)

    abrirJanelaChat()

    globalShortcut.register('F9', () => {
        if (!win) return
        isDebugMode = !isDebugMode
        console.log('Global F9 pressed. Debug Mode:', isDebugMode)

        if (isDebugMode) {
            definirEstado('debug')
        } else {
            definirEstado('pass_through')
        }

        win.webContents.send('debug-mode-toggle', isDebugMode)
    })

    // Create System Tray
    const trayIconPath = path.join(process.env.VITE_PUBLIC || '', 'tray-icon.png')
    const trayIcon = nativeImage.createFromPath(trayIconPath)

    tray = new Tray(trayIcon)
    tray.setToolTip('Selene - AI Assistant')

    // Função para criar menu dinâmico
    const buildTrayMenu = () => {
        return Menu.buildFromTemplate([
            {
                label: 'Abrir Selene Chat',
                click: () => {
                    abrirJanelaChat()
                }
            },
            {
                label: overlayIsVisible ? 'Ocultar Overlay' : 'Mostrar Overlay',
                click: () => {
                    if (overlayIsVisible) {
                        // Ocultar overlay
                        if (win && !win.isDestroyed()) {
                            win.hide()
                            setOverlayVisible(false)
                        }
                    } else {
                        // Mostrar overlay e ocultar chat
                        if (chatWin && !chatWin.isDestroyed()) {
                            chatWin.hide()
                        }
                        if (win && !win.isDestroyed()) {
                            win.show()
                            win.focus()
                            setOverlayVisible(true)
                        }
                    }
                }
            },
            {
                label: 'Assistente Gramatical',
                accelerator: 'Ctrl+Alt+X',
                click: () => {
                    if (!grammarWin || grammarWin.isDestroyed()) {
                        createGrammarWindow()
                    } else {
                        grammarWin.show()
                        grammarWin.focus()
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Sair',
                click: () => {
                    app.quit()
                }
            }
        ])
    }

    // Função para atualizar o menu do tray
    const updateTrayMenu = () => {
        tray?.setContextMenu(buildTrayMenu())
    }

    // Registrar callback global para atualizar menu quando estado mudar
    updateTrayMenuCallback = updateTrayMenu

    // Definir menu inicial
    updateTrayMenu()

    // Atualizar menu quando o tray receber clique direito (antes de mostrar o menu)
    tray.on('right-click', updateTrayMenu)

    // Click on tray icon toggles chat window
    tray.on('click', () => {
        if (chatWin && !chatWin.isDestroyed()) {
            if (chatWin.isVisible()) {
                chatWin.hide()
            } else {
                chatWin.show()
                chatWin.focus()
            }
        } else if (win && !win.isDestroyed()) {
            win.show()
        }
    })

    // Register global shortcut to show overlay (Ctrl+Alt+O)
    globalShortcut.register('Control+Alt+O', () => {
        if (chatWin && !chatWin.isDestroyed()) {
            chatWin.hide()
        }
        if (win && !win.isDestroyed()) {
            win.show()
            win.focus()
            setOverlayVisible(true)
        }
    })
})

app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    cleanupAutoUpdater()
})
