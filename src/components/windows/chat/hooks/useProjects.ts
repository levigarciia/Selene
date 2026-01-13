// Hook for managing projects state and actions
import { useState, useCallback } from 'react'
import type { Project } from '../../../../types/project'
import { createProject as createProjectFn } from '../../../../types/project'
import { removeFileEmbeddings } from '../../../../services/ProjectContextService'

export function useProjects() {
    const [projects, setProjects] = useState<Project[]>(() => {
        const saved = localStorage.getItem('selene_projects')
        if (saved) {
            try {
                return JSON.parse(saved)
            } catch {
                return []
            }
        }
        return []
    })
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null)

    // Get active project
    const activeProject = projects.find(p => p.id === activeProjectId)

    // Create new project
    const addProject = useCallback((name: string) => {
        const newProject = createProjectFn(name)
        setProjects(prev => [...prev, newProject])
        setActiveProjectId(newProject.id)
        return newProject.id
    }, [])

    // Rename project
    const renameProject = useCallback((projectId: string, newName: string) => {
        setProjects(prev => prev.map(p => 
            p.id === projectId ? { ...p, name: newName, updatedAt: Date.now() } : p
        ))
    }, [])

    // Delete project (returns conversations that should be moved out)
    const deleteProject = useCallback((projectId: string) => {
        setProjects(prev => prev.filter(p => p.id !== projectId))
        if (activeProjectId === projectId) {
            setActiveProjectId(null)
        }
    }, [activeProjectId])

    // Add file to project
    const addFileToProject = useCallback((projectId: string, file: {
        id: string
        name: string
        type: 'pdf' | 'txt' | 'docx' | 'md' | 'other'
        size: number
        content: string
        addedAt: number
    }) => {
        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                return {
                    ...p,
                    files: [...p.files, file],
                    updatedAt: Date.now()
                }
            }
            return p
        }))
    }, [])

    // Remove file from project
    const removeFileFromProject = useCallback((projectId: string, fileId: string) => {
        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                return {
                    ...p,
                    files: p.files.filter(f => f.id !== fileId),
                    updatedAt: Date.now()
                }
            }
            return p
        }))
        // Clean embeddings
        removeFileEmbeddings(fileId).catch(err => 
            console.warn('[useProjects] Failed to clean embeddings:', err)
        )
    }, [])

    // Get project by id
    const getProject = useCallback((projectId: string) => {
        return projects.find(p => p.id === projectId)
    }, [projects])

    return {
        projects,
        setProjects,
        activeProjectId,
        setActiveProjectId,
        activeProject,
        addProject,
        renameProject,
        deleteProject,
        addFileToProject,
        removeFileFromProject,
        getProject,
    }
}
