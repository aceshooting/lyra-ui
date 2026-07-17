import { chromium } from '/mnt/a805817a-3f74-4a91-a611-b695b20df84e/git/solarserver/lyra-ui/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.mjs';

const url = process.argv[2];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('requestfailed', (req) => console.log('[requestfailed]', req.url(), req.failure()?.errorText));

const start = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 30000 });
console.log('loaded in', Date.now() - start, 'ms');

for (let i = 0; i < 100; i++) {
  const state = await page
    .evaluate(() => {
      const passed = document.querySelectorAll('#mocha-report .test.pass').length;
      const failed = document.querySelectorAll('#mocha-report .test.fail').length;
      return {
        passed,
        failed,
        statsText: document.querySelector('#mocha-stats')?.textContent,
        bodyLen: document.body.innerHTML.length,
      };
    })
    .catch((e) => ({ error: String(e) }));
  console.log(i, JSON.stringify(state));
  if (state && (state.failed > 0 || state.passed > 40)) {
    // keep going regardless to see final state
  }
  await new Promise((r) => setTimeout(r, 1000));
}

await browser.close();
