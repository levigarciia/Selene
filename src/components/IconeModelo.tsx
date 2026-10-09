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
    return (
        <span
            data-ui={`icone-modelo familia-${identificada}`}
            className={[
                'inline-block shrink-0 bg-current [mask:var(--icone-modelo)_center_/_contain_no-repeat]',
                identificada === 'qwen'
                    ? '[&&]:text-[#b5a7e8]'
                    : identificada === 'llama'
                      ? '[&&]:text-[#97b9ed]'
                      : identificada === 'gemma'
                        ? '[&&]:text-[#b9c8df]'
                        : '[&&]:text-[#a0c5db]',
            ].join(' ')}
            style={estilo}
            aria-hidden="true"
        />
    );
}
