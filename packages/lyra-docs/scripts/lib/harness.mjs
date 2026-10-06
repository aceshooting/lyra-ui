import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { unzipSync } from 'fflate';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A saved package as sorted `[part, bytes[]]` pairs. */
export const zipParts = bytes => Object.fromEntries(Object.entries(unzipSync(Uint8Array.from(bytes)))
  .sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => [name, [...value]]));

/** Resolves after two animation frames. */
export const paints = page => page.evaluate(() =>
  new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))));

const focusedPart = (page, id) => page.locator(`#${id}`)
  .evaluate(element => element.shadowRoot.activeElement?.getAttribute('part') ?? null);

/** Alt+F10, Home, then the inline-forward arrow until the toolbar part `name` has focus. */
export async function toolbarTo(page, id, name, { tries = 80 } = {}) {
  await page.keyboard.press('Alt+F10');
  await page.keyboard.press('Home');
  const forward = await page.locator(`#${id}`)
    .evaluate(element => element.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
  for (let attempt = 0; attempt < tries && await focusedPart(page, id) !== name; attempt++) {
    await page.keyboard.press(forward);
  }
  assert.equal(await focusedPart(page, id), name, `toolbar keyboard path did not reach ${name}`);
}

/** axe (WCAG 2.x A/AA) on `#id`; a failure names each rule and its targets. */
export async function assertNoAxeViolations(page, id) {
  const results = await page.evaluate(({ id, tags }) => window.axe.run(document.getElementById(id),
    { runOnly: { type: 'tag', values: tags } }), { id, tags: AXE_TAGS });
  assert.deepEqual(results.violations.map(({ id: rule, nodes }) => ({ id: rule, targets: nodes.map(node => node.target) })), []);
}

/** Saves `<engine>-<name>.png` into DOCX_SCREENSHOTS when set. */
export async function screenshot(page, name) {
  const directory = process.env.DOCX_SCREENSHOTS;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${page.context().browser().browserType().name()}-${name}.png`) });
}
