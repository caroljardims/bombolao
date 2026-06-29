import { Icon, TeamBadge } from './ui'
import type { KnockoutMatch } from '../lib/chave'

interface CravadaFinalPicksProps {
  finalMatch: KnockoutMatch | undefined
  campeao: string | null
  vice: string | null
  onPickCampeao: (team: string) => void
  disabled?: boolean
}

function teamNameOf(match: KnockoutMatch | undefined, side: 'A' | 'B'): string | null {
  if (!match) return null
  const slot = side === 'A' ? match.timeA : match.timeB
  return slot.tipo === 'time' ? slot.nome : null
}

/**
 * Seleção explícita do campeão (e, por consequência, do vice) entre os dois
 * finalistas. Os finalistas vêm dos picks das semifinais.
 */
export function CravadaFinalPicks({
  finalMatch,
  campeao,
  vice,
  onPickCampeao,
  disabled,
}: CravadaFinalPicksProps) {
  const a = teamNameOf(finalMatch, 'A')
  const b = teamNameOf(finalMatch, 'B')
  const finalistas = [a, b].filter((t): t is string => Boolean(t))

  return (
    <div className="cravada-final">
      <h3 className="cravada-final-title">
        <Icon.trophy s={15} /> Campeão e vice
      </h3>
      {finalistas.length < 2 ? (
        <p className="sub">Escolha os dois semifinalistas vencedores para definir a final.</p>
      ) : (
        <>
          <p className="sub">Toque no campeão — o outro finalista vira o vice automaticamente.</p>
          <div className="cravada-final-opts">
            {finalistas.map((team) => {
              const isChamp = campeao === team
              const isVice = !isChamp && vice === team
              const cls = [
                'cravada-final-opt',
                isChamp ? 'is-champ' : '',
                isVice ? 'is-vice' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button
                  key={team}
                  type="button"
                  className={cls}
                  onClick={() => !disabled && onPickCampeao(team)}
                  disabled={disabled}
                >
                  <TeamBadge name={team} size={24} />
                  <span className="cravada-final-name">{team}</span>
                  {isChamp && <span className="cravada-final-tag">Campeão</span>}
                  {isVice && <span className="cravada-final-tag is-vice">Vice</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
