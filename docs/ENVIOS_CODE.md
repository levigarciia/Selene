# Envios durante a tarefa no Code

Recurso próprio da Selene solicitado pelo usuário. Não amplia a paridade com o Odysseus.

* Na fila: preserva a mensagem por conversa e inicia outra resposta após a tarefa atual concluir com sucesso.
* Redirecionar: acrescenta a instrução à mesma tarefa no próximo limite entre chamadas ao modelo ou ferramentas.
* Enter: redireciona durante a execução. Alt+Enter: coloca na fila. Shift+Enter: insere uma linha.
* A fila permite remover uma mensagem ou convertê-la em redirecionamento.
* Após erro, interrupção ou reabertura, os envios permanecem visíveis e podem ser enviados manualmente.
* Envios durante a execução aceitam texto. Anexos continuam disponíveis em envios normais.

Uma geração ou ferramenta em andamento termina antes de receber a nova instrução. Aprovações pendentes são
recusadas quando há redirecionamento; chamadas seguintes do lote são dispensadas para reconsiderar a tarefa.
As permissões continuam vinculadas à conversa. Redirecionar não autoriza comandos nem escritas.

Cada envio é validado no processo principal. A referência à resposta ativa impede aplicar um envio atrasado
em outra tarefa. A fila comporta até 20 mensagens de até 30000 caracteres e fica no histórico local.

Referência consultada: [OpenAI Developers](https://developers.openai.com/blog/mastering-codex-remote-for-engineering).
Queue aguarda o fim da tarefa; Steer altera a direção do trabalho em andamento. A Selene implementa a entrega
entre chamadas, usando seu próprio agente e os motores de conclusão compatíveis.

Validação: `bun test tests/enviosCode.test.ts` e `bun run test:envios-code`.
O teste Electron usa respostas simuladas e cobre atalhos, fila automática em ordem, redirecionamento,
conversão de mensagem enfileirada, interrupção, retomada manual e largura de 420 pixels.
Os testes de serviço verificam persistência, recuperação de direções não entregues após reabertura,
falha ao salvar, referência obsoleta à tarefa e recusa de uma escrita aguardando aprovação.
