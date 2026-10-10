# Acesso pelo celular

Abra Configurações, Acesso web na Selene do computador. Clique em Ativar acesso.
Conecte o celular à mesma rede Wi Fi, abra um dos endereços exibidos em uma aba do navegador
e informe a chave de acesso. O aplicativo precisa permanecer aberto no computador.

A opção Exigir chave de acesso vem ativada por padrão. Para uma rede de confiança, desmarque
essa opção e clique em Aplicar alterações (ou Ativar acesso, se estiver desativado).
O navegador então abre a Selene diretamente. Qualquer pessoa nessa rede poderá operar o aplicativo.
Ativar novamente a exigência encerra o acesso sem chave e solicita autenticação nas abas abertas.

A barra superior do celular oferece Chat, Code, um ícone para nova conversa e um botão de navegação.
O botão abre a sidebar completa para pesquisar e selecionar conversas, acessar projetos
e abrir configurações. Selecionar uma conversa fecha a sidebar.
Campos usam fonte de pelo menos 16 pixels em telas pequenas para evitar o zoom automático do Safari.
Os controles usam `touch-action: manipulation`, preservando o zoom por gesto.

Conversas, modelos, respostas, imagens, ações e aprovações usam o mesmo estado do desktop.
As tarefas continuam no computador quando a aba sai de primeiro plano. Ao retornar à aba
ou recuperar a conexão, o navegador recebe o estado atual. A exportação baixa Markdown no navegador.
Os seletores de arquivos e pastas do computador continuam disponíveis somente no desktop.
Projetos já cadastrados e projetos gerenciados podem ser usados pelo navegador.

O acesso começa desativado. A ativação, a porta e a exigência de chave ficam salvas no perfil da Selene.
A chave muda ao reiniciar o aplicativo. Renovar chave encerra todas as sessões imediatamente.
A sessão dura até 24 horas quando a chave é exigida. Nesse modo, Configurações, Acesso web permite sair do navegador.

Use uma rede local de confiança, pois o transporte é HTTP. Se o firewall do Windows solicitar,
permita a Selene em redes privadas. Não é necessário abrir portas no roteador.
Se a porta 4318 estiver ocupada, escolha outra porta nas configurações.
Este fluxo não publica a Selene na internet nem inclui instalação PWA.

## Desenvolvimento e validação

Execute `bun run build` para preparar a interface servida pelo processo Electron.
Mesmo em desenvolvimento, o acesso remoto usa `dist`, com a API no mesmo endereço da página.
Execute `bun run test:acesso-web` para validar Electron e Chrome com tela móvel e dados isolados.
O teste usa Chrome instalado, uma resposta OpenRouter simulada e uma escrita real em pasta de teste.

Validações: autenticação, operações sem sessão, origem e endereço, argumentos inválidos,
eventos, revogação, login inválido, seleção de Chat e Code, histórico móvel, anexos,
exportação com imagem, aprovação de arquivo, recuperação de conexão e dimensões dos campos.
A validação automatizada não substitui a conferência em um iPhone físico.

Referência local: `D:/Saas/odysseus-dev/launcher.py` configura o endereço de escuta;
`app.py` serve a interface e aplica autenticação; `routes/auth_routes.py` mantém sessões.
A Selene implementa seu próprio servidor e compartilha operações validadas entre HTTP e IPC.
