import type { AcertoTipo } from '../lib/types'
import { ACERTO_STYLES } from '../lib/scoring'
import { Icon, Pill } from './ui'

interface AcertoBadgeProps {
  tipo: AcertoTipo
  pontos?: number | null
}

function toneForTipo(tipo: AcertoTipo): 'ok-soft' | 'gold-soft' | 'danger-soft' | 'muted' {
  if (tipo === 'mosca') return 'gold-soft'
  if (tipo === 'sem_aposta' || tipo === 'nada') return 'danger-soft'
  if (tipo === 'gol') return 'muted'
  return 'ok-soft'
}

export function AcertoBadge({ tipo, pontos }: AcertoBadgeProps) {
  const style = ACERTO_STYLES[tipo]
  const tone = toneForTipo(tipo)

  return (
    <Pill tone={tone}>
      {tipo !== 'sem_aposta' && tipo !== 'nada' && <Icon.check s={13} />}
      {style.label}
      {pontos !== null && pontos !== undefined && tipo !== 'sem_aposta' && ` +${pontos}`}
    </Pill>
  )
}
