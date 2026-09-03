import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import { findTransitiveRegistrationPaths } from './check-registration-architecture.mjs';
import {
  ACKNOWLEDGED_INTERNAL_HELPER_MODULES,
  checkPackageExports,
  closeWildcardPackageExports,
  CURATED_COMPONENT_HELPER_MODULES,
  CURATED_UTILITY_MODULES,
  deriveExplicitComponentExports,
  deriveExplicitUtilityExports,
  findUnclassifiedHelperModules,
  generatePackageExports,
} from './generate-package-exports.mjs';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const inventory = {
  schemaVersion: 1,
  components: [
    {
      tag: 'lr-alpha',
      family: 'forms',
      classModule: 'src/components/forms/alpha/alpha.class.ts',
      registrationModule: 'src/components/forms/alpha/alpha.ts',
    },
    {
      tag: 'lr-beta',
      family: 'charts',
      classModule: 'src/components/charts/beta/beta.class.ts',
      registrationModule: 'src/components/charts/beta/beta.ts',
    },
  ],
};

const helperModules = ['src/components/charts/beta/public-helper.ts'];
const approvedPureHelperContracts = [
  {
    sourceModule: 'src/components/agent-tools/stack-trace/stack-trace-parse.ts',
    route: './components/agent-tools/stack-trace/stack-trace-parse.js',
    target: './dist/components/agent-tools/stack-trace/stack-trace-parse.js',
    values: ['DEFAULT_INTERNAL_PATTERNS', 'STACK_TRACE_LIMITS', 'parseStackTrace'],
    types: ['StackFrame', 'StackGroup', 'StackTraceParseOptions', 'StackTraceParseResult'],
  },
  {
    sourceModule: 'src/components/agent-tools/trace-tree/span.ts',
    route: './components/agent-tools/trace-tree/span.js',
    target: './dist/components/agent-tools/trace-tree/span.js',
    values: [
      'MAX_RENDERED_LYRA_SPANS',
      'normalizeLyraSpanKind',
      'normalizeLyraSpans',
      'normalizeLyraSpanStatus',
    ],
    types: ['LyraSpan', 'LyraSpanKind', 'LyraSpanProjection', 'LyraSpanStatus'],
  },
  {
    sourceModule: 'src/components/agent-tools/agent-status-presentation.ts',
    route: './components/agent-tools/agent-status-presentation.js',
    target: './dist/components/agent-tools/agent-status-presentation.js',
    values: [
      'agentStatusKind',
      'agentStatusLabel',
      'agentStatusMessage',
      'agentStatusVariant',
      'isAgentStatusActive',
      'isAgentStatusTerminal',
    ],
    types: ['AgentStatusPresentation', 'AgentStatusValue'],
  },
  {
    sourceModule: 'src/components/agent-tools/approval-state.ts',
    route: './components/agent-tools/approval-state.js',
    target: './dist/components/agent-tools/approval-state.js',
    values: ['approvalAction', 'approvalDecision'],
    types: ['ApprovalAction', 'ApprovalDecision'],
  },
  {
    sourceModule: 'src/components/conversation/widget-renderer/default-registry.ts',
    route: './components/conversation/widget-renderer/default-registry.js',
    target: './dist/components/conversation/widget-renderer/default-registry.js',
    values: ['DEFAULT_WIDGET_TYPE_REGISTRY'],
    types: [],
  },
];

function exportedName(node) {
  if (node?.type === 'Identifier') return node.name;
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  throw new TypeError(`unsupported exported name node ${node?.type ?? '(missing)'}`);
}

function sourceSpecifier(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  throw new TypeError(`unsupported export source node ${node?.type ?? '(missing)'}`);
}

function collectBindingNames(pattern, names) {
  if (!pattern) return;
  if (pattern.type === 'Identifier') {
    names.add(pattern.name);
    return;
  }
  if (pattern.type === 'AssignmentPattern') {
    collectBindingNames(pattern.left, names);
    return;
  }
  if (pattern.type === 'RestElement') {
    collectBindingNames(pattern.argument, names);
    return;
  }
  if (pattern.type === 'ArrayPattern') {
    for (const element of pattern.elements) collectBindingNames(element, names);
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      collectBindingNames(
        property.type === 'RestElement' ? property.argument : property.value,
        names
      );
    }
    return;
  }
  throw new TypeError(`unsupported exported binding pattern ${pattern.type}`);
}

const TYPE_ONLY_DECLARATIONS = new Set([
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
]);

function collectDeclarationExports(declaration, statementKind, values, types) {
  const names = new Set();
  if (declaration.type === 'VariableDeclaration') {
    for (const declarator of declaration.declarations) {
      collectBindingNames(declarator.id, names);
    }
  } else if (declaration.id) {
    names.add(exportedName(declaration.id));
  }
  const target =
    statementKind === 'type' || TYPE_ONLY_DECLARATIONS.has(declaration.type)
      ? types
      : values;
  for (const name of names) target.add(name);
}

function parseSourceExportContract(source, filename = 'source-export-contract.ts') {
  const result = parseSync(filename, source);
  if (result.errors.length > 0) {
    throw new SyntaxError(
      result.errors.map((error) => error.message ?? String(error)).join('\n')
    );
  }

  const values = new Set();
  const types = new Set();
  const reexports = new Set();
  const defaults = new Set();
  for (const statement of result.program.body) {
    if (statement.type === 'ExportNamedDeclaration') {
      if (statement.declaration) {
        collectDeclarationExports(
          statement.declaration,
          statement.exportKind,
          values,
          types
        );
      }
      for (const specifier of statement.specifiers) {
        const kind =
          statement.exportKind === 'type' || specifier.exportKind === 'type'
            ? 'type'
            : 'value';
        const name = exportedName(specifier.exported);
        (kind === 'type' ? types : values).add(name);
        if (statement.source) {
          reexports.add(`${kind}:${name} from ${sourceSpecifier(statement.source)}`);
        }
      }
      continue;
    }
    if (statement.type === 'ExportAllDeclaration') {
      const kind = statement.exportKind === 'type' ? 'type' : 'value';
      const name = statement.exported ? exportedName(statement.exported) : '*';
      if (statement.exported) (kind === 'type' ? types : values).add(name);
      reexports.add(`${kind}:${name} from ${sourceSpecifier(statement.source)}`);
      continue;
    }
    if (statement.type === 'ExportDefaultDeclaration') {
      const kind =
        statement.exportKind === 'type' ||
        TYPE_ONLY_DECLARATIONS.has(statement.declaration?.type)
          ? 'type'
          : 'value';
      (kind === 'type' ? types : values).add('default');
      defaults.add(kind);
    }
  }
  return {
    values: [...values].sort(),
    types: [...types].sort(),
    reexports: [...reexports].sort(),
    defaults: [...defaults].sort(),
  };
}

function sourceExportContract(sourceModule) {
  return parseSourceExportContract(
    readFileSync(join(packageDir, sourceModule), 'utf8'),
    sourceModule
  );
}

assert.deepEqual(
  parseSourceExportContract(`
    const local = 1;
    type LocalType = string;
    export const first = 1, second = 2; export function sameLine() {}
    export function overloaded(value: string): string;
    export function overloaded(value: number): number;
    export function overloaded(value: unknown) { return String(value); }
    export type Named = string;
    export { local as alias, type LocalType as AliasType };
    export type { Remote as RemoteType } from './remote.js';
    export * from './star.js'; export * as namespace from './namespace.js';
    export default first;
  `),
  {
    values: [
      'alias',
      'default',
      'first',
      'namespace',
      'overloaded',
      'sameLine',
      'second',
    ],
    types: ['AliasType', 'Named', 'RemoteType'],
    reexports: [
      'type:RemoteType from ./remote.js',
      'value:* from ./star.js',
      'value:namespace from ./namespace.js',
    ],
    defaults: ['value'],
  },
  'AST export discovery must cover multi-declarators, same-line exports, overloads, re-exports, and default exports exactly'
);

assert.deepEqual(
  approvedPureHelperContracts
    .map(({ sourceModule }) => sourceModule)
    .filter((sourceModule) => !CURATED_COMPONENT_HELPER_MODULES.includes(sourceModule)),
  [],
  'all five approved pure helper modules must have explicit curated package routes'
);
for (const contract of approvedPureHelperContracts) {
  assert.deepEqual(
    sourceExportContract(contract.sourceModule),
    {
      values: [...contract.values].sort(),
      types: [...contract.types].sort(),
      reexports: [],
      defaults: [],
    },
    `${contract.sourceModule} must expose only its approved value/type symbol contract`
  );
}

function collectRuntimeModules(directory, modules = new Map()) {
  for (const entry of readdirSync(directory)) {
    const file = join(directory, entry);
    if (statSync(file).isDirectory()) {
      collectRuntimeModules(file, modules);
    } else if (
      entry.endsWith('.ts') &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.stories.ts') &&
      !entry.endsWith('.d.ts')
    ) {
      modules.set(file, readFileSync(file, 'utf8'));
    }
  }
  return modules;
}

assert.deepEqual(
  findTransitiveRegistrationPaths(
    approvedPureHelperContracts.map(({ sourceModule }) =>
      join(packageDir, sourceModule)
    ),
    collectRuntimeModules(join(packageDir, 'src'))
  ),
  [],
  'the five helper entry graphs must remain registration-free at runtime'
);
assert(
  CURATED_COMPONENT_HELPER_MODULES.includes(
    'src/components/conversation/widget-renderer/resolve.ts'
  ),
  'the documented widget resolver expert route must remain curated'
);
assert(
  CURATED_COMPONENT_HELPER_MODULES.includes(
    'src/components/conversation/widget-renderer/registry.ts'
  ),
  'the documented widget registry helper route must remain curated'
);
for (const loader of [
  'src/components/charts/chart/chart-core-loader.ts',
  'src/components/charts/chart/chart-feature-loader.ts',
  'src/components/conversation/code-block/code-loader.ts',
  'src/components/conversation/markdown/markdown-loader.ts',
  'src/components/media/map/map-loader.ts',
  'src/components/retrieval/graph/graph-loader.ts',
]) {
  assert(
    CURATED_COMPONENT_HELPER_MODULES.includes(loader),
    `${loader} is a packed-consumer public route`
  );
}
assert(
  !CURATED_COMPONENT_HELPER_MODULES.includes('src/internal/widget-resolver.ts'),
  'widget resolver implementation details must not acquire a package route'
);
assert(
  CURATED_UTILITY_MODULES.includes('src/utilities/css-length.ts'),
  'the documented public css-length helper must retain its granular package route'
);

// Defect 1: llms/viewers.md:823 documents PptxViewerAdapter et al. as exported from the granular
// PPTX loader module -- the route must exist, or the documented import does not resolve.
assert(
  CURATED_COMPONENT_HELPER_MODULES.includes(
    'src/components/viewers/pptx-viewer/pptx-loader.ts'
  ),
  'the documented granular PPTX loader route must exist (llms/viewers.md:823)'
);

// Defect 2: every module matching the public-helper naming convention must be classified as
// either curated public or acknowledged internal, never left unclassified.
assert.equal(
  new Set([...CURATED_COMPONENT_HELPER_MODULES].filter((module) =>
    ACKNOWLEDGED_INTERNAL_HELPER_MODULES.includes(module)
  )).size,
  0,
  'no module may be both curated public and acknowledged internal'
);
assert.deepEqual(
  findUnclassifiedHelperModules(),
  [],
  'every real *-loader.ts / *-peer.ts / *-register.ts / registry.ts module must already be classified'
);

// findUnclassifiedHelperModules: positive and negative cases against an isolated fixture tree, so
// the derivation itself (not just the current production classification) is under test.
{
  const helperFixtureRoot = mkdtempSync(join(tmpdir(), 'lyra-helper-modules-'));
  const writeHelperFixture = (relativePath, contents = 'export {};\n') => {
    const target = join(helperFixtureRoot, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  };
  try {
    // Negative: a classified public loader and a classified internal loader are both recognized
    // and excluded, regardless of which list holds them.
    writeHelperFixture('src/components/forms/alpha/alpha-loader.ts');
    writeHelperFixture('src/components/forms/alpha/alpha-peer.ts');
    // Positive: a new file matching the convention, in neither list, is reported.
    writeHelperFixture('src/components/forms/beta/beta-register.ts');
    writeHelperFixture('src/components/forms/beta/registry.ts');
    // Non-matching neighbors (no "-loader"/"-peer"/"-register" suffix, not named "registry.ts")
    // must never be reported -- the convention is deliberately narrow.
    writeHelperFixture('src/components/forms/alpha/alpha-preload.ts');
    writeHelperFixture('src/components/forms/alpha/alpha.class.ts');
    // A QUALIFIED variant of a convention suffix (`-peer-bulk`, `-loader-lean`, ...) is a helper
    // module just as much as the bare suffix is, and needs classifying just as much. Narrowing
    // the convention to the bare suffix is what let `flag-peer-bulk.ts` ship in 11.2.0 with no
    // package export and no warning -- the one failure mode this whole derivation exists to stop.
    writeHelperFixture('src/components/forms/beta/beta-peer-bulk.ts');
    // Test/declaration files matching the stem must be ignored even though they end in `.ts`.
    writeHelperFixture('src/components/forms/alpha/alpha-loader.test.ts');

    assert.deepEqual(
      findUnclassifiedHelperModules(helperFixtureRoot, {
        curatedModules: ['src/components/forms/alpha/alpha-loader.ts'],
        internalModules: ['src/components/forms/alpha/alpha-peer.ts'],
        skipExistenceCheck: true,
      }),
      [
        'src/components/forms/beta/beta-peer-bulk.ts',
        'src/components/forms/beta/beta-register.ts',
        'src/components/forms/beta/registry.ts',
      ]
    );

    // A module claimed by both lists is a contradiction, not a silent pass.
    assert.throws(
      () =>
        findUnclassifiedHelperModules(helperFixtureRoot, {
          curatedModules: ['src/components/forms/alpha/alpha-loader.ts'],
          internalModules: ['src/components/forms/alpha/alpha-loader.ts'],
          skipExistenceCheck: true,
        }),
      /is listed as both a curated public helper and acknowledged internal/
    );

    // A stale acknowledged-internal entry (renamed/removed file) fails just as loudly as a new
    // unclassified file would, instead of silently no-op'ing forever.
    assert.throws(
      () =>
        findUnclassifiedHelperModules(helperFixtureRoot, {
          curatedModules: [],
          internalModules: ['src/components/forms/alpha/does-not-exist-loader.ts'],
        }),
      /acknowledged-internal helper module is missing/
    );
  } finally {
    rmSync(helperFixtureRoot, { recursive: true, force: true });
  }
}

const derived = deriveExplicitComponentExports(inventory, { helperModules });
assert.deepEqual(Object.keys(derived), [...Object.keys(derived)].sort());
assert.equal(
  derived['./components/forms/alpha/alpha.class.js'],
  './dist/components/forms/alpha/alpha.class.js'
);
assert.equal(
  derived['./components/forms/alpha/alpha.js'],
  './dist/components/forms/alpha/alpha.js'
);
assert.equal(
  derived['./components/lr-alpha.js'],
  './dist/components/lr-alpha.js'
);
assert.equal(derived['./components/forms'], './dist/components/forms/index.js');
assert.equal(
  derived['./components/charts/beta/public-helper.js'],
  './dist/components/charts/beta/public-helper.js'
);
assert.equal(derived['./components/forms/alpha/alpha.styles.js'], undefined);

const approvedPureHelperExports = deriveExplicitComponentExports(
  { schemaVersion: 1, components: [] },
  { helperModules: approvedPureHelperContracts.map(({ sourceModule }) => sourceModule) }
);
assert.deepEqual(
  approvedPureHelperExports,
  Object.fromEntries(
    approvedPureHelperContracts
      .map(({ route, target }) => [route, target])
      .sort(([left], [right]) => left.localeCompare(right))
  ),
  'the approved helper inventory must derive exactly five normal source-to-dist routes'
);
assert.equal(
  Object.keys(approvedPureHelperExports).some((key) => key.includes('*')),
  false,
  'pure helpers must not reopen a wildcard package route'
);
assert.equal(
  Object.keys(approvedPureHelperExports).some((key) => key.startsWith('./dist/')),
  false,
  'dist targets must never become literal public package keys'
);
assert.equal(
  Object.keys(approvedPureHelperExports).some((key) =>
    key.includes('test-result-detail-slot-name')
  ),
  false,
  'testResultDetailSlotName must not gain a dedicated helper route'
);

const closed = closeWildcardPackageExports(
  {
    '.': { types: './dist/lyra.d.ts', default: './dist/lyra.js' },
    './components/*': './dist/components/*',
    './components/forms': './dist/components/forms/index.js',
    './localization.js': './dist/localization.js',
    './ai': './dist/ai/index.js',
    './ai/*': './dist/ai/*',
    './utilities': './dist/utilities/index.js',
    './utilities/*': './dist/utilities/*',
    './dist/private.js': './dist/private.js',
  },
  derived,
  deriveExplicitUtilityExports({
    utilityModules: ['src/utilities/index.ts', 'src/utilities/defined.ts'],
  })
);
assert.equal(closed['./components/*'], undefined);
assert.equal(closed['./ai/*'], undefined);
assert.equal(closed['./ai'], './dist/ai/index.js');
assert.equal(
  closed['./dist/private.js'],
  undefined,
  'literal dist paths are targets only and must never survive as public export keys'
);
// `./utilities/*` stays present with a `null` target: a documented, closed door (see
// deriveExplicitUtilityExports) rather than a fully removed key.
assert.equal(closed['./utilities/*'], null);
assert.equal(closed['./utilities'], './dist/utilities/index.js');
assert.equal(closed['./utilities/defined.js'], './dist/utilities/defined.js');
assert.equal(closed['./localization.js'], './dist/localization.js');
assert.equal(closed['./components/lr-beta.js'], './dist/components/lr-beta.js');
assert.deepEqual(
  closed['.'],
  { types: './dist/lyra.d.ts', default: './dist/lyra.js' },
  'closing and curating granular routes must not broaden the root entry'
);

assert.throws(
  () =>
    deriveExplicitComponentExports(
      { ...inventory, schemaVersion: 2 },
      { helperModules }
    ),
  /schemaVersion must be 1/
);
assert.throws(
  () =>
    deriveExplicitComponentExports(
      {
        ...inventory,
        components: [...inventory.components, inventory.components[0]],
      },
      { helperModules }
    ),
  /duplicate tag lr-alpha/
);

const fixtureRoot = mkdtempSync(join(tmpdir(), 'lyra-package-exports-'));
const write = (relativePath, contents = 'export {};\n') => {
  const target = join(fixtureRoot, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
};

try {
  write(
    'scripts/fixtures/component-inventory.json',
    `${JSON.stringify(inventory, null, 2)}\n`
  );
  for (const component of inventory.components) {
    write(component.classModule);
    write(component.registrationModule);
    write(`src/components/${component.tag}.ts`);
    write(`src/components/${component.family}/index.ts`);
  }
  for (const helper of helperModules) write(helper);
  write(
    'package.json',
    `${JSON.stringify(
      {
        name: 'package-export-fixture',
        exports: {
          '.': './dist/lyra.js',
          './components/*': './dist/components/*',
          './ai': './dist/ai/index.js',
          './ai/*': './dist/ai/*',
          './utilities': './dist/utilities/index.js',
          './utilities/*': './dist/utilities/*',
          './dist/private.js': './dist/private.js',
        },
      },
      null,
      2
    )}\n`
  );

  // The filesystem-backed entry uses the production curated helper list. Supply matching fixture
  // helper modules temporarily by deriving the expectation directly, then exercise generation via
  // a fixture copy of the production list's paths.
  const productionModule = await import('./generate-package-exports.mjs');
  for (const helper of productionModule.CURATED_COMPONENT_HELPER_MODULES)
    write(helper);
  // findUnclassifiedHelperModules (invoked by checkPackageExports) walks src/components looking
  // for the naming convention regardless of which list a module belongs to, so the acknowledged
  // internal ones need matching fixture files too, or the walk (and its existence check) sees a
  // components/ tree that only partially mirrors the two production lists.
  for (const helper of productionModule.ACKNOWLEDGED_INTERNAL_HELPER_MODULES)
    write(helper);
  for (const utility of CURATED_UTILITY_MODULES) write(utility);

  assert.deepEqual(checkPackageExports(fixtureRoot).findings, [
    'package.json still exposes ./components/*',
    'package.json still exposes ./ai/*',
    'package.json still exposes ./utilities/*',
    'package.json exposes forbidden literal dist key ./dist/private.js',
    'package.json#exports is stale',
  ]);
  const routes = generatePackageExports(fixtureRoot);
  assert.ok(routes.componentRoutes.includes('./components/lr-alpha.js'));
  assert.ok(routes.utilityRoutes.includes('./utilities/localization.js'));
  assert.deepEqual(checkPackageExports(fixtureRoot).findings, []);

  const first = readFileSync(join(fixtureRoot, 'package.json'), 'utf8');
  generatePackageExports(fixtureRoot);
  assert.equal(
    readFileSync(join(fixtureRoot, 'package.json'), 'utf8'),
    first,
    'generation must be idempotent'
  );

  const pkg = JSON.parse(first);
  assert.equal(pkg.exports['./components/*'], undefined);
  assert.equal(pkg.exports['./ai/*'], undefined);
  assert.equal(pkg.exports['./dist/private.js'], undefined);
  // Present-but-closed, not removed: a documented door, matching src/package-entrypoints.test.ts's
  // "does not publish src/internal as a deep-import subpath" assertion.
  assert.equal(pkg.exports['./utilities/*'], null);
  assert.equal(
    pkg.exports['./utilities/catalog.js'],
    './dist/utilities/catalog.js'
  );
  assert.equal(
    pkg.exports['./utilities/localization.js'],
    './dist/utilities/localization.js'
  );
  assert.equal(pkg.exports['./ai'], './dist/ai/index.js');
  assert.equal(
    pkg.exports['./components/forms/alpha/alpha.class.js'],
    './dist/components/forms/alpha/alpha.class.js'
  );
  assert.equal(
    pkg.exports['./components/conversation/widget-renderer/resolve.js'],
    './dist/components/conversation/widget-renderer/resolve.js',
    'the supported widget resolver expertise must retain an exact granular route'
  );
  assert.equal(
    pkg.exports['./components/conversation/widget-renderer/registry.js'],
    './dist/components/conversation/widget-renderer/registry.js',
    'the immutable widget registry helper must retain an exact granular route'
  );
  for (const { route, target } of approvedPureHelperContracts) {
    assert.equal(pkg.exports[route], target, `${route} must be generated as an exact normal route`);
  }
  assert.equal(
    Object.keys(pkg.exports).some((key) => key.startsWith('./dist/')),
    false,
    'generated package keys must never expose a literal dist subpath'
  );
  assert.equal(
    Object.keys(pkg.exports).some((key) => key.includes('test-result-detail-slot-name')),
    false,
    'generation must not invent a dedicated testResultDetailSlotName helper route'
  );
  assert.equal(pkg.exports['./internal/widget-resolver.js'], undefined);
  assert.equal(
    pkg.exports['./components/charts/beta/public-helper.js'],
    undefined,
    'only the production curated helper list is packaged'
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('explicit package export generation and determinism tests passed.');
