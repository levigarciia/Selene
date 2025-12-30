/**
 * Tool System Type Definitions
 * 
 * Comprehensive types for the extensible tool calling system.
 * Supports built-in tools, MCP tools, and future integrations.
 */

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export type ToolCategory = 'search' | 'memory' | 'file' | 'mcp' | 'system' | 'code'

export interface ToolParameter {
    name: string
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
    description: string
    required: boolean
    enum?: string[]
    default?: unknown
}

export interface ToolSource {
    type: 'builtin' | 'mcp'
    mcpServerId?: string  // If MCP, which server provides this tool
}

export interface ToolDefinition {
    id: string                      // Unique ID: "builtin:web_search" or "mcp:filesystem:read_file"
    name: string                    // Display name (localized)
    description: string             // For AI to understand when to use
    category: ToolCategory
    parameters: ToolParameter[]
    source: ToolSource
    enabled: boolean
    icon?: string                   // Lucide icon name (e.g., 'Globe', 'Brain', 'File')
}

// ============================================================================
// TOOL EXECUTION
// ============================================================================

export type ToolCallStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled'

export interface ToolCallContext {
    conversationId?: string
    messageId?: string
    userQuery?: string
}

export interface ToolCallInput {
    toolId: string
    arguments: Record<string, unknown>
    context?: ToolCallContext
}

export interface ToolCallResult {
    success: boolean
    data?: unknown
    error?: string
    metadata?: {
        durationMs: number
        tokensCost?: number
        rawResponse?: unknown
    }
}

export interface ToolCall {
    id: string
    input: ToolCallInput
    status: ToolCallStatus
    result?: ToolCallResult
    startedAt: number
    completedAt?: number
}

// ============================================================================
// AI TOOL CALLING
// ============================================================================

export interface AIToolCallRequest {
    tool: string                    // Tool ID or name
    arguments: Record<string, unknown>
    reasoning?: string              // Why the AI chose this tool
}

export interface AIToolCallDecision {
    shouldUseTool: boolean
    toolCalls: AIToolCallRequest[]
    directResponse?: string         // If no tool needed, AI's direct response
}

// ============================================================================
// TOOL RESULT DISPLAY
// ============================================================================

export type ToolResultType = 'text' | 'code' | 'json' | 'link' | 'image' | 'error' | 'list'

export interface ToolResultItem {
    type: ToolResultType
    title: string
    content: string
    url?: string
    language?: string               // For code blocks
    favicon?: string                // For links
    metadata?: Record<string, unknown>
}

export interface ToolCardData {
    toolId: string
    toolName: string
    toolIcon: string
    query: string                   // What was asked/searched
    status: ToolCallStatus
    resultCount: number
    results: ToolResultItem[]
    durationMs?: number
    error?: string
}

// ============================================================================
// TOOL HANDLER
// ============================================================================

export type ToolHandler = (
    args: Record<string, unknown>,
    context?: ToolCallContext
) => Promise<ToolCallResult>

// ============================================================================
// MCP TYPES
// ============================================================================

export interface MCPServerConfig {
    id: string
    name: string
    command: string                 // e.g., "npx", "python", "node"
    args: string[]                  // e.g., ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    env?: Record<string, string>
    enabled: boolean
    autoConnect?: boolean           // Connect on app start
}

export type MCPServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface MCPServerState {
    config: MCPServerConfig
    status: MCPServerStatus
    error?: string
    tools: ToolDefinition[]
    connectedAt?: number
}

// ============================================================================
// INVESTIGATE MODE
// ============================================================================

export type InvestigationPhaseType = 'decomposition' | 'collection' | 'validation' | 'synthesis'
export type InvestigationPhaseStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface InvestigationPhase {
    type: InvestigationPhaseType
    status: InvestigationPhaseStatus
    startedAt?: number
    completedAt?: number
    result?: unknown
    error?: string
}

export interface DecompositionResult {
    subQuestions: string[]
    reasoning: string
}

export interface CollectionResult {
    question: string
    toolCalls: ToolCall[]
    findings: string
    sources: string[]
}

export interface ValidationResult {
    consistencies: string[]
    contradictions: string[]
    uncertainties: string[]
    confidence: number              // 0-1
}

export interface SynthesisResult {
    answer: string
    sources: string[]
    keyPoints: string[]
}

export interface InvestigationTrace {
    id: string
    originalQuestion: string
    phases: InvestigationPhase[]
    decomposition?: DecompositionResult
    collection?: CollectionResult[]
    validation?: ValidationResult
    synthesis?: SynthesisResult
    toolCalls: ToolCall[]
    finalAnswer: string
    confidence: number
    totalDurationMs: number
    createdAt: number
}
