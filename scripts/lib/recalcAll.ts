import type { Firestore } from 'firebase-admin/firestore'
import type { Partida, Palpite } from '../../src/lib/types'
import {
  calcularPontos,
  calcularPosicoes,
  contarEstatisticas,
  partidaEncerrada,
  temPalpite,
} from './recalc'

export async function recalcAll(db: Firestore, bolaoId: string) {
  const bolaoRef = db.collection('boloes').doc(bolaoId)
  const partidasSnap = await bolaoRef.collection('partidas').get()
  const partidasMap = new Map<string, Partida>()
  partidasSnap.docs.forEach((d) => partidasMap.set(d.id, { id: d.id, ...d.data() } as Partida))

  const palpitesSnap = await bolaoRef.collection('palpites').get()
  const batchPalpites = db.batch()
  let palpitesAtualizados = 0

  for (const doc of palpitesSnap.docs) {
    const palpite = { id: doc.id, ...doc.data() } as Palpite
    const partida = partidasMap.get(palpite.partida_id)
    if (!partida || !partidaEncerrada(partida)) continue

    let pontos = 0
    if (temPalpite(palpite)) {
      pontos = calcularPontos(
        { casa: partida.gols_casa!, fora: partida.gols_fora! },
        { casa: palpite.palpite_casa!, fora: palpite.palpite_fora! },
      )
    }

    if (palpite.pontos !== pontos) {
      batchPalpites.update(doc.ref, { pontos })
      palpitesAtualizados++
    }
  }

  if (palpitesAtualizados > 0) await batchPalpites.commit()

  const participantesSnap = await bolaoRef.collection('participantes').get()
  const statsList: ({ id: string } & ReturnType<typeof contarEstatisticas>)[] = []

  for (const pDoc of participantesSnap.docs) {
    const palpitesDoParticipante = palpitesSnap.docs
      .filter((d) => d.data().participante_id === pDoc.id)
      .map((d) => ({ id: d.id, ...d.data() }) as Palpite)

    const stats = contarEstatisticas(palpitesDoParticipante, partidasMap)
    statsList.push({ id: pDoc.id, ...stats })
  }

  const posicoes = calcularPosicoes(statsList)
  const batchParticipantes = db.batch()

  for (const entry of statsList) {
    batchParticipantes.update(bolaoRef.collection('participantes').doc(entry.id), {
      total_pontos: entry.total_pontos,
      na_mosca: entry.na_mosca,
      acerto_resultado: entry.acerto_resultado,
      sem_aposta: entry.sem_aposta,
      posicao: posicoes.get(entry.id) ?? 99,
    })
  }

  await batchParticipantes.commit()
}
