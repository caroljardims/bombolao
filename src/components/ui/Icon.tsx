interface IconProps {
  s?: number
  w?: number
}

export const Icon = {
  trophy: ({ s = 22, w = 1.9 }: IconProps) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3" />
      <path d="M12 13v3M9 20h6M10 20c0-1.5.7-2 2-2s2 .5 2 2" />
    </svg>
  ),
  ball: ({ s = 22, w = 1.9 }: IconProps) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7 3 2.2-1.1 3.5h-3.8L9 9.2 12 7Z" />
      <path d="M12 3v4M4.5 9l3.5 1.2M19.5 9 16 10.2M7.2 19l1.1-3.4M16.8 19l-1.1-3.4" />
    </svg>
  ),
  pencil: ({ s = 22, w = 1.9 }: IconProps) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5h9M5 9h6" />
      <path d="m18.5 9.5 2 2L15 17l-2.6.6.6-2.6 5.5-5.5Z" />
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H12M4 4.5V19a1.5 1.5 0 0 0 1.5 1.5H9" />
    </svg>
  ),
  gear: ({ s = 22, w = 1.9 }: IconProps) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
    </svg>
  ),
  user: ({ s = 22, w = 1.9 }: IconProps) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.6-3.6 3.3-5.6 7-5.6s6.4 2 7 5.6" />
    </svg>
  ),
  refresh: ({ s = 18, w = 2 }: IconProps) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 8a8 8 0 1 0 .9 6" />
      <path d="M20 3.5V8h-4.5" />
    </svg>
  ),
  arrow: ({ s = 16, w = 2.2 }: IconProps) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  ),
  back: ({ s = 16, w = 2.4 }: IconProps) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H6M11 6l-6 6 6 6" />
    </svg>
  ),
  check: ({ s = 16, w = 2.6 }: IconProps) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5 9 17.5 20 6.5" />
    </svg>
  ),
}

export type IconName = keyof typeof Icon
