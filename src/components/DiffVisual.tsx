import type { LinhaDiff } from '../utils/diff'

type DiffVisualProps = {
  linhas: LinhaDiff[]
  carregando?: boolean
}

const classeLinha = (tipo: LinhaDiff['tipo']) => {
  if (tipo === 'adicao') return 'bg-emerald-500/10 text-emerald-100'
  if (tipo === 'remocao') return 'bg-red-500/10 text-red-100'
  return 'text-white/80'
}

const DiffVisual = ({ linhas, carregando }: DiffVisualProps) => {
  if (carregando) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white/70 text-sm bg-black/30 border border-white/10 rounded-xl">
        Corrigindo...
      </div>
    )
  }

  if (!linhas.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white/60 text-sm bg-black/30 border border-white/10 rounded-xl">
        Nada para mostrar ainda.
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-auto rounded-xl border border-white/10 bg-neutral-950/70">
      <div className="flex sticky top-0 bg-black/40 text-white/40 font-mono text-[11px] uppercase tracking-wide border-b border-white/5 z-10">
        <span className="w-12 text-center px-2 py-2">Orig.</span>
        <span className="w-12 text-center px-2 py-2">Novo</span>
        <span className="w-6 text-center px-2 py-2"> </span>
        <span className="flex-1 px-3 py-2 text-left">Conteúdo</span>
      </div>
      <div className="font-mono text-xs">
        {linhas.map((linha, indice) => (
          <div
            key={`${linha.tipo}-${indice}-${linha.linhaOriginal ?? 'x'}-${linha.linhaNova ?? 'y'}`}
            className={`flex items-start gap-2 px-2 py-1 border-b border-white/5 last:border-none ${classeLinha(linha.tipo)}`}
          >
            <span className="w-12 text-right pr-1 text-white/40">{linha.linhaOriginal ?? ''}</span>
            <span className="w-12 text-right pr-1 text-white/40">{linha.linhaNova ?? ''}</span>
            <span className="w-6 text-center text-white/50">
              {linha.tipo === 'adicao' ? '+' : linha.tipo === 'remocao' ? '-' : ''}
            </span>
            <span className="flex-1 whitespace-pre-wrap break-words leading-relaxed">
              {linha.partes ? (
                linha.partes.map((parte, idx) => (
                  <span
                    key={idx}
                    className={
                      parte.tipo === 'adicao'
                        ? 'bg-emerald-500/30 text-emerald-100 rounded-[2px] px-[1px]'
                        : parte.tipo === 'remocao'
                          ? 'bg-red-500/30 text-red-100 rounded-[2px] px-[1px]'
                          : ''
                    }
                  >
                    {parte.valor}
                  </span>
                ))
              ) : (
                linha.conteudo || ' '
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DiffVisual
