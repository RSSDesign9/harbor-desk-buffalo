/** Preserve installed runtime dependency license notices in the static output. No network access. */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const packages = new Set<string>();
for (const file of readdirSync('dist/assets').filter(f => f.endsWith('.js.map'))) {
  const map = JSON.parse(readFileSync(join('dist/assets', file), 'utf8')) as { sources: string[] };
  for (const source of map.sources) {
    const parts = source.split('node_modules/')[1]?.split('/');
    if (parts) packages.add(parts[0]!.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!);
  }
}
const paths = [...packages].sort().map(p => join('node_modules', p));
let text = `Harbor Desk — asset and software credits\n\nIndependent portfolio concept. No endorsement or operator deployment.\n\nGEOGRAPHY\n© OpenStreetMap contributors, Open Database License (ODbL) 1.0.\nhttps://www.openstreetmap.org/copyright\nhttps://opendatacommons.org/licenses/odbl/1-0/\nSource features fetched 2026-11-14. Derived geometry and slips are approximate.\nESD First Buffalo River Marina map dated 2022-06-01 is an explanatory reference, not reproduced in this app.\n\nFONTS\nCommissioner — Kostas Bartsokas, SIL OFL 1.1; full bundled license: /fonts/Commissioner-OFL.txt\nWork Sans — Wei Huang, SIL OFL 1.1; full bundled license: /fonts/WorkSans-OFL.txt\nAtkinson Hyperlegible Mono — Braille Institute of America, SIL OFL 1.1; full bundled license: /fonts/AtkinsonHyperlegibleMono-OFL.txt\nModified versions: variable files from github.com/google/fonts, instanced (Commissioner VOLM and slnt pinned to 0) and subset to Latin. No Reserved Font Names.\n\nORIGINAL ASSETS\nProcedural models, shaders, evidence renders, lighthouse mark and vessel icons authored for Harbor Desk.\nNo external model, texture, HDRI, photograph, tile or Google-extracted mesh.\n\nSOFTWARE\nThe following bundled dependency notices are retained, identified from production source maps. React also licenses the reconciler bundled with React Three Fiber.\n\n`;
const missing: string[] = [];
for (const dir of paths) {
  if (!existsSync(join(dir, 'package.json'))) continue;
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const files = readdirSync(dir).filter((f) => /^(licen[sc]e|copying|notice)(\.|$)/i.test(f));
  text += `\n${'='.repeat(72)}\n${pkg.name} ${pkg.version} — ${pkg.license ?? 'see notice'}\n${typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? pkg.homepage ?? ''}\n`;
  if (!files.length && pkg.name === '@react-three/fiber') text += readFileSync('design/licenses/react-three-fiber-MIT.txt', 'utf8');
  else if (!files.length) missing.push(`${pkg.name}: ${pkg.license}`);
  for (const f of files) text += `\n${f}\n${readFileSync(join(dir, f), 'utf8')}\n`;
}
writeFileSync('public/THIRD-PARTY-NOTICES.txt', text);
console.log(JSON.stringify({ packages: paths.length, missing, bytes: Buffer.byteLength(text) }));
if (missing.length) process.exitCode = 1;
