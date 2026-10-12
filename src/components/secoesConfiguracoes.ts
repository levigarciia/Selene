import { BrainIcon, GearSixIcon, GlobeIcon, RobotIcon, StackIcon, type Icon } from '@phosphor-icons/react';

export type SecaoConfiguracoes = 'geral' | 'modelos' | 'provedores' | 'memoria' | 'web';

export const secoesConfiguracoes: ReadonlyArray<{ id: SecaoConfiguracoes; nome: string; Icone: Icon }> = [
    { id: 'geral', nome: 'Geral', Icone: GearSixIcon },
    { id: 'modelos', nome: 'Modelos', Icone: StackIcon },
    { id: 'provedores', nome: 'Provedores', Icone: RobotIcon },
    { id: 'memoria', nome: 'Memória', Icone: BrainIcon },
    { id: 'web', nome: 'Acesso web', Icone: GlobeIcon },
];

export const nomeSecao = (secao: SecaoConfiguracoes) => secoesConfiguracoes.find((item) => item.id === secao)!.nome;

export type ItemBusca = { id: string; titulo: string; secao: SecaoConfiguracoes; termos?: string };

/** Itens pesquisáveis; `id` é o atributo id da linha correspondente. */
export const itensBusca: ItemBusca[] = [
    { id: 'config-versao', titulo: 'Versão e atualizações', secao: 'geral', termos: 'update sobre' },
    { id: 'config-modelos', titulo: 'Modelos locais', secao: 'modelos', termos: 'gguf importar instalados' },
    { id: 'config-provedores', titulo: 'Provedores', secao: 'provedores', termos: 'chatgpt claude codex' },
    { id: 'config-motor', titulo: 'Motor', secao: 'provedores', termos: 'selene llama carregar' },
    { id: 'config-hardware', titulo: 'Hardware', secao: 'provedores', termos: 'gpu vram ram' },
    {
        id: 'config-processamento',
        titulo: 'Processamento',
        secao: 'provedores',
        termos: 'rocm vulkan cpu contexto camadas',
    },
    { id: 'config-temperatura', titulo: 'Temperatura', secao: 'provedores', termos: 'criatividade' },
    { id: 'config-instrucao', titulo: 'Instrução', secao: 'provedores', termos: 'prompt sistema' },
    { id: 'config-openrouter', titulo: 'Chave do OpenRouter', secao: 'provedores', termos: 'api key' },
    { id: 'config-memoria', titulo: 'Memória', secao: 'memoria', termos: 'lembrar aprender fatos' },
    { id: 'config-extracao-memoria', titulo: 'Extração gratuita', secao: 'memoria', termos: 'openrouter free' },
    { id: 'config-acesso', titulo: 'Acesso pelo celular', secao: 'web', termos: 'rede wifi' },
    { id: 'config-porta', titulo: 'Porta', secao: 'web' },
    { id: 'config-chave-web', titulo: 'Exigir chave de acesso', secao: 'web', termos: 'senha' },
];

const normalizar = (texto: string) =>
    texto
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();

export function buscarConfiguracoes(consulta: string): ItemBusca[] {
    const termos = normalizar(consulta).split(/\s+/).filter(Boolean);
    if (!termos.length) return [];
    return itensBusca.filter((item) => {
        const palavras = normalizar(`${item.titulo} ${nomeSecao(item.secao)} ${item.termos ?? ''}`).split(/\s+/);
        return termos.every((termo) => palavras.some((palavra) => palavra.startsWith(termo)));
    });
}
