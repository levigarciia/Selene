# Contribuindo à Selene

Obrigado por seu interesse em contribuir! Este documento define o processo para contribuir com código, relatar bugs e propor funcionalidades.

## Código de Conduta

Seja gentil e respeitoso. Este é um projeto focado em produtividade e aprendizado.

## Como começar

1.  Faça um Fork do projeto.
2.  Crie uma branch para sua feature (`git checkout -b feature/minha-feature`).
3.  Faça suas alterações.
4.  Commit suas mudanças (`git commit -m 'feat: adiciona suporte a modelo X'`).
5.  Push para a branch (`git push origin feature/minha-feature`).
6.  Abra um Pull Request.

## Padrões de Código

-   **TypeScript**: Usamos TypeScript estrito. Não use `any` a menos que absolutamente necessário.
-   **Estilo**: O projeto usa ESLint e Prettier. Certifique-se de que não há erros de lint antes de enviar.
-   **Commits**: Siga o padrão [Conventional Commits](https://www.conventionalcommits.org/):
    -   `feat:` para novas funcionalidades.
    -   `fix:` para correções de bugs.
    -   `docs:` para documentação.
    -   `refactor:` para refatoração de código.

## Desenvolvimento Local

Siga as instruções no [README.md](README.md) para configurar o ambiente de desenvolvimento. Lembre-se de testar o comportamento de "Click-through" (transparência) se alterar qualquer renderização principal.

## Reportando Bugs

Use a aba "Issues" do GitHub. Inclua:
-   Versão do Windows/OS.
-   Passos para reproduzir.
-   Comportamento esperado vs real.
-   Logs do console (Ctrl+Shift+I na janela do Electron) se possível.
