import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScratchPackage } from '../scripts/scratch-package.mjs';

const preload = fileURLToPath(new URL('./scene-build-preload.mjs', import.meta.url));

/** A real package build with a separate observation of the bundler's module graph. */
export async function buildSceneFixture({ unqualified = true } = {}) {
  const scratch = await createScratchPackage();
  try {
    if (unqualified) await rm(join(scratch.directory, 'scripts/fixtures/native-terrain-contract.json'), { force: true });
    const graphFile = join(scratch.directory, 'scene-build-graph.json');
    const run = spawnSync(process.execPath, ['--import', preload, 'scripts/build.mjs'], {
      cwd: scratch.directory, encoding: 'utf8',
      env: { ...process.env, SCENE_BUILD_GRAPH: graphFile }
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const graph = JSON.parse(await readFile(graphFile, 'utf8'));
    const byFile = new Map(graph.map(chunk => [chunk.file, chunk]));
    assert.equal(byFile.size, graph.length, 'the emitted chunks have unique file names');
    for (const chunk of graph) {
      const bytes = await readFile(join(scratch.directory, 'dist', chunk.file));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), chunk.sha256,
        `${chunk.file} contains exactly the observed bundler output`);
    }
    const owning = source => graph.filter(chunk => chunk.modules.includes(join(scratch.directory, source)));
    const reachable = (chunk, { dynamic = true } = {}) => {
      const visited = new Set(), pending = [chunk.file];
      while (pending.length) {
        const file = pending.pop();
        if (visited.has(file)) continue;
        visited.add(file);
        const item = byFile.get(file);
        assert.ok(item, `generated import ${file} belongs to the emitted graph`);
        pending.push(...item.imports, ...(dynamic ? item.dynamicImports : []));
      }
      return visited;
    };
    return { ...scratch, graph, byFile, owning, reachable };
  } catch (error) {
    await scratch.remove();
    throw error;
  }
}
