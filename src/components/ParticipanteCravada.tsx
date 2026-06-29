import { useMemo } from 'react'
import { BracketArea } from '../pages/ChavePage'
import { usePalpiteChave } from '../hooks/usePalpiteChave'
import { buildEngine, engineToCravada } from '../lib/knockoutBracket'
import { filtrarPicksVisiveis } from '../lib/cravadaPrivacy'
import { FASE_LABEL } from '../lib/chave'
import type { Partida } from '../lib/types'

/**
 * Cravada de outro participante (read-only), com privacidade: picks de fases
 * ainda não encerradas ficam ocultos (ver `filtrarPicksVisiveis`).
 */
export function ParticipanteCravada({
  participanteId,
  nome,
  partidas,
}: {
  participanteId: string
  nome: string
  partidas: Partida[]
}) {
  const { doc, loading } = usePalpiteChave(participanteId)
  const engine = useMemo(() => buildEngine(partidas), [partidas])
  const { picks, fasesAbertas } = useMemo(
    () => filtrarPicksVisiveis(doc, engine, false),
    [doc, engine],
  )
  const data = useMemo(() => engineToCravada(engine, picks, { editavel: false }), [engine, picks])

  if (loading) return null

  const temCravada = Boolean(doc?.cravada?.picks && Object.keys(doc.cravada.picks).length > 0)
  const travada = Boolean(doc?.cravada?.travadoEm)

  return (
    <section className="participante-cravada">
      <header className="section-head plain">
        <div>
          <h3>Cravada de {nome}</h3>
          <p className="sub">
            {!temCravada
              ? `${nome} ainda não montou a cravada.`
              : travada
                ? 'Cravada travada — palpites finais deste participante.'
                : 'Palpites de chave deste participante.'}
          </p>
        </div>
      </header>

      {temCravada && (
        <>
          {fasesAbertas.length > 0 && (
            <p className="sub participante-cravada-hint">
              Fases ainda em aberto ficam ocultas até todos os jogos encerrarem:{' '}
              {fasesAbertas.map((f) => FASE_LABEL[f]).join(' · ')}.
            </p>
          )}
          <BracketArea data={data} />
        </>
      )}
    </section>
  )
}
