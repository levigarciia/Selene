/**
 * Whisper Service for Electron Main Process
 * 
 * Uses whisper.cpp binary directly (like Perssua)
 * Downloads models from HuggingFace and runs whisper-cli
 */

import { app, ipcMain } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as https from 'https'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type WhisperModelSize = 'tiny' | 'base' | 'turbo' | 'small' | 'medium' | 'large'

interface WhisperConfig {
    modelSize: WhisperModelSize
    language?: string
    task?: 'transcribe' | 'translate'
    binaryPath?: string
}

const CODIGO_DLL_NAO_ENCONTRADA = 3221225781
const CODIGO_ACESSO_INVALIDO = 3221225477

function formatarErroExecucaoWhisper(code: number | null, stderr: string): string {
    if (code === CODIGO_DLL_NAO_ENCONTRADA) {
        return 'Dependencias do Whisper nao encontradas. Instale o Microsoft Visual C++ Redistributable 2015-2022 (x64).'
    }
    if (code === CODIGO_ACESSO_INVALIDO) {
        return 'Falha ao executar o Whisper (possivel incompatibilidade de CPU/AVX).'
    }
    if (stderr?.trim()) {
        return stderr.trim()
    }
    return `Whisper saiu com codigo ${code ?? 'desconhecido'}.`
}

async function validarBinarioWhisper(caminhoBinario: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const proc = spawn(caminhoBinario, ['--help'], {
            stdio: ['ignore', 'pipe', 'pipe']
        })

        let stderr = ''
        proc.stderr?.on('data', (data) => {
            stderr += data.toString()
        })

        const timeout = setTimeout(() => {
            proc.kill('SIGTERM')
            reject(new Error('Timeout ao validar o binario do Whisper.'))
        }, 5000)

        proc.on('close', (code) => {
            clearTimeout(timeout)
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(formatarErroExecucaoWhisper(code, stderr)))
        })

        proc.on('error', (error) => {
            clearTimeout(timeout)
            reject(error)
        })
    })
}

// Model configurations from HuggingFace ggerganov/whisper.cpp
const MODELS: Record<WhisperModelSize, {
    name: string
    url: string
    fileName: string
    size: number
    sha256: string
    description: string
}> = {
    tiny: {
        name: 'tiny',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
        fileName: 'ggml-tiny.bin',
        size: 77704715,
        sha256: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
        description: 'Fastest, lowest accuracy (~75 MB)'
    },
    base: {
        name: 'base',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
        fileName: 'ggml-base.bin',
        size: 147951465,
        sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
        description: 'Good balance (~145 MB)'
    },
    turbo: {
        name: 'turbo',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin',
        fileName: 'ggml-large-v3-turbo-q5_0.bin',
        size: 574041195,
        sha256: '9c7b9c6bf60cf555f34fe7d81e8643764ff03d2f60b6fa550f5630be52eef830',
        description: 'High accuracy, faster inference (~550 MB)'
    },
    small: {
        name: 'small',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
        fileName: 'ggml-small.bin',
        size: 488242353,
        sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
        description: 'Higher accuracy (~480 MB)'
    },
    medium: {
        name: 'medium',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
        fileName: 'ggml-medium.bin',
        size: 1533774781,
        sha256: '6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208',
        description: 'High accuracy (~1.5 GB)'
    },
    large: {
        name: 'large',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
        fileName: 'ggml-large-v3.bin',
        size: 3095033483,
        sha256: '',
        description: 'Best accuracy (~3 GB)'
    }
}

// Audio constants
const SAMPLE_RATE = 16000
const BYTES_PER_SAMPLE = 2

let modelsPath: string | null = null
let tempDir: string | null = null
const activeDownloads = new Map<string, { abort: () => void }>()

function obterMensagemErro(erro: unknown): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    return 'Erro desconhecido'
}

/**
 * Initialize paths
 */
function initializePaths(): void {
    const userDataPath = app.getPath('userData')
    modelsPath = path.join(userDataPath, 'whisper-models')
    tempDir = path.join(os.tmpdir(), 'selene-whisper')

    if (!fs.existsSync(modelsPath)) {
        fs.mkdirSync(modelsPath, { recursive: true })
    }
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
    }

    console.log('[WhisperMain] Models path:', modelsPath)
}

/**
 * Get model file path
 */
function getModelPath(modelSize: WhisperModelSize): string {
    if (!modelsPath) initializePaths()
    return path.join(modelsPath!, MODELS[modelSize].fileName)
}

/**
 * Check if model is downloaded
 */
function isModelDownloaded(modelSize: WhisperModelSize): boolean {
    const modelPath = getModelPath(modelSize)
    if (!fs.existsSync(modelPath)) return false
    
    const stats = fs.statSync(modelPath)
    const expectedSize = MODELS[modelSize].size
    
    // Allow some tolerance for size (within 1%)
    return Math.abs(stats.size - expectedSize) < expectedSize * 0.01
}

/**
 * Get whisper binary path
 */
function getWhisperBinaryPath(customBinaryPath?: string): string | null {
    if (customBinaryPath) {
        if (fs.existsSync(customBinaryPath)) {
            console.log(`[WhisperMain] Using custom binary: ${customBinaryPath}`)
            return customBinaryPath
        }
        console.warn('[WhisperMain] Custom binary not found:', customBinaryPath)
    }

    const platform = process.platform
    const arch = process.arch
    const binaryNames = platform === 'win32' ? ['whisper.exe', 'main.exe'] : ['whisper-cli', 'main']

    // Possible locations
    const possiblePaths: string[] = []

    // In packaged app
    if (app.isPackaged) {
        for (const binaryName of binaryNames) {
            possiblePaths.push(
                path.join(process.resourcesPath, 'whisper-bin', binaryName),
                path.join(process.resourcesPath, 'whisper-bin', `${platform}-${arch}`, binaryName),
                path.join(process.resourcesPath, 'app.asar.unpacked', 'native', 'whisper', 'bin', `${platform}-${arch}`, binaryName)
            )
        }
    }

    // In development - check node_modules/whisper-node
    const raizWhisperNode = path.join(__dirname, '..', 'node_modules', 'whisper-node')
    const caminhoWhisperNode = path.join(raizWhisperNode, 'lib', 'whisper.cpp')
    for (const binaryName of binaryNames) {
        possiblePaths.push(
            path.join(raizWhisperNode, 'dist', binaryName),
            path.join(caminhoWhisperNode, 'main'),
            path.join(caminhoWhisperNode, 'main.exe'),
            path.join(caminhoWhisperNode, 'out', 'build', 'x64-Release', 'bin', binaryName),
            path.join(__dirname, '..', 'native', 'whisper', 'bin', `${platform}-${arch}`, binaryName)
        )
    }

    for (const binaryPath of possiblePaths) {
        if (fs.existsSync(binaryPath)) {
            console.log(`[WhisperMain] Found binary at: ${binaryPath}`)
            return binaryPath
        }
    }

    console.warn('[WhisperMain] Whisper binary not found')
    console.warn('[WhisperMain] Checked:', possiblePaths)
    return null
}

/**
 * Download model with progress
 */
async function downloadModel(
    modelSize: WhisperModelSize,
    onProgress?: (percent: number, downloaded: number, total: number) => void
): Promise<string> {
    const model = MODELS[modelSize]
    const modelPath = getModelPath(modelSize)
    const tempPath = `${modelPath}.downloading`
    const diretorioModelos = path.dirname(modelPath)

    if (!fs.existsSync(diretorioModelos)) {
        fs.mkdirSync(diretorioModelos, { recursive: true })
    }

    console.log(`[WhisperMain] Downloading ${modelSize} model...`)
    console.log(`[WhisperMain] URL: ${model.url}`)
    console.log(`[WhisperMain] Destination: ${modelPath}`)

    return new Promise((resolve, reject) => {
        let aborted = false
        const abortController = { abort: () => { aborted = true } }
        activeDownloads.set(modelSize, abortController)

        const fileStream = fs.createWriteStream(tempPath)
        let downloadedBytes = 0

        const makeRequest = (url: string) => {
            const request = https.get(url, {
                headers: { 'User-Agent': 'Selene-Desktop-App' }
            }, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectUrl = response.headers.location
                    if (redirectUrl) {
                        console.log('[WhisperMain] Following redirect...')
                        makeRequest(redirectUrl)
                        return
                    }
                }

                if (response.statusCode !== 200) {
                    activeDownloads.delete(modelSize)
                    fileStream.close()
                    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
                    reject(new Error(`Download failed: HTTP ${response.statusCode}`))
                    return
                }

                const totalBytes = parseInt(response.headers['content-length'] || '0', 10) || model.size

                response.on('data', (chunk: Buffer) => {
                    if (aborted) {
                        response.destroy()
                        return
                    }
                    downloadedBytes += chunk.length
                    const percent = Math.round((downloadedBytes / totalBytes) * 100)
                    if (onProgress) {
                        onProgress(percent, downloadedBytes, totalBytes)
                    }
                })

                response.pipe(fileStream)

                fileStream.on('finish', () => {
                    fileStream.close()
                    activeDownloads.delete(modelSize)

                    if (aborted) {
                        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
                        reject(new Error('Download cancelled'))
                        return
                    }

                    if (!fs.existsSync(tempPath)) {
                        reject(new Error('Arquivo temporario nao encontrado apos download'))
                        return
                    }

                    try {
                        fs.renameSync(tempPath, modelPath)
                        console.log(`[WhisperMain] ✅ Download complete: ${modelSize}`)
                        resolve(modelPath)
                    } catch (error) {
                        reject(error)
                    }
                })
            })

            request.on('error', (err) => {
                activeDownloads.delete(modelSize)
                fileStream.close()
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
                reject(err)
            })

            fileStream.on('error', (err) => {
                activeDownloads.delete(modelSize)
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
                reject(err)
            })
        }

        makeRequest(model.url)
    })
}

/**
 * Write PCM16 data to WAV file
 */
function writeWavFile(filePath: string, pcmData: Buffer): void {
    const dataLength = pcmData.length
    const headerLength = 44
    const header = Buffer.alloc(headerLength)

    // RIFF header
    header.write('RIFF', 0)
    header.writeUInt32LE(dataLength + 36, 4)
    header.write('WAVE', 8)

    // fmt chunk
    header.write('fmt ', 12)
    header.writeUInt32LE(16, 16) // chunk size
    header.writeUInt16LE(1, 20) // PCM format
    header.writeUInt16LE(1, 22) // channels (mono)
    header.writeUInt32LE(SAMPLE_RATE, 24) // sample rate
    header.writeUInt32LE(SAMPLE_RATE * BYTES_PER_SAMPLE, 28) // byte rate
    header.writeUInt16LE(BYTES_PER_SAMPLE, 32) // block align
    header.writeUInt16LE(16, 34) // bits per sample

    // data chunk
    header.write('data', 36)
    header.writeUInt32LE(dataLength, 40)

    const wavBuffer = Buffer.concat([header, pcmData])
    fs.writeFileSync(filePath, wavBuffer)
}

/**
 * Run whisper binary on audio file
 */
async function runWhisper(
    audioPath: string,
    modelPath: string,
    config: WhisperConfig
): Promise<string> {
    const binaryPath = getWhisperBinaryPath(config.binaryPath)
    
    if (!binaryPath) {
        throw new Error('Whisper binary not found. Please compile whisper.cpp or use cloud transcription.')
    }

    const args = [
        '-m', modelPath,
        '-f', audioPath,
        '--no-timestamps',
        '-nt', // no timestamps in output
        '--print-progress', 'false'
    ]

    // Add language if specified
    if (config.language && config.language !== 'auto') {
        args.push('-l', config.language)
    }

    console.log(`[WhisperMain] Running: ${binaryPath} ${args.join(' ')}`)

    return new Promise((resolve, reject) => {
        const startTime = Date.now()
        let stdout = ''
        let stderr = ''

        const proc: ChildProcess = spawn(binaryPath, args, {
            stdio: ['pipe', 'pipe', 'pipe']
        })

        proc.stdout?.on('data', (data) => {
            stdout += data.toString()
        })

        proc.stderr?.on('data', (data) => {
            stderr += data.toString()
        })

        const timeout = setTimeout(() => {
            proc.kill('SIGTERM')
            reject(new Error('Whisper timeout (60s)'))
        }, 60000)

        proc.on('close', (code) => {
            clearTimeout(timeout)
            const duration = Date.now() - startTime

            if (code === 0) {
                const text = stdout.trim()
                    .replace(/\[BLANK_AUDIO\]/gi, '')
                    .trim()
                console.log(`[WhisperMain] ✅ Transcription in ${duration}ms: "${text.substring(0, 50)}..."`)
                resolve(text)
            } else {
                const detalhe = formatarErroExecucaoWhisper(code, stderr)
                console.error('[WhisperMain] Whisper failed:', detalhe)
                reject(new Error(detalhe))
            }
        })

        proc.on('error', (error) => {
            clearTimeout(timeout)
            reject(error)
        })
    })
}

/**
 * Transcribe audio buffer
 */
async function transcribe(audioBuffer: Buffer, config: WhisperConfig): Promise<string> {
    if (!tempDir) initializePaths()
    
    const modelPath = getModelPath(config.modelSize)
    if (!fs.existsSync(modelPath)) {
        throw new Error(`Model ${config.modelSize} not downloaded`)
    }

    // Save audio to temp file
    const tempAudioPath = path.join(tempDir!, `audio-${Date.now()}.wav`)
    
    try {
        writeWavFile(tempAudioPath, audioBuffer)
        console.log('[WhisperMain] Audio saved:', tempAudioPath)

        const text = await runWhisper(tempAudioPath, modelPath, config)
        return text
    } finally {
        // Cleanup
        if (fs.existsSync(tempAudioPath)) {
            fs.unlinkSync(tempAudioPath)
        }
    }
}

/**
 * Setup IPC handlers
 */
export function setupWhisperIPC(): void {
    initializePaths()
    console.log('[WhisperMain] Setting up IPC handlers...')

    // Check if binary exists
    ipcMain.handle('whisper-binary-exists', (_event, customBinaryPath?: string) => {
        return !!getWhisperBinaryPath(customBinaryPath)
    })

    // Check if model exists
    ipcMain.handle('whisper-model-exists', (_event, modelSize: WhisperModelSize) => {
        return isModelDownloaded(modelSize)
    })

    // Get available models
    ipcMain.handle('whisper-get-models', () => {
        return Object.entries(MODELS).map(([modelName, info]) => ({
            ...info,
            name: modelName,
            downloaded: isModelDownloaded(modelName as WhisperModelSize)
        }))
    })

    // Download model
    ipcMain.handle('whisper-download-model', async (event, modelSize: WhisperModelSize) => {
        try {
            await downloadModel(modelSize, (percent, downloaded, total) => {
                if (!event.sender.isDestroyed()) {
                    try {
                        event.sender.send('whisper-download-progress', {
                            modelSize,
                            percent,
                            downloaded,
                            total
                        })
                    } catch {
                        // Sender destroyed
                    }
                }
            })
            return { success: true }
        } catch (error: unknown) {
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    // Cancel download
    ipcMain.handle('whisper-cancel-download', (_event, modelSize: WhisperModelSize) => {
        const controller = activeDownloads.get(modelSize)
        if (controller) {
            controller.abort()
            activeDownloads.delete(modelSize)
            return { success: true }
        }
        return { success: false, error: 'No active download' }
    })

    // Initialize (just verify model exists)
    ipcMain.handle('whisper-initialize', async (_event, config: WhisperConfig) => {
        try {
            const modelPath = getModelPath(config.modelSize)
            if (!fs.existsSync(modelPath)) {
                return { success: false, error: 'Model not found. Download it first.' }
            }

            const binaryPath = getWhisperBinaryPath(config.binaryPath)
            if (!binaryPath) {
                return { 
                    success: false, 
                    error: 'Whisper binary not found. Run "make" in node_modules/whisper-node/lib/whisper.cpp or use cloud transcription.' 
                }
            }

            await validarBinarioWhisper(binaryPath)

            console.log('[WhisperMain] ✅ Whisper ready')
            return { success: true }
        } catch (error: unknown) {
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    // Transcribe audio
    ipcMain.handle('whisper-transcribe', async (_event, audioBuffer: Buffer, config: WhisperConfig) => {
        try {
            const text = await transcribe(audioBuffer, config)
            return { success: true, text }
        } catch (error: unknown) {
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    // Delete model
    ipcMain.handle('whisper-delete-model', async (_event, modelSize: WhisperModelSize) => {
        try {
            const modelPath = getModelPath(modelSize)
            if (fs.existsSync(modelPath)) {
                fs.unlinkSync(modelPath)
                console.log(`[WhisperMain] Deleted model: ${modelSize}`)
                return { success: true }
            }
            return { success: false, error: 'Model not found' }
        } catch (error: unknown) {
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    console.log('[WhisperMain] IPC handlers ready!')
}
