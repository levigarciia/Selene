/**
 * Tool Executor
 * 
 * Executes tool calls and manages results.
 * Handles async execution, cancellation, and error handling.
 */

import { v4 as uuidv4 } from 'uuid'
import { toolRegistry } from './ToolRegistry'
import type {
    ToolCall,
    ToolCallInput,
    ToolHandler,
    ToolCallStatus,
    ToolCallResult,
    ToolLifecycleEventType,
} from '../../types/tools'

type ExecutorListener = (call: ToolCall) => void
type PreToolUseResult = { blocked?: string; arguments?: Record<string, unknown> }
type PreToolUseHook = (input: ToolCallInput) => Promise<PreToolUseResult | void> | PreToolUseResult | void
type PostToolUseHook = (call: ToolCall) => Promise<ToolCallResult | void> | ToolCallResult | void

const LIMITE_TEXTO_RESULTADO_MODELO = 12000
const AVISO_TRUNCAMENTO = '\n\n[Saída truncada pela Selene para preservar o contexto do modelo.]'



class ToolExecutor {
    private handlers: Map<string, ToolHandler> = new Map()
    private activeCalls: Map<string, ToolCall> = new Map()
    private abortControllers: Map<string, AbortController> = new Map()
    private listeners: Set<ExecutorListener> = new Set()
    private preToolUseHooks: PreToolUseHook[] = []
    private postToolUseHooks: PostToolUseHook[] = []

    constructor() {
        this.registerPreToolUseHook((input) => this.validarArgumentosObrigatorios(input))
        this.registerPostToolUseHook((call) => this.truncarSaidaGrande(call))
    }

    // ========================================================================
    // HANDLER REGISTRATION
    // ========================================================================

    /**
     * Register a handler for a specific tool
     */
    registerHandler(toolId: string, handler: ToolHandler): void {
        this.handlers.set(toolId, handler)
        console.log(`[ToolExecutor] Registered handler for: ${toolId}`)
    }

    registerPreToolUseHook(hook: PreToolUseHook): () => void {
        this.preToolUseHooks.push(hook)
        return () => {
            this.preToolUseHooks = this.preToolUseHooks.filter((item) => item !== hook)
        }
    }

    registerPostToolUseHook(hook: PostToolUseHook): () => void {
        this.postToolUseHooks.push(hook)
        return () => {
            this.postToolUseHooks = this.postToolUseHooks.filter((item) => item !== hook)
        }
    }

    /**
     * Unregister a handler
     */
    unregisterHandler(toolId: string): boolean {
        const existed = this.handlers.delete(toolId)
        if (existed) {
            console.log(`[ToolExecutor] Unregistered handler for: ${toolId}`)
        }
        return existed
    }

    /**
     * Check if a handler exists for a tool
     */
    hasHandler(toolId: string): boolean {
        return this.handlers.has(toolId)
    }

    // ========================================================================
    // EXECUTION
    // ========================================================================

    /**
     * Execute a single tool call
     */
    async execute(input: ToolCallInput): Promise<ToolCall> {
        const callId = uuidv4()
        const call: ToolCall = {
            id: callId,
            input,
            status: 'pending',
            startedAt: Date.now(),
            lifecycleEvent: 'queued',
        }

        // Store as active
        this.activeCalls.set(callId, call)
        this.notifyListeners(call, 'queued')

        // Check for handler
        const handler = this.handlers.get(input.toolId)
        if (!handler) {
            console.error(`[ToolExecutor] No handler for tool: ${input.toolId}`)
            call.status = 'failed'
            call.completedAt = Date.now()
            call.lifecycleEvent = 'blocked'
            call.result = {
                success: false,
                error: `No handler registered for tool: ${input.toolId}`
            }
            this.notifyListeners(call, 'blocked')
            return call
        }

        // Create abort controller for cancellation
        const abortController = new AbortController()
        this.abortControllers.set(callId, abortController)

        // Execute
        try {
            const preToolUseResult = await this.runPreToolUseHooks(input)
            if (preToolUseResult.blocked) {
                call.status = 'failed'
                call.completedAt = Date.now()
                call.lifecycleEvent = 'blocked'
                call.result = {
                    success: false,
                    error: preToolUseResult.blocked,
                    metadata: {
                        durationMs: Date.now() - call.startedAt
                    }
                }
                this.notifyListeners(call, 'blocked')
                return call
            }

            if (preToolUseResult.arguments) {
                call.input = {
                    ...call.input,
                    arguments: preToolUseResult.arguments,
                }
            }

            call.status = 'executing'
            this.notifyListeners(call, 'started')

            console.log(`[ToolExecutor] Executing ${call.input.toolId}:`, call.input.arguments)
            const startTime = Date.now()

            if (!call.input.context) {
                call.input.context = {}
            }
            call.input.context.callId = callId

            const result = await handler(call.input.arguments, call.input.context)

            // Check if cancelled
            if (abortController.signal.aborted) {
                call.status = 'cancelled'
                call.completedAt = Date.now()
                call.result = {
                    success: false,
                    error: 'Tool call was cancelled'
                }
            } else {
                call.status = result.success ? 'completed' : 'failed'
                call.completedAt = Date.now()
                call.result = {
                    ...result,
                    metadata: {
                        ...result.metadata,
                        durationMs: Date.now() - startTime
                    }
                }
                call.result = await this.runPostToolUseHooks(call)
                call.lifecycleEvent = call.status === 'completed' ? 'completed' : 'failed'
            }

            console.log(`[ToolExecutor] ${call.input.toolId} ${call.status} in ${call.result?.metadata?.durationMs}ms`)

        } catch (error: unknown) {
            console.error(`[ToolExecutor] Error executing ${call.input.toolId}:`, error)
            call.status = 'failed'
            call.completedAt = Date.now()
            call.lifecycleEvent = 'failed'
            call.result = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during tool execution',
                metadata: {
                    durationMs: Date.now() - call.startedAt
                }
            }
        } finally {
            this.abortControllers.delete(callId)
            this.notifyListeners(call, call.lifecycleEvent)
        }

        return call
    }

    /**
     * Report progress status for an active tool call
     */
    reportProgress(callId: string, statusText: string): void {
        const call = this.activeCalls.get(callId)
        if (call) {
            call.progressStatus = statusText
            this.notifyListeners(call, 'started')
        }
    }

    /**
     * Execute multiple tool calls in parallel
     */
    async executeMultiple(inputs: ToolCallInput[]): Promise<ToolCall[]> {
        return Promise.all(inputs.map(input => this.execute(input)))
    }

    async executeMultipleSafe(inputs: ToolCallInput[]): Promise<ToolCall[]> {
        const resultados: ToolCall[] = []
        let loteParalelo: ToolCallInput[] = []

        const executarLote = async () => {
            if (loteParalelo.length === 0) return
            resultados.push(...await Promise.all(loteParalelo.map(input => this.execute(input))))
            loteParalelo = []
        }

        for (const input of inputs) {
            if (this.canRunInParallel(input.toolId)) {
                loteParalelo.push(input)
                continue
            }

            await executarLote()
            resultados.push(await this.execute(input))
        }

        await executarLote()
        return resultados
    }

    /**
     * Execute multiple tool calls sequentially
     */
    async executeSequential(inputs: ToolCallInput[]): Promise<ToolCall[]> {
        const results: ToolCall[] = []
        for (const input of inputs) {
            const result = await this.execute(input)
            results.push(result)
            // Stop on first failure if needed
            if (result.status === 'failed') {
                console.warn('[ToolExecutor] Stopping sequential execution due to failure')
                break
            }
        }
        return results
    }

    /**
     * Cancel an active tool call
     */
    cancel(callId: string): boolean {
        const controller = this.abortControllers.get(callId)
        if (controller) {
            controller.abort()
            console.log(`[ToolExecutor] Cancelled call: ${callId}`)
            return true
        }
        return false
    }

    /**
     * Cancel all active tool calls
     */
    cancelAll(): number {
        let count = 0
        for (const [callId, controller] of this.abortControllers) {
            controller.abort()
            count++
            console.log(`[ToolExecutor] Cancelled call: ${callId}`)
        }
        return count
    }

    // ========================================================================
    // STATE
    // ========================================================================

    /**
     * Get an active call by ID
     */
    getActiveCall(id: string): ToolCall | undefined {
        return this.activeCalls.get(id)
    }

    /**
     * Get all active calls
     */
    getAllActiveCalls(): ToolCall[] {
        return Array.from(this.activeCalls.values())
    }

    /**
     * Get calls with a specific status
     */
    getCallsByStatus(status: ToolCallStatus): ToolCall[] {
        return this.getAllActiveCalls().filter(c => c.status === status)
    }

    /**
     * Check if there are any executing calls
     */
    get isExecuting(): boolean {
        return this.getCallsByStatus('executing').length > 0
    }

    /**
     * Clear completed calls from memory
     */
    clearCompleted(): number {
        let count = 0
        for (const [id, call] of this.activeCalls) {
            if (call.status === 'completed' || call.status === 'failed' || call.status === 'cancelled') {
                this.activeCalls.delete(id)
                count++
            }
        }
        return count
    }

    // ========================================================================
    // REACTIVITY
    // ========================================================================

    /**
     * Subscribe to call updates
     */
    subscribe(callback: ExecutorListener): () => void {
        this.listeners.add(callback)
        return () => this.listeners.delete(callback)
    }

    private notifyListeners(call: ToolCall, evento?: ToolLifecycleEventType): void {
        if (evento) {
            call.lifecycleEvent = evento
        }
        this.listeners.forEach(cb => {
            try {
                cb(call)
            } catch (err) {
                console.error('[ToolExecutor] Listener error:', err)
            }
        })
    }

    canRunInParallel(toolId: string): boolean {
        const ferramenta = toolRegistry.getById(toolId)
        if (!ferramenta) return false
        if (ferramenta.riskLevel === 'destructive' || ferramenta.riskLevel === 'write') return false
        return ferramenta.readOnly === true && ferramenta.supportsParallel === true
    }

    private async runPreToolUseHooks(input: ToolCallInput): Promise<PreToolUseResult> {
        let argumentos = { ...input.arguments }
        for (const hook of this.preToolUseHooks) {
            const resultado = await hook({ ...input, arguments: argumentos })
            if (!resultado) continue
            if (resultado.blocked) return { blocked: resultado.blocked }
            if (resultado.arguments) {
                argumentos = resultado.arguments
            }
        }
        return { arguments: argumentos }
    }

    private async runPostToolUseHooks(call: ToolCall): Promise<ToolCallResult | undefined> {
        let resultado = call.result
        if (!resultado) return resultado

        for (const hook of this.postToolUseHooks) {
            const atualizado = await hook({ ...call, result: resultado })
            if (atualizado) {
                resultado = atualizado
            }
        }

        return resultado
    }

    private validarArgumentosObrigatorios(input: ToolCallInput): PreToolUseResult | void {
        const ferramenta = toolRegistry.getById(input.toolId)
        if (!ferramenta) return

        const faltando = ferramenta.parameters
            .filter((parametro) => parametro.required)
            .find((parametro) => {
                const valor = input.arguments[parametro.name]
                if (typeof valor === 'string') return !valor.trim()
                return valor === undefined || valor === null
            })

        if (!faltando) return

        return {
            blocked: `Parâmetro obrigatório ausente: ${faltando.name}`,
        }
    }

    private truncarSaidaGrande(call: ToolCall): ToolCallResult | void {
        if (!call.result?.success || !call.result.data) return

        const data = call.result.data
        if (typeof data === 'string') {
            return {
                ...call.result,
                data: this.truncarTexto(data),
            }
        }

        if (!data || typeof data !== 'object' || Array.isArray(data)) return

        const objeto = { ...(data as Record<string, unknown>) }
        for (const chave of ['formattedForAI', 'content', 'text']) {
            const valor = objeto[chave]
            if (typeof valor === 'string') {
                objeto[chave] = this.truncarTexto(valor)
            }
        }

        return {
            ...call.result,
            data: objeto,
        }
    }

    private truncarTexto(texto: string): string {
        if (texto.length <= LIMITE_TEXTO_RESULTADO_MODELO) return texto
        return texto.slice(0, LIMITE_TEXTO_RESULTADO_MODELO).trimEnd() + AVISO_TRUNCAMENTO
    }

    // ========================================================================
    // DEBUG
    // ========================================================================

    /**
     * Get executor stats
     */
    getStats(): {
        handlersCount: number
        activeCallsCount: number
        executingCount: number
    } {
        return {
            handlersCount: this.handlers.size,
            activeCallsCount: this.activeCalls.size,
            executingCount: this.getCallsByStatus('executing').length
        }
    }
}

// Singleton instance
export const toolExecutor = new ToolExecutor()
export default toolExecutor
