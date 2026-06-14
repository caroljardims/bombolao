import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { useBolao } from '../contexts/BolaoContext'
import { participanteDoc, palpitesRef } from '../lib/paths'
import type { Palpite, Partida } from '../lib/types'

export function usePalpites(participanteId: string | undefined, partidas: Partida[]) {
  const { bolaoId } = useBolao()
  const [palpites, setPalpites] = useState<Palpite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!participanteId || !bolaoId) {
      setPalpites([])
      setLoading(false)
      return
    }

    const q = query(
      palpitesRef(bolaoId),
      where('participante_id', '==', participanteId),
    )

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setPalpites(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Palpite),
        )
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [participanteId, bolaoId])

  const palpitesMap = useMemo(() => {
    const map = new Map<string, Palpite>()
    for (const p of palpites) map.set(p.partida_id, p)
    return map
  }, [palpites])

  const partidasMap = useMemo(() => {
    const map = new Map<string, Partida>()
    for (const p of partidas) map.set(p.id, p)
    return map
  }, [partidas])

  return { palpites, palpitesMap, partidasMap, loading, error }
}

export function useParticipante(participanteId: string | undefined) {
  const { bolaoId } = useBolao()
  const [nome, setNome] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!participanteId || !bolaoId) {
      setLoading(false)
      return
    }
    const unsubscribe = onSnapshot(participanteDoc(bolaoId, participanteId), (snap) => {
      setNome(snap.exists() ? (snap.data().nome as string) : 'Participante')
      setLoading(false)
    })
    return unsubscribe
  }, [participanteId, bolaoId])

  return { nome, loading }
}
