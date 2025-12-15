import { forwardRef, useEffect, useState } from 'react'
import type React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { KeyRound, Settings2, Eye, EyeOff, X, MousePointerClick, Camera, PenSquare, User, Briefcase, Heart, Brain, Trash2 } from 'lucide-react'
import type { UserProfile, Memory } from '../hooks/useUserProfile'

type ModalConfiguracoesProps = {
  aberto: boolean
  aoFechar: () => void
  apiKey: string
  geminiKey: string
  openRouterKey: string
  modeloOpenRouter: string
  modeloLmStudio: string
  baseUrlLmStudio: string
  aoAlterarApiKey: (valor: string) => void
  aoAlterarGeminiKey: (valor: string) => void
  aoAlterarOpenRouterKey: (valor: string) => void
  aoAlterarModeloOpenRouter: (valor: string) => void
  aoAlterarModeloLmStudio: (valor: string) => void
  aoAlterarBaseUrlLmStudio: (valor: string) => void
  mostrarPreview: boolean
  aoAlternarPreview: (valor: boolean) => void
  atalhoGramatical: string
  atalhoScreenshot: string
  aoAlterarAtalho: (valor: string) => void
  aoAlterarAtalhoScreenshot: (valor: string) => void
  provedorAtivo: 'openai' | 'gemini' | 'openrouter' | 'lmstudio'
  aoAlterarProvedorAtivo: (valor: 'openai' | 'gemini' | 'openrouter' | 'lmstudio') => void
  // New profile props
  profile: UserProfile
  aoAlterarProfile: (profile: UserProfile) => void
  memories: Memory[]
  aoAdicionarMemoria: (content: string) => void
  aoRemoverMemoria: (id: string) => void
}

const ModalConfiguracoes = forwardRef<HTMLDivElement, ModalConfiguracoesProps>(({
  aberto,
  aoFechar,
  apiKey,
  geminiKey,
  openRouterKey,
  modeloOpenRouter,
  modeloLmStudio,
  baseUrlLmStudio,
  aoAlterarApiKey,
  aoAlterarGeminiKey,
  aoAlterarOpenRouterKey,
  aoAlterarModeloOpenRouter,
  aoAlterarModeloLmStudio,
  aoAlterarBaseUrlLmStudio,
  mostrarPreview,
  aoAlternarPreview,
  atalhoGramatical,
  atalhoScreenshot,
  aoAlterarAtalho,
  aoAlterarAtalhoScreenshot,
  provedorAtivo,
  aoAlterarProvedorAtivo,
  profile,
  aoAlterarProfile,
  memories,
  aoAdicionarMemoria,
  aoRemoverMemoria
}, ref) => {
  const abas = ['Perfil', 'Chaves API', 'Modelos', 'Memórias', 'Atalhos', 'Transcrição'] as const
  const [abaAtiva, setAbaAtiva] = useState<(typeof abas)[number]>('Perfil')
  const [capturandoAtalho, setCapturandoAtalho] = useState(false)
  const [previewAtalho, setPreviewAtalho] = useState(atalhoGramatical)
  const [capturandoAtalhoScreenshot, setCapturandoAtalhoScreenshot] = useState(false)
  const [previewAtalhoScreenshot, setPreviewAtalhoScreenshot] = useState(atalhoScreenshot)
  const [novaMemoria, setNovaMemoria] = useState('')

  useEffect(() => setPreviewAtalho(atalhoGramatical), [atalhoGramatical])
  useEffect(() => setPreviewAtalhoScreenshot(atalhoScreenshot), [atalhoScreenshot])

  const formatarAtalho = (teclas: string[]) => teclas.filter(Boolean).join('+')

  const montarAtalho = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    evento.preventDefault()
    evento.stopPropagation()

    if (evento.key === 'Escape') {
      return ''
    }

    const teclas: string[] = []
    if (evento.ctrlKey) teclas.push('Ctrl')
    if (evento.metaKey) teclas.push('Meta')
    if (evento.altKey) teclas.push('Alt')
    if (evento.shiftKey) teclas.push('Shift')

    const key = evento.key
    const especiais = ['Control', 'Meta', 'Alt', 'Shift']
    const ehBase = !especiais.includes(key)
    if (ehBase) {
      teclas.push(key.length === 1 ? key.toUpperCase() : key)
    }

    const limitado = teclas.slice(0, 4)
    if (!ehBase) return ''
    return formatarAtalho(limitado)
  }

  const handleKeyDownAtalho = (evento: React.KeyboardEvent<HTMLInputElement>, tipo: 'gramatical' | 'screenshot') => {
    const proximo = montarAtalho(evento)
    if (tipo === 'gramatical') {
      setPreviewAtalho(proximo)
      aoAlterarAtalho(proximo)
    } else {
      setPreviewAtalhoScreenshot(proximo)
      aoAlterarAtalhoScreenshot(proximo)
    }
  }

  const handleFocarAtalho = () => setCapturandoAtalho(true)
  const handleBlurAtalho = () => setCapturandoAtalho(false)
  const handleFocarAtalhoScreenshot = () => setCapturandoAtalhoScreenshot(true)
  const handleBlurAtalhoScreenshot = () => setCapturandoAtalhoScreenshot(false)

  const handleAdicionarMemoria = () => {
    if (novaMemoria.trim()) {
      aoAdicionarMemoria(novaMemoria.trim())
      setNovaMemoria('')
    }
  }

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          ref={ref}
          key="configuracoes-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[55] flex items-center justify-center p-6 pointer-events-auto"
          onPointerEnter={() => window.electronAPI?.setIgnoreMouseEvents(false)}
          onPointerLeave={() => window.electronAPI?.setIgnoreMouseEvents(true, { forward: true })}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur" onClick={aoFechar} />
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 160, damping: 18 }}
            className="relative min-h-[60vh] w-full max-w-4xl bg-neutral-900/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-[220px_1fr]"
          >
            <aside className="bg-black/30 border-r border-white/10 h-full flex flex-col">
              <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
                <div className="p-2 rounded-xl bg-white/10 border border-white/15 text-white">
                  <Settings2 size={18} />
                </div>
                <div>
                  <p className="text-xs text-white/50">Configurações</p>
                  <h2 className="text-sm font-semibold text-white">Preferências</h2>
                </div>
              </div>
              <nav className="flex-1 py-2 overflow-y-auto">
                {abas.map((aba) => {
                  const ativa = abaAtiva === aba
                  const icons: Record<string, React.ReactNode> = {
                    'Perfil': <User size={14} />,
                    'Chaves API': <KeyRound size={14} />,
                    'Modelos': <Settings2 size={14} />,
                    'Memórias': <Brain size={14} />,
                    'Atalhos': <PenSquare size={14} />,
                    'Transcrição': <Eye size={14} />
                  }
                  return (
                    <button
                      key={aba}
                      onClick={() => setAbaAtiva(aba)}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2 ${ativa
                        ? 'bg-white/10 text-white font-semibold border-l-2 border-white/60'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      {icons[aba]}
                      {aba}
                    </button>
                  )
                })}
              </nav>
              <div className="px-4 py-3 text-[11px] text-white/40 border-t border-white/10">
                Dica: presets agora ficam no menu Assistentes.
              </div>
            </aside>

            <div className="p-6 overflow-y-auto max-h-[80vh] space-y-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
              {/* Close button */}
              <button
                onClick={aoFechar}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>

              {abaAtiva === 'Perfil' && (
                <div className="space-y-6">
                  {/* Name */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-white pb-2 border-b border-white/5">
                      <User size={18} className="text-purple-300" />
                      <div>
                        <p className="text-sm font-semibold leading-tight">Como você quer ser chamado?</p>
                        <p className="text-xs text-white/60">A Selene usará esse nome para se referir a você.</p>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => aoAlterarProfile({ ...profile, name: e.target.value })}
                      placeholder="Seu nome ou apelido"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-400 placeholder-white/30"
                    />
                  </div>

                  {/* Occupation */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-white pb-2 border-b border-white/5">
                      <Briefcase size={18} className="text-blue-300" />
                      <div>
                        <p className="text-sm font-semibold leading-tight">Ocupação</p>
                        <p className="text-xs text-white/60">Com o que você trabalha ou estuda?</p>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={profile.occupation}
                      onChange={(e) => aoAlterarProfile({ ...profile, occupation: e.target.value })}
                      placeholder="Ex: Desenvolvedor de software, Designer, Estudante..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-400 placeholder-white/30"
                    />
                  </div>

                  {/* About Me */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-white pb-2 border-b border-white/5">
                      <Heart size={18} className="text-rose-300" />
                      <div>
                        <p className="text-sm font-semibold leading-tight">Mais sobre você</p>
                        <p className="text-xs text-white/60">Interesses, valores ou preferências a serem lembrados.</p>
                      </div>
                    </div>
                    <textarea
                      value={profile.aboutMe}
                      onChange={(e) => aoAlterarProfile({ ...profile, aboutMe: e.target.value })}
                      placeholder="Ex: Gosto de respostas diretas e objetivas. Prefiro exemplos práticos. Tenho interesse em tecnologia e música..."
                      rows={4}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-rose-400 placeholder-white/30 resize-none"
                    />
                  </div>
                </div>
              )}

              {abaAtiva === 'Memórias' && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center gap-2 text-white pb-2 border-b border-white/5">
                    <Brain size={18} className="text-emerald-300" />
                    <div>
                      <p className="text-sm font-semibold leading-tight">Memórias</p>
                      <p className="text-xs text-white/60">Informações que a Selene deve lembrar em todas as conversas.</p>
                    </div>
                  </div>

                  {/* Add Memory */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={novaMemoria}
                      onChange={(e) => setNovaMemoria(e.target.value)}
                      placeholder="Adicionar nova memória..."
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400 placeholder-white/30"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAdicionarMemoria()
                      }}
                    />
                    <button
                      onClick={handleAdicionarMemoria}
                      disabled={!novaMemoria.trim()}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      Adicionar
                    </button>
                  </div>

                  {/* Memories List */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {memories.length === 0 ? (
                      <p className="text-xs text-white/40 text-center py-4">Nenhuma memória salva ainda</p>
                    ) : (
                      memories.map((memory) => (
                        <div
                          key={memory.id}
                          className="flex items-start gap-3 p-3 bg-black/30 border border-white/5 rounded-xl group"
                        >
                          <p className="flex-1 text-sm text-white/80">{memory.content}</p>
                          <button
                            onClick={() => aoRemoverMemoria(memory.id)}
                            className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {abaAtiva === 'Chaves API' && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center gap-2 text-white pb-2 border-b border-white/5">
                    <KeyRound size={18} className="text-emerald-300" />
                    <div>
                      <p className="text-sm font-semibold leading-tight">Provedor Ativo & Chaves</p>
                      <p className="text-xs text-white/60">Selecione qual IA a Selene deve usar prioritariamente.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {([
                      { id: 'openai', label: 'OpenAI' },
                      { id: 'gemini', label: 'Gemini' },
                      { id: 'openrouter', label: 'OpenRouter' },
                      { id: 'lmstudio', label: 'LM Studio' }
                    ] as const).map((prov) => (
                      <button
                        key={prov.id}
                        onClick={() => aoAlterarProvedorAtivo(prov.id)}
                        className={`flex items-center justify-center p-2 rounded-xl border text-xs font-semibold transition-all ${provedorAtivo === prov.id
                          ? 'bg-purple-500/20 border-purple-500/50 text-white shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                          : 'bg-black/20 border-white/10 text-white/50 hover:bg-white/5'
                          }`}
                      >
                        {prov.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="flex flex-col gap-1 text-sm text-white/70">
                      OpenAI API Key
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => aoAlterarApiKey(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-400"
                        placeholder="sk-..."
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-white/70">
                      Gemini API Key
                      <input
                        type="password"
                        value={geminiKey}
                        onChange={(e) => aoAlterarGeminiKey(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                        placeholder="AIza..."
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-white/70 md:col-span-2">
                      OpenRouter API Key
                      <input
                        type="password"
                        value={openRouterKey}
                        onChange={(e) => aoAlterarOpenRouterKey(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
                        placeholder="sk-or-..."
                      />
                    </label>
                  </div>
                </div>
              )}

              {abaAtiva === 'Modelos' && (
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-white">
                      <Settings2 size={18} className="text-indigo-300" />
                      <div>
                        <p className="text-sm font-semibold leading-tight">OpenRouter</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 text-sm text-white/70">
                      Modelo preferido
                      <input
                        type="text"
                        value={modeloOpenRouter}
                        onChange={(e) => aoAlterarModeloOpenRouter(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
                        placeholder="ex: openai/gpt-4o ou google/gemini-2.0-flash-exp:free"
                      />
                      <p className="text-xs text-white/50">Se o modelo não suportar imagem, redirecionamos automaticamente para gemini-2.0-flash no OpenRouter.</p>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-white">
                      <Settings2 size={18} className="text-emerald-300" />
                      <div>
                        <p className="text-sm font-semibold leading-tight">LM Studio</p>
                        <p className="text-xs text-white/60">Servidor local via LM Studio.</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 text-sm text-white/70">
                      Modelo
                      <input
                        type="text"
                        value={modeloLmStudio}
                        onChange={(e) => aoAlterarModeloLmStudio(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                        placeholder="ex: local-model-id"
                      />
                    </div>

                    <div className="flex flex-col gap-1 text-sm text-white/70">
                      Endpoint
                      <input
                        type="text"
                        value={baseUrlLmStudio}
                        onChange={(e) => aoAlterarBaseUrlLmStudio(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                        placeholder="ex: http://localhost:1234/v1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {abaAtiva === 'Transcrição' && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Preview na tela</p>
                      <p className="text-xs text-white/60">Controle se a transcrição fica visível no modal flutuante.</p>
                    </div>
                    <button
                      onClick={() => aoAlternarPreview(!mostrarPreview)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors ${mostrarPreview
                        ? 'bg-emerald-500/20 border-emerald-400/40 text-white'
                        : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                        }`}
                    >
                      {mostrarPreview ? <Eye size={16} /> : <EyeOff size={16} />}
                      {mostrarPreview ? 'Preview ligado' : 'Preview escondido'}
                    </button>
                  </div>
                  <p className="text-xs text-white/50">A transcrição é exibida no FloatingModal; tokens são economizados acelerando áudio a 2x.</p>
                </div>
              )}

              {abaAtiva === 'Atalhos' && (
                <div className="space-y-4">
                  {[{
                    titulo: 'Atalho do assistente gramatical',
                    descricao: 'Clique no campo e pressione até 4 teclas; aplicado imediatamente.',
                    icone: <PenSquare size={16} className="text-emerald-300" />,
                    atual: previewAtalho,
                    capturando: capturandoAtalho,
                    onFocus: handleFocarAtalho,
                    onBlur: handleBlurAtalho,
                    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDownAtalho(e, 'gramatical'),
                    placeholder: 'Ctrl+Alt+X'
                  }, {
                    titulo: 'Atalho de screenshot (pergunta com imagem)',
                    descricao: 'Clique no campo e pressione até 4 teclas.',
                    icone: <Camera size={16} className="text-emerald-300" />,
                    atual: previewAtalhoScreenshot,
                    capturando: capturandoAtalhoScreenshot,
                    onFocus: handleFocarAtalhoScreenshot,
                    onBlur: handleBlurAtalhoScreenshot,
                    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDownAtalho(e, 'screenshot'),
                    placeholder: 'Ctrl+Alt+S'
                  }].map((atalho, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            {atalho.icone}
                            <p className="text-sm font-semibold text-white">{atalho.titulo}</p>
                          </div>
                          <p className="text-xs text-white/60">{atalho.descricao}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-white/50">
                          <MousePointerClick size={14} /> Clique e pressione
                        </div>
                      </div>
                      <div className="text-xs text-white/60">
                        Atalho atual:{' '}
                        <span className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-white/80">
                          {atalho.atual || 'não configurado'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          value={atalho.atual}
                          onFocus={atalho.onFocus}
                          onBlur={atalho.onBlur}
                          onKeyDown={atalho.onKeyDown}
                          readOnly
                          className={`w-full bg-black/40 border rounded-xl px-3 py-2 text-sm text-white outline-none ${atalho.capturando ? 'border-emerald-400' : 'border-white/10 focus:border-purple-400'}`}
                          placeholder={atalho.placeholder}
                        />
                        <div className={`px-3 py-2 rounded-xl text-xs ${atalho.capturando ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-100' : 'bg-white/5 border border-white/10 text-white/60'}`}>
                          {atalho.capturando ? 'Capturando…' : 'Pronto'}
                        </div>
                      </div>
                      <p className="text-xs text-white/50">Escape limpa, máximo de 4 teclas combinadas.</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

ModalConfiguracoes.displayName = 'ModalConfiguracoes'

export default ModalConfiguracoes
