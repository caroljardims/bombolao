const GOLDEN_ANGLE = 137.508

/** Cores vivas e bem separadas para linhas em fundo escuro. */
const CHART_PALETTE = [
  '#F4C63D',
  '#FF6B6B',
  '#4ECDC4',
  '#A78BFA',
  '#82E05A',
  '#5B9FEF',
  '#FF9F43',
  '#FF6B9D',
  '#22D3EE',
  '#A3E635',
  '#FB7185',
  '#818CF8',
  '#FBBF24',
  '#34D399',
  '#E879F9',
  '#38BDF8',
  '#F472B6',
  '#2DD4BF',
  '#C084FC',
  '#FACC15',
] as const

function hashId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function hslFromHash(h: number): string {
  const hue = (h * GOLDEN_ANGLE) % 360
  const sat = 74 + (h % 4) * 5
  const light = 57 + ((h >> 4) % 5) * 4
  return `hsl(${hue.toFixed(1)}, ${sat}%, ${light}%)`
}

/**
 * Atribui uma cor distinta por jogador, estável enquanto o elenco não muda.
 * Participantes já no bolão mantêm a cor ao entrar alguém novo (até esgotar a paleta).
 */
export function assignChartColors(participantIds: string[]): Map<string, string> {
  const sorted = [...participantIds].sort()
  const used = new Set<number>()
  const colors = new Map<string, string>()

  for (const id of sorted) {
    const h = hashId(id)
    let idx = Math.floor((h * GOLDEN_ANGLE) % CHART_PALETTE.length)
    let attempts = 0

    while (used.has(idx) && attempts < CHART_PALETTE.length) {
      idx = (idx + 1) % CHART_PALETTE.length
      attempts++
    }

    if (attempts < CHART_PALETTE.length) {
      used.add(idx)
      colors.set(id, CHART_PALETTE[idx])
    } else {
      colors.set(id, hslFromHash(h))
    }
  }

  return colors
}

/** Cor estável para um único jogador (ex.: legenda isolada). */
export function chartColorForParticipant(id: string): string {
  return assignChartColors([id]).get(id) ?? hslFromHash(hashId(id))
}
