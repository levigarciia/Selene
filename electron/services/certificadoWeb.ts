import { readFile } from 'node:fs/promises';
import { X509Certificate } from 'node:crypto';
import { generate } from 'selfsigned';
import { gravarAtomico } from './arquivosSeguros';

/** Mantém um certificado local persistente para reconhecer o computador na primeira conexão HTTPS. */
export async function obterCertificadoWeb(arquivo: string, enderecos: string[]) {
    try {
        const salvo = JSON.parse(await readFile(arquivo, 'utf8'));
        const certificado = new X509Certificate(salvo.cert);
        if (
            Date.parse(certificado.validTo) > Date.now() + 86400000 &&
            enderecos.every((ip) => certificado.checkIP(ip))
        ) {
            return { key: salvo.key as string, cert: salvo.cert as string, impressao: certificado.fingerprint256 };
        }
    } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw new Error('Certificado local inválido. Preserve e remova o arquivo de certificado antes de renovar.');
        }
    }
    const dados = await generate([{ name: 'commonName', value: 'Selene local' }], {
        algorithm: 'sha256',
        keySize: 2048,
        extensions: [
            { name: 'basicConstraints', cA: false },
            { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
            { name: 'extKeyUsage', serverAuth: true },
            {
                name: 'subjectAltName',
                altNames: [{ type: 2, value: 'localhost' }, ...enderecos.map((ip) => ({ type: 7 as const, ip }))],
            },
        ],
    });
    await gravarAtomico(arquivo, JSON.stringify({ key: dados.private, cert: dados.cert }));
    return { key: dados.private, cert: dados.cert, impressao: new X509Certificate(dados.cert).fingerprint256 };
}
