import { app, BrowserWindow, ipcMain, screen, globalShortcut, clipboard, desktopCapturer, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import robot from 'robotjs'
import { initAutoUpdater, cleanupAutoUpdater } from './updater.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

let win: BrowserWindow | null
let chatWin: BrowserWindow | null = null
let tray: Tray | null = null
let grammarWin: BrowserWindow | null = null
let isDebugMode = false
let ultimoIgnore = true
let trackerInterval: NodeJS.Timeout | null = null
let modalRegions: Array<{ x: number; y: number; width: number; height: number }> = []
type JanelaEstado = 'pass_through' | 'interativo' | 'debug'
let estadoAtual: JanelaEstado = 'pass_through'
let ultimoLogEstado: { estado: JanelaEstado; relX: number; relY: number; sobre: boolean } | null = null
let atalhoGramaticalAtual: string | null = null
let atalhoScreenshotAtual: string | null = null
const ATALHO_SCREENSHOT_PADRAO = 'Control+Alt+S'
const logDebug = (...args: unknown[]) => {
    if (isDebugMode) console.log(...args)
}

const dispararColarGlobal = () => {
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

function aplicarPassThrough(winAlvo: BrowserWindow, options?: Electron.IgnoreMouseEventsOptions) {
    // Mantemos focusable true para continuar recebendo eventos de ponteiro (forward) e poder sair do modo fantasma.
    winAlvo.setIgnoreMouseEvents(true, options)
    // Não reforce alwaysOnTop aqui para evitar corridas; está fixo na criação.
    ultimoIgnore = true
}

function forcarInteracao(winAlvo: BrowserWindow, ignore: boolean, options?: Electron.IgnoreMouseEventsOptions) {
    if (ignore) {
        aplicarPassThrough(winAlvo, options)
        return
    }

    winAlvo.setIgnoreMouseEvents(false)
    winAlvo.focus()
    winAlvo.setAlwaysOnTop(true, process.platform === 'win32' ? 'pop-up-menu' : 'screen-saver')
    ultimoIgnore = false
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

function atualizarRegioes(regioes: Array<{ x: number; y: number; width: number; height: number }>) {
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

    if (estadoAtual === 'debug') return

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

    if (VITE_DEV_SERVER_URL) {
        grammarWin.loadURL(`${VITE_DEV_SERVER_URL}?window=grammar`)
    } else {
        grammarWin.loadFile(path.join(process.env.DIST || '', 'index.html'), { search: 'window=grammar' })
    }

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

    win.webContents.on('preload-error', (_event, _preloadPath, error) => {
        console.error('[preload-error]', error)
    })

    win.setAlwaysOnTop(true, process.platform === 'win32' ? 'pop-up-menu' : 'screen-saver')
    aplicarPassThrough(win, { forward: true })
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
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
    // Atalho de screenshot (fixo por ora)
    registrarAtalhoScreenshot(ATALHO_SCREENSHOT_PADRAO)

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

    ipcMain.on('request-window-focus', () => {
        if (!win || win.isDestroyed()) return
        try {
            win.focus()
        } catch (error) {
            console.error('request-window-focus error', error)
        }
    })

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
                sources.find((src) => (src as any).display_id === String(display.id)) ||
                sources.find((src) => (src.name || '').toLowerCase().includes('screen')) ||
                sources[0]
            return principal?.thumbnail?.toDataURL() || null
        } catch (error) {
            console.error('[screenshot] erro ao capturar', error)
            return null
        }
    })

    let chatWin: BrowserWindow | null = null

    ipcMain.on('open-expanded-chat', (_event, messages) => {
        // Hide overlay window
        if (win && !win.isDestroyed()) {
            win.hide()
        }

        if (chatWin && !chatWin.isDestroyed()) {
            chatWin.focus()
            chatWin.webContents.send('hydrate-chat', messages)
            return
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
            icon: iconPath, // Use path directly, Windows prefers this for ICO
            backgroundColor: '#0a0a0c',
            frame: false,
            titleBarStyle: 'hidden',
            skipTaskbar: false, // Visible in taskbar
            webPreferences: {
                preload: preloadPath,
                nodeIntegration: false,
                contextIsolation: true,
            },
        })

        // Also set icon after creation for extra compatibility
        if (!appIcon.isEmpty()) {
            chatWin.setIcon(appIcon)
        }

        if (VITE_DEV_SERVER_URL) {
            chatWin.loadURL(`${VITE_DEV_SERVER_URL}#chat`)
        } else {
            chatWin.loadFile(path.join(process.env.DIST || '', 'index.html'), { hash: 'chat' })
        }

        chatWin.webContents.on('did-finish-load', () => {
            chatWin?.webContents.send('hydrate-chat', messages)
        })

        // When ChatWindow closes, show overlay again with collapsed toolbar
        chatWin.on('closed', () => {
            chatWin = null
            if (win && !win.isDestroyed()) {
                win.show()
                win.webContents.send('collapse-toolbar')
            }
        })
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(process.env.DIST || '', 'index.html'))
    }
}

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

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(() => {
    createWindow()
    registrarAtalhoGramatical('Control+Alt+X')

    // Initialize auto-updater (respects user preference)
    initAutoUpdater(win)

    // Start with ChatWindow by default
    setTimeout(() => {
        if (win && !win.isDestroyed()) {
            win.hide()
        }

        const preloadPath = path.join(__dirname, 'preload.cjs')
        const iconPath = path.join(process.env.VITE_PUBLIC || '', 'selene.ico')
        console.log('[startup chatWin] icon path:', iconPath, 'exists?', fs.existsSync(iconPath))

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

        // Also set icon after creation for extra compatibility
        const appIcon = nativeImage.createFromPath(iconPath)
        if (!appIcon.isEmpty()) {
            chatWin.setIcon(appIcon)
        }

        if (VITE_DEV_SERVER_URL) {
            chatWin.loadURL(`${VITE_DEV_SERVER_URL}#chat`)
        } else {
            chatWin.loadFile(path.join(process.env.DIST || '', 'index.html'), { hash: 'chat' })
        }

        chatWin.on('closed', () => {
            chatWin = null
            if (win && !win.isDestroyed()) {
                win.show()
                win.webContents.send('collapse-toolbar')
            }
        })
    }, 500)

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

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Abrir Selene Chat',
            click: () => {
                if (chatWin && !chatWin.isDestroyed()) {
                    chatWin.show()
                    chatWin.focus()
                } else if (win && !win.isDestroyed()) {
                    win.webContents.send('open-chat-from-tray')
                }
            }
        },
        {
            label: 'Mostrar Overlay',
            click: () => {
                if (chatWin && !chatWin.isDestroyed()) {
                    chatWin.close()
                } else if (win && !win.isDestroyed()) {
                    win.show()
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

    tray.setContextMenu(contextMenu)

    tray.on('click', () => {
        if (chatWin && !chatWin.isDestroyed()) {
            chatWin.show()
            chatWin.focus()
        } else if (win && !win.isDestroyed()) {
            win.show()
        }
    })
})

app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    cleanupAutoUpdater()
})
