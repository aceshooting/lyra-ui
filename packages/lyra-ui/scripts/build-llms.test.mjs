#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  build,
  buildComponentFile,
  buildMigration,
  buildPeers,
  COMPOUND_USAGE_REGISTRATIONS,
  readTagFacts,
  rewriteSharedLinksForRoot,
  TYPE_ONLY_DECLARATION_PEERS,
  validateCompoundUsageRegistrations,
} from './build-llms.mjs';
import { packageAllowlistProblems } from './check-llms-artifacts.mjs';
import { createManifestInheritanceFixture } from './fixtures/manifest-inheritance.mjs';
import { compactManifest } from './manifest-compact.mjs';

const inventory = JSON.parse(
  readFileSync(new URL('./fixtures/component-inventory.json', import.meta.url), 'utf8'),
);
const packageMetadata = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
assert.deepEqual(packageAllowlistProblems(packageMetadata.files), []);
assert.deepEqual(
  packageAllowlistProblems(packageMetadata.files.filter((file) => file !== 'CHANGELOG.md')),
  ['package.json "files" is missing "CHANGELOG.md" — it would not reach consumers.'],
  'the published documentation links CHANGELOG.md, so the allowlist gate must require it',
);
const sharedReference = readFileSync(new URL('../llms/shared.md', import.meta.url), 'utf8');
const layoutReference = readFileSync(new URL('../llms/layout.md', import.meta.url), 'utf8');
const mediaReference = readFileSync(new URL('../llms/media.md', import.meta.url), 'utf8');
const viewersReference = readFileSync(new URL('../llms/viewers.md', import.meta.url), 'utf8');
const readmeReference = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const llmsIntroReference = readFileSync(
  new URL('../llms/00-llms-txt-intro.md', import.meta.url),
  'utf8',
);
assert.deepEqual(
  COMPOUND_USAGE_REGISTRATIONS,
  {
    'lr-checkbox-group': ['lr-checkbox'],
    'lr-radio-group': ['lr-radio', 'lr-radio-button'],
    'lr-tab-group': ['lr-tab', 'lr-tab-panel'],
  },
  'the compound usage policy must retain every authored group child registration',
);
const releaseNavigationFixture = buildComponentFile(
  'lr-fixture',
  {
    tags: ['lr-fixture'],
    text: '## `lr-fixture`\n\nFixture component.',
  },
  new Map([
    [
      'lr-fixture',
      {
        family: 'forms',
        className: 'LyraFixture',
        importPath: '@aceshooting/lyra-ui/components/forms/fixture/fixture.js',
        status: 'stable',
        since: '1.0.0',
        deprecations: [],
        cssParts: [],
        cssProperties: [],
      },
    ],
  ]),
  new Map(),
  { familyHasBreakingNotes: true },
);
assert.match(
  releaseNavigationFixture,
  /\[CHANGELOG\.md\]\(\.\.\/\.\.\/CHANGELOG\.md\)/u,
  'every narrow component reference must link the shipped chronological release history',
);
assert.match(
  releaseNavigationFixture,
  /\[llms-full\.txt\]\(\.\.\/\.\.\/llms-full\.txt\)/u,
  'a narrow component reference must link the shipped family-wide breaking-change summaries when present',
);
assert.doesNotMatch(
  releaseNavigationFixture,
  /\[llms\/forms\.md\]/u,
  'a narrow component reference must not link its unpublished authored family input',
);
const currentManifest = JSON.parse(
  readFileSync(new URL('../custom-elements.json', import.meta.url), 'utf8'),
);
const currentTagFacts = readTagFacts(currentManifest);
const focusedPeerTags = [
  'lr-video',
  'lr-video-playlist',
  'lr-phone-input',
  'lr-command-palette',
  'lr-condition-builder',
  'lr-flag',
  'lr-locale-picker',
];
const focusedPeerFacts = new Map(
  focusedPeerTags.map((tag) => {
    const facts = currentTagFacts.get(tag);
    assert.ok(facts, `${tag} must remain in the manifest peer-reachability fixture`);
    return [tag, facts];
  }),
);
const focusedPeersReference = buildPeers(focusedPeerFacts);
const dompurifyPeerRow = focusedPeersReference
  .split('\n')
  .find((line) => line.startsWith('| `dompurify` |'));
assert.match(
  dompurifyPeerRow ?? '',
  /`lr-video`, `lr-video-playlist`/u,
  'video registrations expose icon-library forwarding and therefore genuinely reach dompurify',
);
for (const tag of ['lr-command-palette', 'lr-condition-builder']) {
  assert.ok(
    !dompurifyPeerRow?.includes(`\`${tag}\``),
    `${tag} must not inherit dompurify from a composed child whose sanitizer capability it cannot reach`,
  );
}
const libphonenumberPeerRow = focusedPeersReference
  .split('\n')
  .find((line) => line.startsWith('| `libphonenumber-js` |'));
assert.doesNotMatch(
  libphonenumberPeerRow ?? '',
  /`lr-phone-input`/u,
  'phone-input documentation examples must not become runtime peer reachability',
);
const flagsSourceRange = packageMetadata.peerDependencies['@aceshooting/lyra-flags'];
const flagsPublishedRange = flagsSourceRange.replace(/^workspace:/u, '');
const flagsPeerRow = focusedPeersReference
  .split('\n')
  .find((line) => line.startsWith('| `@aceshooting/lyra-flags` |'));
assert.ok(
  flagsPeerRow?.includes(`| \`${flagsPublishedRange}\` |`),
  'generated install guidance must publish the npm-resolvable flags range',
);
assert.doesNotMatch(
  flagsPeerRow ?? '',
  /`lr-flag`|`lr-locale-picker`/u,
  'flag peer registration helpers must not become prerequisites of the base flag registrations',
);
assert.doesNotMatch(
  focusedPeersReference,
  /workspace:/u,
  'generated references shipped in the tarball must not retain pnpm-only workspace ranges',
);
assert.match(
  focusedPeersReference,
  /Loading and failure behavior is component-specific:[\s\S]*Consult the owning component section/u,
  'peer guidance must defer component-specific loading and failure signals to the owning contract',
);
assert.doesNotMatch(
  focusedPeersReference,
  /rendering an `<lr-skeleton>` placeholder[\s\S]*`console\.warn`/u,
  'peer guidance must not promise one loading and failure shape for every component',
);

const totalPeerCount = Object.keys(packageMetadata.peerDependencies ?? {}).length;
const componentPeerCount = totalPeerCount - Object.keys(TYPE_ONLY_DECLARATION_PEERS).length;
assert.match(
  sharedReference,
  new RegExp(
    `All ${totalPeerCount} peers are optional, in two groups\\. The ${componentPeerCount} component-facing peers`,
    'u',
  ),
  'the authored shared peer summary must agree with package metadata',
);

const rootIncludedCount = inventory.components.filter((component) => component.rootIncluded).length;
const rootExcludedCount = inventory.components.length - rootIncludedCount;
assert.match(
  sharedReference,
  new RegExp(
    `registers the ${rootIncludedCount}\\s+root-included tags — everything \\*\\*except\\*\\* the ${rootExcludedCount}`,
    'u',
  ),
  'the authored shared all.js arithmetic must agree with the current inventory',
);
assert.match(
  readmeReference,
  new RegExp(
    `registers ${rootIncludedCount} tags — every component \\*\\*except\\*\\* the ${rootExcludedCount}`,
    'u',
  ),
  'the package README all.js arithmetic must agree with the current inventory',
);
assert.match(
  sharedReference,
  /every release after 9\.0\.0[\s\S]*\[CHANGELOG\.md\]\(\.\.\/CHANGELOG\.md\)/u,
  'the shared status policy must route post-9.0 upgrades to the shipped changelog',
);
assert.throws(
  () => rewriteSharedLinksForRoot('No changelog link.'),
  /Expected exactly one/u,
  'the root-context rewrite must fail closed when the authored link disappears',
);
assert.throws(
  () => rewriteSharedLinksForRoot(
    '[CHANGELOG.md](../CHANGELOG.md) and [CHANGELOG.md](../CHANGELOG.md)',
  ),
  /found 2/u,
  'the root-context rewrite must fail closed when its exact source link becomes ambiguous',
);
assert.match(
  llmsIntroReference,
  /\[CHANGELOG\.md\]\(\.\/CHANGELOG\.md\): chronological release notes/u,
  'the short package reference index must expose the shipped changelog',
);
assert.match(
  layoutReference,
  /`renderItem:[^\n]*[\s\S]*returned value\s+is stamped inside `<lr-virtual-list>`'s own shadow root, not the caller's light DOM[\s\S]*document-level selectors cannot style arbitrary returned descendants/u,
  'virtual-list renderItem guidance must disclose its shadow-root styling boundary',
);
const passiveTransclusionContract =
  /Its post-sanitization\s+transclusion\s+is\s+network-silent\s+and\s+non-interactive:[\s\S]*?controls\s+with\s+no\s+passive\s+content\s+are\s+removed\./u;
const readmePassiveTransclusion = readmeReference.match(passiveTransclusionContract)?.[0];
const sharedPassiveTransclusion = sharedReference.match(passiveTransclusionContract)?.[0];
assert.ok(readmePassiveTransclusion, 'the README must disclose the passive transclusion profile');
assert.equal(
  sharedPassiveTransclusion?.replace(/\s+/gu, ' '),
  readmePassiveTransclusion.replace(/\s+/gu, ' '),
  'README.md and llms/shared.md must retain identical passive transclusion security prose',
);
assert.match(
  layoutReference,
  /enumerates its interactive items by local tag\s+name \(`lr-menu-item` or `lr-dropdown-item`\), not `instanceof`/u,
  'menu-label guidance must describe the realm-neutral menu enrollment predicate',
);
assert.doesNotMatch(
  layoutReference,
  /enumerates its items by `instanceof LyraMenuItem`/u,
  'menu-label guidance must not reintroduce a realm-local enrollment claim',
);
assert.match(
  mediaReference,
  /`lr-video-change`[\s\S]*`video` is a fresh detached, recursively frozen plain-data snapshot/u,
  'video-playlist docs must match the recursively frozen event-detail boundary',
);
assert.doesNotMatch(
  mediaReference,
  /`lr-video-change`[\s\S]{0,500}mutable plain-data snapshot/u,
  'video-playlist docs must not promise a mutable event detail',
);
const viewerSection = (tag) => viewersReference
  .split(`## \`${tag}\``)[1]
  ?.split('\n## `')[0] ?? '';
for (const [tag, contract] of [
  ['lr-docx-viewer', /passive-document[\s\S]*anchors, form controls, and\s+custom elements are unwrapped[\s\S]*remote navigation\/resource\s+attributes are removed/u],
  ['lr-email-viewer', /passive-document[\s\S]*anchors, form controls, and custom elements are\s+unwrapped[\s\S]*remote navigation\/resource attributes are removed/u],
  ['lr-html-viewer', /passive-document[\s\S]*links, form controls, and custom\s+elements are unwrapped[\s\S]*remote navigation and resource\s+attributes are removed/u],
  ['lr-include', /network-silent and non-interactive[\s\S]*only resolvable same-document `#fragment` links survive[\s\S]*Form controls and custom elements[\s\S]*unwrapped/u],
  ['lr-notebook-viewer', /passive-document[\s\S]*anchors, form controls, and custom\s+elements are unwrapped[\s\S]*remote navigation\/resource attributes[\s\S]*removed[\s\S]*`image\/svg\+xml`[\s\S]*network-silent and non-interactive/u],
]) {
  assert.match(
    viewerSection(tag),
    contract,
    `${tag} docs must disclose the exact passive, network-silent sanitizer profile`,
  );
}
const migration = buildMigration();

const conversationReference = readFileSync(new URL('../llms/conversation.md', import.meta.url), 'utf8');
const dataReference = readFileSync(new URL('../llms/data.md', import.meta.url), 'utf8');
const markdownSharedSource = readFileSync(
  new URL('../src/components/conversation/markdown/markdown-shared.ts', import.meta.url),
  'utf8',
);
const headingItemBody = markdownSharedSource.match(
  /export interface MarkdownHeadingItem\s*{(?<body>[^}]*)}/,
)?.groups?.body;
assert.ok(headingItemBody, 'MarkdownHeadingItem must remain a declared public interface');
const headingItemKeys = [...headingItemBody.matchAll(/^\s*(?<key>[A-Za-z_$][\w$]*)\??:/gm)].map(
  ({ groups }) => groups.key,
);
const conversationLines = conversationReference.split('\n');
const headingTreeContractIndex = conversationLines.findIndex((line) =>
  line.startsWith('- `getHeadingTree()'),
);
assert.notEqual(
  headingTreeContractIndex,
  -1,
  'the authored Markdown reference must document getHeadingTree()',
);
const headingTreeContract = conversationLines
  .slice(headingTreeContractIndex, headingTreeContractIndex + 3)
  .join(' ');
assert.ok(
  headingTreeContract.includes('MarkdownHeadingItem[]') &&
    headingTreeContract.includes(`\`{ ${headingItemKeys.join(', ')} }[]\``),
  'getHeadingTree() prose must name its exported return type and exact object keys',
);

const flowCanvasSection = dataReference
  .split('## `lr-flow-canvas`')[1]
  ?.split('\n## `lr-')[0];
assert.ok(flowCanvasSection, 'the authored data reference must contain lr-flow-canvas');
const flowCanvasExample = flowCanvasSection.match(/```html\n(?<html>[\s\S]*?)\n```/)?.groups?.html;
assert.ok(flowCanvasExample, 'lr-flow-canvas must retain a canonical HTML example');
const flowCanvasElement = flowCanvasExample.match(/<lr-flow-canvas\b[\s\S]*?<\/lr-flow-canvas>/)?.[0];
assert.ok(flowCanvasElement, 'the canonical example must contain a complete lr-flow-canvas');
assert.match(
  flowCanvasElement,
  /<lr-flow-controls\b[^>]*slot="bottom-start"[^>]*><\/lr-flow-controls>/,
  'the canonical flow controls must be assigned inside the canvas bottom-start slot',
);
assert.match(
  flowCanvasElement,
  /<lr-flow-minimap\b[^>]*slot="bottom-end"[^>]*><\/lr-flow-minimap>/,
  'the canonical minimap must be assigned inside the canvas bottom-end slot',
);

const compactFacts = readTagFacts(compactManifest(createManifestInheritanceFixture()));
assert.deepEqual(
  compactFacts.get('lr-fixture-child').cssParts.map(({ name }) => name),
  ['base', 'control'],
  'generated component docs must count inherited CSS parts from the compact manifest',
);
assert.deepEqual(
  compactFacts.get('lr-fixture-child').cssProperties.map(({ name }) => name),
  ['--lr-fixture-base-color', '--lr-fixture-child-color'],
  'generated component docs must count inherited CSS properties from the compact manifest',
);

const compoundFixtureFacts = new Map([
  ['lr-owner', {}],
  ['lr-child', {}],
]);
const compoundFixtureSections = new Map([
  ['lr-owner', { text: '## `lr-owner`\n\nCompose `<lr-child>` inside it.' }],
]);
assert.deepEqual(
  validateCompoundUsageRegistrations(
    { 'lr-owner': ['lr-child'] },
    compoundFixtureFacts,
    compoundFixtureSections,
  ),
  [],
  'compound usage metadata accepts public child tags used by the owner section',
);
assert.deepEqual(
  validateCompoundUsageRegistrations(
    { 'lr-owner': ['lr-owner', 'lr-child', 'lr-child', 'lr-missing'] },
    compoundFixtureFacts,
    compoundFixtureSections,
  ),
  [
    'compound usage owner `lr-owner` cannot list itself as a related tag',
    'compound usage owner `lr-owner` does not use `lr-owner` in its authored section',
    'compound usage owner `lr-owner` lists `lr-child` more than once',
    'compound usage owner `lr-owner` refers to unknown tag `lr-missing`',
    'compound usage owner `lr-owner` does not use `lr-missing` in its authored section',
  ],
  'compound usage metadata fails closed on self, duplicate, fictional, and stale tags',
);

assert.match(
  migration,
  /^<!-- GENERATED by scripts\/build-llms\.mjs from scripts\/fixtures\/component-inventory\.json/m,
);
assert.match(migration, /The codemod changes only `exact` and `rewritten`/);
assert.match(migration, /The JSON migration report records every rewrite and warning/);
assert.match(migration, /npx --package @aceshooting\/lyra-ui@<version> lyra-ui-migrate --check/);
assert.doesNotMatch(migration, /pnpm migrate-wa/, 'consumer migration docs must use the published CLI');
assert.match(migration, /`@aceshooting\/lyra-ui\/all\.js`/);
assert.match(migration, /root-excluded targets receive granular registration imports/);
assert.match(migration, /`OPTIONAL_PEER_REQUIRED`/);
assert.match(
  migration,
  /`BEHAVIOR_REVIEW_REQUIRED`[\s\S]*registerIconLibrary\('default', \{ resolver \}\)/u,
  'generated migration guidance must expose the icon-name vocabulary review and its remedy',
);
assert.match(migration, /`REGISTRATION_CLOSURE_REQUIRED`/);
assert.match(migration, /`@awesome\.me\/webawesome` and `@awesome\.me\/webawesome-pro`/);
assert.match(migration, /standalone CSS/);
assert.match(migration, /Shoelace relationships are classified independently/);
assert.doesNotMatch(migration, /review ledger|reviewed independently|reviewed and recorded/);
assert.match(migration, /## Migrating Lyra 7 defaults/);
assert.match(migration, /lyra-ui-migrate --origin=lyra-v7 --check/);
assert.match(
  migration,
  /\| `lyra-v7` \| `<lr-popup>` \| `strategy="fixed"`, `placement="bottom-start"`, `distance="4"`, presence `flip`, presence `shift` \|/,
);
assert.match(
  migration,
  /\| `lyra-v7` \| `<lr-popover>` \| `placement="bottom-start"`, `distance="4"`, presence `without-arrow` \|/,
);
assert.match(migration, /It never\nrenames an `lr-\*` tag or import/);
const classifications = ['exact', 'rewritten', 'warning-required', 'conceptual-only', 'unsupported'];
for (const [label, upstream] of [
  ['Web Awesome', 'webawesome'],
  ['Shoelace', 'shoelace'],
]) {
  const mappings = inventory.mappings.filter((mapping) => mapping.upstream === upstream);
  const counts = Object.fromEntries(
    classifications.map((classification) => [
      classification,
      mappings.filter((mapping) => mapping.classification === classification).length,
    ]),
  );
  assert.ok(
    migration.includes(
      `| ${label} | ${counts.exact} | ${counts.rewritten} | ${counts['warning-required']} | ` +
        `${counts['conceptual-only']} | ${counts.unsupported} | ${counts.exact + counts.rewritten} | ` +
        `${counts['warning-required'] + counts['conceptual-only'] + counts.unsupported} |`,
    ),
  );
}
assert.match(
  migration,
  /\| `<sl-resize-observer>` \| `<lr-resize-observer>` \| `warning-required` \| Manual: Lyra freezes the entries array into an immutable snapshot at dispatch time; migrated code that mutates the array in place must create its own copy\. \|/,
);
assert.match(
  migration,
  /\| `<wa-data-grid>` \| `<lr-data-grid>` \| `warning-required` \| Manual: Lyra snapshots collection inputs and event details synchronously into frozen readonly values,/,
);
assert.match(
  migration,
  /\| `<wa-accordion>` \| `<lr-accordion>` \| `warning-required` \| Manual: Lyra snapshots each expand\/collapse event detail into a frozen readonly value at dispatch time/,
  'accordion migration guidance must expose the immutable event-detail contract',
);
assert.doesNotMatch(
  migration,
  /wa-accordion[^\n]*legacy direct <lr-details>/u,
);
assert.match(
  migration,
  /\| `<wa-page>` \| `<lr-page>` \| `warning-required` \| Manual: Lyra returns a finite 0 for null[^\n]*ambient page viewport\./u,
  'C-576 guidance must expose the reviewed method-edge divergence',
);
assert.match(migration, /\| `<wa-include>` \| `<lr-include>` \| `warning-required` \| Manual:/);
assert.doesNotMatch(migration, /mechanical tag\/import rename|Documented 1:1 mirrors/);

const documentedSources = migration
  .split('\n')
  .map((line) => line.match(/^\| `<((?:wa|sl)-[a-z0-9-]+)>` \|/)?.[1])
  .filter(Boolean)
  .sort();
assert.deepEqual(
  documentedSources,
  inventory.mappings.map((mapping) => mapping.upstreamTag).sort(),
  'migration.md must document every inventory mapping exactly once',
);

assert.deepEqual(TYPE_ONLY_DECLARATION_PEERS, {
  react: '@aceshooting/lyra-ui/custom-elements-jsx',
  svelte: '@aceshooting/lyra-ui/svelte',
  vue: '@aceshooting/lyra-ui/vue',
});

const artifacts = build({ write: false });
const full = [...artifacts].find(([file]) => file.endsWith('/llms-full.txt'))?.[1];
const tokens = [...artifacts].find(([file]) => file.endsWith('/llms/tokens.md'))?.[1];
const peers = [...artifacts].find(([file]) => file.endsWith('/llms/peers.md'))?.[1];
const index = [...artifacts].find(([file]) => file.endsWith('/llms/index.md'))?.[1];
const table = [...artifacts].find(([file]) => file.endsWith('/llms/components/lr-table.md'))?.[1];
const streamingText = [...artifacts].find(([file]) => file.endsWith('/llms/components/lr-streaming-text.md'))?.[1];
const compoundReferences = Object.fromEntries(
  Object.keys(COMPOUND_USAGE_REGISTRATIONS).map((tag) => [
    tag,
    [...artifacts].find(([file]) => file.endsWith(`/llms/components/${tag}.md`))?.[1],
  ]),
);
assert.ok(tokens, 'build({ write: false }) must produce llms/tokens.md');
assert.ok(full, 'build({ write: false }) must produce llms-full.txt');
assert.match(
  full,
  /package's shipped \[CHANGELOG\.md\]\(\.\/CHANGELOG\.md\) before upgrading/u,
  'the package-root llms-full reference must resolve CHANGELOG.md beside itself',
);
assert.doesNotMatch(
  full,
  /\[CHANGELOG\.md\]\(\.\.\/CHANGELOG\.md\)/u,
  'llms-full must not retain shared.md\'s directory-relative changelog path',
);
assert.match(
  sharedReference,
  /\[CHANGELOG\.md\]\(\.\.\/CHANGELOG\.md\)/u,
  'the authored llms/shared.md link must remain correct in its own directory context',
);
assert.ok(peers, 'build({ write: false }) must produce llms/peers.md');
assert.ok(index, 'build({ write: false }) must produce llms/index.md');
assert.ok(table, 'build({ write: false }) must produce per-tag component docs');
assert.ok(streamingText, 'build({ write: false }) must produce lr-streaming-text docs');
for (const [tag, reference] of Object.entries(compoundReferences)) {
  assert.ok(reference, `build({ write: false }) must produce ${tag} docs`);
  const generatedHeader = reference.split('\n---\n', 1)[0];
  const documentedRegistrationTags = [...generatedHeader.matchAll(
    /import '@aceshooting\/lyra-ui\/components\/(lr-[a-z0-9-]+)\.js';/gu,
  )].map((match) => match[1]);
  assert.deepEqual(
    documentedRegistrationTags,
    [tag, ...COMPOUND_USAGE_REGISTRATIONS[tag]],
    `${tag} docs must publish the complete owner + consumer-supplied child registration closure`,
  );
  assert.match(
    generatedHeader,
    /usage-only, not registration dependencies/,
    `${tag} docs must not misclassify consumer-supplied children as owner module dependencies`,
  );
}

assert.match(index, /components\/lr-table\.js/);
assert.doesNotMatch(index, /path is NOT `components\/<tag>\/`/);
assert.match(table, /import '@aceshooting\/lyra-ui\/components\/lr-table\.js';/);
assert.match(table, /components\/data\/table\/table\.class\.js/);
assert.match(
  table,
  /\[CHANGELOG\.md\]\(\.\.\/\.\.\/CHANGELOG\.md\)/u,
  'every generated component reference must link chronological release history',
);
assert.match(
  table,
  /\[llms-full\.txt\]\(\.\.\/\.\.\/llms-full\.txt\)/u,
  'generated component references must expose their shipped family-wide breaking-change summaries',
);
assert.match(
  streamingText,
  /- \*\*Optional peers\*\* `dompurify`, `katex`, `marked`, `shiki` — see `llms\/peers\.md`/,
  'transitive peers must follow the double-quoted side-effect lr-streaming-text → lr-markdown registration edge',
);

assert.match(
  tokens,
  /^<!-- GENERATED by scripts\/build-llms\.mjs from scripts\/fixtures\/token-docs\.generated\.json/m,
);
assert.match(tokens, /## Direct theme-backed tokens \(263\)/);
assert.match(tokens, /## Derived and fixed tokens \(76\)/);
assert.match(tokens, /Aliases and computed values still follow/);
assert.match(tokens, /fixed contract constants are intentionally\nnot theme inputs/);
assert.doesNotMatch(tokens, /Each reads one `--lr-theme-\*` input/);
assert.match(tokens, /\| `--lr-color-brand` \| `var\(--lr-color-brand-fill-loud\)` \| forcedColors: `LinkText` \|/);
assert.match(tokens, /\| `--lr-mask-opaque` \| `#000` \| — \|/);
assert.match(
  tokens,
  /\| `--lr-color-surface` \| `--lr-theme-color-surface-default` \| `#fff` \| dark: `var\(--lr-theme-color-surface-default, #1a1a1a\)`<br>forcedColors: `Canvas` \|/,
);

// 29 since chartjs-plugin-annotation joined as lr-chart's optional annotations peer.
assert.match(peers, /All 29 peers are \*\*optional\*\*/);

// lr-phone-input's only reachable mention of libphonenumber-js is a JSDoc @example
// (`import('libphonenumber-js/min')`) showing a consumer-built adapter -- it must not attribute
// the peer, matching the prose immediately above the table that says it never imports the peer.
assert.doesNotMatch(
  peers,
  /\| `libphonenumber-js` \|[^\n]*`lr-phone-input`/,
  'a JSDoc @example must never attribute an optional peer to the component that documents it',
);
assert.match(peers, /\*\*Framework declaration peers \(3\)\.\*\*/);
assert.match(peers, /\*\*Component-loaded peers \(26\)\.\*\*/);

for (const [peer, entry] of Object.entries(TYPE_ONLY_DECLARATION_PEERS)) {
  const row = peers
    .split('\n')
    .find((line) => line.startsWith(`| \`${peer}\` |`));
  assert.ok(row, `${peer} must have an optional-peer row`);
  assert.ok(row.includes(`type-only \`${entry}\` entry`));
  assert.doesNotMatch(row, /not referenced by any component/);
}

assert.match(
  peers,
  /Those entry points emit empty\nJavaScript, no component imports these frameworks, and Lyra ships no runtime wrapper\./,
);

console.log('LLM peer classification tests passed.');

// `lr-lite-chart` exists precisely to avoid the Chart.js peers -- its own prose says so -- yet the
// peers table listed it under all four, and the generated per-component header inherited that. The
// attribution walker follows a tag's real module graph, which is right, but its regex could not
// tell `import type { ... } from './chart.class.js'` from a value import. TypeScript erases the
// former entirely, so lite-chart never reaches chart.js at runtime. The effect inverted the very
// choice the component exists to offer: a bundle-conscious reader greps that header.
const liteChart = [...artifacts].find(
  ([file]) => file.endsWith('/llms/components/lr-lite-chart.md'),
)?.[1];
assert.ok(liteChart, 'build({ write: false }) must produce lr-lite-chart docs');

assert.match(
  liteChart,
  /- \*\*Optional peers\*\* none/,
  'lr-lite-chart reaches chart.js only through an erased `import type`, so it has no runtime peers',
);
for (const peer of ['chart.js', 'chartjs-plugin-zoom', 'chartjs-plugin-datalabels', 'chartjs-plugin-annotation']) {
  assert.ok(
    !new RegExp(`\\| \`${peer.replace('.', '\\.')}\` \\|[^\\n]*lr-lite-chart`).test(peers),
    `the peers table must not attribute ${peer} to lr-lite-chart`,
  );
}

// The control: lr-chart imports the loaders for real, so it must still be attributed.
assert.ok(
  /\| `chart\.js` \|[^\n]*`lr-chart`/.test(peers),
  'lr-chart genuinely imports chart.js and must stay attributed',
);
