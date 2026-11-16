/**
 * Authored approach paths (TASKS T30/T31, PRD F20/F21). Pure: a boat's pose along its way between the channel
 * and its berth, in local metres ([east, north], yaw CCW from east as in layout.ts).
 *
 * Every berth gets the same three-part path, built from its own geometry:
 *   berth ──straight out along the slip axis──▶ turning point (25 m off the slip mouth)
 *   turning point ──smooth curve──▶ channel point (45 m off the docks, 150 m along them toward the river mouth)
 * Departure: bow first out of the slip (boats lie bow out, layout.ts), then follow the curve into the channel.
 * Arrival: along the curve bow first, turn on the spot at the turning point, then back stern first into the slip.
 *
 * Position and yaw are continuous in the progress parameter, so a boat moving along a path never jumps
 * (“no hull teleports”): tests/unit/approach.test.ts samples every berth.
 */
import type { SlipGeom } from '../data/site.ts';
import { placeBoat, slipAxes, type BoatPlacement } from './layout.ts';

export type Pose2 = { center: [number, number]; yaw: number };

const TURN_OFF_M = 25;
const CHANNEL_OFF_M = 45;
const CHANNEL_ALONG_M = 150;
/** Share of an arrival spent on the curve, turning, and backing in. */
const ARRIVE_CURVE = 0.6;
const ARRIVE_TURN = 0.75;

/** Toward the river mouth: the along-dock direction with a north-west component (Dock A side). */
function towardMouth(s: SlipGeom): [number, number] {
  const { along } = slipAxes(s);
  return along[1] - along[0] >= 0 ? along : [-along[0], -along[1]];
}

const lerp = (a: readonly [number, number], b: readonly [number, number], k: number): [number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const smooth = (k: number) => k * k * (3 - 2 * k);
/** Shortest signed angle from a to b. */
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export interface ApproachPath {
  placement: BoatPlacement;
  /** Bow out of the slip and away into the channel, u ∈ [0, 1]. */
  departure(u: number): Pose2;
  /** From the channel into the slip, s ∈ [0, 1]; ends exactly at the berthed placement. */
  arrival(s: number): Pose2;
}

export function approachPath(s: SlipGeom, lengthFt: number, beamFt: number): ApproachPath {
  const placement = placeBoat(s, lengthFt, beamFt);
  const { out } = slipAxes(s);
  const berth = placement.center;
  const turnPt: [number, number] = [s.outer[0] + out[0] * TURN_OFF_M, s.outer[1] + out[1] * TURN_OFF_M];
  const m = towardMouth(s);
  const channel: [number, number] = [s.outer[0] + out[0] * CHANNEL_OFF_M + m[0] * CHANNEL_ALONG_M, s.outer[1] + out[1] * CHANNEL_OFF_M + m[1] * CHANNEL_ALONG_M];
  // Quadratic curve: leaves the turning point straight out along the slip axis, bends toward the channel point.
  const ctrl: [number, number] = [turnPt[0] + out[0] * 22, turnPt[1] + out[1] * 22];
  const curve = (k: number): [number, number] => lerp(lerp(turnPt, ctrl, k), lerp(ctrl, channel, k), k);
  const tangent = (k: number): number => {
    const d0 = lerp([ctrl[0] - turnPt[0], ctrl[1] - turnPt[1]], [channel[0] - ctrl[0], channel[1] - ctrl[1]], k);
    return Math.atan2(d0[1], d0[0]);
  };
  const outYaw = placement.yaw; // bow toward open water
  const straightLen = Math.hypot(turnPt[0] - berth[0], turnPt[1] - berth[1]);
  const curveLen = 2 * Math.hypot(channel[0] - turnPt[0], channel[1] - turnPt[1]) * 0.6;
  const split = straightLen / (straightLen + curveLen); // departure: share of progress on the straight

  const departure = (u: number): Pose2 => {
    const k = Math.min(1, Math.max(0, u));
    if (k <= split) return { center: lerp(berth, turnPt, k / split), yaw: outYaw };
    const c = (k - split) / (1 - split);
    return { center: curve(c), yaw: outYaw + turn(outYaw, tangent(c)) };
  };

  const arrival = (sp: number): Pose2 => {
    const k = Math.min(1, Math.max(0, sp));
    if (k <= ARRIVE_CURVE) {
      // Channel → turning point, bow first: the departure curve run backwards, facing the way it travels.
      const c = 1 - k / ARRIVE_CURVE;
      return { center: curve(c), yaw: tangent(c) + Math.PI };
    }
    const inward = tangent(0) + Math.PI;
    if (k <= ARRIVE_TURN) {
      // Turn on the spot to bring the bow back out (shortest way round).
      const t = smooth((k - ARRIVE_CURVE) / (ARRIVE_TURN - ARRIVE_CURVE));
      return { center: turnPt, yaw: inward + turn(inward, outYaw) * t };
    }
    // Back in, stern first, slowing to a stop at the berth.
    const t = (k - ARRIVE_TURN) / (1 - ARRIVE_TURN);
    const eased = 1 - (1 - t) * (1 - t);
    return { center: lerp(turnPt, berth, eased), yaw: inward + turn(inward, outYaw) };
  };

  return { placement, departure, arrival };
}

/** Sim minutes a scheduled arrival or departure spends in transit after its log entry (T31). */
export const TRANSIT_MINUTES = 6;
