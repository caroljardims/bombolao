import { useEffect, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { useBolao } from '../contexts/BolaoContext'
import { participantesRef } from '../lib/paths'
import type { Participante } from '../lib/types'

export function useRanking() {
  const { bolaoId } = useBolao()
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bolaoId) return

    const q = query(participantesRef(bolaoId), orderBy('posicao', 'asc'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setParticipantes(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Participante),
        )
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [bolaoId])

  return { participantes, loading, error }
}
