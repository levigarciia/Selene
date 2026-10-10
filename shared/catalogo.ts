import type { Modelo } from './contratos';

export type FamiliaModelo = 'qwen' | 'llama' | 'gemma' | 'deepseek';
export type CapacidadeModelo = 'raciocinio' | 'ferramentas' | 'code';
export type ArquivoProjetor = { arquivo: string; tamanho: number; sha256: string };
export type ModeloCatalogo = {
    id: string;
    familia: FamiliaModelo;
    nome: string;
    descricao: string;
    repositorio: string;
    arquivo: string;
    revisao: string;
    tamanho: number;
    sha256: string;
    capacidades: CapacidadeModelo[];
    projetorVisual?: ArquivoProjetor;
};

export const catalogoModelos: ModeloCatalogo[] = [
    {
        id: 'qwen3.5-2b-q4',
        projetorVisual: {
            arquivo: 'mmproj-F16.gguf',
            tamanho: 668227264,
            sha256: '7035e9cb8d7c6a9681d07eef9a364783e86ea4cd73faab2eabb4f43a101830c7',
        },
        familia: 'qwen',
        nome: 'Qwen3.5 2B',
        repositorio: 'unsloth/Qwen3.5-2B-GGUF',
        arquivo: 'Qwen3.5-2B-Q4_K_M.gguf',
        revisao: 'f6d5376be1edb4d416d56da11e5397a961aca8ae',
        tamanho: 1280835840,
        sha256: 'aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223',
        descricao: 'Compacto para conversas e tarefas leves.',
        capacidades: ['raciocinio', 'ferramentas', 'code'],
    },
    {
        id: 'qwen3.5-4b-q4',
        projetorVisual: {
            arquivo: 'mmproj-F16.gguf',
            tamanho: 672423616,
            sha256: 'cd88edcf8d031894960bb0c9c5b9b7e1fea6ebee02b9f7ce925a00d12891f864',
        },
        familia: 'qwen',
        nome: 'Qwen3.5 4B',
        repositorio: 'unsloth/Qwen3.5-4B-GGUF',
        arquivo: 'Qwen3.5-4B-Q4_K_M.gguf',
        revisao: 'e87f176479d0855a907a41277aca2f8ee7a09523',
        tamanho: 2740937888,
        sha256: '00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4',
        descricao: 'Equilíbrio para português, escrita e código.',
        capacidades: ['raciocinio', 'ferramentas', 'code'],
    },
    {
        id: 'qwen3.5-9b-q4',
        projetorVisual: {
            arquivo: 'mmproj-F16.gguf',
            tamanho: 918166080,
            sha256: 'f70dc3509053962b0d0d3ee8a7eacebf5d60aa560cad78254ae8698516ae029f',
        },
        familia: 'qwen',
        nome: 'Qwen3.5 9B',
        repositorio: 'unsloth/Qwen3.5-9B-GGUF',
        arquivo: 'Qwen3.5-9B-Q4_K_M.gguf',
        revisao: '3885219b6810b007914f3a7950a8d1b469d598a5',
        tamanho: 5680522464,
        sha256: '03b74727a860a56338e042c4420bb3f04b2fec5734175f4cb9fa853daf52b7e8',
        descricao: 'Conversas, programação e tarefas mais exigentes.',
        capacidades: ['raciocinio', 'ferramentas', 'code'],
    },
    {
        id: 'qwen3-14b-q4',
        familia: 'qwen',
        nome: 'Qwen3 14B',
        repositorio: 'unsloth/Qwen3-14B-GGUF',
        arquivo: 'Qwen3-14B-Q4_K_M.gguf',
        revisao: 'a04a82c4739b3ef5fa6da7d10261db2c67dd1985',
        tamanho: 9001753984,
        sha256: '5eaa0870bd81ed3b58a630a271234cfa604e43ffb3a19cd68e54a80dd9d52a66',
        descricao: 'Mais capacidade para tarefas complexas.',
        capacidades: ['raciocinio', 'ferramentas', 'code'],
    },
    {
        id: 'llama-3.2-1b-q4',
        familia: 'llama',
        nome: 'Llama 3.2 1B',
        repositorio: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
        arquivo: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
        revisao: '067b946cf014b7c697f3654f621d577a3e3afd1c',
        tamanho: 807694464,
        sha256: '6f85a640a97cf2bf5b8e764087b1e83da0fdb51d7c9fab7d0fece9385611df83',
        descricao: 'Chat rápido em computadores com pouca memória.',
        capacidades: ['ferramentas'],
    },
    {
        id: 'llama-3.2-3b-q4',
        familia: 'llama',
        nome: 'Llama 3.2 3B',
        repositorio: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
        arquivo: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        revisao: '5ab33fa94d1d04e903623ae72c95d1696f09f9e8',
        tamanho: 2019377696,
        sha256: '6c1a2b41161032677be168d354123594c0e6e67d2b9227c84f296ad037c728ff',
        descricao: 'Conversas e instruções de uso geral.',
        capacidades: ['ferramentas'],
    },
    {
        id: 'gemma-3-1b-q4',
        familia: 'gemma',
        nome: 'Gemma 3 1B',
        repositorio: 'unsloth/gemma-3-1b-it-GGUF',
        arquivo: 'gemma-3-1b-it-Q4_K_M.gguf',
        revisao: 'f0b45be0aac41bd6a100a4b5734cad5f67255bfb',
        tamanho: 806058272,
        sha256: '8270790f3ab69fdfe860b7b64008d9a19986d8df7e407bb018184caa08798ebd',
        descricao: 'Respostas rápidas e tarefas curtas de texto.',
        capacidades: [],
    },
    {
        id: 'deepseek-r1-1.5b-q4',
        familia: 'deepseek',
        nome: 'DeepSeek R1 1.5B',
        repositorio: 'unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF',
        arquivo: 'DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
        revisao: '3cb4d15544a2a5e07439592b9a0965b6445fbd34',
        tamanho: 1117321312,
        sha256: 'f3bdf9cf31dee4b57ae4e455a1cb0d01b5c2c1b50d72d3112141c195506c2840',
        descricao: 'Raciocínio em um modelo compacto.',
        capacidades: ['raciocinio'],
    },
    {
        id: 'gemma-4-12b-q4',
        familia: 'gemma',
        nome: 'Gemma 4 12B',
        repositorio: 'unsloth/gemma-4-12b-it-GGUF',
        arquivo: 'gemma-4-12b-it-Q4_K_M.gguf',
        revisao: 'gemma4_unified_encoder_free',
        tamanho: 7598963788,
        sha256: '0a270ec9fe6b34f4a0d33992b6135117b484ebc4766ab76b51d4ae8c457e4c42',
        descricao: 'Multimodal unificado encoder-free com áudio e visão nativos.',
        capacidades: ['raciocinio', 'ferramentas', 'code'],
    },
    {
        id: 'bonsai-27b-q2',
        familia: 'qwen',
        nome: 'Ternary Bonsai 27B',
        repositorio: 'prism-ml/Ternary-Bonsai-27B-gguf',
        arquivo: 'Ternary-Bonsai-27B-Q2_0.gguf',
        revisao: 'qwen3.6_finetuned_ternary',
        tamanho: 7671675648,
        sha256: '868c11714cf8fe47f5ec9eeb2be0ab1a337112886f92ee0ede6b855c4fa31757',
        descricao: 'Versão Q2_0 fine-tuned do Qwen 3.6 27B com arquitetura ternária.',
        capacidades: ['raciocinio', 'ferramentas', 'code'],
        projetorVisual: {
            arquivo: 'Ternary-Bonsai-27B-mmproj-BF16.gguf',
            tamanho: 931000000,
            sha256: 'acaf5b55d24ebd38c71fa220dc58c9a36776ec543b17728a4b322fc8d92f1de4',
        },
    },
];

/** Identifica arquivos já disponíveis, incluindo importações com o nome e tamanho da edição do catálogo. */
export function encontrarModeloLocal(item: ModeloCatalogo, modelos: Modelo[]): Modelo | undefined {
    return modelos.find(
        (modelo) =>
            modelo.catalogoId === item.id ||
            (modelo.caminho.split(/[\\/]/).at(-1) === item.arquivo && modelo.tamanho === item.tamanho),
    );
}

/** Formata tamanhos de arquivo na mesma unidade usada em todo o catálogo. */
export function formatarTamanho(bytes: number): string {
    if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' MB';
    return (bytes / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' GB';
}
