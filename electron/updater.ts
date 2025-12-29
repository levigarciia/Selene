/**
 * Auto-updater module for Selene
 * 
 * Implements silent auto-update checks using electron-updater.
 * Updates are only checked when the "Atualizações automáticas" toggle is enabled.
 * 
 * @see https://www.electron.build/auto-update
 */

// electron-updater is a CommonJS module, use default import
import electronUpdater from 'electron-updater'
import type { UpdateCheckResult, UpdateInfo, ProgressInfo } from 'electron-updater'
const { autoUpdater } = electronUpdater

import { app, BrowserWindow, ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

// Logger configuration - discrete logs for debugging
const log = {
    info: (...args: unknown[]) => console.log('[updater]', ...args),
    warn: (...args: unknown[]) => console.warn('[updater]', ...args),
    error: (...args: unknown[]) => console.error('[updater]', ...args),
    debug: (...args: unknown[]) => {
        if (process.env.DEBUG_UPDATER) {
            console.log('[updater:debug]', ...args)
        }
    }
}

// State management
let isCheckingForUpdates = false
let checkInterval: NodeJS.Timeout | null = null
let isAutoUpdateEnabled = false

// Check interval: 4 hours (in milliseconds)
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

// Settings file path (same location as localStorage in renderer)
const getSettingsPath = () => {
    const userDataPath = app.getPath('userData')
    return path.join(userDataPath, 'auto-update-settings.json')
}

/**
 * Load auto-update preference from persistent storage
 */
const loadAutoUpdatePreference = (): boolean => {
    try {
        const settingsPath = getSettingsPath()
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8')
            const settings = JSON.parse(data)
            return settings.autoUpdateEnabled === true
        }
    } catch (error) {
        log.warn('Failed to load auto-update preference:', error)
    }
    // Default: disabled until user explicitly enables
    return false
}

/**
 * Save auto-update preference to persistent storage
 */
const saveAutoUpdatePreference = (enabled: boolean): void => {
    try {
        const settingsPath = getSettingsPath()
        const settings = { autoUpdateEnabled: enabled, updatedAt: new Date().toISOString() }
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
        log.info('Auto-update preference saved:', enabled)
    } catch (error) {
        log.error('Failed to save auto-update preference:', error)
    }
}

/**
 * Configure auto-updater settings
 */
const configureAutoUpdater = () => {
    // Disable auto-download - we want control over when updates are installed
    autoUpdater.autoDownload = false

    // Disable auto-install on quit - we'll prompt the user
    autoUpdater.autoInstallOnAppQuit = true

    // Allow prereleases if on a prerelease version
    autoUpdater.allowPrerelease = false

    // Use generic provider with GitHub
    autoUpdater.allowDowngrade = false

    // Configure logging
    autoUpdater.logger = {
        info: (msg) => log.info(msg),
        warn: (msg) => log.warn(msg),
        error: (msg) => log.error(msg),
        debug: (msg) => log.debug(msg),
    }
}

/**
 * Set up auto-updater event listeners
 */
const setupEventListeners = (mainWindow: BrowserWindow | null) => {
    const sendToRenderer = (channel: string, ...args: unknown[]) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, ...args)
        }
        // Also send to all windows
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send(channel, ...args)
            }
        })
    }

    autoUpdater.on('checking-for-update', () => {
        log.info('Checking for updates...')
        sendToRenderer('update-status', { status: 'checking' })
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
        log.info('Update available:', info.version)
        sendToRenderer('update-status', {
            status: 'available',
            version: info.version,
            releaseNotes: info.releaseNotes,
            releaseDate: info.releaseDate
        })

        // Auto-download the update silently
        autoUpdater.downloadUpdate().catch(err => {
            log.error('Failed to download update:', err)
        })
    })

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
        log.info('No updates available. Current version:', app.getVersion())
        sendToRenderer('update-status', {
            status: 'not-available',
            currentVersion: app.getVersion()
        })
        isCheckingForUpdates = false
    })

    autoUpdater.on('download-progress', (progressInfo: ProgressInfo) => {
        log.debug(`Download progress: ${progressInfo.percent.toFixed(1)}%`)
        sendToRenderer('update-status', {
            status: 'downloading',
            progress: {
                percent: progressInfo.percent,
                bytesPerSecond: progressInfo.bytesPerSecond,
                transferred: progressInfo.transferred,
                total: progressInfo.total
            }
        })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
        log.info('Update downloaded:', info.version)
        sendToRenderer('update-status', {
            status: 'downloaded',
            version: info.version
        })
        isCheckingForUpdates = false
    })

    autoUpdater.on('error', (error: Error) => {
        log.error('Update error:', error.message)
        sendToRenderer('update-status', {
            status: 'error',
            error: error.message
        })
        isCheckingForUpdates = false
    })
}

/**
 * Check for updates (with duplicate call prevention)
 */
const checkForUpdates = async (): Promise<UpdateCheckResult | null> => {
    if (isCheckingForUpdates) {
        log.debug('Already checking for updates, skipping...')
        return null
    }

    if (!isAutoUpdateEnabled) {
        log.debug('Auto-update is disabled, skipping check...')
        return null
    }

    // Don't check for updates in development
    if (!app.isPackaged) {
        log.info('Skipping update check in development mode')
        return null
    }

    try {
        isCheckingForUpdates = true
        log.info('Starting update check...')
        return await autoUpdater.checkForUpdates()
    } catch (error) {
        log.error('Update check failed:', error)
        isCheckingForUpdates = false
        return null
    }
}

/**
 * Start periodic update checks
 */
const startPeriodicChecks = () => {
    if (checkInterval) {
        log.debug('Periodic checks already running')
        return
    }

    log.info(`Starting periodic update checks every ${CHECK_INTERVAL_MS / 1000 / 60} minutes`)

    checkInterval = setInterval(() => {
        checkForUpdates()
    }, CHECK_INTERVAL_MS)
}

/**
 * Stop periodic update checks
 */
const stopPeriodicChecks = () => {
    if (checkInterval) {
        clearInterval(checkInterval)
        checkInterval = null
        log.info('Periodic update checks stopped')
    }
}

/**
 * Enable auto-updates
 */
const enableAutoUpdate = () => {
    if (isAutoUpdateEnabled) return

    isAutoUpdateEnabled = true
    saveAutoUpdatePreference(true)
    startPeriodicChecks()

    // Perform initial check
    setTimeout(() => checkForUpdates(), 2000)

    log.info('Auto-update enabled')
}

/**
 * Disable auto-updates
 */
const disableAutoUpdate = () => {
    if (!isAutoUpdateEnabled) return

    isAutoUpdateEnabled = false
    saveAutoUpdatePreference(false)
    stopPeriodicChecks()

    log.info('Auto-update disabled')
}

/**
 * Set up IPC handlers for renderer communication
 */
const setupIpcHandlers = () => {
    // Toggle auto-update from renderer
    ipcMain.on('set-auto-update', (_event, enabled: boolean) => {
        if (enabled) {
            enableAutoUpdate()
        } else {
            disableAutoUpdate()
        }
    })

    // Get current auto-update status
    ipcMain.handle('get-auto-update-status', () => {
        return {
            enabled: isAutoUpdateEnabled,
            currentVersion: app.getVersion(),
            isPackaged: app.isPackaged
        }
    })

    // Manual update check from renderer
    ipcMain.handle('check-for-updates', async () => {
        if (!app.isPackaged) {
            return {
                success: false,
                message: 'Update checks disabled in development mode'
            }
        }

        try {
            const result = await checkForUpdates()
            return {
                success: true,
                updateInfo: result?.updateInfo
            }
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    })

    // Install update and restart
    ipcMain.on('install-update', () => {
        log.info('Installing update and restarting...')
        autoUpdater.quitAndInstall(false, true)
    })

    // Get app version
    ipcMain.handle('get-app-version', () => {
        return app.getVersion()
    })

    // Get user data path for Whisper models
    ipcMain.handle('get-user-data-path', () => {
        return app.getPath('userData')
    })
}

/**
 * Initialize the auto-updater system
 * Should be called once when the app is ready
 */
export const initAutoUpdater = (mainWindow: BrowserWindow | null) => {
    log.info('Initializing auto-updater...')
    log.info('App version:', app.getVersion())
    log.info('Is packaged:', app.isPackaged)

    // Configure auto-updater
    configureAutoUpdater()

    // Set up event listeners
    setupEventListeners(mainWindow)

    // Set up IPC handlers
    setupIpcHandlers()

    // Load preference and start if enabled
    isAutoUpdateEnabled = loadAutoUpdatePreference()
    log.info('Auto-update enabled from settings:', isAutoUpdateEnabled)

    if (isAutoUpdateEnabled && app.isPackaged) {
        // Delay initial check to not block app startup
        setTimeout(() => {
            checkForUpdates()
            startPeriodicChecks()
        }, 5000)
    }
}

/**
 * Clean up on app quit
 */
export const cleanupAutoUpdater = () => {
    stopPeriodicChecks()
    log.info('Auto-updater cleaned up')
}

export { checkForUpdates, enableAutoUpdate, disableAutoUpdate }
