import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BARE_ROUTE_EXCEPTIONS,
  DOC_SPECIFIER_EXCEPTIONS,
  abbreviatedRouteFindings,
  checkDocumentedSpecifiers,
  checkWorkspaceDocumentedSpecifiers,
  collectDocumentedSpecifiers,
} from './check-doc-specifiers.mjs';

// The production tree must always pass -- this is the gate itself, run against reality.
assert.deepEqual(
  checkWorkspaceDocumentedSpecifiers().findings,
  [],
  'every specifier a shipped file documents must resolve through package.json#exports'
);
const productionFlagsDir = join(
  dirname(dirname(dirname(fileURLToPath(import.meta.url)))),
  'lyra-flags',
);
const productionFlagSpecifiers = collectDocumentedSpecifiers(productionFlagsDir);
assert.ok(
  productionFlagSpecifiers.has('@aceshooting/lyra-flags/standard'),
  'the workspace gate must actually scan lyra-flags documentation',
);
const productionDocsDir = join(
  dirname(dirname(dirname(fileURLToPath(import.meta.url)))),
  'lyra-docs',
);
const productionDocsSpecifiers = collectDocumentedSpecifiers(productionDocsDir);
assert.ok(
  productionDocsSpecifiers.has('@aceshooting/lyra-docs/docx/editor.css'),
  'the workspace gate must actually scan lyra-docs documentation',
);

const root = mkdtempSync(join(tmpdir(), 'lyra-doc-specifiers-'));
const write = (relativePath, contents) => {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
};

try {
  write(
    'package.json',
    `${JSON.stringify(
      {
        name: '@aceshooting/lyra-ui',
        exports: {
          '.': './dist/lyra.js',
          './components/media/flag/flag-peer.js': './dist/components/media/flag/flag-peer.js',
          './utilities/*': './dist/utilities/*',
        },
      },
      null,
      2
    )}\n`
  );

  // 1. A fenced import of an unlisted specifier -- how `flow-types.js` was promised.
  write(
    'llms/data.md',
    'Import the types directly:\n\n```ts\n'
      + "import type { LyraFlowNode } from '@aceshooting/lyra-ui/components/data/flow/flow-types.js';\n"
      + '```\n'
  );

  // 2. A PROSE import of an unlisted specifier -- how `flag-peer-bulk.js` was promised. A check
  //    that only understood fenced imports would have missed the bug that motivated this file.
  write(
    'llms/media.md',
    'Alternatively, import `@aceshooting/lyra-ui/components/media/flag/flag-peer-bulk.js` instead\n'
      + 'of the default `@aceshooting/lyra-ui/components/media/flag/flag-peer.js`.\n'
  );

  // 3. Shapes that must NEVER be reported.
  write(
    'src/noise.ts',
    // Directory prose, not an instruction to import anything.
    "// Everything under `@aceshooting/lyra-ui/components/` is generated.\n"
      // A namespaced identifier that merely borrows the package name.
      + "const KEY = Symbol.for('@aceshooting/lyra-ui/markdown-katex-override');\n"
      + "const PROTOCOL = '@aceshooting/lyra-ui/toast-region/enqueue/v1';\n"
      // A filesystem path into node_modules -- resolved by the editor, not by the exports map.
      + '// "html.customData": ["./node_modules/@aceshooting/lyra-ui/vscode-html-data.json"]\n'
      // A resolvable specifier, through a wildcard route.
      + "import { place } from '@aceshooting/lyra-ui/utilities/positioner.js';\n"
      + 'export { KEY, PROTOCOL, place };\n'
  );

  const { findings } = checkDocumentedSpecifiers(root, []);
  assert.deepEqual(findings, [
    '@aceshooting/lyra-ui/components/data/flow/flow-types.js is documented as an import in '
      + 'llms/data.md but does not resolve through package.json#exports',
    '@aceshooting/lyra-ui/components/media/flag/flag-peer-bulk.js is documented as an import in '
      + 'llms/media.md but does not resolve through package.json#exports',
  ]);

  // An exception that a shipped file still needs excuses exactly that specifier and nothing else.
  assert.deepEqual(
    checkDocumentedSpecifiers(root, [
      {
        specifier: '@aceshooting/lyra-ui/components/data/flow/flow-types.js',
        reason: 'fixture: documented on purpose',
      },
    ]).findings,
    [
      '@aceshooting/lyra-ui/components/media/flag/flag-peer-bulk.js is documented as an import in '
        + 'llms/media.md but does not resolve through package.json#exports',
    ],
  );

  // An exception no shipped file needs any more is stale: it would silently excuse the next doc
  // edit that reintroduces the dead specifier.
  assert.deepEqual(
    checkDocumentedSpecifiers(root, [
      {
        specifier: '@aceshooting/lyra-ui/internal/removed-example.js',
        reason: 'fixture: the example that needed this was deleted',
      },
    ]).findings.filter((finding) => finding.includes('removed-example')),
    [
      '@aceshooting/lyra-ui/internal/removed-example.js is listed in DOC_SPECIFIER_EXCEPTIONS but '
        + 'no shipped file documents it -- drop the exception',
    ],
  );

  // The `.json`/`.js` alternation must not report a `custom-elements.js` nobody wrote.
  const collected = [...collectDocumentedSpecifiers(root).keys()];
  assert.ok(
    !collected.some((specifier) => specifier.endsWith('vscode-html-data.js')),
    '`.js` must not match the leading characters of a `.json` path'
  );
  assert.ok(
    !collected.includes('@aceshooting/lyra-ui/toast-region/enqueue/v1'),
    'a namespaced identifier string is not a module specifier'
  );

  // Adding the two missing routes clears both findings and nothing else changes.
  write(
    'package.json',
    `${JSON.stringify(
      {
        name: '@aceshooting/lyra-ui',
        exports: {
          '.': './dist/lyra.js',
          './components/data/flow/flow-types.js': './dist/components/data/flow/flow-types.js',
          './components/media/flag/flag-peer.js': './dist/components/media/flag/flag-peer.js',
          './components/media/flag/flag-peer-bulk.js':
            './dist/components/media/flag/flag-peer-bulk.js',
          './utilities/*': './dist/utilities/*',
        },
      },
      null,
      2
    )}\n`
  );
  assert.deepEqual(checkDocumentedSpecifiers(root, []).findings, []);

  // A stale exception is reported too: it excuses a specifier that no longer needs excusing, and
  // would go on excusing a genuinely-broken future namesake.
  assert.ok(
    DOC_SPECIFIER_EXCEPTIONS.every((entry) => entry.specifier && entry.reason),
    'every exception states which specifier it excuses and why'
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}

const flagsRoot = mkdtempSync(join(tmpdir(), 'lyra-flags-doc-specifiers-'));
try {
  const writeFlags = (relativePath, contents) => {
    const target = join(flagsRoot, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  };
  writeFlags(
    'package.json',
    `${JSON.stringify(
      {
        name: '@aceshooting/lyra-flags',
        exports: {
          '.': './index.js',
          './standard': './standard.js',
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFlags(
    'README.md',
    "import { flagUrl } from '@aceshooting/lyra-flags/compact';\n",
  );

  assert.deepEqual(checkDocumentedSpecifiers(flagsRoot, []).findings, [
    '@aceshooting/lyra-flags/compact is documented as an import in README.md but does not '
      + 'resolve through package.json#exports',
  ]);
} finally {
  rmSync(flagsRoot, { recursive: true, force: true });
}

// Abbreviated prose routes: the per-directory registration module shape the package no longer
// ships must be reported in every form a reader would copy, while retained routes and the Chart.js
// library name pass.
{
  const exportsMap = {
    './components/lr-pdf-viewer.js': './dist/components/lr-pdf-viewer.js',
    './components/lr-markdown-core.js': './dist/components/lr-markdown-core.js',
    './components/charts/chart/chart-colors.js': './dist/components/charts/chart/chart-colors.js',
    './theme/*': './dist/theme/*',
  };
  const directories = new Set(['pdf-viewer', 'markdown', 'chart']);
  const text = [
    'Importing `pdf-viewer.js` loads the class module.',
    'Also `.../markdown/markdown-core.js` and `../markdown/markdown-core.js`.',
    'Or `components/viewers/pdf-viewer/pdf-viewer.js`.',
    'Use `components/lr-pdf-viewer.js` or `components/lr-markdown-core.js`.',
    'The palette is in `.../chart/chart-colors.js`; the peer is `chart.js`.',
    'A theme route `theme/gemstones.js` and an unrelated `helper.js` are not judged.',
    '| module | `pdf-viewer.js` | removed |',
  ].join('\n');
  assert.deepEqual(abbreviatedRouteFindings([['doc.md', text]], exportsMap, directories), [
    'doc.md:1 names `pdf-viewer.js`, which no package.json#exports route provides; registration entries are `components/lr-<tag>.js`',
    'doc.md:2 names `.../markdown/markdown-core.js`, which no package.json#exports route provides; registration entries are `components/lr-<tag>.js`',
    'doc.md:2 names `../markdown/markdown-core.js`, which no package.json#exports route provides; registration entries are `components/lr-<tag>.js`',
    'doc.md:3 names `components/viewers/pdf-viewer/pdf-viewer.js`, which no package.json#exports route provides; registration entries are `components/lr-<tag>.js`',
  ]);
  assert.ok(
    [...BARE_ROUTE_EXCEPTIONS.values()].every((reason) => reason.length > 0),
    'every bare-route exception states what the name refers to',
  );
}

console.log('documented package specifier checks passed.');
