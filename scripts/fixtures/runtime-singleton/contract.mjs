import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const UI_PACKAGE = '@aceshooting/lyra-ui';
export const PUBLIC_PROBES = Object.freeze([
  UI_PACKAGE,
  `${UI_PACKAGE}/package.json`,
  `${UI_PACKAGE}/utilities/overlay-manager.js`,
  `${UI_PACKAGE}/components/lr-popover.js`,
  `${UI_PACKAGE}/components/overlays/dialog/dialog.class.js`,
]);
const DUPLICATE_CODE = '[lr-runtime-duplicate]';

export function runtimePeerVersions(profile, manifest) {
  const range = profile.managedPeerRanges?.katex;
  const match = /^\^(\d+\.\d+\.\d+)(?: \|\| \^\d+\.\d+\.\d+)*$/u.exec(range ?? '');
  assert.ok(match, 'The pinned KaTeX profile must provide an explicit stable floor');
  const current = profile.currentVersions?.katex;
  assert.match(current ?? '', /^\d+\.\d+\.\d+$/u);
  assert.notEqual(match[1], current, 'The two peer contexts need different supported versions');
  assert.equal(manifest.peerDependencies?.katex, range, 'The supplied archive must match the pinned peer profile');
  assert.equal(manifest.peerDependenciesMeta?.katex?.optional, true);
  return { floor: match[1], current };
}

export function assertInstalledTopology(rows, expectedVersion, expectedIntegrity, lockfile) {
  assert.equal(rows.length, 3, 'Inspect the application and both feature packages');
  assert.deepEqual(rows.map(row => row.owner).sort(), ['app', 'feature-a', 'feature-b']);
  for (const row of rows) {
    assert.equal(row.name, UI_PACKAGE);
    assert.equal(row.version, expectedVersion, `${row.owner} installed UI version`);
    assert.equal(row.integrity, expectedIntegrity, `${row.owner} archive integrity`);
    assert.ok(row.packageRoot && row.utilityEntry, `${row.owner} resolved public exports`);
    assert.equal(row.utilityHash, row.packedUtilityHash, `${row.owner} installed utility bytes match the supplied archive`);
  }
  const byOwner = Object.fromEntries(rows.map(row => [row.owner, row]));
  assert.equal(byOwner.app.packageRoot, byOwner['feature-a'].packageRoot,
    'The app and feature A must share the current peer context');
  assert.notEqual(byOwner['feature-a'].packageRoot, byOwner['feature-b'].packageRoot,
    'The raw fixture must install two physical UI peer contexts, not two aliases to one context');
  assert.notEqual(byOwner['feature-a'].peerVersion, byOwner['feature-b'].peerVersion);
  assert.ok(lockfile.includes(expectedIntegrity), 'The lockfile must retain the supplied archive integrity');
}

export function assertRuntimeIdentity(sameFunction, mode, environment = 'production') {
  // Ordinary optimizer discovery may validly collapse equal public specifiers.
  // That observation is a single-runtime control, not a missing-diagnostic RED.
  if (mode === 'raw' && environment === 'development') return sameFunction ? 'single' : 'split';
  assert.equal(sameFunction, mode !== 'raw', `${mode}: independently imported public utility identity`);
  return sameFunction ? 'single' : 'split';
}

export function assertBundleRoots(roots, mode, expectedRoots) {
  assert.equal(new Set(roots).size, new Set(expectedRoots).size,
    `${mode}: actual bundled UI package contexts`);
  assert.deepEqual([...new Set(roots)].sort(), [...new Set(expectedRoots)].sort(),
    `${mode}: actual UI graph must use the selected application package context`);
}

export function assertDevelopmentGraph(modules, { mode, expectedRoots }) {
  assert.ok(modules.length > 0, 'Development provenance needs actual successful script responses');
  const byFile = new Map(modules.map(module => [module.file, module]));
  const reachesSources = (module, visiting = new Set()) => {
    assert.ok(!visiting.has(module.file), 'An optimizer facade cycle has no independently mapped executable leaf');
    if (!module.facadeChildren) {
      assert.ok(module.sources.length > 0, 'Served optimizer output must expose its actual source map graph');
      return;
    }
    assert.ok(module.facadeChildren.length > 0, 'A mapless facade must have actual imported chunks');
    const next = new Set([...visiting, module.file]);
    for (const file of module.facadeChildren) {
      const child = byFile.get(file);
      assert.ok(child, 'Every mapless facade dependency must have been served to this page');
      reachesSources(child, next);
    }
  };
  for (const module of modules) {
    assert.ok(module.url && module.file, 'Every served script needs a resolved module graph file');
    if (module.optimized) {
      assert.ok(module.optimizerId, 'Served optimizer output must have matching dependency metadata');
      reachesSources(module);
    }
  }
  assertBundleRoots(modules.flatMap(module => module.uiRoots), mode, expectedRoots);
}

/** Only generated import/re-export facades may delegate provenance to served child chunks. */
export function optimizerFacadeImports(source) {
  const dependencies = [];
  let remaining = source.trim();
  while (remaining) {
    const match = /^(?:export\s*\{[\w$,\s]*\}\s*from\s*|import\s*)(['"])(\.\.?\/[\w./-]+\.js)\1\s*;?/u.exec(remaining);
    assert.ok(match, 'Mapless optimizer output contains executable or unrecognized code');
    dependencies.push(match[2]);
    remaining = remaining.slice(match[0].length).trim();
  }
  assert.ok(dependencies.length > 0, 'An empty mapless output is not executable graph evidence');
  return [...new Set(dependencies)];
}

export async function withRuntimePhase(environment, action) {
  const previous = process.env.NODE_ENV;
  const mode = environment === 'production' ? 'production' : 'development';
  process.env.NODE_ENV = mode;
  try { return await action(mode); }
  finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

export function assertCompositionOwnership(ownership, lowerOwner) {
  assert.deepEqual(ownership, {
    lower: lowerOwner, upper: lowerOwner === 'a' ? 'b' : 'a', registeredPopoverMatches: true,
  }, 'The newer popover must be registered by the other runtime owner');
}

export function classifyConsole(messages, { development = false } = {}) {
  const diagnostics = [], unexpected = [];
  for (const message of messages) {
    if (message.type !== 'warning' && message.type !== 'error') continue;
    if (message.type === 'warning' && message.text.startsWith(DUPLICATE_CODE)) {
      diagnostics.push(message.text);
    } else if (development && message.type === 'warning' &&
      message.text === 'Lit is in dev mode. Not recommended for production! See https://lit.dev/msg/dev-mode for more information.') {
      // The documented development-condition notice is unrelated to UI duplication.
    } else {
      unexpected.push(message);
    }
  }
  return { diagnostics, unexpected };
}

export function assertConsoleContract(messages, { mode, development = false, active = true, topology = mode === 'raw' ? 'split' : 'single' }) {
  const { diagnostics, unexpected } = classifyConsole(messages, { development });
  assert.deepEqual(unexpected, [], 'Unexpected browser warnings or errors');
  assert.equal(diagnostics.length, active && topology === 'split' ? 1 : 0,
    'Unsupported split-runtime use must emit one observable diagnostic; passive imports and canonical use stay silent');
  if (diagnostics.length) {
    assert.match(diagnostics[0], /application|public imports/u, 'The diagnostic must explain the supported repair');
    assert.match(diagnostics[0], /version/u, 'The diagnostic must distinguish runtime identity from version equality');
  }
}

export function optimizerSourceFiles(map, mapFile) {
  assert.equal(map.version, 3, 'The served optimizer map must use the standard source-map format');
  if (map.sections) {
    return map.sections.flatMap(section => {
      assert.ok(section.map, 'An optimizer source-map section must be embedded');
      return optimizerSourceFiles(section.map, mapFile);
    });
  }
  assert.ok(Array.isArray(map.sources) && map.sources.length > 0, 'An optimizer chunk needs source provenance');
  return map.sources.flatMap(source => {
    assert.equal(typeof source, 'string');
    if (source.startsWith('file:')) return [fileURLToPath(source)];
    if (/^[a-z][a-z\d+.-]*:/iu.test(source) || source.startsWith('\0')) return [source];
    return [resolve(dirname(mapFile), map.sourceRoot ?? '', source)];
  });
}
