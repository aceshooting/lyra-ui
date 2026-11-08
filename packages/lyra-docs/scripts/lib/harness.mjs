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

/**
 * Runs `open`, which must make `input` (a file input locator) show its picker, and resolves to an
 * object whose `setFiles()` chooses files through that picker. Playwright's Firefox intercepts a
 * chooser by completing the native picker as cancelled, so the input receives a trusted `cancel` that a
 * real picker fires only when the user dismisses it; that one interception artifact is dropped before
 * the page's listeners see it, while synthetic (untrusted) `cancel` dispatch still reaches the page.
 * When that interception does not complete, Firefox ignores every later picker request from the same
 * input. Only there, after asserting the page did activate the input, the files are delivered to the
 * input directly, which drives the same `change` handling a chosen file does.
 */
export async function openFileChooser(page, input, open) {
  const firefox = page.context().browser()?.browserType().name() === 'firefox';
  await input.evaluate((element, firefox) => {
    element.__lrPickerActivated = false;
    element.addEventListener('click', () => { element.__lrPickerActivated = true; }, { once: true, capture: true });
    if (!firefox) return;
    const root = element.getRootNode();
    const drop = event => {
      if (event.target !== element || !event.isTrusted) return;
      event.stopImmediatePropagation();
      root.removeEventListener('cancel', drop, true);
    };
    root.addEventListener('cancel', drop, true);
  }, firefox);
  const pending = page.waitForEvent('filechooser', firefox ? { timeout: 5000 } : undefined); void pending.catch(() => {});
  await open();
  try {
    const chooser = await pending;
    return { setFiles: files => chooser.setFiles(files) };
  } catch (error) {
    if (!firefox) throw error;
    assert.equal(await input.evaluate(element => element.__lrPickerActivated), true, 'open() never activated the file input');
    return { setFiles: files => input.setInputFiles(files) };
  }
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
