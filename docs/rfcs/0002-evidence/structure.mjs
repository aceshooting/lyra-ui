// Structural measurement: what each Lyra host carries today (A) versus the prototype (B).
// Usage: node structure.mjs  -> out/structure.json
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
import { startServer } from './server.mjs';

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const results = {};

for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  results[name] = { version: browser.version() };
  for (const variant of (process.argv[2] ?? 'a,b,c,d').split(',')) {
    const page = await browser.newPage();
    await page.goto(`${base}/web/bench.html?variant=${variant}`);
    await page.waitForFunction(() => window.spikeReady === true);
    await page.evaluate(() => window.spike.render(12));
    results[name][variant] = await page.evaluate(() => {
      const ids = new Map();
      const sheetId = (s) => { if (!ids.has(s)) ids.set(s, ids.size); return ids.get(s); };
      function sheetStats(sheet) {
        let rules = 0, custom = 0, unconditionalHostCustom = 0;
        const walk = (list, conditional) => {
          for (const r of list) {
            rules++;
            if (r.style) {
              let c = 0;
              for (let i = 0; i < r.style.length; i++) if (r.style[i].startsWith('--')) c++;
              custom += c;
              if (!conditional && r.selectorText?.trim() === ':host') unconditionalHostCustom += c;
            }
            if (r.cssRules) walk(r.cssRules, true);
          }
        };
        walk(sheet.cssRules, false);
        return { id: sheetId(sheet), rules, custom, unconditionalHostCustom };
      }
      const customNames = (el) => {
        const cs = getComputedStyle(el);
        const names = new Set();
        for (let i = 0; i < cs.length; i++) if (cs[i].startsWith('--')) names.add(cs[i]);
        return names;
      };
      const rootNames = customNames(document.documentElement);
      const perType = {};
      for (const t of ['lr-button', 'lr-input', 'lr-card', 'lr-badge', 'lr-icon', 'lr-switch']) {
        const [first, second] = document.querySelectorAll(t);
        const sheets = first.shadowRoot.adoptedStyleSheets;
        const hostNames = customNames(first);
        const parentNames = customNames(first.parentElement);
        let declaredHere = 0, lrOnHost = 0;
        for (const n of hostNames) {
          if (n.startsWith('--lr-') && !n.startsWith('--lr-theme-')) lrOnHost++;
          if (!parentNames.has(n)) declaredHere++;
        }
        perType[t] = {
          adoptedSheets: sheets.length,
          sharedWithSecondInstance: sheets.every((s, i) => s === second.shadowRoot.adoptedStyleSheets[i]),
          styleElements: first.shadowRoot.querySelectorAll('style').length,
          sheets: Array.from(sheets, sheetStats),
          computedCustomOnHost: hostNames.size,
          computedLrOutputTokensOnHost: lrOnHost,
          computedCustomOnParent: parentNames.size,
          customNamesNotOnParent: declaredHere,
        };
      }
      return {
        crossOriginIsolated: self.crossOriginIsolated,
        computedCustomOnRoot: rootNames.size,
        documentAdoptedSheets: document.adoptedStyleSheets.length,
        distinctSheetObjects: ids.size,
        perType,
      };
    });
    await page.close();
  }
  await browser.close();
}
server.close();
writeFileSync(new URL(`./out/structure${process.argv[2] ? '-' + process.argv[2].replaceAll(',', '') : ''}.json`, import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 1));
