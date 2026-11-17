import { chromium, expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';
import { openApp, btn, session, showList, tabTo, resolveByKeyboard } from './helpers.ts';

test('About sources: provenance, safe links, focus, dark/light/mobile, persistent attribution', async ({ page }) => {
  await openApp(page);
  for (const mobile of [false, true]) {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    for (const light of [false, true]) {
      await btn(page, 'Display').click();
      await page.getByRole('radio', { name: light ? /Chart/ : /Marine/ }).check();
      await page.keyboard.press('Escape');
      await btn(page, mobile ? 'About / Sources' : 'About').click();
      const dialog = page.getByRole('dialog', { name: 'About Harbor Desk' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('heading', { name: 'About Harbor Desk' })).toBeFocused();
      await expect(dialog).toContainText('no partnership, endorsement, operator deployment');
      await expect(dialog).toContainText('126 slips');
      await expect(dialog).toContainText('2022-06-01');
      await expect(dialog).toContainText('Publication date not recorded');
      await expect(dialog.locator('dt')).toHaveText(['DOC', 'ASSUME', 'SIM', 'FIELD']);
      for (const link of await dialog.getByRole('link').all()) {
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noreferrer');
      }
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map(n => n.target).join(',')}`)).toEqual([]);
      await page.screenshot({ path: `qa/handoff/about-${mobile ? 'mobile' : 'desktop'}-${light ? 'light' : 'dark'}.png` });
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(btn(page, mobile ? 'About / Sources' : 'About')).toBeFocused();
    }
  }
  await btn(page, 'Explore slip review').click();
  await btn(page, 'Show dock-walk discrepancy').click();
  await expect(page.locator('.persistent-credit')).toBeInViewport();
  await expect(page.locator('.persistent-credit a')).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
});

test('mobile reduced motion keyboard-only pending workflow and usable attribution', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);
  await tabTo(page, /Explore slip review/);
  await page.keyboard.press('Enter');
  await resolveByKeyboard(page, 'pending');
  expect((await session(page)).tasks).toEqual([expect.objectContaining({ status: 'completed' })]);
  await expect(page.locator('.persistent-credit')).toBeInViewport();
  await page.screenshot({ path: 'qa/handoff/mobile-reduced-keyboard.png' });
});

test('mobile opts into real 3D, selected hull remains visible above sheet, returns to plan without data loss', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await btn(page, 'Explore slip review').click();
  await btn(page, 'Show dock-walk discrepancy').click();
  const before = await session(page);
  await btn(page, 'Display').click();
  await page.getByRole('checkbox', { name: /^Use 3D map/ }).check();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => Boolean(window.__harborScene?.camera));
  await page.waitForTimeout(1000);
  const p = await page.evaluate(() => window.__harborScene!.project('B-12', 'hull'));
  expect(p).not.toBeNull();
  const canvas = (await page.locator('canvas').boundingBox())!;
  expect(p!.x).toBeGreaterThan(canvas.x);
  expect(p!.x).toBeLessThan(canvas.x + canvas.width);
  expect(p!.y).toBeGreaterThan(canvas.y);
  expect(p!.y).toBeLessThan(canvas.y + canvas.height);
  const marker = (await page.locator('.scene-marker-selected').boundingBox())!;
  const topbar = (await page.locator('.topbar').boundingBox())!;
  expect(marker.y).toBeGreaterThanOrEqual(topbar.y + topbar.height);
  expect(marker.y + marker.height).toBeLessThanOrEqual(canvas.y + canvas.height);
  await page.screenshot({ path: 'qa/handoff/mobile-3d.png' });
  await btn(page, 'Display').click();
  await page.getByRole('checkbox', { name: /^Use 3D map/ }).uncheck();
  await page.keyboard.press('Escape');
  await expect(page.locator('.app')).toHaveAttribute('data-map', 'plan');
  expect(await session(page)).toEqual(before);
});

test('visible GPU canvas: physical picking, list/marker/inspector sync and orbit drag suppression', async () => {
  const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, storageState: 'tests/e2e/motion-paused.storage.json' });
    await page.goto('http://127.0.0.1:4719/?debug');
    await page.waitForFunction(() => Boolean(window.__harborScene?.camera));
    const renderer = await page.evaluate(() => {
      const gl = document.querySelector('canvas')!.getContext('webgl2')!;
      return gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')!.UNMASKED_RENDERER_WEBGL) as string;
    });
    expect(renderer).not.toMatch(/SwiftShader|llvmpipe|software/i);
    await showList(page);
    await page.getByRole('radio', { name: 'Dock B', exact: true }).click();
    await page.waitForTimeout(1000);
    const pos = await page.evaluate(() => window.__harborScene!.project('B-12'));
    expect(pos).not.toBeNull();
    await page.mouse.click(pos!.x, pos!.y);
    await expect(page.getByRole('heading', { name: 'Slip B-12' })).toBeVisible();
    await expect(page.getByRole('listbox').getByRole('option', { selected: true })).toContainText('B-12');
    await expect(page.locator('.scene-marker-selected')).toHaveText('B-12 · Empty · assigned');
    await btn(page, 'Show dock-walk discrepancy').click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'qa/handoff/visible-gpu-b12.png' });
    const before = await session(page);
    const p = await page.evaluate(() => window.__harborScene!.project('B-14'));
    const pose = await page.evaluate(() => window.__harborScene!.camera!.pose());
    await page.mouse.move(p!.x, p!.y);
    await page.mouse.down();
    await page.mouse.move(p!.x + 65, p!.y + 15, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    expect((await session(page)).selection).toEqual(before.selection);
    expect(await page.evaluate(() => window.__harborScene!.camera!.pose())).not.toEqual(pose);
    // Deselect through UI, then pick the actual observed hull (no store substitute).
    await page.getByRole('button', { name: /Close details/ }).click();
    const hull = await page.evaluate(() => window.__harborScene!.project('B-12', 'hull'));
    await page.mouse.click(hull!.x, hull!.y);
    await expect(page.getByRole('heading', { name: 'Slip B-12' })).toBeVisible();
    await expect(page.locator('.scene-marker-selected')).toHaveText('B-12 · Vessel present · identity unverified');
    writeFileSync('qa/handoff/visible-gpu-picking.json', JSON.stringify({ browser: browser.version(), renderer, viewport: '1440x900', headless: false, passed: true }, null, 2));
  } finally { await browser.close(); }
});
