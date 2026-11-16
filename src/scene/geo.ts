/**
 * Local metric frame for Harbor Desk (PRD §8, TASKS T02).
 *
 * Source files stay WGS84 longitude/latitude. Everything rendered is converted at this boundary
 * into a local east/north tangent plane in metres around a fixed origin near slip B-12.
 * Scene axes (three.js, right-handed, Y up): x = east, y = up, z = south (z = -north).
 *
 * Method: equirectangular tangent-plane approximation using the WGS84 meridian (M) and prime-vertical (N)
 * radii of curvature at the origin latitude. Over the ~1.5 km working area the approximation error is
 * a few centimetres, far below the uncertainty of the source geometry (OSM, ~metres). This is not a survey datum.
 */

export const FEET_TO_METRES = 0.3048;

export const SITE_ORIGIN = Object.freeze({
  lat: 42.8742,
  lon: -78.8806,
  note: 'Rounded WGS84 point near slip B-12; chosen for readability, not a surveyed control point.',
});

const WGS84_A = 6378137;
const WGS84_E2 = 6.69437999014e-3;
const DEG = Math.PI / 180;

export interface LonLat {
  lon: number;
  lat: number;
}
export interface EastNorth {
  east: number;
  north: number;
}
export type ScenePoint = readonly [x: number, y: number, z: number];

function radii(latDeg: number): { m: number; n: number } {
  const s = Math.sin(latDeg * DEG);
  const w = 1 - WGS84_E2 * s * s;
  return { m: (WGS84_A * (1 - WGS84_E2)) / Math.pow(w, 1.5), n: WGS84_A / Math.sqrt(w) };
}

const { m: M0, n: N0 } = radii(SITE_ORIGIN.lat);
const COS0 = Math.cos(SITE_ORIGIN.lat * DEG);

export function toLocal(p: LonLat): EastNorth {
  return {
    east: (p.lon - SITE_ORIGIN.lon) * DEG * N0 * COS0,
    north: (p.lat - SITE_ORIGIN.lat) * DEG * M0,
  };
}

export function fromLocal(p: EastNorth): LonLat {
  return {
    lon: SITE_ORIGIN.lon + p.east / (N0 * COS0) / DEG,
    lat: SITE_ORIGIN.lat + p.north / M0 / DEG,
  };
}

/** GeoJSON position ([lon, lat]) to local metres. */
export function positionToLocal(pos: readonly number[]): EastNorth {
  const [lon, lat] = pos;
  if (lon === undefined || lat === undefined || !Number.isFinite(lon) || !Number.isFinite(lat)) {
    throw new RangeError(`Invalid GeoJSON position: ${JSON.stringify(pos)}`);
  }
  return toLocal({ lon, lat });
}

/** Local metres to three.js scene coordinates (x east, y up, z south). */
export function localToScene(p: EastNorth, up = 0): ScenePoint {
  return [p.east, up, -p.north];
}

export function feetToMetres(ft: number): number {
  return ft * FEET_TO_METRES;
}

/** Compass bearing (degrees clockwise from north) of the vector a→b in local metres. */
export function bearingDeg(a: EastNorth, b: EastNorth): number {
  const deg = Math.atan2(b.east - a.east, b.north - a.north) / DEG;
  return (deg + 360) % 360;
}
