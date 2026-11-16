# Trabalho com a Selene

A Selene pode ser usada para programação supervisionada. Revise as mudanças e execute os testes do projeto antes
de publicar ou integrar código. O modelo pode cometer erros mesmo quando as proteções do aplicativo funcionam.

## Dados e recuperação

Somente uma instância pode abrir o mesmo perfil. A persistência também bloqueia gravações entre processos e recusa
salvar uma fotografia antiga sobre dados alterados por outra instância. Arquivos temporários são sincronizados antes
da substituição. Três cópias rotativas permitem recuperar o histórico; o arquivo corrompido é preservado e a recuperação
é informada ao usuário. Sem cópia válida, o aplicativo falha sem apagar o original.

Essas cópias ficam no mesmo disco. Mantenha uma cópia independente do perfil e dos repositórios para proteger contra
falha física, exclusão externa e comprometimento do computador. Históricos e checkpoints são dados locais em texto,
sem criptografia integral. A chave OpenRouter usa a proteção de credenciais do sistema.

No Code, o checkpoint fotografa arquivos conhecidos pelo Git e arquivos novos não ignorados antes e depois do turno.
Inclui binários. Restaurar arquivos deste turno apresenta a lista afetada e exige confirmação.
Mudanças posteriores ou feitas após a prévia bloqueiam a restauração. Tarefas precisam estar encerradas.

Após encerramento abrupto sem fotografia final, a prévia informa que inclui mudanças posteriores ao início do turno.
Revise toda a lista. A operação guarda uma cópia adicional antes de restaurar e tenta desfazer escritas parciais em erros.
Falha do sistema durante a restauração pode exigir recuperar essa cópia manualmente.

Limites: vinte checkpoints por conversa, 128 MB e 20000 arquivos por fotografia. Arquivos ignorados, dados fora da pasta,
submódulos, links, índice e referências Git não são restaurados. A indisponibilidade é exibida na mensagem.
O checkpoint complementa o Git e não substitui commits ou backup.

Uma conversa Code nova vinculada a um repositório pode usar Isolar em worktree no menu de contexto. Ela parte do HEAD
atual e exige a pasta original sem alterações pendentes. As worktrees ficam no perfil; não são apagadas ao excluir
uma conversa, para preservar trabalho ainda não integrado.

## Permissões e provedores

Nas ferramentas próprias, arquivos ficam limitados à pasta autorizada quando acesso completo está desligado.
Travessia, junctions e vínculos físicos são recusados. Escritas revalidam o arquivo após a aprovação.
Comandos aprovados executam com os privilégios do usuário, inclusive fora do projeto. O terminal não é uma sandbox.
Acesso completo dispensa aprovações e deve ser usado conscientemente.

Codex e Claude usam os seus harnesses. Sessões nativas são persistidas e retomadas quando modelo, pasta, permissões
e continuidade permanecem compatíveis. Falha ou edição da história impede reutilizar uma sessão incompatível.
Imagens seguem no formato nativo do provedor e resultados de ferramentas preservam suas identidades.

O Chat com Claude desativa ferramentas nativas, usa instrução de conversa e não carrega configurações de projeto.
O Chat com inscrição Codex está bloqueado: não há garantia verificada de desativação completa de suas ferramentas.
Use Codex no Code. No Chat, use Claude, modelo local ou OpenRouter.

Modelos remotos recebem o contexto enviado ao serviço. Um GGUF local não herda a qualidade do modelo usado no T3.
Permissões não eliminam erros de código ou instruções maliciosas encontradas nos dados.
O acesso web usa HTTPS e chave obrigatória. Confira o certificado local na primeira conexão. Consulte `ACESSO_WEB.md`.

## Validação

Execute `bun run verificar`, `bun test`, `bun audit` e `bun run build`.
As regressões estão em `tests/segurancaTrabalho.test.ts`.
No Electron: `bun run test:desktop`, `bun run test:acesso-web`, `bun run test:envios-code` e
`bun scripts/testarDesktop.ts scripts/validarRecuperacaoDesktop.ts`. Usam perfis separados e respostas simuladas.
O último valida instância única, terminal nativo e restauração real pela interface.

`bun scripts/validarSegurancaReal.ts` usa Codex para editar arquivos, rodar testes e retomar uma sessão.
`bun scripts/validarCancelamentoCodex.ts` verifica cancelamento com subprocesso real.
`bun scripts/validarImagemCodex.ts caminho.jpg` valida a cor da imagem verde gerada pelo teste de acesso web.
`bun scripts/validarChatSeguro.ts` precisa de login Claude válido para testar Chat sem ferramentas e retomada.
Esses roteiros consomem a inscrição e trabalham em pastas descartáveis.

O empacotamento usa os módulos Node API pré compilados do node-pty. A reconstrução por node-gyp fica desativada.
Valide o terminal no pacote da arquitetura de destino antes de distribuir. Empacotamento Windows:
`bun x electron-builder --win --dir --publish never`.

## ChatGPT pelo site

A sessão remota não recebe Node, preload, IPC ou MCP. Permissões e downloads são recusados.
Navegação principal fica limitada a destinos do ChatGPT e autenticação conhecidos; recursos exigem HTTPS
e destinos públicos. O login e os cookies permanecem na sessão exclusiva, sem extração de credenciais.
O envio usa o compositor e falha sem repetição automática quando a confirmação é incerta.
A interface pública e dois envios autenticados reais foram verificados, incluindo continuidade na mesma conversa.
Desafios do Cloudflare exigem intervenção manual e não são contornados pela integração.
Consulte `CHATGPT.md` para limites de sincronização e dependência da interface do site.
