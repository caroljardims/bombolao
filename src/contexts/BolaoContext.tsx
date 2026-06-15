import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useParams } from 'react-router-dom'
import { onSnapshot } from 'firebase/firestore'
import { useAuth } from './AuthContext'
import { claimLegacyParticipante } from '../lib/linkParticipante'
import { bolaoDoc, membrosiaDoc, participanteDoc } from '../lib/paths'
import type { Bolao, Membrosia, Participante } from '../lib/types'

interface BolaoState {
  bolaoId: string
  bolao: Bolao | null
  participante: Participante | null
  isMember: boolean
  isAdmin: boolean
  loading: boolean
  membershipReady: boolean
  error: string | null
}

const BolaoContext = createContext<BolaoState | null>(null)

export function BolaoProvider({ children }: { children: ReactNode }) {
  const { bolaoId = '' } = useParams<{ bolaoId: string }>()
  const { user } = useAuth()
  const [bolao, setBolao] = useState<Bolao | null>(null)
  const [participante, setParticipante] = useState<Participante | null>(null)
  const [membrosia, setMembrosia] = useState<Membrosia | null>(null)
  const [loading, setLoading] = useState(true)
  const [membershipReady, setMembershipReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bolaoId) {
      setLoading(false)
      return
    }

    setLoading(true)
    const unsub = onSnapshot(
      bolaoDoc(bolaoId),
      (snap) => {
        if (!snap.exists()) {
          setBolao(null)
          setError('Bolão não encontrado.')
          setLoading(false)
          return
        }
        setBolao({ id: snap.id, ...snap.data() } as Bolao)
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsub
  }, [bolaoId])

  useEffect(() => {
    if (!bolaoId || !user) {
      setParticipante(null)
      setMembershipReady(false)
      return
    }

    setMembershipReady(false)
    let participanteDone = false
    let membrosiaDone = false

    const markReady = () => {
      if (participanteDone && membrosiaDone) setMembershipReady(true)
    }

    const unsubParticipante = onSnapshot(
      participanteDoc(bolaoId, user.uid),
      (snap) => {
        setParticipante(
          snap.exists() ? ({ id: snap.id, ...snap.data() } as Participante) : null,
        )
        participanteDone = true
        markReady()
      },
      () => {
        setParticipante(null)
        participanteDone = true
        markReady()
      },
    )

    const unsubMembrosia = onSnapshot(
      membrosiaDoc(user.uid, bolaoId),
      (snap) => {
        setMembrosia(snap.exists() ? (snap.data() as Membrosia) : null)
        membrosiaDone = true
        markReady()
      },
      () => {
        setMembrosia(null)
        membrosiaDone = true
        markReady()
      },
    )

    return () => {
      unsubParticipante()
      unsubMembrosia()
    }
  }, [bolaoId, user])

  useEffect(() => {
    if (!bolaoId || !user?.email) return

    claimLegacyParticipante(
      bolaoId,
      user.uid,
      user.email,
      user.displayName ?? undefined,
    ).catch(() => {
      /* falha silenciosa — usuário pode não ter conta legada */
    })
  }, [bolaoId, user?.uid, user?.email, user?.displayName])

  const value = useMemo<BolaoState>(
    () => ({
      bolaoId,
      bolao,
      participante,
      isMember: !!participante || !!membrosia,
      isAdmin:
        membrosia?.papel === 'admin' ||
        participante?.papel === 'admin' ||
        bolao?.criadoPor === user?.uid,
      loading,
      membershipReady,
      error,
    }),
    [bolaoId, bolao, participante, membrosia, user, loading, membershipReady, error],
  )

  return <BolaoContext.Provider value={value}>{children}</BolaoContext.Provider>
}

export function useBolao(): BolaoState {
  const ctx = useContext(BolaoContext)
  if (!ctx) throw new Error('useBolao must be used within BolaoProvider')
  return ctx
}
