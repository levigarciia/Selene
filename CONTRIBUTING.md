# Contribuindo à Selene

Obrigado por seu interesse em contribuir! Este documento define o processo para contribuir com código, relatar bugs e propor funcionalidades.

---

## Código de Conduta

Seja gentil e respeitoso. Este é um projeto focado em produtividade e aprendizado.

---

## 🚀 Configuração do Ambiente de Desenvolvimento

### Pré-requisitos

- Node.js (v18 ou superior)
- npm ou yarn

### Passos

1. **Clone o repositório:**

   ```bash
   git clone https://github.com/levigarciia/Selene.git
   cd Selene
   ```

2. **Instale as dependências:**

   ```bash
   npm install
   ```

3. **Inicie em modo de desenvolvimento:**

   ```bash
   npm run dev
   ```

   Isso abrirá a janela do Electron com Hot-Reload ativo. O servidor Vite roda em `http://localhost:5173`.

4. **Build para Produção:**

   ```bash
   npm run build
   ```

   O build será compilado em `dist` (React/Vite) e `dist-electron` (Electron main/preload).

5. **Criar Instalador Local:**
   ```bash
   npm run dist           # Detecta o sistema automaticamente
   npm run dist:win       # Apenas Windows
   npm run dist:mac       # Apenas macOS
   npm run dist:linux     # Apenas Linux
   ```
   O instalador será gerado na pasta `release/`.

---

## Como Contribuir

1. Faça um Fork do projeto.
2. Crie uma branch para sua feature (`git checkout -b feature/minha-feature`).
3. Faça suas alterações.
4. Commit suas mudanças (`git commit -m 'feat: adiciona suporte a modelo X'`).
5. Push para a branch (`git push origin feature/minha-feature`).
6. Abra um Pull Request.

---

## Padrões de Código

- **TypeScript**: Usamos TypeScript estrito. Não use `any` a menos que absolutamente necessário.
- **Estilo**: O projeto usa ESLint e Prettier. Certifique-se de que não há erros de lint antes de enviar.
- **Commits**: Siga o padrão [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat:` para novas funcionalidades.
  - `fix:` para correções de bugs.
  - `docs:` para documentação.
  - `refactor:` para refatoração de código.

---

## Reportando Bugs

Use a aba "Issues" do GitHub. Inclua:

- Versão do Windows/OS.
- Passos para reproduzir.
- Comportamento esperado vs real.
- Logs do console (Ctrl+Shift+I na janela do Electron) se possível.

---

## 🛠️ Tecnologias

| Tecnologia           | Uso                                          |
| -------------------- | -------------------------------------------- |
| **Electron**         | Janelas e integração com sistema operacional |
| **React + Vite**     | Interface de usuário rápida e reativa        |
| **TypeScript**       | Tipagem estática para robustez               |
| **TailwindCSS**      | Estilização utilitária e moderna             |
| **Framer Motion**    | Animações fluidas                            |
| **electron-builder** | Empacotamento e distribuição                 |
| **electron-updater** | Atualizações automáticas                     |

---

## 📁 Estrutura do Projeto

```
Selene/
├── electron/                  # Código do processo main do Electron
│   ├── main.ts               # Entry point - gerencia janelas, atalhos globais, mouse polling
│   ├── preload.ts            # Script de preload (contextBridge para API segura)
│   └── updater.ts            # Módulo de auto-update
├── src/                       # Código do React (renderer process)
│   ├── App.tsx               # Componente raiz do overlay
│   ├── main.tsx              # Entry point do React
│   ├── components/           # Componentes React organizados por categoria
│   │   ├── index.ts          # Re-exports centralizados
│   │   ├── windows/          # Janelas standalone do Electron
│   │   │   ├── chat/         # ChatWindow - janela principal de chat
│   │   │   │   ├── ChatWindow.tsx
│   │   │   │   └── index.ts
│   │   │   └── grammar/      # GrammarWindow - assistente gramatical
│   │   │       ├── GrammarWindow.tsx
│   │   │       └── index.ts
│   │   ├── modals/           # Modais overlay
│   │   │   ├── AssistentesModal.tsx  # Modal de gerenciamento de assistentes
│   │   │   ├── FloatingModal.tsx     # Modal de chat flutuante
│   │   │   ├── ModalConfiguracoes.tsx # Painel de configurações
│   │   │   └── index.ts
│   │   ├── toolbar/          # Barra de ferramentas
│   │   │   ├── BottomToolbar.tsx     # Barra de ferramentas flutuante
│   │   │   └── index.ts
│   │   └── feedback/         # Componentes de feedback visual
│   │       ├── Toast.tsx             # Notificações toast
│   │       ├── DiffVisual.tsx        # Visualização de diff de texto
│   │       └── index.ts
│   ├── hooks/                # Custom hooks
│   │   ├── useAI.ts          # Hook para serviço de IA
│   │   ├── useAudio.ts       # Hook para gravação de áudio
│   │   ├── useCrossChatContext.ts # Hook para contexto entre conversas
│   │   └── useMemoryAutopilot.ts  # Hook para memória automática
│   ├── services/             # Serviços e lógica de negócio
│   │   ├── AIService.ts      # Camada de abstração para provedores de IA
│   │   ├── ai/               # Implementações de provedores (OpenAI, Gemini, etc.)
│   │   ├── memory/           # Sistema de memória automática
│   │   ├── crosschat/        # Sistema de contexto entre conversas
│   │   └── PromptPipeline.ts # Composição de prompts
│   └── types/                # Definições de tipos TypeScript
├── public/                   # Assets estáticos
├── build-resources/          # Recursos para build (entitlements, etc.)
├── docs/                     # Documentação adicional
│   ├── AGENTS.md             # Guia para agentes de IA
│   ├── CLAUDE.md             # Guia específico para Claude
│   └── MEMORY_ARCHITECTURE.md # Arquitetura do sistema de memória
├── .github/workflows/        # GitHub Actions
│   └── release.yml           # Workflow de release automatizado
├── dist/                     # Build do Vite (gerado)
├── dist-electron/            # Build do Electron (gerado)
├── release/                  # Instaladores (gerado)
└── package.json              # Configuração e scripts
```

---

## 📦 Criando um Release

### Fluxo de Versionamento

O projeto segue [Semantic Versioning](https://semver.org/):

- **MAJOR**: Mudanças incompatíveis na API
- **MINOR**: Novas funcionalidades retrocompatíveis
- **PATCH**: Correções de bugs retrocompatíveis

### Passo a Passo para Release

1. **Atualize a versão no `package.json`:**

   ```bash
   npm version patch  # 0.1.0 -> 0.1.1
   npm version minor  # 0.1.1 -> 0.2.0
   npm version major  # 0.2.0 -> 1.0.0
   ```

2. **Commit das mudanças:**

   ```bash
   git add .
   git commit -m "chore: bump version to X.Y.Z"
   ```

3. **Crie e push a tag:**

   ```bash
   git tag -a v0.2.0 -m "Release v0.2.0: Nova funcionalidade XYZ"
   git push origin v0.2.0
   ```

4. **Aguarde o GitHub Actions:**

   - O workflow `release.yml` será disparado automaticamente
   - Builds para Windows e macOS serão criados
   - Um Release será publicado com todos os assets

5. **Verifique o Release:**
   - Acesse [Releases](https://github.com/levigarciia/Selene/releases)
   - Confirme que todos os arquivos estão presentes

---

## 🔐 Code Signing (Opcional)

Para builds assinados (remove avisos de segurança):

### macOS

1. Obtenha um certificado Apple Developer (requer conta paga)
2. Configure os secrets no GitHub:
   - `CSC_LINK`: Certificado .p12 em Base64
   - `CSC_KEY_PASSWORD`: Senha do certificado
   - `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`

### Windows

1. Obtenha um certificado de code signing (DigiCert, Sectigo)
2. Configure os secrets:
   - `WINDOWS_CSC_LINK`: Certificado .pfx em Base64
   - `WINDOWS_CSC_KEY_PASSWORD`: Senha do certificado

---

## 📚 Documentação para IA

Se você é um agente de IA trabalhando neste projeto, consulte também:

- [docs/AGENTS.md](docs/AGENTS.md) - **Leitura obrigatória** com contexto arquitetural
- [docs/CLAUDE.md](docs/CLAUDE.md) - Orientações específicas para o assistente Claude
