import { expect, test, type Page } from '@playwright/test';

const GALLERY = '/?ui=primitives';

async function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('fonts: only the three local variable faces load, under the 200 KB budget, from no external host', async ({ page }) => {
  const fonts: { url: string; bytes: number }[] = [];
  page.on('response', async (res) => {
    if (res.request().resourceType() === 'font') fonts.push({ url: res.url(), bytes: (await res.body()).length });
  });
  await page.goto(GALLERY);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  const names = fonts.map((f) => new URL(f.url).pathname).sort();
  expect(names).toEqual([
    '/fonts/AtkinsonHyperlegibleMono-Variable.woff2',
    '/fonts/Commissioner-Variable.woff2',
    '/fonts/WorkSans-Variable.woff2',
  ]);
  const total = fonts.reduce((s, f) => s + f.bytes, 0);
  expect(total).toBeLessThan(200 * 1024);
  test.info().annotations.push({ type: 'font-bytes', description: String(total) });
  // Buttons use Work Sans, not mono (APPROVED).
  expect(await page.locator('.btn').first().evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?Work Sans/);
});

test('gallery renders every primitive without console errors', async ({ page }) => {
  const errors = await trackErrors(page);
  await page.goto(GALLERY);
  for (const name of ['Review observation', 'Request dock check', 'Restart demo']) await expect(page.getByRole('button', { name }).first()).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Registry (Dark)' })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Camera view (Dark)' })).toBeVisible();
  await expect(page.locator('.pill')).toHaveCount(21); // 8 per theme section + 5 in the glass strip
  expect(errors).toEqual([]);
});

test('keyboard: tabs, segmented control, search escape, checkbox and tooltip', async ({ page }) => {
  await page.goto(GALLERY);
  // Tabs: arrow keys move selection and focus.
  const slips = page.getByRole('tablist', { name: 'Registry (Dark)' }).getByRole('tab', { name: 'Slips' });
  await slips.focus();
  await page.keyboard.press('ArrowRight');
  const vessels = page.getByRole('tablist', { name: 'Registry (Dark)' }).getByRole('tab', { name: 'Vessels' });
  await expect(vessels).toHaveAttribute('aria-selected', 'true');
  await expect(vessels).toBeFocused();
  await page.keyboard.press('Home');
  await expect(slips).toHaveAttribute('aria-selected', 'true');

  // Segmented control: arrows select the next view.
  const group = page.getByRole('radiogroup', { name: 'Camera view (Dark)' });
  await group.getByRole('radio', { name: 'Overview' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(group.getByRole('radio', { name: 'Dock B' })).toHaveAttribute('aria-checked', 'true');

  // Search: labelled, typing stays in the field, Escape clears.
  const search = page.getByRole('searchbox', { name: 'Search slips and vessels (Dark)' });
  await search.fill('B12');
  await expect(search).toHaveValue('B12');
  await search.press('Escape');
  await expect(search).toHaveValue('');

  // Checkbox: Space toggles.
  const ack = page.getByRole('checkbox', { name: /I reviewed the simulated staff evidence/ }).first();
  await ack.focus();
  await page.keyboard.press('Space');
  await expect(ack).toBeChecked();

  // Provenance tooltip: shown on keyboard focus, described to AT, Escape dismisses.
  const sim = page.getByRole('button', { name: 'SIM: Simulated (provenance)' }).first();
  await sim.focus();
  const tipId = await sim.getAttribute('aria-describedby');
  const tip = page.locator(`[id="${tipId}"]`);
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Fictional vessels');
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();

  // Focus ring: blue outline with a white halo.
  const ring = await sim.evaluate((el) => ({ outline: getComputedStyle(el).outlineColor, shadow: getComputedStyle(el).boxShadow }));
  expect(ring.outline).toBe('rgb(45, 98, 255)');
  expect(ring.shadow).toContain('rgb(255, 255, 255)');
});

test('loading button locks out repeat clicks and announces busy state', async ({ page }) => {
  await page.goto(GALLERY);
  const save = page.locator('.btn', { hasText: 'Save (shows loading)' }).first();
  const width = (await save.boundingBox())!.width;
  await save.click();
  await expect(save).toHaveAttribute('aria-busy', 'true');
  await expect(save).toBeDisabled();
  await expect(save).toHaveAccessibleName(/Save \(shows loading\).*Working/); // name survives while busy
  expect(Math.abs((await save.boundingBox())!.width - width)).toBeLessThan(1);
  await expect(save).not.toHaveAttribute('aria-busy', 'true', { timeout: 4000 });
});

test('panels fall back to solid surfaces on request', async ({ page }) => {
  await page.goto(GALLERY);
  const panel = page.locator('.g-theme[data-theme="dark"] .panel').first();
  const glass = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(glass).toBe('rgba(1, 27, 43, 0.84)');
  await page.getByRole('checkbox', { name: 'Solid panels (no transparency)' }).check();
  expect(await panel.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(35, 55, 71)');
});

test('reduced motion zeroes camera and micro durations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const ms = (v: string) => (v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000); // the minifier writes 0ms as 0s
  const t = await page.evaluate(() => ['--t-camera', '--t-micro', '--t-panel'].map((k) => getComputedStyle(document.documentElement).getPropertyValue(k).trim()));
  expect(t.map(ms)).toEqual([0, 0, 100]);
});

test('storage: corrupt saved data starts fresh with a notice', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('harbor-desk:session', '{oops'));
  await page.goto('/');
  await expect(page.getByText('Saved demo data was unreadable. Started fresh.')).toBeVisible();
  await expect(page.locator('.summary-zone .kpi').nth(0)).toContainText('126');
});

test('storage: unavailable localStorage falls back to memory and the app still works', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('denied', 'SecurityError');
    };
  });
  const errors = await trackErrors(page);
  await page.goto('/');
  await expect(page.getByText('Browser storage unavailable')).toBeVisible();
  await expect(page.locator('.summary-zone .kpi')).toHaveCount(2); // the overview strip (workspace refresh)
  expect(errors).toEqual([]);
});

test('a failed 3D chunk shows a recoverable region error and “Try again” refetches it', async ({ page }) => {
  let failed = false;
  await page.route('**/assets/SceneRoot-*.js', async (route) => {
    if (!failed) {
      failed = true;
      await route.abort('failed');
    } else await route.continue();
  });
  await page.goto('/');
  await expect(page.getByText('3D view unavailable')).toBeVisible();
  // T18: while 3D is down the 2D plan is the map (same records), not an empty region.
  await expect(page.getByTestId('plan-view')).toBeVisible();
  // The rest of the shell still works while the scene region is down.
  await expect(page.locator('.summary-zone .kpi').nth(0)).toContainText('126');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('plan-view')).toHaveCount(0);
  expect(failed).toBe(true);
});

test('hover states change the surface without changing meaning', async ({ page }) => {
  await page.goto(GALLERY);
  const primary = page.locator('.g-theme[data-theme="dark"] .btn-primary', { hasText: 'Review observation' });
  const before = await primary.evaluate((el) => getComputedStyle(el).backgroundColor);
  await primary.hover();
  await expect.poll(() => primary.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(before);
  expect(before).toBe('rgb(255, 77, 0)'); // signal
  await expect.poll(() => primary.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 93, 23)'); // signal-light
  const disabled = page.locator('.g-theme[data-theme="dark"] .btn-primary:disabled').first();
  await disabled.hover({ force: true });
  expect(await disabled.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 77, 0)');
});
