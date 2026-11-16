/**
 * Lake conditions what-if (TASKS T35, PRD F23 option E), inside the incoming-request card.
 *
 * A two-way switch (Calm / SW gale) over the simulated lake series. It is a lens, not a record: it changes the
 * fit verdicts for the request (draft against the stay's low water, fixed decks against its high water, open
 * berths against the onshore wind), the wind and light in the scene, and nothing in the run. It works in the
 * replay timeline too, where the strip's cursor follows the scrubber.
 *
 * The strip plots the water level at the marina from 06:00 on the scenario day to the end of the stay: zero is the
 * still-water level the assumed depths refer to; the shaded band is the stay; the dot is the clock.
 */
import { useId } from 'react';
import { useAppState, useStore } from '../../app/AppStore.tsx';
import { activeSession } from '../../domain/store.ts';
import { compass, lakeAt, lakeScenario, LAKE_SCENARIO_IDS, signedFt, stayConditions, stayWindow, whenLabel } from '../../domain/lake.ts';
import { verdictsFor } from '../../domain/fit.ts';
import { formatClock, toMs } from '../../domain/time.ts';
import type { LakeScenarioId, TransientRequest } from '../../domain/types.ts';
import { useAnnounce } from '../../ui/Announcer.tsx';

const LABEL: Record<LakeScenarioId, string> = { calm: 'Calm', 'sw-gale': 'SW gale' };
/** Fixed vertical range so switching shows the difference: −2 … +5 ft. */
const Y_MIN = -2;
const Y_MAX = 5;
const W = 280;
const H = 32;

export function LakeConditions({ req }: { req: TransientRequest }) {
  const state = useAppState();
  const store = useStore();
  const announce = useAnnounce();
  const id = useId();
  if (!state || !store) return null;
  const fx = state.fixtures;
  const sc = lakeScenario(fx, state.lake);
  if (!sc) return null;
  const clock = activeSession(state).clock;
  const now = lakeAt(sc, clock);
  const window_ = stayWindow(req);
  const stay = stayConditions(sc, window_);
  const day = fx.scenario.date;

  const choose = (next: LakeScenarioId) => {
    if (next === state.lake) return;
    store.setLake(next);
    const v = verdictsFor(fx, activeSession(state), req.id, next);
    const n = (k: string) => v.filter((x) => x.verdict === k).length;
    const nextSc = lakeScenario(fx, next);
    const low = nextSc ? stayConditions(nextSc, window_).low : null;
    announce(
      `${LABEL[next]} what-if. ${low && low.level_ft < 0 ? `Low water ${signedFt(low.level_ft)} at ${whenLabel(low.at, day)} during the stay. ` : ''}` +
        `${req.vesselName}: ${n('fits')} fit, ${n('tight')} tight, ${n('no-fit')} no fit.`,
    );
  };

  // ---------- strip geometry ----------
  const t0 = toMs(sc.samples[0]!.at);
  const t1 = toMs(window_[1]);
  const x = (t: number) => ((t - t0) / (t1 - t0)) * W;
  const y = (lv: number) => ((Y_MAX - Math.max(Y_MIN, Math.min(Y_MAX, lv))) / (Y_MAX - Y_MIN)) * H;
  const pts = sc.samples.filter((s) => toMs(s.at) <= t1);
  const line = pts.map((s, i) => `${i ? 'L' : 'M'}${x(toMs(s.at)).toFixed(1)} ${y(s.level_ft).toFixed(1)}`).join(' ');
  const area = `${line} L${x(toMs(pts[pts.length - 1]!.at)).toFixed(1)} ${y(0).toFixed(1)} L0 ${y(0).toFixed(1)} Z`;
  const cx = x(Math.max(t0, Math.min(t1, toMs(clock))));
  const lowX = x(toMs(stay.low.at));
  const summary =
    `Water level ${signedFt(now.level_ft)} at ${formatClock(clock)}; ` +
    `during the stay, low ${signedFt(stay.low.level_ft)} at ${whenLabel(stay.low.at, day)} and high ${signedFt(stay.high.level_ft)} at ${whenLabel(stay.high.at, day)}.`;

  return (
    <section className="lake" aria-labelledby={`${id}-h`} data-testid="lake-conditions" data-lake={state.lake}>
      <div className="lake-head">
        <h3 className="label" id={`${id}-h`}>
          Lake
        </h3>
        <fieldset className="lake-switch">
          <legend className="sr-only">Lake what-if</legend>
          {LAKE_SCENARIO_IDS.map((k) => (
            <label key={k} className="lake-option">
              <input type="radio" name={`${id}-lake`} value={k} checked={state.lake === k} onChange={() => choose(k)} aria-label={k === 'sw-gale' ? 'SW gale (what-if)' : LABEL[k]} />
              <span aria-hidden="true">{LABEL[k]}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <p className="data lake-now" data-testid="lake-now">
        {formatClock(clock)} · {compass(now.windFromDeg)} {now.wind_kt}&nbsp;kt, gusts {now.gust_kt} · level {signedFt(now.level_ft)}
      </p>
      <svg className="lake-strip" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={summary} data-testid="lake-strip">
        <rect className="lake-stay" x={x(toMs(window_[0]))} y={0} width={W - x(toMs(window_[0]))} height={H} />
        <line className="lake-zero" x1={0} x2={W} y1={y(0)} y2={y(0)} />
        <path className="lake-area" d={area} />
        <path className="lake-line" d={line} />
        {stay.low.level_ft < 0 ? <circle className="lake-low" cx={lowX} cy={y(stay.low.level_ft)} r={2.6} /> : null}
        <line className="lake-cursor" x1={cx} x2={cx} y1={0} y2={H} />
        <circle className="lake-dot" cx={cx} cy={y(now.level_ft)} r={3} />
      </svg>
      <p className="body-sm secondary lake-stayline" data-testid="lake-stay">
        {stay.low.level_ft < 0 ? `Stay low ${signedFt(stay.low.level_ft)} at ${whenLabel(stay.low.at, day)}` : 'Stay at or above still water'}
        {state.lake !== 'calm' ? ' · what-if' : ''}
      </p>
    </section>
  );
}
