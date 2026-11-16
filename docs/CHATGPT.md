# ChatGPT no Chat

No modo Chat, abra o seletor de modelos, escolha ChatGPT e clique em Conectar conta.
Entre na sua conta diretamente na janela do site. Depois clique em Usar ChatGPT na Selene.
A escolha do modelo e os limites de uso pertencem à conta e ao próprio site.

A Selene envia texto pelo compositor do site e acompanha a resposta na conversa local.
Não usa chave de API, Codex CLI, extensão ou servidor intermediário para esse caminho.
Ao começar uma conversa com histórico, o texto anterior é enviado como contexto citado.
Instruções de projetos, arquivos e ferramentas locais não são acrescentados automaticamente.
O vínculo com a conversa nativa fica salvo para continuar depois de reiniciar o aplicativo.
Cada conversa guarda seu próprio link. Ao retomar, a Selene abre diretamente esse endereço e aguarda
o histórico carregar antes de enviar somente a mensagem nova. Não procura conversas pelo título na sidebar.
O endereço é preservado assim que aparece, mesmo quando o envio ainda exige confirmação manual.

## Isolamento

O site usa uma sessão persistente exclusiva do Electron, separada da interface da Selene.
A página não recebe preload, Node, ponte IPC, MCP ou ferramentas do computador.
O aplicativo não extrai senhas, cookies ou tokens. O login ocorre nos campos do próprio site.
Permissões de dispositivos e downloads ficam bloqueados nessa janela.
Os dados de sessão permanecem no perfil local do aplicativo e devem ser protegidos junto com a conta do Windows.
O texto enviado será recebido pelo ChatGPT, sujeito às configurações da conta.

## Limites e recuperação

A integração acompanha apenas texto. Anexos, edição e regeneração devem ser usados diretamente no site.
Alterações feitas lá não são sincronizadas integralmente com o histórico local.
Use Abrir ChatGPT para conferir a conversa original. Não há medição inventada de tokens ou custos.

Um rascunho ou uma geração em andamento no site impede um novo envio pela Selene.
O aplicativo não tenta enviar novamente automaticamente. Se o site não confirmar o envio,
a conversa fica bloqueada até você conferir a janela e clicar em Conferi o envio no site.
Essa confirmação libera o próximo pedido, mas não importa mensagens nem reenvia o pedido anterior.
Interromper solicita a parada da geração quando ela ainda pertence ao envio acompanhado.

Esse recurso depende da interface do site, sem contrato público de estabilidade para automação.
Mudanças no compositor, nas mensagens ou na autenticação podem exigir atualizar o adaptador.
Conversas muito longas com mensagens removidas do DOM podem interromper o acompanhamento.
Não há contorno de desafios de acesso ou de restrições da conta.

## Validação em 16 de novembro de 2026

O teste Electron com página simulada verificou envio único, continuidade, cancelamento, preservação de rascunho,
compositor textarea, envio incerto, persistência, bloqueio no Code e ausência de Node e da ponte na página.
A página pública real abriu e o adaptador reconheceu o pedido de login e o compositor atual.
Após o login e a verificação manual do Cloudflare, dois envios reais foram concluídos na mesma conversa.
A segunda resposta recuperou o código informado na primeira. Ambas chegaram ao histórico da Selene sem ações locais.
O adaptador reconhece a estrutura autenticada atual e a estrutura anterior, cobertas por testes separados.
Desafios do Cloudflare ainda podem interromper o uso e precisam ser concluídos pelo usuário no site.
