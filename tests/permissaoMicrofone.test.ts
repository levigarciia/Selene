import { expect, test } from 'bun:test';
import { permitirMicrofone } from '../shared/permissaoMicrofone';

test('somente a interface principal pode usar microfone, sem câmera ou outras permissões', () => {
    const url = 'file:///Selene/dist/index.html';
    expect(permitirMicrofone('media', true, url, url, ['audio'])).toBe(true);
    expect(permitirMicrofone('media', true, url, url, ['video'])).toBe(false);
    expect(permitirMicrofone('media', true, url, url, ['audio', 'video'])).toBe(false);
    expect(permitirMicrofone('media', false, url, url, ['audio'])).toBe(false);
    expect(permitirMicrofone('media', true, 'https://exemplo.com', url, ['audio'])).toBe(false);
    expect(permitirMicrofone('media', true, undefined, url, ['audio'])).toBe(false);
    expect(permitirMicrofone('geolocation', true, url, url, ['audio'])).toBe(false);
});

test('normaliza a barra final do endereço de desenvolvimento sem liberar outra origem ou documento', () => {
    const url = 'http://127.0.0.1:5173';
    expect(permitirMicrofone('media', true, `${url}/`, url, ['audio'])).toBe(true);
    for (const solicitante of ['http://localhost:5173/', 'http://127.0.0.1:5174/', `${url}/externa`,
        `${url}/?outra=1`, 'inválida']) {
        expect(permitirMicrofone('media', true, solicitante, url, ['audio'])).toBe(false);
    }
});
