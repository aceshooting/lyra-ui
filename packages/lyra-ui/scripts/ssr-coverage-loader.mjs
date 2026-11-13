import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { threadId } from 'node:worker_threads';
import { transformSsrSource } from './ssr-coverage-source.mjs';

let packageDirectory, cacheDirectory, tsconfigRaw;

export async function initialize(options) {
  packageDirectory = resolve(options.packageDirectory);
  cacheDirectory = resolve(options.cacheDirectory);
  // Match the browser runner's complete compiler configuration, including decorator semantics.
  tsconfigRaw = await readFile(join(packageDirectory, 'tsconfig.json'), 'utf8');
}

export async function load(url, context, nextLoad) {
  if (!url.startsWith('file:') || !url.endsWith('.js')) return nextLoad(url, context);
  const modulePath = relative(join(packageDirectory, 'dist'), fileURLToPath(url));
  if (!modulePath || isAbsolute(modulePath) || modulePath.startsWith(`..${sep}`) || modulePath === '..') return nextLoad(url, context);
  const sourcePath = join('src', modulePath.replace(/\.js$/u, '.ts'));
  let source;
  try { source = await readFile(join(packageDirectory, sourcePath), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return nextLoad(url, context); throw error; }
  const code = await transformSsrSource(source, join(packageDirectory, sourcePath), tsconfigRaw);
  const output = join(cacheDirectory, `${modulePath}.json`);
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.${threadId}.tmp`;
  await writeFile(temporary, JSON.stringify({ sourcePath: sourcePath.split(sep).join('/'),
    sourceSha256: createHash('sha256').update(source).digest('hex'), code }));
  await rename(temporary, output);
  return { format: 'module', source: code, shortCircuit: true };
}
