import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { useBolao } from '../contexts/BolaoContext'
import { palpiteChaveDoc } from '../lib/paths'
import type { PalpiteChaveDoc } from '../lib/chavePalpite'

/** Palpite de chave do participante informado (snapshot ao vivo). */
export function usePalpiteChave(participanteId: string | undefined) {
  const { bolaoId } = useBolao()
  const [doc, setDoc] = useState<PalpiteChaveDoc | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!participanteId || !bolaoId) return
    const unsub = onSnapshot(
      palpiteChaveDoc(bolaoId, participanteId),
      (snap) => {
        setDoc(snap.exists() ? ({ ...(snap.data() as PalpiteChaveDoc) }) : null)
        setLoading(false)
      },
      () => {
        setDoc(null)
        setLoading(false)
      },
    )
    return unsub
  }, [participanteId, bolaoId])

  if (!participanteId || !bolaoId) return { doc: null, loading: false }
  return { doc, loading }
}
