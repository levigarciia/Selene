# Motor LFM3 Omni

O LFM3 Omni 2B exige suporte ausente nos motores oficiais fixados pela Selene.
O suporte foi incorporado ao llama.cpp no commit
`19ff817fb25e9a1b838b1d7f9f4325f7bf9779c4`, posterior à distribuição `b11938`.

Execute `bun scripts/prepararMotorLfm3.ts vulkan` no Windows com Visual Studio 2022 Build Tools e CMake instalados.
O script verifica o hash do código oficial e compila o servidor com carregamento dinâmico de backends.
O backend Vulkan vem do artefato oficial `12782471507`, da mesma revisão, com SHA 256 do pacote e da DLL
verificados antes da instalação em `%APPDATA%/Selene/runtime`. O download usa o espelho nightly.link;
artefatos de CI podem expirar. Falhas de download ou integridade impedem a publicação da instalação.
Os motores existentes são preservados. Use o argumento `cpu` para preparar a alternativa em CPU.

A Selene seleciona esse motor somente para LFM3 Omni 2B, com raciocínio desativado.
Automático, Vulkan e ROCm selecionam o motor Vulkan específico desse modelo. A escolha explícita de CPU
é respeitada. O motor ROCm específico ainda não está disponível. A interface mostra o backend efetivamente
carregado; a preferência ROCm não significa execução ROCm para este modelo. O catálogo inclui o projetor para imagens.
O script precisa ser executado novamente em outro computador. Vídeo não está integrado.

## Saída de voz

O projetor do catálogo inclui o gerador de áudio (`clip.has_gen_audio_encoder`), e o motor expõe `POST /tts`.
Com o LFM3 Omni carregado com projetor, cada resposta mostra o botão de ouvir. Quando o pedido foi falado,
a resposta é lida automaticamente ao terminar. O texto perde código e marcações Markdown, é dividido em trechos
de até 320 caracteres e o trecho seguinte é sintetizado enquanto o atual toca. A voz é a feminina do modelo;
o idioma alterna entre português e inglês por uma heurística simples. O WAV chega em PCM16 mono a 24 kHz com
tamanho indefinido no cabeçalho, corrigido no processo principal. Em CPU, 3,8 segundos de fala levaram 2,3 segundos.

O botão de anexos aceita arquivos de áudio de até 10 MB e 60 segundos nos modelos compatíveis.
O navegador converte os formatos que consegue decodificar para WAV PCM16 mono a 16 kHz.
A cópia gerenciada fica disponível para reprodução, reenvio e histórico depois de reiniciar.
O botão de microfone ao lado do anexo inicia a gravação. Um segundo clique encerra e prepara a prévia;
o botão de envio confirma a mensagem. A captura termina automaticamente aos 60 segundos e libera o
dispositivo. Trocar de conversa, modelo ou modo descarta a gravação em andamento e libera o microfone.
O aplicativo permite somente captura de áudio pela interface principal. Câmera e páginas externas continuam recusadas.
Sem texto digitado, a mensagem pede uma resposta ao pedido falado, em vez de descrever anexos genéricos.
Uma instrução digitada, como um pedido de transcrição, é preservada.
No OpenRouter, o modelo precisa declarar áudio entre as modalidades de entrada; cadastros antigos
precisam ser atualizados pelo catálogo para receber essa informação.

Validação real: `bun scripts/testarDesktop.ts scripts/validarAudio.ts`, com um áudio em
`artifacts/audio/voz.wav` (ou no caminho definido por `SELENE_TESTE_AUDIO`) dizendo em inglês que
o número secreto é sete. O teste usa uma pasta isolada e os pesos e o motor locais do LFM3 Omni.
Com `SELENE_TESTE_MICROFONE=1`, o teste verifica a permissão com um dispositivo simulado e fornece a frase
por um fluxo Web Audio controlado. O MediaRecorder, a normalização, o envio e a inferência são reais;
o teste não captura o microfone físico.
Use `SELENE_TESTE_URL=http://127.0.0.1:5173` com o servidor de desenvolvimento ativo para validar também
a permissão nesse modo. A comparação normaliza URLs, incluindo a barra final acrescentada pelo navegador.
Com `SELENE_TESTE_PERGUNTA=1`, use um áudio em português perguntando quanto é um mais um.
O teste envia a gravação sem texto digitado e verifica se a resposta contém dois.
As operações IPC e o campo histórico `imagens` mantêm os nomes antigos por compatibilidade;
o MIME distingue imagens e áudios, que são armazenados respectivamente como JPEG e WAV.

O controle de raciocínio mostra somente Desativado, conforme a capacidade oficial do modelo.
Os pedidos usam o parser DeepSeek para separar os marcadores emitidos pelo modelo, sem enviar
`reasoning_budget_tokens`: o valor zero força o servidor a inserir um fechamento de pensamento no texto.

Fonte: [alteração oficial do llama.cpp](https://github.com/ggml-org/llama.cpp/pull/31257).

## Desempenho local

`bun scripts/medirLfm3.ts` compara CPU e Vulkan com contexto de 4096, temperatura zero, o mesmo pedido e
256 tokens de saída, em três repetições por backend. Na RX 7700 XT, CPU mediu de 34,9 a 37,6 tokens/s e
Vulkan de 20,6 a 20,9 tokens/s, com todas as camadas solicitadas na GPU. Reduzir threads e desativar
offload de operações auxiliares não melhorou significativamente o Vulkan nesse teste.
Liberar GPU não garante ganho para esta arquitetura e este backend.

A previsão genérica por tamanho e largura de banda foi desabilitada para LFM3, pois não está calibrada
para sua arquitetura. Ela não deve prometer a faixa de 118 a 236 tokens/s para esse modelo.
O pacote ROCm da mesma revisão foi inspecionado, mas não carregou por faltar a dependência hipblas.dll;
nenhum resultado de velocidade ROCm foi validado.

## Controle de repetição

As respostas de texto do LFM3 local usam temperatura zero, conforme a recomendação oficial da Liquid AI.
Os demais modelos preservam a temperatura configurada. Isso não altera a amostragem da síntese de voz.

O leitor de streaming detecta sequências extensas repetidas em texto, raciocínio e argumentos de ferramentas.
Ao detectar um ciclo, cancela a leitura e descarta o conteúdo dessa tentativa antes de executar ferramentas.
O agente tenta novamente uma única vez. No Chat textual, reorganiza o histórico como referência, descrevendo os dados
dos componentes reconhecidos em vez de repetir o código OpenUI. O histórico salvo permanece intacto.
Uma segunda ocorrência encerra com erro explícito. A detecção inclui cópias OpenUI entre turnos e três parágrafos
longos semelhantes. É uma heurística conservadora, não uma garantia de qualidade das respostas.

As instruções com exemplos OpenUI são incluídas no Chat quando o pedido atual menciona uma interface,
respeitando recusas explícitas como não quero interfaces ou sem gráficos.
Pedidos isolados e explícitos para parar são atendidos pelo aplicativo, sem carregar pesos nem chamar o modelo.
Perguntas, citações e pedidos como criar um botão para parar continuam sendo enviados ao modelo.

Validação: `bun scripts/validarRepeticaoLfm3.ts` compara o contexto anterior com variações controladas,
usando os pesos reais e o motor em CPU. Captura o corpo JSON, a resposta SSE e, nos testes corrigidos,
o prompt retornado por `/apply-template`. Os dados são de uma reprodução isolada, sem importar conversas pessoais.
O aplicativo não passa a registrar o conteúdo das conversas em produção.

Use `bun scripts/validarRepeticaoLfm3.ts --somente-correcao --contexto-desktop` para verificar as proteções com
as categorias de ferramentas do desktop e memórias isoladas. Nesse teste, os dois pedidos para parar foram
atendidos pelo aplicativo e a escolha B recebeu B. Com o preparo preventivo do contexto, os seis cenários
concluíram sem ciclos: o pedido aritmético recebeu 3 + 3 = 6 e a escolha anterior B foi preservada.
O pedido vago Teste ainda produziu uma explicação pouco útil sobre a interface; a qualidade geral não foi corrigida.
A interface real em Vulkan não foi validada aqui.

### Contraprova entre implementações

O mesmo pedido reproduziu a cópia literal no motor original, no llama.cpp oficial `b12110`, com Q4 e Q8,
e na implementação oficial em Transformers `5.22.2`, Torch `2.15.0+cpu`, com os pesos BF16 originais.
O prompt aplicado e a resposta de Transformers coincidiram exatamente com os do motor original.
Isso confirma o comportamento do modelo nesse histórico, sem depender de uma falha exclusiva do motor antigo
ou da quantização Q4. Trocar somente o motor ou a precisão não resolveu a reprodução.

O LFM3 local agora recebe as interfaces antigas como dados de referência antes de gerar respostas textuais.
Cópias idênticas viram referências curtas, preservando as falas do usuário e as instruções de sistema.
O histórico salvo não é alterado. Outros modelos, chamadas de ferramentas e históricos com anexos mantêm
suas estruturas; pedidos explícitos de repetição conservam o conteúdo original para reapresentação.

`scripts/compararMotoresLfm3.ts` e `scripts/compararReferenciaLfm3.py` registram as contraprovas isoladas.
Os pacotes, pesos e o ambiente Python utilizados estão em pastas de teste; o motor usado pelo aplicativo foi mantido.
O teste de referência usou a revisão `21d75123f86c1f7ffb4bef1ea202710c4e7ebe67` do repositório oficial,
com SHA256 `76c0ec2c3e27832fb19f886d5eb0afe37f03c5c32c4a796a7ce08cef119d2763` para `model.safetensors`.

Fonte da amostragem: https://huggingface.co/LiquidAI/LFM3-Omni-2B-GGUF#how-to-run-lfm3-omni-2b

No ajuste automático, o LFM3 solicita contexto mínimo de 8192 tokens para acomodar instruções e ferramentas.
Se a alocação falhar por falta de memória, a tentativa seguinte reduz esse mínimo junto com o contexto solicitado.
A alteração passa a valer ao reiniciar a Selene e recarregar o modelo.
