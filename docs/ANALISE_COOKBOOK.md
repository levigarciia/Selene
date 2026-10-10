# Cookbook do Odysseus e configurações da Selene

Análise da cópia local em `D:/Saas/odysseus-dev`, em 9 de outubro de 2026.
Escopo: implementação da interface, rotas, serviços de compatibilidade, ferramentas do agente e agendamento.
Esta é uma análise estática. Não executei downloads, instalações, comandos remotos ou servidores para validar fluxos.
As sugestões abaixo são propostas, não funcionalidades implementadas nem decisões aprovadas.

## O que é o cookbook

É uma central para descobrir, baixar, preparar e executar modelos, com diagnóstico e acompanhamento de processos.
A interface oferece Launch, Download, Dependencies e Settings. Running aparece quando existe histórico de tarefas.
Não é um editor de instruções ou uma biblioteca de receitas de prompts.

Fonte: `static/js/cookbook.js:3124` e `static/js/cookbookRunning.js:2085`.

## Inventário funcional

### Descoberta e download

* Busca modelos e consulta metadados do Hugging Face, incluindo modelos recentes e em tendência.
* Oferece categorias de texto, visão e imagem, além de filtro por publicadores reconhecidos como oficiais.
* Filtra por motor, quantização e contexto; ordena por data, compatibilidade, pontuação, memória e velocidade estimada.
* Aceita identificador de repositório ou URL do Hugging Face e referências do Ollama.
* Permite selecionar arquivos GGUF e quantizações antes de baixar.
* Permite escolher máquina e diretório de destino, incluindo servidores remotos.
* Acompanha download em segundo plano, fila, progresso, cancelamento e nova tentativa.

Fontes: `static/js/cookbook.js:3124`, `static/js/cookbookDownload.js:476`,
`routes/cookbook_routes.py:1105`, `routes/cookbook_routes.py:3580`,
`routes/cookbook_routes.py:3956` e `routes/cookbook_routes.py:4022`.

### Compatibilidade com o computador

* Detecta GPU, VRAM, CPU, RAM e memória disponível, localmente ou via SSH.
* Considera contexto e quantização na estimativa de memória, incluindo o cache de atenção.
* Classifica modelos segundo memória, velocidade estimada, qualidade heurística e contexto.
* Considera execução na GPU, CPU e distribuição parcial entre GPU e RAM, conforme motor e plataforma.
* Permite selecionar GPUs e grupos compatíveis em máquinas com múltiplas placas.
* Oferece simulação manual de hardware e atualização da detecção.
* Calcula perfis de execução e sugestões de contexto. Imagem usa estimativas próprias.

Os valores de velocidade e qualidade são estimativas. A compatibilidade prevista não garante carga bem sucedida.
O simulador substitui os dados detectados; não acrescenta memória real ao computador.
As listas distribuídas de modelos estão vazias. Uma instalação nova sem internet não oferece recomendações
até que dados de catálogo sejam obtidos. Caches preenchidos anteriormente podem oferecer resultados offline.

Fontes: `routes/hwfit_routes.py:208`, `services/hwfit/hardware.py`, `services/hwfit/fit.py`,
`services/hwfit/profiles.py`, `services/hwfit/image_models.py`, `static/js/cookbook-hwfit.js`
e `services/hwfit/data/README.md`.

### Biblioteca de modelos baixados

* Examina caches e pastas configuradas, por máquina.
* Exibe modelos locais, tamanhos, arquivos GGUF, estado incompleto e modelos em execução.
* Oferece busca, favoritos, ordenação e filtros por etiquetas.
* Permite exclusão individual, por arquivo GGUF e em lote.
* Oferece retomada ou nova tentativa para modelos incompletos.
* Abre configuração e lançamento diretamente no modelo selecionado.

Fontes: `routes/cookbook_routes.py:1447`, `static/js/cookbookServe.js:1129`,
`static/js/cookbookServe.js:3890` e `static/js/cookbookServe.js:4013`.

### Execução e parâmetros

* Gera comandos conforme modelo, motor, máquina e plataforma.
* Integra llama.cpp, Ollama, vLLM, SGLang, MLX e caminhos de geração de imagem por Diffusers e MLX.
* Expõe contexto, GPU, uso de memória, paralelismo, cache de atenção, lotes e opções específicas do motor.
* Oferece ajustes de ferramentas, raciocínio, templates, otimizações e opções específicas de famílias de modelos.
* No llama.cpp, inclui seleção de GGUF e projetor visual, camadas na GPU, divisão entre GPUs e cache quantizado.
* Nos motores de imagem, oferece configurações e adaptadores compatíveis com o caminho selecionado.
* Permite inspecionar, editar e copiar comandos, além de iniciar o processo.
* Consulta memória e processos da GPU antes e durante o lançamento.
* Registra o modelo como endpoint de texto ou imagem para uso pelo restante do Odysseus.

Suporte varia por plataforma e motor. A presença de uma opção não significa disponibilidade em qualquer computador.
Um endpoint cadastrado também não prova que o servidor esteja pronto; há verificações posteriores de disponibilidade.

Fontes: `static/js/cookbook.js:489`, `static/js/cookbook.js:666`, `static/js/cookbookServe.js:1129`,
`routes/cookbook_routes.py:1578`, `routes/cookbook_routes.py:1816` e `routes/cookbook_routes.py:2018`.

### Acompanhamento de atividades

* Centraliza downloads, instalações e servidores em tarefas persistidas.
* Mostra saída do processo, progresso, falhas e disponibilidade do endpoint.
* Permite parar, forçar encerramento, repetir, editar e recuperar o acompanhamento de tarefas.
* Continua monitorando atividades com o cookbook fechado e notifica eventos na navegação.
* Reconcilia estados antigos com processos e downloads reais, evitando tratar histórico como execução atual.
* Oferece acesso ao modelo no chat e controles relacionados à execução.

Fontes: `static/js/cookbookRunning.js:2085`, `static/js/cookbookRunning.js:3096`,
`static/js/cookbookRunning.js:4118` e `routes/cookbook_routes.py:4285`.

### Perfis salvos

* Guarda configurações de lançamento reutilizáveis e associa perfis ao modelo e à máquina.
* Restaura campos e ambiente para repetir uma execução.
* Há salvamento automático de configurações que funcionaram, limitado por modelo.

O salvamento automático possui restrições no código. Não deve ser entendido como cobertura universal de motores.
Uma versão Selene deveria guardar dados tipados de configuração, em vez de comandos livres.

Fontes: `static/js/cookbook.js:1033`, `static/js/cookbookRunning.js:1284`,
`static/js/cookbookRunning.js:1323` e `static/js/cookbookServe.js:4073`.

### Dependências e preparação

* Detecta pacotes, versões e prontidão no ambiente da máquina selecionada.
* Permite instalar ou atualizar dependências e executar receitas específicas por motor e modelo.
* Oferece caminhos de instalação por pip ou Docker nas receitas aplicáveis.
* Integra instalação de dependências de sistema e reconstrução do motor llama.cpp.
* Apresenta saída e resultado das instalações no acompanhamento de tarefas.
* Abrange pacotes opcionais do Odysseus, incluindo capacidades além da inferência de texto.

Fontes: `static/js/cookbook.js:1065`, `static/js/cookbook-deps-recipes.js`,
`routes/shell_routes.py:1417`, `routes/shell_routes.py:2033`,
`routes/shell_routes.py:2081` e `routes/shell_routes.py:2211`.

### Diagnóstico e recuperação

* Reconhece padrões na saída de processos e apresenta explicação e ações de correção.
* Trata falta de memória, porta ocupada, dependências ausentes e incompatibilidades de motor ou modelo.
* Sugere mudanças como reduzir contexto, ajustar memória, trocar opções ou instalar dependências.
* Permite copiar informações de diagnóstico, abrir a configuração e repetir o lançamento com alterações.
* Inclui ações de limpeza de processos e correções específicas de CUDA, ROCm, MLX, vLLM e SGLang.

Parte das correções executa comandos ou encerra processos. Na Selene, convém oferecer primeiro ações
restritas ao motor e aos processos gerenciados pelo aplicativo, respeitando as permissões das ferramentas do Code.

Fontes: `static/js/cookbook-diagnosis.js:279`, `static/js/cookbook-diagnosis.js:913`,
`static/js/cookbookRunning.js:1604` e `routes/cookbook_routes.py:469`.

### Máquinas, pastas e credenciais

* Mantém perfis de máquina local e servidores SSH, com identificação visual e máquina padrão.
* Configura host, porta, plataforma, ambiente Python, pastas examinadas e destino dos downloads.
* Gera chave SSH, oferece comando para instalar a chave pública e testa conexão.
* Guarda token do Hugging Face para modelos privados ou com acesso restrito.
* Mascara segredos na interface e cifra o token no estado persistido do servidor.
* Sincroniza estado entre navegador e servidor, com proteções contra gravações antigas.

Fontes: `static/js/cookbook.js:3038`, `static/js/cookbook.js:3367`,
`routes/cookbook_routes.py:966`, `routes/cookbook_routes.py:1005`,
`routes/cookbook_routes.py:3429` e `routes/cookbook_routes.py:3457`.

### Agendamento e integrações

* Agenda execução de um modelo por horário inicial, final e dias da semana.
* Pode espelhar a programação no calendário do Odysseus.
* Integra a programação ao sistema de tarefas e ao encerramento do servidor no fim da janela.
* Ferramentas do agente buscam, baixam, lançam e param modelos, consultam logs, máquinas, perfis e caches.
* O agente também pode adotar um servidor já existente para registrar sua execução no gerenciamento.
* O script `scripts/odysseus-cookbook` oferece uma interface de linha de comando sobre o estado compartilhado.

Fontes: `static/js/cookbookSchedule.js:126`, `src/cookbook_serve_lifecycle.py`,
`src/tools/cookbook.py:734` até `src/tools/cookbook.py:1942` e `scripts/odysseus-cookbook`.

## O que a Selene já possui nesta pasta

* Configurações em Geral, Modelos e Motor.
* Temperatura, instrução geral e atualização do aplicativo em Geral.
* Importação de GGUF, catálogo, busca, filtros, favoritos, downloads e gerenciamento de modelos.
* Importação de projetor visual, carga de modelo e remoção com distinção de arquivos gerenciados.
* Motor llama.cpp com CPU, Vulkan e ROCm, incluindo seleção automática.
* Instalação do motor, cancelamento, recarga explícita e descarga do modelo.
* Contexto e camadas automáticos, leitura do contexto efetivo e redução após falha por falta de memória.

Esses itens foram identificados no código atual, não revalidados por testes nesta análise.
Não há equivalência completa com descoberta dinâmica, ranking de hardware, perfis ou gerenciamento remoto.

Fontes: `src/components/Configuracoes.tsx`, `src/components/CamposGeracao.tsx`,
`src/components/ModelosConfiguracoes.tsx`, `src/components/CatalogoModelos.tsx`,
`src/components/ConfiguracaoMotor.tsx`, `electron/services/motor.ts` e `electron/services/limitesModelo.ts`.

## Proposta mínima

Preservar três áreas: Modelos, Motor e Geral. Tornar Modelos a entrada principal das configurações.

* Modelos: alternar entre instalados e catálogo na mesma tela. Usar linhas compactas com nome, tamanho,
  compatibilidade estimada e ação contextual. Mostrar progresso na própria linha.
* Motor: apresentar hardware detectado, processamento automático, modelo carregado e contexto efetivo.
  Reunir parâmetros manuais em uma seção Avançado recolhida.
* Geral: manter instrução geral, temperatura e atualização. Credenciais só aparecem se o fluxo escolhido precisar.
* Modelo selecionado: abrir detalhes inline com quantização, projetor visual, perfil e configurações específicas.
* Falha: mostrar causa compreensível e uma ação principal. Saída técnica fica em detalhes recolhidos.
* Atividades: mostrar resumo discreto enquanto houver trabalho; abrir detalhes sob demanda.
  Evitar uma área permanente de tarefas sem conteúdo.

## Prioridades sugeridas

### Primeira etapa

* Simplificar a apresentação dos recursos que já existem.
* Acrescentar compatibilidade estimada antes do download, considerando pesos, contexto e memória disponível.
* Criar configurações tipadas por modelo, com automático como padrão.
* Melhorar diagnóstico de carga e oferecer nova tentativa ou ajuste de contexto.
* Unificar visibilidade de progresso e estado, preservando o gerenciamento nativo pela Selene.

### Segunda etapa, se houver interesse

* Busca ampliada no Hugging Face e escolha de quantização.
* Token protegido para modelos com acesso restrito.
* Pastas adicionais de modelos e retomada persistente de downloads.
* Presets nomeados e monitoramento detalhado de memória.

A busca ampliada exige mudar o contrato atual de catálogo: hoje os downloads aceitam IDs aprovados,
com revisão e integridade conhecidas. Não basta acrescentar um campo de URL na interface.

### Ampliam o produto e merecem uma decisão separada

* SSH e gerenciamento de várias máquinas.
* Ollama, vLLM, SGLang, MLX e motores de imagem.
* Instalações Python, Docker e reconstrução de motores pela interface.
* Agendamento por calendário, múltiplos servidores e endpoints para outros aplicativos.
* Editor de comandos e controle do cookbook por agente ou linha de comando.
* Simulador de hardware e rankings detalhados de qualidade e velocidade.

O maior ganho é permitir escolher e carregar um modelo adequado e entender falhas com poucos controles visíveis.
O modo automático deve continuar fazendo o trabalho; detalhes aparecem quando há uma escolha ou problema real.

## Decisões para a próxima etapa

* Manter apenas GGUF com llama.cpp ou admitir outros motores.
* Priorizar um catálogo controlado ou investir em descoberta aberta no Hugging Face.
* Aceitar uma primeira etapa com compatibilidade, perfis por modelo e diagnóstico, mantendo a execução local.

Commit sugerido: `docs: analisar cookbook do Odysseus para configurações da Selene`.
Descrição: `Documenta capacidades, fontes e prioridades para uma interface mínima de modelos e motor.`
