# Controle do computador

Recurso próprio da Selene, solicitado pelo usuário. Pertence ao modo Code e não amplia a paridade com o Odysseus.

Peça para usar um aplicativo do Windows na conversa. A ferramenta `controlar_computador` observa as janelas,
devolve referências dos elementos e permite clicar, preencher campos, pressionar teclas e rolar.
Cada interação retorna uma nova observação. Identificadores de observações antigas são recusados.
Se o modelo omitir `observacao`, a Selene vincula a ação à leitura atual da mesma conversa.
Para digitar, o elemento deve indicar `editavel=true`. Grupos, botões e rótulos não são campos de texto.

Quando a Selene estiver em primeiro plano, a primeira observação retorna a lista de aplicativos disponíveis.
O modelo deve observar novamente com o identificador `janela` do aplicativo desejado.
A IA nunca recebe referências aos controles da própria Selene e não pode aprovar as próprias ações.

Sem acesso completo, inclusive a captura inicial exige aprovação individual. A prévia avisa que a transmissão
mostra a tela inteira do monitor selecionado, incluindo outros aplicativos visíveis.
O acesso completo continua sendo uma escolha explícita por conversa.

Ative o acesso pelo navegador nas configurações para acompanhar pelo celular. A transmissão usa os eventos
autenticados existentes, tenta atualizar a tela a cada 250 ms e descarta sobreposição de capturas.
A taxa efetiva depende do computador e da rede. O painel oferece ampliação e interrupção remota da tarefa.
Ao reconectar ou voltar ao navegador, a interface recupera a sessão atual. Não se gravam frames no histórico.

O desktop mostra brilho violeta nas bordas e um cursor personalizado no alvo da IA. As janelas desses efeitos
não recebem foco nem cliques e são excluídas da captura pelo Windows. O preview desenha o cursor da IA
separadamente. A conclusão, falha, interrupção ou exclusão da conversa encerra o controlador e a transmissão.

## Capacidades e limites

O controlador usa UI Automation e os controles nativos do Windows. Também solicita acessibilidade por MSAA
para aplicativos Chromium que ainda não tenham exposto sua árvore. Cliques e preenchimentos preferem APIs
de acessibilidade e mensagens de controles, permitindo operações sem tomar o foco quando o aplicativo aceita.
Teclas e rolagem exigem ativar a janela. O Windows pode bloquear foco e entrada em aplicativos elevados.
Campos de texto Chromium recebem entrada Unicode por teclado, com conferência do foco, mesmo quando oferecem
preenchimento direto. O preenchimento direto pode mudar o texto visível sem atualizar o estado de editores controlados.
Quando a ativação falha, o controlador pode clicar no ponto do campo, depois de conferir que pertence à janela
de destino e não está coberto por outro aplicativo. A janela precisa estar visível.
Digitar substitui o conteúdo do campo sem pressionar Enter. O envio exige uma ação separada.
`pressionar` com `referencia` foca e confere o elemento antes de enviar a tecla.
Campos editáveis incluem `valor` quando a acessibilidade oferece leitura, limitado a 1000 caracteres.
O retorno da ferramenta confirma execução da entrada. O modelo precisa conferir o campo e o histórico para confirmar envio.
O controlador não recebe scripts ou comandos arbitrários do modelo.

Modelos com projetor visual local ou suporte a imagens no OpenRouter recebem a captura após cada ação.
Modelos sem visão usam apenas a árvore de acessibilidade. Interfaces sem controles acessíveis continuam
limitadas; não se inventam coordenadas ou resultados. Campos reconhecidos como senha são excluídos e bloqueados.

O teste real que falhou inicialmente tentava observar a própria Selene após a aprovação. A descoberta de
janelas agora funciona nesse caso. O teste seguinte mostrou que o corte em 200 elementos escondia a caixa de
mensagem do Discord, localizada no elemento 303. A leitura percorre até 4000 nós e prioriza campos editáveis
antes de resumir o resultado em 200 elementos. `leituraParcial` indica uma leitura ou resumo incompleto.
Uma inspeção do Discord confirmou a descoberta da caixa de mensagem. Isso não valida o envio nesse aplicativo.

## Referências e validação

Foram consultados os contratos de acesso a aplicativos do [código público do Codex](https://github.com/openai/codex/blob/main/codex-rs/config/src/computer_use.rs)
e a [documentação oficial de computer use](https://learn.chatgpt.com/docs/computer-use).
O controlador da Selene tem implementação própria para Windows.

A descoberta Chromium segue a [documentação de acessibilidade do Chromium](https://www.chromium.org/developers/design-documents/accessibility/)
e a API [AccessibleObjectFromWindow do Windows](https://learn.microsoft.com/en-us/windows/win32/api/oleacc/nf-oleacc-accessibleobjectfromwindow).

`bun run test:computador` valida uma janela WinForms real, observação, preenchimento, clique, referência antiga,
cancelamento, a primeira observação sobre a Selene, captura real no Electron, transmissão mobile autenticada,
frames contínuos, efeitos sem foco, recuperação após recarregar e interrupção remota.
O modelo é simulado nos testes de aprovação e recusa. Não houve envio real de mensagens no Discord.
O editor Chromium de validação mantém o texto por eventos de edição. Ele testa uma árvore extensa, preenchimento
Unicode sem envio e Enter em ação separada, conferindo o texto enviado e o campo vazio. O teste anterior apenas
conferia o texto visível e o recebimento de Enter, sem validar o estado interno do editor.
