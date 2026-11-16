/**
 * Which placeholder hull (if any) the scene draws in a slip. Pure; derived from the shared selectors.
 *
 * - Drawn only where the last report said “present” (stale reports are drawn faded, never removed as “empty”).
 * - A registry record alone never creates a boat; an away vessel is never drawn at its berth.
 * - A presence run that began as an unidentified camera observation keeps the SAME generic hull after an
 *   identity decision, so resolution relabels the boat without moving or reshaping it (PRD §7, resolved row).
 */
import type { DemoSession } from '../domain/session.ts';
import type { FixtureBundle, ModelAssetKey, Vessel } from '../domain/types.ts';
import { slipIdentity, slipPresence } from '../domain/selectors.ts';

export interface HullSpec {
  /** Stable React key for the physical hull in this presence run. */
  key: string;
  family: ModelAssetKey;
  lengthFt: number;
  beamFt: number;
  hullColor: Vessel['hullColor'];
  canvas: Vessel['canvasColor'];
  /** Unidentified at first observation (generic geometry, simulated-object contour). */
  observed: boolean;
  /** Current presence is not confirmed (stale/unknown); draw faded. */
  stale: boolean;
}

export function hullForSlip(fx: FixtureBundle, s: DemoSession, slipId: string): HullSpec | null {
  const p = slipPresence(fx, s, slipId);
  if (p.lastReported?.presence !== 'present') return null;
  const slip = fx.slips.find((x) => x.id === slipId);
  if (!slip) return null;
  const id = slipIdentity(fx, s, slipId);
  const stale = p.current !== 'present';
  const vessel = id.state === 'confirmed' && id.basis !== 'identity-decision' ? fx.vessels.find((v) => v.id === id.vesselId) : undefined;
  if (vessel) {
    return { key: `vessel:${vessel.id}`, family: vessel.modelAssetKey, lengthFt: vessel.loa_ft, beamFt: vessel.beam_ft ?? vessel.loa_ft * 0.34, hullColor: vessel.hullColor, canvas: vessel.canvasColor, observed: false, stale };
  }
  // Unidentified (or identified later by decision): generic cabin-cruiser placeholder sized to the slip class,
  // with a sand cover (“canvas cover differs from the cover on record”). Nothing here encodes who it is.
  return { key: `observed:${slipId}`, family: 'cruiser', lengthFt: slip.length_ft - 1.5, beamFt: slip.width_ft - 1.3, hullColor: 'white', canvas: 'sand', observed: true, stale };
}

/**
 * Text for the hull's name board: only when an identity DECISION in this session confirmed who the observed
 * hull is (the reviewed B-12 hull after resolution). Unverified hulls never get one, and candidates never
 * count. Seed boats confirmed by the 07:30 walk are left without boards so the dock does not become a field
 * of labels.
 */
export function nameBoardForSlip(fx: FixtureBundle, s: DemoSession, slipId: string): { name: string; registrationSuffix: string | null } | null {
  const id = slipIdentity(fx, s, slipId);
  if (id.state !== 'confirmed' || id.basis !== 'identity-decision') return null;
  if (slipPresence(fx, s, slipId).lastReported?.presence !== 'present') return null;
  const v = fx.vessels.find((x) => x.id === id.vesselId);
  return v ? { name: v.name, registrationSuffix: v.registrationSuffix } : null;
}
