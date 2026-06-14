import { fromZonedTime } from 'date-fns-tz'
import { parseISO } from 'date-fns'
import type { Partida } from './types'

const TIMEZONE = 'America/Sao_Paulo'

export function getKickoffDate(partida: Partida): Date {
  const localIso = `${partida.data}T${partida.hora}:00`
  return fromZonedTime(localIso, TIMEZONE)
}

export function isPastKickoff(partida: Partida, now: Date = new Date()): boolean {
  return now >= getKickoffDate(partida)
}

export function formatDataBR(data: string): string {
  const [year, month, day] = data.split('-')
  return `${day}/${month}/${year}`
}

export function formatDataCurta(data: string): string {
  const date = parseISO(data)
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: TIMEZONE,
  })
}

export function isHoje(data: string, now: Date = new Date()): boolean {
  const today = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
  return data === today
}

export function getHoje(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}
