import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { esquemaConfiguracao, esquemaConversa } from '../shared/contratos';
import { obterFerramentas, prepararFerramenta } from '../electron/services/ferramentas';
import { Agente } from '../electron/services/agente';

const pastas: string[] = [];
afterEach(async () => {
    for (const pasta of pastas.splice(0)) await rm(pasta, { recursive: true, force: true });
});
async function ambiente() {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-patch-'));
    pastas.push(pasta);
    const conversa = esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Patch',
        modo: 'code',
        projeto: pasta,
        atualizadoEm: new Date().toISOString(),
    });
    const preparar = (corpo: string) =>
        prepararFerramenta('apply_patch', { patch: `*** Begin Patch\n${corpo}\n*** End Patch` }, conversa);
    return { pasta, conversa, preparar };
}
const sinal = () => new AbortController().signal;

test('o agente oferece patch ao modelo e respeita aprovação, recusa e acesso completo', async () => {
    for (const decisao of ['aprovar', 'recusar', 'completo'] as const) {
        const { pasta, conversa } = await ambiente();
        conversa.acessoCompleto = decisao === 'completo';
        let rodada = 0;
        let aprovacoes = 0;
        const agente = new Agente({
            salvar: async () => {},
            publicar: (mensagem) => {
                const acao = mensagem.acoes.at(-1);
                if (acao?.estado !== 'aguardando') return;
                aprovacoes += 1;
                agente.aprovar(acao.id, decisao === 'aprovar');
            },
            completar: async (corpo) => {
                expect(JSON.stringify(corpo)).toContain('apply_patch');
                const delta =
                    rodada++ === 0
                        ? {
                              tool_calls: [
                                  {
                                      index: 0,
                                      id: 'patch',
                                      function: {
                                          name: 'apply_patch',
                                          arguments: JSON.stringify({
                                              patch: '*** Begin Patch\n*** Add File: criado.txt\n+feito\n*** End Patch',
                                          }),
                                      },
                                  },
                              ],
                          }
                        : { content: 'Resultado final.' };
                const finish_reason = 'tool_calls' in delta ? 'tool_calls' : 'stop';
                return new Response(
                    `data: ${JSON.stringify({ choices: [{ delta, finish_reason }] })}\n\n` + 'data: [DONE]\n\n',
                );
            },
        });
        await agente.executar(conversa, 'Crie o arquivo', esquemaConfiguracao.parse({ contexto: 32768 }));
        expect(conversa.mensagens.at(-1)?.estado).toBe('concluida');
        expect(aprovacoes).toBe(decisao === 'completo' ? 0 : 1);
        if (decisao === 'recusar') await expect(readFile(join(pasta, 'criado.txt'))).rejects.toThrow();
        else expect(await readFile(join(pasta, 'criado.txt'), 'utf8')).toBe('feito\n');
    }
});

test('patch está disponível no Code e exige aprovação antes de editar, criar, excluir e mover', async () => {
    const { pasta, preparar } = await ambiente();
    expect(obterFerramentas('code', false).some((item) => item.function.name === 'apply_patch')).toBe(true);
    expect(obterFerramentas('chat', false).some((item) => item.function.name === 'apply_patch')).toBe(false);
    await writeFile(join(pasta, 'atual.txt'), 'cabeçalho\r\nantigo\r\nfim\r\n');
    await writeFile(join(pasta, 'apagar.txt'), 'remover');
    const acao = await preparar(
        [
            '*** Update File: atual.txt',
            '*** Move to: sub/novo.txt',
            '@@',
            ' cabeçalho',
            '-antigo',
            '+novo',
            ' fim',
            '*** Add File: criado.txt',
            '+criado',
            '*** Delete File: apagar.txt',
        ].join('\n'),
    );
    expect(acao.aprovacao).toBe(true);
    expect(await readFile(join(pasta, 'atual.txt'), 'utf8')).toContain('antigo');
    await acao.executar(sinal());
    expect(await readFile(join(pasta, 'sub/novo.txt'), 'utf8')).toBe('cabeçalho\r\nnovo\r\nfim\r\n');
    expect(await readFile(join(pasta, 'criado.txt'), 'utf8')).toBe('criado\n');
    await expect(readFile(join(pasta, 'atual.txt'))).rejects.toThrow();
    await expect(readFile(join(pasta, 'apagar.txt'))).rejects.toThrow();
});

test('valida o lote completo e rejeita trechos ambíguos, sintaxe inválida e sobrescrita por criação', async () => {
    const { pasta, preparar } = await ambiente();
    await writeFile(join(pasta, 'atual.txt'), 'igual\nigual\n');
    await expect(preparar('*** Add File: criado.txt\n+ok\n*** Update File: ausente.txt\n@@\n-a\n+b')).rejects.toThrow(
        'ausente',
    );
    await expect(readFile(join(pasta, 'criado.txt'))).rejects.toThrow();
    await expect(preparar('*** Update File: atual.txt\n@@\n-igual\n+novo')).rejects.toThrow('ambíguo');
    await expect(preparar('*** Add File: atual.txt\n+novo')).rejects.toThrow('já existe');
    await expect(preparar('*** Update File: atual.txt\nsem contexto')).rejects.toThrow('@@');
});

test('revalida alterações concorrentes e propaga cancelamento sem gravar', async () => {
    const { pasta, preparar } = await ambiente();
    await writeFile(join(pasta, 'atual.txt'), 'antigo');
    const acao = await preparar('*** Add File: criado.txt\n+ok\n*** Update File: atual.txt\n@@\n-antigo\n+novo');
    await writeFile(join(pasta, 'atual.txt'), 'concorrente');
    await expect(acao.executar(sinal())).rejects.toThrow('mudou');
    await expect(readFile(join(pasta, 'criado.txt'))).rejects.toThrow();
    const nova = await preparar('*** Add File: criado.txt\n+ok');
    const controle = new AbortController();
    controle.abort();
    await expect(nova.executar(controle.signal)).rejects.toThrow();
    await expect(readFile(join(pasta, 'criado.txt'))).rejects.toThrow();
});

test.skipIf(process.platform !== 'win32')(
    'rejeita criação duplicada com diferenças de maiúsculas no Windows',
    async () => {
        const { pasta, preparar } = await ambiente();
        await expect(preparar('*** Add File: novo.txt\n+primeiro\n*** Add File: NOVO.txt\n+segundo')).rejects.toThrow(
            'Cada caminho',
        );
        await expect(readFile(join(pasta, 'novo.txt'))).rejects.toThrow();
    },
);

test('impede escape por caminho relativo, absoluto, link e destino de renomeação', async () => {
    const { pasta, preparar } = await ambiente();
    const fora = await mkdtemp(join(tmpdir(), 'selene-fora-'));
    pastas.push(fora);
    await mkdir(join(pasta, 'sub'));
    await writeFile(join(pasta, 'atual.txt'), 'antigo');
    await symlink(fora, join(pasta, 'atalho'), process.platform === 'win32' ? 'junction' : 'dir');
    for (const caminho of ['../escape.txt', join(fora, 'novo.txt'), 'atalho/novo.txt']) {
        await expect(preparar(`*** Add File: ${caminho}\n+novo`)).rejects.toThrow('fora do projeto');
        await expect(
            preparar(`*** Update File: atual.txt\n*** Move to: ${caminho}\n@@\n-antigo\n+novo`),
        ).rejects.toThrow('fora do projeto');
    }
});

test('aplica vários trechos, contexto e marcador de fim preservando ausência de quebra final', async () => {
    const { pasta, preparar } = await ambiente();
    await writeFile(join(pasta, 'atual.txt'), 'função\num\nmeio\nfim');
    const acao = await preparar(
        ['*** Update File: atual.txt', '@@ função', '-um', '+dois', '@@', '-fim', '+final', '*** End of File'].join(
            '\n',
        ),
    );
    await acao.executar(sinal());
    expect(await readFile(join(pasta, 'atual.txt'), 'utf8')).toBe('função\ndois\nmeio\nfinal');
});
