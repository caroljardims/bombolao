import { teamFlag } from '../../lib/teamFlags'

interface TeamBadgeProps {
  name: string
  size?: number
}

export function TeamBadge({ name, size = 30 }: TeamBadgeProps) {
  return (
    <span className="team-badge" style={{ width: size, height: size, fontSize: size * 0.62 }}>
      {teamFlag(name)}
    </span>
  )
}
