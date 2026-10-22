import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const requested = process.env.WTR_BROWSER ?? process.env.LYRA_3D_BROWSER ?? 'chromium';
const channel = requested === 'edge' ? 'msedge' : requested;
if (!['chromium', 'firefox', 'webkit', 'chrome', 'msedge'].includes(channel)) throw new Error(`Unknown browser ${requested}`);
await mkdir(resolve(root, 'test-results'), { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'lyra-3d-browser-'));
function command(binary, args, cwd = scratch) {
  const result = spawnSync(binary, args, {
    cwd,
    encoding: 'utf8',
    timeout: 60000,
    env: { ...process.env, npm_config_cache: resolve(scratch, 'npm-cache') },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${binary} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}
try {
  // Exercise the published archive through a consumer build: package exports, the worker URL
  // pattern and tree shaking all go through the application bundler as they would in the field.
  const packed = JSON.parse(command('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], root));
  const installed = resolve(scratch, 'node_modules/@aceshooting/lyra-3d');
  await mkdir(installed, { recursive: true });
  command('tar', ['-xzf', resolve(scratch, packed[0].filename), '--strip-components=1', '-C', installed]);
  // The archive's runtime dependency, linked from this workspace's install instead of the registry.
  await symlink(await realpath(resolve(root, 'node_modules/three')), resolve(scratch, 'node_modules/three'), 'dir');
  await writeFile(resolve(scratch, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  for (const name of ['fixture.mjs', 'kernel.mjs', 'kernel.worker.mjs', 'viewport.mjs', 'graph.mjs', 'graph-spatial.mjs', 'points.mjs', 'panorama.mjs', 'model.mjs']) {
    await copyFile(resolve(root, 'test/browser', name), resolve(scratch, name));
  }
  await copyFile(resolve(root, '../lyra-ui/src/components/media/media-card/fixtures/sample.mp4'), resolve(scratch, 'panorama-video.mp4'));
  await writeFile(resolve(scratch, 'index.html'),
    '<!doctype html><link rel="icon" href="data:,"><body style="margin:0"><script type="module" src="./fixture.mjs"></script></body>');
  const output = resolve(scratch, 'out');
  await build({
    configFile: false,
    root: scratch,
    base: './',
    logLevel: 'warn',
    worker: { format: 'es' },
    build: {
      outDir: output,
      minify: true,
      sourcemap: false,
      modulePreload: false,
      rolldownOptions: {
        onwarn(warning) {
          throw new Error(`Consumer build warning ${warning.code}: ${warning.message}`);
        },
      },
    },
  });
  const run = spawnSync(process.execPath, [resolve(root, 'test/browser/runtime.mjs'), channel], {
    stdio: 'inherit',
    timeout: 300000,
    env: {
      ...process.env,
      LYRA_3D_TEST_ASSETS: output,
      LYRA_3D_TEST_RESULT: resolve(root, `test-results/${channel}${process.env.LYRA_3D_GPU ? `-gpu-${process.env.LYRA_3D_GPU}` : ''}.json`),
    },
  });
  if (run.error) throw run.error;
  process.exitCode = run.status ?? 1;
} finally {
  await rm(scratch, { recursive: true, force: true });
}
