type Elemento = { tipo: string; nome: string; editavel: boolean; habilitado: boolean };

function prioridade(elemento: Elemento): number {
    if (elemento.editavel) return 0;
    if (/ControlType\.(Button|Hyperlink|MenuItem|CheckBox|ComboBox|TabItem|ListItem|TreeItem):/.test(elemento.tipo)) return 1;
    if (/ControlType\.(Text|Window):/.test(elemento.tipo)) return 2;
    return 3;
}

/** Resume árvores grandes preservando primeiro campos editáveis e controles que permitem interação. */
export function selecionarElementosComputador<T extends Elemento>(elementos: T[], limite = 200): T[] {
    if (!Number.isInteger(limite) || limite < 1) throw new Error('O limite de elementos deve ser um inteiro positivo.');
    return [...elementos].sort((anterior, proximo) => prioridade(anterior) - prioridade(proximo)).slice(0, limite);
}
