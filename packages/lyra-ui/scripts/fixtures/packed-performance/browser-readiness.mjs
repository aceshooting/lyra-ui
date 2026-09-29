/** Preserve the page's own errors when a packed browser fixture never becomes usable. */
export function describeBrowserError(error) {
  return JSON.stringify({
    name: error?.name,
    message: error?.message,
    stack: error?.stack,
    string: String(error),
    ownProperties: error && typeof error === 'object' ? Object.getOwnPropertyNames(error) : [],
  });
}

export async function waitForBrowserReadiness({ page, predicate, packageKey, phase, errors, timeoutMs = 30000 }) {
  try {
    await page.waitForFunction(predicate, undefined, { timeout: timeoutMs });
  } catch (cause) {
    const state = await page.evaluate(() => ({
      readyState: document.readyState,
      pathname: location.pathname,
      performanceBootPresent: Boolean(window.__lyraPerformance?.boot),
      hydrationResultPresent: Boolean(window.__lyraHydrationResult),
      packageKey: window.__lyraPackage?.key,
      runnerDomPresent: Boolean(document.querySelector('#input')),
      moduleScriptCount: document.querySelectorAll('script[type="module"]').length,
      registeredTags: ['lr-input', 'lr-select', 'lr-option', 'lr-dialog', 'lr-data-grid', 'lr-tree', 'lr-button']
        .filter((tag) => Boolean(customElements.get(tag))),
      resourcePaths: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname).slice(-30),
    })).catch((error) => ({ snapshotError: String(error) }));
    throw new Error(
      `${packageKey}: ${phase} browser readiness failed: ${cause instanceof Error ? cause.message : String(cause)}; ` +
      `pageErrors=${JSON.stringify(errors)}; pageState=${JSON.stringify(state)}`,
      { cause },
    );
  }
}
