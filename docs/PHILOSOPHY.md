# Philosophy

## Linguagem de Design

### Essência

A Selene adota um **minimalismo escuro, técnico e silencioso**. A interface não tenta impressionar com ornamentos, gradientes chamativos ou vidro translúcido. O foco é transmitir um ambiente de trabalho concentrado, discreto e preciso, com aparência de ferramenta séria.

O desenho visual depende de três pilares:

- **Baixo ruído visual**: quase tudo é contido, escuro e de baixo contraste.
- **Hierarquia por proximidade e escala**: o layout usa blocos bem espaçados, não divisórias pesadas.
- **Ações com presença moderada**: elementos interativos aparecem pelo contorno, preenchimento levemente distinto e tipografia mais clara, não por cor agressiva.

### Atmosfera

- O produto deve parecer um **workspace noturno** e refinado.
- O centro da tela precisa respirar; o vazio é parte da composição, não ausência de design.
- A interface deve sugerir foco, organização e continuidade entre projetos, conversas e entrada de texto.
- O resultado esperado é **sóbrio, elegante e utilitário**, nunca lúdico, vibrante ou marketing-first.

## Paleta

### Base

- **Fundo principal da aplicação**: preto grafite muito escuro, próximo de `#0b0c0f`
- **Superfícies secundárias**: variações entre `#111318`, `#151821` e `#1a1d24`
- **Bordas discretas**: tons próximos de `#242833` a `#2c3140`
- **Texto primário**: branco suave, nunca branco puro, próximo de `#f3f5f7`
- **Texto secundário**: azul acinzentado dessaturado, próximo de `#94a0b8`
- **Texto terciário / placeholders**: azul acinzentado mais apagado, próximo de `#657089`

### Acentos

- Os acentos existem em pequenas doses, como selos, badges, ícones e indicadores.
- As cores de destaque devem ser **pontuais e controladas**, com viés para `rosa/magenta`, `vermelho queimado`, `amarelo-ouro`, `verde técnico` e `azul-violeta frio`.
- O acento nunca deve dominar a tela inteira.
- Grandes áreas coloridas, gradientes fortes e fundos luminosos entram em conflito com a linguagem da Selene.

## Tipografia

### Direção Tipográfica

- A tipografia deve ser **limpa, compacta e altamente legível**.
- O tom geral pede uma fonte sem serifa contemporânea, neutra e precisa.
- O peso visual vem de contraste entre tamanhos, opacidade e espaçamento, não de fontes extravagantes.

### Aplicação

- **Marca e títulos de bloco**: semibold ou bold, com presença controlada.
- **Itens de navegação e cards**: médio ou semibold, curtos e diretos.
- **Metadados, placeholders e descrições**: regular, com contraste reduzido.
- **Micro-rótulos de seção**: podem usar caixa alta com tracking discreto, contraste baixo e tamanho pequeno.
- Evitar títulos excessivamente grandes. A interface trabalha melhor com escalas compactas.
- Evitar tracking exagerado, estilos editoriais expressivos e caixa alta dominante fora de rótulos curtos.

## Layout e Composição

### Estrutura Geral

- A aplicação usa uma composição com **sidebar fixa à esquerda** e **canvas principal amplo** à direita.
- A sidebar é um bloco escuro próprio, separado do canvas por uma borda sutil.
- O canvas principal deve permanecer majoritariamente limpo, com o conteúdo relevante concentrado no eixo inferior-central.

### Barra Superior

- A barra superior é fina, discreta e estrutural.
- Ela não compete por atenção com a sidebar nem com o composer.
- Deve funcionar como moldura silenciosa para ações globais e controles de janela.

### Vazio Intencional

- O espaço vazio central faz parte da identidade do produto.
- Não preencher o canvas com widgets, ilustrações, painéis auxiliares ou padrões visuais sem necessidade real.
- A sensação correta é de **respiro, foco e prontidão**, não de dashboard denso.
- Mesmo com atalhos contextuais visíveis, o canvas deve continuar parecendo amplo e calmo.

### Alinhamento e Densidade

- Usar grid consistente, com espaçamentos generosos entre grupos.
- A densidade visual é baixa a moderada.
- Componentes pequenos podem coexistir em blocos compactos, mas o conjunto nunca deve parecer apertado.
- Preferir alinhamentos retos, margens estáveis e ritmo vertical previsível.

## Superfícies e Contornos

### Cartões e Blocos

- Cartões usam fundo levemente diferente do entorno, com contraste sutil.
- Bordas são finas, frias e pouco chamativas.
- Sombras, quando existirem, devem ser curtas e profundas, quase invisíveis.

### Raios por Escala

- **Superfícies principais** como composer, busca lateral, botão `Nova conversa` e bloco de perfil usam raio generoso.
- **Cards menores** usam raio moderado.
- O arredondamento comunica refinamento e controle, nunca maciez excessiva.

### Hierarquia de Superfícies

- Sidebar, cards, campo de mensagem e botões compartilham a mesma família visual.
- Cada camada deve diferir por poucos pontos de luminosidade, nunca por saltos bruscos.
- O sistema deve funcionar bem quase inteiro em tons escuros, com poucos momentos de destaque.

## Sidebar

### Papel

- A sidebar é uma área funcional, densa e organizada.
- Ela concentra navegação, busca, projetos, conversas e perfil sem parecer carregada.

### Regras Visuais

- Fundo ainda mais escuro que o canvas principal.
- Seções separadas por respiro e microdivisórias discretas.
- Títulos de seção pequenos, com aparência de rótulo e contraste reduzido.
- Itens clicáveis devem ter estados de hover suaves e legíveis.
- O botão `Nova conversa` precisa se destacar pelo preenchimento e pelo ícone, não por cor vibrante.

### Itens de Lista

- Projetos e conversas devem parecer linhas organizadas, não cards pesados.
- Ícones pequenos e consistentes, com traço simples.
- O item ativo ou em foco pode receber fundo levemente elevado e texto mais claro.

### Perfil no Rodapé

- O módulo inferior de perfil/conta faz parte do equilíbrio visual da coluna.
- Deve ser ancorado no rodapé da sidebar, com avatar, nome e seletor em uma superfície discreta porém delimitada.
- O bloco precisa parecer estável, funcional e coerente com o restante da navegação.

## Cards de Sugestão

### Função

- Os cards de sugestão no centro-inferior do canvas funcionam como atalhos de contexto.
- Eles devem parecer opcionais e úteis, não chamadas promocionais.

### Composição

- Devem formar um agrupamento compacto, centralizado e leve acima do composer.
- A leitura do conjunto é de um bloco de atalhos calmos, não de um dashboard de recomendações.

### Regras

- Tamanho compacto e baixa altura visual.
- Fundo levemente elevado sobre o canvas.
- Título curto e mais claro.
- Descrição breve com contraste menor.
- Tags ou badges coloridas em escala pequena, usadas só como apoio semântico.
- Hover com leve realce de borda ou superfície; evitar animações chamativas.

## Campo de Mensagem

### Papel no Layout

- O campo de entrada é um dos elementos com maior peso visual da tela inicial.
- Ele ancora a interface no rodapé do canvas e organiza as ações principais ao redor da digitação.

### Regras Visuais

- Área ampla, escura e levemente destacada do fundo.
- Borda fina e raio maior que o dos cards menores.
- Placeholder claro o suficiente para orientar, mas ainda contido.
- O botão de envio deve ser discreto, alinhado ao resto da linguagem, sem aparência de CTA agressivo.

### Barra de Ações Embutida

- A base do composer deve conter uma faixa interna de ações com ícones pequenos, separadores verticais e toggles ou pills discretas.
- Esses controles precisam parecer integrados ao campo, não anexados como toolbar externa.
- Os controles secundários devem manter contraste moderado e leitura técnica.

## Interação

### Estados

- Hover deve alterar levemente fundo, borda ou luminosidade do texto.
- Focus deve ser limpo e preciso, sem brilhos saturados.
- Estados ativos podem usar um degrau pequeno de contraste e nitidez.
- Transições devem ser rápidas, suaves e quase invisíveis.

### O que evitar

- Glassmorphism forte
- Gradientes chamativos
- Neon
- Sombras longas
- Bordas grossas
- Animações elásticas
- Saturação alta
- Excesso de chips, badges ou destaques simultâneos

## Padrões de Consistência

- Sempre preservar o contraste entre **canvas vazio** e **blocos funcionais concentrados**.
- Sempre favorecer superfícies escuras em camadas próximas.
- Sempre usar cor como detalhe, não como estrutura principal.
- Sempre buscar uma sensação de ferramenta premium e contida.

## Anti-Padrões

Não alinhar a Selene com estas direções:

- Dashboard corporativo claro
- Interface gamer ou neon
- Visual glassmorphism translúcido
- Estética editorial ou brutalista
- Layout lotado com múltiplos painéis concorrendo por atenção
- Botões com cor sólida muito viva
- Cartões enormes ocupando o canvas inteiro

## Regra de Decisão

Quando houver dúvida em uma alteração de frontend, escolher a opção que:

1. Preserve o fundo escuro e silencioso.
2. Mantenha o centro da tela respirando.
3. Reforce a hierarquia com contraste sutil, não com exagero.
4. Faça a interface parecer mais precisa e menos decorativa.
