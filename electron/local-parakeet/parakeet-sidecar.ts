import * as path from 'path'
import { env, ModelRegistry, pipeline, type DataType } from '@huggingface/transformers'

type ParakeetModelName = 'tdt-0.6b-v3' | 'ctc-0.6b'

type RequisicaoSidecar = {
    requestId: string
    action: 'health' | 'load-model' | 'transcribe-wav'
    modelName?: ParakeetModelName
    language?: string
    wavBase64?: string
}

const MODELOS: Record<ParakeetModelName, { repoId: string; multilingual: boolean }> = {
    'tdt-0.6b-v3': {
        repoId: 'ae9is/parakeet-tdt-0.6b-v3-onnx',
        multilingual: true
    },
    'ctc-0.6b': {
        repoId: 'onnx-community/parakeet-ctc-0.6b-ONNX',
        multilingual: false
    }
}

type PipelineASR = Awaited<ReturnType<typeof pipeline>>

const cacheDir = process.env.SELENE_PARAKEET_CACHE_DIR || path.join(process.cwd(), '.cache', 'selene-parakeet')
env.cacheDir = cacheDir
env.allowRemoteModels = true
env.allowLocalModels = true

const pipelines = new Map<ParakeetModelName, Promise<PipelineASR>>()

function responder(requestId: string, sucesso: boolean, dados?: unknown, erro?: string): void {
    process.stdout.write(`${JSON.stringify({ tipo: 'resposta', requestId, sucesso, dados, erro })}\n`)
}

function emitirEvento(evento: string, dados: Record<string, unknown>): void {
    process.stdout.write(`${JSON.stringify({ tipo: 'evento', evento, dados })}\n`)
}

function decodificarWavBase64ParaFloat32(base64: string): Float32Array {
    const buffer = Buffer.from(base64, 'base64')
    if (buffer.length < 44) {
        throw new Error('WAV inválido: cabeçalho ausente.')
    }

    const riff = buffer.toString('ascii', 0, 4)
    const wave = buffer.toString('ascii', 8, 12)
    if (riff !== 'RIFF' || wave !== 'WAVE') {
        throw new Error('WAV inválido: assinatura RIFF/WAVE não encontrada.')
    }

    let offset = 12
    let dataOffset = -1
    let dataSize = 0

    while (offset + 8 <= buffer.length) {
        const chunkId = buffer.toString('ascii', offset, offset + 4)
        const chunkSize = buffer.readUInt32LE(offset + 4)

        if (chunkId === 'data') {
            dataOffset = offset + 8
            dataSize = chunkSize
            break
        }

        offset += 8 + chunkSize + (chunkSize % 2)
    }

    if (dataOffset < 0 || dataOffset + dataSize > buffer.length) {
        throw new Error('WAV inválido: chunk data não encontrado.')
    }

    const sampleCount = Math.floor(dataSize / 2)
    const audio = new Float32Array(sampleCount)
    for (let i = 0; i < sampleCount; i++) {
        const sample = buffer.readInt16LE(dataOffset + i * 2)
        audio[i] = sample / 32768
    }
    return audio
}

function resolverIdiomaParakeet(idioma?: string): string {
    const idiomaNormalizado = (idioma || '').trim().toLowerCase()

    if (!idiomaNormalizado) {
        return 'portuguese'
    }

    const aliases: Record<string, string> = {
        pt: 'portuguese',
        'pt-br': 'portuguese',
        'pt_br': 'portuguese',
        'pt-pt': 'portuguese',
        'pt_pt': 'portuguese',
        portugues: 'portuguese',
        'português': 'portuguese',
        portuguese: 'portuguese',
        en: 'english',
        'en-us': 'english',
        'en_us': 'english',
        english: 'english'
    }

    return aliases[idiomaNormalizado] || idiomaNormalizado
}

async function resolverDtype(modelName: ParakeetModelName): Promise<DataType> {
    const repoId = MODELOS[modelName].repoId
    const disponiveis = await ModelRegistry.get_available_dtypes(repoId, { cache_dir: cacheDir })
    const prioridade: DataType[] = ['q8', 'fp16', 'fp32', 'q4', 'int8']
    return prioridade.find((dtype) => disponiveis.includes(dtype)) || 'fp32'
}

async function obterPipeline(modelName: ParakeetModelName): Promise<PipelineASR> {
    const existente = pipelines.get(modelName)
    if (existente) {
        return existente
    }

    const repoId = MODELOS[modelName].repoId
    const dtype = await resolverDtype(modelName)

    const pipelinePromise = pipeline('automatic-speech-recognition', repoId, {
        dtype,
        progress_callback: (info: Record<string, unknown>) => {
            if (info.status === 'progress' || info.status === 'progress_total') {
                emitirEvento('download-progress', {
                    modelName,
                    percent: Number(info.progress || 0),
                    downloaded: Number(info.loaded || 0),
                    total: Number(info.total || 0),
                    file: String(info.file || '')
                })
            }
        }
    })

    pipelines.set(modelName, pipelinePromise)
    try {
        const instancia = await pipelinePromise
        emitirEvento('download-complete', { modelName, success: true, path: cacheDir })
        return instancia
    } catch (erro) {
        pipelines.delete(modelName)
        emitirEvento('download-error', {
            modelName,
            error: erro instanceof Error ? erro.message : 'Falha ao carregar modelo'
        })
        throw erro
    }
}

async function tratarRequisicao(requisicao: RequisicaoSidecar): Promise<void> {
    switch (requisicao.action) {
        case 'health':
            responder(requisicao.requestId, true, { ok: true })
            return

        case 'load-model': {
            const modelName = requisicao.modelName || 'tdt-0.6b-v3'
            await obterPipeline(modelName)
            responder(requisicao.requestId, true, { modelName })
            return
        }

        case 'transcribe-wav': {
            const modelName = requisicao.modelName || 'tdt-0.6b-v3'
            if (!requisicao.wavBase64) {
                throw new Error('Nenhum áudio WAV foi enviado para transcrição.')
            }

            const transcritor = await obterPipeline(modelName)
            const audio = decodificarWavBase64ParaFloat32(requisicao.wavBase64)
            const infoModelo = MODELOS[modelName]
            const executarTranscricao = transcritor as (
                audioInput: Float32Array,
                options?: Record<string, unknown>
            ) => Promise<{ text?: string }>
            const resultado = infoModelo.multilingual
                ? await executarTranscricao(audio, {
                    language: resolverIdiomaParakeet(requisicao.language),
                    task: 'transcribe'
                })
                : await executarTranscricao(audio)
            responder(requisicao.requestId, true, {
                text: typeof resultado === 'object' && resultado && 'text' in resultado ? String(resultado.text || '') : ''
            })
            return
        }
    }
}

let bufferEntrada = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk: string) => {
    bufferEntrada += chunk

    let indiceQuebra = bufferEntrada.indexOf('\n')
    while (indiceQuebra >= 0) {
        const linha = bufferEntrada.slice(0, indiceQuebra).trim()
        bufferEntrada = bufferEntrada.slice(indiceQuebra + 1)

        if (linha) {
            let requisicao: RequisicaoSidecar | null = null
            try {
                requisicao = JSON.parse(linha) as RequisicaoSidecar
            } catch (erro) {
                responder(`parse-${Date.now()}`, false, undefined, erro instanceof Error ? erro.message : 'JSON inválido')
            }

            if (requisicao) {
                void tratarRequisicao(requisicao).catch((erro) => {
                    responder(
                        requisicao.requestId,
                        false,
                        undefined,
                        erro instanceof Error ? erro.message : 'Falha interna no sidecar Parakeet'
                    )
                })
            }
        }

        indiceQuebra = bufferEntrada.indexOf('\n')
    }
})
