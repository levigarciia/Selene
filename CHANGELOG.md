# Changelog

Todas as mudanças relevantes da Selene são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
e o versionamento segue [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.0] - 2026-04-15

### Adicionado

- Nova shell do chat com barra superior nativa, rail lateral, drawer de navegação, hub de contexto, popovers de perfil/contexto, painel inicial e seletor rápido de projetos
- Overlay proativo com detecção contextual, resposta em streaming, expansão para o chat e controles de soneca ou dispensa
- Persistência normalizada de conversas com suporte a mensagens multimodais, resumos de imagens e hidratação segura
- Seções dedicadas de configuração (`SecaoPerfil`, `SecaoIA`, `SecaoPersonalizacao`, `SecaoAvancado`) com controle de updates no painel avançado
- Gestão expandida de MCP com marketplace, fontes Docker e registro, apps conectados e ponte de ferramentas integrada ao chat
- Histórico multimodal otimizado para modelos, com seleção contextual de imagens e resumos visuais nas mensagens anteriores

### Alterado

- `ChatWindow` foi reestruturado em torno de `useChatShell`, nova navegação e um fluxo mais limpo entre conversa, projeto, assistentes e configurações
- `InputArea`, `MessageList`, `ProjectView`, `Sidebar`, `ToolCard`, `CitationLink`, `ReasoningTrailModal`, `AssistentesModal` e `GrammarWindow` receberam a nova UI da release `0.4.0`
- `SettingsPanel`, `ModalConfiguracoes`, `VoiceSettings` e `MCPPanel` foram redesenhados para um layout mais modular, enxuto e consistente
- `useAppConfig`, `useVoiceInput`, `useCrossChatContext`, `useMemoryAutopilot` e `useWindowManagement` passaram a centralizar melhor persistência, atalhos, estados de janela e overlay proativo
- Pipeline de investigação, tool calling, busca web e citações foi ampliado com checkpoints de clarificação, melhor formatação de fontes e decisões mais robustas de ferramentas
- Transcrição local e em nuvem foi revisada com captura por chunks, streaming local, seleção de microfone, medidor de áudio e gerenciamento mais sólido de modelos Whisper
- Processo Electron e IPC foram atualizados para suportar controles de janela do chat, updater, MCP, busca web e o novo pipeline de Whisper local
- `docs/AGENTS.md` e `docs/PHILOSOPHY.md` foram atualizados para refletir a arquitetura e a direção visual atuais da Selene

### Corrigido

- Normalização de mensagens antigas, anexos de imagem e metadados visuais ao restaurar conversas
- Robustez do updater, sincronização de eventos do chat e contratos entre `main`, `preload` e renderer
- Fluxos de download, sessão e timeout do Whisper local para reduzir falhas de transcrição e travamentos

---

## [0.3.3] - 2026-03-30

### Corrigido

- Processamento de PDFs em projetos usando worker local do `pdf.js`, evitando falha de importação via `file://` no Electron

---

## [0.3.2] - 2026-03-27

### Adicionado

- Motor de decisão de ferramentas com estratégias `heuristic_only`, `ai_fallback`, `ai_first_fallback` e `ai_only`
- Planejamento de buscas web por IA com query principal, queries secundárias e deduplicação
- Suporte a raciocínio em streaming nos providers OpenAI, Gemini, OpenRouter e LM Studio
- Testes unitários para `WebSearchService` e `ToolCallingService`

### Alterado

- Contexto de projeto passou a separar instruções soberanas e bloco de arquivos relevantes
- Construção das mensagens do chat foi centralizada, incluindo melhor tratamento de prompt de projeto
- `ToolCard` passou a exibir o texto de status planejado pela IA
- Limites de upload foram ajustados por tipo de arquivo em vez de um único teto global

### Corrigido

- Fallbacks e validação de JSON para decisões de ferramentas malformadas
- Instruções de confiabilidade quando a busca web não retorna fontes suficientes

---

## [0.3.1] - 2026-03-21

### Adicionado

- Suporte a políticas de geração por perfil de latência
- Base para extração e persistência de raciocínio por mensagem
- Documentação da arquitetura de memória

### Alterado

- `PromptPipeline`, `InvestigateService` e `MemoryAutopilot` foram refinados para melhorar contexto, escopo e qualidade das respostas
- Indexação semântica e recuperação de contexto entre conversas receberam ajustes de estrutura e desempenho

---

## [0.3.0] - 2026-01-04

### Adicionado

- Suporte a MCP (Model Context Protocol) via Docker
- Sistema de tool calling com ferramentas nativas e integração MCP
- Investigate Mode com trilha de raciocínio
- Projetos com instruções específicas e customização visual
- `ToolCard` para exibição visual de resultados de ferramentas

### Alterado

- `ChatWindow` foi modularizado em hooks, componentes e utilitários reutilizáveis
- Chat passou a suportar melhor organização de conversas e contexto por projeto

---

## [0.2.2] - 2025-12-29

### Adicionado

- `WhisperDaemon` para gerenciar transcrição local com mais eficiência
- Modelos quantizados Q5 (`base`, `small`, `medium`) com foco em performance

### Alterado

- Janela de processamento, detecção de silêncio e preview contínuo da transcrição local foram otimizados
- Pipeline do Whisper local ficou entre 2x e 3x mais rápido, com menor latência inicial

---

## [0.2.1] - 2025-12-29

### Adicionado

- Busca web integrada ao `ChatWindow`
- Ponte de busca via processo principal para evitar bloqueios de CORS no renderer
- Renderização inline de fontes com pills e preview no hover

---

## [0.2.0] - 2025-12-29

### Adicionado

- `useAppConfig` como hook centralizado de configuração
- `SettingsPanel` unificado para modal e chat
- `VoiceSettings` com suporte a OpenAI Whisper, Gemini, Groq e Whisper local
- Sistema de assistentes personalizados integrado ao chat
- Build e empacotamento para Linux

### Alterado

- `ChatWindow` passou a usar `useAppConfig` em vez de múltiplos hooks isolados
- `ModalConfiguracoes` foi simplificado como wrapper do painel unificado
- Labels e organização das abas de configuração foram revisados

### Corrigido

- Posicionamento do painel de configurações no overlay
- Repasse de props de voz necessárias para a aba de transcrição
- Ajustes de imports e limpeza de lint

---

## [0.1.1] - 2025-12-15

### Adicionado

- Overlay de screenshot e fluxo inicial de captura de tela
- Reorganização dos componentes em grupos como `feedback`, `modals`, `toolbar` e `windows`
- `CONTRIBUTING.md` com detalhes técnicos para colaboradores

### Alterado

- `App.tsx`, `ChatWindow` e o processo principal foram reestruturados para preparar a evolução multi-janela
- `README.md` foi reorganizado para foco em usuários finais

---

## [0.1.0] - 2025-12-15

### Adicionado

- Primeira release pública da Selene
- Overlay transparente com interação click-through
- Suporte a múltiplos provedores de IA
- Assistente gramatical global com atalho
- Chat com histórico de conversas
- Perfil do usuário, memórias e assistentes personalizados
- Transcrição por voz com provedores em nuvem e suporte local inicial
