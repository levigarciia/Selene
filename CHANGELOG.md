# Changelog

All notable changes to Selene will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.1] - 2025-12-29

### Corrigido

- Busca web via IPC no processo main para evitar bloqueio de CORS no renderer
- Tags `[[fonte: ...]]` agora renderizam pills inline com preview no hover no ChatWindow

---

## [0.2.0] - 2025-12-29

### 🎉 Highlights

Esta versão traz uma grande refatoração da arquitetura de configurações, unificando toda a UI de settings em um único componente, além de suporte completo para Linux.

### ✨ Added (Novo)

#### Arquitetura de Configurações Unificada

- **`useAppConfig` hook centralizado**: Novo hook que consolida toda a lógica de configuração em um único lugar, eliminando duplicação de código
- **`SettingsPanel` unificado**: Componente de configurações reutilizável usado tanto no modal flutuante quanto no ChatWindow
- **Abas de configurações organizadas**: Perfil, Memórias, Chaves API, Modelos, Atalhos, Transcrição e Avançado

#### Transcrição de Voz

- **Configurações de Transcrição (VoiceSettings)**: Nova aba dedicada para configurar provedores de transcrição
- **Suporte a Whisper Local**: Transcrição offline usando whisper.cpp com seleção de modelos (tiny, base, small, medium, large)
- **Streaming Local**: Transcrição em tempo real com modelos locais
- **Múltiplos provedores**: OpenAI Whisper, Google Gemini, Groq, e Whisper local

#### Sistema de Assistentes no ChatWindow

- **Botão de Assistentes na Sidebar**: Acesso rápido ao painel de assistentes
- **AssistantsPanel integrado**: Gerenciamento completo de assistentes personalizados
- **AssistantEditor**: Criação e edição de assistentes com permissões e comportamentos

#### Suporte a Linux

- **Build para Linux**: AppImage e .deb packages via electron-builder
- **GitHub Actions**: Workflow atualizado com job dedicado para Linux

### 🔧 Changed (Alterado)

#### Refatoração de Código

- **ChatWindow refatorado**: Agora usa `useAppConfig` ao invés de múltiplos hooks individuais
- **ModalConfiguracoes simplificado**: Agora é um wrapper fino em torno do `SettingsPanel`
- **Imports otimizados**: Remoção de imports não utilizados e consolidação de dependências

#### UX/UI

- **Botão de Assistentes sem preenchimento**: Design mais limpo, preenchimento apenas no hover
- **Fechamento automático de painéis**: Configurações e Assistentes fecham ao clicar em conversas ou outros itens da sidebar
- **Labels de transcrição atualizados**: "Nuvem via API" e "Local" para maior clareza

### 🐛 Fixed (Corrigido)

- **Painel de Configurações não aparecia corretamente**: Corrigido posicionamento absoluto para overlay
- **Lint errors em imports**: Removidos imports não utilizados (lucide-react icons, tipos não usados)
- **voiceInput prop não passada**: Corrigido para habilitar aba de transcrição no ChatWindow

### 📁 Estrutura de Arquivos

```
src/
├── hooks/
│   └── useAppConfig.ts          # NOVO: Hook centralizado de configuração
├── components/
│   ├── config/
│   │   ├── SettingsPanel.tsx    # NOVO: Painel unificado de configurações
│   │   ├── VoiceSettings.tsx    # NOVO: Configurações de transcrição
│   │   └── ModalConfiguracoes.tsx # REFATORADO: Wrapper para SettingsPanel
│   └── windows/chat/
│       └── ChatWindow.tsx       # REFATORADO: Usa useAppConfig
└── ...
```

### 🔄 Migration Notes

- Se você tinha configurações customizadas, elas continuam no localStorage e serão carregadas automaticamente
- Assistentes criados anteriormente continuam funcionando normalmente
- Nenhuma ação manual necessária para migração

---

## [0.1.1] - 2025-12-XX

### Added

- Auto-update functionality with electron-updater
- GitHub Actions workflow for automated releases
- Settings panel with API key management
- Cross-chat context system (semantic search)
- Memory autopilot for automatic preference extraction

### Fixed

- Click-through transparency on Windows
- Grammar assistant window positioning
- Voice recording stability

---

## [0.1.0] - 2025-XX-XX

### Added

- Initial release
- Transparent overlay interface
- Multi-provider AI support (OpenAI, Gemini, OpenRouter, LM Studio)
- Global grammar assistant with hotkey
- ChatWindow with conversation history
- User profile and memory system
- Custom AI assistants (personas)
- Voice transcription (Whisper, Gemini)
- Dark mode with glassmorphism design
