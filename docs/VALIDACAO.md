# Validação do primeiro marco

## Ícones contextuais de ações

* Catálogo de 25 ícones baseado no T3 Code, incluindo estados de pull requests e sem a marca do T3.
* `bun run test:icones`: aprovado no Electron. Verifica leitura, edição, pesquisa web, navegador,
  terminal, busca por comando, compilação, plano e ferramenta desconhecida nos sete estados das ações.
* Captura conferida: `artifacts/selene-icones-acoes.png`.
* `bun run verificar`, `bun test`, `bun run build` e `git diff --check`: aprovados, com 106 testes unitários.

## Atividade e raciocínio em 9 de outubro de 2026

* O brilho acompanha apenas a mensagem da execução atual e cessa ao concluir, falhar ou cancelar.
* Ações ainda em preparação, aprovação ou execução recebem estado terminal quando a tarefa encerra.
* O indicador repetitivo Trabalhando foi removido do conteúdo da mensagem.
* Trechos `reasoning_content` são publicados, persistidos e exibidos separados da resposta final.
* `bun run verificar`, `bun test`, `bun run build` e `git diff --check`: aprovados, com 82 testes.
* `bun scripts/testarDesktop.ts scripts/validarAtividadeGeracao.ts`: aprovado no Electron.
  Verifica abertura durante o raciocínio, recolhimento na resposta e ausência de brilho residual.
* Motor ROCm ativo `b10327`, com Qwen carregado: pedidos sintéticos de 512 tokens retornaram
  0, 451, 811 e 1177 caracteres de raciocínio nos níveis desativado, baixo, médio e alto,
  com orçamentos respectivos de 0, 128, 256 e 384 tokens. Todos atingiram o limite artificial do teste.
  Essa medição confirma o efeito dos orçamentos, sem avaliar a qualidade das respostas.
* Um pedido curto em SSE retornou 63 trechos de raciocínio, 191 caracteres de raciocínio e
  uma resposta de 2 caracteres, com encerramento `stop`, usando o parser real da Selene.
* Capturas conferidas: `artifacts/selene-raciocinio-ativo.png` e
  `artifacts/selene-raciocinio-concluido.png`. Nenhuma distribuição foi publicada nesta validação.

## Sidebar por estado e separação de modos

Referência de 9 de outubro de 2026: código local em `D:/Saas/t3code-main/t3code-main`.
Foram consultados `Sidebar.tsx`, `Sidebar.logic.ts`, `threadInbox.ts`, `SidebarStageBackdrop.tsx`
e `docs/user/thread-sidebar.md`.

* Chat e Code têm históricos, seleção e rascunhos independentes. A troca de modo fica na sidebar.
* Code usa conversas atuais no topo, Trabalhando abaixo e Concluídas ao final, sem grupos por projeto.
* Trabalhando e Concluídas ficam junto ao rodapé, com espaço livre acima, sem linhas ao lado dos nomes.
  Categorias sem itens ficam ocultas. Trabalhando aparece antes de Concluídas.
* O check no hover conclui conversas. Pronto indica resposta terminada sem conclusão manual da conversa.
  O indicador de terminal aparece somente durante a execução real do comando.
* O botão direito em Concluídas permite apagar todas após confirmação. Chats e conversas atuais são preservados.
* O rodapé tem apenas três ícones. Configurações e Estatísticas ficam à esquerda, atualizações à direita.
  A fonte de atualizações ainda não está configurada, e o aplicativo informa essa condição.
* Estatísticas usam as medições do motor em tela ampla, com gráfico diário e detalhamento por modelo ou dia.
  Filtros por modo, modelo, 24 horas, 7, 30 e 90 dias ou histórico total.
  O registro de uso migra métricas antigas, evita duplicação e sobrevive à exclusão de conversas e ao reinício.
* Aprovações ficam no topo. Respostas terminadas voltam ao topo, sem encerrar automaticamente a conversa.
* Concluir e retomar no menu de contexto preserva mensagens e persiste a decisão. Um novo envio retoma a conversa.
* O cabeçalho estrelado usa decoração CSS própria inspirada no céu Nightly do T3.
* `scripts/validarSidebar.ts` verifica modos, rascunhos, busca isolada, seções, conclusão, retomada e reinício
  em perfil Electron isolado. A reprodução dos indicadores usa eventos IPC controlados, sem carregar GGUF.
* `tests/historico.test.ts` cobre separação de modos, prioridade de aprovação, classificação de trabalho,
  retorno ao topo e retomada de conversa encerrada pelo agente.
* Alterações parciais não aplicam padrões aos campos ausentes. Renomear, concluir ou retomar preserva
  o modelo e a permissão escolhidos. O contrato tem cobertura de regressão específica.

## Imagens e compactação automática

A edição de mensagens do usuário no modo chat oferece cancelamento e reenvio, preservando anexos e rascunhos.
O reenvio substitui o histórico posterior e descarta o resumo anterior para evitar contexto desatualizado.
Testes automatizados cobrem validação, geração com histórico corrigido e restauração após falha ao salvar.
`bun scripts/testarDesktop.ts scripts/validarEdicaoChat.ts` valida os controles no Electron em perfil isolado.
O teste desktop verifica abertura, cancelamento, mensagem vazia e falha por ausência de modelo sem alterar o histórico.
O reenvio com resposta do modelo foi validado com inferência simulada, sem executar o GGUF real.

A regeneração no chat reutiliza o pedido original e seus anexos, sem duplicar a mensagem do usuário.
O botão aparece ao lado das informações da resposta, fora de gerações ativas; não aparece no modo code.
O status superior do modelo foi removido. O envio persiste o pedido antes de carregar o modelo e apresenta
`Ligando modelo` com brilho no local da resposta. Cancelamento e falha encerram o brilho e preservam o pedido.
Testes simulados cobrem ordem de persistência, contexto após a carga, falha de inicialização e cancelamento.
O Electron validou posição do botão, ausência no modo code e indicação de carga por eventos simulados.
Essa alteração ainda não foi validada com carga e inferência reais do GGUF.

Implementação de 9 de outubro de 2026, validada em perfil desktop isolado.

* Contratos antigos continuam compatíveis. Anexos usam identificadores gerados no processo principal.
* Seleção, colagem, arraste, remoção e ampliação passaram no Electron.
* PNG, JPEG e WebP passaram pelo seletor real. O compositor converte os arquivos para PNG antes do IPC,
  com fundo branco para transparência; o processo principal valida a decodificação e grava a cópia JPEG.
* Cada envio aceita até quatro imagens PNG, JPEG ou WebP de até 10 MB antes da normalização.
  As cópias são JPEG, limitadas a 1536 pixels no maior lado e 4 MB por arquivo. Os originais são preservados.
* Arquivos sem decodificação válida, formatos fora da lista, identificadores desconhecidos e duplicados são recusados.
* Anexos ficam em arquivos locais, com metadados no histórico. A limpeza preserva referências compartilhadas.
* A importação do projetor visual aceita um GGUF escolhido no diálogo nativo. A recarga acontece no próximo envio.
  O suporte a imagens é confirmado por `/props`, seguindo o contrato oficial do
  [llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).
* Inferência visual real com Qwen3.5 2B Q4_K_M, projetor F16 correspondente e motor Vulkan b11521:
  o modelo identificou um círculo vermelho sobre fundo branco.
* O projetor usado no teste veio da revisão `f6d5376be1edb4d416d56da11e5397a961aca8ae` do repositório
  `unsloth/Qwen3.5-2B-GGUF`. Tamanho: 668227264 bytes. SHA 256 conferido:
  `7035e9cb8d7c6a9681d07eef9a364783e86ea4cd73faab2eabb4f43a101830c7`.
  O download de teste não foi registrado como modelo nos dados normais do aplicativo.
* Um modelo carregado sem suporte visual recusou o envio, mantendo o anexo disponível no rascunho.
* Reinício preservou as imagens enviadas e o resumo. A exportação Markdown incorporou a imagem.
* Compactação real com o mesmo GGUF preservou a palavra fictícia `turquesa` e continuou o pedido automaticamente.
* Cancelar durante a compactação real interrompeu o resumo, preservou o histórico e liberou a conversa.
* Testes automatizados cobrem compactação em partes, posição persistente, troca de instruções, resultados grandes
  de ferramentas, cancelamento, resumo vazio, truncamento, falha HTTP e falha ao persistir o resumo.
* Janela mínima de 840 por 620 sem overflow horizontal, com prévias conferidas visualmente.
* TypeScript estrito, compilação de produção, 34 testes com 160 asserções e os fluxos desktop anteriores passaram.
* Motor real: carga cancelada, GGUF inválido, recuperação, geração e encerramento passaram após as alterações.

O orçamento é uma estimativa conservadora, não uma contagem exata do tokenizer. Considera bytes UTF 8,
esquemas de ferramentas e reserva de 4096 tokens por imagem, além do limite de resposta e uma margem.
A compactação começa em 85% do orçamento restante. A mensagem atual nunca é cortada: se não couber,
o aplicativo informa que é necessário aumentar o contexto ou reduzir o envio.
Resumos antigos usam texto e descobertas visuais já descritas. Os pixels das imagens resumidas continuam
no histórico, mas não são reenviados automaticamente ao modelo. Durante uma tarefa, resultados antigos
de ferramentas podem virar resumo temporário; o registro completo de ações continua persistido.

A recuperação de resumos incompletos pede um limite explícito de palavras e permite até três tentativas por trecho.
Cada repetição reduz o trecho pela metade, mantendo o resumo anterior válido e a posição inicial do trecho.
Testes simulados confirmam recuperação de truncamento, limite de tentativas e cancelamento sem alterar o histórico.
Essa recuperação ainda não foi validada com inferência real do Qwen3.5 9B em NVIDIA.

Scripts: `bun run test:contexto` verifica a interface. As variáveis `SELENE_TESTE_GGUF`, `SELENE_TESTE_RUNTIME`
e `SELENE_TESTE_PROJETOR` habilitam a inferência, a compactação e a visão reais em perfil isolado.
Capturas: `artifacts/selene-anexos.png`, `artifacts/selene-compactacao.png` e `artifacts/selene-visao.png`.

Data: 9 de outubro de 2026. Plataforma: Windows x64.

## Verificações realizadas

* TypeScript estrito e compilação de produção.
* Vinte e quatro testes do núcleo, desempenho e downloads, com 93 asserções.
* Bloqueio de acesso externo por caminho relativo, absoluto e junction.
* Prévia sem escrita, aprovação, recusa, cancelamento e proteção contra mudanças concorrentes em arquivos.
* Gravação sequencial, reinício, preservação de histórico corrompido e desativação de acesso completo ao reabrir.
* Streaming UTF 8 fragmentado e detecção de respostas truncadas.
* Modo chat sem ferramentas de computador.
* Aplicativo Electron: ponte IPC, modos, diálogos, autorização, renomeação e persistência após reinício.
* Interface em desenvolvimento pelo Vite.
* Empacotamento Windows portátil e validação da aplicação empacotada.
* Conferência SHA 256 dos seis arquivos compilados dentro do pacote.
* Instalação Vulkan do llama.cpp b11521, com tamanho e SHA 256 oficiais verificados.
* Inferência real com Qwen3.5 9B Q4_K_M na AMD Radeon RX 7700 XT.
* Instalação própria ROCm b10327 com pacote oficial completo, tamanho e SHA 256 verificados.
* Comparação controlada do mesmo GGUF e contexto: aproximadamente 12 tokens/s em Vulkan e 55 em ROCm.
* Fluxo integrado com streaming: 56,19, 53,75 e 55,23 tokens/s em três respostas de 256 tokens.
* Seleção da GPU dedicada, migração do processamento antigo e agrupamento de publicações sem perda de texto.
* Cancelamento da carga, falha com GGUF inválido, recuperação e encerramento do motor real.
* Chat e code em ROCm, tempos nativos na interface e cancelamento de uma geração em andamento.
* Os mesmos fluxos de chat, code, aprovação e cancelamento passaram no executável Windows atualizado.
* Modo code real: proposta de `escrever_arquivo`, arquivo ausente antes da aprovação, aprovação pela interface,
  arquivo criado com o conteúdo solicitado e confirmação do modelo.

O GGUF foi lido da instalação anterior da Selene, sem copiar ou modificar o arquivo de pesos.
Os perfis e arquivos criados pelos testes ficaram em `.teste-dados`, separados dos dados normais do aplicativo.
Os testes mais recentes reutilizaram apenas os binários oficiais instalados pela própria Selene.
O procedimento e as medições de desempenho estão em [DESEMPENHO.md](DESEMPENHO.md).
Os screenshots estão em `artifacts`.

## Navegação e salvamento

* Configurações em tela própria, com Geral, Modelos e Motor; catálogo integrado na área Modelos.
* Sidebar recolhida, largura de 72 pixels e preferência preservada após reinício.
* Rascunhos da conversa e das configurações preservados ao navegar entre telas.
* Layout de configurações conferido em 1280 por 840 e na janela mínima de 840 por 620, sem overflow horizontal.
* Menu de contexto por botão direito e Shift + F10, navegação por teclado e retorno de foco por Escape.
* Exportação e exclusão de uma conversa não selecionada, com confirmação e cancelamento da exclusão.
* Ações de exportar e excluir ausentes do cabeçalho da conversa.
* Salvamento pela interface com Qwen3.5 2B em ROCm: temperatura e contexto mantiveram o mesmo PID do motor.
* Contexto salvo marcado como pendente, recarga no envio seguinte com novo PID e pendência encerrada.
* Chat, escrita com aprovação e cancelamento de geração passaram após a alteração de contexto.
* Os mesmos fluxos passaram no aplicativo Windows empacotado, incluindo a conferência dos seis arquivos compilados.

Os testes de salvamento usaram um perfil isolado e o GGUF já baixado pelo teste do catálogo.
A referência atualizada foi inspecionada localmente em `D:/Saas/odysseus-dev`, versão declarada `0.20.19`.
O inventário registra 483 declarações estáticas de operações em 44 módulos de `routes`, com SHA 256 das fontes.
Todos os caminhos de fontes citados em `PARIDADE.md` foram conferidos nessa cópia. Essa inspeção não executou
o Odysseus nem validou suas integrações externas.

## Catálogo de modelos

* Oito arquivos GGUF Q4_K_M com repositório, revisão, tamanho e SHA 256 conferidos pela API pública do Hugging Face.
* Catálogo desktop: lista, famílias, busca, favoritos, filtro de modelos disponíveis e recusa de identificadores IPC
  que não pertencem ao catálogo.
* Os mesmos fluxos de interface passaram no aplicativo Windows empacotado. Os seis arquivos compilados
  correspondem aos arquivos dentro do pacote.
* Favoritos e cadastro do modelo baixado preservados após reinício.
* Download externo completo do Qwen3.5 2B, com verificação de integridade, seleção pela interface e cancelamento
  seguido de nova tentativa.
* Instalação automática do motor Vulkan ao carregar o modelo pela primeira vez.
* Chat com Qwen3.5 2B: resposta correta à pergunta quanto é dois mais dois.
* Code com Qwen3.5 2B: escrita de resultado.txt aguardou aprovação, foi executada e confirmada pelo modelo.
* Exclusão de download removeu o arquivo gerenciado. Remover uma importação preservou seu arquivo original.
* Testes locais de assinatura fragmentada, truncamento, corrupção, excesso de tamanho, resposta HTML, erro HTTP,
  cancelamento, encerramento, limpeza de parcial e nova tentativa após falha de persistência.

As validações do catálogo usaram perfis isolados em `.teste-dados`.
Os screenshots são `artifacts/selene-catalogo.png` e `artifacts/selene-catalogo-baixado.png`.
Os modelos de [Qwen](https://huggingface.co/unsloth/Qwen3.5-2B-GGUF),
[Llama](https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF),
[Gemma](https://huggingface.co/unsloth/gemma-3-1b-it-GGUF) e
[DeepSeek](https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF)
usam arquivos das respectivas distribuições GGUF públicas. As versões exatas constam em `shared/catalogo.ts`.

## Limites da evidência

Os testes de inferência e ferramentas usaram Qwen3.5 9B e 2B com uma GPU. Não estabelecem compatibilidade
com todos os GGUF, drivers, arquiteturas ou modelos multimodais. A distribuição CPU está configurada
com pacote oficial e checksum,
mas a inferência CPU não foi testada nesta rodada.
Os outros sete itens do catálogo tiveram seus metadados conferidos, mas não tiveram download completo e inferência
testados nesta rodada. Downloads interrompidos não têm retomada por intervalo HTTP.
As funcionalidades pendentes do catálogo em `PARIDADE.md` ainda não foram implementadas ou validadas.
Os testes de agente verificam leitura, escrita e processos. Não verificam automação visual do computador.

## Atividade Code e permissão da conversa

* `bun run verificar`, `bun test` (55 testes) e `bun run build` passaram nesta alteração.
* `bun scripts/testarDesktop.ts scripts/validarAtividade.ts` validou linhas sem container, detalhes de ações,
  histórico recolhido, resposta final visível, painel de tarefas, acesso ao histórico e velocidade de geração.
* O brilho em execução e a preferência por movimento reduzido passaram no Electron. A entrada coube em 420 pixels.
* A escolha de acesso completo permaneceu ativa ao escolher um projeto. Testes do agente confirmaram escrita
  sem aprovação, ordem dos textos e ações, corte da resposta final e persistência desses dados ao reabrir.
* A geração nesta validação usou respostas controladas. Não foi executada uma nova tarefa com GGUF real.
* A regra antiga de desativar acesso completo ao reabrir foi substituída pela escolha persistente por conversa.
# Correção da carga visual automática

Data: 9 de outubro de 2026.

* Qwen3.5 2B, 4B e 9B do catálogo têm projetores F16 fixados na mesma revisão dos pesos.
* Cadastros existentes e importações reconhecidas recebem o projetor durante a carga, sem importação manual.
* Qwen3.5 9B real reconheceu um círculo vermelho sobre fundo branco com ROCm e Vulkan.
* O projetor de 918166080 bytes teve tamanho e SHA 256 conferidos antes da carga.
* Cancelamento, falha de inicialização, recuperação e encerramento do motor passaram com o suporte visual.
* Testes unitários, TypeScript, compilação e fluxo desktop específico de anexos passaram.
* A suíte desktop geral teve timeout ao aguardar o texto do seletor de permissões, fora do fluxo de imagens.
* Executável corrigido: `release/visao/Selene.exe`. A instância aberta permaneceu disponível durante a validação.

## Projetos e rascunhos em 9 de outubro de 2026

* TypeScript, 73 testes unitários e build aprovados.
* `bun run test:projetos`: cadastro independente, migração, criação com Git, renomeação, recolhimento,
  seleção e remoção preservando arquivos e conversas passaram no Electron.
* Uma execução com `SELENE_TESTE_CLONE=1` clonou `octocat/Hello-World` por HTTPS e conferiu seu README.
* Cliques repetidos em Nova conversa não criaram conversas nem linhas vazias na sidebar.
* Dois rascunhos Chat, um rascunho Code por projeto e texto pendente em conversa existente sobreviveram
  ao reinício e foram restaurados pela sidebar. Limpar o texto removeu a linha do rascunho vazio.
* `bun scripts/testarDesktop.ts scripts/validarEnvioRascunho.ts`: falha preservou texto, nova tentativa
  manteve o identificador e envio confirmado limpou o rascunho. Texto alterado durante o envio foi preservado.
* O envio desse teste utilizou respostas IPC controladas. Não foi executada uma nova geração com GGUF real.
* `bun run test:sidebar`: navegação, categorias de atividade, conclusão, retomada e estatísticas passaram.
* O texto de rascunhos é persistente. Anexos não enviados permanecem disponíveis durante a sessão.

## Distribuição do remake em 9 de outubro de 2026

* `bun run verificar`, `bun test` e `bun run build`: aprovados, com 65 testes.
* Testes do atualizador: consulta inicial, prevenção de downloads duplicados, progresso, atualização pronta,
  ausência de downgrade e recuperação após falha de conexão.
* `bun run test:desktop`: aprovado, incluindo navegação, IPC, persistência e reinício.
* Instalador NSIS x64: gerado localmente com instalador, blockmap e `latest.yml`.
  A saída de validação ficou em `artifacts/distribuicao`, pois a pasta de distribuição anterior estava em uso.
* Aplicativo empacotado: teste desktop aprovado com perfil isolado e consulta de atualização desativada
  pela variável de execução portátil. Isso valida a abertura e os módulos empacotados, sem instalar uma atualização.
* A entrega entre duas instalações reais ainda não foi validada. A primeira publicação será acompanhada
  pelo GitHub Actions. As instalações antigas dependem da preferência de atualização já habilitada.
* A branch `old` preserva o commit remoto `ec2d8a2513a620db0388bc161c9df3cea25dbe48`.

## Detalhes de releases na sidebar em 9 de outubro de 2026

* Referência inspecionada: `SidebarUpdatePill.tsx`, `SidebarUpdateReleaseNotes.tsx` e `releaseNotes.ts`
  na cópia local `D:/Saas/t3code-main/t3code-main`.
* Atualizador: histórico completo habilitado; notas aceitam texto ou grupos por versão, com remoção de HTML
  e limites de seis versões, oito itens por versão e 220 caracteres por item.
* Cinco testes de atualização aprovados. Cobrem preservação das notas durante o download, recuperação após
  falha, normalização do histórico e restrição de links ao repositório oficial.
* `bun run build`: aprovado. `bun scripts/testarDesktop.ts scripts/validarAtualizacoes.ts`: aprovado.
  O teste da interface usa dados de release simulados, com o aplicativo Electron e sua ponte IPC reais.
* Interface validada com mouse e teclado, Escape, abertura do link oficial por shell simulado,
  progresso de download e sidebar recolhida em 840 por 620 pixels. Capturas em `artifacts/selene-atualizacao*.png`.
* A suíte completa do workspace teve uma falha em `tests/nucleo.test.ts`, por `projetoId` adicional no estado
  persistido. O teste desktop anterior também falhou ao acessar a primeira conversa após criar um rascunho.
  Essas áreas estão em alteração no workspace e não fazem parte da validação do fluxo de atualizações.
* As próximas publicações gerarão notas com os títulos dos commits desde a release anterior.
  Nenhuma nova release foi publicada durante esta alteração.

## Seleção de projeto e breadcrumbs em 9 de outubro de 2026

* Menu compacto conforme a imagem fornecida, com Sem projeto, projetos cadastrados e Adicionar projeto.
* Sidebar sem grupos de projeto e sem botão de cadastro. Conversas atuais permanecem na lista direta.
* Breadcrumbs com projeto e título editável da conversa no topo.
* `bun run verificar`, `bun test` e `bun run build`: aprovados, com 73 testes.
* `bun run test:projetos`: aprovado no Electron. Seleção por mouse e teclado, opção Sem projeto,
  breadcrumbs, persistência de rascunhos e remoção preservando arquivos validados.
* `bun run test:sidebar`: aprovado no Electron, incluindo categorias, estados, conclusão e reinício.
* Captura conferida em `artifacts/selene-projetos-rascunhos.png`.

## Ajuste de memória do motor em 9 de outubro de 2026

* Erro recebido na GTX 1660: falha de alocação Vulkan do cache do Qwen3.5 9B.
  O padrão de 99 camadas impedia o ajuste automático da distribuição dos pesos.
* Contexto e camadas automáticos agora permitem ao llama.cpp ajustar a carga à memória livre.
  A margem é de 1024 MiB, ou 2048 MiB com projetor visual. O modo manual preserva seus limites.
* `bun run verificar`, `bun test`, `bun run build` e `git diff --check`: aprovados, com 75 testes.
* `bun scripts/validarMotor.ts`: aprovado com GGUF real e ROCm na RX 7700 XT.
  Cancelamento, GGUF inválido, recuperação, três respostas e encerramento foram validados.
* `MotorLocal` com Vulkan e o projetor visual gerou uma resposta com contexto de 94976 tokens na RX 7700 XT.
* Teste nativo Vulkan com contexto de 2048 e margem ampliada para limitar o orçamento da GPU:
  resposta gerada com 8 das 33 camadas na GPU e os demais pesos na RAM.
  Registro em `artifacts/validacao-memoria-vulkan.log`; roteiro local em `.teste-dados/validarMemoria.ts`.
* O orçamento reduzido exercita o ajuste de memória na Radeon disponível. Não simula o driver NVIDIA
  e não confirma a execução na GTX 1660. Nenhuma nova release foi publicada nesta validação.

## Gerenciamento de projetos em 9 de outubro de 2026

* Pasta da sidebar e breadcrumb abrem a tela de gerenciamento.
* Nome, símbolo, cor, iniciais, imagem e restauração do ícone persistem no cadastro.
* `bun run build` e `bun test`: aprovados, com 82 testes.
* `bun run test:gerenciamento`: aprovado no Electron. Verifica rascunho preservado, importação
  cancelada, arquivo original intacto, propagação aos chats e persistência após reiniciar.
* Capturas conferidas em `artifacts/selene-gerenciamento-projeto.png` e
  `artifacts/selene-gerenciamento-projeto-estreito.png`, sem excesso horizontal em 420 pixels.
* Projeto repetido abaixo da breadcrumb removido das conversas com mensagens.

## Pesquisa e navegador

Execute `bun run test:web` para validar o navegador real do Electron. O script usa duas conversas isoladas,
uma interface HTTP local e uma pesquisa externa. Verifica preenchimento, clique, recusa de referências antigas,
mudança do elemento após preparação, cancelamento e ausência de Node nas páginas remotas. Também lê uma fonte
pública da documentação do Electron. A pesquisa externa depende de rede e pode falhar por bloqueio do mecanismo.

`tests/web.test.ts` valida o ciclo do agente com respostas de modelo simuladas, pesquisa no Chat,
restauração dos resultados no contexto, restrições de URLs e aprovação recusada ou acesso completo.
Isso não comprova a qualidade das decisões de um GGUF real ao selecionar e usar ferramentas.

Execute `bun run test:navegador-inline` depois de compilar o aplicativo para validar a interface real
com o serviço de navegador e a ponte desktop. A fixture usa dados isolados e não carrega um modelo.
Verifica imagens reais no histórico concluído, atualização automática da página, recolhimento, ampliação,
atualização manual, largura reduzida, fechamento e ausência de outra janela visível.
O teste web também exige um clique confiável do Chromium, aceita chamadas sem `observacao` e recusa
referências antigas mesmo quando esse parâmetro está ausente.

Validação em 10 de outubro de 2026: 116 testes unitários, compilação, `bun run test:web` e
`bun run test:navegador-inline` aprovados. A pesquisa retornou oito fontes e a leitura pública foi aprovada.
O teste geral `bun run test:desktop` continua falhando por acesso a `conversas[0].id` após criação de rascunho.
O comportamento de um GGUF real e o fluxo completo do iFood não foram validados nesta execução.

Correção da atualização em 10 de outubro de 2026: `bun run test:navegador-inline` também verifica a sequência
navegador, pesquisa real, leitura de duas fontes públicas e retorno ao navegador. Uma alteração visual da página
anterior não pode sobrescrever a captura da leitura atual. Verifica leitura no Chat sem navegador controlado
e isolamento entre conversas. `bun test` contém 117 testes aprovados. Verificação de tipos e compilação aprovadas.

Validação em 9 de outubro de 2026: 106 testes unitários aprovados, compilação aprovada e `bun run test:web`
aprovado com pesquisa real e leitura de fonte pública. O teste geral `bun run test:desktop` falhou ao tentar
acessar `conversas[0].id` depois de criar um rascunho ainda sem persistência. Esse fluxo geral não foi aprovado.

## Configurações inspiradas no cookbook

Validação em 9 de outubro de 2026: `bun run verificar`, `bun test` e `bun run build` aprovados.
A suíte contém 112 testes. O roteiro `bun scripts/testarDesktop.ts scripts/validarConfiguracoes.ts`
foi aprovado no Electron com dados isolados, runtime ROCm já instalado e GGUF Qwen3.5 9B real.
O roteiro exige `SELENE_TESTE_RUNTIME` com a pasta dos runtimes existentes. `SELENE_TESTE_GGUF` aponta
para um GGUF real opcional; sem essa variável, somente os fluxos sem inferência são exercitados.

* Perfil salvo pela interface sobrevive ao reinício sem alterar a configuração global.
* Restaurar preferências gerais remove o perfil persistido e atualiza os campos.
* IPC recusa perfil com contexto inválido.
* Modelo ausente produz diagnóstico com detalhes recolhidos e ação de nova tentativa.
* Consulta detecta Radeon RX 7700 XT e 12 GB de VRAM total pelo runtime instalado.
* Cancelamento durante carga, nova carga e encerramento foram exercitados com o GGUF real.
* Salvar perfil com o modelo pronto preserva o PID. O próximo envio recarrega com contexto de 4096 tokens.
* A resposta do chat termina concluída. A janela de 420 pixels não apresenta excesso horizontal nas configurações.

Capturas conferidas: `artifacts/selene-catalogo-compatibilidade.png`, `artifacts/selene-motor-diagnostico.png`,
`artifacts/selene-modelos-perfil.png` e `artifacts/selene-configuracoes-estreitas.png`.

A estimativa é uma triagem, não uma medição por arquitetura: pesos com margem de 15%, projetor conhecido
e faixa de cache de 64 a 512 KiB por token. O modo automático considera o mínimo de 2048 tokens para a triagem.
Usa 85% da VRAM total como orçamento e reserva 2 GB da RAM livre. Memória ocupada da GPU, projetores importados
sem tamanho cadastrado e particularidades da arquitetura podem mudar o resultado real.
O catálogo controla revisões e integridade como antes. Não há descoberta aberta, SSH ou outros motores nesta etapa.

## Estimativa de tokens por segundo

A interface apresenta uma faixa de geração em `tokens/s`, mantendo a triagem de memória nos detalhes.
O cálculo próprio segue o princípio de largura de banda por pesos usado em `services/hwfit/fit.py` do Odysseus.
A tabela nominal cobre somente GPUs desktop reconhecidas. A previsão combina 30% a 60% de eficiência,
largura de banda da GPU e faixa genérica de 20 a 55 GB/s para RAM. Reserva espaço para contexto e projetor
antes de estimar a distribuição de pesos. Perfis com camadas manuais incluem o cenário conservador de CPU.
Não é benchmark, não mede o processamento do prompt e não prevê o tempo até o primeiro token.
MoE sem parâmetros ativos, GPU desconhecida, ausência de consulta e memória limitada ficam sem estimativa numérica.

`tests/velocidadeModelo.test.ts` verifica variação por pesos, contexto, projetor e processamento,
além de placas desconhecidas e distinção de variantes desktop e notebook.

Validação em 10 de outubro de 2026: 116 testes aprovados, verificação TypeScript e compilação aprovadas.
O roteiro de configurações passou no Electron sem inferência nesta rodada, usando o runtime ROCm instalado
para consultar a GPU real e verificar indicadores em tokens por segundo. A captura do catálogo foi conferida.
Não foi realizado benchmark para calibrar ou confirmar as velocidades previstas.

## Painel de estatísticas e contexto temporal

Validação em 10 de outubro de 2026: `bun test` aprovado com 120 testes. Verificação de tipos e compilação aprovadas.
`bun run test:estatisticas` valida o aplicativo Electron com dados isolados e medições de exemplo.
Confere total, agrupamento por modelo ou dia, período, filtros de modo e modelo, gráfico por teclado,
ausência de dados, largura de 420 pixels e fechamento com Escape. Não carrega GGUF nem altera dados pessoais.

`tests/estatisticas.test.ts` verifica janelas móveis, sessões distintas, dias vazios e soma dos grupos.
`tests/contextoTemporal.test.ts` verifica mudança de dia entre fusos e a presença de uma única instrução
com data atual em chamadas consecutivas do Chat e Code, preservando o histórico e instruções do projeto.
A data vem do relógio e do fuso do computador. Não modifica os arquivos salvos nem garante a resposta de um GGUF.
A compactação também recebe a referência temporal atual.

## Cache de entrada

A Selene já envia `cache_prompt: true` ao llama.cpp. O reaproveitamento depende do prefixo comum, do modelo
e do estado do servidor. A data contextual usa apenas dia e fuso, sem horário ou segundos variáveis.

Medições novas registram `usage.prompt_tokens_details.cached_tokens`, com alternativa em `timings.cache_n`.
A entrada total prioriza `usage.prompt_tokens`; na ausência dele, soma `timings.prompt_n` e `timings.cache_n`.
O cache faz parte da entrada e não é somado novamente ao total. Registros antigos não recebem valores inventados.
Respostas com chamadas sem medição completa de cache permanecem sem essa divisão. O painel informa a cobertura
e mantém as estatísticas na área central, com sidebar e controles de janela acessíveis.

Fontes primárias, compatíveis com o runtime b10327 instalado:
[Documentação do servidor](https://github.com/ggml-org/llama.cpp/blob/b10327/tools/server/README.md).
Validação: parser, precedência, cache maior que entrada, múltiplas chamadas e totais com histórico sem cache
são cobertos pelos testes. A interface usa medições de exemplo. O ganho de velocidade do GGUF real não foi medido.
