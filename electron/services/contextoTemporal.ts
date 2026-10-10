/** Fornece a data do computador para resolver hoje, ontem e datas relativas no contexto do modelo. */
export function criarContextoTemporal(
    agora = new Date(),
    fuso = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
    if (!Number.isFinite(agora.getTime())) throw new Error('Data local inválida.');
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: fuso,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(agora);
    const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)!.value;
    const data = `${valor('year')}-${valor('month')}-${valor('day')}`;
    const legivel = new Intl.DateTimeFormat('pt-BR', {
        timeZone: fuso,
        dateStyle: 'full',
    }).format(agora);
    const deslocamento = new Intl.DateTimeFormat('pt-BR', {
        timeZone: fuso,
        timeZoneName: 'longOffset',
    })
        .formatToParts(agora)
        .find((parte) => parte.type === 'timeZoneName')!.value;
    return (
        `Data atual do usuário: ${data} (${legivel}). Fuso horário do computador: ${fuso} (${deslocamento}). ` +
        'Use esta data como referência para hoje, ontem e datas relativas. ' +
        'Datas antigas no histórico ou em fontes não alteram a data atual. ' +
        'A data atual não implica conhecimento atualizado; verifique informações recentes quando necessário.'
    );
}
