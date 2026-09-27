// Rendering parity between A (the package as built) and E (the revised proposal): computed-style
// signatures of every Lyra host (resolved tokens included) and shadow descendant, plus a pixel diff
// per section, in three engines, with and without theme.css, and with the deprecated fixed shadcn look.
// Usage: node parity-e.mjs [--engines chromium,firefox,webkit] -> out/parity-ae.json
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startServer } from './server.mjs';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const pixelmatch = (await import('pixelmatch')).default;
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const ENGINES = arg('engines', 'chromium,firefox,webkit').split(',');
const [V0, V1] = arg('variants', 'a,e').split(',');
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const passes = [
  { name: 'theme/light', theme: 1, root: '', colorScheme: 'light' },
  { name: 'theme/root-dark-attr', theme: 1, root: 'dark', colorScheme: 'light' },
  { name: 'theme/os-dark', theme: 1, root: '', colorScheme: 'dark' },
  { name: 'theme/forced-colors', theme: 1, root: '', colorScheme: 'light', forcedColors: 'active' },
  { name: 'theme/forced-colors-dark-attr', theme: 1, root: 'dark', colorScheme: 'dark', forcedColors: 'active' },
  { name: 'theme/reduced-motion', theme: 1, root: '', colorScheme: 'light', reducedMotion: 'reduce' },
  { name: 'theme/reduced-motion+app-motion-override', theme: 1, root: '', colorScheme: 'light', reducedMotion: 'reduce', app: 'motion' },
  { name: 'theme/forced-colors+app-color-override', theme: 1, root: '', colorScheme: 'light', forcedColors: 'active', app: 'color' },
  { name: 'shadcn/light', theme: 1, shadcn: 1, root: '', colorScheme: 'light' },
  { name: 'shadcn/root-dark-attr', theme: 1, shadcn: 1, root: 'dark', colorScheme: 'light' },
  { name: 'none/light', theme: 0, root: '', colorScheme: 'light' },
  { name: 'none/root-dark-attr', theme: 0, root: 'dark', colorScheme: 'light' },
  { name: 'none/os-dark', theme: 0, root: '', colorScheme: 'dark' },
  { name: 'none/forced-colors-os-dark', theme: 0, root: '', colorScheme: 'dark', forcedColors: 'active' },
  { name: 'none/reduced-motion', theme: 0, root: '', colorScheme: 'light', reducedMotion: 'reduce' },
];
const engines = { chromium, firefox, webkit };
const report = {};

for (const engineName of ENGINES) {
  const browser = await engines[engineName].launch();
  report[engineName] = { version: browser.version() };
  for (const pass of passes) {
    const media = { colorScheme: pass.colorScheme, forcedColors: pass.forcedColors ?? 'none', reducedMotion: pass.reducedMotion ?? 'no-preference' };
    const captured = {};
    for (const variant of [V0, V1]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, ...media });
      await page.goto(`${base}/web/parity-e.html?variant=${variant}&theme=${pass.theme}&root=${pass.root}&app=${pass.app ?? ''}&shadcn=${pass.shadcn ?? 0}`);
      await page.waitForFunction(() => window.parityReady === true);
      // Firefox drops media emulation when it swaps processes for a cross-origin-isolated page, so
      // apply it again, then let any transition that the change started run to completion.
      await page.emulateMedia(media);
      const running = await page.evaluate(() => window.settle());
      const signature = await page.evaluate(() => window.paritySignature());
      const shots = {};
      for (const id of Object.keys(signature)) shots[id] = await page.locator(`#${id}`).screenshot({ animations: 'disabled' });
      const matched = await page.evaluate(() => ({
        forcedColors: matchMedia('(forced-colors: active)').matches,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        dark: matchMedia('(prefers-color-scheme: dark)').matches,
      }));
      captured[variant] = { signature, shots, media: matched, running };
      await page.close();
    }
    const sections = {};
    for (const id of Object.keys(captured[V0].signature)) {
      const a = captured[V0].signature[id].flat();
      const b = captured[V1].signature[id].flat();
      const diffs = [];
      for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diffs.push({ [V0]: a[i], [V1]: b[i] });
      const pa = PNG.sync.read(captured[V0].shots[id]);
      const pb = PNG.sync.read(captured[V1].shots[id]);
      const pixels = pa.width === pb.width && pa.height === pb.height ? pixelmatch(pa.data, pb.data, null, pa.width, pa.height, { threshold: 0 }) : null;
      sections[id] = { nodes: a.length, differingNodes: diffs.length, differingPixels: pixels, example: diffs[0] ?? null };
    }
    report[engineName][pass.name] = { media: captured[V0].media, runningAnimationsSettled: [captured[V0].running, captured[V1].running], sections };
    const differing = Object.entries(sections).filter(([, s]) => s.differingNodes || s.differingPixels !== 0).map(([id]) => id);
    console.log(`${engineName} ${pass.name.padEnd(42)} ${JSON.stringify(captured[V0].media)} identical ${Object.keys(sections).length - differing.length}/${Object.keys(sections).length}  differ: ${differing.join(' ')}`);
  }
  await browser.close();
}
server.close();
writeFileSync(new URL(`./out/parity-${V0}${V1}.json`, import.meta.url), JSON.stringify(report, null, 2));
