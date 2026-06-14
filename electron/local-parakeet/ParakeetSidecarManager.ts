import * as fs from 'fs'
import * as path from 'path'
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'

const VERSAO_RUNTIME_PARAKEET = 'onnx-asr-0.11.0'

const CODIGO_SIDECAR_PYTHON = String.raw`
import base64
import io
import json
import os
import sys
import wave
from pathlib import Path

import numpy as np
import onnx_asr
from huggingface_hub import snapshot_download

ROOT_DIR = Path(os.environ["SELENE_PARAKEET_ROOT_DIR"]).resolve()
HF_HOME = ROOT_DIR / "hf-home"
MODEL_DIR = ROOT_DIR / "models"
HF_HOME.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("HF_HOME", str(HF_HOME))
os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(HF_HOME / "hub"))
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

MODELS = {
    "tdt-0.6b-v3-multilingual": {
        "repo_id": "s0me-0ne/parakeet-tdt-0.6b-v3-onnx",
        "architecture": "nemo-conformer-tdt",
        "language": "multi",
        "quantization": "int8",
        "required_files": [
            "config.json",
            "decoder_joint-model.int8.onnx",
            "encoder-model.int8.onnx",
            "nemo128.onnx",
            "vocab.txt",
        ],
    },
}

loaded_models = {}

def responder(request_id, sucesso, dados=None, erro=None):
    payload = {"tipo": "resposta", "requestId": request_id, "sucesso": sucesso}
    if dados is not None:
        payload["dados"] = dados
    if erro is not None:
        payload["erro"] = erro
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()

def emitir_evento(evento, dados):
    sys.stdout.write(json.dumps({"tipo": "evento", "evento": evento, "dados": dados}, ensure_ascii=False) + "\n")
    sys.stdout.flush()

def normalizar_idioma(idioma, idioma_padrao):
    idioma_normalizado = (idioma or "").strip().lower()
    if not idioma_normalizado:
        return idioma_padrao

    aliases = {
        "auto": "multi",
        "multi": "multi",
        "pt": "pt",
        "pt-br": "pt",
        "pt_br": "pt",
        "portugues": "pt",
        "português": "pt",
        "pt-pt": "pt",
        "pt_pt": "pt",
        "en": "en",
        "en-us": "en",
        "en_us": "en",
        "english": "en",
    }
    return aliases.get(idioma_normalizado, idioma)

def decodificar_wav_base64(wav_base64):
    bruto = base64.b64decode(wav_base64)
    with wave.open(io.BytesIO(bruto), "rb") as wav_file:
        canais = wav_file.getnchannels()
        largura = wav_file.getsampwidth()
        sample_rate = wav_file.getframerate()
        frames = wav_file.readframes(wav_file.getnframes())

    if largura != 2:
        raise RuntimeError(f"Largura de amostra não suportada: {largura * 8} bits")

    audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    if canais > 1:
        audio = audio.reshape(-1, canais).mean(axis=1)
    return audio, sample_rate

def caminho_modelo(model_name):
    return MODEL_DIR / model_name

def modelo_foi_baixado(model_name):
    config = MODELS[model_name]
    model_dir = caminho_modelo(model_name)
    if not model_dir.exists():
        return False

    arquivos_obrigatorios = config.get("required_files", [])
    return all((model_dir / arquivo).exists() for arquivo in arquivos_obrigatorios)

def garantir_modelo(model_name):
    config = MODELS[model_name]
    model_dir = caminho_modelo(model_name)
    model_dir.mkdir(parents=True, exist_ok=True)

    if not modelo_foi_baixado(model_name):
        emitir_evento("download-progress", {"modelName": model_name, "downloaded": 0, "total": 100, "percent": 0})
        snapshot_download(repo_id=config["repo_id"], local_dir=str(model_dir))
        emitir_evento("download-progress", {"modelName": model_name, "downloaded": 100, "total": 100, "percent": 100})
        emitir_evento("download-complete", {"modelName": model_name, "success": True, "path": str(model_dir)})

    if model_name not in loaded_models:
        loaded_models[model_name] = onnx_asr.load_model(
            config["architecture"],
            str(model_dir),
            quantization=config.get("quantization"),
        )

    return loaded_models[model_name]

def tratar_requisicao(requisicao):
    acao = requisicao.get("action")
    request_id = requisicao.get("requestId", f"sem-id-{os.getpid()}")

    if acao == "health":
        responder(request_id, True, {"ok": True})
        return

    if acao == "load-model":
        model_name = requisicao.get("modelName") or "tdt-0.6b-v3-multilingual"
        garantir_modelo(model_name)
        responder(request_id, True, {"modelName": model_name})
        return

    if acao == "transcribe-wav":
        model_name = requisicao.get("modelName") or "tdt-0.6b-v3-multilingual"
        wav_base64 = requisicao.get("wavBase64")
        if not wav_base64:
            raise RuntimeError("Nenhum áudio WAV foi enviado para transcrição.")

        recognizer = garantir_modelo(model_name)
        config = MODELS[model_name]
        language = normalizar_idioma(requisicao.get("language"), config["language"])
        waveform, sample_rate = decodificar_wav_base64(wav_base64)
        text = recognizer.recognize(waveform, sample_rate=sample_rate, language=language)
        responder(request_id, True, {"text": str(text or "").strip()})
        return

    raise RuntimeError(f"Ação não suportada: {acao}")

def main():
    for linha in sys.stdin:
        linha = linha.strip()
        if not linha:
            continue

        request_id = f"parse-{os.getpid()}"
        try:
            requisicao = json.loads(linha)
            request_id = requisicao.get("requestId", request_id)
            tratar_requisicao(requisicao)
        except Exception as erro:
            responder(request_id, False, erro=str(erro))

if __name__ == "__main__":
    main()
`

export interface EventoParakeetSidecar {
    tipo: 'download-progress' | 'download-complete' | 'download-error'
    dados: Record<string, unknown>
}

interface MensagemRespostaSidecar<T = unknown> {
    tipo: 'resposta'
    requestId: string
    sucesso: boolean
    dados?: T
    erro?: string
}

interface MensagemEventoSidecar {
    tipo: 'evento'
    evento: EventoParakeetSidecar['tipo']
    dados: Record<string, unknown>
}

type MensagemSidecar<T = unknown> = MensagemRespostaSidecar<T> | MensagemEventoSidecar

type RequisicaoPendente = {
    resolve: (valor: unknown) => void
    reject: (erro: Error) => void
}

type OuvinteEventoSidecar = (evento: EventoParakeetSidecar) => void

function obterMensagemErro(erro: unknown, fallback: string): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    return fallback
}

function obterExecutavelPythonVenv(diretorioVenv: string): string {
    const sufixo = process.platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python']
    return path.join(diretorioVenv, ...sufixo)
}

export class ParakeetSidecarManager {
    private processo: ChildProcessWithoutNullStreams | null = null
    private bufferSaida = ''
    private bufferErro = ''
    private modeloBaixandoAtual: string | null = null
    private ultimoPercentualDownloadEmitido = -1
    private requisicoesPendentes = new Map<string, RequisicaoPendente>()
    private ouvintes = new Set<OuvinteEventoSidecar>()
    private sequenciaRequisicoes = 0

    constructor(private readonly diretorioRaiz: string) {}

    onEvento(ouvinte: OuvinteEventoSidecar): () => void {
        this.ouvintes.add(ouvinte)
        return () => this.ouvintes.delete(ouvinte)
    }

    async verificarRuntimeDisponivel(): Promise<{ ok: boolean; pythonPath: string | null }> {
        try {
            fs.mkdirSync(this.diretorioRaiz, { recursive: true })
            const pythonPath = await this.resolverPythonSistema()
            return { ok: true, pythonPath }
        } catch {
            return { ok: false, pythonPath: null }
        }
    }

    async verificarSaude(): Promise<{ ok: boolean }> {
        return this.enviar<{ ok: boolean }>('health')
    }

    async prepararModelo(modelName: string): Promise<{ modelName: string }> {
        const modeloAnterior = this.modeloBaixandoAtual
        const percentualAnterior = this.ultimoPercentualDownloadEmitido

        this.modeloBaixandoAtual = modelName
        this.ultimoPercentualDownloadEmitido = -1

        try {
            return await this.enviar<{ modelName: string }>('load-model', { modelName })
        } finally {
            this.modeloBaixandoAtual = modeloAnterior
            this.ultimoPercentualDownloadEmitido = percentualAnterior
        }
    }

    async transcreverWav(
        modelName: string,
        wavBuffer: Buffer,
        language?: string
    ): Promise<{ text: string }> {
        return this.enviar<{ text: string }>('transcribe-wav', {
            modelName,
            language,
            wavBase64: wavBuffer.toString('base64')
        })
    }

    async encerrar(): Promise<void> {
        for (const pendencia of this.requisicoesPendentes.values()) {
            pendencia.reject(new Error('Sidecar Parakeet encerrado.'))
        }
        this.requisicoesPendentes.clear()

        if (!this.processo) {
            return
        }

        const processoEncerrando = this.processo
        this.processo = null
        this.bufferSaida = ''

        await new Promise<void>((resolve) => {
            processoEncerrando.once('exit', () => resolve())
            processoEncerrando.kill()
            setTimeout(() => resolve(), 1500)
        })
    }

    private getDiretorioVenv(): string {
        return path.join(this.diretorioRaiz, 'python-runtime')
    }

    private getCaminhoMarcadorRuntime(): string {
        return path.join(this.getDiretorioVenv(), '.selene-runtime-version')
    }

    private getCaminhoScriptSidecar(): string {
        return path.join(this.diretorioRaiz, 'parakeet-sidecar.py')
    }

    private async garantirProcesso(): Promise<ChildProcessWithoutNullStreams> {
        if (this.processo && !this.processo.killed) {
            return this.processo
        }

        fs.mkdirSync(this.diretorioRaiz, { recursive: true })

        const pythonSistema = await this.resolverPythonSistema()
        await this.garantirRuntimePython(pythonSistema)
        const pythonVenv = obterExecutavelPythonVenv(this.getDiretorioVenv())
        const caminhoScript = this.garantirScriptSidecar()

        const ambiente = {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1',
            SELENE_PARAKEET_ROOT_DIR: this.diretorioRaiz
        }

        const processo = spawn(pythonVenv, [caminhoScript], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: ambiente
        })

        processo.stdout.setEncoding('utf8')
        processo.stdout.on('data', (chunk: string) => this.processarSaida(chunk))
        processo.stderr.setEncoding('utf8')
        processo.stderr.on('data', (chunk: string) => {
            this.processarErro(chunk)
        })
        processo.once('exit', (codigo, sinal) => {
            const mensagem = `Sidecar Parakeet finalizado (${codigo ?? 'sem código'}${sinal ? `, ${sinal}` : ''})`
            for (const pendencia of this.requisicoesPendentes.values()) {
                pendencia.reject(new Error(mensagem))
            }
            this.requisicoesPendentes.clear()
            this.processo = null
            this.bufferSaida = ''
        })
        processo.once('error', (erro) => {
            console.error('[ParakeetSidecar] erro ao iniciar:', erro)
        })

        this.processo = processo
        await this.verificarSaude()
        return processo
    }

    private garantirScriptSidecar(): string {
        const caminhoScript = this.getCaminhoScriptSidecar()
        const precisaEscrever = !fs.existsSync(caminhoScript)
            || fs.readFileSync(caminhoScript, 'utf8') !== CODIGO_SIDECAR_PYTHON

        if (precisaEscrever) {
            fs.writeFileSync(caminhoScript, CODIGO_SIDECAR_PYTHON, 'utf8')
        }

        return caminhoScript
    }

    private async garantirRuntimePython(pythonSistema: string): Promise<void> {
        const diretorioVenv = this.getDiretorioVenv()
        const pythonVenv = obterExecutavelPythonVenv(diretorioVenv)
        const caminhoMarcador = this.getCaminhoMarcadorRuntime()

        const runtimeAtual = fs.existsSync(caminhoMarcador)
            ? fs.readFileSync(caminhoMarcador, 'utf8').trim()
            : ''

        if (fs.existsSync(pythonVenv) && runtimeAtual === VERSAO_RUNTIME_PARAKEET) {
            return
        }

        if (!fs.existsSync(pythonVenv)) {
            await this.executarComando(
                pythonSistema,
                ['-m', 'venv', diretorioVenv],
                'Falha ao criar ambiente Python do Parakeet.'
            )
        }

        await this.executarComando(
            pythonVenv,
            ['-m', 'pip', 'install', `onnx-asr[cpu,hub]==${VERSAO_RUNTIME_PARAKEET.replace('onnx-asr-', '')}`],
            'Falha ao instalar dependências Python do Parakeet.'
        )

        fs.writeFileSync(caminhoMarcador, VERSAO_RUNTIME_PARAKEET, 'utf8')
    }

    private async resolverPythonSistema(): Promise<string> {
        const candidatos = process.platform === 'win32'
            ? [
                { comando: 'py', args: ['-3', '--version'] },
                { comando: 'python', args: ['--version'] }
            ]
            : [
                { comando: 'python3', args: ['--version'] },
                { comando: 'python', args: ['--version'] }
            ]

        for (const candidato of candidatos) {
            try {
                await this.executarComando(
                    candidato.comando,
                    candidato.args,
                    `Executável Python indisponível: ${candidato.comando}`,
                    true
                )
                return candidato.comando
            } catch {
                continue
            }
        }

        throw new Error('Python 3 não foi encontrado no ambiente.')
    }

    private async executarComando(
        comando: string,
        args: string[],
        mensagemErro: string,
        silencioso = false
    ): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            const processo = spawn(comando, args, {
                cwd: this.diretorioRaiz,
                stdio: ['ignore', 'ignore', 'pipe']
            })

            let saidaErro = ''

            processo.stderr.setEncoding('utf8')
            processo.stderr.on('data', (chunk: string) => {
                saidaErro += chunk
            })

            processo.once('error', (erro) => {
                reject(new Error(obterMensagemErro(erro, mensagemErro)))
            })

            processo.once('exit', (codigo) => {
                if (codigo === 0) {
                    resolve()
                    return
                }

                const detalhes = saidaErro.trim()
                reject(new Error(
                    silencioso
                        ? mensagemErro
                        : `${mensagemErro}${detalhes ? ` ${detalhes}` : ''}`
                ))
            })
        })
    }

    private processarSaida(chunk: string): void {
        this.bufferSaida += chunk

        let indiceQuebra = this.bufferSaida.indexOf('\n')
        while (indiceQuebra >= 0) {
            const linha = this.bufferSaida.slice(0, indiceQuebra).trim()
            this.bufferSaida = this.bufferSaida.slice(indiceQuebra + 1)

            if (linha) {
                this.processarLinha(linha)
            }

            indiceQuebra = this.bufferSaida.indexOf('\n')
        }
    }

    private processarErro(chunk: string): void {
        this.bufferErro += chunk
        this.emitirProgressoDownloadAPartirDoErro(chunk)

        let indiceQuebra = this.encontrarIndiceSeparadorErro()
        while (indiceQuebra >= 0) {
            const linha = this.bufferErro.slice(0, indiceQuebra).trim()
            const tamanhoSeparador = this.bufferErro[indiceQuebra] === '\r' && this.bufferErro[indiceQuebra + 1] === '\n'
                ? 2
                : 1

            this.bufferErro = this.bufferErro.slice(indiceQuebra + tamanhoSeparador)

            if (linha) {
                console.error('[ParakeetSidecar] stderr:', linha)
            }

            indiceQuebra = this.encontrarIndiceSeparadorErro()
        }
    }

    private encontrarIndiceSeparadorErro(): number {
        const indiceNovaLinha = this.bufferErro.indexOf('\n')
        const indiceRetornoCarro = this.bufferErro.indexOf('\r')

        if (indiceNovaLinha === -1) {
            return indiceRetornoCarro
        }
        if (indiceRetornoCarro === -1) {
            return indiceNovaLinha
        }

        return Math.min(indiceNovaLinha, indiceRetornoCarro)
    }

    private emitirProgressoDownloadAPartirDoErro(texto: string): void {
        if (!this.modeloBaixandoAtual) {
            return
        }

        const correspondencias = Array.from(texto.matchAll(/Fetching\s+\d+\s+files:\s+(\d+)%/g))
        if (correspondencias.length === 0) {
            return
        }

        const percentual = Number(correspondencias.at(-1)?.[1] || 0)
        if (!Number.isFinite(percentual) || percentual <= this.ultimoPercentualDownloadEmitido) {
            return
        }

        this.ultimoPercentualDownloadEmitido = percentual
        const evento: EventoParakeetSidecar = {
            tipo: 'download-progress',
            dados: {
                modelName: this.modeloBaixandoAtual,
                downloaded: percentual,
                total: 100,
                percent: percentual,
                stage: 'downloading-model'
            }
        }

        for (const ouvinte of this.ouvintes) {
            ouvinte(evento)
        }
    }

    private processarLinha(linha: string): void {
        try {
            const mensagem = JSON.parse(linha) as MensagemSidecar
            if (mensagem.tipo === 'evento') {
                const evento: EventoParakeetSidecar = {
                    tipo: mensagem.evento,
                    dados: mensagem.dados
                }
                for (const ouvinte of this.ouvintes) {
                    ouvinte(evento)
                }
                return
            }

            const pendencia = this.requisicoesPendentes.get(mensagem.requestId)
            if (!pendencia) {
                return
            }

            this.requisicoesPendentes.delete(mensagem.requestId)
            if (mensagem.sucesso) {
                pendencia.resolve(mensagem.dados)
                return
            }

            pendencia.reject(new Error(mensagem.erro || 'Falha desconhecida no sidecar Parakeet'))
        } catch (erro) {
            console.error('[ParakeetSidecar] falha ao processar linha:', linha, erro)
        }
    }

    private async enviar<T = unknown>(acao: string, dados: Record<string, unknown> = {}): Promise<T> {
        const processo = await this.garantirProcesso()
        const requestId = `parakeet-${Date.now()}-${++this.sequenciaRequisicoes}`

        const payload = JSON.stringify({
            requestId,
            action: acao,
            ...dados
        })

        return new Promise<T>((resolve, reject) => {
            this.requisicoesPendentes.set(requestId, {
                resolve: (valor) => resolve(valor as T),
                reject
            })

            try {
                processo.stdin.write(`${payload}\n`)
            } catch (erro) {
                this.requisicoesPendentes.delete(requestId)
                reject(new Error(obterMensagemErro(erro, 'Falha ao enviar mensagem ao sidecar Parakeet')))
            }
        })
    }
}
