/**
 * Approved Harbor Desk lockup (DESIGN §6.1, direction G). Mark geometry copied from design/logo-harbor-desk.svg:
 * silhouette in currentColor, lantern and single beam wedge fixed at #ff4d00. Wordmark: Commissioner 700, flare off, uppercase, +0.1em.
 */
export function Lockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="lockup">
      <svg viewBox="0 0 56 44" fill="none" aria-hidden="true" focusable="false">
        <path d="M13.5 42.2 H23.5 C24.3 42.2 24.3 44 23.5 44 H13.5 C12.7 44 12.7 42.2 13.5 42.2 Z" fill="currentColor" />
        <path d="M6.3 38.6 H30.7 C31.5 38.6 31.5 40.4 30.7 40.4 H6.3 C5.5 40.4 5.5 38.6 6.3 38.6 Z" fill="currentColor" />
        <path d="M0.9 35.1 H36.1 C36.9 35.1 36.9 36.9 36.1 36.9 H0.9 C0.1 36.9 0.1 35.1 0.9 35.1 Z" fill="currentColor" />
        <path d="M14.6 12.4 H22.4 L26.2 33.6 H10.8 Z" fill="currentColor" />
        <path d="M12 10 H25 C25.4 10 25.6 10.3 25.6 10.7 V11.6 C25.6 12 25.4 12.3 25 12.3 H12 C11.6 12.3 11.4 12 11.4 11.6 V10.7 C11.4 10.3 11.6 10 12 10 Z" fill="currentColor" />
        <path d="M15 4.6 H22 V10 H15 Z" fill="#ff4d00" />
        <path d="M15 4.6 C15.6 1.6 21.4 1.6 22 4.6 Z" fill="currentColor" />
        <path d="M23.6 5.6 L56 1.2 V13.4 L23.6 9 Z" fill="#ff4d00" />
      </svg>
      {compact ? <span className="sr-only">Harbor Desk</span> : <span className="lockup-word">Harbor Desk</span>}
    </span>
  );
}
