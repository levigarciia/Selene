export type ParakeetModelName = 'tdt-0.6b-v3-multilingual'

export const MODELO_PARAKEET_PADRAO: ParakeetModelName = 'tdt-0.6b-v3-multilingual'

export const ORDEM_MODELOS_PARAKEET: ParakeetModelName[] = ['tdt-0.6b-v3-multilingual']

export const PARAKEET_MODEL_INFO: Record<
    ParakeetModelName,
    {
        label: string
        size: string
        quality: string
        speed: string
        description: string
        recommendedForPtBr?: boolean
    }
> = {
    'tdt-0.6b-v3-multilingual': {
        label: 'Parakeet TDT 0.6B v3 Multilingual INT8',
        size: '~950 MB',
        quality: 'Multilingual com auto detecção',
        speed: 'Local por blocos',
        description: 'Modelo Parakeet TDT v3 multilingual para português e termos em inglês no mesmo fluxo.',
        recommendedForPtBr: true
    }
}
