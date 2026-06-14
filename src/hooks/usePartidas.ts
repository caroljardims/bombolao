import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { useBolao } from '../contexts/BolaoContext'
import { getHoje } from '../lib/dates'
import { partidasRef } from '../lib/paths'
import type { Partida } from '../lib/types'

export function usePartidas() {
  const { bolaoId, bolao } = useBolao()
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bolaoId) return

    const q = query(partidasRef(bolaoId), orderBy('data', 'asc'), orderBy('hora', 'asc'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setPartidas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Partida))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [bolaoId])

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
  }
}
