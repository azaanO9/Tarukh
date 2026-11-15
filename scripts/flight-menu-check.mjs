/** Run against a production preview. Uses the same external Playwright setup as mobile-layout-check.mjs. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const option = name => process.argv.find(argument => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = option('url') ?? 'http://127.0.0.1:4206/Tarukh/';
const output = path.resolve(option('output') ?? 'outputs/flight-menu');
const modulePath = process.env.PLAYWRIGHT_MODULE ?? path.resolve('outputs/outpost-tools/node_modules/playwright-core/index.mjs');
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) });
await fs.mkdir(output, { recursive: true });
const report = { checks: [], errors: [], screenshots: [] };
const check = name => report.checks.push(name);

async function start(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(url + '?debug=1');
  await page.getByRole('button', { name: /to start.*Explore Mars/ }).click();
  await page.locator('.starship-arrival').waitFor({ state: 'detached', timeout: 240000 });
  await page.waitForFunction(() => document.querySelector('.sv-world')?.dataset.catchSite === 'ready', null, { timeout: 240000 });
  return page;
}

async function capture(page, name) {
  await page.screenshot({ path: path.join(output, name + '.png') });
  report.screenshots.push(name + '.png');
}

async function checkMenuBounds(page) {
  const result = await page.locator('.flight-menu').evaluate(dialog => {
    const bounds = dialog.getBoundingClientRect();
    const sectors = [...dialog.querySelectorAll('.flight-menu-sector')].map(button => {
      const box = button.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return { label: button.textContent, centreClicksButton: button.contains(hit), width: box.width, height: box.height };
    });
    return { contained: bounds.left >= 0 && bounds.top >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight,
      overflow: dialog.scrollWidth > dialog.clientWidth + 1, sectors };
  });
  assert.equal(result.contained, true, 'Menu fits the viewport');
  assert.equal(result.overflow, false, 'Menu has no horizontal scrolling');
  for (const sector of result.sectors) {
    assert.equal(sector.centreClicksButton, true, sector.label + ' has a reachable press centre');
    assert.ok(sector.width >= 48 && sector.height >= 48, sector.label + ' has a large target');
  }
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await start(desktop);
  const world = page.locator('.sv-world');
  const canvas = await world.locator(':scope > canvas').last().elementHandle();
  await world.focus();
  await page.keyboard.down('w');
  await page.waitForTimeout(200);
  await page.getByLabel('Camera and graphics', { exact: true }).click();
  await page.getByRole('dialog', { name: 'Flight console' }).waitFor();
  await page.waitForTimeout(350);
  const stopped = await world.evaluate(element => [element.dataset.worldX, element.dataset.worldZ]);
  await page.waitForTimeout(500);
  assert.deepEqual(await world.evaluate(element => [element.dataset.worldX, element.dataset.worldZ]), stopped);
  await page.keyboard.up('w');
  check('Opening the console pauses walking and clears held movement');

  await page.getByRole('button', { name: 'Camera', exact: true }).hover();
  assert.equal(await page.locator('.flight-menu-dial').getAttribute('data-highlight'), 'camera');
  assert.equal(await page.getByRole('heading', { name: 'Expedition paused' }).count(), 1);
  await capture(page, 'desktop-hover');
  check('Pointer hover previews the dial without changing settings');
  await page.getByRole('button', { name: 'Camera', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'First person', exact: true }).click();
  await page.getByLabel('Look sensitivity', { exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByLabel('Look sensitivity', { exact: true }).inputValue(), '1.1');
  await capture(page, 'desktop-camera');
  await page.getByRole('button', { name: 'Camera', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator(':focus').textContent(), 'Graphics');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Performance Lighter rendering', exact: true }).click();
  await page.getByRole('button', { name: 'FPS only', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'FPS only', exact: true }).getAttribute('aria-pressed'), 'true');
  await checkMenuBounds(page);
  await capture(page, 'desktop-graphics');
  const close = page.getByRole('button', { name: 'Close flight console', exact: true });
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator(':focus').textContent(), 'Detailed');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Close flight console');
  await page.keyboard.press('Escape');
  await page.locator('.flight-menu').waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.querySelector('.sv-world')?.dataset.cameraView === 'first');
  assert.equal(await world.evaluate(element => document.activeElement === element), true);
  assert.equal(await canvas.evaluate(element => element.isConnected), true);
  await page.waitForFunction(() => document.querySelector('.sv-world')?.dataset.graphicsProfile === 'performance');
  check('Keyboard navigation, focus trap, Escape and live camera/graphics settings work without remounting the canvas');

  await page.evaluate(() => document.exitFullscreen());
  const consoleDialog = page.getByRole('dialog', { name: 'Flight console' });
  await consoleDialog.waitFor();
  await consoleDialog.getByRole('button', { name: 'Return to fullscreen', exact: true }).click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await consoleDialog.getByRole('button', { name: 'Camera', exact: true }).click();
  await consoleDialog.getByRole('button', { name: 'Resume mouse look', exact: true }).click();
  await page.locator('.flight-menu').waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.pointerLockElement === document.querySelector('.sv-world')
    || /Mouse capture is unavailable|Drag the view/.test(document.querySelector('.sv-world-message')?.textContent ?? ''));
  const mouseCaptured = await page.evaluate(() => Boolean(document.pointerLockElement));
  check(`Fullscreen return works; Resume mouse look ${mouseCaptured ? 'captures the mouse' : 'shows the browser fallback'}`);
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !document.pointerLockElement);

  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Main menu', exact: true }).click();
  await capture(page, 'desktop-main-menu');
  await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
  assert.equal(await canvas.evaluate(element => element.isConnected), true);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Main menu', exact: true }).click();
  await page.getByRole('button', { name: 'Return to main menu', exact: true }).click();
  await page.locator('.roam-launch').waitFor();
  assert.equal(await page.locator('.sv-world').count(), 0);
  check('Main-menu confirmation can be cancelled, then returns to the actual launcher');
  await desktop.close();

  const touch = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const mobile = await start(touch);
  await mobile.getByLabel('Camera and graphics', { exact: true }).tap();
  await mobile.getByRole('button', { name: 'Camera', exact: true }).tap();
  assert.equal(await mobile.getByRole('button', { name: 'Resume mouse look', exact: true }).count(), 0);
  await mobile.getByRole('button', { name: 'Graphics', exact: true }).tap();
  for (const [width, height] of [[844, 390], [926, 428], [568, 320], [1024, 768]]) {
    await mobile.setViewportSize({ width, height });
    await checkMenuBounds(mobile);
    await capture(mobile, `mobile-${width}x${height}`);
    await mobile.getByRole('button', { name: 'Off', exact: true }).tap();
    assert.equal(await mobile.getByRole('button', { name: 'Off', exact: true }).getAttribute('aria-pressed'), 'true');
  }
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.locator('.sv-rotate-gate').waitFor();
  assert.equal(await mobile.locator('.flight-menu').count(), 0);
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.getByRole('dialog', { name: 'Flight console' }).waitFor();
  await mobile.getByRole('button', { name: 'Resume', exact: true }).tap();
  await mobile.locator('.flight-pad').waitFor();
  check('Touch controls, all mobile panel sizes, portrait gating and resume work');

  await mobile.getByRole('button', { name: 'Pause', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Main menu', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Return to main menu', exact: true }).tap();
  await mobile.getByRole('button', { name: /Elysium Story/ }).tap();
  await mobile.getByRole('button', { name: 'Skip prologue · travel to Mars', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Wake up · begin commissioning', exact: true }).waitFor({ timeout: 240000 });
  await mobile.getByRole('button', { name: 'Wake up · begin commissioning', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Explore · follow the station marker', exact: true }).tap();
  await mobile.waitForFunction(() => Boolean(localStorage.getItem('tarukh.elysium.v1')));
  await mobile.getByRole('button', { name: 'Pause', exact: true }).tap();
  const before = await mobile.evaluate(() => localStorage.getItem('tarukh.elysium.v1'));
  await mobile.getByRole('button', { name: 'Main menu', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Return to main menu', exact: true }).tap();
  assert.equal(await mobile.evaluate(() => localStorage.getItem('tarukh.elysium.v1')), before);
  await mobile.getByRole('button', { name: /Elysium Story/ }).tap();
  await mobile.getByRole('button', { name: 'Resume expedition', exact: true }).waitFor();
  check('Returning from Story retains the saved mission and offers Resume expedition');
  await touch.close();
} catch (error) {
  report.errors.push(error.stack ?? String(error));
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exitCode = 1;
