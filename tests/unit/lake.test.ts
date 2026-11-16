/**
 * T35 — Buffalo seiche and gale what-if feeding the T30 fit verdicts (PRD F23 option E).
 */
import { describe, expect, it } from 'vitest';
import { loadFixtures, rawFixtures } from '../../src/data/fixtures.ts';
import { loadFromRaw, type RawFixtures } from '../../src/data/assemble.ts';
import { apply } from '../../src/domain/engine.ts';
import { checkFit, offeredSlips, verdictsFor, DECK_MARGIN_FT } from '../../src/domain/fit.ts';
import { compass, conditionsForRequest, EXPOSED_TIGHT_KT, GALE_KT, lakeAt, lakeScenario, signedFt, stayConditions, stayWindow, type StayConditions } from '../../src/domain/lake.ts';
import { seedSession } from '../../src/domain/session.ts';
import { createStore } from '../../src/domain/store.ts';
import { isConsistentSession, loadSession, memoryStorage, saveSession, STORAGE_KEY } from '../../src/domain/persistence.ts';
import { toMs } from '../../src/domain/time.ts';
import { sceneWeather } from '../../src/scene/weather.ts';
import { daylightAt, overcast } from '../../src/scene/daylight.ts';
import type { LakeScenario } from '../../src/domain/types.ts';

const fx = loadFixtures().bundle;
const seed = seedSession(fx);
const req = fx.transientRequests[0]!;
const calm = lakeScenario(fx, 'calm')!;
const gale = lakeScenario(fx, 'sw-gale')!;
const iso = (local: string, day = 15) => {
  const [h, m] = local.split(':').map(Number) as [number, number];
  return new Date(Date.UTC(2026, 6, day, h + 4, m)).toISOString().replace('.000Z', 'Z');
};
const by = (r: ReturnType<typeof checkFit>, c: string) => r.checks.find((x) => x.criterion === c);
const cond = (o: Partial<StayConditions> = {}): StayConditions => ({
  scenario: 'sw-gale',
  day: '2026-07-15',
  low: { level_ft: 0, at: iso('16:00') },
  high: { level_ft: 0, at: iso('16:00') },
  onshore: { wind_kt: 0, gust_kt: 0, windFromDeg: 0, at: iso('16:00') },
  ...o,
});

describe('lake series (T35 fixtures)', () => {
  it('ships both what-ifs, SIM, every 15 min, covering the scenario day and the whole stay', () => {
    expect(fx.lakeScenarios.map((l) => l.id)).toEqual(['calm', 'sw-gale']);
    for (const l of fx.lakeScenarios) {
      expect(l.provenance).toBe('SIM');
      expect(l.samples[0]!.at).toBe(iso('06:00'));
      const step = new Set(l.samples.slice(1).map((s, i) => toMs(s.at) - toMs(l.samples[i]!.at)));
      expect([...step]).toEqual([15 * 60000]);
      expect(toMs(l.samples.at(-1)!.at)).toBeGreaterThanOrEqual(toMs(stayWindow(req)[1]));
    }
    expect(fx.sources.find((s) => s.id === 'SRC-LAKE')).toMatchObject({ provenance: 'ASSUME' });
    expect(fx.sources.find((s) => s.id === 'SRC-NWS-MARINE')).toMatchObject({ provenance: 'DOC', url: expect.stringContaining('weather.gov') });
  });

  it('calm never drops below still water and keeps the onshore wind under the tight line', () => {
    expect(Math.min(...calm.samples.map((s) => s.level_ft))).toBe(0);
    expect(Math.max(...calm.samples.map((s) => s.wind_kt))).toBeLessThan(12);
  });

  it('the SW gale piles water up through the morning, then the lake sloshes back below still water', () => {
    expect(lakeAt(gale, iso('08:45'))).toMatchObject({ level_ft: 4, windFromDeg: 230 });
    expect(lakeAt(gale, iso('08:45')).wind_kt).toBeGreaterThanOrEqual(GALE_KT);
    expect(Math.max(...gale.samples.map((s) => s.level_ft))).toBe(4.4);
    const st = stayConditions(gale, stayWindow(req));
    expect(st.low).toEqual({ level_ft: -1.5, at: iso('18:45') });
    // The next swing is weaker: the seiche is damped.
    const later = gale.samples.filter((s) => toMs(s.at) > toMs(iso('22:00')));
    expect(Math.max(...later.map((s) => s.level_ft))).toBeLessThan(1);
    expect(Math.min(...later.map((s) => s.level_ft))).toBeGreaterThan(-1.5);
  });

  it('interpolates between samples, holds at the ends and turns the short way round', () => {
    const sc: LakeScenario = { ...calm, samples: [
      { at: iso('06:00'), level_ft: 0, windFromDeg: 350, wind_kt: 10, gust_kt: 12 },
      { at: iso('06:15'), level_ft: 1, windFromDeg: 10, wind_kt: 20, gust_kt: 24 },
    ] };
    expect(lakeAt(sc, '2026-07-15T10:07:30Z')).toMatchObject({ level_ft: 0.5, windFromDeg: 0, wind_kt: 15 });
    expect(lakeAt(sc, iso('05:00'))).toMatchObject({ level_ft: 0, wind_kt: 10 });
    expect(lakeAt(sc, iso('09:00'))).toMatchObject({ level_ft: 1, wind_kt: 20 });
  });

  it('words directions and offsets plainly', () => {
    expect([compass(225), compass(0), compass(359), compass(250)]).toEqual(['SW', 'N', 'N', 'WSW']);
    expect([signedFt(4.4), signedFt(-1.5), signedFt(0)]).toEqual(['+4.4\u00a0ft', '−1.5\u00a0ft', '0\u00a0ft']);
  });
});

describe('fit verdicts under the lake what-if (T35)', () => {
  it('calm gives exactly the T30 verdict and deciding reason on every slip', () => {
    const c = conditionsForRequest(fx, req, 'calm')!;
    for (const sl of fx.slips) {
      const svc = fx.slipServices.find((v) => v.slipId === sl.id)!;
      const t30 = checkFit(req, sl, svc);
      const t35 = checkFit(req, sl, svc, c);
      expect([t35.verdict, t35.reason], sl.id).toEqual([t30.verdict, t30.reason]);
    }
    expect(verdictsFor(fx, seed, req.id, 'calm')).toEqual(verdictsFor(fx, seed, req.id).map((v) => ({ ...v })));
  });

  it('under the SW gale, the stay’s low water decides: only the deepest canal berth is still tight', () => {
    const before = verdictsFor(fx, seed, req.id, 'calm');
    const after = verdictsFor(fx, seed, req.id, 'sw-gale');
    expect(after.map((v) => v.slipId).sort()).toEqual(before.map((v) => v.slipId).sort()); // same slips offered
    expect(after.filter((v) => v.verdict !== 'no-fit').map((v) => [v.slipId, v.verdict])).toEqual([['D-01', 'tight']]);
    const d01 = after.find((v) => v.slipId === 'D-01')!;
    expect(d01.reason).toBe('Draft 4.5\u00a0ft in 5.5\u00a0ft of water at the 18:45 low (7\u00a0ft assumed, −1.5\u00a0ft): 1\u00a0ft under the keel');
    expect(after.find((v) => v.slipId === 'D-19')!.reason).toContain('aground');
    // Open river-mouth berths also carry the onshore-wind check.
    const a = after.find((v) => v.slipId.startsWith('A-'))!;
    expect(by(a, 'exposure')).toMatchObject({ verdict: 'tight' });
    expect(by(a, 'deck')).toMatchObject({ verdict: 'fits' });
  });

  it('fixed decks: awash or nearly so at the stay’s high water (floating docks have no deck check)', () => {
    const fixedSlip = fx.slips.find((s) => s.dock === 'E')!;
    const svc = fx.slipServices.find((v) => v.slipId === fixedSlip.id)!;
    expect(svc.deckFreeboard_ft).toBe(4);
    const at = (h: number) => by(checkFit(req, fixedSlip, svc, cond({ high: { level_ft: h, at: iso('13:00') } })), 'deck')!;
    expect(at(4 - DECK_MARGIN_FT.fits).verdict).toBe('fits');
    expect(at(4 - DECK_MARGIN_FT.fits + 0.1).verdict).toBe('tight');
    expect(at(4 - DECK_MARGIN_FT.tight).verdict).toBe('tight');
    expect(at(4 - DECK_MARGIN_FT.tight + 0.1).verdict).toBe('no-fit');
    expect(at(4.4).reason).toBe('Fixed deck awash at the 13:00 high water (+4.4\u00a0ft)');
    const floating = fx.slips.find((s) => s.dock === 'D')!;
    expect(by(checkFit(req, floating, fx.slipServices.find((v) => v.slipId === floating.id)!, cond({ high: { level_ft: 9, at: iso('13:00') } })), 'deck')).toBeUndefined();
  });

  it('exposure: open berths only, from 20 kt tight, from 34 kt (NWS gale) no fit', () => {
    const open = fx.slips.find((s) => s.id === 'B-12')!;
    const sheltered = fx.slips.find((s) => s.id === 'B-20')!;
    const svcOf = (id: string) => fx.slipServices.find((v) => v.slipId === id)!;
    expect([svcOf('A-01').exposure, svcOf('B-19').exposure, svcOf('B-20').exposure, svcOf('E-01').exposure]).toEqual(['open', 'open', 'sheltered', 'sheltered']);
    const wind = (kt: number) => cond({ onshore: { wind_kt: kt, gust_kt: kt + 8, windFromDeg: 230, at: iso('09:00') } });
    const v = (kt: number) => by(checkFit(req, open, svcOf('B-12'), wind(kt)), 'exposure')!;
    expect([v(EXPOSED_TIGHT_KT - 1).verdict, v(EXPOSED_TIGHT_KT).verdict, v(GALE_KT - 1).verdict, v(GALE_KT).verdict]).toEqual(['fits', 'tight', 'tight', 'no-fit']);
    expect(v(GALE_KT).reason).toBe('Open berth, SW wind 34\u00a0kt (gusts 42) at 09:00: gale');
    expect(by(checkFit(req, sheltered, svcOf('B-20'), wind(50)), 'exposure')).toBeUndefined();
  });

  it('only wind from the open sector counts, and times on later days carry the date', () => {
    const offshore: LakeScenario = { ...gale, samples: gale.samples.map((s) => ({ ...s, windFromDeg: 90 })) };
    expect(stayConditions(offshore, stayWindow(req)).onshore.wind_kt).toBe(0);
    const st = stayConditions(gale, stayWindow(req));
    expect(st.onshore.wind_kt).toBeGreaterThanOrEqual(EXPOSED_TIGHT_KT);
    const lateLow = cond({ low: { level_ft: -1, at: iso('03:00', 16) } });
    const d = fx.slips.find((s) => s.id === 'D-01')!;
    expect(by(checkFit(req, d, fx.slipServices.find((v) => v.slipId === 'D-01')!, lateLow), 'draft')!.reason).toContain('at the 03:00 16\u00a0Jul low');
  });
});

describe('assigning under a what-if (T35)', () => {
  it('the engine checks the fit under the command’s what-if and records it on the assignment', () => {
    expect(offeredSlips(fx, seed).map((s) => s.id)).toContain('D-19');
    expect(apply(fx, seed, { type: 'assignRequest', requestId: req.id, slipId: 'D-19', lake: 'sw-gale' })).toMatchObject({ ok: false, reason: 'no_fit' });
    const calmRun = apply(fx, seed, { type: 'assignRequest', requestId: req.id, slipId: 'D-19' });
    expect(calmRun.ok && calmRun.session.assignments[0]).toMatchObject({ slipId: 'D-19', lake: 'calm' });
    const galeRun = apply(fx, seed, { type: 'assignRequest', requestId: req.id, slipId: 'D-01', lake: 'sw-gale' });
    expect(galeRun.ok && galeRun.session.assignments[0]).toMatchObject({ slipId: 'D-01', lake: 'sw-gale' });
  });

  it('persists the what-if, rejects an unknown one, and still loads runs saved before T35', () => {
    const st = memoryStorage();
    const a = apply(fx, seed, { type: 'assignRequest', requestId: req.id, slipId: 'D-01', lake: 'sw-gale' }).session;
    saveSession(st, a);
    expect(loadSession(st, fx).session?.assignments[0]?.lake).toBe('sw-gale');
    expect(isConsistentSession(fx, { ...a, assignments: [{ ...a.assignments[0]!, lake: 'hurricane' }] })).toBe(false);
    const { lake: _l, ...old } = a.assignments[0]!;
    void _l;
    st.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, scenarioVersion: fx.scenario.scenarioVersion, session: { ...a, assignments: [old] } }));
    expect(loadSession(st, fx).notice).toBeNull();
  });

  it('the lens lives in the store, not the run: switching never touches or saves a session, and works in replay', () => {
    const storage = memoryStorage();
    const store = createStore(fx, { backend: 'memory', storage });
    const run = store.getState().interactive;
    expect(store.getState().lake).toBe('calm');
    store.setLake('sw-gale');
    expect(store.getState().lake).toBe('sw-gale');
    expect(store.getState().interactive).toBe(run);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    store.viewReplay('uncertain');
    store.setLake('calm');
    expect(store.getState()).toMatchObject({ lake: 'calm', view: { mode: 'replay' } });
    expect(createStore(fx, { backend: 'memory', storage: memoryStorage() }, { lake: 'sw-gale' }).getState().lake).toBe('sw-gale');
  });
});

describe('scene weather (T35)', () => {
  it('the calm day changes nothing in the scene (approved views, poster and evidence stay identical)', () => {
    for (const s of calm.samples) expect(sceneWeather(s), s.at).toMatchObject({ strength: 0, whitecaps: 0, overcast: 0 });
    const d = daylightAt(9 * 60);
    expect(overcast(d, 0)).toBe(d);
  });

  it('the gale roughens the water downwind, raises whitecaps and greys the sky', () => {
    const w = sceneWeather(lakeAt(gale, iso('08:45')));
    expect(w.strength).toBeGreaterThan(0.9);
    expect(w.whitecaps).toBe(1);
    expect(w.overcast).toBeGreaterThan(0.8);
    // From 230° the wind blows toward the north-east: +x (east), −z (north).
    expect(w.toward[0]).toBeGreaterThan(0.6);
    expect(w.toward[1]).toBeLessThan(-0.5);
    const d = daylightAt(9 * 60);
    expect(overcast(d, w.overcast).sunIntensity).toBeLessThan(d.sunIntensity * 0.6);
  });
});

describe('lake fixture validation (T35)', () => {
  const rawCopy = () => JSON.parse(JSON.stringify(rawFixtures())) as RawFixtures;
  const recs = (raw: RawFixtures, k: keyof RawFixtures['files']) => raw.files[k].records as Record<string, unknown>[];

  it('quarantines an unlabelled or broken series and flags a missing one', () => {
    let raw = rawCopy();
    recs(raw, 'lakeScenarios')[1]!.provenance = 'DOC';
    expect(loadFromRaw(raw).removed).toContainEqual({ collection: 'lakeScenarios', id: 'sw-gale' });
    raw = rawCopy();
    const samples = recs(raw, 'lakeScenarios')[0]!.samples as Record<string, unknown>[];
    samples.length = 40; // ends at 16:00, before the stay does
    expect(loadFromRaw(raw).issues.some((i) => i.message.includes('does not cover the stay'))).toBe(true);
    raw = rawCopy();
    raw.files.lakeScenarios.records = recs(raw, 'lakeScenarios').slice(0, 1);
    expect(loadFromRaw(raw).issues.some((i) => i.message === 'Lake scenario sw-gale is missing')).toBe(true);
  });

  it('a floating dock with a deck height, or a fixed dock without one, is set aside', () => {
    const raw = rawCopy();
    const svc = recs(raw, 'slipServices');
    svc.find((v) => v.slipId === 'D-01')!.deckFreeboard_ft = 3;
    svc.find((v) => v.slipId === 'E-01')!.deckFreeboard_ft = null;
    const removed = loadFromRaw(raw).removed;
    expect(removed).toContainEqual({ collection: 'slipServices', id: 'SVC-D-01' });
    expect(removed).toContainEqual({ collection: 'slipServices', id: 'SVC-E-01' });
  });
});
