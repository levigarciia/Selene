# Ícones de ações

A Selene usa os mesmos desenhos Lucide da referência T3 Code, versão `0.564.0`, e os SVGs próprios
de navegador e computador. A marca do T3 não integra o catálogo. O catálogo também inclui os estados
de pull requests e os ícones de pilha, vínculo, desvínculo e conflito.

Fontes consultadas em `D:/Saas/t3code-main/t3code-main`:

* `apps/web/src/components/chat/MessagesTimeline.tsx`: `WorkEntryIcon`, `BrowserAppIcon` e seleção contextual.
* `apps/web/src/components/Icons.tsx`: `ComputerUseAppIcon`.
* `apps/web/src/components/pullRequest/pullRequestIcons.tsx`: catálogo de pull requests.

`src/components/IconeAcao.tsx` centraliza o catálogo e a escolha. Leitura usa olho, edição usa lápis,
pesquisa web usa globo, busca em comandos usa lupa e compilação ou verificação usa martelo.
O ícone permanece visível depois de concluir, recusar ou interromper uma ação.
Ferramentas desconhecidas usam chave de manutenção. Ícones reservados no catálogo não habilitam novas ferramentas.

Os dois desenhos SVG adaptados são de T3 Tools Inc., copyright 2026, sob licença MIT.
Os avisos e as licenças originais estão em `licenses/T3.txt` e `licenses/Lucide.txt`, incluídos na distribuição.
