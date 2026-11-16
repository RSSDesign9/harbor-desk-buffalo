/** Composited non-text overlay contrast: compare actual line pixels to the same scene without overlays. */
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.addInitScript(() => localStorage.setItem('harbor-desk:prefs', JSON.stringify({ motionPaused: true })));
await page.goto('http://127.0.0.1:4719/?debug');
await page.waitForFunction(() => Boolean(window.__harborScene?.camera));
await page.getByRole('button', { name: 'Explore slip review', exact: true }).click();
await page.getByRole('button', { name: 'Show 09:12 camera observation' }).click();
await page.waitForTimeout(1200);
// Hide DOM markers in both images so only actual WebGL overlay lines differ.
await page.addStyleTag({ content: '.scene-marker { visibility: hidden !important; }' });
const on = (await page.screenshot({ path: 'qa/batch8/outline-on.png' })).toString('base64');
// This read-only QA hook changes overlay visibility, never domain state or picking.
await page.evaluate(() => (window.__harborScene as unknown as { overlays(v: boolean): void }).overlays(false));
await page.waitForTimeout(150);
const off = (await page.screenshot({ path: 'qa/batch8/outline-off.png' })).toString('base64');
const report = await page.evaluate(async ({ on, off }) => {
  const data = async (base64: string) => {
    const img = new Image(); img.src = `data:image/png;base64,${base64}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d')!; g.drawImage(img, 0, 0); return g.getImageData(0,0,c.width,c.height).data;
  };
  const a = await data(on), b = await data(off);
  const L = (rgb: number[]) => rgb.map(v => v/255).map(v => v<=0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[0.2126,0.7152,0.0722][i]!,0);
  const colors: Record<string, number> = {};
  const samples: Record<string, number[]> = { selection: [], review: [], selectionBacking: [], reviewBacking: [] };
  for (let i=0;i<a.length;i+=4) {
    const rgb = [a[i]!,a[i+1]!,a[i+2]!], bg = [b[i]!,b[i+1]!,b[i+2]!];
    if (rgb.every((v,k)=>Math.abs(v-bg[k]!)<10)) continue;
    const color = rgb.join(','); colors[color] = (colors[color] ?? 0) + 1;
    // Fully covered saturated line cores; exclude antialiasing and unchanged scene colours.
    if (rgb[0]!<240 || rgb[2]!>35) continue;
    const kind = rgb[1]!>130 ? 'review' : 'selection';
    const x=L(rgb),y=L(bg); samples[kind]!.push((Math.max(x,y)+0.05)/(Math.min(x,y)+0.05));
    // The coloured core must contrast with its rendered adjacent dark backing, not a token assumption.
    const px=(i/4)%1440, py=Math.floor(i/4/1440);
    let backing: number[] | null = null;
    for (let dy=-4;dy<=4 && !backing;dy++) for (let dx=-4;dx<=4 && !backing;dx++) {
      if (px+dx<0 || px+dx>=1440 || py+dy<0 || py+dy>=900) continue;
      const j=((py+dy)*1440+px+dx)*4;
      const near=[a[j]!,a[j+1]!,a[j+2]!];
      if (near.every((v,k)=>Math.abs(v-[1,27,43][k]!)<=3)) backing=near;
    }
    if (backing) { const z=L(backing); samples[kind+'Backing']!.push((Math.max(x,z)+0.05)/(Math.min(x,z)+0.05)); }
  }
  return { colors: Object.entries(colors).sort((a,b)=>b[1]-a[1]).slice(0,15), samples: Object.fromEntries(Object.entries(samples).map(([k,values])=>{values.sort((a,b)=>a-b);return [k,{pixels:values.length,min:values[0],p02:values[Math.floor(values.length*.02)],median:values[Math.floor(values.length*.5)],below3:values.filter(v=>v<3).length}];})) };
}, { on, off });
writeFileSync('qa/batch8/outline-contrast.json', JSON.stringify({ method: 'Actual composited line core versus same pixel with overlay off; 1440x900 DPR1, motion paused; excludes antialiasing. Backing samples use actual adjacent midnight pixels within 4px of line cores (not token pairs); compare coverage counts. Unknown tint is supplementary; dashed shape and text provide its state.', report },null,2));
console.log(report);
await browser.close();
