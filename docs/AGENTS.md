# Orientação para Agentes de IA (AGENTS.md)

👋 Olá, Agente! Se você foi instruído a manter, refatorar ou adicionar funcionalidades à **Selene**, este documento é para você. Ele contém o contexto arquitetural crucial e "regras de ouro" para garantir que você não quebre a funcionalidade principal do aplicativo.

## 🏗️ Arquitetura do Projeto

A Selene é um aplicativo **Electron + React + TypeScript**. A característica mais crítica é o seu comportamento de **janela transparente** (overlay).

### Estrutura de Pastas Chave

```
electron/
├── main.ts           # Processo Principal - ciclo de vida, atalhos globais, polling de mouse
├── preload.ts        # Ponte - APIs seguras via window.electronAPI
├── updater.ts        # Módulo de auto-update
└── whisper.ts        # Serviço de transcrição local (whisper.cpp)

src/
├── App.tsx           # Raiz do Renderizador - estado global, eventos de polling
├── main.tsx          # Entry point React - roteamento de janelas
├── components/
│   ├── config/               # Componentes de configuração
│   │   ├── SettingsPanel.tsx # COMPONENTE UNIFICADO de configurações
│   │   ├── VoiceSettings.tsx # Configurações de transcrição
│   │   └── ModalConfiguracoes.tsx # Wrapper modal para SettingsPanel
│   ├── windows/
│   │   ├── chat/             # ChatWindow e assistentes
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── AssistantsPanel.tsx
│   │   │   └── AssistantEditor.tsx
│   │   └── grammar/
│   │       └── GrammarWindow.tsx
│   ├── modals/
│   │   └── FloatingModal.tsx
│   └── toolbar/
│       └── BottomToolbar.tsx
├── hooks/
│   ├── useAppConfig.ts       # HOOK CENTRALIZADO - todas as configurações
│   ├── useAI.ts              # Serviço de IA (agora integrado em useAppConfig)
│   ├── useVoiceInput.ts      # Entrada de voz e transcrição
│   ├── useAssistants.ts      # Gerenciamento de assistentes
│   ├── useCrossChatContext.ts # Contexto entre conversas
│   └── useMemoryAutopilot.ts  # Memória automática
├── services/
│   ├── AIService.ts          # Abstração de provedores de IA
│   ├── ai/providers/         # OpenAI, Gemini, OpenRouter, LMStudio
│   ├── transcription/        # Serviços de transcrição
│   ├── crosschat/            # Sistema de busca semântica
│   └── memory/               # Sistema de memória automática
└── utils/
    └── assistentesPadrao.ts  # Assistentes padrão e tipos
```

---

## ⚠️ Regras de Ouro (Critical Safety Rules)

### 1. Não Quebre o "Click-Through" (Transparência)

A janela do Electron ocupa a tela inteira, mas é transparente.

**Como funciona:**

1. O `electron/main.ts` faz polling da posição do mouse a 10Hz (`checarCursor`)
2. O `App.tsx` recebe as coordenadas via `window.electronAPI.onCheckHover`
3. Se o mouse estiver sobre um widget (`.pointer-events-auto`), ativamos a interação
4. Se estiver no vazio, desativamos (`setIgnoreMouseEvents(true, { forward: true })`)

**Regras:**

- ❌ Nunca remova a classe `pointer-events-none` do container raiz em `App.tsx` ou `index.css`
- ✅ Widgets interativos **DEVEM** ter `pointer-events-auto`
- ❌ Não reverta a lógica de **Polling** para `mousemove` event listeners (falham em janelas transparentes no Windows)
- ✅ Use `ref` com `getBoundingClientRect()` para verificar se o mouse está sobre um widget

### 2. Use o Hook Centralizado `useAppConfig`

**IMPORTANTE**: A partir da v0.2.0, todas as configurações são gerenciadas pelo hook `useAppConfig`.

```typescript
// ✅ BOM: Use useAppConfig
const {
  apiKey,
  setApiKey,
  profile,
  setProfile,
  memories,
  addMemory,
  voiceInput,
  // ...etc
} = useAppConfig();

// ❌ RUIM: Não use hooks individuais diretamente em componentes de UI
const { apiKey } = useAI(); // Isto está encapsulado em useAppConfig
```

### 3. SettingsPanel é o Único Componente de Configurações

O `SettingsPanel` em `src/components/config/SettingsPanel.tsx` é o **único** componente de UI para configurações. Ele pode ser usado de duas formas:

```typescript
// No Modal (App.tsx)
<SettingsPanel variant="modal" onClose={...} {...props} />

// Inline no ChatWindow
<SettingsPanel variant="inline" onClose={...} {...props} />
```

**Nunca** crie componentes de configuração duplicados.

### 4. Gerenciamento de Estado e IPC

- Evite "spam" de IPC. Só envie mensagens para o processo principal (`setIgnoreMouseEvents`) se o estado de interação **mudou** (diffing).
- O estado `debugInteractive` em `App.tsx` é usado para forçar a janela a ser clicável para fins de desenvolvimento (F9). Respeite essa flag.
- Janelas separadas (ChatWindow, GrammarWindow) usam parâmetros de URL (`?window=chat`, `?window=grammar`) para roteamento em `main.tsx`.

### 5. Persistência de Dados

- ❌ Não hardcode chaves de API
- ✅ Use `localStorage` para persistir configurações do usuário:
  - Chaves de API: `openaiKey`, `geminiKey`, `openRouterKey`
  - Preferências: `systemPrompt`, `assistentes`, `provedorAtivo`
  - Perfil: `userProfile`, `memories`, `autoMemories`
  - Flags: `crossChatEnabled`, `memoryAutopilotEnabled`
  - Voice: `voiceProvider`, `whisperModel`
- O hook `useAppConfig` centraliza toda a lógica de persistência.

### 6. Estilização (TailwindCSS)

- ✅ Use Tailwind para tudo
- ✅ Mantenha o tema "Dark Mode / Glassmorphism":
  - Background: `bg-neutral-900/90`, `bg-black/80`
  - Blur: `backdrop-blur-md`, `backdrop-blur-xl`
  - Bordas: `border-white/10`, `border-white/5`
  - Texto: `text-white`, `text-white/70`
- ✅ Use `framer-motion` para animações (AnimatePresence para entradas/saídas)
- ✅ Componentes arrastáveis usam `drag` do Framer Motion

### 7. Sistema de Memória

O projeto possui dois sistemas de memória independentes (veja `docs/MEMORY_ARCHITECTURE.md`):

**Cross-Chat Context:**

- Recupera trechos de conversas anteriores via busca semântica
- Arquivos: `services/crosschat/`
- NUNCA grava memória permanente, apenas indexa

**Memory Autopilot:**

- Extrai preferências automaticamente das conversas
- Arquivos: `services/memory/`
- Grava em `localStorage` com validação e deduplicação

Ambos são opcionais e controlados por toggles nas configurações.

---

## 🤖 Tarefas Comuns

### Adicionar um Novo Provedor de LLM

1. Crie o provider em `src/services/ai/providers/NovoProvider.ts` implementando `AIProvider`
2. Registre em `AIService.ts` no construtor e na detecção auto
3. Adicione campos de configuração no `SettingsPanel.tsx`
4. Atualize o hook `useAppConfig` para incluir novas chaves/modelos
5. Atualize o tipo `ProvedorID` em `services/ai/types.ts`

### Adicionar Nova Aba de Configurações

1. Adicione o ID da aba em `SettingsTab` no `SettingsPanel.tsx`
2. Adicione entrada no array `allTabs` com ícone e condição de visibilidade
3. Adicione a seção de conteúdo no JSX com `{activeTab === 'nova-aba' && (...)}`
4. Se necessário, adicione props ao `SettingsPanelProps`

### Registrar Novo Atalho Global

1. Defina a constante de atalho padrão em `electron/main.ts`
2. Crie a função de registro (ex: `registrarAtalhoX`)
3. Envie evento IPC para o renderer
4. Exponha em `preload.ts` via `contextBridge`
5. Adicione input configurável na aba "Atalhos" do `SettingsPanel`
6. Atualize `useAppConfig` com estado e persistência

### Criar Nova Janela

1. Crie o componente em `src/components/windows/nova/NovaWindow.tsx`
2. Adicione rota em `src/main.tsx` checando parâmetro de URL
3. Crie função `createNovaWindow()` em `electron/main.ts`
4. Exponha abertura via IPC em `preload.ts`

### Melhorar a Detecção de Mouse

A lógica está em:

- `electron/main.ts`: `checarCursor()` e `iniciarTracker()`
- `src/App.tsx`: `handleCheckHover()`

Se precisar otimizar, faça com **cuidado extremo** e teste a interatividade em:

- Overlay (widgets)
- ChatWindow (janela separada)
- GrammarWindow (janela separada)

---

## 🐛 Debugging

### "Não consigo clicar"

1. Pressione **F9** para ativar Debug Mode
2. Se overlay vermelho aparecer, o click-through está funcionando
3. Verifique se o widget tem `pointer-events-auto`
4. Verifique logs do console (`Ctrl+Shift+I`)

### "Janela não abre"

1. Verifique logs do processo principal (terminal onde rodou `npm run dev`)
2. Confirme que o preload está correto (`dist-electron/preload.cjs`)
3. Verifique erros de IPC no console do renderer

### "Configurações não persistem"

1. Verifique erros de `localStorage` no console
2. Confirme que `useAppConfig` está sendo usado corretamente
3. Limpe `localStorage` e teste novamente

### "Transcrição não funciona"

1. Verifique se a API key está configurada (para nuvem)
2. Para local, verifique se o modelo foi baixado
3. Verifique logs do console para erros de Whisper

---

## 📝 Convenções de Código

- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/)
  - `feat:` novas funcionalidades
  - `fix:` correções
  - `refactor:` refatoração
  - `docs:` documentação
- **TypeScript**: Evite `any`, use tipos específicos
- **Componentes**: Funções com hooks, não classes
- **Nomes**: Português para UI strings, inglês para código

---

_Bom trabalho, Agente. Mantenha o código limpo e o futuro transparente._
