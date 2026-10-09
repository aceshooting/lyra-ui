// Keeps the Playwright container images and browser cache key in step with the pinned dependency.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = ['ci.yml', 'full-engine.yml', 'test-all-browsers.yml'].map((name) =>
  path.join(repoRoot, '.github/workflows', name),
);
const VERSION_FILE = path.join(repoRoot, '.github/playwright-version.txt');

export function pinnedPlaywright() {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const version = (pkg.devDependencies?.playwright ?? pkg.dependencies?.playwright ?? '').replace(/[^0-9.]/g, '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('root package.json must pin a concrete playwright version');
  return version;
}

export function syncPlaywrightImages({ write }) {
  const version = pinnedPlaywright();
  const stale = [];
  for (const file of WORKFLOWS) {
    const source = readFileSync(file, 'utf8');
    const next = source.replace(/(mcr\.microsoft\.com\/playwright:v)[0-9.]+(-)/g, `$1${version}$2`);
    if (next !== source) {
      stale.push(path.relative(repoRoot, file));
      if (write) writeFileSync(file, next);
    }
  }
  if (readFileSync(VERSION_FILE, 'utf8').trim() !== version) {
    stale.push(path.relative(repoRoot, VERSION_FILE));
    if (write) writeFileSync(VERSION_FILE, `${version}\n`);
  }
  return { version, stale };
}

const mode = process.argv[2];
if (mode === '--write' || mode === '--check') {
  const { version, stale } = syncPlaywrightImages({ write: mode === '--write' });
  if (mode === '--check' && stale.length > 0) {
    console.error(`Playwright images are stale for ${version}: ${stale.join(', ')}`);
    process.exit(1);
  }
  console.log(stale.length > 0 ? `Updated Playwright ${version}: ${stale.join(', ')}` : `Playwright images match ${version}.`);
} else if (mode) {
  console.error('usage: node scripts/sync-playwright-images.mjs --write|--check');
  process.exit(2);
}
