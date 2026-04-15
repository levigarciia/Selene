import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderClosed, Plus } from 'lucide-react'
import type { Project } from '../../../../types/project'

interface SeletorProjetosChatProps {
    aberto: boolean
    projects: Project[]
    onClose: () => void
    onSelecionarProjeto: (projectId: string) => void
    onCriarProjeto: () => void
}

export const SeletorProjetosChat: React.FC<SeletorProjetosChatProps> = ({
    aberto,
    projects,
    onClose,
    onSelecionarProjeto,
    onCriarProjeto,
}) => {
    return (
        <AnimatePresence>
            {aberto && (
                <>
                    <motion.button
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 z-20"
                        aria-label="Fechar seletor de projetos"
                    />

                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="absolute right-36 top-14 z-30 w-[320px] rounded-3xl border border-white/[0.06] bg-[#121417] p-4 shadow-2xl"
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-white">Projetos recentes</p>
                                <p className="text-xs text-[#88909d]">Abra um projeto ou crie um novo contexto.</p>
                            </div>
                            <button
                                type="button"
                                onClick={onCriarProjeto}
                                className="flex h-8 items-center gap-2 rounded-xl bg-[#4b479f] px-3 text-xs font-medium text-white transition-colors hover:bg-[#5b57b0]"
                            >
                                <Plus size={13} />
                                Novo
                            </button>
                        </div>

                        <div className="space-y-2">
                            {projects.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-white/[0.06] px-3 py-4 text-sm text-[#808898]">
                                    Nenhum projeto encontrado.
                                </div>
                            )}

                            {projects.map((project) => (
                                <button
                                    key={project.id}
                                    type="button"
                                    onClick={() => onSelecionarProjeto(project.id)}
                                    className="w-full rounded-2xl border border-white/[0.05] bg-white/[0.03] px-3 py-3 text-left text-[#d6dbe5] transition-colors hover:bg-white/[0.06]"
                                >
                                    <div className="flex items-center gap-2">
                                        <FolderClosed size={15} className="text-[#f0c769]" />
                                        <span className="truncate text-[13px] font-medium">{project.name}</span>
                                    </div>
                                    <div className="mt-1 text-[11px] text-[#88909d]">
                                        {project.files.length} arquivo(s)
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
