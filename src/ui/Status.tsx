import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { PROVENANCE_DEFINITIONS } from '../domain/provenance.ts';
import type { Provenance } from '../domain/types.ts';
import { Icon, type IconName } from './icons.tsx';

export type PillTone = 'present' | 'empty' | 'away' | 'unknown' | 'offline' | 'review' | 'pending' | 'resolved' | 'underway';
const PILL_ICON: Partial<Record<PillTone, IconName>> = { review: 'question', pending: 'refresh', offline: 'offline', resolved: 'check', unknown: 'question' };

/** Status pill: text always carries the meaning; colour, dot shape and icon reinforce it (no colour-only meaning). */
export function StatusPill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  const icon = PILL_ICON[tone];
  return (
    <span className="pill" data-tone={tone}>
      {icon ? <Icon name={icon} size={16} /> : <span className="pill-dot" data-shape={tone === 'empty' || tone === 'away' ? 'ring' : 'solid'} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * Tooltip meeting WCAG 1.4.13: shows on hover and focus, stays while hovered, Escape dismisses.
 * The trigger references it with aria-describedby, so screen readers get the text without hovering.
 */
export function Tooltip({ content, children }: { content: ReactNode; children: (props: { 'aria-describedby': string; onFocus: () => void; onBlur: () => void }) => ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => clear, []);
  return (
    <span
      className="tooltip-anchor"
      onPointerEnter={() => {
        clear();
        setOpen(true);
      }}
      onPointerLeave={() => {
        clear();
        timer.current = window.setTimeout(() => setOpen(false), 120);
      }}
    >
      {children({ 'aria-describedby': id, onFocus: () => setOpen(true), onBlur: () => setOpen(false) })}
      <span role="tooltip" id={id} className="tooltip" hidden={!open}>
        {content}
      </span>
    </span>
  );
}

/** DOC / ASSUME / SIM / FIELD tag with its plain-language definition (PRD §8, DESIGN §2 rule 2). */
export function ProvenanceTag({ value }: { value: Provenance }) {
  const def = PROVENANCE_DEFINITIONS[value];
  return (
    <Tooltip
      content={
        <>
          <strong>
            {value} · {def.label}
          </strong>
          {def.definition}
        </>
      }
    >
      {(p) => (
        // The accessible name starts with the visible text (WCAG 2.5.3); the button is a 24 px target (2.5.8)
        // while the drawn chip keeps DESIGN's 11 px tag size.
        <button type="button" className="tag" data-prov={value} aria-label={`${value}: ${def.label} (provenance)`} {...p}>
          <span className="tag-box">{value}</span>
        </button>
      )}
    </Tooltip>
  );
}

export function Notice({ tone = 'info', title, children, action, live = 'polite' }: { tone?: 'info' | 'warning' | 'error'; title: string; children?: ReactNode; action?: ReactNode; live?: 'polite' | 'assertive' | 'off' }) {
  const role = live === 'off' ? undefined : tone === 'error' && live === 'assertive' ? 'alert' : 'status';
  return (
    <div className="notice" data-tone={tone} role={role}>
      <Icon name={tone === 'info' ? 'info' : 'alert'} />
      <div>
        <p className="notice-title">{title}</p>
        {children ? <p className="notice-body">{children}</p> : null}
      </div>
      {action ?? null}
    </div>
  );
}

/** DESIGN §8 empty state: mono eyebrow, one line, one recovery action. */
export function EmptyState({ eyebrow, children, action }: { eyebrow: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="label">{eyebrow}</p>
      <p className="secondary">{children}</p>
      {action ?? null}
    </div>
  );
}

/** Dataset summary tile (not live telemetry). */
export function KpiTile({ label, value, provenance, note, onOpen, openLabel }: { label: string; value: ReactNode; provenance?: Provenance; note?: string; onOpen?: () => void; openLabel?: string }) {
  const body = (
    <>
      <span className="data-lg">{value}</span>
      <span className="label">
        <span>{label}</span>
        {provenance ? <ProvenanceTag value={provenance} /> : null}
      </span>
      {note ? <span className="body-sm secondary">{note}</span> : null}
      {onOpen && openLabel ? <span className="sr-only">. {openLabel}</span> : null}
    </>
  );
  // T31: a tile may open the panel behind its number (Arrivals → the arrivals board).
  return onOpen ? (
    <button type="button" className="panel kpi kpi-button" onClick={onOpen}>
      {body}
    </button>
  ) : (
    <div className="panel kpi">{body}</div>
  );
}
