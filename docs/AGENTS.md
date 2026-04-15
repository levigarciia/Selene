# Orientação para Agentes de IA

Este documento resume a arquitetura real da Selene para tarefas de manutenção, refatoração e adição de funcionalidades. Use-o como contexto operacional antes de alterar fluxos centrais. Sempre mantenha esse arquivo atualizado.

## Visão Geral

A Selene é um aplicativo `Electron + React + TypeScript` com três superfícies principais:

- Overlay transparente em tela cheia, controlado por `src/App.tsx`
- Janela dedicada de chat, aberta pelo processo principal
- Janela dedicada do assistente gramatical

O núcleo do produto continua sendo o comportamento de overlay com click-through. Quase toda regressão séria no app nasce de mudanças indevidas nesse fluxo ou da quebra do contrato entre `main.ts`, `preload.ts` e o renderer.

## Estrutura de Pastas Chave

```text
electron/
├── main.ts                     # Ciclo de vida, tray, atalhos globais e click-through
├── preload.ts                  # Ponte segura via window.electronAPI
├── updater.ts                  # Auto-update
├── web-search.ts               # Busca web via processo principal
├── mcp/                        # IPC e integração com servidores MCP
└── local-whisper/              # Streaming/transcrição local com Whisper

src/
├── App.tsx                     # Overlay raiz, hover polling, screenshot e overlay proativo
├── hooks/
│   ├── useAppConfig.ts         # Fonte central de configuração e persistência
│   ├── useOverlayProativo.ts   # Orquestra intervenções do overlay
│   ├── useCrossChatContext.ts  # Busca semântica entre conversas
│   └── useMemoryAutopilot.ts   # Extração automática de memória
├── components/
│   ├── config/
│   │   ├── SettingsPanel.tsx   # Superfície principal de configurações
│   │   ├── SecaoPerfil.tsx
│   │   ├── SecaoIA.tsx
│   │   ├── SecaoPersonalizacao.tsx
│   │   ├── SecaoAvancado.tsx
│   │   ├── VoiceSettings.tsx
│   │   ├── ModalConfiguracoes.tsx
│   │   └── MCPPanel.tsx        # Painel dedicado de MCP
│   ├── modals/
│   │   ├── ReasoningTrailModal.tsx
│   │   └── OverlayProativoModal.tsx
│   └── windows/
│       ├── chat/
│       │   ├── ChatWindow.tsx
│       │   ├── hooks/          # useChatUI, useChatShell, useSendMessage
│       │   ├── components/     # sidebar, input, cards, drawers, hubs
│       │   └── utils/
│       └── grammar/
│           └── GrammarWindow.tsx
├── services/
│   ├── AIService.ts
│   ├── ProjectContextService.ts
│   ├── conversasPersistidas.ts
│   ├── ai/providers/           # OpenAI, Gemini, OpenRouter, LM Studio
│   ├── tools/                  # Tool calling, executor, bridge MCP, built-ins
│   ├── investigate/            # Pesquisa profunda e trilha de raciocínio
│   ├── crosschat/              # Recuperação semântica por embeddings
│   ├── memory/                 # Memória persistente e autopilot
│   ├── overlay/                # Regras e heurísticas do overlay proativo
│   └── whisper/                # Camada de transcrição
└── types/
    ├── chat.ts
    ├── project.ts
    └── overlayProativo.ts
```

## Regras de Ouro

### 1. Não quebre o click-through

O overlay ocupa a tela inteira, mas deve permitir clique no resto do desktop.

Fluxo atual:

1. `electron/main.ts` monitora o cursor com `checarCursor()`
2. O renderer publica regiões clicáveis via IPC com `update-modal-regions`
3. O processo principal alterna entre `pass_through`, `interativo` e `debug`

Regras:

- Não troque polling por `mousemove`; isso falha no overlay transparente
- Não remova `pointer-events-none` do container raiz do overlay
- Elementos clicáveis no overlay devem continuar usando `pointer-events-auto`
- Mudanças em `setIgnoreMouseEvents` precisam preservar o diff de estado, sem spam de IPC
- O modo de seleção de área e o `debug mode` têm exceções próprias; não simplifique essa lógica sem testar

### 2. `useAppConfig` é a fonte central de configuração

`src/hooks/useAppConfig.ts` concentra:

- Chaves e provedor de IA
- Perfil de latência
- Prompt base
- Atalhos globais
- Estado de screenshots
- Configuração do overlay proativo
- Integração com perfil do usuário e voz

Regras:

- Não espalhe persistência nova diretamente em componentes
- Prefira adicionar novos estados persistidos em `useAppConfig`
- As chaves de `localStorage` atuais usam prefixo `selene_`
- Nunca hardcode credenciais ou caminhos sensíveis

### 3. Configurações têm duas superfícies distintas

- `SettingsPanel.tsx` é a superfície principal de configuração do produto
- `ModalConfiguracoes.tsx` é apenas um wrapper para uso no overlay
- `MCPPanel.tsx` é um painel dedicado e separado do fluxo geral de settings

Se adicionar uma nova configuração:

1. Defina o estado e a persistência em `useAppConfig`
2. Exponha a prop necessária no `SettingsPanel`
3. Encaixe a UI na seção correta (`SecaoPerfil`, `SecaoIA`, `SecaoPersonalizacao`, `SecaoAvancado` ou `VoiceSettings`)

### 4. O chat foi modularizado; preserve essa divisão

`ChatWindow.tsx` ainda é o orquestrador, mas a lógica está separada em blocos claros:

- `useChatUI`: estados visuais e overlays locais
- `useChatShell`: navegação, contexto ativo, drawers e hubs
- `useSendMessage`: pipeline de envio, streaming, tool calling e investigação
- `conversasPersistidas.ts`: hidratação, normalização e persistência de conversas

Regras:

- Evite reintroduzir lógica monolítica em `ChatWindow.tsx`
- Componentes novos do chat devem entrar em `components/` com export centralizado
- Se mexer no formato de mensagens, revise também a persistência e normalização

### 5. Tool calling, MCP e investigação são fluxos centrais

O stack atual está dividido assim:

- `src/services/tools/ToolCallingService.ts`: decisão de uso de ferramentas
- `src/services/tools/ToolExecutor.ts`: execução
- `src/services/tools/builtin/`: ferramentas nativas
- `src/services/tools/MCPToolBridge.ts`: sincronização de ferramentas MCP
- `electron/mcp/`: IPC e ciclo de vida dos servidores MCP
- `src/services/investigate/`: pesquisa profunda, checkpoints e evidências

Regras:

- Ferramentas novas precisam ser registradas e executáveis de ponta a ponta
- Se a ferramenta depender de IPC, atualize `main.ts`, `preload.ts` e os tipos do renderer
- O chat exibe trilha de raciocínio e checkpoints de clarificação; preserve esse contrato ao mexer em investigação
- Sinais de atualidade e buscas web já influenciam a decisão de ferramentas; não duplique heurísticas em componentes

### 6. Contexto de projeto e memória têm responsabilidades diferentes

Responsabilidades atuais:

- `ProjectContextService`: contexto de arquivos e instruções específicas por projeto
- `crosschat/`: recuperação semântica entre conversas
- `memory/`: extração e persistência de preferências

Regras:

- Não misture memória permanente com contexto transitório de projeto
- Instruções do projeto e contexto de arquivos não devem voltar a ser concatenados de forma monolítica
- Ao alterar o formato de projeto, revise também indexação, hydration e tool calling

### 7. Overlay proativo é parte da experiência principal

O overlay proativo usa:

- `src/hooks/useOverlayProativo.ts`
- `src/services/overlay/overlayProativo.ts`
- `src/components/modals/OverlayProativoModal.tsx`
- Configuração persistida via `useAppConfig` e UI em `SecaoAvancado`

Regras:

- Intervenções devem ser discretas e pausáveis
- O overlay proativo é suspenso em contextos como chat aberto, seleção de área e telas modais
- Não trate o overlay proativo como toast genérico; ele responde a heurísticas próprias

### 8. Siga a linguagem visual oficial

Antes de alterar frontend, consulte obrigatoriamente [PHILOSOPHY.md](./PHILOSOPHY.md).

Direção atual:

- Minimalismo escuro, técnico e silencioso
- Animações discretas
- Sem glassmorphism pesado, neon, gradientes chamativos ou visual de dashboard denso sem instrução explícita

## Tarefas Comuns

### Adicionar um novo provedor de IA

1. Implemente o provider em `src/services/ai/providers/`
2. Registre no `AIService.ts`
3. Exponha campos necessários em `SecaoIA.tsx`
4. Atualize `useAppConfig.ts` com persistência e defaults
5. Revise tipos compartilhados em `src/services/ai/types.ts`

### Adicionar uma nova ferramenta nativa

1. Crie a ferramenta em `src/services/tools/builtin/`
2. Registre no registry de ferramentas
3. Garanta execução no `ToolExecutor`
4. Ajuste tipos e payloads usados pelo chat
5. Se houver IPC, atualize `electron/main.ts`, `electron/preload.ts` e `src/electron.d.ts`

### Adicionar uma nova seção de configuração

1. Persistência e estado em `useAppConfig.ts`
2. Props e navegação em `SettingsPanel.tsx`
3. UI em um componente de seção coeso dentro de `src/components/config/`

### Criar uma nova janela Electron

1. Crie o componente em `src/components/windows/`
2. Adicione roteamento em `src/main.tsx`
3. Abra a janela a partir de `electron/main.ts`
4. Exponha a ponte necessária em `preload.ts`

## Debugging

### "Não consigo clicar no overlay"

1. Teste `F9` para entrar em modo debug
2. Confirme se a região interativa está sendo publicada via `update-modal-regions`
3. Verifique `pointer-events-auto` nos blocos interativos
4. Revise `checarCursor()` e o estado `pass_through/interativo/debug`

### "Configuração não persiste"

1. Verifique `useAppConfig.ts`
2. Confira a chave `selene_*` correspondente no `localStorage`
3. Procure gravação duplicada em componente de UI

### "Ferramenta ou MCP não responde"

1. Revise `ToolCallingService.ts` e `ToolExecutor.ts`
2. Confirme sincronização no `MCPToolBridge.ts`
3. Verifique IPC em `electron/mcp/` e APIs expostas no preload

### "Transcrição local falhou"

1. Verifique `electron/local-whisper/`
2. Confirme binário/modelo selecionado em `VoiceSettings`
3. Revise logs do processo principal e do renderer

## Convenções de Trabalho

- Prefira rodar scripts com `bun run ...`
- O histórico ainda tem scripts com `npm` e `npx` no `package.json`; não altere isso sem revisar build e release
- Use TypeScript com tipos explícitos; evite `any`
- Preserve nomes e responsabilidades dos módulos antes de mover arquivos
- Ao mexer em contratos entre Electron e renderer, atualize também `src/electron.d.ts`

_Se a mudança tocar overlay, chat, IPC e persistência ao mesmo tempo, trate como alteração de alto risco e valide o fluxo inteiro._
