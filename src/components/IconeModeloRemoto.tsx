import { IconeModelo } from './IconeModelo';
import openai from '../assets/modelos/openai.svg';
import anthropic from '../assets/modelos/anthropic.svg';
import google from '../assets/modelos/google.svg';
import mistral from '../assets/modelos/mistral.svg';
import xai from '../assets/modelos/xai.svg';
import moonshot from '../assets/modelos/moonshot.svg';
import zai from '../assets/modelos/zai.svg';
import minimax from '../assets/modelos/minimax.svg';
import nvidia from '../assets/modelos/nvidia.svg';
import cohere from '../assets/modelos/cohere.svg';
import microsoft from '../assets/modelos/microsoft.svg';
import stepfun from '../assets/modelos/stepfun.svg';
import tencent from '../assets/modelos/tencent.svg';
import perplexity from '../assets/modelos/perplexity.svg';

const icones: Record<string, string> = {
    openai,
    anthropic,
    google,
    mistralai: mistral,
    'x-ai': xai,
    moonshotai: moonshot,
    'z-ai': zai,
    minimax,
    nvidia,
    cohere,
    microsoft,
    stepfun,
    tencent,
    perplexity,
};

/** Identifica os provedores remotos com ícones locais e preserva o símbolo neutro para nomes desconhecidos. */
export function IconeModeloRemoto({ id, nome, tamanho = 18 }: { id: string; nome: string; tamanho?: number }) {
    const icone = icones[id.split('/')[0]];
    if (!icone || /gemma|llama/i.test(nome)) return <IconeModelo nome={nome} tamanho={tamanho} />;
    return (
        <img
            src={icone}
            width={tamanho}
            height={tamanho}
            alt=""
            aria-hidden="true"
            className="shrink-0 brightness-0 invert opacity-80"
        />
    );
}
