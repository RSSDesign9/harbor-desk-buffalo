import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { session, showList, tabTo } from './helpers.ts';

type Pose = { position: number[]; target: number[]; fov: number };
type Win = { __harborScene: { camera: { pose(): Pose; flying(): boolean }; project(id: string): { x: number; y: number } } };
const pose = (page: Page) => page.evaluate(() => (window as unknown as Win).__harborScene.camera.pose());
const point = (page: Page) => page.evaluate(() => (window as unknown as Win).__harborScene.project('B-12'));
const idle = async (page: Page) => {
  await page.waitForFunction(() => !(window as unknown as Win).__harborScene.camera.flying());
  // Projection uses the last drawn camera; a reduced-motion cut still needs a frame to render.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
};

test('arrows pan every 3D preset in screen directions without changing records or zoom', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?debug');
  await page.waitForFunction(() => Boolean((window as unknown as Win).__harborScene?.camera));
  const map = page.getByRole('region', { name: 'Marina map', exact: true });
  await tabTo(page, /^Marina map/);
  await expect(map).toBeFocused();
  for (const preset of ['Map', 'Dock B', 'Overview']) {
    await page.getByRole('radio', { name: preset, exact: true }).click();
    await idle(page);
    await map.focus();
    const records = await session(page);
    const start = await pose(page);
    for (const [key, axis, sign] of [
      ['ArrowRight', 'x', -1], ['ArrowLeft', 'x', 1],
      ['ArrowUp', 'y', 1], ['ArrowDown', 'y', -1],
    ] as const) {
      const before = await point(page);
      await page.keyboard.press(key);
      await expect.poll(async () => ((await point(page))[axis] - before[axis]) * sign).toBeGreaterThan(20);
      const after = await pose(page);
      expect(after.fov).toBe(start.fov);
      expect(after.target[1]).toBeCloseTo(start.target[1]!, 5);
      after.position.forEach((value, i) => expect(value - after.target[i]!).toBeCloseTo(start.position[i]! - start.target[i]!, 5));
    }
    expect(await session(page)).toEqual(records);
  }
  const before = await pose(page);
  await page.keyboard.press('Alt+ArrowRight');
  expect(await pose(page)).toEqual(before);
  await page.keyboard.press('Tab');
  await expect(map).not.toBeFocused();
  await showList(page);
  const search = page.getByRole('searchbox');
  await search.fill('Harbor');
  await search.press('ArrowLeft');
  expect(await pose(page)).toEqual(before);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await map.focus();
  await page.screenshot({ path: 'test-results/keyboard-pan-desktop.png' });
});

test('map arrows interrupt a lens transition and repeated keys respect camera bounds', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => Boolean((window as unknown as Win).__harborScene?.camera));
  await idle(page);
  await page.getByRole('radio', { name: 'Map', exact: true }).click();
  await page.waitForFunction(() => (window as unknown as Win).__harborScene.camera.flying());
  const map = page.getByRole('region', { name: 'Marina map', exact: true });
  await map.focus();
  await page.keyboard.press('ArrowRight');
  await idle(page);
  expect((await pose(page)).fov).toBe(2);
  // Repeated keydown events match a held arrow, including the browser's repeat flag.
  await map.evaluate((el) => {
    for (let i = 0; i < 200; i++) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', repeat: true, bubbles: true, cancelable: true }));
  });
  const atEdge = await pose(page);
  atEdge.target.forEach((value, i) => {
    expect(value).toBeGreaterThanOrEqual([-650, -1, -700][i]! - 0.001);
    expect(value).toBeLessThanOrEqual([750, 80, 650][i]! + 0.001);
  });
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await pose(page)).target).not.toEqual(atEdge.target);
  // A real pointer gesture also returns keyboard focus to the map.
  await page.getByRole('radio', { name: 'Map', exact: true }).click();
  await idle(page);
  const berth = await point(page);
  await page.mouse.click(berth.x, berth.y);
  await expect(map).toBeFocused();
});

test('fallback plan pans by keyboard on mobile and resets with its zoom controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?debug&fault=webgl-unsupported');
  const map = page.getByRole('region', { name: 'Marina map', exact: true });
  const svg = page.getByTestId('plan-svg');
  await expect(map).toBeVisible();
  const box = async () => (await svg.getAttribute('viewBox'))!.split(' ').map(Number);
  const initial = await box();
  const records = await session(page);
  await tabTo(page, /^Marina map/);
  for (const [key, index, sign] of [
    ['ArrowRight', 0, 1], ['ArrowLeft', 0, -1], ['ArrowUp', 1, -1], ['ArrowDown', 1, 1],
  ] as const) {
    const before = await box();
    await page.keyboard.press(key);
    expect(((await box())[index]! - before[index]!) * sign).toBeGreaterThan(0);
    expect((await box()).slice(2)).toEqual(initial.slice(2));
  }
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'All docks', exact: true })).toBeFocused();
  const panned = await box();
  await page.keyboard.press('ArrowRight');
  expect(await box()).toEqual(panned);
  await page.keyboard.press('Enter');
  expect(await box()).toEqual(initial);
  expect(await session(page)).toEqual(records);
  await map.focus();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'test-results/keyboard-pan-mobile.png' });
});
