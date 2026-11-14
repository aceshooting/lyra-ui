const MAX_STORY_LOAD_ATTEMPTS = 2;

/** Serialize every authored capture axis so public preview defaults cannot change its profile. */
export function visualStoryUrl(baseUrl, id, axis) {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/iframe.html`);
  url.searchParams.set('id', id);
  url.searchParams.set('viewMode', 'story');
  url.searchParams.set('globals', Object.entries(axis.globals ?? {}).map(([name, value]) => `${name}:${value}`).join(';'));
  return url.toString();
}

/**
 * Loads a Storybook story and waits for its first rendered child.
 *
 * Storybook occasionally completes the iframe navigation without mounting the story root when a
 * long screenshot run has reused one page for many navigations. One fresh navigation is safe to
 * recover because no pixels or semantic assertions have been accepted yet. A second empty root
 * remains a blocking error, so a broken story cannot be converted into a flaky green capture.
 */
export async function loadVisualStory(page, url, deterministicStyle) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_STORY_LOAD_ATTEMPTS; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      // Inject this after each navigation: a reload replaces the document and its styles.
      await page.addStyleTag({ content: deterministicStyle });
      await page.waitForFunction(
        () => Boolean(document.querySelector('#storybook-root')?.firstElementChild),
        undefined,
        { timeout: 15_000 },
      );
      return { attempts: attempt };
    } catch (error) {
      lastError = error;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Storybook root was not ready after ${MAX_STORY_LOAD_ATTEMPTS} attempts: ${detail}`,
    { cause: lastError },
  );
}

/**
 * Repaint measured virtual rows at their final fractional offsets before comparing pixels.
 * Chromium can retain text rasterized at an estimated whole-pixel transform after measurement
 * moves the layer by half a pixel. Releasing the compositor hint for one paint, then restoring
 * the exact author value and priority, makes capture independent of the first measurement frame.
 */
export async function refreshVirtualRowPaint(page) {
  await page.evaluate(async () => {
    const roots = [document];
    const saved = [];
    for (const root of roots) {
      for (const element of root.querySelectorAll('*')) {
        if (element.shadowRoot) roots.push(element.shadowRoot);
        if (element.localName !== 'lr-virtual-list') continue;
        for (const row of element.shadowRoot?.querySelectorAll('[part="row"]') ?? []) {
          if (!getComputedStyle(row).willChange.split(',').some(value => value.trim() === 'transform')) continue;
          saved.push([row, row.style.getPropertyValue('will-change'), row.style.getPropertyPriority('will-change')]);
          row.style.setProperty('will-change', 'auto', 'important');
        }
      }
    }
    if (saved.length === 0) return;
    const paint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      await paint();
    } finally {
      for (const [row, value, priority] of saved) {
        if (value) row.style.setProperty('will-change', value, priority);
        else row.style.removeProperty('will-change');
      }
    }
    await paint();
  });
}
