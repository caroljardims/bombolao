import { useEffect, useState } from 'react'
import { indiceProximoJogo } from '../lib/nextPartida'
import type { Palpite, Partida, Participante } from '../lib/types'
import { MatchGameBets } from './MatchGameBets'

interface NextGameBetsProps {
  jogosDoDia: Partida[]
  proximaPartida: Partida | null
  participantes: Participante[]
  palpites: Palpite[]
}

export function NextGameBets({
  jogosDoDia,
  proximaPartida,
  participantes,
  palpites,
}: NextGameBetsProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(indiceProximoJogo(jogosDoDia, proximaPartida))
  }, [jogosDoDia, proximaPartida?.id])

  const partida = jogosDoDia[index] ?? null

  if (jogosDoDia.length === 0) {
    return (
      <aside className="card next-card">
        <div className="next-head">
          <span className="eyebrow">Jogos do dia</span>
          <p className="sub" style={{ marginTop: 8 }}>
            Nenhum jogo pendente.
          </p>
        </div>
      </aside>
    )
  }

  if (!partida) return null

  return (
    <MatchGameBets
      key={partida.id}
      partida={partida}
      participantes={participantes}
      palpites={palpites}
      nav={{
        index,
        total: jogosDoDia.length,
        canPrev: index > 0,
        canNext: index < jogosDoDia.length - 1,
        onPrev: () => setIndex((i) => Math.max(0, i - 1)),
        onNext: () => setIndex((i) => Math.min(jogosDoDia.length - 1, i + 1)),
      }}
    />
  )
}
