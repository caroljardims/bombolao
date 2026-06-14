import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { useBolao } from '../contexts/BolaoContext'
import { getHoje } from '../lib/dates'
import { mergePartidasWithLiveScores } from '../lib/mergeScores'
import { partidasRef } from '../lib/paths'
import { useLiveScores } from './useLiveScores'
import type { Partida } from '../lib/types'

export function usePartidas() {
  const { bolaoId, bolao } = useBolao()
  const [partidasFirestore, setPartidasFirestore] = useState<Partida[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { scores, lastSync, sync } = useLiveScores(partidasFirestore)

  useEffect(() => {
    if (!bolaoId) return

    const q = query(partidasRef(bolaoId), orderBy('data', 'asc'), orderBy('hora', 'asc'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setPartidasFirestore(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Partida))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [bolaoId])

  const partidas = useMemo(
    () => mergePartidasWithLiveScores(partidasFirestore, scores),
    [partidasFirestore, scores],
  )

  const grouped = useMemo(() => {
    const groups = new Map<string, Partida[]>()
    for (const p of partidas) {
      const list = groups.get(p.data) ?? []
      list.push(p)
      groups.set(p.data, list)
    }
    return groups
  }, [partidas])

  const hoje = getHoje()
  const partidasHoje = partidas.filter((p) => p.data === hoje)

  return {
    partidas,
    grouped,
    partidasHoje,
    competicao: bolao?.competicao ?? '',
    loading,
    error,
    syncing: false,
    lastSync,
    syncScores: sync,
  }
}
