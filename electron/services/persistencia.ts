import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { esquemaDados, type Dados } from '../../shared/contratos';
import { reunirRegistrosUso } from '../../shared/estatisticas';
import { migrarProjetos } from './projetos';

/** Mantém os dados pessoais em arquivo validado, com gravações atômicas e sequenciais. */
export class Persistencia {
    dados: Dados = esquemaDados.parse({ versao: 1, configuracao: {}, modelos: [], conversas: [] });
    private fila: Promise<void> = Promise.resolve();

    constructor(private readonly pasta: string) {}

    async abrir(): Promise<void> {
        await mkdir(this.pasta, { recursive: true });
        try {
            const texto = await readFile(join(this.pasta, 'selene.json'), 'utf8');
            const bruto = JSON.parse(texto);
            if (bruto.perfilMotor === undefined && bruto.configuracao?.backend === 'vulkan') {
                bruto.configuracao.backend = 'auto';
            }
            this.dados = esquemaDados.parse(bruto);
            if (bruto.projetos === undefined) migrarProjetos(this.dados);
            for (const conversa of this.dados.conversas) {
                if (conversa.modo === 'chat') conversa.acessoCompleto = false;
                for (const mensagem of conversa.mensagens) {
                    delete mensagem.faseContexto;
                    if (mensagem.estado === 'gerando') mensagem.estado = 'interrompida';
                    for (const acao of mensagem.acoes) {
                        if (['preparando', 'aguardando', 'executando'].includes(acao.estado)) {
                            acao.estado = 'interrompida';
                        }
                    }
                }
            }
            this.dados.registrosUso = reunirRegistrosUso(this.dados);
        } catch (erro) {
            if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw new Error('Não foi possível ler os dados locais. O arquivo original foi preservado.', {
                    cause: erro,
                });
            }
        }
    }

    salvar(): Promise<void> {
        this.dados.registrosUso = reunirRegistrosUso(this.dados);
        const texto = JSON.stringify(esquemaDados.parse(this.dados), null, 4);
        const gravar = async () => {
            const temporario = join(this.pasta, 'selene.json.tmp');
            await writeFile(temporario, texto, 'utf8');
            await rename(temporario, join(this.pasta, 'selene.json'));
        };
        const proxima = this.fila.then(gravar, gravar);
        this.fila = proxima;
        return proxima;
    }
}
