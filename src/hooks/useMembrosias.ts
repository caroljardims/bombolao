import { useEffect, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
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
