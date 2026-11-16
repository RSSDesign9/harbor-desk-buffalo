/** Generate src/ui/tokens.css from design/tokens.json.  `npm run tokens` / `npm run tokens:check`. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveTokenBlocks, renderTokenCss } from '../src/ui/tokenCss.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(ROOT, 'src/ui/tokens.css');
const css = renderTokenCss(deriveTokenBlocks(JSON.parse(readFileSync(join(ROOT, 'design/tokens.json'), 'utf8')) as Record<string, unknown>));
if (process.argv.includes('--check')) {
  const current = readFileSync(out, 'utf8');
  if (current !== css) {
    console.error('src/ui/tokens.css is out of date with design/tokens.json. Run `npm run tokens`.');
    process.exit(1);
  }
  console.log('src/ui/tokens.css matches design/tokens.json.');
} else {
  writeFileSync(out, css);
  console.log(`Wrote ${out}`);
}
