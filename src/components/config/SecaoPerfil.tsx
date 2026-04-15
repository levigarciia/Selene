/**
 * Seção de perfil — identidade e foto.
 * Layout em linhas, sem cards.
 */

import React, { useRef } from 'react'
import { Upload, Trash2 } from 'lucide-react'
import { CabecalhoGrupo, Divisor, LinhaConfig, classeInput } from './ComponentesConfig'
import type { UserProfile } from '../../hooks/useUserProfile'

interface SecaoPerfilProps {
    profile: UserProfile
    setProfile: (profile: UserProfile) => void
}

export const SecaoPerfil: React.FC<SecaoPerfilProps> = ({ profile, setProfile }) => {
    const inputRef = useRef<HTMLInputElement | null>(null)

    const iniciais = (profile.name || 'S')
        .trim().split(/\s+/).slice(0, 2)
        .map((p) => p[0]?.toUpperCase()).join('')

    const selecionarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        const arquivo = e.target.files?.[0]
        if (!arquivo) return
        const reader = new FileReader()
        reader.onload = () => {
            if (typeof reader.result === 'string') setProfile({ ...profile, fotoPerfil: reader.result })
        }
        reader.readAsDataURL(arquivo)
        e.target.value = ''
    }

    return (
        <>
            <CabecalhoGrupo titulo="Foto do perfil" />

            <div className="flex items-center gap-5 py-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.06] bg-[#13161d] text-lg font-semibold text-[#cdd4e0]">
                    {profile.fotoPerfil
                        ? <img src={profile.fotoPerfil} alt="Perfil" className="h-full w-full object-cover" />
                        : iniciais}
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => inputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-[#9ca3b2] transition-colors hover:bg-white/[0.03] hover:text-[#cdd4e0]">
                        <Upload size={12} /> Enviar
                    </button>
                    {profile.fotoPerfil && (
                        <button type="button" onClick={() => setProfile({ ...profile, fotoPerfil: '' })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#3d2028] px-3 py-1.5 text-xs text-[#c4808f] transition-colors hover:bg-[#1f1318]">
                            <Trash2 size={12} /> Remover
                        </button>
                    )}
                </div>
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={selecionarFoto} />
            </div>

            <CabecalhoGrupo titulo="Identidade" />

            <LinhaConfig titulo="Nome" vertical>
                <input type="text" value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Seu nome ou apelido" className={classeInput} />
            </LinhaConfig>
            <Divisor />

            <LinhaConfig titulo="Ocupação" vertical>
                <input type="text" value={profile.occupation}
                    onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                    placeholder="Ex: Desenvolvedor, designer…" className={classeInput} />
            </LinhaConfig>
            <Divisor />

            <LinhaConfig titulo="Sobre você" descricao="Preferências, contexto e forma de receber ajuda." vertical>
                <textarea value={profile.aboutMe}
                    onChange={(e) => setProfile({ ...profile, aboutMe: e.target.value })}
                    placeholder="Ex: Prefiro respostas diretas e exemplos práticos."
                    rows={4} className={`${classeInput} resize-none`} />
            </LinhaConfig>
        </>
    )
}
