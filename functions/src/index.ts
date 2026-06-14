import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { getFirestore } from 'firebase-admin/firestore'
import {
  calcularPontos,
  calcularPosicoes,
  contarEstatisticas,
  partidaEncerrada,
  temPalpite,
  type Partida,
  type Palpite,
} from './scoring'

const db = getFirestore()

export const onPartidaUpdate = onDocumentUpdated(
  'boloes/{bolaoId}/partidas/{partidaId}',
  async (event) => {
    const bolaoId = event.params.bolaoId
    const before = event.data?.before.data() as Partida | undefined
    const after = event.data?.after.data() as Partida | undefined
    const partidaId = event.params.partidaId

    if (!before || !after) return
    if (before.gols_casa === after.gols_casa && before.gols_fora === after.gols_fora) return
    if (!partidaEncerrada(after)) return

    const bolaoRef = db.collection('boloes').doc(bolaoId)
    const placar = { casa: after.gols_casa!, fora: after.gols_fora! }

    // 1. Atualizar pontos dos palpites desta partida
    const palpitesPartidaSnap = await bolaoRef
      .collection('palpites')
      .where('partida_id', '==', partidaId)
      .get()

    const batch = db.batch()
    for (const docSnap of palpitesPartidaSnap.docs) {
      const palpite = docSnap.data() as Palpite
      const pontos = temPalpite(palpite)
        ? calcularPontos(placar, { casa: palpite.palpite_casa!, fora: palpite.palpite_fora! })
        : 0
      batch.update(docSnap.ref, { pontos })
    }
    await batch.commit()

    // 2. Carregar partidas e todos os palpites (após commit acima)
    const [partidasSnap, allPalpitesSnap, participantesSnap] = await Promise.all([
      bolaoRef.collection('partidas').get(),
      bolaoRef.collection('palpites').get(),
      bolaoRef.collection('participantes').get(),
    ])

    const partidasMap = new Map<string, Partida>()
    partidasSnap.docs.forEach((d) => partidasMap.set(d.id, { id: d.id, ...d.data() } as Partida))

    // Agrupar palpites por participante em memória (evita N+1 queries)
    const palpitesByParticipante = new Map<string, Palpite[]>()
    for (const d of allPalpitesSnap.docs) {
      const p = { id: d.id, ...d.data() } as Palpite
      const list = palpitesByParticipante.get(p.participante_id) ?? []
      list.push(p)
      palpitesByParticipante.set(p.participante_id, list)
    }

    // 3. Calcular estatísticas e posições
    const statsList: ({ id: string } & ReturnType<typeof contarEstatisticas>)[] = []
    for (const pDoc of participantesSnap.docs) {
      const palpites = palpitesByParticipante.get(pDoc.id) ?? []
      const stats = contarEstatisticas(palpites, partidasMap)
      statsList.push({ id: pDoc.id, ...stats })
    }

    const posicoes = calcularPosicoes(statsList)
    const batch2 = db.batch()
    for (const entry of statsList) {
      batch2.update(bolaoRef.collection('participantes').doc(entry.id), {
        total_pontos: entry.total_pontos,
        na_mosca: entry.na_mosca,
        acerto_resultado: entry.acerto_resultado,
        sem_aposta: entry.sem_aposta,
        posicao: posicoes.get(entry.id) ?? 99,
      })
    }
    await batch2.commit()
  },
)
