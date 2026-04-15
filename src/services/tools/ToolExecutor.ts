/**
 * Tool Executor
 * 
 * Executes tool calls and manages results.
 * Handles async execution, cancellation, and error handling.
 */

import { v4 as uuidv4 } from 'uuid'
import type {
    ToolCall,
    ToolCallInput,
    ToolHandler,
    ToolCallStatus
} from '../../types/tools'

type ExecutorListener = (call: ToolCall) => void

class ToolExecutor {
    private handlers: Map<string, ToolHandler> = new Map()
    private activeCalls: Map<string, ToolCall> = new Map()
    private abortControllers: Map<string, AbortController> = new Map()
    private listeners: Set<ExecutorListener> = new Set()

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
            startedAt: Date.now()
        }

        // Store as active
        this.activeCalls.set(callId, call)
        this.notifyListeners(call)

        // Check for handler
        const handler = this.handlers.get(input.toolId)
        if (!handler) {
            console.error(`[ToolExecutor] No handler for tool: ${input.toolId}`)
            call.status = 'failed'
            call.completedAt = Date.now()
            call.result = {
                success: false,
                error: `No handler registered for tool: ${input.toolId}`
            }
            this.notifyListeners(call)
            return call
        }

        // Create abort controller for cancellation
        const abortController = new AbortController()
        this.abortControllers.set(callId, abortController)

        // Execute
        try {
            call.status = 'executing'
            this.notifyListeners(call)

            console.log(`[ToolExecutor] Executing ${input.toolId}:`, input.arguments)
            const startTime = Date.now()

            const result = await handler(input.arguments, input.context)

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
            }

            console.log(`[ToolExecutor] ${input.toolId} ${call.status} in ${call.result?.metadata?.durationMs}ms`)

        } catch (error: unknown) {
            console.error(`[ToolExecutor] Error executing ${input.toolId}:`, error)
            call.status = 'failed'
            call.completedAt = Date.now()
            call.result = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during tool execution',
                metadata: {
                    durationMs: Date.now() - call.startedAt
                }
            }
        } finally {
            this.abortControllers.delete(callId)
            this.notifyListeners(call)
        }

        return call
    }

    /**
     * Execute multiple tool calls in parallel
     */
    async executeMultiple(inputs: ToolCallInput[]): Promise<ToolCall[]> {
        return Promise.all(inputs.map(input => this.execute(input)))
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

    private notifyListeners(call: ToolCall): void {
        this.listeners.forEach(cb => {
            try {
                cb(call)
            } catch (err) {
                console.error('[ToolExecutor] Listener error:', err)
            }
        })
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
