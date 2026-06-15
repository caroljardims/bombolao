import { partidaAoVivo, temPlacar } from '../lib/scoring'
import type { Partida } from '../lib/types'
import { Pill } from './ui'

export function formatPlacar(partida: Partida): string | null {
  if (!temPlacar(partida)) return null
  return `${partida.gols_casa}×${partida.gols_fora}`
}

interface LiveTagProps {
  partida: Partida
}

/** Pill "Ao vivo" com placar atual quando disponível. */
export function LiveTag({ partida }: LiveTagProps) {
  if (!partidaAoVivo(partida)) return null
  const placar = formatPlacar(partida)
  return (
    <Pill tone="live" dot>
      Ao vivo{placar ? ` · ${placar}` : ''}
    </Pill>
  )
}
