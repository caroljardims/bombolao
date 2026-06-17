import { useEffect, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { syncLegacyMemberships } from '../lib/linkParticipante'
import { syncPhotoToParticipantes } from '../lib/profile'
import { membrosiasRef } from '../lib/paths'
import type { Membrosia } from '../lib/types'

export function useMembrosias() {
  const { user } = useAuth()
  const [membrosias, setMembrosias] = useState<Membrosia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setMembrosias([])
      setLoading(false)
      return
    }

    if (user.email) {
      syncLegacyMemberships(user.uid, user.email, user.displayName ?? undefined).catch(() => {
        /* sem conta legada ou permissão */
      })
    }

    if (user.photoURL) {
      syncPhotoToParticipantes(user.uid, user.email, user.photoURL).catch(() => {
        /* sync best-effort */
      })
    }

    const q = query(membrosiasRef(user.uid), orderBy('entrouEm', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMembrosias(snap.docs.map((d) => d.data() as Membrosia))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsub
  }, [user])

  return { membrosias, loading, error }
}
