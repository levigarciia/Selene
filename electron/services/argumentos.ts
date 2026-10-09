/** Interpreta argumentos de ferramenta emitidos por modelos locais, inclusive JSON informal. */
export function interpretarArgumentos(bruto: string): Record<string, unknown> {
    for (const candidato of listarCandidatos(bruto)) {
        const direto = lerObjeto(candidato);
        if (direto) return direto;
        const reparado = lerObjeto(repararJson(candidato));
        if (reparado) return reparado;
    }
    throw new Error(
        'Os argumentos da ferramenta não são um JSON de objeto válido. Envie um objeto com chaves entre aspas duplas.',
    );
}

/** Tenta interpretar argumentos incompletos ou informais sem lançar erro. */
export function tentarInterpretarArgumentos(bruto: string): Record<string, unknown> | null {
    try {
        return interpretarArgumentos(bruto);
    } catch {
        return null;
    }
}

function listarCandidatos(bruto: string): string[] {
    const texto = bruto.trim();
    if (!texto) return ['{}'];
    const semCerca = texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const candidatos = [texto, semCerca];
    const inicio = semCerca.indexOf('{');
    const fim = semCerca.lastIndexOf('}');
    if (inicio >= 0 && fim > inicio) candidatos.push(semCerca.slice(inicio, fim + 1));
    return [...new Set(candidatos)];
}

function lerObjeto(texto: string): Record<string, unknown> | null {
    try {
        const valor: unknown = JSON.parse(texto);
        if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor as Record<string, unknown>;
        return null;
    } catch {
        return null;
    }
}

function repararJson(texto: string): string {
    let saida = '';
    let i = 0;
    const pilha: Array<'obj' | 'arr'> = [];
    let esperaChave = false;
    const removerVirgulaPendente = () => {
        const cortado = saida.trimEnd();
        if (cortado.endsWith(',')) saida = cortado.slice(0, -1) + saida.slice(cortado.length);
    };
    while (i < texto.length) {
        const caractere = texto[i]!;
        if (caractere === '"' || caractere === "'") {
            const lido = lerString(texto, i);
            saida += JSON.stringify(lido.valor);
            i = lido.proximo;
            esperaChave = false;
            continue;
        }
        if (caractere === '{') {
            pilha.push('obj');
            esperaChave = true;
            saida += caractere;
            i += 1;
            continue;
        }
        if (caractere === '[') {
            pilha.push('arr');
            esperaChave = false;
            saida += caractere;
            i += 1;
            continue;
        }
        if (caractere === '}') {
            removerVirgulaPendente();
            pilha.pop();
            esperaChave = false;
            saida += caractere;
            i += 1;
            continue;
        }
        if (caractere === ']') {
            removerVirgulaPendente();
            pilha.pop();
            esperaChave = false;
            saida += caractere;
            i += 1;
            continue;
        }
        if (caractere === ',') {
            saida += caractere;
            i += 1;
            esperaChave = pilha.at(-1) === 'obj';
            continue;
        }
        if (caractere === ':') {
            esperaChave = false;
            saida += caractere;
            i += 1;
            continue;
        }
        if (/\s/.test(caractere)) {
            saida += caractere;
            i += 1;
            continue;
        }
        if (/[A-Za-z_]/.test(caractere)) {
            const inicio = i;
            i += 1;
            while (i < texto.length && /[A-Za-z0-9_]/.test(texto[i]!)) i += 1;
            const ident = texto.slice(inicio, i);
            if (esperaChave && pilha.at(-1) === 'obj') {
                saida += JSON.stringify(ident);
                continue;
            }
            const literais: Record<string, string> = {
                True: 'true',
                true: 'true',
                False: 'false',
                false: 'false',
                None: 'null',
                null: 'null',
            };
            saida += literais[ident] ?? JSON.stringify(ident);
            esperaChave = false;
            continue;
        }
        saida += caractere;
        i += 1;
    }
    return saida;
}

function lerString(texto: string, inicio: number): { valor: string; proximo: number } {
    const aspas = texto[inicio]!;
    let i = inicio + 1;
    let valor = '';
    while (i < texto.length) {
        const caractere = texto[i]!;
        if (caractere === '\\' && i + 1 < texto.length) {
            const proximo = texto[i + 1]!;
            if (proximo === 'u' && i + 5 < texto.length) {
                const codigo = Number.parseInt(texto.slice(i + 2, i + 6), 16);
                valor += Number.isFinite(codigo) ? String.fromCharCode(codigo) : texto.slice(i, i + 6);
                i += 6;
                continue;
            }
            const escapados: Record<string, string> = {
                n: '\n',
                r: '\r',
                t: '\t',
                b: '\b',
                f: '\f',
                '"': '"',
                "'": "'",
                '\\': '\\',
                '/': '/',
            };
            if (proximo in escapados) valor += escapados[proximo];
            else valor += `\\${proximo}`;
            i += 2;
            continue;
        }
        if (caractere === aspas) return { valor, proximo: i + 1 };
        valor += caractere;
        i += 1;
    }
    return { valor, proximo: i };
}
