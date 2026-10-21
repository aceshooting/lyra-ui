// The WebGL 3D engines and three.js ship in the optional @aceshooting/lyra-3d companion and must
// never be reachable from any published entry point except through a lazy `import()`: an
// application that does not opt an element into WebGL never downloads them. One splitting-aware
// esbuild graph of every JavaScript export proves it per entry point; the companion and three.js are
// kept external so a forbidden edge is reported by name instead of failing module resolution.
import { join } from 'node:path';

/** Bare specifiers that may only be reached through a dynamic import. */
const ENGINE_3D_LAZY_ONLY = Object.freeze(['@aceshooting/lyra-3d', 'three']);

const lazyOnly = (specifier) =>
  ENGINE_3D_LAZY_ONLY.some((name) => specifier === name || specifier.startsWith(`${name}/`));

/** Every JavaScript file a consumer can import through the package `exports` map, sorted. */
export function javascriptExportTargets(exportsMap) {
  const targets = new Set();
  const visit = (value) => {
    if (typeof value === 'string') {
      if (/\.m?js$/u.test(value) && !value.includes('*')) targets.add(value.replace(/^\.\//u, ''));
    } else if (value && typeof value === 'object') {
      for (const nested of Object.values(value)) visit(nested);
    }
  };
  visit(exportsMap);
  return [...targets].sort();
}

/**
 * Static (non-`import()`) paths from each entry to a lazy-only package in an esbuild metafile.
 * Returns one finding per offending entry with the import chain that reaches the package.
 */
export function staticEngine3dReach(metafile, entries) {
  const inputs = metafile?.inputs ?? {};
  const findings = [];
  for (const entry of entries) {
    const parents = new Map([[entry, null]]);
    const queue = [entry];
    let reached;
    while (queue.length > 0 && !reached) {
      const current = queue.shift();
      for (const edge of inputs[current]?.imports ?? []) {
        if (edge.kind === 'dynamic-import') continue;
        const specifier = edge.original ?? edge.path;
        if (edge.external && lazyOnly(specifier)) {
          reached = { from: current, specifier };
          break;
        }
        if (!edge.external && /(?:^|\/)node_modules\/(?:@aceshooting\/lyra-3d|three)\//u.test(edge.path)) {
          reached = { from: current, specifier: edge.path };
          break;
        }
        if (!edge.external && !parents.has(edge.path)) {
          parents.set(edge.path, current);
          queue.push(edge.path);
        }
      }
    }
    if (!reached) continue;
    const chain = [reached.specifier];
    for (let module = reached.from; module !== null; module = parents.get(module) ?? null) chain.unshift(module);
    findings.push({ entry, chain });
  }
  return findings;
}

/**
 * Bundles every JavaScript export of the built package in one splitting-aware graph and returns
 * error lines for any entry that statically reaches the 3D companion or three.js.
 */
export async function verifyEngine3dIsolation({ esbuild, packageDir, exportsMap, external }) {
  const entries = javascriptExportTargets(exportsMap);
  if (entries.length === 0) return ['3D isolation: the exports map has no JavaScript entry points'];
  const result = await esbuild.build({
    entryPoints: entries.map((entry) => join(packageDir, entry)),
    bundle: true,
    format: 'esm',
    splitting: true,
    write: false,
    metafile: true,
    outdir: join(packageDir, '.engine-3d-isolation'),
    external: [...new Set([...external, ...ENGINE_3D_LAZY_ONLY.flatMap((name) => [name, `${name}/*`])])],
    absWorkingDir: packageDir,
    logLevel: 'silent',
  });
  const normalized = { inputs: {} };
  for (const [path, input] of Object.entries(result.metafile.inputs)) {
    normalized.inputs[path.replaceAll('\\', '/')] = {
      imports: input.imports.map((edge) => ({ ...edge, path: edge.external ? edge.path : edge.path.replaceAll('\\', '/') })),
    };
  }
  const missing = entries.filter((entry) => !normalized.inputs[entry]);
  if (missing.length > 0) {
    return [`3D isolation: ${missing.length} entry point(s) missing from the bundle graph (first: ${missing[0]})`];
  }
  return staticEngine3dReach(normalized, entries).map(
    ({ entry, chain }) => `${entry}: statically reaches ${chain.at(-1)} (${chain.join(' -> ')}); load it with import() instead`,
  );
}
