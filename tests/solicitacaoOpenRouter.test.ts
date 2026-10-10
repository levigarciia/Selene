import { expect, test } from 'bun:test';
import { interpretarErroOpenRouter, solicitarOpenRouter } from '../electron/services/solicitacaoOpenRouter';

test('repete um 429 temporário respeitando Retry After e preservando a solicitação', async () => {
    const opcoes = { method: 'POST', body: 'mesmo modelo', signal: new AbortController().signal };
    const esperas: number[] = [];
    let chamadas = 0;
    const resposta = await solicitarOpenRouter(opcoes, {
        enviar: async (_url, parametros) => {
            expect(parametros).toBe(opcoes);
            chamadas++;
            return chamadas === 1
                ? Response.json(
                      { error: { message: 'Provider returned error' } },
                      {
                          status: 429,
                          headers: { 'Retry-After': '2' },
                      },
                  )
                : new Response('resposta');
        },
        aguardar: async (tempo) => {
            esperas.push(tempo);
        },
    });
    expect(await resposta.text()).toBe('resposta');
    expect(chamadas).toBe(2);
    expect(esperas).toEqual([2000]);
});

test('encerra após três solicitações quando o provedor continua limitado', async () => {
    let chamadas = 0;
    const esperas: number[] = [];
    await expect(
        solicitarOpenRouter(
            { signal: new AbortController().signal },
            {
                enviar: async () => {
                    chamadas++;
                    return Response.json({ error: { message: 'Rate limit exceeded' } }, { status: 429 });
                },
                aguardar: async (tempo) => {
                    esperas.push(tempo);
                },
            },
        ),
    ).rejects.toThrow('limite temporário');
    expect(chamadas).toBe(3);
    expect(esperas).toEqual([1000, 2000]);
});

test('não repete cota diária, chave inválida, saldo insuficiente ou espera longa', async () => {
    for (const [status, mensagem, cabecalhos] of [
        [429, 'Rate limit exceeded: free-models-per-day', {}],
        [401, 'Invalid key', {}],
        [402, 'Insufficient credits', {}],
        [429, 'Rate limit exceeded', { 'Retry-After': '60' }],
    ] as const) {
        let chamadas = 0;
        await expect(
            solicitarOpenRouter(
                { signal: new AbortController().signal },
                {
                    enviar: async () => {
                        chamadas++;
                        return Response.json({ error: { message: mensagem } }, { status, headers: cabecalhos });
                    },
                    aguardar: async () => {
                        throw new Error('Não deveria esperar');
                    },
                },
            ),
        ).rejects.toThrow('OpenRouter:');
        expect(chamadas).toBe(1);
    }
    expect(
        interpretarErroOpenRouter(429, {
            error: { message: 'Rate limit exceeded: free-models-per-day' },
        }).mensagem,
    ).toContain('limite diário');
});

test('cancelar durante a espera impede novo envio', async () => {
    const controle = new AbortController();
    let chamadas = 0;
    const promessa = solicitarOpenRouter(
        { signal: controle.signal },
        {
            enviar: async () => {
                chamadas++;
                return Response.json({ error: {} }, { status: 429, headers: { 'Retry-After': '30' } });
            },
            aguardar: async (_tempo, sinal) => {
                controle.abort(new Error('Cancelado'));
                sinal.throwIfAborted();
            },
        },
    );
    await expect(promessa).rejects.toThrow('Cancelado');
    expect(chamadas).toBe(1);
});

test('aceita data HTTP, reset da cota e corpo inválido sem expor o erro bruto', () => {
    const data = new Date(Date.now() + 10000).toUTCString();
    const falha = interpretarErroOpenRouter(429, undefined, new Headers({ 'Retry-After': data }));
    expect(falha.esperaMs).toBeGreaterThan(8000);
    expect(falha.esperaMs).toBeLessThanOrEqual(10000);
    const reset = interpretarErroOpenRouter(429, {
        error: { metadata: { headers: { 'X-RateLimit-Reset': String(Date.now() + 60000) } } },
    });
    expect(reset.esperaMs).toBeGreaterThan(59000);
    expect(interpretarErroOpenRouter(429, { error: { metadata: { raw: 'segredo' } } }).mensagem).not.toContain(
        'segredo',
    );
});
