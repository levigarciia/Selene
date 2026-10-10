import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { validarUrlWeb } from '../../shared/web';

function enderecoPrivado(endereco: string): boolean {
    const normalizado = endereco.toLowerCase().replace(/^::ffff:/, '');
    if (isIP(normalizado) === 4) {
        const [a, b] = normalizado.split('.').map(Number);
        return (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            a >= 224 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 198 && [18, 19].includes(b))
        );
    }
    return normalizado === '::' || normalizado === '::1' || /^(fc|fd|fe[89ab])/.test(normalizado);
}

/** Restringe pesquisa e leitura a destinos públicos; interfaces locais pertencem ao navegador no modo Code. */
export async function validarDestinoPublico(valor: string): Promise<string> {
    const url = new URL(validarUrlWeb(valor));
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
        throw new Error('Use o navegador no modo Code para acessar interfaces locais.');
    }
    const enderecos = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true });
    if (!enderecos.length || enderecos.some((item) => enderecoPrivado(item.address))) {
        throw new Error('Pesquisa e leitura web aceitam somente destinos públicos.');
    }
    return url.href;
}
