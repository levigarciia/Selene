# Desempenho do Qwen3.5 9B

Medições em 9 de outubro de 2026, com Ryzen 7 7800X3D, Radeon RX 7700 XT de 12 GB,
32 GB de RAM e driver AMD 32.0.31041.1004. Mesmo GGUF Q4_K_M, contexto de 8192 tokens,
99 camadas na GPU e uma sequência por vez. Os pesos e o tamanho do contexto foram preservados.

## Comparação controlada

O teste nativo usou um prompt sintético fixo, temperatura zero, seed 42 e geração forçada de 128 tokens.
Cada configuração teve duas execuções após carregar o modelo. O cache de prompt foi desativado nesse teste.

| Configuração | Geração em tokens/s |
| :--- | :--- |
| Vulkan b11521 original | 11,94 e 11,85 |
| Vulkan com Flash Attention | 11,83 e 11,76 |
| Vulkan com cache Q8 | 11,92 e 12,15 |
| ROCm b10327 com Flash Attention | 55,40 e 54,58 |

O ganho médio de ROCm foi de aproximadamente 4,6 vezes. O motor que estava aberto antes dos testes
registrou 5,95 tokens/s em outro prompt. Esse valor não é a base da comparação controlada.

Uma segunda rodada com 256 tokens e três execuções confirmou aproximadamente 55 tokens/s em ROCm.
Cache Q8, número de threads, tamanho dos lotes e matrizes quantizadas forçadas não trouxeram ganho
consistente suficiente para justificar novos padrões. O cache permanece na precisão padrão do motor.

## Integração

A instalação própria da Selene usa o
[pacote oficial Radeon b10327](https://github.com/ggml-org/llama.cpp/releases/tag/b10327),
com tamanho e SHA 256 fixados. Essa distribuição inclui as bibliotecas necessárias para Windows.
CPU e Vulkan continuam na versão b11521. O aplicativo não depende de runtimes da Selene anterior.

No fluxo real de `MotorLocal.completar` e leitura SSE, três respostas de 256 tokens registraram
56,19, 53,75 e 55,23 tokens/s. Esse teste usou um prompt de chat próprio e não deve ser confundido
com a comparação nativa de prompt idêntico. Os tempos são os informados pelo motor e excluem
carregamento, processamento da entrada, aprovações e execução de ferramentas.

A Selene escolhe o dispositivo dedicado usando a enumeração do backend escolhido, ativa Flash Attention
em ROCm e reaproveita o prefixo do prompt nas conversas. Em processamento automático, uma falha de carga
ROCm permite tentar Vulkan. Em seleção explícita, a falha é exibida sem trocar o backend.
Dados antigos com o padrão Vulkan migram uma vez para Automático. Escolhas posteriores são preservadas.

As atualizações de texto pelo IPC são agrupadas em intervalos de 40 ms. O texto completo e os estados
de conclusão, erro e aprovação continuam publicados. Mensagens anteriores usam memoização na interface.
O indicador de tokens/s usa os tempos nativos, sem estimar tokens a partir de caracteres.

## Reproduzir

Com o GGUF e ambos os motores instalados nos dados da Selene:

```powershell
$env:SELENE_BENCH_PERFIS = 'vulkan-original,rocm-flash'
$env:SELENE_BENCH_TOKENS = '128'
$env:SELENE_BENCH_REPETICOES = '2'
bun scripts/medirMotor.ts
```

Para validar o motor integrado, cancelamento da carga, falha de inicialização e encerramento:

```powershell
$env:SELENE_TESTE_GGUF = "$env:APPDATA/SeleneRemake/models/qwen3.5-9b-q4.gguf"
$env:SELENE_TESTE_RUNTIME = "$env:APPDATA/SeleneRemake/runtime"
bun scripts/validarMotor.ts
```

Execute as comparações sem outra instância usando a GPU. Os resultados ficam em `artifacts`.
Velocidade varia com contexto utilizado, modelo, driver, temperatura da GPU e outros programas abertos.
As medições não estabelecem desempenho equivalente para outros computadores ou compatibilidade com todos os GGUF.
