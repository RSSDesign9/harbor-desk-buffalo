/**
 * Minimal in-house UI icons on the DESIGN §6.3 grid: 20 px, 1.5 px stroke, round caps, currentColor.
 * Decorative by default (aria-hidden); meaning always comes from adjacent text.
 */
const PATHS = {
  search: ['M9 15.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z', 'M13.8 13.8 17.5 17.5'],
  close: ['M5 5l10 10', 'M15 5 5 15'],
  alert: ['M10 3 18 17H2L10 3Z', 'M10 8v4', 'M10 14.5v.01'],
  info: ['M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'M10 9v5', 'M10 6.2v.01'],
  check: ['M4 10.5 8 14.5 16 5.5'],
  question: ['M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'M7.8 7.8a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5v.4', 'M10 14.4v.01'],
  offline: ['M3 3l14 14', 'M6.5 9.5a5 5 0 0 1 2-1.3', 'M3.5 6.6A9 9 0 0 1 7 4.6', 'M12.5 8.4a5 5 0 0 1 1 1.1', 'M16.5 6.6a9 9 0 0 0-3.6-2.2', 'M10 15v.01'],
  play: ['M6 3.5 16 10 6 16.5Z'],
  pause: ['M7 4v12', 'M13 4v12'],
  chevronLeft: ['M12 5l-5 5 5 5'],
  chevronRight: ['M8 5l5 5-5 5'],
  refresh: ['M16 10a6 6 0 1 1-1.8-4.3', 'M16 3.5v3h-3'],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, title }: { name: IconName; size?: 16 | 20; title?: string }) {
  return (
    <svg
      className={size === 16 ? 'icon icon-16' : 'icon'}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Vessel-type glyph from the supplied sprite (design/icons-vessels.svg → /assets/icons-vessels.svg). */
export function VesselGlyph({ kind, label }: { kind: 'v-sail' | 'v-power' | 'v-pontoon' | 'v-pwc' | 'v-workboat' | 'v-trailer'; label?: string }) {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <use href={`/assets/icons-vessels.svg#${kind}`} />
    </svg>
  );
}
