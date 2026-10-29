import assert from 'node:assert/strict';
import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePackage = fileURLToPath(new URL('../', import.meta.url));
const sourceWorkspace = resolve(sourcePackage, '../..');
const optionalConfig = ['.npmrc', '.pnpmfile.cjs', '.pnpmfile.mjs'];

/** Copies only authored inputs; installed dependencies remain read-only through one link. */
export async function createNativeTerrainInputsFixture() {
  const container = await mkdtemp(join(tmpdir(), 'lyra-map-native-inputs-'));
  const enclosing = join(container, 'enclosing');
  const workspace = join(enclosing, 'workspace');
  const directory = join(workspace, 'packages/lyra-map');
  try {
    await mkdir(directory, { recursive: true });
    for (const file of ['.nvmrc', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json', 'patches'])
      await cp(join(sourceWorkspace, file), join(workspace, file), { recursive: true });
    for (const file of optionalConfig) {
      try { await cp(join(sourceWorkspace, file), join(workspace, file)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    for (const file of ['scripts', 'src/scene', 'package.json', 'UPSTREAM.json'])
      await cp(join(sourcePackage, file), join(directory, file), { recursive: true });
    await symlink(join(sourcePackage, 'node_modules'), join(directory, 'node_modules'), 'dir');
    async function owned(file) {
      const target = resolve(workspace, file), inside = relative(workspace, target);
      assert.ok(inside && inside !== '..' && !inside.startsWith(`..${sep}`) && !inside.startsWith(sep), 'fixture paths stay inside its workspace');
      let current = workspace;
      for (const component of inside.split(sep)) {
        current = join(current, component);
        try { assert.equal((await lstat(current)).isSymbolicLink(), false, 'fixture writes never follow symlinks'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      return target;
    }
    return {
      directory, workspace, enclosing, container,
      compilerOptions: Object.freeze({ cwd: directory, tsconfig: false }),
      async write(file, data) { const target = await owned(file); await mkdir(dirname(target), { recursive: true }); await writeFile(target, data); },
      async read(file) { return readFile(await owned(file), 'utf8'); },
      async removeFile(file) { await rm(await owned(file), { force: true }); },
      remove: () => rm(container, { recursive: true, force: true })
    };
  } catch (error) {
    await rm(container, { recursive: true, force: true });
    throw error;
  }
}
