import { expect } from '@open-wc/testing';

import {
  ROOT_BARREL_OPTIONAL_PEER_TAGS,
  ROOT_BARREL_TAGS,
} from './internal/root-registration-allowlist.js';
// Type-only imports resolve against the source tree: the test-tree type-check runs in CI before
// any build exists, so a package self-reference here would fail on the missing `dist/` types. The
// packaged route types are proven separately by the ATTW and packed-consumer gates; the runtime
// assertions below still load every route through the real package exports.
import type {
  AgentStatusPresentation,
  AgentStatusValue,
} from './components/agent-tools/agent-status-presentation.js';
import type {
  ApprovalAction,
  ApprovalDecision,
} from './components/agent-tools/approval-state.js';
import type {
  StackFrame,
  StackGroup,
  StackTraceParseOptions,
  StackTraceParseResult,
} from './components/agent-tools/stack-trace/stack-trace-parse.js';
import type {
  LyraSpan,
  LyraSpanKind,
  LyraSpanProjection,
  LyraSpanStatus,
} from './components/agent-tools/trace-tree/span.js';

type RealmImport = (specifier: string) => Promise<Record<string, unknown>>;
type EntrypointImport = () => Promise<Record<string, unknown>>;
type PackageEntrypointImports = {
  importRoot: EntrypointImport;
  importAll: EntrypointImport;
  importLocalization: EntrypointImport;
  importPersianLocale: EntrypointImport;
  importHebrewLocale: EntrypointImport;
  importEmpty: EntrypointImport;
  importEmptyClass: EntrypointImport;
  importCsv: EntrypointImport;
  importUtilities: EntrypointImport;
  importPositioner: EntrypointImport;
  importAgentStatusPresentation: EntrypointImport;
  importApprovalState: EntrypointImport;
  importStackTraceParse: EntrypointImport;
  importTraceTreeSpan: EntrypointImport;
  importWidgetDefaultRegistry: EntrypointImport;
};

type CuratedHelperTypeContracts = readonly [
  AgentStatusPresentation,
  AgentStatusValue,
  ApprovalAction,
  ApprovalDecision,
  StackFrame,
  StackGroup,
  StackTraceParseOptions,
  StackTraceParseResult,
  LyraSpanKind,
  LyraSpanStatus,
  LyraSpan,
  LyraSpanProjection,
];

const curatedHelperTypeContracts: CuratedHelperTypeContracts | undefined = undefined;
void curatedHelperTypeContracts;

const definedAmong = (registry: CustomElementRegistry, tags: readonly string[]): string[] =>
  tags.filter((tag) => registry.get(tag) !== undefined);

async function createEntrypointRealm(): Promise<{
  frame: HTMLIFrameElement;
  registry: CustomElementRegistry;
  importModule: RealmImport;
}> {
  const frame = document.createElement('iframe');
  frame.hidden = true;
  // A freshly-appended iframe exposes an initial `about:blank` document immediately, but the
  // browser then REPLACES it when the real `about:blank` navigation completes, asynchronously.
  // Reading `contentWindow` synchronously and importing into that first document races the
  // replacement: when it lands, dynamic imports still in flight against the discarded realm reject
  // with `Failed to fetch dynamically imported module`. This test's first import is the whole root
  // barrel -- a 757-module graph over the unbundled dev server -- so it stays in flight for tens of
  // seconds, which is a wide window for that navigation to land in. Awaiting the load event closes
  // the race.
  //
  // Honest scope note: this was added while chasing a local `Failed to fetch dynamically imported
  // module` on `dist/lyra.js`, and it did NOT fix it -- the same failure reproduces with no iframe
  // at all, importing the root barrel straight from the main page, so the cause is elsewhere (see
  // the timeout comment below). Kept anyway because the race is real and cheap to close.
  const loaded = new Promise<void>((resolve) => {
    frame.addEventListener('load', () => resolve(), { once: true });
  });
  document.body.append(frame);
  await loaded;

  const realm = frame.contentWindow;
  if (!realm) {
    frame.remove();
    throw new Error('Could not create an isolated package-entrypoint realm.');
  }

  // Construct the importer inside the child Window so every imported module evaluates against
  // that Window's globalThis and CustomElementRegistry. The absolute fixture URL is independent of
  // about:blank's base URL; the fixture's bare package self-references exercise package exports.
  const importModule = realm.Function('specifier', 'return import(specifier);') as RealmImport;
  return { frame, registry: realm.customElements, importModule };
}

// Keep the three stages in one realm and in this order: each stage depends on the registry left by
// the previous one. The realm itself is fresh per attempt because custom-element definitions cannot
// be undone; otherwise Mocha's retry after a late all.js failure would start with lr-empty already
// registered and hide the original failure behind a misleading stage-one assertion.
it('registers nothing from the root, exactly one tag from a granular entry, and the set from all.js', async function () {
  // The root barrel alone is a 757-module graph fetched one module at a time over the unbundled
  // dev server, so this legitimately runs for a minute or more and scales with machine load; 120s
  // was tight enough to be a coin flip on a busy box. The budget is generous on purpose: a real
  // regression here surfaces as a fetch/registration ERROR, never as a slow pass.
  //
  // KNOWN ENVIRONMENT ISSUE, not a budget problem: on some machines the dev server cannot serve a
  // several-hundred-module graph at all, and this import rejects with `Failed to fetch dynamically
  // imported module` after ~25-70s -- well inside any timeout. Bisected: a granular entry
  // (`components/overlays/empty/empty.js`) loads fine while BOTH large graphs (`lyra.js`,
  // `all.js`) fail, with no iframe involved, at concurrency 1, with an FD limit of 524288. GitHub
  // CI runs this green, so it is environmental rather than a product or test defect. If you hit it
  // locally, trust CI and re-run there rather than editing this file.
  this.timeout(240_000);
  const { frame, registry, importModule } = await createEntrypointRealm();
  const packageTags = [...ROOT_BARREL_TAGS, ...ROOT_BARREL_OPTIONAL_PEER_TAGS];

  try {
    const entrypoints = (await importModule(
      new URL('../test/package-entrypoints-realm.js', import.meta.url).href,
    )) as unknown as PackageEntrypointImports;

    // 1. The root carries the named/type surface WITHOUT registering the library.
    const root = await entrypoints.importRoot();
    expect(typeof root['LyraEmpty']).to.equal('function');
    expect(definedAmong(registry, packageTags).join(',')).to.equal('');

    // Representative exact and wildcard subpaths resolve without registering a component.
    const localization = await entrypoints.importLocalization();
    const classEntry = await entrypoints.importEmptyClass();
    const helperEntry = await entrypoints.importCsv();
    const utilities = await entrypoints.importUtilities();
    const positioner = await entrypoints.importPositioner();
    const agentStatusPresentation = await entrypoints.importAgentStatusPresentation();
    const approvalState = await entrypoints.importApprovalState();
    const stackTraceParse = await entrypoints.importStackTraceParse();
    const traceTreeSpan = await entrypoints.importTraceTreeSpan();
    const widgetDefaultRegistry = await entrypoints.importWidgetDefaultRegistry();
    expect(typeof localization['registerLyraLocale']).to.equal('function');
    expect(typeof localization['setLyraLocale']).to.equal('function');
    expect(typeof localization['resolveLyraString']).to.equal('function');
    expect(typeof localization['getLyraLocale']).to.equal('function');
    const getLocaleDirection = localization['getLyraLocaleDirection'];
    expect(typeof getLocaleDirection).to.equal('function');
    if (typeof getLocaleDirection !== 'function') throw new Error('Missing getLyraLocaleDirection export');
    expect(getLocaleDirection('en')).to.equal('ltr');
    expect(typeof localization['getRegisteredLyraLocales']).to.equal('function');
    expect(typeof localization['subscribeLyraLocaleRegistry']).to.equal('function');
    expect(typeof localization['resolveLyraLocale']).to.equal('function');
    expect(typeof localization['resolveLyraDirection']).to.equal('function');
    expect(typeof localization['LYRA_DEFAULT_STRINGS']).to.equal('object');
    expect(typeof root['LyraElement']).to.equal('function');
    expect(typeof root['groupByRecency']).to.equal('function');
    expect(typeof classEntry['LyraEmpty']).to.equal('function');
    expect(typeof helperEntry['buildCsv']).to.equal('function');
    expect(typeof utilities['FormAssociated']).to.equal('function');
    expect(typeof utilities['groupByRecency']).to.equal('function');
    expect(typeof utilities['LyraElement']).to.equal('function');
    expect(typeof positioner['place']).to.equal('function');
    for (const name of [
      'agentStatusKind',
      'agentStatusLabel',
      'agentStatusMessage',
      'agentStatusVariant',
      'isAgentStatusTerminal',
      'isAgentStatusActive',
    ]) {
      expect(typeof agentStatusPresentation[name]).to.equal('function');
    }
    expect(typeof approvalState['approvalAction']).to.equal('function');
    expect(typeof approvalState['approvalDecision']).to.equal('function');
    expect(typeof stackTraceParse['parseStackTrace']).to.equal('function');
    expect(Array.isArray(stackTraceParse['DEFAULT_INTERNAL_PATTERNS'])).to.be.true;
    expect(typeof stackTraceParse['STACK_TRACE_LIMITS']).to.equal('object');
    expect(typeof traceTreeSpan['MAX_RENDERED_LYRA_SPANS']).to.equal('number');
    expect(typeof traceTreeSpan['normalizeLyraSpanKind']).to.equal('function');
    expect(typeof traceTreeSpan['normalizeLyraSpanStatus']).to.equal('function');
    expect(typeof traceTreeSpan['normalizeLyraSpans']).to.equal('function');
    expect(typeof widgetDefaultRegistry['DEFAULT_WIDGET_TYPE_REGISTRY']).to.equal('object');
    expect(definedAmong(registry, packageTags).join(',')).to.equal('');

    // 2. A granular registration entry registers EXACTLY its own tag -- and registers the very
    //    class the root re-exports, which a `typeof` check could not distinguish from a duplicate.
    await entrypoints.importEmpty();
    expect(registry.get('lr-empty') === root['LyraEmpty']).to.be.true;
    expect(definedAmong(registry, packageTags).join(',')).to.equal('lr-empty');

    // 3. `all.js` is the documented compatibility path for the pre-8 root side effect: the whole
    //    root-included set, and still nothing from an optional-peer family.
    await entrypoints.importAll();
    // Compare counts and names, never element constructors: a failed assertion carrying a DOM-ish
    // value as chai's `actual` hangs the whole file.
    expect(definedAmong(registry, ROOT_BARREL_TAGS).length).to.equal(ROOT_BARREL_TAGS.length);
    expect(definedAmong(registry, ROOT_BARREL_OPTIONAL_PEER_TAGS).join(',')).to.equal('');
  } finally {
    frame.remove();
  }
});

it('resolves Persian and Hebrew locale subpaths and executes their registration side effects', async () => {
  // Keep package self-references in the server-served fixture: WTR's node-resolve plugin validates
  // the exports map there, while the build-independent strict test-type gate never needs dist/.
  const entrypointFixturePath: string = new URL(
    '../test/package-entrypoints-realm.js',
    import.meta.url,
  ).href;
  const entrypoints = (await import(entrypointFixturePath)) as unknown as PackageEntrypointImports;
  const localization = await entrypoints.importLocalization();
  await entrypoints.importPersianLocale();
  await entrypoints.importHebrewLocale();
  const getRegisteredLyraLocales = localization['getRegisteredLyraLocales'];
  expect(typeof getRegisteredLyraLocales).to.equal('function');
  if (typeof getRegisteredLyraLocales !== 'function') {
    throw new Error('Missing getRegisteredLyraLocales export');
  }
  expect(getRegisteredLyraLocales()).to.include('fa');
  expect(getRegisteredLyraLocales()).to.include('he');

  const packageManifestPath = '/package.json';
  const manifest = (await import(packageManifestPath)) as unknown as { sideEffects: string[] };
  for (const entry of [
    './dist/translations/fa.js',
    './dist/translations/he.js',
    './src/translations/fa.ts',
    './src/translations/he.ts',
  ]) {
    expect(manifest.sideEffects, entry).to.include(entry);
  }
});

it('does not publish src/internal as a deep-import subpath', async () => {
  // `internal/` is deliberately outside the exports map: it is where the library is free to move
  // things, and the curated `utilities/*` re-exports above are the supported way to reach any of
  // it. The boundary is enforced by the EXPORTS MAP, so that is what this asserts.
  //
  // Deliberately not written as a failed `import()`: this runner serves source over its own dev
  // server rather than resolving through Node, so an unresolvable specifier throws whether or not
  // the exports map allows it -- a test that passes identically with `"./internal/*"` present,
  // i.e. one that proves nothing. Real resolution through a published tarball is covered by
  // `check:packed-consumer`.
  // Imported rather than fetched: this runner serves `.json` transformed into an ES module, so a
  // raw `fetch().json()` gets JavaScript source back and throws.
  const packageManifestPath = '/package.json';
  const manifest = (await import(packageManifestPath)) as unknown as { exports: Record<string, unknown> };
  const internalKeys = Object.keys(manifest.exports).filter((key) => key.startsWith('./internal'));
  expect(internalKeys.join(', ')).to.equal('');
  // ...and the curated replacements really are declared, so the boundary has a documented door.
  expect(Object.keys(manifest.exports)).to.include('./utilities/*');
});
