# Orientações para Claude (CLAUDE.md)

Este documento contém instruções específicas para o assistente **Claude** ao trabalhar com o repositório Selene. Leia este documento em conjunto com [AGENTS.md](./AGENTS.md) para contexto arquitetural completo.

---

## 🎯 Contexto do Projeto

**Selene** é um assistente de desktop em Electron que:
- Roda como overlay transparente sobre o Windows
- Oferece chat com múltiplos provedores de IA (OpenAI, Gemini, OpenRouter, LM Studio)
- Possui assistente gramatical global via atalho
- Implementa sistemas de memória automática e contexto entre conversas

### Stack Tecnológica Observada
- **Frontend**: React 19.2, TypeScript 5.9, Vite 7.x
- **Desktop**: Electron 39.x
- **Estilo**: TailwindCSS 4.x, Framer Motion
- **Build**: electron-builder, esbuild

---

## ✅ O que Claude PODE Fazer

1. **Modificar código existente** seguindo as convenções do projeto
2. **Criar novos componentes** em `src/components/` ou `src/windows/`
3. **Adicionar novos hooks** em `src/hooks/`
4. **Implementar novos provedores de IA** em `src/services/ai/providers/`
5. **Expandir sistemas de memória** em `src/services/memory/` e `src/services/crosschat/`
6. **Atualizar documentação** em `/docs/` e arquivos raiz
7. **Corrigir bugs** e melhorar performance
8. **Adicionar testes** em diretórios `__tests__/`

---

## ❌ O que Claude NÃO PODE Fazer

1. **Quebrar o click-through**: Nunca remova `pointer-events-none` do container raiz
2. **Substituir polling por event listeners**: A lógica de mouse polling é essencial para Windows
3. **Hardcodar chaves de API**: Sempre use `localStorage` para persistência
4. **Ignorar TypeScript**: Não use `any` sem justificativa clara
5. **Modificar arquivos gerados**: Não edite `dist/`, `dist-electron/`, `release/`, `node_modules/`
6. **Alterar configurações críticas** sem explicar: `package.json` build config, `electron-builder` settings
7. **Remover funcionalidades existentes** sem solicitação explícita do usuário

---

## 🧠 Como Claude Deve Raciocinar

### Antes de Propor Mudanças

1. **Entenda o contexto**: Leia os arquivos relevantes antes de modificar
2. **Verifique dependências**: Identifique quais componentes usam o código afetado
3. **Considere o overlay**: Qualquer mudança de UI pode afetar a transparência
4. **Pense em IPC**: Mudanças em `main.ts` ou `preload.ts` afetam a comunicação

### Ao Propor Commits

1. **Use Conventional Commits**: `feat:`, `fix:`, `refactor:`, `docs:`
2. **Seja específico**: Descreva O QUE mudou e POR QUE
3. **Agrupe logicamente**: Commits atômicos, uma responsabilidade por commit
4. **Teste mentalmente**: Considere se a mudança funcionará no overlay E nas janelas separadas

### Ao Escrever Código

```typescript
// ✅ BOM: Tipo específico
const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => { ... }

// ❌ RUIM: any genérico
const handleClick = (event: any) => { ... }

// ✅ BOM: Usar localStorage com fallback
const config = localStorage.getItem('config') || '{}'

// ❌ RUIM: Assumir que existe
const config = localStorage.getItem('config')!

// ✅ BOM: Respeitar pointer-events
<div className="pointer-events-none absolute inset-0">
  <button className="pointer-events-auto">Click me</button>
</div>

// ❌ RUIM: Remover pointer-events-none
<div className="absolute inset-0">
  <button>Click me</button>
</div>
```

---

## 📂 Arquivos Críticos (Cuidado Extra)

| Arquivo | Risco | Motivo |
|---------|-------|--------|
| `electron/main.ts` | 🔴 Alto | Controla janelas, atalhos, polling de mouse |
| `electron/preload.ts` | 🔴 Alto | Ponte IPC, quebra comunicação se errar |
| `src/App.tsx` | 🟠 Médio | Estado global do overlay |
| `src/components/ChatWindow.tsx` | 🟠 Médio | Componente grande, muitas dependências |
| `src/services/AIService.ts` | 🟠 Médio | Abstração central de IA |
| `package.json` (build config) | 🟠 Médio | Configuração do electron-builder |

---

## 🔍 Padrões Observados no Código

### Convenções de Nomes

- **Componentes**: PascalCase (`ChatWindow`, `FloatingModal`)
- **Hooks**: camelCase com prefixo `use` (`useAI`, `useMemoryAutopilot`)
- **Arquivos de tipo**: Sufixo `Types.ts` (`CrossChatTypes.ts`)
- **Providers**: Sufixo `Provider.ts` (`OpenAIProvider.ts`)
- **Strings de UI**: Português brasileiro
- **Variáveis/funções**: Inglês ou português de acordo com contexto

### Estrutura de Componentes

```typescript
// Imports organizados
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from 'lucide-react'

// Tipos locais
interface Props {
  // ...
}

// Componente
function MeuComponente({ prop1, prop2 }: Props) {
  // Estados
  const [state, setState] = useState()
  
  // Refs
  const ref = useRef()
  
  // Effects
  useEffect(() => { ... }, [])
  
  // Handlers
  const handleClick = () => { ... }
  
  // Render
  return (...)
}

export default MeuComponente
```

### Padrões de IPC

```typescript
// preload.ts - Expor API
contextBridge.exposeInMainWorld('electronAPI', {
  minhaFuncao: (arg: string) => ipcRenderer.send('meu-canal', arg),
  onMeuEvento: (callback: (data: any) => void) => {
    ipcRenderer.on('meu-evento', (_event, data) => callback(data))
  }
})

// main.ts - Handler
ipcMain.on('meu-canal', (event, arg) => {
  // Processar
  event.sender.send('meu-evento', resultado)
})
```

---

## 🧪 Validação de Mudanças

Antes de considerar uma mudança completa, Claude deve verificar mentalmente:

- [ ] O código compila sem erros de TypeScript?
- [ ] A funcionalidade de click-through continua funcionando?
- [ ] As janelas separadas (Chat, Grammar) ainda abrem?
- [ ] A persistência em localStorage está intacta?
- [ ] Não quebrei nenhuma dependência de IPC?
- [ ] O estilo está consistente com o tema dark/glassmorphism?

---

## 📚 Documentação Relacionada

- [AGENTS.md](./AGENTS.md) - Regras gerais para agentes de IA
- [MEMORY_ARCHITECTURE.md](./MEMORY_ARCHITECTURE.md) - Sistema de memória detalhado
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Guia de contribuição
- [README.md](../README.md) - Visão geral do projeto

---

*Este documento reflete o estado atual do repositório Selene. Atualize-o quando mudanças significativas forem feitas na arquitetura ou convenções.*
