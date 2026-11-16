const comandoInterrupcao = new RegExp(
    '^(?:(?:que isso|por favor)[,\\s]+)?(?:para|pare|interrompa|cancele)' +
        '(?:\\s+(?:de repetir|com isso|a resposta|a geracao))?(?:\\s+(?:agora|por favor))?$',
);

/** Reconhece comandos isolados de interrupção sem interpretar perguntas ou trechos citados como comandos. */
export function pedeInterrupcaoResposta(texto: string): boolean {
    const pedido = texto
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .trim()
        .replace(/[.!?,;:]+$/g, '')
        .trim();
    return comandoInterrupcao.test(pedido);
}
