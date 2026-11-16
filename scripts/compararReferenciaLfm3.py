import json
import os
import time
from pathlib import Path

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'

import torch
from transformers import AutoModelForMultimodalLM, AutoTokenizer

pasta = Path('artifacts/lfm3/transformers-modelo').resolve()
capturas = json.loads(Path('artifacts/lfm3/comparacao-motores.json').read_text(encoding='utf-8-sig'))
pedido = next(item['pedido'] for item in capturas if item['nome'] == 'repetição')
torch.set_num_threads(8)
torch.manual_seed(42)
print(json.dumps({
    'etapa': 'carregando', 'torch': torch.__version__, 'cpu': torch.backends.cpu.get_cpu_capability(),
}), flush=True)
modelo = AutoModelForMultimodalLM.from_pretrained(
    pasta, dtype=torch.bfloat16, device_map='cpu', trust_remote_code=True, local_files_only=True,
    attn_implementation='eager',
).eval()
tokenizador = AutoTokenizer.from_pretrained(pasta, trust_remote_code=True, local_files_only=True)
registros = []
cenarios = [
    ('aritmética', [{'role': 'user', 'content': 'Quanto é 2 + 2?'},
                    {'role': 'assistant', 'content': '4'}, {'role': 'user', 'content': 'Quanto é 3 + 3?'}]),
    ('repetição', pedido['messages']),
]
for nome, mensagens in cenarios:
    prompt = tokenizador.apply_chat_template(mensagens, tokenize=False, add_generation_prompt=True,
                                             enable_thinking=False)
    entradas = tokenizador(prompt, add_special_tokens=False, return_tensors='pt')
    inicio = time.monotonic()
    with torch.inference_mode():
        saida = modelo.generate(**entradas, max_new_tokens=128, do_sample=False, generation_mode='text')
    sequencias = saida.sequences if hasattr(saida, 'sequences') else saida
    texto = tokenizador.decode(sequencias[0, entradas['input_ids'].shape[1]:], skip_special_tokens=True)
    registro = {'cenario': nome, 'mensagens': mensagens, 'prompt': prompt, 'texto': texto,
                'tempo_segundos': time.monotonic() - inicio, 'dtype': 'bfloat16'}
    registros.append(registro)
    print(json.dumps(registro, ensure_ascii=False), flush=True)
    Path('artifacts/lfm3/comparacao-transformers.json').write_text(
        json.dumps(registros, ensure_ascii=False, indent=4), encoding='utf-8')
