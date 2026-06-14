/**
 * Banco de dados centralizado de Habilidades (Skills) da Selene.
 * Contém guias de boas práticas que a IA lê antes de executar tarefas específicas.
 */
export interface Skill {
    id: string
    nome: string
    descricao: string
    palavrasChave: string[]
    diretrizes: string
}

export const SKILLS_DATA: Record<string, Skill> = {
    'docx': {
        id: 'docx',
        nome: 'Manipulação de Documentos Word (.docx)',
        descricao: 'Orientações para criar e formatar documentos do Microsoft Word de forma profissional.',
        palavrasChave: ['docx', 'word', 'documento word', 'relatório word', 'criar docx', 'editar docx'],
        diretrizes: `## 📄 Diretrizes para Criação e Edição de Arquivos Word (.docx)

1. **Estrutura Hierárquica Clara**:
   - Utilize sempre cabeçalhos estruturados (Heading 1, Heading 2, Heading 3).
   - O título principal deve ser destacado em tamanho e peso (ex: 24pt, Negrito).
   - Evite pular níveis hierárquicos (ex: passar de Título 1 direto para Título 3).

2. **Tipografia e Estilo**:
   - Mantenha consistência tipográfica. Use fontes profissionais e universais como Arial, Calibri ou Times New Roman se for para uso geral, ou Aptos/Georgia para designs modernos.
   - Tamanho padrão do corpo de texto: 11pt ou 12pt com espaçamento de linhas entre 1.15 e 1.5 para melhor legibilidade.

3. **Tabelas Profissionais**:
   - Tabelas devem ter cabeçalho destacado (fundo colorido de baixo contraste e texto em negrito).
   - Evite bordas pretas pesadas; prefira bordas finas em cinza claro para um visual clean.
   - Alinhe textos à esquerda e números/valores monetários à direita.

4. **Elementos Visuais e Espaçamento**:
   - Adicione quebras de página explicitamente (\`page break\`) antes de novos capítulos principais.
   - Use listas com marcadores (bullets) ou numeração para sequências de passos, facilitando o escaneamento visual.
   - Garanta margens padrão de 2,5 cm (superior/inferior) e 3,0 cm (esquerda/direita) para impressão ou leitura digital.`
    },
    'pdf': {
        id: 'pdf',
        nome: 'Manipulação e Geração de PDFs',
        descricao: 'Melhores práticas para criar, mesclar, dividir e assinar arquivos PDF.',
        palavrasChave: ['pdf', 'gerar pdf', 'criar pdf', 'mesclar pdf', 'unir pdf', 'dividir pdf', 'assinar pdf'],
        diretrizes: `## 📕 Diretrizes para Criação e Processamento de PDFs

1. **Otimização de Tamanho e Resolução**:
   - Imagens embutidas em PDFs devem ser otimizadas para 150 DPI (telas) ou 300 DPI (impressão). Evite inserir imagens brutas gigantescas.
   - Comprima fluxos de texto e fontes sempre que possível para manter o arquivo leve.

2. **Acessibilidade e Layout**:
   - Mantenha o PDF pesquisável (texto selecionável). Evite gerar PDFs baseados apenas em imagens chapadas de texto, a menos que passe por uma etapa de OCR.
   - Defina metadados básicos no documento (Título, Autor, Assunto) para facilitar sistemas de indexação.

3. **Operações de Mesclagem e Divisão**:
   - Ao unir PDFs, verifique a orientação de página de cada arquivo (retrato vs. paisagem) para evitar cortes de conteúdo.
   - Ao dividir PDFs, garanta que os links internos e marcadores (bookmarks) correspondentes aos trechos divididos continuem válidos.

4. **Formulários e Preenchimento**:
   - Formulários interativos (AcroForms) devem ter campos com nomes descritivos claros e ordem de tabulação (\`Tab Order\`) lógica para usuários de leitores de tela.`
    },
    'pdf-reading': {
        id: 'pdf-reading',
        nome: 'Extração e Leitura de PDFs',
        descricao: 'Orientações para parsing de texto, extração de tabelas e leitura de PDFs estruturados.',
        palavrasChave: ['ler pdf', 'extrair pdf', 'parsear pdf', 'conteúdo do pdf', 'extrair texto pdf', 'pdf reader'],
        diretrizes: `## 🔍 Diretrizes para Leitura e Extração de Conteúdo de PDFs

1. **Detecção de Layout e Fluxo**:
   - PDFs organizados em colunas devem ser lidos de cima para baixo em cada coluna, e não da esquerda para a direita ao longo de toda a página (o que misturaria o texto).
   - Ignore cabeçalhos e rodapés repetitivos nas páginas intermediárias para não poluir o conteúdo principal extraído.

2. **Extração de Tabelas Estruturadas**:
   - Identifique linhas e colunas cruzando as coordenadas geográficas dos blocos de texto.
   - Utilize heurísticas baseadas em linhas divisórias visuais para reescrever tabelas no formato Markdown estruturado antes de apresentá-las ao modelo de linguagem.

3. **Tratamento de PDFs Digitalizados (Imagens)**:
   - Se o arquivo não contiver texto selecionável, recomende a execução de um motor OCR (Reconhecimento Óptico de Caracteres).
   - Indique ao usuário quando a extração falhar por criptografia de PDF ou proteção de senha.`
    },
    'pptx': {
        id: 'pptx',
        nome: 'Criação de Apresentações PowerPoint (.pptx)',
        descricao: 'Boas práticas para design de slides, narrativa visual e legibilidade.',
        palavrasChave: ['pptx', 'powerpoint', 'slide', 'slides', 'apresentação pptx', 'criar slide'],
        diretrizes: `## 📊 Diretrizes para Criação de Apresentações (.pptx)

1. **Regra de Ouro do Design de Slides (10-20-30)**:
   - Uma apresentação ideal deve conter em média 10 slides, durar até 20 minutos e usar fonte de tamanho mínimo de 30pt para garantir a legibilidade à distância.
   - Menos texto, mais impacto visual. Cada slide deve transmitir uma única ideia principal.

2. **Contraste e Paleta de Cores**:
   - Use contrastes altos (ex: texto branco/claro em fundo escuro, ou texto preto/escuro em fundo branco).
   - Evite fundos muito decorados ou com gradientes espalhafatosos que prejudiquem a leitura da tipografia.

3. **Narrativa e Estrutura**:
   - Slide 1: Título e Gancho de Atenção.
   - Slide 2: O Problema/Desafio.
   - Slides 3 a 8: A Solução, Dados de Suporte, Exemplos Claros.
   - Slide 9: Chamada para Ação (Call to Action).
   - Slide 10: Conclusão e Contatos.

4. **Consistência de Alinhamento**:
   - Alinhe títulos sempre na mesma posição horizontal/vertical ao longo dos slides.
   - Use grades para alinhar caixas de texto e ícones secundários.`
    },
    'xlsx': {
        id: 'xlsx',
        nome: 'Modelagem de Planilhas Excel (.xlsx)',
        descricao: 'Orientações para modelagem de dados, fórmulas eficientes e design de planilhas de negócios.',
        palavrasChave: ['xlsx', 'excel', 'planilha', 'tabela excel', 'fórmula excel', 'criar xlsx', 'editar xlsx'],
        diretrizes: `## 📈 Diretrizes para Criação e Edição de Planilhas (.xlsx)

1. **Tipos de Dados e Formatação Explícita**:
   - Mantenha formatação explícita em todas as colunas: valores monetários com símbolo de moeda, porcentagens com "%" e datas no padrão regional adequado (ex: DD/MM/AAAA).
   - Alinhe dados de texto à esquerda e valores numéricos à direita para facilitar o escaneamento e soma mental.

2. **Fórmulas e Funções Modernas**:
   - Escreva nomes de funções sempre em letras maiúsculas (ex: \`SOMA\`, \`PROCV\`, \`PROCX\`, \`SE\`).
   - Evite referências circulares e prefira o uso de tabelas nomeadas em vez de referências a células soltas (ex: \`TabelaVendas[Total]\` em vez de \`D2:D100\`).

3. **Design Visual Limpo**:
   - Use uma linha de cabeçalho com fundo de cor sóbria (azul marinho, cinza escuro, verde escuro) e texto em branco/negrito.
   - Aplique cores de fundo alternadas nas linhas (tabela zebrada) usando tons extremamente suaves de cinza ou azul para guiar os olhos na leitura horizontal.
   - Congela o painel da primeira linha (\`Freeze Panes\`) para manter os cabeçalhos visíveis ao rolar a planilha.`
    },
    'frontend-design': {
        id: 'frontend-design',
        nome: 'Filosofia de Design de Interface (UI/UX)',
        descricao: 'Princípios estéticos e visuais premium aplicados à Selene.',
        palavrasChave: ['design', 'ui', 'ux', 'estilo', 'visual', 'aesthetics', 'frontend-design', 'cores', 'layout'],
        diretrizes: `## 🎨 Diretrizes de Design de Interface Premium da Selene

1. **Estética Minimalista Escura (Dark Mode Native)**:
   - Use fundos escuros refinados e profundos (ex: HSL 240, 10%, 4% ou #0a0a0c), evitando o preto puro (#000) para superfícies grandes.
   - Utilize glassmorphism sutil (ex: fundo com opacidade reduzida \`rgba(20, 20, 25, 0.7)\` e filtro de desfoque \`backdrop-filter: blur(12px)\`) com bordas finas e translúcidas (\`border: 1px solid rgba(255, 255, 255, 0.08)\`).

2. **Tipografia Moderna e Hierarquia**:
   - Priorize fontes geométricas modernas e legíveis como *Inter*, *Outfit* ou *Roboto*.
   - Use pesos de fonte de forma expressiva (Negrito/600 para títulos, Regular/400 para conteúdo principal e Fino/300 para textos secundários de suporte).

3. **Micro-Animações e Transições Suaves**:
   - Elementos interativos (botões, cards) devem ter hover effects táteis (escala sutil \`scale: 1.02\`, brilho suave da borda ou deslocamento milimétrico).
   - Use curvas de interpolação suaves para animações (ex: \`cubic-bezier(0.4, 0, 0.2, 1)\` ou molas físicas via Framer Motion).

4. **Nenhum Placeholder**:
   - Nunca utilize placeholders simples (como caixas cinzas ou texto "lorem ipsum"). Sempre gere assets reais ou SVGs dinâmicos ricos para demonstrar ideias visuais.`
    },
    'file-reading': {
        id: 'file-reading',
        nome: 'Leitura de Arquivos Arbitrários',
        descricao: 'Roteamento lógico e inteligente para consumir diferentes extensões de arquivos.',
        palavrasChave: ['ler arquivo', 'conteúdo do arquivo', 'abrir arquivo', 'file-reading', 'ler md', 'ler txt'],
        diretrizes: `## 📂 Diretrizes para Roteamento e Leitura de Arquivos

1. **Seleção de Parser por Extensão**:
   - **.pdf**: Direcione para o parser de PDF estruturado (veja skill pdf-reading).
   - **.docx**: Use Mammoth ou extrator similar para converter a estrutura do Word para HTML/Markdown equivalente.
   - **.xlsx / .csv**: Converta os dados tabulares em Markdown ou JSON tabular limpo para processamento pela IA.
   - **.txt / .md**: Leia como texto puro (UTF-8).

2. **Tratamento de Limites e Performance**:
   - Arquivos muito grandes (maiores que 5MB) devem ser lidos de forma incremental ou paginada para não estourar a janela de contexto ou memória operacional do aplicativo.`
    },
    'product-self-knowledge': {
        id: 'product-self-knowledge',
        nome: 'Auto-Conhecimento de Modelos Anthropic (Claude)',
        descricao: 'Informações técnicas atualizadas sobre a família de modelos Claude da Anthropic.',
        palavrasChave: ['claude', 'anthropic', 'sonnet', 'haiku', 'opus', 'claude 3.5', 'product-self-knowledge'],
        diretrizes: `## 🤖 Conhecimento de Produtos Anthropic (Claude)

1. **Família Claude 3 e 3.5**:
   - **Claude 3.5 Sonnet**: Modelo topo de linha. Excelente em escrita criativa, raciocínio lógico complexo, análise de dados e geração de código de alta qualidade. Contexto de 200.000 tokens.
   - **Claude 3.5 Haiku**: Modelo ultrarrápido e altamente eficiente. Ideal para tarefas de baixa latência e subferramentas rápidas.
   - **Claude 3 Opus**: Forte em escrita acadêmica, nuance linguística e raciocínio profundo.

2. **Funcionalidades Especiais**:
   - **Artifacts**: Recurso onde trechos longos de código, SVGs, HTML ou layouts React são exibidos em uma aba lateral separada para iteração dinâmica.
   - **Tool Calling nativo**: Capacidade nativa altamente precisa para escolher e preencher parâmetros de ferramentas estruturadas em formato JSON.`
    },
    'skill-creator': {
        id: 'skill-creator',
        nome: 'Criador e Otimizador de Habilidades',
        descricao: 'Diretrizes sobre como formular novas regras de melhores práticas para uso da IA.',
        palavrasChave: ['criar skill', 'nova skill', 'adicionar skill', 'otimizar skill', 'skill-creator', 'habilidade'],
        diretrizes: `## 🛠️ Diretrizes para Criação e Otimização de Novas Skills

1. **Estrutura Padrão Recomendada**:
   - **Título Claro**: Identificando a especialidade técnica da skill.
   - **Regras de Ouro**: 3 a 5 pontos imperativos e práticos sobre o que Fazer e o que Não Fazer.
   - **Padrões Técnicos**: Padrões de código, bibliotecas ideais ou esquemas de cores.

2. **Tom e Concisão**:
   - O texto deve ser focado puramente em diretrizes técnicas diretas. Evite explicações teóricas longas.
   - Use marcadores visuais (bullets, numeração) para facilitar a indexação mental rápida da IA.`
    }
}
