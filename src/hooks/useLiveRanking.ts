import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getDocsFromServer,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { useBolao } from '../contexts/BolaoContext'
import { buildLiveRanking, countPartidasAoVivo } from '../lib/liveRanking'
import { mergePartidasWithLiveScores, countLiveFromApi } from '../lib/mergeScores'
import { findProximaPartida, type ApostaProximoJogo } from '../lib/nextPartida'
import { participantesRef, partidasRef, palpitesRef } from '../lib/paths'
import { useLiveScores } from './useLiveScores'
import type { Palpite, Partida, Participante } from '../lib/types'

export function useLiveRanking() {
  const { bolaoId } = useBolao()
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [partidasFirestore, setPartidasFirestore] = useState<Partida[]>([])
  const [palpites, setPalpites] = useState<Palpite[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const { scores, lastSync, sync } = useLiveScores(partidasFirestore)
  const syncRef = useRef(sync)
  syncRef.current = sync

  const partidas = useMemo(
    () => mergePartidasWithLiveScores(partidasFirestore, scores),
    [partidasFirestore, scores],
  )

  const fetchFromServer = useCallback(async () => {
    const [participantesSnap, partidasSnap, palpitesSnap] = await Promise.all([
      getDocsFromServer(query(participantesRef(bolaoId), orderBy('nome', 'asc'))),
      getDocsFromServer(
        query(partidasRef(bolaoId), orderBy('data', 'asc'), orderBy('hora', 'asc')),
      ),
      getDocsFromServer(palpitesRef(bolaoId)),
    ])

    return {
      participantes: participantesSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Participante,
      ),
      partidasFirestore: partidasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Partida),
      palpites: palpitesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Palpite),
    }
  }, [bolaoId])

  const refreshFirestore = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await fetchFromServer()
      setParticipantes(data.participantes)
      setPartidasFirestore(data.partidasFirestore)
      setPalpites(data.palpites)
      setLastUpdate(new Date())
      setError(null)
      await syncRef.current()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar')
      throw err
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [fetchFromServer])

  useEffect(() => {
    if (!bolaoId) return

    let loaded = { participantes: false, partidas: false, palpites: false }

    function checkLoaded() {
      if (loaded.participantes && loaded.partidas && loaded.palpites) {
        setLoading(false)
      }
    }

    const unsubParticipantes = onSnapshot(
      query(participantesRef(bolaoId), orderBy('nome', 'asc')),
      (snap) => {
        setParticipantes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Participante))
        loaded.participantes = true
        setLastUpdate(new Date())
        checkLoaded()
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    const unsubPartidas = onSnapshot(
      query(partidasRef(bolaoId), orderBy('data', 'asc'), orderBy('hora', 'asc')),
      (snap) => {
        setPartidasFirestore(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Partida))
        loaded.partidas = true
        setLastUpdate(new Date())
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
        setLastUpdate(new Date())
        checkLoaded()
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    return () => {
      unsubParticipantes()
      unsubPartidas()
      unsubPalpites()
    }
  }, [bolaoId])

  const ranking = useMemo(
    () => buildLiveRanking(participantes, palpites, partidas),
    [participantes, palpites, partidas],
  )

  const aoVivo = useMemo(() => {
    const fromApi = countLiveFromApi(partidas, scores)
    if (fromApi > 0) return fromApi
    return countPartidasAoVivo(partidas)
  }, [partidas, scores])

  const encerradas = useMemo(
    () => partidas.filter((p) => p.gols_casa !== null && p.gols_fora !== null).length,
    [partidas],
  )

  const proximaPartida = useMemo(() => findProximaPartida(partidas), [partidas])

  const apostasProximoJogo = useMemo((): ApostaProximoJogo[] => {
    if (!proximaPartida) return []

    return buildLiveRanking(participantes, palpites, partidas).map((participante) => ({
      participante,
      palpite:
        palpites.find(
          (p) =>
            p.participante_id === participante.id && p.partida_id === proximaPartida.id,
        ) ?? null,
    }))
  }, [participantes, palpites, partidas, proximaPartida])

  const refresh = useCallback(async () => {
    await refreshFirestore()
  }, [refreshFirestore])

  return {
    ranking,
    loading,
    refreshing: refreshing,
    error,
    lastUpdate: lastSync ?? lastUpdate,
    aoVivo,
    encerradas,
    total: partidas.length,
    proximaPartida,
    apostasProximoJogo,
    refresh,
  }
}
