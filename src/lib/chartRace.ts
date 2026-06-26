import { useCallback, useEffect, useState } from 'react'

export const EVOLUTION_CHART = {
  H: 340,
  PAD: { top: 24, right: 52, bottom: 52, left: 40 },
  MIN_CHART_W: 808,
  STEP_WIDTH: 56,
  FLAG_W: 16,
  FLAG_H: 11,
  FLAG_GAP: 3,
  AVATAR_R: 14,
} as const

export function chartWidth(steps: number): number {
  if (steps <= 1) return EVOLUTION_CHART.MIN_CHART_W
  return Math.max(EVOLUTION_CHART.MIN_CHART_W, (steps - 1) * EVOLUTION_CHART.STEP_WIDTH)
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function lineHeadSeries(
  values: number[],
  playhead: number,
  xContinuous: (p: number) => number,
  yAt: (value: number) => number,
): { x: number; y: number; value: number } {
  const last = values.length - 1
  const p = Math.min(Math.max(playhead, 0), last)
  const i = Math.floor(p)
  const frac = p - i
  const valA = values[i]
  const valB = values[Math.min(i + 1, last)]
  return {
    x: xContinuous(p),
    y: lerp(yAt(valA), yAt(valB), frac),
    value: lerp(valA, valB, frac),
  }
}

export function partialPolylineSeries(
  values: number[],
  playhead: number,
  xIndex: (i: number) => number,
  xContinuous: (p: number) => number,
  yAt: (value: number) => number,
): string {
  const last = values.length - 1
  const p = Math.min(Math.max(playhead, 0), last)
  const maxI = Math.floor(p)
  const pts: string[] = []

  for (let i = 0; i <= maxI; i++) {
    pts.push(`${xIndex(i)},${yAt(values[i])}`)
  }

  const head = lineHeadSeries(values, playhead, xContinuous, yAt)
  pts.push(`${head.x},${head.y}`)
  return pts.join(' ')
}

export function niceAxisMax(value: number): number {
  if (value <= 0) return 10
  const step = value <= 25 ? 5 : value <= 60 ? 10 : value <= 120 ? 20 : 50
  return Math.ceil(value / step) * step
}

export function axisTicks(max: number): number[] {
  const step = max <= 25 ? 5 : max <= 60 ? 10 : max <= 120 ? 20 : 50
  const ticks: number[] = []
  for (let v = 0; v <= max; v += step) ticks.push(v)
  return ticks
}

export function useChartRacePlayhead(stepsKey: string, stepsLength: number) {
  const [playhead, setPlayhead] = useState(0)
  const [animDone, setAnimDone] = useState(false)
  const [replayKey, setReplayKey] = useState(0)

  const replay = useCallback(() => {
    setReplayKey((k) => k + 1)
  }, [])

  useEffect(() => {
    const maxP = Math.max(0, stepsLength - 1)
    setPlayhead(0)
    setAnimDone(false)

    if (stepsLength <= 1) {
      setPlayhead(maxP)
      setAnimDone(true)
      return
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setPlayhead(maxP)
      setAnimDone(true)
      return
    }

    const totalMs = Math.min(8000, Math.max(2800, stepsLength * 420))
    const start = performance.now()
    let raf = 0

    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / totalMs)
      const t = easeInOut(raw)
      setPlayhead(t * maxP)
      if (raw < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setPlayhead(maxP)
        setAnimDone(true)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [stepsKey, stepsLength, replayKey])

  return { playhead, animDone, replay, canReplay: stepsLength > 1 }
}
