import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bundleBudgetSlackFinding,
  createBundleBudgetReview,
  maximumReviewedBudgetBytes,
  validateBundleBudgetPolicy,
} from './bundle-budget-policy.mjs';
import { positiveInitialMarginalGzipBytes } from './bundle-metrics.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.join(scriptsDir, '..');
const requireFromPackage = createRequire(path.join(packageDir, 'package.json'));
const requireFromLoaderHost = createRequire(
  requireFromPackage.resolve('@web/dev-server-esbuild'),
);
const esbuild = requireFromLoaderHost('esbuild');
const budgets = JSON.parse(
  readFileSync(path.join(scriptsDir, 'bundle-budgets.json'), 'utf8'),
);
const exclusions = JSON.parse(
  readFileSync(path.join(scriptsDir, 'bundle-exclusion-claims.json'), 'utf8'),
);
const initialBudgets = JSON.parse(
  readFileSync(path.join(scriptsDir, 'bundle-initial-budgets.json'), 'utf8'),
);
const checker = readFileSync(
  path.join(scriptsDir, 'check-bundle-size.mjs'),
  'utf8',
);
const policyFixture = {
  $maximumHeadroomPercent: 4,
  $reviewedGzipBytes: {
    $componentP95GzipKb: 1_000,
    $componentMaxGzipKb: 2_000,
    'dist/example.js': 3_000,
  },
  $componentP95GzipKb: maximumReviewedBudgetBytes(1_000) / 1024,
  $componentMaxGzipKb: maximumReviewedBudgetBytes(2_000) / 1024,
  'dist/example.js': maximumReviewedBudgetBytes(3_000) / 1024,
};

assert.doesNotThrow(() => validateBundleBudgetPolicy(policyFixture));
assert.deepEqual(createBundleBudgetReview({ 'dist/example.js': 3_000 }), {
  $maximumHeadroomPercent: 4,
  $reviewedGzipBytes: { 'dist/example.js': 3_000 },
  $maximumAllowedGzipKb: {
    'dist/example.js': maximumReviewedBudgetBytes(3_000) / 1024,
  },
});
assert.throws(
  () => validateBundleBudgetPolicy({ ...policyFixture, $maximumHeadroomPercent: 4.1 }),
  /must remain exactly 4%/u,
);
assert.throws(
  () => validateBundleBudgetPolicy({
    ...policyFixture,
    'dist/example.js': (maximumReviewedBudgetBytes(3_000) + 1) / 1024,
  }),
  /exceeds the reviewed 4% headroom policy/u,
);
assert.throws(
  () => validateBundleBudgetPolicy({
    ...policyFixture,
    'dist/example.js': 2_999 / 1024,
  }),
  /is below its reviewed measurement/u,
);
assert.throws(
  () => validateBundleBudgetPolicy({
    ...policyFixture,
    $reviewedGzipBytes: {
      ...policyFixture.$reviewedGzipBytes,
      'dist/stale.js': 1_000,
    },
  }),
  /reviewed measurement has no matching hard ceiling/u,
);
assert.equal(
  bundleBudgetSlackFinding(
    'dist/example.js',
    3_000,
    maximumReviewedBudgetBytes(3_000) / 1024,
  ),
  null,
);
assert.match(
  bundleBudgetSlackFinding(
    'dist/example.js',
    3_000,
    (maximumReviewedBudgetBytes(3_000) + 1) / 1024,
  ),
  /exceeds 4% above the live gzip measurement/u,
);
assert.doesNotThrow(
  () => validateBundleBudgetPolicy(budgets),
  'the checked-in budget schema must pin every hard ceiling to an exact reviewed measurement',
);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return entry.isFile() && file.endsWith('.ts') ? [file] : [];
  });
}

function runtimePositionerImports(source) {
  const imports = [
    ...source.matchAll(
      /(?:^|\n)import\s+([^;]+?)\s+from\s+['"][^'"]*\/internal\/positioner\.js['"]/gu,
    ),
  ];
  return imports.filter(([, clause]) => {
    const bindings = clause.trim();
    if (bindings.startsWith('type ')) return false;
    if (!bindings.startsWith('{')) return true;
    return bindings
      .slice(1, -1)
      .split(',')
      .some((binding) => !binding.trim().startsWith('type '));
  });
}

const deferredPositionerConsumers = {
  'dist/components/agent-tools/tool-call-chip/tool-call-chip.js':
    'src/components/agent-tools/tool-call-chip/tool-call-chip.class.ts',
  'dist/components/conversation/usage-badge/usage-badge.js':
    'src/components/conversation/usage-badge/usage-badge.class.ts',
  'dist/components/forms/color-picker/color-picker.js':
    'src/components/forms/color-picker/color-picker.class.ts',
  'dist/components/forms/date-picker/date-input.js':
    'src/components/forms/date-picker/date-input.class.ts',
  'dist/components/forms/input/time-input.js':
    'src/components/forms/input/time-input.class.ts',
  'dist/components/forms/locale-picker/locale-picker.js':
    'src/components/forms/locale-picker/locale-picker.class.ts',
  'dist/components/forms/select/select.js':
    'src/components/forms/select/select.class.ts',
  'dist/components/layout/app-rail/app-rail-item.js':
    'src/components/layout/app-rail/app-rail-item.class.ts',
  'dist/components/layout/menu/menu.js':
    'src/components/layout/menu/menu.class.ts',
  'dist/components/overlays/overlay/tooltip.js':
    'src/components/overlays/overlay/tooltip.class.ts',
  'dist/components/overlays/popup/popup.js':
    'src/components/overlays/popup/popup.class.ts',
  'dist/components/retrieval/citation-badge/citation-badge.js':
    'src/components/retrieval/citation-badge/citation-badge.class.ts',
  'dist/components/retrieval/entity-chip/entity-chip.js':
    'src/components/retrieval/entity-chip/entity-chip.class.ts',
  'dist/components/utility/export-button/export-button.js':
    'src/components/utility/export-button/export-button.class.ts',
  'dist/components/utility/mention-popover/mention-popover.js':
    'src/components/utility/mention-popover/mention-popover.class.ts',
  'dist/components/utility/tour/tour.js':
    'src/components/utility/tour/tour.class.ts',
};

const deferredCatalogPickerConsumers = {
  'dist/components/conversation/model-select/model-select.js':
    'src/components/conversation/model-select/model-select.class.ts',
  'dist/components/conversation/voice-picker/voice-picker.js':
    'src/components/conversation/voice-picker/voice-picker.class.ts',
};

assert.equal(typeof budgets.$comment, 'string');
assert.equal(typeof initialBudgets.$comment, 'string');
assert.deepEqual(initialBudgets.$baseline, [
  'dist/components/data/stat/stat.js',
  'dist/components/overlays/callout/callout.js',
  'dist/components/layout/card/card.js',
  'dist/components/overlays/skeleton/skeleton.js',
  'dist/components/utility/icon/icon.js',
]);
assert.deepEqual(
  Object.keys(initialBudgets.$marginalGzipKb).sort(),
  [
    'dist/components/forms/combobox/combobox.js',
    'dist/components/overlays/overlay/popover.js',
    ...Object.keys(deferredPositionerConsumers),
    ...Object.keys(deferredCatalogPickerConsumers),
  ].sort(),
  'every anchored component route needs a splitting-aware initial budget',
);
for (const [entry, sourcePath] of Object.entries(deferredPositionerConsumers)) {
  assert.ok(
    Number.isSafeInteger(initialBudgets.$marginalGzipKb[entry]) &&
      initialBudgets.$marginalGzipKb[entry] > 0,
    `${entry} needs a positive reviewed initial-route ceiling`,
  );
  const source = readFileSync(path.join(scriptsDir, '..', sourcePath), 'utf8');
  assert.match(
    source,
    /from\s+['"][^'"]*\/internal\/anchored-overlay-runtime\.js['"]/u,
    `${sourcePath} must keep its positioning behavior through the deferred runtime`,
  );
  assert.equal(
    runtimePositionerImports(source).length,
    0,
    `${sourcePath} must defer the Floating UI-backed positioning runtime`,
  );
}
for (const [entry, sourcePath] of Object.entries(deferredCatalogPickerConsumers)) {
  assert.ok(
    Number.isSafeInteger(initialBudgets.$marginalGzipKb[entry]) &&
      initialBudgets.$marginalGzipKb[entry] > 0,
    `${entry} needs a positive reviewed initial-route ceiling`,
  );
  const source = readFileSync(path.join(scriptsDir, '..', sourcePath), 'utf8');
  assert.match(
    source,
    /from\s+['"][^'"]*\/internal\/catalog-picker\.js['"]/u,
    `${sourcePath} must keep its popup positioning on the shared catalog-picker controller`,
  );
}
const catalogPickerSource = readFileSync(
  path.join(scriptsDir, '..', 'src', 'internal', 'catalog-picker.ts'),
  'utf8',
);
const anchoredPopoverControllerSource = readFileSync(
  path.join(scriptsDir, '..', 'src', 'internal', 'anchored-popover-controller.ts'),
  'utf8',
);
assert.match(
  catalogPickerSource,
  /from\s+['"]\.\/anchored-popover-controller\.js['"]/u,
  'catalog-picker must retain the shared anchored-popover controller',
);
assert.match(
  catalogPickerSource,
  /from\s+['"]\.\/nonmodal-overlay-manager\.js['"]/u,
  'catalog-picker must use the lean nonmodal overlay lifecycle',
);
assert.doesNotMatch(
  catalogPickerSource,
  /from\s+['"]\.\/overlay-manager\.js['"]/u,
  'catalog-picker must not load modal inerting or scroll-lock machinery eagerly',
);
assert.match(
  anchoredPopoverControllerSource,
  /from\s+['"]\.\/anchored-overlay-runtime\.js['"]/u,
  'catalog-picker routes must retain deferred positioning through their anchored controller',
);
assert.doesNotMatch(
  anchoredPopoverControllerSource,
  /from\s+['"]\.\/positioner\.js['"]/u,
  'catalog-picker routes must not make the Floating UI-backed positioner eager again',
);
const componentsDir = path.join(scriptsDir, '..', 'src', 'components');
const eagerPositionerConsumers = sourceFiles(componentsDir)
  .filter((file) => runtimePositionerImports(readFileSync(file, 'utf8')).length > 0)
  .map((file) => path.relative(path.join(scriptsDir, '..'), file).replaceAll('\\', '/'));
assert.deepEqual(
  eagerPositionerConsumers,
  [],
  'no component may add a static runtime import of the Floating UI-backed positioner',
);
assert.equal(positiveInitialMarginalGzipBytes(2048, 1024, 'fixture'), 1024);
assert.throws(
  () => positiveInitialMarginalGzipBytes(1024, 1024, 'fixture'),
  /fixture: initial-route gzip must exceed its baseline/,
);
assert.throws(
  () => positiveInitialMarginalGzipBytes(1023, 1024, 'fixture'),
  /measured 1023 - 1024 = -1 bytes/,
);
const reviewedCeilingKeys = Object.keys(budgets)
  .filter((key) => key.startsWith('dist/') || key === '$componentP95GzipKb' || key === '$componentMaxGzipKb')
  .sort();
// 30 KiB held until the base class gained its cross-document render-root fallback, which every
// bundle shares; the canary moves one whole KiB and stays the tightest standalone ceiling.
assert.ok(
  budgets['dist/components/forms/button/button.js'] <= 31,
  'the standalone button registration must remain at or below 31 KiB gzip',
);
assert.deepEqual(reviewedCeilingKeys, [
  '$componentMaxGzipKb',
  '$componentP95GzipKb',
  'dist/all.js',
  'dist/autoloader-cdn.js',
  'dist/autoloader.js',
  'dist/components/agent-tools/index.js',
  'dist/components/charts/index.js',
  'dist/components/conversation/index.js',
  'dist/components/data/flow-canvas/flow-canvas.js',
  'dist/components/data/gauge/gauge.js',
  'dist/components/data/index.js',
  'dist/components/forms/button/button.js',
  'dist/components/forms/combobox/combobox.js',
  'dist/components/forms/index.js',
  'dist/components/forms/select/select.js',
  'dist/components/layout/index.js',
  'dist/components/media/index.js',
  'dist/components/overlays/index.js',
  'dist/components/overlays/overlay/popover.js',
  'dist/components/retrieval/index.js',
  'dist/components/utility/index.js',
  'dist/components/viewers/index.js',
  'dist/components/viewers/pdf-viewer/pdf-viewer.js',
  'dist/hydration.js',
  'dist/localization.js',
  'dist/lyra.js',
  'dist/ssr-loader.js',
  'dist/ssr.js',
  'dist/ssr/all.js',
]);
assert.ok(
  budgets['dist/autoloader.js'] >= budgets['dist/all.js'],
  'the autoloader bundles the complete compatibility registration graph',
);
assert.ok(
  budgets['dist/autoloader-cdn.js'] >= budgets['dist/autoloader.js'],
  'the CDN startup wrapper includes the complete manual-autoloader graph',
);
assert.ok(
  budgets['dist/ssr-loader.js'] >=
    budgets['dist/all.js'] + budgets['dist/hydration.js'] - 2,
  'the compatibility SSR loader budget accounts for all registrations plus hydration support, allowing two KiB of independent ceiling rounding',
);
assert.ok(
  budgets['dist/ssr/all.js'] >= budgets['dist/all.js'],
  'the complete SSR inventory is a superset of the browser compatibility inventory',
);
for (const entry of [
  'dist/hydration.js',
  'dist/ssr.js',
  'dist/ssr/all.js',
  'dist/ssr-loader.js',
  'dist/autoloader.js',
  'dist/autoloader-cdn.js',
  ...[
    'agent-tools',
    'charts',
    'conversation',
    'data',
    'forms',
    'layout',
    'media',
    'overlays',
    'retrieval',
    'utility',
    'viewers',
  ].map((family) => `dist/components/${family}/index.js`),
]) {
  assert.ok(
    Number.isFinite(budgets[entry]),
    `${entry} needs a hard gzip budget`,
  );
}
assert.doesNotMatch(
  checker,
  /--write-budgets/,
  'the release checker must not offer a rebaseline switch',
);
assert.match(
  checker,
  /validateBundleBudgetPolicy\(budgets\)/u,
  'the live bundle gate must fail closed on stale or over-slack reviewed ceilings',
);
assert.match(
  checker,
  /bundleBudgetSlackFinding\(/u,
  'a source-size reduction must not leave a formerly tight ceiling silently over-slack',
);
assert.match(
  checker,
  /--print-budget-review/u,
  'the exact read-only review proposal must be available for deliberate remeasurement',
);
assert.match(
  checker,
  /Unknown argument/,
  'unknown bundle-checker arguments must fail closed',
);
assert.match(
  checker,
  /bundle-exclusion-claims\.json/,
  'documented lean-entry exclusions need a peer-inclusive metafile gate',
);
assert.match(
  checker,
  /metafile:\s*true/,
  'bundle exclusion claims must inspect a real esbuild dependency graph',
);
assert.match(
  checker,
  /splitting:\s*true/,
  'initial-route budgets must measure a splitting-aware production graph',
);
assert.match(
  checker,
  /dynamic-import/,
  'initial-route traversal must exclude first-open dynamic chunks',
);
assert.match(
  checker,
  /bundle-initial-budgets\.json/,
  'initial marginal budgets must have a dedicated reviewed authority',
);
assert.match(
  checker,
  /measurement\.marginalGzipBytes\}\s+bytes/u,
  'sub-KiB initial-route failures must report their exact byte measurement',
);
assert.match(
  checker,
  /zlib patch releases can\s*\/\/ vary these live counts/,
  'live gzip ceilings must document why they are not exact cross-zlib evidence',
);
assert.match(
  checker,
  /recorded \* 0\.05/,
  'published aggregate gzip claims need a portability-tolerant drift band',
);
const widgetRendererLean =
  exclusions['dist/components/conversation/widget-renderer/widget-renderer.class.js'];
assert.ok(
  widgetRendererLean,
  'the documented lean widget-renderer route needs an inventoried graph claim',
);
assert.ok(
  !widgetRendererLean.forbiddenInputs.includes(
    'components/conversation/widget-renderer/default-registry.js',
  ),
  'default-registry.js is a pure data module the lean route always legitimately bundles, not an exclusion claim',
);
assert.equal(
  widgetRendererLean.forbiddenInputs.length,
  8,
  'the lean route excludes all eight mapped widget-type class modules',
);
const toolParamFormLean =
  exclusions['dist/components/agent-tools/tool-param-form/tool-param-form.js'];
assert.ok(
  toolParamFormLean,
  'the granular tool-param-form registration needs an inventoried checkbox exclusion claim',
);
assert.deepEqual(
  toolParamFormLean,
  {
    includedOptionalPeers: [],
    forbiddenInputs: ['components/forms/checkbox/'],
  },
  'the real bundle graph must reject every checkbox module from the granular registration route',
);
const localePickerNonmodalOverlay =
  exclusions['dist/components/forms/locale-picker/locale-picker.js'];
assert.deepEqual(
  localePickerNonmodalOverlay,
  {
    includedOptionalPeers: [],
    forbiddenInputs: [
      'internal/overlay-manager.js',
      'internal/rendered-state.js',
      'internal/scroll-lock.js',
    ],
  },
  'the granular locale-picker route must retain the lean nonmodal overlay graph',
);
const exportButtonNonmodalOverlay =
  exclusions['dist/components/utility/export-button/export-button.js'];
assert.deepEqual(
  exportButtonNonmodalOverlay,
  {
    includedOptionalPeers: [],
    forbiddenInputs: [
      'internal/overlay-manager.js',
      'internal/rendered-state.js',
      'internal/scroll-lock.js',
    ],
  },
  'the granular export-button route must retain the lean nonmodal overlay graph',
);

async function probeToolParamFormRegistrationGraph() {
  const registrationsKey = '__lyraTask3ToolParamFormRegistrations';
  const previous = Object.getOwnPropertyDescriptor(globalThis, registrationsKey);
  const registrations = [];
  Object.defineProperty(globalThis, registrationsKey, {
    configurable: true,
    value: registrations,
  });

  const registrationStubs = {
    name: 'registration-stubs',
    setup(build) {
      build.onResolve({ filter: /\/internal\/prefix\.js$/ }, () => ({
        namespace: 'registration-stubs',
        path: 'prefix',
      }));
      build.onResolve(
        { filter: /\/(?:tool-param-form|select|option)\.class\.js$/ },
        (args) => ({
          namespace: 'registration-stubs',
          path: path.basename(args.path),
        }),
      );
      build.onLoad(
        { filter: /.*/, namespace: 'registration-stubs' },
        (args) => {
          if (args.path === 'prefix') {
            return {
              contents:
                `export function defineElement(name, ctor) { ` +
                `globalThis[${JSON.stringify(registrationsKey)}].push([name, ctor.name]); }`,
              loader: 'js',
            };
          }
          const classNames = {
            'option.class.js': 'LyraOption',
            'select.class.js': 'LyraSelect',
            'tool-param-form.class.js': 'LyraToolParamForm',
          };
          const className = classNames[args.path];
          assert.ok(className, `unexpected registration class stub ${args.path}`);
          return {
            contents: `export class ${className} {}`,
            loader: 'js',
          };
        },
      );
    },
  };

  try {
    const result = await esbuild.build({
      absWorkingDir: packageDir,
      bundle: true,
      entryPoints: [
        'src/components/agent-tools/tool-param-form/tool-param-form.ts',
      ],
      format: 'esm',
      logLevel: 'silent',
      metafile: true,
      platform: 'node',
      plugins: [registrationStubs],
      write: false,
    });
    assert.equal(result.outputFiles.length, 1);
    await import(
      `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
    );
    return {
      inputs: Object.keys(result.metafile.inputs).map((input) =>
        input.replaceAll('\\', '/')
      ),
      registrations,
    };
  } finally {
    if (previous) Object.defineProperty(globalThis, registrationsKey, previous);
    else delete globalThis[registrationsKey];
  }
}

const toolParamRegistrationProbe = await probeToolParamFormRegistrationGraph();
assert.equal(
  toolParamRegistrationProbe.registrations.length,
  3,
  'each rendered control must register exactly once even when reached transitively',
);
assert.deepEqual(
  [...toolParamRegistrationProbe.registrations].sort(([left], [right]) =>
    left.localeCompare(right)
  ),
  [
    ['option', 'LyraOption'],
    ['select', 'LyraSelect'],
    ['tool-param-form', 'LyraToolParamForm'],
  ],
  'the executed granular module graph must register the form, select, and option controls',
);
for (const input of [
  'src/components/agent-tools/tool-param-form/tool-param-form.ts',
  'src/components/forms/combobox/option.ts',
  'src/components/forms/select/select.ts',
]) {
  assert.ok(
    toolParamRegistrationProbe.inputs.includes(input),
    `the actual registration graph must include ${input}`,
  );
}
assert.ok(
  toolParamRegistrationProbe.inputs.every(
    (input) => !input.includes('src/components/forms/checkbox/')
  ),
  'the actual registration metafile must exclude the checkbox family',
);

console.log('hard bundle budget coverage tests passed.');
