import { describe, expect, it } from 'vitest';
import { loadFixtures } from '../../src/data/fixtures.ts';
import { apply } from '../../src/domain/engine.ts';
import { checkFit, offeredSlips, verdictsFor, BEAM_CLEARANCE_FT, LOA_OVERHANG_TIGHT, UNDER_KEEL_FT } from '../../src/domain/fit.ts';
import { buildSnapshot } from '../../src/domain/replay.ts';
import { seedSession } from '../../src/domain/session.ts';
import { activeAssignmentForSlip, mapSlipStatus, operatorSummary, unsoldNights } from '../../src/domain/selectors.ts';
import { isConsistentSession, loadSession, memoryStorage, saveSession, STORAGE_KEY } from '../../src/domain/persistence.ts';

const fx = loadFixtures().bundle;
const seed = seedSession(fx);
const req = fx.transientRequests[0]!;
const slip = (length_ft: number, width_ft: number) => ({ id: 'X-01', length_ft, width_ft });
const svc = (depth_ft: number, shorePowerA: number[] = [30, 50]) => ({ depth_ft, shorePowerA });
const base = { loa_ft: 36, beam_ft: 11.5, draft_ft: 4.5, powerA: 50 };
const by = (r: ReturnType<typeof checkFit>, c: string) => r.checks.find((x) => x.criterion === c)!;

describe('fit verdicts (T30, PRD F20)', () => {
  it('LOA: fits up to the slip length, tight to +8 %, no fit beyond (boundaries inclusive)', () => {
    expect(by(checkFit(base, slip(36, 20), svc(20)), 'loa').verdict).toBe('fits');
    expect(by(checkFit({ ...base, loa_ft: 36.1 }, slip(36, 20), svc(20)), 'loa').verdict).toBe('tight');
    const edge = 50 * (1 + LOA_OVERHANG_TIGHT); // 54 ft in a 50 ft slip
    expect(by(checkFit({ ...base, loa_ft: edge }, slip(50, 20), svc(20)), 'loa').verdict).toBe('tight');
    expect(by(checkFit({ ...base, loa_ft: edge + 0.1 }, slip(50, 20), svc(20)), 'loa').verdict).toBe('no-fit');
    expect(by(checkFit({ ...base, loa_ft: 37 }, slip(35, 20), svc(20)), 'loa').reason).toBe('LOA 37 ft overhangs the 35 ft slip by 2 ft');
  });

  it('beam clearance: fits from 2 ft, tight from 1 ft, no fit below (float noise does not flip a boundary)', () => {
    expect(by(checkFit(base, slip(40, base.beam_ft + BEAM_CLEARANCE_FT.fits), svc(20)), 'beam').verdict).toBe('fits');
    expect(by(checkFit(base, slip(40, 13.4999999), svc(20)), 'beam').verdict).toBe('fits');
    expect(by(checkFit(base, slip(40, base.beam_ft + 1.9), svc(20)), 'beam').verdict).toBe('tight');
    expect(by(checkFit(base, slip(40, base.beam_ft + BEAM_CLEARANCE_FT.tight), svc(20)), 'beam').verdict).toBe('tight');
    expect(by(checkFit(base, slip(40, base.beam_ft + 0.9), svc(20)), 'beam').verdict).toBe('no-fit');
    expect(by(checkFit(base, slip(40, 10), svc(20)), 'beam').reason).toContain('wider than');
  });

  it('draft: under-keel from the ASSUME depth; fits from 2 ft, tight from 1 ft, no fit below', () => {
    expect(by(checkFit(base, slip(40, 20), svc(base.draft_ft + UNDER_KEEL_FT.fits)), 'draft').verdict).toBe('fits');
    expect(by(checkFit(base, slip(40, 20), svc(base.draft_ft + UNDER_KEEL_FT.tight)), 'draft').verdict).toBe('tight');
    expect(by(checkFit(base, slip(40, 20), svc(base.draft_ft + 0.5)), 'draft').verdict).toBe('no-fit');
    expect(by(checkFit(base, slip(40, 20), svc(4)), 'draft').reason).toContain('aground');
    expect(by(checkFit(base, slip(40, 20), svc(5.5)), 'draft').reason).toContain('(assumed)');
  });

  it('power: an outlet ≥ the request fits, a smaller one is tight, none is no fit', () => {
    expect(by(checkFit(base, slip(40, 20), svc(20, [30, 50])), 'power').verdict).toBe('fits');
    expect(by(checkFit(base, slip(40, 20), svc(20, [30])), 'power').verdict).toBe('tight');
    expect(by(checkFit(base, slip(40, 20), svc(20, [])), 'power').verdict).toBe('no-fit');
  });

  it('the overall verdict is the worst criterion and its reason; ties go LOA, beam, draft, power', () => {
    const r = checkFit(base, slip(35, 12.5), svc(6, [30]));
    expect(r.verdict).toBe('tight');
    expect(r.reason).toContain('LOA'); // LOA, beam, draft and power are all tight here
    const n = checkFit(base, slip(40, 14), svc(5));
    expect(n.verdict).toBe('no-fit');
    expect(n.reason).toContain('Draft');
  });

  it('on the July morning the request shows all three verdicts, deterministically, on offered slips only', () => {
    const v = verdictsFor(fx, seed, req.id);
    expect(v).toEqual(verdictsFor(fx, seed, req.id));
    expect(new Set(v.map((x) => x.verdict))).toEqual(new Set(['fits', 'tight', 'no-fit']));
    const night = fx.scenario.date;
    for (const x of v) {
      expect(fx.agreements.some((a) => a.slipId === x.slipId && a.status === 'active' && a.start <= night && a.end > night), x.slipId).toBe(false);
      expect(mapSlipStatus(fx, seed, x.slipId)).toBe('vacant');
    }
    expect(v.map((x) => x.slipId)).not.toContain('B-12');
    expect(v.length).toBe(offeredSlips(fx, seed).length);
  });
});

describe('local assignments (T30)', () => {
  const fits = () => verdictsFor(fx, seed, req.id).find((x) => x.verdict === 'fits')!.slipId;
  const tight = () => verdictsFor(fx, seed, req.id).find((x) => x.verdict === 'tight')!.slipId;
  const noFit = () => verdictsFor(fx, seed, req.id).find((x) => x.verdict === 'no-fit')!.slipId;

  it('appends an assignment on a fitting or tight slip; the slip turns reserved, counts as occupied and is no longer offered', () => {
    for (const id of [fits(), tight()]) {
      const r = apply(fx, seed, { type: 'assignRequest', requestId: req.id, slipId: id });
      expect(r.ok && r.effect).toBe('changed');
      const s = r.session;
      expect(s.assignments).toEqual([expect.objectContaining({ id: 'ASN-0001', requestId: req.id, slipId: id, assignedAt: seed.clock, undoneAt: null, provenance: 'SIM' })]);
      expect(mapSlipStatus(fx, s, id)).toBe('reserved');
      expect(operatorSummary(fx, s).occupied).toBe(operatorSummary(fx, seed).occupied + 1);
      expect(offeredSlips(fx, s).map((x) => x.id)).not.toContain(id);
      expect(unsoldNights(fx, s, id)).toBe(unsoldNights(fx, seed, id) - req.nights);
      // Agreements, presence and the clock never move.
      expect(s.clock).toBe(seed.clock);
      expect(s.issues).toEqual(seed.issues);
    }
  });

  it('never offers or accepts held, occupied or no-fit slips, and one request holds one slip', () => {
    expect(apply(fx, seed, { type: 'assignRequest', requestId: req.id, slipId: 'B-12' })).toMatchObject({ ok: false, reason: 'slip_not_offered' });
    expect(apply(fx, seed, { type: 'assignRequest', requestId: req.id, slipId: noFit() })).toMatchObject({ ok: false, reason: 'no_fit' });
    expect(apply(fx, seed, { type: 'assignRequest', requestId: 'REQ-999', slipId: fits() })).toMatchObject({ ok: false, reason: 'unknown_request' });
    const once = apply(fx, seed, { type: 'assignRequest', requestId: req.id, slipId: fits() }).session;
    expect(apply(fx, once, { type: 'assignRequest', requestId: req.id, slipId: tight() })).toMatchObject({ ok: false, reason: 'already_assigned' });
    expect(apply(fx, once, { type: 'assignRequest', requestId: req.id, slipId: fits() })).toMatchObject({ ok: true, effect: 'unchanged' });
  });

  it('undo stamps the record (it stays in history) and frees the slip; a second undo changes nothing', () => {
    const id = fits();
    const a = apply(fx, seed, { type: 'assignRequest', requestId: req.id, slipId: id }).session;
    const u = apply(fx, a, { type: 'undoAssignment', assignmentId: 'ASN-0001' });
    expect(u.ok && u.effect).toBe('changed');
    expect(u.session.assignments).toEqual([expect.objectContaining({ id: 'ASN-0001', undoneAt: seed.clock })]);
    expect(activeAssignmentForSlip(u.session, id)).toBeNull();
    expect(mapSlipStatus(fx, u.session, id)).toBe('vacant');
    expect(apply(fx, u.session, { type: 'undoAssignment', assignmentId: 'ASN-0001' })).toMatchObject({ ok: true, effect: 'unchanged' });
    // Reassigning after undo appends a new record.
    const again = apply(fx, u.session, { type: 'assignRequest', requestId: req.id, slipId: tight() }).session;
    expect(again.assignments.map((x) => x.id)).toEqual(['ASN-0001', 'ASN-0002']);
  });

  it('persists, and a run saved before T30 (no assignments) still loads, with none', () => {
    const st = memoryStorage();
    const a = apply(fx, seed, { type: 'assignRequest', requestId: req.id, slipId: fits() }).session;
    saveSession(st, a);
    expect(loadSession(st, fx).session?.assignments).toEqual(a.assignments);
    const { assignments: _drop, ...old } = buildSnapshot(fx, 'uncertain', 'main');
    void _drop;
    expect(isConsistentSession(fx, old)).toBe(true);
    st.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, scenarioVersion: fx.scenario.scenarioVersion, session: old }));
    expect(loadSession(st, fx)).toMatchObject({ notice: null, session: { assignments: [] } });
    expect(isConsistentSession(fx, { ...a, assignments: [{ ...a.assignments[0], slipId: 'Z-99' }] })).toBe(false);
  });
});
