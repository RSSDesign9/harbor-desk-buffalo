/**
 * T17: REAL 200 % browser zoom. Chromium's own default page zoom (the setting Ctrl/⌘ + changes) in a persistent
 * profile, on a 1440×900 window — not CSS scaling and not an emulated small viewport. Runs in the
 * `chromium-zoom` project, which emulates no device, so the browser's zoom is what the page sees.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chromium, expect, test } from '@playwright/test';
import { announcer, zoneOverlaps } from './helpers.ts';

test('real 200 % browser zoom on a 1440×900 window: compact layout, nothing clipped, review completes', async () => {
  // Chromium's own default page zoom (the setting Ctrl/⌘ + changes), in a persistent profile. Not CSS scaling.
  const dir = mkdtempSync(`${tmpdir()}/harbor-zoom-`);
  mkdirSync(`${dir}/Default`, { recursive: true });
  writeFileSync(`${dir}/Default/Preferences`, JSON.stringify({ partition: { default_zoom_level: { x: Math.log(2) / Math.log(1.2) } } }));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: false, viewport: null, args: ['--window-size=1440,900'] });
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto('http://127.0.0.1:4719/?debug');
    await page.waitForFunction(() => Boolean((window as unknown as { __harborDesk?: unknown }).__harborDesk));
    const m = await page.evaluate(() => ({ w: innerWidth, dpr: devicePixelRatio, outer: outerWidth }));
    expect(m.dpr).toBe(2); // page zoom doubles the device pixel ratio…
    expect(m.w).toBeLessThanOrEqual(720); // …and halves the CSS viewport
    await expect(page.locator('.app')).toHaveAttribute('data-layout', 'mobile');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); // no horizontal scroll
    expect(await zoneOverlaps(page)).toEqual([]);
    await page.getByRole('button', { name: 'Explore slip review', exact: true }).click();
    await page.getByRole('button', { name: 'Show dock-walk discrepancy' }).click();
    await page.getByRole('button', { name: 'Review observation' }).click();
    await page.getByRole('button', { name: 'Load simulated dock-check result' }).click();
    await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
    const confirm = page.getByRole('button', { name: 'Confirm identity & resolve' });
    await confirm.scrollIntoViewIfNeeded();
    // The control is fully inside the window, not clipped behind another panel.
    const box = (await confirm.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(m.w + 1);
    await confirm.click();
    await expect(page.getByTestId('resolution-headline')).toHaveText('Lake Effect confirmed at B-12');
    await expect(announcer(page)).toHaveText('Lake Effect confirmed at B-12. Issue resolved.');
    // CDP's default capture incorrectly crops native page zoom to CSS dimensions.
    const cdp = await ctx.newCDPSession(page);
    const metrics = await cdp.send('Page.getLayoutMetrics');
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: metrics.layoutViewport.clientWidth, height: metrics.layoutViewport.clientHeight, scale: 1 } });
    writeFileSync('qa/batch13/e2e-zoom200-resolved.png', Buffer.from(shot.data, 'base64'));
    writeFileSync('qa/batch13/zoom-metrics.json', JSON.stringify({ metrics, dom: m }, null, 2));
  } finally {
    await ctx.close();
  }
});
