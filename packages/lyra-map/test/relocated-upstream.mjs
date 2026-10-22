import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { upstreamRoot } from './pinned-upstream.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const linked = (error) => { if (error.code !== 'EEXIST') throw error; };

/** The build's own definition of the source tree hash: every file under `src`, in path order. */
async function sourceTreeHash(upstream) {
  const entries = await readdir(join(upstream, 'src'), { recursive: true, withFileTypes: true });
  const manifest = [];
  for (const path of entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name)).sort()) {
    const data = await readFile(path);
    manifest.push({ file: relative(upstream, path).replaceAll('\\', '/'), bytes: data.length, sha256: sha256(data) });
  }
  return sha256(JSON.stringify(manifest));
}

/**
 * Gives a scratch package a private, editable copy of the upstream files the build reads, with the
 * package's own dependencies and the upstream's linked next to it so the copy resolves its imports
 * as the original does. Tests edit files under `upstream`, then call `repin()` so that the pin
 * accepts the edited tree; the build then runs against upstream source that differs from the
 * reviewed one in exactly that edit.
 */
export async function relocateUpstream(directory, packageRoot) {
  const modules = join(directory, 'node_modules');
  await rm(modules, { force: true });
  await mkdir(modules);
  for (const source of [join(packageRoot, 'node_modules'), dirname(upstreamRoot)]) {
    for (const entry of await readdir(source)) {
      if (entry.startsWith('.') || entry === 'maplibre-gl') continue;
      if (!entry.startsWith('@')) {
        await symlink(await realpath(join(source, entry)), join(modules, entry), 'dir').catch(linked);
        continue;
      }
      await mkdir(join(modules, entry), { recursive: true });
      for (const name of await readdir(join(source, entry))) {
        await symlink(await realpath(join(source, entry, name)), join(modules, entry, name), 'dir').catch(linked);
      }
    }
  }
  const upstream = join(modules, 'maplibre-gl');
  await mkdir(join(upstream, 'dist'), { recursive: true });
  for (const file of ['package.json', 'LICENSE.txt', 'dist/maplibre-gl.css', 'dist/maplibre-gl.d.ts']) {
    await cp(join(upstreamRoot, file), join(upstream, file));
  }
  await cp(join(upstreamRoot, 'src'), join(upstream, 'src'), { recursive: true });
  return {
    upstream,
    async edit(file, change) {
      const path = join(upstream, file);
      await writeFile(path, change(await readFile(path, 'utf8')));
    },
    async repin() {
      const pinFile = join(directory, 'UPSTREAM.json');
      const pin = JSON.parse(await readFile(pinFile, 'utf8'));
      pin.sourceTreeSha256 = await sourceTreeHash(upstream);
      await writeFile(pinFile, JSON.stringify(pin));
      return pin;
    },
  };
}
