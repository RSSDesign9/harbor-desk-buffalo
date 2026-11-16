/**
 * Workflow commands with their accessible results: every action dispatches one engine command, announces the
 * result in the polite live region, and moves focus to where the result appears (never leaving it on a
 * control that just disappeared or became disabled).
 */
import { useCallback, useRef } from 'react';
import { useStore } from '../../app/AppStore.tsx';
import { activeSession } from '../../domain/store.ts';
import type { Command } from '../../domain/engine.ts';
import { useAnnounce } from '../../ui/Announcer.tsx';
import { resultMessage } from './model.ts';

/** Focus an element by id after React has committed the result of a dispatch. */
export function focusSoon(id: string) {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: false })));
}

export const FOCUS = {
  inspectorTitle: 'inspector-title',
  review: 'review-heading',
  evidenceReview: 'evidence-review-heading',
  staffEvidence: 'staff-evidence-heading',
  taskStatus: 'dock-check-status',
  resolution: 'resolution-heading',
  reviewButton: 'review-observation-button',
  explore: 'explore-slip-review',
} as const;

type Kind = 'advance' | 'request' | 'load' | 'open' | 'cancel' | 'confirm';

export function useReviewActions(issueId: string | null) {
  const store = useStore();
  const announce = useAnnounce();
  // A rapid repeat (double click) is a no-op in the engine; keep announcing the result that mattered.
  const last = useRef<{ kind: Kind; at: number } | null>(null);
  return useCallback(
    (kind: Kind) => {
      if (!store) return;
      const cmd: Command | null =
        kind === 'advance'
          ? { type: 'advanceToUncertain' }
          : kind === 'cancel'
            ? { type: 'cancelReview' }
            : issueId === null
              ? null
              : kind === 'request'
                ? { type: 'requestDockCheck', issueId }
                : kind === 'load'
                  ? { type: 'loadDockCheckResult', issueId }
                  : kind === 'open'
                    ? { type: 'openReview', issueId }
                    : { type: 'confirmIdentity', issueId };
      if (!cmd) return;
      const r = store.dispatch(cmd);
      const st = store.getState();
      const now = performance.now();
      const repeat = r.ok && r.effect === 'unchanged' && last.current?.kind === kind && now - last.current.at < 1500;
      if (!repeat) announce(resultMessage(st.fixtures, kind, r, activeSession(st)));
      if (r.ok && r.effect === 'changed') last.current = { kind, at: now };
      if (!r.ok || repeat) return;
      const target = { advance: FOCUS.review, request: FOCUS.taskStatus, load: FOCUS.staffEvidence, open: FOCUS.evidenceReview, cancel: FOCUS.reviewButton, confirm: FOCUS.resolution }[kind];
      focusSoon(target);
    },
    [store, issueId, announce],
  );
}
