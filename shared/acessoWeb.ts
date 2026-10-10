import { z } from 'zod';

export const esquemaConfiguracaoWeb = z.object({
    ativo: z.boolean(),
    porta: z.number().int().min(1024).max(65535),
    exigirChave: z.boolean().default(true),
});

export type ConfiguracaoWeb = z.infer<typeof esquemaConfiguracaoWeb>;
export type EntradaConfiguracaoWeb = z.input<typeof esquemaConfiguracaoWeb>;
export interface EstadoAcessoWeb extends ConfiguracaoWeb {
    enderecos: string[];
    chave: string;
    erro?: string;
}
