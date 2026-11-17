/**
 * T17 motion: drifting water by default, the pause-motion control, prefers-reduced-motion at load and when it
 * changes mid-session, a hidden tab, and the workflow under paused/reduced motion. This spec starts with NO
 * saved preference (the rest of the suite runs with motion paused).
 */
import { expect, test, type Page } from '@playwright/test';
import { announcer, btn, frame, openApp } from './helpers.ts';

test.use({ storageState: { cookies: [], origins: [] } });

const framesOver = async (page: Page, ms: number) => {
  const a = await frame(page);
  await page.waitForTimeout(ms);
  return (await frame(page)) - a;
};
type Cam = { __harborScene: { camera: { flying(): boolean; flightsStarted(): number } } };
/**
 * Select a slip in-page and report, in the first animation frame after the camera move STARTED, whether the
 * camera is still travelling (a flight) or already there (a cut). Measured in-page so slow software frames
 * cannot let a 700 ms flight finish between test polls.
 */
const moveIsCut = (page: Page, slipId: string) =>
  page.evaluate(
    (id) =>
      new Promise<boolean>((resolve) => {
        const w = window as unknown as Cam & { __harborDesk: { store: { dispatch(c: unknown): unknown } } };
        const before = w.__harborScene.camera.flightsStarted();
        w.__harborDesk.store.dispatch({ type: 'select', selection: { kind: 'slip', id } });
        const check = () => (w.__harborScene.camera.flightsStarted() > before ? resolve(!w.__harborScene.camera.flying()) : requestAnimationFrame(check));
        requestAnimationFrame(check);
      }),
    slipId,
  );

test('water drifts by default; Pause motion stops every ambient frame and is remembered; Resume restarts it', async ({ page }) => {
  await openApp(page, '', { scene: true });
  await page.waitForTimeout(800);
  expect(await framesOver(page, 1500)).toBeGreaterThan(3); // ambient frames while nothing else happens
  const toggle = page.getByRole('button', { name: 'Pause motion' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(announcer(page)).toHaveText('Motion paused.');
  await expect(page.getByRole('button', { name: 'Resume motion' })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(400);
  expect(await framesOver(page, 1500)).toBe(0); // fully still
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as { __harborScene?: { camera: unknown } }).__harborScene?.camera));
  await page.waitForTimeout(1200);
  expect(await framesOver(page, 1200)).toBe(0); // remembered across reloads
  await page.getByRole('button', { name: 'Resume motion' }).click();
  await expect(announcer(page)).toHaveText('Motion resumed.');
  expect(await framesOver(page, 1500)).toBeGreaterThan(3);
});

test('a hidden tab requests no ambient frames', async ({ page }) => {
  await openApp(page, '', { scene: true });
  await page.waitForTimeout(600);
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  await page.waitForTimeout(300);
  expect(await framesOver(page, 1200)).toBe(0);
});

test('reduced motion at load: still water, camera cuts, pause control explains why it is off, workflow complete', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page, '', { scene: true });
  await page.waitForTimeout(1000);
  expect(await framesOver(page, 1200)).toBe(0);
  const toggle = page.getByRole('button', { name: 'Resume motion' });
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute('title', /Reduced motion is on/);
  expect(await moveIsCut(page, 'B-12')).toBe(true); // a cut, not a flight
  await btn(page, 'Show dock-walk discrepancy').click();
  await btn(page, 'Review observation').click();
  await btn(page, 'Load simulated dock-check result').click();
  await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
  await btn(page, 'Confirm identity & resolve').click();
  await expect(page.getByTestId('resolution-headline')).toHaveText('Lake Effect confirmed at B-12');
});

test('reduced motion switched on mid-session freezes ambient motion and turns camera travel into cuts, and back', async ({ page }) => {
  await openApp(page, '', { scene: true });
  await page.waitForTimeout(800);
  expect(await framesOver(page, 1200)).toBeGreaterThan(3);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(400);
  expect(await framesOver(page, 1200)).toBe(0);
  await expect(page.getByRole('button', { name: 'Resume motion' })).toBeDisabled();
  expect(await moveIsCut(page, 'B-12')).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(300);
  expect(await framesOver(page, 1500)).toBeGreaterThan(3);
  // With motion allowed again, the next selection is a real flight.
  expect(await moveIsCut(page, 'D-10')).toBe(false);
  await expect(page.getByRole('button', { name: 'Pause motion' })).toBeEnabled();
});
