/** The Torc mark (five slanted segments + two seats), inline so it can scale and take the theme colour. */
export function Mark({ className = '', title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="4 3 56 56" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M18.86 47.98 A23.5 23.5 0 0 1 8.69 31.45 L17.86 25.29 A14.5 14.5 0 0 0 23.89 40.52 Z" />
        <path d="M8.58 26.53 A23.5 23.5 0 0 1 18.05 9.58 L27.91 14.59 A14.5 14.5 0 0 0 18.84 22.42 Z" />
        <path d="M22.29 7.10 A23.5 23.5 0 0 1 41.71 7.10 L42.15 18.14 A14.5 14.5 0 0 0 30.89 14.04 Z" />
        <path d="M45.95 9.58 A23.5 23.5 0 0 1 55.42 26.53 L45.99 32.30 A14.5 14.5 0 0 0 44.08 20.48 Z" />
        <path d="M55.31 31.45 A23.5 23.5 0 0 1 45.14 47.98 L40.11 40.52 A14.5 14.5 0 0 0 44.90 35.13 Z" />
        <circle cx="25.80" cy="53.60" r="4.6" />
        <circle cx="38.20" cy="53.60" r="4.6" />
      </g>
    </svg>
  );
}
