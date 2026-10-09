import { CpuIcon } from '@phosphor-icons/react';
import type { CSSProperties } from 'react';
import type { FamiliaModelo } from '../../shared/catalogo';
import qwen from '../assets/modelos/qwen.svg';
import llama from '../assets/modelos/llama.svg';
import gemma from '../assets/modelos/gemma.svg';
import deepseek from '../assets/modelos/deepseek.svg';

const icones = { qwen, llama, gemma, deepseek };

/** Identifica a família do modelo nos controles e usa um símbolo neutro para arquivos desconhecidos. */
export function IconeModelo({
    familia,
    nome = '',
    tamanho = 18,
}: {
    familia?: FamiliaModelo;
    nome?: string;
    tamanho?: number;
}) {
    const identificada =
        familia ??
        (Object.keys(icones) as FamiliaModelo[]).find((chave) => nome.toLocaleLowerCase('pt-BR').includes(chave));
    if (!identificada) return <CpuIcon size={tamanho} aria-hidden="true" />;

    const estilo = {
        '--icone-modelo': `url("${icones[identificada]}")`,
        width: tamanho,
        height: tamanho,
    } as CSSProperties;
    return <span className={`icone-modelo familia-${identificada}`} style={estilo} aria-hidden="true" />;
}
