interface FrogMarkProps {
  size?: number
  radius?: number
  className?: string
}

export function FrogMark({ size = 32, radius, className = '' }: FrogMarkProps) {
  const r = radius ?? Math.round(size * 0.28)
  const iconSize = Math.round(size * 0.69)

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-brand-primary text-white ${className}`}
      style={{ width: size, height: size, borderRadius: r }}
      aria-hidden
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* eye-domes */}
        <path
          d="M8.5 14c0-2.2 1.8-4 4-4s4 1.8 4 4"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M16.5 14c0-2.2 1.8-4 4-4s4 1.8 4 4"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* glow pupils */}
        <circle cx="12.5" cy="12" r="1.3" fill="#FCD34D" />
        <circle cx="20.5" cy="12" r="1.3" fill="#FCD34D" />
        {/* body / smile arc */}
        <path
          d="M6 17c2.5 4.5 7 6.5 10.5 6.5S25 21.5 26 17"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* magnifying-glass handle */}
        <path d="M22 22l4 4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </span>
  )
}
