// Which mode does each parity form render in? For every form whose surface is not overridden, read
// lr-button's resolved --lr-color-surface and compare it with the mode of the nearest mode scope.
// Usage: node parity-modes.mjs [--variants a,e]
import { chromium, firefox, webkit } from 'playwright';
import { startServer } from './server.mjs';
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const VARIANTS = arg('variants', 'a,e').split(',');
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const DARK = new Set(['dark-attr-scope', 'dark-class-scope', 'dark-on-host', 'neutral-in-dark-class', 'neutral-in-dark-attr',
  'marked-host-in-dark', 'design-token-dark-class', 'design-token-dark-attr-nested', 'foreign-root-dark-host',
  'foreign-root-dark-region', 'foreign-root-neutral-in-dark', 'lyra-subclass-dark-region']);
const LIGHT = new Set(['light-class-scope', 'light-island-in-dark']);
// Forms whose surface an input or output override sets, and the shadcn regions (their inputs decide).
const SKIP = /theme-input|output-token|foreign-host-inputs|marked-input-wrapper|shadcn-/;
const passes = [[1, '', 'light'], [1, 'dark', 'light'], [1, '', 'dark'], [0, '', 'light'], [0, 'dark', 'light'], [0, '', 'dark']];
// v21's dark page surface was #1a1a1a; the Shadcn default look (v24+) uses #0a0a0a.
const isDark = (value) => /^#(?:1a1a1a|0a0a0a)$/i.test(value);
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  for (const [theme, root, scheme] of passes) {
    const seen = {};
    for (const v of VARIANTS) {
      const page = await browser.newPage({ colorScheme: scheme });
      await page.goto(`${base}/web/parity-e.html?variant=${v}&theme=${theme}&root=${root}`);
      await page.waitForFunction(() => window.parityReady === true);
      await page.emulateMedia({ colorScheme: scheme });
      await page.evaluate(() => window.settle());
      seen[v] = await page.evaluate(() => Object.fromEntries(Object.entries(window.paritySignature())
        .map(([id, list]) => [id, list[0][0].replace(/^lr-button\{/, '').split('|')[0]])));
      await page.close();
    }
    // v21's theme.css pinned :root light; since v22 (RFC 0001) theme.css follows the OS preference
    // on a root without an explicit mode, exactly like the zero-configuration layer.
    const rootDark = root === 'dark' || scheme === 'dark';
    const wrong = Object.fromEntries(VARIANTS.map((v) => [v, []]));
    for (const id of Object.keys(seen[VARIANTS[0]])) {
      if (SKIP.test(id)) continue;
      const want = DARK.has(id) ? true : LIGHT.has(id) ? false : rootDark;
      for (const v of VARIANTS) if (isDark(seen[v][id]) !== want) wrong[v].push(id);
    }
    console.log(`${name} theme.css=${theme ? 'yes' : 'no'} root=${root || '-'} os=${scheme}: ` +
      VARIANTS.map((v) => `${v.toUpperCase()} not in the nearest scope's mode: ${wrong[v].join(' ') || 'none'}`).join(' | '));
  }
  await browser.close();
}
server.close();
