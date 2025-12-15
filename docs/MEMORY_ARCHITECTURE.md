# Selene Memory Systems Architecture

Este documento descreve a arquitetura dos sistemas de memória da Selene, incluindo o funcionamento dos dois upgrades implementados:

1. **Cross-Chat Context** - Referência entre conversas
2. **Memory Autopilot** - Extração automática de memórias

## Visão Geral do Pipeline de Prompt

O prompt final enviado para a IA é composto na seguinte ordem:

```
┌─────────────────────────────────────────────────────────────┐
│  1. SYSTEM PROMPT (base)                                    │
│     - Prompt configurado pelo usuário                       │
├─────────────────────────────────────────────────────────────┤
│  2. MEMÓRIA PERSISTENTE (existente)                         │
│     - Perfil do usuário (nome, ocupação, sobre mim)         │
│     - Memórias manuais adicionadas                          │
├─────────────────────────────────────────────────────────────┤
│  3. MEMÓRIAS AUTOMÁTICAS (se habilitado)                    │
│     - Preferências extraídas automaticamente                │
│     - Contexto de projetos recorrentes                      │
│     - Stack tecnológica identificada                        │
├─────────────────────────────────────────────────────────────┤
│  4. HISTÓRICO DO CHAT ATUAL                                 │
│     - Mensagens da conversa atual                           │
│     - Gerenciado pelo ChatWindow                            │
├─────────────────────────────────────────────────────────────┤
│  5. CONTEXTO CROSS-CHAT (se habilitado)                     │
│     - 3-5 trechos relevantes de conversas anteriores        │
│     - Recuperados via busca semântica                       │
│     - Limitado a ~800 tokens                                │
└─────────────────────────────────────────────────────────────┘
```

## Sistema 1: Cross-Chat Context

### Propósito
Recupera automaticamente trechos relevantes de conversas anteriores para enriquecer o contexto, sem expor ao usuário quais trechos foram recuperados.

### Funcionamento

```
┌──────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│  Nova Mensagem   │───▶│  Gerar Embedding    │───▶│  Busca Semântica │
│  do Usuário      │    │  da Query           │    │  no Índice       │
└──────────────────┘    └─────────────────────┘    └────────┬─────────┘
                                                            │
                                                            ▼
┌──────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│  Injetar no      │◀───│  Formatar Snippets  │◀───│  Top-K Resultados│
│  Prompt          │    │  (max 800 tokens)   │    │  (similarity ≥   │
└──────────────────┘    └─────────────────────┘    │   0.72)          │
                                                   └──────────────────┘
```

### Componentes

| Arquivo | Responsabilidade |
|---------|-----------------|
| `EmbeddingService.ts` | Geração de embeddings (API ou local) |
| `EmbeddingIndex.ts` | Índice incremental persistido |
| `CrossChatContext.ts` | Serviço principal de recuperação |
| `CrossChatTypes.ts` | Tipos e validação |

### Configuração

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `MIN_MESSAGE_LENGTH` | 50 | Mínimo de caracteres para indexar |
| `MAX_CONTEXT_SNIPPETS` | 5 | Máximo de trechos injetados |
| `SIMILARITY_THRESHOLD` | 0.72 | Threshold de similaridade |
| `MAX_CONTEXT_TOKENS` | 800 | Limite de tokens |
| `MAX_INDEX_SIZE` | 1000 | Máximo de mensagens indexadas |

### Isolamento
- **NUNCA** grava memória permanente
- Apenas indexa para busca futura
- Toggle independente nas configurações
- Não expõe contexto recuperado na UI

---

## Sistema 2: Memory Autopilot

### Propósito
Detecta, extrai e salva automaticamente memórias duráveis e de alto sinal das conversas.

### Funcionamento

```
┌──────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│  Nova Mensagem   │───▶│  Heurísticas        │───▶│  Extração via    │
│  do Usuário      │    │  Pré-LLM            │    │  LLM ou Local    │
└──────────────────┘    └─────────────────────┘    └────────┬─────────┘
                                                            │
                                                            ▼
┌──────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│  Salvar em       │◀───│  Validação          │◀───│  Deduplicação    │
│  LocalStorage    │    │  (confiança ≥ 0.75) │    │  (jaccard ≥ 0.85)│
└──────────────────┘    └─────────────────────┘    └──────────────────┘
```

### Categorias Extraídas

| Categoria | Descrição | Exemplo |
|-----------|-----------|---------|
| `preference` | Preferências do usuário | "Prefere respostas objetivas" |
| `project_context` | Contexto de projetos | "Trabalhando em e-commerce" |
| `tech_stack` | Stack tecnológica | "Usa React + TypeScript" |
| `goal` | Objetivos recorrentes | "Quer aprender Rust" |
| `professional` | Informações profissionais | "Desenvolvedor sênior" |
| `communication_style` | Estilo de comunicação | "Prefere tom casual" |
| `expertise` | Áreas de expertise | "Especialista em backend" |

### Componentes

| Arquivo | Responsabilidade |
|---------|-----------------|
| `MemoryExtractor.ts` | Heurísticas e extração |
| `MemoryAutopilot.ts` | Serviço principal |
| `AutoMemoryTypes.ts` | Tipos e validação |

### Configuração

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `MIN_CONFIDENCE` | 0.75 | Confiança mínima |
| `DAILY_CREATION_LIMIT` | 10 | Limite diário |
| `DEDUP_SIMILARITY_THRESHOLD` | 0.85 | Threshold deduplicação |
| `MAX_AUTO_MEMORIES` | 100 | Máximo de memórias |

### Blacklist
Categorias sensíveis que NUNCA são extraídas:
- password, senha, credential
- financial, medical, legal
- token, api_key

---

## Integração no ChatWindow

### Fluxo de handleSend

```typescript
1. Usuário envia mensagem
2. composePrompt() é chamado:
   - Adiciona system prompt
   - Adiciona perfil do usuário
   - Adiciona memórias automáticas (se habilitado)
   - Adiciona contexto cross-chat (se habilitado)
3. AI processa e responde
4. processUserMessageForMemory() é chamado (async):
   - Indexa mensagem para cross-chat
   - Processa para memory autopilot
```

### Toggles nas Configurações

Ambos os sistemas podem ser desabilitados nas **Configurações > Avançado**:

- **Contexto entre Conversas**: Toggle azul, desativa indexação e recuperação
- **Memória Automática**: Toggle âmbar, desativa extração e salvamento

---

## Testes

### Testes de Deduplicação
```bash
npm test src/services/memory/__tests__/MemoryExtractor.test.ts
```

### Testes de Similaridade
```bash
npm test src/services/crosschat/__tests__/EmbeddingService.test.ts
```

---

## Métricas Internas

### Cross-Chat
- `totalSearches`: Buscas realizadas
- `totalContextsInjected`: Contextos injetados
- `totalMessagesIndexed`: Mensagens indexadas
- `tokensOptimized`: Economia estimada de tokens

### Memory Autopilot
- `totalGenerated`: Memórias candidatas
- `totalSaved`: Memórias salvas
- `totalDiscarded`: Memórias descartadas
- `totalDeduplicated`: Deduplicações

---

## Versões

| Componente | Versão |
|------------|--------|
| Config Schema | 1.0.0 |
| Embedding Index | 1.0.0 |
| Memory Extraction Prompt | 1.0.0 |

---

## Princípios de Design

1. **Isolamento Total**: Cross-chat NUNCA grava memória permanente
2. **Conservadorismo**: Heurísticas conservadoras, preferir falso negativo
3. **Previsibilidade**: Sem comportamentos "surpresa", thresholds explícitos
4. **Auditabilidade**: Prompts versionados, schemas validados
5. **Baixo Custo**: Limites rígidos de tokens, cache agressivo
