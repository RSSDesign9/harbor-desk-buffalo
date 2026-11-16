/**
 * Shared surface finishes for the authored assets. Token-backed colours come from TOKEN_COLORS
 * (design/tokens.json); the rest are scene materials recorded in design/ASSET-PLAN.md.
 * Roughness stays high on purpose: daylight sheen, no sparkle (PRD §9 rendering target).
 */
import { TOKEN_COLORS as T, SCENE_COLORS as S } from '../palette.ts';
import { finish, type Finish } from './mesh.ts';

// Surface kinds: see KIND in ../materials.ts (kept as literals here so the asset generators stay free of three materials).
const MINERAL = 1;
const FOLIAGE = 2;
const LAMP = 3;
const WINDOW = 4;

export const F = {
  gelcoat: finish(T.mist100, 0.34),
  nonskid: finish('#dde4e8', 0.8),
  sole: finish(T.sand, 0.85),
  cushion: finish('#efece4', 0.78),
  antifoul: finish('#1d2a3a', 0.75),
  rubRail: finish('#7d858c', 0.45, 0.35),
  stainless: finish('#c9ced2', 0.3, 0.85),
  alloy: finish('#b9bfc4', 0.45, 0.6),
  glass: finish(S.glass, 0.1, 1),
  vinyl: finish('#7d8c99', 0.18, 0.9),
  rubber: finish('#24282c', 0.7),
  engine: finish('#2a2f35', 0.38),
  fender: finish('#f3f2ec', 0.55),
  rope: finish('#d9d4c4', 0.9),
  // Dock and shore
  deckBoard: finish(T.sandDark, 0.88, 0, MINERAL),
  fascia: finish('#8f8a7c', 0.9, 0, MINERAL),
  float: finish('#3b3f42', 0.9),
  bumper: finish('#e9e8e2', 0.7),
  pile: finish(S.pile, 0.85, 0, MINERAL),
  pileCap: finish('#e4e6e4', 0.6),
  galvanized: finish('#a9aeb0', 0.55, 0.5),
  pedestal: finish('#f1f2f0', 0.5),
  pedestalFace: finish('#3d4a57', 0.35),
  lamp: finish('#fff4d6', 0.4, 0, LAMP),
  concrete: finish(S.paving, 0.92, 0, MINERAL),
  quayWall: finish(S.bankWall, 0.94, 0, MINERAL),
  rock: finish('#a7a49b', 0.95, 0, MINERAL),
  bark: finish('#5d5145', 0.95, 0, MINERAL),
  leaf: finish(S.leaf, 0.9, 0, FOLIAGE),
  leafDark: finish(T.forest, 0.92, 0, FOLIAGE),
  leafLight: finish('#86a05a', 0.9, 0, FOLIAGE),
  // Yard and surroundings (T15)
  elevator: finish('#b3aea3', 0.93, 0, MINERAL), // silo-concrete token lightened to sunlit weathered concrete
  elevatorDark: finish('#3c3a36', 0.6),
  metalWall: finish('#8e959a', 0.7, 0.15),
  metalRoof: finish('#6b737a', 0.55, 0.3),
  shedDoor: finish('#dcddd8', 0.6),
  officeWall: finish('#c9c4b6', 0.85, 0, MINERAL),
  standBlock: finish('#6f6455', 0.9, 0, MINERAL),
  standPaint: finish('#3d5a74', 0.6, 0.2),
  viaduct: finish('#a7a8a6', 0.85, 0, MINERAL),
  // T33
  window: finish('#4a5a6b', 0.12, 0.9, WINDOW),
  rust: finish('#7c5a48', 0.85, 0.1, MINERAL),
  steel: finish('#5b5f61', 0.7, 0.15),
  roofTar: finish('#55524d', 0.92, 0, MINERAL),
  shrub: finish('#5f7a45', 0.92, 0, FOLIAGE),
  roadLine: finish('#e4e2d6', 0.8),
  carGlass: finish('#2c3640', 0.15, 0.9),
  tyre: finish('#1e1f21', 0.9),
} satisfies Record<string, Finish>;

export const HULL_FINISH: Record<'white' | 'slate' | 'forest' | 'rust', Finish> = {
  white: F.gelcoat,
  slate: finish(T.slate, 0.36),
  forest: finish(T.forest, 0.38),
  rust: finish(T.rust, 0.38),
};
/** Canvas: navy is the silo-blue token; “sand” canvas uses sand-dark so it reads against white gelcoat. */
export const CANVAS_FINISH: Record<'navy' | 'sand', Finish> = {
  navy: finish(T.silo_blue, 0.92),
  sand: finish(S.canvasSand, 0.92),
};
