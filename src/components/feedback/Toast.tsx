type ToastProps = {
  mensagem: string
  tipo?: 'info' | 'erro'
}

const Toast = ({ mensagem, tipo = 'info' }: ToastProps) => {
  const classes =
    tipo === 'erro'
      ? 'bg-red-500 text-white shadow-red-500/30'
      : 'bg-white text-neutral-900 shadow-white/30'

  return (
    <div className={`px-4 py-2 rounded-xl shadow-lg border border-white/10 text-sm ${classes}`}>
      {mensagem}
    </div>
  )
}

export default Toast
