import { collection, doc } from 'firebase/firestore'
import { db } from './firebase'

export function bolaoDoc(bolaoId: string) {
  return doc(db, 'boloes', bolaoId)
}

export function participantesRef(bolaoId: string) {
  return collection(db, 'boloes', bolaoId, 'participantes')
}

export function partidasRef(bolaoId: string) {
  return collection(db, 'boloes', bolaoId, 'partidas')
}

export function palpitesRef(bolaoId: string) {
  return collection(db, 'boloes', bolaoId, 'palpites')
}

export function participanteDoc(bolaoId: string, uid: string) {
  return doc(db, 'boloes', bolaoId, 'participantes', uid)
}

export function partidaDoc(bolaoId: string, partidaId: string) {
  return doc(db, 'boloes', bolaoId, 'partidas', partidaId)
}

export function palpiteDoc(bolaoId: string, palpiteId: string) {
  return doc(db, 'boloes', bolaoId, 'palpites', palpiteId)
}

export function palpitesChaveRef(bolaoId: string) {
  return collection(db, 'boloes', bolaoId, 'palpitesChave')
}

export function palpiteChaveDoc(bolaoId: string, participanteId: string) {
  return doc(db, 'boloes', bolaoId, 'palpitesChave', participanteId)
}

/** Fonte pública de resultados oficiais (preenchida pelo sync) por competição. */
export function resultadosOficiaisDoc(competicaoId: string) {
  return doc(db, 'resultadosOficiais', competicaoId)
}

export function conviteDoc(code: string) {
  return doc(db, 'convites', code.toUpperCase())
}

export function convitesRef() {
  return collection(db, 'convites')
}

export function membrosiaDoc(uid: string, bolaoId: string) {
  return doc(db, 'users', uid, 'membrosias', bolaoId)
}

export function membrosiasRef(uid: string) {
  return collection(db, 'users', uid, 'membrosias')
}

export function bolaoPath(bolaoId: string, ...segments: string[]) {
  return `/b/${bolaoId}${segments.length ? `/${segments.join('/')}` : ''}`
}
