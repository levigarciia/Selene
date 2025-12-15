# Selene - AI Assistant Overlay

<div align="center">
  <img src="public/icon.png" alt="Selene Logo" width="120" />
  <h1>Selene</h1>
  <p><strong>Desperte a Inteligência no seu Desktop</strong></p>
  
  [![License](https://img.shields.io/badge/license-Source%20Available-orange.svg)](LICENSE.md)
  [![React](https://img.shields.io/badge/react-19.2-blue)](https://react.dev)
  [![Electron](https://img.shields.io/badge/electron-39.x-blue)](https://www.electronjs.org/)
  [![TypeScript](https://img.shields.io/badge/typescript-5.9-blue)](https://www.typescriptlang.org/)
  [![Made in Brazil](https://img.shields.io/badge/Made%20in-Brazil-green?style=flat)](https://github.com/levigarciia/Selene)
</div>

---

**Selene** é uma assistente de desktop futurista e onipresente projetada para ser seu segundo cérebro. O código-fonte é público e desenvolvido no **Brasil** 🇧🇷.
Funciona como um overlay transparente e interativo que flutua sobre suas janelas, oferecendo inteligência artificial instantânea sem interromper seu fluxo de trabalho.

![Selene Overlay](public/normal.png)

## ✨ Funcionalidades Principais

### 🖱️ Overlay Transparente Inteligente

A interface flutua sobre o Windows. Widgets ficam interativos automaticamente quando você passa o mouse, enquanto o resto da tela permanece "clicável" (click-through).

### 🗣️ Comandos de Voz

Transcrição de áudio em tempo real usando:

- **Whisper** (OpenAI)
- **Gemini Flash** (Google)

### 🧠 Multi-Modelo

Suporte nativo para múltiplos provedores de IA:

- **OpenAI** (GPT-5.2, GPT-4o)
- **Google Gemini** (3 Pro, 2.5 Flash)
- **LM Studio** (Modelos locais via API compatível)
- **OpenRouter**

### ✍️ Assistente Gramatical Global

Selecione qualquer texto em qualquer aplicativo, pressione `Ctrl+Alt+X` e a Selene irá corrigir, resumir ou reescrever o texto instantaneamente em uma janela dedicada.

<img src="public/corretorgramatical.png" alt="Assistente Gramatical" />

### 🤖 Personas Personalizáveis

Crie "Agentes" com prompts de sistema específicos (ex: "Programador Senior", "Tradutor", "Revisor") e alterne entre eles rapidamente.

<img src="public/assistentes.png" alt="Assistentes" />

### 🧠 Sistema de Memória Inteligente

- **Memória Persistente**: Perfil do usuário e memórias manuais.
- **Cross-Chat Context**: Recuperação automática de contexto relevante de conversas anteriores via busca semântica.
- **Memory Autopilot**: Extração automática de preferências e contexto recorrente das conversas.

### 🎨 Design Premium

Interface moderna com:

- Glassmorphism
- Animações suaves (Framer Motion)
- Modo escuro nativo
- Scrollbars customizadas

### 🔄 Auto-Update

Atualizações automáticas silenciosas quando disponíveis.

---

## 📥 Download

Baixe a versão mais recente na [página de Releases](https://github.com/levigarciia/Selene/releases):

| Plataforma            | Download                     |
| --------------------- | ---------------------------- |
| Windows (64-bit)      | `Selene-x.x.x-win-x64.exe`   |
| macOS (Intel)         | `Selene-x.x.x-mac-x64.dmg`   |
| macOS (Apple Silicon) | `Selene-x.x.x-mac-arm64.dmg` |

> **Nota macOS**: A versão para Mac pode não estar notarizada. Clique com botão direito > "Abrir" na primeira execução, ou vá em Preferências do Sistema > Segurança e Privacidade para permitir.

---

## ⚙️ Configuração

Ao abrir a Selene, clique no ícone de **Engrenagem** na barra de ferramentas ou no ChatWindow para acessar as configurações:

- **Chaves de API**: Insira suas chaves da OpenAI, Google Gemini ou OpenRouter.
- **Provedor Ativo**: Selecione qual provedor de IA usar.
- **Modelos Locais**: Configure a URL base e o ID do modelo para conectar com LM Studio.
- **Atalhos**: Configure o atalho global para o Assistente Gramatical (Padrão: `Ctrl+Alt+X`) e Screenshot (Padrão: `Ctrl+Alt+S`).
- **Perfil do Usuário**: Nome, ocupação e informações "sobre mim" para personalização.
- **Memórias**: Adicione memórias manuais para contextualizar a IA.
- **Atualizações Automáticas**: Habilite ou desabilite no painel "Avançado".

> **Nota**: As configurações são salvas localmente no seu computador.

![Configurações](public/configs.png)

---

## 🔄 Atualizações Automáticas

Selene suporta atualizações automáticas silenciosas:

1. **Habilitar**: Vá em Configurações > Avançado > ative "Atualizações automáticas"
2. **Comportamento**:
   - O app verifica por atualizações no boot e periodicamente
   - Downloads são feitos em segundo plano
   - Quando pronto, você será notificado para reiniciar
3. **Desabilitar**: Desative o toggle para controle manual

---

## 🤝 Contribuição

Quer contribuir com o projeto? Seja bem-vindo! Consulte:

- [CONTRIBUTING.md](CONTRIBUTING.md) - Guia completo para desenvolvedores

---

## � Licença

> **⚠️ Importante**: Selene é **source-available** (código-fonte disponível), mas **não é open source** segundo a definição da [Open Source Initiative (OSI)](https://opensource.org/osd).

### ✅ O que você PODE fazer:

- **Uso pessoal**: Executar Selene em seu computador para uso próprio
- **Uso educacional**: Estudar o código, usar em projetos acadêmicos, ensinar
- **Pesquisa**: Usar para pesquisa não-comercial e publicações acadêmicas
- **Contribuir**: Enviar melhorias e correções para o projeto oficial

### ❌ O que você NÃO pode fazer:

- **Uso comercial**: Usar Selene em atividades que gerem receita ou lucro
- **SaaS**: Oferecer Selene como serviço hospedado para terceiros
- **Distribuição comercial**: Vender, licenciar ou sublicenciar Selene
- **Patentes**: Registrar patentes baseadas no código ou conceitos do Selene

Se você deseja usar Selene comercialmente, entre em contato: **contato@kitelabs.com**

> Versões comerciais com funcionalidades adicionais podem ser disponibilizadas no futuro.

Veja o arquivo [LICENSE.md](LICENSE.md) para os termos completos.

---

## 👨‍💻 Autor

**Levi Garcia**

- Email: contato@kitelabs.com
- GitHub: [@levigarciia](https://github.com/levigarciia)
