interface Props {
  label: string;
}

/** Meaningful loading state: names what is loading, never a bare spinner. */
export function LoadingShell({ label }: Props) {
  return (
    <div className="loading-shell" role="status" aria-live="polite">
      <span className="loading-dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
