import { teamFlagUrl } from '../../lib/teamFlags'

interface TeamBadgeProps {
  name: string
  size?: number
}

export function TeamBadge({ name, size = 30 }: TeamBadgeProps) {
  const px = Math.round(size * 2)
  return (
    <img
      src={teamFlagUrl(name, px)}
      alt=""
      aria-hidden
      className="team-badge"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
    />
  )
}
