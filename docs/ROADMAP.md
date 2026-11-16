# Objetivo e roadmap da Selene

## Objetivo do produto

Fazer da Selene uma assistente pessoal para Windows que executa modelos de inteligência artificial no próprio
computador e ajuda a pessoa a conversar, aprender e trabalhar em projetos com controle sobre seus dados e sobre
as ações realizadas.

## Direção do MVP

O MVP reúne dois modos. O Chat oferece conversas locais persistentes com modelos GGUF. O Code ajuda a entender
e alterar projetos, com ações revisáveis, permissões explícitas e resultados verificáveis. O aplicativo gerencia
o motor local baseado em llama.cpp e deve comunicar com clareza o estado dos modelos, das operações e dos erros.

O escopo funcional e o estado já implementado estão documentados em [PARIDADE.md](PARIDADE.md). Este roadmap
define prioridades de produto; sua presença não significa que uma etapa esteja implementada ou validada.

## Prioridades

### 1. Concluir os fluxos essenciais de Chat e Code

* Tornar o plano do agente Code revisável e dar controle claro sobre aprovações, execução e verificação dos resultados.
* Manter confiáveis os fluxos de edição, reenvio e regeneração do Chat, preservando anexos e a coerência do histórico.
* Consolidar a confiabilidade do ciclo de vida dos modelos locais, incluindo carga, cancelamento e falhas do motor.

### 2. Ajudar cada pessoa a escolher e usar modelos

* Ampliar diagnóstico de hardware e compatibilidade para orientar a escolha de modelos.
* Evoluir o catálogo e os provedores mantendo revisões, tamanhos e integridade verificáveis.
* Melhorar a configuração do motor e a explicação das opções com impacto no desempenho.

### 3. Melhorar pesquisa e contexto de trabalho

* Adicionar pesquisa, biblioteca de documentos e recuperação de informações pessoais com controles locais claros.
* Expandir memória, skills e MCP com escopo visível, validação de entradas e permissões adequadas.

### 4. Expandir organização e acesso

* Avaliar recursos de organização pessoal, mídia e operação conforme a necessidade do produto.
* Considerar integrações externas e acesso por navegador ou Companion depois de definir seus limites de privacidade,
  segurança e manutenção.

## Como priorizar e concluir

Priorizar primeiro confiabilidade e clareza dos fluxos já oferecidos, depois capacidades que ampliem esses fluxos.
Cada etapa deve ter escopo explícito, comportamento verificável e tratamento de erros antes de ser considerada
concluída. Funcionalidades planejadas devem continuar identificadas como pendentes na interface e na documentação.

Revisar esta ordem quando houver novas decisões de produto. Mudanças no estado funcional também devem atualizar
[PARIDADE.md](PARIDADE.md), que mantém a distinção entre implementação local, referência e proposta futura.
