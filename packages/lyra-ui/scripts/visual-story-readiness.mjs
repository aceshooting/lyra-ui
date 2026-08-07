const MAX_STORY_LOAD_ATTEMPTS = 2;

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
