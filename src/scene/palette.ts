/**
 * Scene material colours. Token-backed values must equal design/tokens.json (tests/unit/scene-layout.test.ts).
 * SCENE_COLORS are the T09 near-scene materials: daylight tones chosen against design/visual-target-v2.png,
 * kept restrained (no saturated “toy” greens or blues). They are scene materials, not UI tokens.
 */
export const TOKEN_COLORS = {
  midnight: '#011b2b',
  riverWater: '#4e6d98', // color.river-water (MEASURED)
  lakeSky: '#91a8c3', // color.lake-sky (MEASURED)
  sand: '#e6e5df', // color.sand
  sandDark: '#bbb9ad', // color.sand-dark — dock decking (DESIGN §5.3)
  siloConcrete: '#7b7265', // color.silo-concrete
  forest: '#465243', // color.forest — foliage / hulls
  rust: '#a15842', // color.rust — hulls
  slate: '#73859f', // color.slate — hulls
  mist100: '#eaf1f4', // color.mist-100 — white gelcoat
  silo_blue: '#284878', // color.silo-blue — navy canvas
  limestone: '#e7ebed', // color.limestone
  signal: '#ff4d00', // color.signal — selection outline only
  chartCyan: '#7fd1e8', // color.chart-cyan — hover outline
  warning: '#ffac00', // color.warning — needs-review marker
  chartGreen: '#77e137', // color.chart-green — dock map: reserved
} as const;

/**
 * Dock-map plates (T29). Token colours; the legend (src/features/view/map-legend.css) uses the same tokens and
 * the same water behind its swatches. Each status also has its own pattern (Marina.tsx), never colour alone.
 */
export const MAP_COLORS = {
  occupied: TOKEN_COLORS.lakeSky,
  away: TOKEN_COLORS.chartCyan,
  reserved: TOKEN_COLORS.chartGreen,
  review: TOKEN_COLORS.warning,
  vacant: TOKEN_COLORS.limestone,
  /** Water under the map: SCENE_COLORS.water darkened so light plates read (= --plate-water in map-legend.css). */
  water: '#2f4a4d',
  /** Drag-to-assign verdicts (T30). Tokens: chart-green, warning, error-fill. */
  fits: TOKEN_COLORS.chartGreen,
  tight: TOKEN_COLORS.warning,
  noFit: '#dc3127',
} as const;

export const SCENE_COLORS = {
  sky: '#c9d6e2', // daylight haze at the horizon
  skyZenith: '#8fb0d2',
  skyFill: '#b9cbe0', // hemisphere fill from above
  skyGround: '#5d6a66', // what glossy surfaces reflect below the horizon
  skyBounce: '#8a8672', // hemisphere fill from below: light bounced off sunlit ground (T33)
  grass: '#7a9156', // mown lawn, muted
  grassDark: '#6c7f4e',
  paving: '#c6c3b8', // promenade concrete
  pavingJoint: '#9d9a8f', // saw-cut joints in the walk (T33)
  yard: '#a9a8a1', // working-yard and storage hardstanding
  asphalt: '#8a8a87',
  gravel: '#b3ad9f', // boat-storage hard-standing
  dryGrass: '#8b9167', // unmown ground on the peninsula (approximate context)
  wharf: '#b9b6ac', // north-bank wharf paving (approximate context)
  bankWall: '#9a958b',
  pile: '#6b6257',
  glass: '#5d7286', // tinted glazing: fully reflective, so it shows the sky gradient darkened by this tint
  leaf: '#6f8a4a',
  canvasSand: '#b9ae97', // “sand” canvas: sand-dark warmed toward duck cloth
  water: '#4b6c70', // calm river surface in daylight: river-water token shifted toward the v2 teal-grey
} as const;

/** @deprecated Batch 3 name; kept so older imports keep compiling. */
export const PLACEHOLDER_COLORS = SCENE_COLORS;
