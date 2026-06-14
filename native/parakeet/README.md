# Parakeet Local

Esta pasta documenta o runtime local do `Parakeet` usado pela Selene.

## Como funciona hoje

- O Electron sobe um sidecar Python gerado em tempo de execução por `electron/local-parakeet/ParakeetSidecarManager.ts`
- A inferência usa `onnx-asr` com `onnxruntime`
- O cache do Hugging Face fica em `userData/parakeet-models/hf-home`
- Os arquivos do modelo baixado ficam em `userData/parakeet-models/models`
- O modelo atual é `s0me-0ne/parakeet-tdt-0.6b-v3-onnx`

## Observações

- Esta integração é experimental
- O foco atual é uso multilingual com auto detecção, incluindo português e termos em inglês
- O runtime cria um ambiente Python local automaticamente no primeiro uso
