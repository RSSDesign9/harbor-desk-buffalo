/**
 * Fit-aware assignment (TASKS T30, PRD F20; lake conditions T35, PRD F23 option E). Pure and deterministic: a
 * verdict for a transient request in a slip, from the slip's assumed length class and width (SRC-SLIPS, ASSUME),
 * its assumed depth, shore power, exposure and fixed-deck height (SRC-SERVICES / SRC-LAKE, ASSUME), the request's
 * SIM dimensions and, with T35, the simulated lake over the stay. An illustration of the dockmaster's reasoning,
 * never berth-fit or navigation advice.
 *
 * Thresholds (inclusive at the better side, so a boundary value gets the better verdict):
 *   LOA          fits ≤ slip length · tight ≤ slip length + 8 % (overhang) · no fit beyond
 *   Beam         clearance = slip width − beam: fits ≥ 2 ft · tight ≥ 1 ft · no fit below
 *   Draft        under-keel = depth + the stay's LOW water − draft: fits ≥ 2 ft · tight ≥ 1 ft · no fit below
 *   Shore power  fits with an outlet ≥ the request · tight with a smaller outlet (adapter, reduced load) · no fit without power
 *   Fixed deck   (fixed docks, T35) deck height − the stay's HIGH water: fits ≥ 1.5 ft · tight ≥ 0.5 ft · no fit below (awash)
 *   Exposure     (open berths, T35) strongest wind from the open sector: fits < 20 kt · tight < 34 kt · no fit from 34 kt (gale)
 * The overall verdict is the worst check; the reason shown first is that check's (ties: LOA, beam, draft, power,
 * deck, exposure). Without lake conditions (or in the calm what-if, which never drops below still water and keeps
 * open berths under 20 kt) the verdicts and reasons are exactly the T30 ones.
 */
import type { DemoSession } from './session.ts';
import type { FixtureBundle, LakeScenarioId, Slip, SlipService, TransientRequest } from './types.ts';
import { compass, conditionsForRequest, EXPOSED_TIGHT_KT, GALE_KT, signedFt, whenLabel, type StayConditions } from './lake.ts';
import { activeAssignmentForSlip, slipPresence } from './selectors.ts';

export type Verdict = 'fits' | 'tight' | 'no-fit';
export type Criterion = 'loa' | 'beam' | 'draft' | 'power' | 'deck' | 'exposure';
export interface CriterionCheck {
  criterion: Criterion;
  verdict: Verdict;
  /** Plain-language reason, e.g. “Draft 4.5 ft in 5.5 ft of water: 1 ft under the keel”. */
  reason: string;
}
export interface FitResult {
  slipId: string;
  verdict: Verdict;
  /** The deciding criterion's reason. */
  reason: string;
  checks: readonly CriterionCheck[];
}

export const LOA_OVERHANG_TIGHT = 0.08;
export const BEAM_CLEARANCE_FT = { fits: 2, tight: 1 } as const;
export const UNDER_KEEL_FT = { fits: 2, tight: 1 } as const;
export const DECK_MARGIN_FT = { fits: 1.5, tight: 0.5 } as const;

const RANK: Record<Verdict, number> = { fits: 0, tight: 1, 'no-fit': 2 };
export const VERDICT_LABEL: Record<Verdict, string> = { fits: 'Fits', tight: 'Tight', 'no-fit': 'No fit' };
/** Round to 0.1 ft for display and to keep float noise out of the thresholds. */
const r1 = (n: number) => Math.round(n * 10) / 10;
const ft = (n: number) => `${r1(n)}\u00a0ft`;

type Req = Pick<TransientRequest, 'loa_ft' | 'beam_ft' | 'draft_ft' | 'powerA'>;

type Svc = Pick<SlipService, 'depth_ft' | 'shorePowerA'> & Partial<Pick<SlipService, 'exposure' | 'deckFreeboard_ft'>>;

export function checkFit(req: Req, slip: Pick<Slip, 'id' | 'length_ft' | 'width_ft'>, svc: Svc, lake: StayConditions | null = null): FitResult {
  const checks: CriterionCheck[] = [];
  const over = r1(req.loa_ft - slip.length_ft);
  checks.push({
    criterion: 'loa',
    verdict: over <= 0 ? 'fits' : over <= r1(slip.length_ft * LOA_OVERHANG_TIGHT) ? 'tight' : 'no-fit',
    reason: over <= 0 ? `LOA ${ft(req.loa_ft)} in a ${ft(slip.length_ft)} slip` : `LOA ${ft(req.loa_ft)} overhangs the ${ft(slip.length_ft)} slip by ${ft(over)}`,
  });
  const clear = r1(slip.width_ft - req.beam_ft);
  checks.push({
    criterion: 'beam',
    verdict: clear >= BEAM_CLEARANCE_FT.fits ? 'fits' : clear >= BEAM_CLEARANCE_FT.tight ? 'tight' : 'no-fit',
    reason: clear >= 0 ? `Beam ${ft(req.beam_ft)} in a ${ft(slip.width_ft)} slip: ${ft(clear)} clearance` : `Beam ${ft(req.beam_ft)} is wider than the ${ft(slip.width_ft)} slip`,
  });
  const low = lake ? r1(lake.low.level_ft) : 0;
  const water = r1(svc.depth_ft + low);
  const keel = r1(water - req.draft_ft);
  const keelText = keel >= 0 ? `${ft(keel)} under the keel` : 'aground';
  checks.push({
    criterion: 'draft',
    verdict: keel >= UNDER_KEEL_FT.fits ? 'fits' : keel >= UNDER_KEEL_FT.tight ? 'tight' : 'no-fit',
    reason:
      lake && low !== 0
        ? `Draft ${ft(req.draft_ft)} in ${ft(water)} of water at the ${whenLabel(lake.low.at, lake.day)} ${low < 0 ? 'low' : 'level'} (${ft(svc.depth_ft)} assumed, ${signedFt(low)}): ${keelText}`
        : `Draft ${ft(req.draft_ft)} in ${ft(svc.depth_ft)} of water (assumed): ${keelText}`,
  });
  const best = Math.max(0, ...svc.shorePowerA);
  checks.push({
    criterion: 'power',
    verdict: best >= req.powerA ? 'fits' : best > 0 ? 'tight' : 'no-fit',
    reason: best >= req.powerA ? `${req.powerA}\u00a0A shore power available` : best > 0 ? `Needs ${req.powerA}\u00a0A; only ${best}\u00a0A here (adapter, reduced load)` : `Needs ${req.powerA}\u00a0A; no shore power`,
  });
  if (lake && svc.deckFreeboard_ft != null) {
    const high = r1(lake.high.level_ft);
    const margin = r1(svc.deckFreeboard_ft - high);
    const when = whenLabel(lake.high.at, lake.day);
    checks.push({
      criterion: 'deck',
      verdict: margin >= DECK_MARGIN_FT.fits ? 'fits' : margin >= DECK_MARGIN_FT.tight ? 'tight' : 'no-fit',
      reason:
        margin < 0
          ? `Fixed deck awash at the ${when} high water (${signedFt(high)})`
          : high > 0
            ? `Fixed deck ${ft(margin)} above the ${when} high water (${signedFt(high)})`
            : `Fixed deck ${ft(margin)} above still water`,
    });
  }
  if (lake && svc.exposure === 'open') {
    const w = lake.onshore;
    const dir = `Open berth, ${compass(w.windFromDeg)} wind ${w.wind_kt}\u00a0kt (gusts ${w.gust_kt}) at ${whenLabel(w.at, lake.day)}`;
    checks.push({
      criterion: 'exposure',
      verdict: w.wind_kt >= GALE_KT ? 'no-fit' : w.wind_kt >= EXPOSED_TIGHT_KT ? 'tight' : 'fits',
      reason: w.wind_kt >= GALE_KT ? `${dir}: gale` : w.wind_kt >= EXPOSED_TIGHT_KT ? `${dir}: surge and chop in the slip` : `Open berth; onshore wind stays under ${EXPOSED_TIGHT_KT}\u00a0kt`,
    });
  }
  const worst = checks.reduce((w, c) => (RANK[c.verdict] > RANK[w.verdict] ? c : w), checks[0]!);
  return { slipId: slip.id, verdict: worst.verdict, reason: worst.reason, checks };
}

/**
 * Slips that may be offered for a request at the clock: no agreement covers tonight, no demo assignment holds
 * it, and nothing is reported in it. Assigned or occupied slips are never offered (PRD F20).
 */
export function offeredSlips(fx: FixtureBundle, s: DemoSession): Slip[] {
  const night = fx.scenario.date;
  return fx.slips.filter(
    (sl) =>
      !fx.agreements.some((a) => a.slipId === sl.id && a.status === 'active' && a.start <= night && a.end > night) &&
      !activeAssignmentForSlip(s, sl.id) &&
      slipPresence(fx, s, sl.id).current !== 'present',
  );
}

/** Verdicts for every offered slip under a lake what-if (T35; calm by default), best first (then by slip ID). */
export function verdictsFor(fx: FixtureBundle, s: DemoSession, requestId: string, lake: LakeScenarioId = 'calm'): FitResult[] {
  const req = fx.transientRequests.find((r) => r.id === requestId);
  if (!req) return [];
  const svc = new Map(fx.slipServices.map((v) => [v.slipId, v]));
  const cond = conditionsForRequest(fx, req, lake);
  return offeredSlips(fx, s)
    .flatMap((sl) => {
      const v = svc.get(sl.id);
      return v ? [checkFit(req, sl, v, cond)] : [];
    })
    .sort((a, b) => RANK[a.verdict] - RANK[b.verdict] || a.slipId.localeCompare(b.slipId, 'en', { numeric: true }));
}
