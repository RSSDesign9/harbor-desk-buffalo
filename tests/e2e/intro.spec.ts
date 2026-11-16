/**
 * T24 / PRD F15 opening shot: a poster covers the canvas until the scene has drawn, then one establishing move
 * from the waterfront to Dock B. It never changes selection or scenario state; a key skips it; reduced motion
 * cuts it. Starts with NO saved preference (the rest of the suite runs with motion paused, which skips it).
 */
import { expect, test, type Page } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

type V3 = [number, number, number];
type W = {
  __harborScene?: { camera: { flying(): boolean; flightsStarted(): number; pose(): { position: V3; target: V3 } } | null };
  __harborDesk?: { store: { getState(): { interactive: { clock: string; selection: unknown; issues: unknown[] } } } };
};
// PRESETS.dock target (src/scene/camera.ts): the mean of Dock B's first run of slips.
const DOCK_TARGET: V3 = [-8.34, 0, -4.47];
const near = (a: V3, b: V3, tol = 1) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);
const cam = (page: Page) => page.evaluate(() => {
  const c = (window as unknown as W).__harborScene?.camera;
  return c ? { flying: c.flying(), flights: c.flightsStarted(), pose: c.pose() } : null;
});
const session = (page: Page) => page.evaluate(() => (window as unknown as W).__harborDesk!.store.getState().interactive);

test('cold load: the poster is up before the canvas, fades once drawn, and the camera lands on Dock B', async ({ page }) => {
  await page.goto('/?debug');
  const poster = page.getByTestId('scene-poster');
  await expect(poster).toBeVisible();
  // The poster's image is decoded and showing while the 3D chunk is still on its way (no blank canvas).
  // naturalWidth is density-corrected for srcset width descriptors, so check the decoded file instead.
  await expect.poll(() => poster.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && /\/assets\/poster\/harbor-(1600|2400)\.webp$/.test(img.currentSrc))).toBe(true);
  await expect(poster).toHaveCount(0, { timeout: 20_000 });
  await expect.poll(async () => (await cam(page))?.flying, { timeout: 15_000 }).toBe(false);
  const c = (await cam(page))!;
  expect(c.flights).toBe(1);
  expect(near(c.pose.target, DOCK_TARGET)).toBe(true);
  // Records untouched: 08:45, nothing selected, no issue.
  const s = await session(page);
  expect(s).toMatchObject({ selection: null, issues: [] });
  expect(s.clock).toBe('2026-07-15T12:45:00Z');
  await expect(page.getByRole('radio', { name: 'Dock B' })).toHaveAttribute('aria-checked', 'true');
});

test('any key skips the move straight to its end pose', async ({ page }) => {
  await page.goto('/?debug');
  await expect.poll(async () => (await cam(page))?.flying, { timeout: 20_000 }).toBe(true);
  await page.keyboard.press('Shift');
  const c = (await cam(page))!;
  expect(c.flying).toBe(false);
  expect(near(c.pose.target, DOCK_TARGET, 0.01)).toBe(true);
});

test('reduced motion: no move, no fade; the camera starts at Dock B', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?debug');
  await expect(page.getByTestId('scene-poster')).toHaveCount(0, { timeout: 20_000 });
  await expect.poll(async () => (await cam(page)) !== null, { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => near((await cam(page))!.pose.target, DOCK_TARGET, 0.01), { timeout: 5_000 }).toBe(true);
  expect((await cam(page))!.flights).toBe(0);
});
