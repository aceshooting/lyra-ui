// Which component types force a synchronous style recalc during first render (Chromium CDP)?
import { chromium } from 'playwright';
import { startServer } from './server.mjs';
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
for (const variant of ['a', 'b']) {
  for (const tag of ['lr-button', 'lr-input', 'lr-card', 'lr-badge', 'lr-icon', 'lr-switch']) {
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await page.goto(`${base}/web/bench.html?variant=${variant}`);
    await page.waitForFunction(() => window.spikeReady === true);
    const get = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const m0 = await get();
    const t = await page.evaluate(async (tag) => {
      const host = document.getElementById('host');
      const t0 = performance.now();
      host.innerHTML = Array.from({ length: 600 }, () => `<${tag}>x</${tag}>`).join('');
      await Promise.all(Array.from(host.children, (e) => e.updateComplete));
      document.body.offsetHeight;
      return performance.now() - t0;
    }, tag);
    const m1 = await get();
    console.log(variant, tag.padEnd(10), 'ms', t.toFixed(0).padStart(5), 'recalcCount', m1.RecalcStyleCount - m0.RecalcStyleCount, 'recalcMs', ((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000).toFixed(0), 'layoutCount', m1.LayoutCount - m0.LayoutCount);
    await page.close();
  }
}
await browser.close();
server.close();
