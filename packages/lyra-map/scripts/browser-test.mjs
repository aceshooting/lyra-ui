import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const requested = process.env.WTR_BROWSER ?? process.env.MAP_BROWSER ?? 'chromium';
const channel = requested === 'edge' ? 'msedge' : requested;
if (!['chromium', 'firefox', 'webkit', 'chrome', 'msedge'].includes(channel))
  throw new Error(`Unknown browser ${requested}`);
const fontResult = process.env.MAP_TEST_FONT
  ? undefined
  : spawnSync('fc-match', ['-f', '%{file}', 'sans'], { encoding: 'utf8' });
const font = process.env.MAP_TEST_FONT ?? fontResult?.stdout.trim();
if (!font) throw new Error('Set MAP_TEST_FONT to an installed TrueType font, or install fontconfig.');
await readFile(font);
await mkdir(resolve(root, 'test-results'), { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'lyra-map-browser-'));
const entry = resolve(scratch, 'entry.mjs');
function command(binary, args, cwd = scratch) {
  const result = spawnSync(binary, args, {
    cwd,
    encoding: 'utf8',
    timeout: 60000,
    env: { ...process.env, npm_config_cache: resolve(scratch, 'npm-cache') }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${binary} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}
try {
  // Exercise the published archive through a consumer's package exports. Dependencies used
  // only by declarations are checked by the separate packed-consumer type gate.
  const packed = JSON.parse(
    command('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], root)
  );
  const archive = resolve(scratch, packed[0].filename);
  const installed = resolve(scratch, 'node_modules/@aceshooting/lyra-map');
  await mkdir(installed, { recursive: true });
  command('tar', ['-xzf', archive, '--strip-components=1', '-C', installed]);
  await writeFile(resolve(scratch, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  await writeFile(
    resolve(scratch, 'public-entries.mjs'),
    `
    export { lyraMapWorkerPlugin } from '@aceshooting/lyra-map/vite';
    export const cssUrl = new URL(import.meta.resolve('@aceshooting/lyra-map/map.css'));
  `
  );
  const { lyraMapWorkerPlugin, cssUrl } = await import(pathToFileURL(resolve(scratch, 'public-entries.mjs')).href);
  await writeFile(
    entry,
    "export {Map,Marker,Popup,AttributionControl,NavigationControl,GeolocateControl,ScaleControl,setWorkerUrl,getVersion,prepareStyle} from '@aceshooting/lyra-map';"
  );
  const result = await build({
    configFile: false,
    root: scratch,
    base: './',
    logLevel: 'warn',
    plugins: [lyraMapWorkerPlugin()],
    build: {
      write: false,
      minify: true,
      sourcemap: false,
      rolldownOptions: {
        input: entry,
        preserveEntrySignatures: 'strict',
        onwarn(warning) {
          throw new Error(`Consumer build warning ${warning.code}: ${warning.message}`);
        },
        output: { format: 'es', entryFileNames: '[name]-[hash].mjs', chunkFileNames: '[name]-[hash].mjs' }
      }
    }
  });
  const chunks = result.output.filter((item) => item.type === 'chunk');
  const main = chunks.find((chunk) => chunk.facadeModuleId === entry);
  if (!main) throw new Error('Missing browser fixture entry');
  for (const chunk of chunks) await writeFile(resolve(scratch, chunk.fileName), chunk.code);
  await writeFile(
    resolve(scratch, 'receipt.json'),
    JSON.stringify({ entries: [{ file: main.fileName, facade: '\0modular-entry' }] })
  );
  for (const name of ['fixture.mjs', 'data.json', 'tile.pbf', 'raster.png', 'dem.png']) {
    await copyFile(resolve(root, 'test/browser', name), resolve(scratch, name));
  }
  await copyFile(cssUrl, resolve(scratch, 'map.css'));
  await writeFile(
    resolve(root, `test-results/${channel}-build.json`),
    JSON.stringify(
      {
        archiveSha256: createHash('sha256')
          .update(await readFile(archive))
          .digest('hex'),
        chunks: chunks.map((chunk) => ({
          file: chunk.fileName,
          bytes: Buffer.byteLength(chunk.code),
          gzip6: gzipSync(chunk.code, { level: 6 }).length,
          sha256: createHash('sha256').update(chunk.code).digest('hex'),
          imports: chunk.imports,
          dynamicImports: chunk.dynamicImports
        }))
      },
      null,
      2
    )
  );
  const run = spawnSync(process.execPath, [resolve(root, 'test/browser/runtime.mjs'), channel], {
    stdio: 'inherit',
    timeout: 240000,
    env: {
      ...process.env,
      MAP_TEST_ASSETS: scratch,
      MAP_TEST_FONT: font,
      MAP_TEST_RESULT: resolve(root, `test-results/${channel}.json`)
    }
  });
  if (run.error) throw run.error;
  process.exitCode = run.status ?? 1;
} finally {
  await rm(scratch, { recursive: true, force: true });
}
