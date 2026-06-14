const AV_GRADS = [
  ['#f6c945', '#d98e2b'],
  ['#54c98a', '#1f7a47'],
  ['#5aa7f0', '#2f5fd0'],
  ['#e9846b', '#c2452f'],
  ['#b388f0', '#6d3fd0'],
  ['#56cdd6', '#1f8a93'],
  ['#f0a35a', '#c46a1f'],
  ['#7bd06a', '#3a8a2f'],
] as const

function hashIdx(s: string, n: number): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % n
}

interface AvatarProps {
  name: string
  id?: string
  size?: number
  photo?: string | null
}

export function Avatar({ name, id, size = 38, photo }: AvatarProps) {
  if (photo) {
    return (
      <img
        key={photo}
        className="avatar-img"
        src={photo}
        alt={name}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    )
  }

  const [a, b] = AV_GRADS[hashIdx(id ?? name, AV_GRADS.length)]
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <span
      className="avatar-mono"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(140deg, ${a}, ${b})`,
      }}
    >
      {initials}
    </span>
  )
}
