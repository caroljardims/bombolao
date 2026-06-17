import wc2026 from '../data/competicoes/wc2026.json'
import type { CompeticaoId, PartidaDraft } from './types'

export interface CompeticaoTemplate {
  id: CompeticaoId
  nome: string
  competicao: string
  partidas: PartidaDraft[]
}

export const COMPETICOES: { id: CompeticaoId; label: string }[] = [
  { id: 'wc2026', label: 'Copa do Mundo 2026' },
]

const TEMPLATES: Record<CompeticaoId, CompeticaoTemplate> = {
  wc2026: wc2026 as CompeticaoTemplate,
}

export function getCompeticaoTemplate(id: CompeticaoId): CompeticaoTemplate {
  const template = TEMPLATES[id]
  if (!template) throw new Error(`Competição não encontrada: ${id}`)
  return {
    ...template,
    partidas: template.partidas.map((p) => ({ ...p })),
  }
}

export function isCompeticaoTemplateId(value: string): value is CompeticaoId {
  return value in TEMPLATES
}
