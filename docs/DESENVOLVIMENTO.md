# Selene

Seu ambiente desktop para conversar e trabalhar com inteligência artificial local.
A Selene executa modelos GGUF no seu computador com llama.cpp e reúne chat, projetos e um agente de código
em uma interface escura e discreta. A inferência não depende de uma API de IA nem de uma assinatura.

## Instalar

Baixe o instalador `Selene-Setup` na [release mais recente](https://github.com/levigarciia/Selene/releases/latest).
A distribuição atual atende Windows x64. Bun e Node são necessários somente para desenvolvimento.

1. Execute o instalador e abra a Selene.
2. Abra o seletor de modelos e baixe um modelo do catálogo ou importe um arquivo GGUF.
3. Selecione o modelo e envie uma mensagem. A Selene instala o motor necessário no primeiro uso.
4. Para trabalhar com arquivos, abra uma conversa no modo Code e escolha a pasta do projeto.

O primeiro download de modelo e a instalação do motor precisam de internet. Depois disso, a inferência
funciona localmente. Modelos maiores exigem mais memória RAM ou VRAM.
O instalador ainda não tem assinatura digital e o Windows pode solicitar confirmação para sua execução.

## O que você pode fazer

* Conversar com modelos locais e acompanhar raciocínio, uso de contexto e velocidade de geração.
* Anexar imagens com modelos e projetores visuais compatíveis.
* Organizar conversas, pesquisar o histórico, exportar mensagens e encerrar tarefas do modo Code.
* Usar um agente para ler arquivos, propor alterações, executar comandos e acompanhar um plano de trabalho.
* Aprovar escritas e comandos individualmente ou ativar acesso completo em uma conversa.
* Baixar modelos com progresso, cancelamento e verificação de integridade, ou importar seus próprios GGUF.
* Ajustar geração, contexto e processamento por CPU, Vulkan ou ROCm nas configurações.
* Abrir a Selene pelo navegador do celular na mesma rede, com Chat, Code e aprovações.

Para acessar pelo celular, ative Configurações, Acesso web no computador e abra o endereço exibido.
Informe a chave de acesso e mantenha o aplicativo aberto. Consulte [Acesso pelo celular](ACESSO_WEB.md).

A seleção automática de processamento considera a GPU disponível. Nas Radeon compatíveis, tenta ROCm;
se essa carga falhar, tenta Vulkan e informa a troca. Também é possível escolher o processamento manualmente.
Imagens dependem de um modelo visual compatível e do projetor correspondente.

No modo Code, caminhos de arquivos ficam limitados ao projeto quando o acesso completo está desativado.
Comandos aprovados executam PowerShell e podem acessar outras partes do computador.
O acesso completo libera ferramentas sem aprovações individuais e permanece salvo por conversa.

## Atualizações automáticas

Cada envio de código para `main` inicia o GitHub Actions. O fluxo verifica os tipos, executa os testes,
gera o instalador Windows e publica uma release com instalador, blockmap e `latest.yml`.
A publicação usa a versão `1.0.N`, em que `N` é o número da execução do fluxo, sem criar commits de versionamento.
A release só fica pública depois do upload completo dos arquivos. Publicações de commits anteriores
continuam disponíveis, mas somente o código atual da `main` é promovido como release mais recente.

A Selene instalada busca atualizações ao abrir e a cada quatro horas. O download ocorre automaticamente
e a instalação acontece ao fechar normalmente o aplicativo, depois de salvar os dados.
Em Configurações, na área Geral, você pode consultar a versão, o progresso, as falhas e buscar novamente.
O aplicativo não interrompe uma conversa para reiniciar sozinho.

A versão portátil gerada por `bun run dist:portable` não recebe atualização automática.
Uma instalação antiga só recebe o remake automaticamente se as atualizações estiverem habilitadas nela.
Caso contrário, instale manualmente a release atual uma vez.

## Versão anterior

A Selene foi refeita. A branch [main](https://github.com/levigarciia/Selene/tree/main) contém o projeto atual.
A implementação anterior e seu histórico estão preservados na branch
[old](https://github.com/levigarciia/Selene/tree/old). As releases antigas continuam disponíveis.

A Selene usa `%APPDATA%/Selene` para seus dados locais. Os dados anteriormente salvos em
`%APPDATA%/SeleneRemake` permanecem nessa pasta e não são transferidos automaticamente.
Recursos antigos que ainda não foram implementados não fazem parte desta versão.

## Desenvolvimento

Requisitos: Windows x64, Bun e Node 22.12 ou superior.

```powershell
bun install
bun run dev
```

A interface acompanha alterações durante o desenvolvimento. Reinicie o comando após mudar o processo principal.

Os estilos ficam nas classes Tailwind dos componentes. `src/tailwind.css` contém somente a importação do Tailwind.
Os atributos `data-ui` identificam elementos para os estados visuais e as validações desktop.
Valores calculados, como posições de menus e dimensões de ícones, permanecem definidos durante a execução.

```powershell
bun run verificar
bun test
bun run build
bun run test:desktop
```

Para executar a compilação local, use `bun run start`. Para gerar o instalador, use `bun run dist:win`.
Os arquivos de distribuição ficam em `release`.

O GitHub Actions usa o token fornecido pelo GitHub, com permissão de escrita no conteúdo do repositório,
para publicar releases. Nenhum token do GitHub é incorporado ao aplicativo distribuído.

## Estrutura e dados

* `src`: interface React, componentes e hooks.
* `electron`: janela, ponte IPC e serviços de modelos, ferramentas, persistência e atualizações.
* `shared`: contratos, validações e catálogo de modelos.
* `scripts`: desenvolvimento, compilação, validação e publicação com Bun.
* `tests`: testes automatizados.
* `docs`: instruções do projeto, paridade funcional e evidências de validação.

Conversas e configurações ficam em `%APPDATA%/Selene/selene.json`.
Modelos baixados, motor e anexos também ficam nos dados locais do aplicativo.
GGUF importados permanecem na pasta original. Remover a referência de uma importação preserva seu arquivo.
Excluir um modelo baixado pela Selene remove o arquivo gerenciado.

A interface usa isolamento de contexto e uma ponte com operações específicas.
O motor responde somente em loopback, com porta dinâmica e chave temporária.
O catálogo verifica tamanho, assinatura GGUF e SHA 256 dos downloads.

## Documentação e licença

Consulte [paridade funcional](PARIDADE.md), [validação](VALIDACAO.md) e
[desempenho](DESEMPENHO.md) para conhecer os recursos implementados e os limites dos testes.
O Odysseus foi usado como referência funcional. A estrutura e o código do remake são próprios.

O repositório preserva a [licença restritiva da Selene](../LICENSE.md).
O código é público para consulta, com as condições de uso e distribuição definidas nessa licença.
