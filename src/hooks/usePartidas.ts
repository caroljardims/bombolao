import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { useBolao } from '../contexts/BolaoContext'
import { getHoje } from '../lib/dates'
import { jogosPendentesDiasAnteriores } from '../lib/nextPartida'
import { participantesRef, partidasRef, palpitesRef } from '../lib/paths'
import type { Palpite, Partida, Participante } from '../lib/types'

export function usePartidas() {
  const { bolaoId, bolao } = useBolao()
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [palpites, setPalpites] = useState<Palpite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bolaoId) return

    let loaded = { partidas: false, participantes: false, palpites: false }

    function checkLoaded() {
      if (loaded.partidas && loaded.participantes && loaded.palpites) {
        setLoading(false)
      }
    }

    const unsubPartidas = onSnapshot(
      query(partidasRef(bolaoId), orderBy('data', 'asc'), orderBy('hora', 'asc')),
      (snap) => {
        setPartidas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Partida))
        loaded.partidas = true
        checkLoaded()
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    const unsubParticipantes = onSnapshot(
      query(participantesRef(bolaoId), orderBy('nome', 'asc')),
      (snap) => {
        setParticipantes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Participante))
        loaded.participantes = true
        checkLoaded()
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    const unsubPalpites = onSnapshot(
      palpitesRef(bolaoId),
      (snap) => {
        setPalpites(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Palpite))
        loaded.palpites = true
        checkLoaded()
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    return () => {
      unsubPartidas()
      unsubParticipantes()
      unsubPalpites()
    }
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
  const pendentesAnteriores = jogosPendentesDiasAnteriores(partidas, hoje)
  const partidasHoje = [
    ...pendentesAnteriores,
    ...partidas.filter((p) => p.data === hoje),
  ]
  const pendentesIds = new Set(pendentesAnteriores.map((p) => p.id))

  return {
    partidas,
    participantes,
    palpites,
    grouped,
    partidasHoje,
    pendentesIds,
    competicao: bolao?.competicao ?? '',
    loading,
    error,
  }
}
