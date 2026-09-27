// Rendering parity between A and B: computed-style signatures of every host and shadow descendant,
// plus a pixel diff per section, in three engines and three page modes.
// Usage: node parity.mjs -> out/parity.json
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startServer } from './server.mjs';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const pixelmatch = (await import('pixelmatch')).default;

const pairArg = process.argv.indexOf('--variants');
const PAIR = pairArg > 0 ? process.argv[pairArg + 1].split(',') : ['a', 'b'];
const [V0, V1] = PAIR;
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const passes = [
  { name: 'light', root: '', colorScheme: 'light' },
  { name: 'root-dark-attr', root: 'dark', colorScheme: 'light' },
  { name: 'os-dark', root: '', colorScheme: 'dark' },
  { name: 'forced-colors', root: '', colorScheme: 'light', forcedColors: 'active' },
  { name: 'forced-colors-dark-attr', root: 'dark', colorScheme: 'dark', forcedColors: 'active' },
  { name: 'reduced-motion', root: '', colorScheme: 'light', reducedMotion: 'reduce' },
];
const report = {};

for (const [engineName, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  report[engineName] = { version: browser.version() };
  for (const pass of passes) {
    const captured = {};
    for (const variant of PAIR) {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 900 }, colorScheme: pass.colorScheme,
        forcedColors: pass.forcedColors ?? 'none', reducedMotion: pass.reducedMotion ?? 'no-preference',
      });
      await page.goto(`${base}/web/parity.html?variant=${variant}&root=${pass.root}`);
      await page.waitForFunction(() => window.parityReady === true);
      // Firefox drops media emulation when it swaps processes for a cross-origin-isolated page, so
      // apply it again after navigation, then let one frame pass before reading styles.
      await page.emulateMedia({
        colorScheme: pass.colorScheme, forcedColors: pass.forcedColors ?? 'none',
        reducedMotion: pass.reducedMotion ?? 'no-preference',
      });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
      const signature = await page.evaluate(() => window.paritySignature());
      const shots = {};
      for (const id of Object.keys(signature)) shots[id] = await page.locator(`#${id}`).screenshot({ animations: 'disabled' });
      const media = await page.evaluate(() => ({
        forcedColors: matchMedia('(forced-colors: active)').matches,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        dark: matchMedia('(prefers-color-scheme: dark)').matches,
      }));
      captured[variant] = { signature, shots, media };
      await page.close();
    }
    const sections = {};
    for (const id of Object.keys(captured[V0].signature)) {
      const a = captured[V0].signature[id].flat();
      const b = captured[V1].signature[id].flat();
      const diffs = [];
      for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diffs.push({ a: a[i], b: b[i] });
      const pa = PNG.sync.read(captured[V0].shots[id]);
      const pb = PNG.sync.read(captured[V1].shots[id]);
      let pixels = null;
      if (pa.width === pb.width && pa.height === pb.height) {
        pixels = pixelmatch(pa.data, pb.data, null, pa.width, pa.height, { threshold: 0 });
      }
      sections[id] = { nodes: a.length, differingNodes: diffs.length, differingPixels: pixels, sameSize: pixels !== null, example: diffs[0] ?? null };
    }
    report[engineName][pass.name] = { media: captured[V0].media, sections };
  }
  await browser.close();
}
server.close();
writeFileSync(new URL(`./out/parity-${V0}${V1}.json`, import.meta.url), JSON.stringify(report, null, 2));
for (const [engineName, r] of Object.entries(report)) {
  console.log(`\n${engineName} ${r.version}`);
  for (const pass of passes) {
    console.log(`  ${pass.name}`);
    console.log(`    media ${JSON.stringify(r[pass.name].media)}`);
    for (const [id, s] of Object.entries(r[pass.name].sections)) {
      console.log(`    ${id.padEnd(32)} nodes ${String(s.nodes).padStart(3)} differing ${String(s.differingNodes).padStart(3)} pixels ${s.differingPixels ?? 'size-mismatch'}`);
    }
  }
}
