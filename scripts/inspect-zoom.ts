/** Actual Chromium page zoom capture, independent of CSS viewport emulation. */
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';
const dir = mkdtempSync(`${tmpdir()}/harbor-zoom-proof-`);
mkdirSync(`${dir}/Default`);
writeFileSync(`${dir}/Default/Preferences`, JSON.stringify({ partition: { default_zoom_level: { x: Math.log(2)/Math.log(1.2) } } }));
const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: false, viewport: null, args: ['--window-size=1440,900'] });
try {
 const p=ctx.pages()[0]!;
 await p.goto('http://127.0.0.1:4719');
 await p.getByRole('button',{name:'Explore slip review',exact:true}).click();
 await p.getByRole('button',{name:'Show 09:12 camera observation'}).click();
 const cdp=await ctx.newCDPSession(p);
 const metrics=await cdp.send('Page.getLayoutMetrics');
 const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:metrics.layoutViewport.clientWidth,height:metrics.layoutViewport.clientHeight,scale:1}});
 writeFileSync('qa/batch8/zoom-cdp.png',Buffer.from(shot.data,'base64'));
 writeFileSync('qa/batch8/zoom-metrics.json',JSON.stringify({metrics,dom:await p.evaluate(()=>({innerWidth,innerHeight,devicePixelRatio,outerWidth,outerHeight}))},null,2));
} finally { await ctx.close(); rmSync(dir,{recursive:true,force:true}); }
