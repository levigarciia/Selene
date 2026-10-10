import { estimarCompatibilidade, type HardwareLocal } from './compatibilidadeModelo';

const larguraBandaGpu: Record<string, number> = {
    'rtx 5090': 1792,
    'rtx 5080': 960,
    'rtx 5070 ti': 896,
    'rtx 5070': 672,
    'rtx 5060 ti': 448,
    'rtx 5060': 256,
    'rtx 4090': 1008,
    'rtx 4080 super': 736,
    'rtx 4080': 717,
    'rtx 4070 ti super': 672,
    'rtx 4070 ti': 504,
    'rtx 4070 super': 504,
    'rtx 4070': 504,
    'rtx 4060 ti': 288,
    'rtx 4060': 272,
    'rtx 3090 ti': 1008,
    'rtx 3090': 936,
    'rtx 3080 ti': 912,
    'rtx 3080': 760,
    'rtx 3070 ti': 608,
    'rtx 3070': 448,
    'rtx 3060 ti': 448,
    'rtx 3060': 360,
    'rx 7900 xtx': 960,
    'rx 7900 xt': 800,
    'rx 7900 gre': 576,
    'rx 7800 xt': 624,
    'rx 7700 xt': 432,
    'rx 7600': 288,
    'rx 6950 xt': 576,
    'rx 6900 xt': 512,
    'rx 6800 xt': 512,
    'rx 6800': 512,
    'rx 6700 xt': 384,
    'rx 6600 xt': 256,
    'rx 6600': 224,
    'rx 9070 xt': 624,
    'rx 9070': 488,
    'rx 9060 xt': 322,
};
const placas = Object.keys(larguraBandaGpu).sort((primeira, segunda) => segunda.length - primeira.length);

/** Consulta a largura de banda nominal de placas desktop reconhecidas na referência local do Odysseus. */
export function larguraBandaDaGpu(nome: string): number | undefined {
    const normalizado = nome.toLowerCase().replace(/\s+/g, ' ').trim();
    if (/laptop|mobile|notebook|\bmax-q\b/i.test(normalizado)) return undefined;
    const placa = placas.find((placa) => normalizado.endsWith(placa));
    return placa ? larguraBandaGpu[placa] : undefined;
}

export type EstimativaVelocidade = {
    rotulo: string;
    detalhe: string;
    minimo?: number;
    maximo?: number;
};

/** Estima geração de texto de modelos densos, sem carregar pesos nem tratar a previsão como benchmark. */
export function estimarVelocidadeModelo({
    tamanho,
    hardware,
    contexto,
    projetor = 0,
    somenteCpu = false,
    camadasGpu,
    identificacao = '',
}: {
    tamanho: number;
    hardware?: HardwareLocal;
    contexto: number;
    projetor?: number;
    somenteCpu?: boolean;
    camadasGpu?: number;
    identificacao?: string;
}): EstimativaVelocidade {
    const memoria = estimarCompatibilidade(tamanho, hardware, contexto, projetor, somenteCpu || camadasGpu === 0);
    const indisponivel = (motivo: string): EstimativaVelocidade => ({
        rotulo: 'Estimativa indisponível',
        detalhe: `${motivo} ${memoria.detalhe}`,
    });
    if (!hardware) return indisponivel('Consulte o hardware para estimar tokens por segundo.');
    if (tamanho <= 0) return indisponivel('O tamanho dos pesos não está disponível.');
    if (/\bmoe\b|\b\d+b[- ]a\d+b\b|coder[- ]v2|mixtral/i.test(identificacao)) {
        return indisponivel('Modelos MoE precisam de informações dos parâmetros ativos para estimar velocidade.');
    }
    if (memoria.rotulo === 'Memória limitada') return indisponivel('A memória consultada pode não comportar o modelo.');
    const cpu = somenteCpu || camadasGpu === 0;
    if (!cpu && !hardware.gpu) return indisponivel('A GPU ainda não foi medida. Selecione CPU para estimar esse modo.');
    const bandaGpu = cpu ? undefined : larguraBandaDaGpu(hardware.gpu!.nome);
    if (!cpu && !bandaGpu) return indisponivel('A largura de banda desta GPU não consta na referência.');
    const pesosGb = tamanho / 1e9;
    const reserva = projetor + contexto * 256 * 1024;
    const capacidadeGpu = cpu ? 0 : Math.max(0, hardware.gpu!.memoria * 0.85 - reserva);
    const fracaoCpu = cpu ? 1 : Math.max(0, 1 - Math.min(1, capacidadeGpu / (tamanho * 1.15)));
    const bandaEfetiva = (bandaRam: number) =>
        cpu ? bandaRam : 1 / (fracaoCpu / bandaRam + (1 - fracaoCpu) / bandaGpu!);
    const manual = !cpu && camadasGpu !== undefined;
    const minimo = ((manual ? 20 : bandaEfetiva(20)) / pesosGb) * 0.3;
    const maximo = (bandaEfetiva(55) / pesosGb) * 0.6;
    const formatar = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: valor < 10 ? 1 : 0 });
    const modo = cpu ? 'CPU' : fracaoCpu > 0 ? 'GPU e RAM' : 'GPU';
    return {
        minimo,
        maximo,
        rotulo: `Estimado: ${formatar(minimo)} a ${formatar(maximo)} tokens/s`,
        detalhe:
            `Geração de texto em ${modo}. Faixa heurística, não medida. ` +
            (manual ? 'Camadas manuais: a faixa inclui o cenário conservador em CPU. ' : '') +
            'Considera o tamanho dos pesos e a largura de banda nominal da GPU; ' +
            'a RAM usa uma faixa genérica de 20 a 55 GB/s. Contexto, arquitetura e motor podem mudar a velocidade. ' +
            memoria.detalhe,
    };
}
