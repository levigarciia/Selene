/**
 * ModalConfiguracoes — wrapper modal para o SettingsPanel.
 * Usado na toolbar flutuante (App.tsx overlay).
 */

import { forwardRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SettingsPanel } from './SettingsPanel'
import type { UserProfile, Memory } from '../../hooks/useUserProfile'
import type { UseVoiceInputReturn } from '../../hooks/useVoiceInput'
import type { PerfilLatencia } from '../../services/ai/types'
import type { ConfiguracaoOverlayProativo, NivelIntervencaoOverlay } from '../../types/overlayProativo'

type ModalConfiguracoesProps = {
  aberto: boolean
  aoFechar: () => void
  apiKey: string
  geminiKey: string
  openRouterKey: string
  modeloOpenRouter: string
  modeloLmStudio: string
  baseUrlLmStudio: string
  perfilLatencia: PerfilLatencia
  aoAlterarApiKey: (valor: string) => void
  aoAlterarGeminiKey: (valor: string) => void
  aoAlterarOpenRouterKey: (valor: string) => void
  aoAlterarModeloOpenRouter: (valor: string) => void
  aoAlterarModeloLmStudio: (valor: string) => void
  aoAlterarBaseUrlLmStudio: (valor: string) => void
  aoAlterarPerfilLatencia: (valor: PerfilLatencia) => void
  atalhoGramatical: string
  atalhoScreenshot: string
  aoAlterarAtalho: (valor: string) => void
  aoAlterarAtalhoScreenshot: (valor: string) => void
  provedorAtivo: 'openai' | 'gemini' | 'openrouter' | 'lmstudio'
  aoAlterarProvedorAtivo: (valor: 'openai' | 'gemini' | 'openrouter' | 'lmstudio') => void
  overlayProativoConfig: ConfiguracaoOverlayProativo
  aoAlterarOverlayProativoHabilitado: (valor: boolean) => void
  aoAlterarOverlayProativoNivel: (valor: NivelIntervencaoOverlay) => void
  aoAlterarOverlayProativoSonecaAte: (valor: number | null) => void
  profile: UserProfile
  aoAlterarProfile: (profile: UserProfile) => void
  memories: Memory[]
  aoAdicionarMemoria: (content: string) => void
  aoRemoverMemoria: (id: string) => void
  voiceInput: UseVoiceInputReturn
}

const ModalConfiguracoes = forwardRef<HTMLDivElement, ModalConfiguracoesProps>(({
  aberto, aoFechar,
  apiKey, geminiKey, openRouterKey,
  modeloOpenRouter, modeloLmStudio, baseUrlLmStudio, perfilLatencia,
  aoAlterarApiKey, aoAlterarGeminiKey, aoAlterarOpenRouterKey,
  aoAlterarModeloOpenRouter, aoAlterarModeloLmStudio, aoAlterarBaseUrlLmStudio,
  aoAlterarPerfilLatencia,
  atalhoGramatical, atalhoScreenshot, aoAlterarAtalho, aoAlterarAtalhoScreenshot,
  provedorAtivo, aoAlterarProvedorAtivo,
  overlayProativoConfig, aoAlterarOverlayProativoHabilitado,
  aoAlterarOverlayProativoNivel, aoAlterarOverlayProativoSonecaAte,
  profile, aoAlterarProfile,
  memories, aoAdicionarMemoria, aoRemoverMemoria,
  voiceInput,
}, ref) => (
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
          className="relative w-full max-w-3xl min-h-[60vh] max-h-[85vh] overflow-hidden"
        >
          <SettingsPanel
            variant="modal"
            onClose={aoFechar}
            profile={profile}
            setProfile={aoAlterarProfile}
            memories={memories}
            addMemory={aoAdicionarMemoria}
            removeMemory={aoRemoverMemoria}
            apiKey={apiKey}
            setApiKey={aoAlterarApiKey}
            geminiKey={geminiKey}
            setGeminiKey={aoAlterarGeminiKey}
            openRouterKey={openRouterKey}
            setOpenRouterKey={aoAlterarOpenRouterKey}
            modeloOpenRouter={modeloOpenRouter}
            setModeloOpenRouter={aoAlterarModeloOpenRouter}
            modeloLmStudio={modeloLmStudio}
            setModeloLmStudio={aoAlterarModeloLmStudio}
            baseUrlLmStudio={baseUrlLmStudio}
            setBaseUrlLmStudio={aoAlterarBaseUrlLmStudio}
            perfilLatencia={perfilLatencia}
            setPerfilLatencia={aoAlterarPerfilLatencia}
            provedorAtivo={provedorAtivo}
            setProvedorAtivo={aoAlterarProvedorAtivo}
            overlayProativoConfig={overlayProativoConfig}
            setOverlayProativoHabilitado={aoAlterarOverlayProativoHabilitado}
            setOverlayProativoNivelIntervencao={aoAlterarOverlayProativoNivel}
            setOverlayProativoSonecaAte={aoAlterarOverlayProativoSonecaAte}
            atalhoGramatical={atalhoGramatical}
            setAtalhoGramatical={aoAlterarAtalho}
            atalhoScreenshot={atalhoScreenshot}
            setAtalhoScreenshot={aoAlterarAtalhoScreenshot}
            voiceInput={voiceInput}
          />
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
))

ModalConfiguracoes.displayName = 'ModalConfiguracoes'
export default ModalConfiguracoes
