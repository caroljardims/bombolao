import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getDocsFromServer,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { useBolao } from '../contexts/BolaoContext'
import { normalizeRegrasChave } from '../lib/regras'
import { buildLiveRanking, countPartidasAoVivo } from '../lib/liveRanking'
import { partidaAoVivo } from '../lib/scoring'
import { findProximaPartida, resolveJogosDoDia } from '../lib/nextPartida'
import { participantesRef, partidasRef, palpitesRef, palpitesChaveRef } from '../lib/paths'
import type { Palpite, Partida, Participante } from '../lib/types'
import type { PalpiteChaveDoc } from '../lib/chavePalpite'

export function useLiveRanking() {
  const { bolaoId, bolao } = useBolao()
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [palpites, setPalpites] = useState<Palpite[]>([])
  const [chaveDocs, setChaveDocs] = useState<PalpiteChaveDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [now, setNow] = useState(() => new Date())

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
      partidas: partidasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Partida),
      palpites: palpitesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Palpite),
    }
  }, [bolaoId])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await fetchFromServer()
      setParticipantes(data.participantes)
      setPartidas(data.partidas)
      setPalpites(data.palpites)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar')
      throw err
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [fetchFromServer])

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    if (!bolaoId) return

    const loaded = { participantes: false, partidas: false, palpites: false }

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
        setPartidas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Partida))
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

  const regrasChave = useMemo(
    () => (bolao?.regrasChave ? normalizeRegrasChave(bolao.regrasChave) : undefined),
    [bolao?.regrasChave],
  )
  const isMataMata = bolao?.modalidade === 'mata-mata' && !!regrasChave

  useEffect(() => {
    if (!bolaoId || !isMataMata) return
    const unsub = onSnapshot(
      palpitesChaveRef(bolaoId),
      (snap) => setChaveDocs(snap.docs.map((d) => ({ ...(d.data() as PalpiteChaveDoc) }))),
      () => setChaveDocs([]),
    )
    return unsub
  }, [bolaoId, isMataMata])

  const ranking = useMemo(
    () =>
      buildLiveRanking(
        participantes,
        palpites,
        partidas,
        isMataMata && regrasChave ? { chaveDocs, regrasChave } : undefined,
      ),
    [participantes, palpites, partidas, isMataMata, regrasChave, chaveDocs],
  )

  const aoVivo = useMemo(() => countPartidasAoVivo(partidas), [partidas])

  const partidasAoVivo = useMemo(() => partidas.filter((p) => partidaAoVivo(p)), [partidas])

  const encerradas = useMemo(
    () => partidas.filter((p) => p.gols_casa !== null && p.gols_fora !== null).length,
    [partidas],
  )

  const proximaPartida = useMemo(() => findProximaPartida(partidas, now), [partidas, now])

  const jogosDoDia = useMemo(
    () => resolveJogosDoDia(partidas, now),
    [partidas, now],
  )

  return {
    ranking,
    loading,
    refreshing,
    error,
    lastUpdate,
    aoVivo,
    partidasAoVivo,
    encerradas,
    total: partidas.length,
    proximaPartida,
    jogosDoDia,
    participantes,
    partidas,
    palpites,
    refresh,
  }
}
