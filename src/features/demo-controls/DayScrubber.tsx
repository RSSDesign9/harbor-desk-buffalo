/**
 * Day timeline scrubber (TASKS T31, PRD F21): 06:00–22:00 on 15 July, one minute per step.
 *
 * Its relationship to guided replay is explicit: moving it shows the scripted day, read-only, at that minute
 * (store.viewTimeline); guided replay is the same view at three checkpoints. The interactive run is never read
 * or written. “Back to my run” returns to it unchanged.
 *
 * Keyboard: it is a native range input (←/→ one minute, PageUp/PageDown, Home/End). A jump of more than 15
 * minutes (a click on the track, Home/End) glides there over 450 ms so boats travel their paths instead of
 * appearing; under reduced motion it cuts.
 */
import { useEffect, useId, useRef } from 'react';
import { useAppState, useStore } from '../../app/AppStore.tsx';
import { dayBounds, MINUTE_MS, toIso } from '../../domain/timeline.ts';
import { formatClock } from '../../domain/time.ts';
import { scenarioStage } from '../../domain/selectors.ts';
import { activeSession } from '../../domain/store.ts';
import { prefersReducedMotion } from '../../scene/viewRequests.ts';
import { useAnnounce } from '../../ui/Announcer.tsx';

const GLIDE_MS = 450;
const STAGE_TEXT: Record<string, string> = { normal: '', uncertain: ' · B-12 needs review', pending_check: ' · B-12 dock check pending', verification_review: ' · B-12 staff evidence in', resolved: ' · B-12 resolved' };

export function DayScrubber() {
  const state = useAppState();
  const store = useStore();
  const announce = useAnnounce();
  const id = useId();
  const glide = useRef<number | null>(null);
  useEffect(() => () => {
    if (glide.current) cancelAnimationFrame(glide.current);
  }, []);
  if (!state || !store) return null;
  const fx = state.fixtures;
  const { from, to } = dayBounds(fx);
  const start = Date.parse(from);
  const span = (Date.parse(to) - start) / MINUTE_MS;
  const replay = state.view.mode === 'replay' ? state.view : null;
  const shown = replay ? replay.at : state.interactive.clock;
  const minute = Math.round((Date.parse(shown) - start) / MINUTE_MS);
  const s = activeSession(state);
  const stage = STAGE_TEXT[scenarioStage(fx, s)] ?? '';

  const show = (m: number) => store.viewTimeline(toIso(start + Math.max(0, Math.min(span, m)) * MINUTE_MS));
  const go = (target: number) => {
    if (glide.current) cancelAnimationFrame(glide.current);
    if (!replay) announce(`Day timeline: the scripted day, read-only. Your run stays at ${formatClock(state.interactive.clock)}.`);
    const from_ = minute;
    if (Math.abs(target - from_) <= 15 || prefersReducedMotion()) return show(target);
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / GLIDE_MS);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      show(Math.round(from_ + (target - from_) * e));
      glide.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    step();
  };
  // Scenario checkpoints, as ticks on the track.
  const ticks = Object.entries(fx.scenario.checkpoints).map(([k, t]) => ({ k, left: ((Date.parse(t) - start) / MINUTE_MS / span) * 100 }));

  return (
    <div className="day-scrubber" data-testid="day-scrubber">
      <div className="day-scrubber-head">
        <label className="label" htmlFor={id}>
          Day timeline
        </label>
        <output className="data day-scrubber-time" htmlFor={id}>
          {formatClock(shown)}
        </output>
      </div>
      <div className="day-scrubber-track">
        <input
          id={id}
          type="range"
          min={0}
          max={span}
          step={1}
          value={Math.max(0, Math.min(span, minute))}
          aria-valuetext={`${formatClock(shown)} EDT${stage}`}
          onChange={(e) => go(Number(e.currentTarget.value))}
        />
        <span className="day-scrubber-ticks" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t.k} className="day-tick" style={{ left: `${t.left}%` }} />
          ))}
        </span>
        <span className="day-scrubber-ends body-sm secondary" aria-hidden="true">
          <span>06:00</span>
          <span>14:00</span>
          <span>22:00</span>
        </span>
      </div>
      <p className="body-sm secondary day-scrubber-note">
        {replay ? `Viewing ${formatClock(shown)}. Your run is saved at ${formatClock(state.interactive.clock)}.` : 'Scrub to preview the day. Your run stays unchanged.'}
      </p>
    </div>
  );
}
