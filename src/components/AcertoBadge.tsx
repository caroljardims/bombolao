import type { AcertoTipo } from '../lib/types'
import { ACERTO_STYLES } from '../lib/scoring'

interface AcertoBadgeProps {
  tipo: AcertoTipo
  pontos?: number | null
  compact?: boolean
}

export function AcertoBadge({ tipo, pontos, compact = false }: AcertoBadgeProps) {
  const style = ACERTO_STYLES[tipo]

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${style.className}`}
    >
      <span>{style.emoji}</span>
      {!compact && <span>{style.label}</span>}
      {pontos !== null && pontos !== undefined && tipo !== 'sem_aposta' && (
        <span className="font-bold tabular-nums">+{pontos}</span>
      )}
    </span>
  )
}
