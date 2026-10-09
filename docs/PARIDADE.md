# Paridade funcional com o Odysseus

Referência inspecionada: `D:/Saas/odysseus-dev`, em 9 de outubro de 2026.
Versão declarada em `HARNESS_VERSION`: `0.20.19`. A pasta substitui a referência anterior `odysseus-main`.
A paridade inclui somente funcionalidades com implementação identificada nessa cópia local.
Os caminhos citados abaixo são relativos à raiz do Odysseus.

A presença no código comprova o escopo da referência, mas não comprova que todos os seus fluxos funcionam.
Uma funcionalidade só estará concluída na Selene depois de implementada e validada por um fluxo real.
O `ROADMAP.md` não é evidência de implementação. Recursos de Codex, Claude Code ou T3 Code também
não entram na paridade sem uma implementação correspondente no Odysseus.

O catálogo de rotas está em [REFERENCIA_ODYSSEUS.json](REFERENCIA_ODYSSEUS.json):
44 módulos e 483 operações declaradas em `routes`. Ele auxilia a conferência das operações de cada área e foi extraído
por `scripts/inventariarReferencia.ts`, incluindo subpastas e SHA 256 de cada arquivo, sem ler dados pessoais.
São declarações estáticas: prefixos, fábricas de roteadores e o módulo Companion precisam ser considerados
separadamente. Essa contagem não representa o total de endpoints em execução.

## Estado da Selene

O primeiro marco implementado cobre parte de conversas, modelos locais e ferramentas do agente:

* Distribuição Windows por instalador NSIS e releases automáticas em envios para `main`.
  A instalação verifica e baixa atualizações, mostra estado em Geral e aplica a atualização ao encerrar.
  O botão da sidebar mostra progresso, versão instalada e notas por release em painel aberto por mouse ou teclado.
  Após baixar a release, um novo clique permite reiniciar e atualizar, salvando os dados antes da instalação.
  As notas da distribuição são geradas a partir dos commits posteriores à release publicada.
  Decisão própria da Selene, solicitada pelo usuário, sem ampliar a paridade com o Odysseus.

* Importação de GGUF, instalação de motor CPU, Vulkan ou ROCm, carga e descarga de modelo.
* Catálogo inicial de GGUF, busca, filtros por família, favoritos e downloads com progresso e cancelamento.
* Entrada de conversa com controles compactos, logos das famílias e favoritos no início do seletor de modelos.
* Nível de raciocínio por conversa nos modelos compatíveis e seleção de permissões em menu na entrada.
* Conversas locais persistentes, histórico, busca, renomeação, exclusão e exportação.
* Streaming de texto e raciocínio separado em seção recolhível, Markdown, cancelamento e indicação de erros.
  O brilho das ações acompanha somente a mensagem da execução atual. A tarefa encerra ações ainda pendentes.
  Os níveis do Qwen controlam orçamentos de 25%, 50% e 75% dos tokens de geração.
* Listagem, leitura, escrita, edição de arquivos e execução de terminal.
* Ciclo de ferramentas do agente e histórico de ações.
* Configurações em tela própria, separadas em Geral, Modelos e Motor, com catálogo integrado.
* Sidebar recolhível e exportação ou exclusão pelo menu de contexto da conversa.
* Históricos Chat e Code separados, com seletor na sidebar e rascunhos independentes por modo.
  No Code, conversas atuais ficam no topo, tarefas em execução em Trabalhando e conversas encerradas em Concluídas.
  Aprovação pendente volta ao topo. Encerrar e retomar pelo menu preserva o histórico e sobrevive ao reinício.
  O projeto é informação da conversa, sem agrupar a lista por pasta. O topo tem um céu estrelado discreto.
  Referências locais: `apps/web/src/components/Sidebar.tsx`, `packages/client-runtime/src/state/threadInbox.ts`
  e `apps/web/src/components/SidebarStageBackdrop.tsx` em `D:/Saas/t3code-main/t3code-main`.
  Estes são requisitos próprios da Selene, sem ampliar a paridade com o Odysseus.
* Salvar mantém o modelo carregado. Parâmetros do motor ficam pendentes até recarregar ou enviar outra mensagem.
* Anexação de imagens em chat e code por seleção, colagem e arraste, com prévia, ampliação e remoção.
  Cópias locais persistentes, envio multimodal e exportação com imagens incorporadas. O motor confirma suporte
  visual pelo modelo carregado; o projetor GGUF correspondente pode ser importado na área Modelos.
  Decisão própria da Selene: Qwen3.5 2B, 4B e 9B reconhecidos no catálogo recebem o projetor automaticamente
  durante a carga, com revisão fixa, verificação de SHA 256, progresso e cancelamento.
  Fontes da paridade: `routes/upload_routes.py` e o tratamento multimodal em `src/llm_core.py`.
* Compactação automática por resumo com o modelo local, antes de envios e entre rodadas de ferramentas.
  O histórico original permanece disponível; resumo e posição no histórico são persistidos para os próximos envios.
  O pedido atual, as instruções vigentes e os pares completos de ferramentas são preservados no contexto ativo.
  Fonte da paridade: `src/context_compactor.py`, chamado pelo fluxo em `src/agent_loop.py`.

As áreas do catálogo abaixo continuam pendentes, exceto pelos recursos desse primeiro marco.
Essa cobertura parcial não representa paridade concluída em nenhuma área.

O aplicativo desktop em TypeScript, Vite e Tailwind CSS, os modos chat e code, o carregamento gerenciado
de GGUF, o projeto por conversa e as permissões de execução são requisitos próprios já definidos pelo usuário.
O uso de Electron, as instruções AGENTS.md e a apresentação do plano de trabalho fazem parte da implementação
atual da Selene. Esses itens não acrescentam novas metas à paridade com o Odysseus.

## Catálogo confirmado na referência

### Conversas

* Conversas: streaming, cancelamento, recuperação de stream por sessão, edição de mensagens, regeneração,
  variantes de resposta, ramificações, grupos, sessões privadas, busca, importação, exportação e presets.
  Fontes: `routes/chat_routes.py`, `routes/session_routes.py`, `routes/history/history_routes.py`,
  `routes/preset_routes.py`, `static/js/chat.js`, `static/js/sessions.js` e `static/js/group.js`.

### Modelos e agentes

* Provedores: configuração de endpoints, descoberta, teste e seleção de modelos locais e APIs externas.
  A referência integra llama.cpp, Ollama, vLLM e APIs como OpenAI, OpenRouter e Anthropic.
  Fontes: `routes/model_routes.py`, `src/model_discovery.py`, `src/llm_core.py` e `src/endpoint_resolver.py`.
* Assinaturas: conexão GitHub Copilot por autorização de dispositivo; várias contas ChatGPT Subscription,
  rótulos, descoberta de modelos, reconexão, remoção e acompanhamento de uso por conta.
  Fontes: `routes/copilot_routes.py`, `routes/chatgpt_subscription_routes.py`, `routes/device_flow.py`,
  `src/copilot.py` e `src/chatgpt_subscription.py`.
* Cookbook: detecção de hardware, avaliação de compatibilidade, catálogo, download, gerenciamento de modelos,
  dependências, monitoramento de GPU e execução de servidores locais ou remotos por SSH.
  Os motores presentes incluem llama.cpp, vLLM, Ollama e SGLang.
  Fontes: `routes/cookbook_routes.py`, `routes/hwfit_routes.py` e `services/hwfit/models.py`.
* Ferramentas do agente: arquivos, shell, Python, busca e leitura web, memória, skills e operações internas
  sobre os recursos do aplicativo. Compactação de contexto por resumo.
  Fontes: `src/agent_loop.py`, `src/agent_tools/__init__.py`, `src/tool_execution.py`, `src/tool_implementations.py`,
  `src/tool_schemas.py` e `src/context_compactor.py`.
* Projeto e navegação de código: escolha, validação e pasta padrão de trabalho; busca de arquivos por padrão,
  pesquisa de conteúdo com números de linha e substituições com prévia de diferenças.
  Fontes: `routes/workspace_routes.py`, `static/js/workspace.js`, `src/workspace_paths.py`
  e `src/agent_tools/filesystem_tools.py`.
* Planejamento: investigação somente de leitura, proposta de plano, aprovação e checklist usado durante
  a execução. Lista de itens com prioridade e estado por sessão.
  Fontes: `routes/chat_routes.py`, `src/agent_loop.py`, `src/tool_security.py`,
  `src/agent_tools/coding_tools.py` e `static/js/chat.js`.
* Aprovações: ação específica, tarefa ou sessão; proposta vinculada à ferramenta, argumentos, projeto,
  recurso e versão. As permissões atuais continuam sendo verificadas depois da aprovação.
  Fontes: `src/tool_approvals.py`, `src/tool_approval_scopes.py`, `src/tool_policy.py`,
  `src/agent_runtime/authority.py`, `routes/chat_routes.py` e `static/js/chat.js`.
* Execução auditável: histórico de ações e efeitos, rastreamento de artefatos, confirmação de resultados
  e distinção entre conclusão verificada, não verificada e espera por interação.
  Fontes: `src/agent_evidence.py`, `src/agent_trace.py`, `src/agent_runtime/journal.py`,
  `src/agent_runtime/effect_log.py` e `src/agent_runtime/completion.py`.
* Verificador independente opcional: outra chamada do modelo, com contexto separado, confere a solicitação
  e o registro de ações antes de concluir. A opção `agent_verifier_subagent` vem desativada por padrão.
  Fonte: `_run_verifier_subagent` e sua chamada em `src/agent_loop.py`.
* Comandos em segundo plano: execução desacoplada, identificador por sessão, consulta de saída,
  encerramento e retorno do resultado à conversa. Terminal com saída em streaming e controle de execução.
  Fontes: `src/bg_jobs.py`, `src/agent_tools/bg_job_tools.py`, `src/agent_tools/subprocess_tools.py`
  e `routes/shell_routes.py`.
* Continuidade: geração mantida durante a troca de sessão ou reconexão, interrupção explícita e finalização
  de trabalho no editor. Botão de continuar uma resposta interrompida inicia outro envio com o histórico.
  Fontes: `src/agent_runs.py`, `routes/chat_routes.py` e `static/js/chat.js`.
* MCP: configuração e gerenciamento de servidores, autenticação OAuth e navegador integrado via Playwright.
  Fontes: `routes/mcp/mcp_routes.py` e `src/builtin_mcp.py`.
* Assistente pessoal: sessão fixa, nome, personalidade, modelo, ferramentas, fuso horário e acompanhamentos
  diários agendados com horários e instruções configuráveis.
  Fontes: `routes/assistant_routes.py` e `src/assistant_log.py`.

### Pesquisa e comparação

* Pesquisa: busca web, leitura de fontes, pesquisa profunda com planejamento de etapas, acompanhamento,
  cancelamento, resultados, relatório, biblioteca e pesquisas derivadas.
  Fontes: `src/deep_research.py` e `routes/research/research_routes.py`.
* Comparação: vários modelos em paralelo, avaliação cega e síntese das respostas.
  Fontes: `routes/compare/compare_routes.py` e `static/js/compare`.

### Documentos, biblioteca e conhecimento

* Documentos: editor com abas, Markdown, HTML, CSV, destaque de sintaxe, sugestões e edição com IA,
  rascunhos, versões, restauração, arquivamento e exportação.
  Fontes: `routes/document/document_routes.py`, `routes/editor_draft_routes.py` e `static/js/document.js`.
* PDF e assinaturas: importação, extração de texto, visualização, preenchimento com IA, anotações,
  exportação e assinaturas manuscritas reutilizáveis.
  Fontes: `routes/document/document_routes.py`, `routes/signature_routes.py` e `static/js/signature.js`.
* Biblioteca e anexos: upload de arquivos, imagens para visão, documentos pessoais, indexação e recuperação
  de conteúdo para as conversas.
  Fontes: `routes/upload_routes.py`, `routes/personal_routes.py`, `src/document_processor.py`,
  `static/js/rag.js` e `static/js/documentLibrary.js`.
* Memória: busca vetorial e textual, embeddings locais ou endpoint externo, extração de conversas,
  edição, fixação, auditoria, consolidação, linha do tempo e importação ou exportação.
  Fontes: `routes/memory/memory_routes.py`, `routes/embedding_routes.py`, `services/memory/memory.py`,
  `services/memory/memory_vector.py`, `services/memory/memory_extractor.py` e `static/js/memory.js`.
* Skills: catálogo, busca, descoberta contextual, arquivos SKILL.md, criação, edição, exclusão,
  referências, teste, auditoria e publicação de habilidades para uso pelo agente.
  Fontes: `routes/skills_routes.py`, `services/memory/skills.py`, `services/memory/skill_extractor.py`
  e `static/js/skills.js`.

### Organização pessoal

* Email: várias contas IMAP e SMTP, pastas, anexos, busca, resumos, triagem de urgência, etiquetas,
  classificação de spam, rascunhos de resposta e envio agendado.
  Fontes: `routes/email/email_routes.py`, `routes/email_helpers.py` e `routes/email_pollers.py`.
* Contatos: cadastro, busca, CardDAV e importação ou exportação de vCard e CSV.
  Fonte: `routes/contacts/contacts_routes.py`.
* Notas: criação, busca, checklist, lembretes e notificações por navegador, email e ntfy.
  Fontes: `routes/note/note_routes.py` e `static/js/notes.js`.
* Tarefas: execução manual, agendamentos, cron, eventos, pausa, retomada do agendamento,
  histórico de execuções, destinos de saída, webhooks e notificações.
  Fontes: `routes/task/task_routes.py`, `routes/webhook/webhook_routes.py` e `src/task_scheduler.py`.
* Calendário: eventos locais, vários calendários, cores, CalDAV, fusos horários e importação ou exportação ICS.
  Fonte: `routes/calendar_routes.py`.

### Imagem e voz

* Imagens: geração, galeria, álbuns, etiquetas, metadados, edição, rotação, inpainting, transferência de estilo,
  harmonização, nitidez, redução de ruído, ampliação, deduplicação e exportação.
  Fontes: `src/agent_tools/__init__.py`, `src/tool_implementations.py`, `routes/gallery/gallery_routes.py`,
  `static/js/gallery.js` e `static/js/galleryEditor.js`.
* Voz: transcrição, gravação de áudio e síntese de voz.
  Fontes: `routes/stt_routes.py`, `routes/tts_routes.py`, `services/stt/stt_service.py`,
  `services/tts/tts_service.py`, `static/js/voiceRecorder.js` e `static/js/tts-ai.js`.

### Interface, operação e acesso

* Interface: temas, editor de temas, fontes, preferências, atalhos, comandos de barra, organização de janelas
  e painéis, seletor de emojis, dicas e apresentação guiada.
  Fontes: `routes/font_routes.py`, `routes/prefs_routes.py`, `static/js/theme.js`, `static/js/settings.js`,
  `static/js/tileManager.js`, `static/js/keyboard-shortcuts.js`, `static/js/slashCommands.js`
  `static/js/emojiPicker.js`, `routes/emoji_routes.py` e `static/js/tourHints.js`.
* Operação: diagnóstico, uso de tokens, backups, restauração e limpeza seletiva de dados.
  Fontes: `routes/diagnostics_routes.py`, `routes/backup_routes.py`, `routes/cleanup/cleanup_routes.py`,
  `routes/admin_wipe/admin_wipe_routes.py` e `routes/session_routes.py`.
* Cofre: configuração, login, bloqueio e desbloqueio da integração com Bitwarden ou Vaultwarden.
  Fonte: `routes/vault/vault_routes.py`.
* Contas e integrações: configuração inicial, autenticação, usuários, privilégios, 2FA e tokens de API.
  Fontes: `routes/auth_routes.py` e `routes/api_token_routes.py`.
* Interface web e mobile: acesso pelo navegador, layout responsivo, instalação como PWA e gestos de toque.
  Fontes: `README.md`, `static/manifest.json`, `static/sw.js` e `static/js`.
* Companion: descoberta autenticada de capacidades do servidor, listagem dos modelos do usuário e pareamento
  de um cliente por token de uso único. A ponte não contém outro motor de inferência.
  Fontes: `companion/routes.py`, `companion/pairing.py` e `companion/README.md`.
* Integrações Codex e Claude: pacotes de plugin e API com escopos para tarefas, email, memória, calendário,
  documentos e Cookbook, incluindo consulta e controle de servidores de modelos.
  Fontes: `routes/codex_routes.py`, `integrations/codex` e `integrations/claude`.

## Prioridades para os próximos marcos

A prioridade solicitada para imagens anexadas e compactação automática foi implementada nesta etapa.
Isso não conclui biblioteca, indexação de documentos, galeria ou todas as funções de conversas e agentes.
O T3 Code local foi consultado para a experiência de anexos, estado de compactação e continuação da conversa.
Seus adaptadores delegam a compactação nativa ao provedor; a Selene usa um resumo gerado pelo GGUF local.
Resumos vazios ou incompletos permitem até três tentativas por trecho, reduzindo o trecho pela metade
sem avançar o histórico antes de obter um resumo concluído. Falhas informam a causa e preservam o histórico original.
Essa referência de experiência não amplia o catálogo de paridade com o Odysseus.

1. Agente code: navegação de código, plano revisável, aprovações com escopo, registros de execução
   e verificação de resultados. A Selene já tem projeto, ferramentas básicas e aprovação individual;
   esses recursos adicionais continuam pendentes.
2. Conversas: edição, reenvio e regeneração de respostas disponíveis no modo chat por solicitação explícita.
   O reenvio e a regeneração preservam os anexos, substituem as mensagens seguintes e invalidam o resumo anterior.
   O pedido aparece no histórico antes da carga automática do modelo, com indicação de atividade durante a espera.
   Variantes, ramificações, grupos e demais funções seguem os escopos descritos acima.
3. Modelos: compatibilidade com hardware, diagnóstico de GPU, catálogo ampliado, provedores e assinaturas.
4. Pesquisa, biblioteca, documentos, memória, skills e MCP, seguindo as fontes do catálogo.
5. Organização pessoal, mídia, operação, integrações externas e acesso por navegador ou Companion.

Essa ordem organiza o trabalho futuro. A revisão do documento não implementa os recursos pendentes.

## Limites da paridade

O verificador independente tem implementação identificada e entra no catálogo com seu escopo específico.
Ele não estabelece uma funcionalidade geral de delegação de tarefas para agentes auxiliares.
Checkpoints de pesquisa com retomada e automação visual de todo o desktop não tiveram implementação
correspondente identificada nesta inspeção e continuam fora da paridade confirmada.
O navegador via MCP está no catálogo por ter implementação própria no Odysseus.

A reconexão ao stream, o botão de continuar uma resposta e a retomada de um agendamento têm escopos específicos.
O botão de continuar produz outro envio. Isso não comprova restauração exata de processos nem continuação
automática de qualquer tarefa code interrompida depois de reiniciar o aplicativo.
LM Studio não é listado como integração própria: a referência usa endpoints compatíveis e os provedores
identificados no catálogo. Uma atualização futura deste documento exige conferir o código da referência.

## Critérios próprios do MVP

A tela inicial aproxima o título, a seleção de projeto e a entrada. No modo Code, o seletor oferece
projetos cadastrados, adição de projetos e início sem projeto. Nesse último caso, a Selene
cria uma pasta persistente por conversa em `scratch`, dentro dos dados do aplicativo. As ferramentas
respeitam essa pasta e mantêm as aprovações e o acesso completo definidos pelo usuário. A pasta continua
disponível após reiniciar e não é apagada ao excluir a conversa.
Referências de experiência: `apps/web/src/components/NoProjectsHero.tsx`,
`apps/web/src/components/chat/DraftHeroHeadline.tsx`, `apps/web/src/hooks/useScratchProject.ts`
e `apps/server/src/project/ManagedProjectFolders.ts` do T3 Code local. Essa decisão própria não amplia
a paridade com o Odysseus.

Projetos têm cadastro independente das conversas. A Selene abre pastas existentes, cria projetos por nome
em `projects` com Git, README e ícone inicial, e clona repositórios por URL HTTPS. A sidebar lista conversas
diretamente, sem grupos ou ações de projeto. A composição oferece um menu compacto para escolher o projeto,
começar sem projeto ou adicionar uma pasta. O topo mostra projeto e conversa em breadcrumbs.
Renomear altera o nome exibido.
Remover da lista oculta o cadastro e preserva arquivos, conversas e rascunhos. Pastas antes vinculadas somente
a conversas são cadastradas automaticamente na migração.

Rascunhos de texto ficam no armazenamento local da interface e sobrevivem ao reinício. O estado Rascunho
aparece na sidebar quando há texto não enviado. Novos chats vazios reutilizam uma composição vazia e não
criam conversas no processo principal. A conversão em conversa ocorre no primeiro envio e mantém o mesmo
identificador. Texto pendente em conversas existentes é preservado sem substituir suas mensagens.
Anexos não enviados continuam preservados durante a sessão; sua recuperação após reiniciar não faz parte
dessa implementação. Referências adicionais do T3: `apps/web/src/composerDraftStore.ts`,
`apps/web/src/hooks/useHandleNewThread.ts`, `apps/web/src/components/CommandPalette.tsx`
e `apps/web/src/components/Sidebar.tsx`.

Por solicitação do usuário, o modo Code apresenta ações expansíveis em linha, brilho durante a execução,
histórico recolhido após concluir e painel de tarefas com acesso ao histórico. Os cortes do texto são
registrados durante a geração. Mensagens antigas preservam o texto integral, sem cortes inferidos.
O painel acompanha somente os objetivos do último plano válido enviado por `atualizar_plano` na resposta atual.
Comandos, leituras e caminhos de arquivos permanecem no histórico de ações e não geram tarefas automaticamente.
Sem plano, o painel não aparece. Ao concluir, interromper ou falhar, ele sai da área de entrada e o histórico
preserva o plano. Referências locais do T3 Code: `apps/web/src/components/ChatView.tsx`,
`apps/web/src/session-logic.ts` e `apps/server/src/orchestration-v2/Adapters/CodexAdapterV2.ts`.
O acesso completo permanece salvo por conversa, inclusive ao escolher um projeto ou reiniciar.
Essas decisões de experiência seguem as imagens fornecidas do T3 Code e não ampliam a paridade com o Odysseus.

O contexto é obtido automaticamente do GGUF pelo motor e confirmado pelo endpoint `/props`.
O modo automático ajusta o contexto e as camadas na GPU à memória disponível, dividindo os pesos com a RAM
quando necessário. Mantém uma margem de 1024 MiB, ampliada para 2048 MiB quando há projetor visual na GPU.
Falhas de alocação reduzem a reserva efetivamente tentada, até 2048 tokens. Limites manuais permanecem explícitos.
A resposta utiliza o espaço restante
após preparar o histórico, com compactação automática e sem exigir limites manuais na interface.
Esse comportamento é uma decisão própria da Selene solicitada pelo usuário.

Um GGUF real deve responder sem provedor externo. O histórico deve sobreviver ao reinício.
O gerenciamento de projetos abre pela pasta da sidebar ou pela breadcrumb do projeto atual.
O cadastro de projetos usa essa mesma tela, sem o modal antigo. Abrir pasta, criar e clonar ficam em um
painel integrado. Nome, pasta, ícone e remoção aparecem em linhas compactas inspiradas no gerenciamento
do T3 Code. O seletor de ícone expande na própria tela. A paleta segue a referência escura do T3 Code:
sidebar em preto puro, chat em `#0a0a0a`, superfícies e seleções em cinza neutro. O cabeçalho mantém
o céu azul e violeta. Os tokens ficam na configuração do Tailwind em `src/tailwind.css`.
Permite renomear, escolher símbolo e cor, usar iniciais, importar imagem e restaurar a pasta padrão.
A identidade persistida aparece no seletor, na breadcrumb e nas conversas da sidebar, incluindo as concluídas.
Conversas com mensagens exibem o projeto somente na breadcrumb superior. O seletor permanece na tela inicial.
Essas decisões foram solicitadas pelo usuário, com referências locais do T3 Code em
`apps/web/src/components/settings/ProjectSettingsPanel.tsx`, `apps/web/src/components/ProjectFavicon.tsx`
e `apps/web/src/routes/projects.$projectKey.tsx`. Não ampliam a paridade com o Odysseus.

Os projetos de Chat são espaços próprios com nome, ícone, instruções e referências textuais, sem pasta
de trabalho ou Git. O cadastro aparece na sidebar do modo Chat e agrupa conversas e rascunhos.
O menu da conversa permite movê-la para um projeto ou devolvê-la ao histórico geral.
Instruções do projeto substituem a instrução global somente dentro daquele espaço. Referências TXT,
Markdown, CSV e JSON são copiadas para a persistência, sem alterar os originais. Há até 10 arquivos,
20000 caracteres por arquivo e 60000 no conjunto. O modelo recebe essas referências automaticamente.
A opção de contexto entre conversas utiliza as seis últimas mensagens concluídas de cada chat do mesmo
projeto, com até 12000 caracteres no total, ordenando os chats pelos mais recentes. Não consulta outros
projetos nem conversas Code e não equivale a uma memória ilimitada ou busca semântica.
Mover um chat descarta o checkpoint de compactação para não reutilizar contexto do espaço anterior.
Remover o projeto preserva conversas e rascunhos no histórico geral. Essas decisões foram solicitadas
pelo usuário, inspiradas em `https://help.openai.com/en/articles/10169521-projects-in-chatgpt`, e não
ampliam a paridade com o Odysseus. O contexto foi validado com respostas simuladas do motor, sem um GGUF real.

No modo chat não existem ferramentas de computador. No modo code uma escrita ou comando deve aguardar
aprovação; a recusa precisa voltar ao modelo. Cancelar interrompe a geração, aprovações pendentes e processos
da tarefa. Fora do acesso completo, leituras e escritas ficam na pasta real do projeto, incluindo links simbólicos.
O estado de conclusão só pode ser apresentado depois de persistir o resultado.
