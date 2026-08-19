#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  defaultStringKeys,
  findMissingDefaultStrings,
  literalLocalizeCalls,
  localizeCalls,
  sharedStringConstants,
  unresolvedLocalizeCalls,
} from './check-default-strings.mjs';

const localization = `
  export type Key = 'present' | 'template-key';
  const DEFAULT_STRINGS: Record<Key, string> = {
    present: 'Present',
    'template-key': 'Template',
  };
`;

assert.deepEqual(
  [...defaultStringKeys(localization)].sort(),
  ['present', 'template-key'],
  'identifier and quoted DEFAULT_STRINGS properties are both recognized',
);

const positive = `
  class Example {
    render() {
      this.localize('present');
      this.localize(\`template-key\`);
      this.localize(this.dynamicKey);
      const text = "this.localize('text-only')";
      // this.localize('comment-only')
      return text;
    }
  }
`;
assert.deepEqual(
  literalLocalizeCalls(positive),
  [
    { key: 'present', line: 4 },
    { key: 'template-key', line: 5 },
  ],
  'only actual calls with static string arguments participate',
);
assert.deepEqual(
  findMissingDefaultStrings([{ file: 'src/components/example.class.ts', source: positive }], localization),
  [],
  'known literal component keys pass',
);

const negative = `
  class Broken {
    render() {
      this.localize('missing');
      this.localize('alsoMissing', 'A fallback does not exempt the key');
    }
  }
`;
assert.deepEqual(
  findMissingDefaultStrings([{ file: 'src/components/broken.class.ts', source: negative }], localization),
  [
    { file: 'src/components/broken.class.ts', key: 'alsoMissing', line: 5 },
    { file: 'src/components/broken.class.ts', key: 'missing', line: 4 },
  ],
  'missing keys are actionable and a local fallback cannot bypass the English-default contract',
);

assert.throws(
  () => defaultStringKeys('const SOMETHING_ELSE = {};'),
  /does not declare DEFAULT_STRINGS/,
  'a renamed or structurally missing registry fails closed',
);

// ---------------------------------------------------------------------------
// Keys that are not plain literals
//
// 131 of this package's 1739 component `localize()` call sites used to fall straight through the
// literal-only reader: every ternary, every module-level lookup table, every shared key table. A
// missing English default behind any of them was invisible to the one gate whose job is to catch
// exactly that. The cases below are reduced from the real shapes (lr-browser-frame's ternary,
// lr-agent-trace's KIND_LABEL_KEY, lr-tool-result-dialog's `?? fallback`, lr-time-input's
// `keys[name]!`, lr-attachment-chip's exported FILE_SIZE_UNIT_KEYS).
// ---------------------------------------------------------------------------

const dynamicDefaults = `
  const DEFAULT_STRINGS = {
    agentControlled: 'Agent',
    userControlled: 'You',
    kindTool: 'Tool',
    kindModel: 'Model',
    pending: 'Pending',
    unitBytes: 'B',
    prefixSuffix: 'Both',
  };
`;

const resolvable = `
  const KIND_LABEL_KEY = { tool: 'kindTool', model: 'kindModel' };
  const FALLBACK = 'pending';
  class Example {
    render() {
      this.localize(this.controller === 'agent' ? 'agentControlled' : 'userControlled');
      this.localize(KIND_LABEL_KEY[this.kind]);
      this.localize(KIND_LABEL_KEY.tool);
      this.localize(KIND_LABEL_KEY[this.kind] ?? FALLBACK);
      this.localize(keysTable[name]!);
      this.localize('prefix' + 'Suffix');
      this.localize(\`\${FALLBACK}\`);
    }
  }
  const keysTable = { a: 'pending' };
`;

assert.deepEqual(
  [...new Set(literalLocalizeCalls(resolvable).map(({ key }) => key))].sort(),
  [
    'agentControlled',
    'kindModel',
    'kindTool',
    'pending',
    'prefixSuffix',
    'userControlled',
  ],
  'ternaries, lookup tables, ?? fallbacks, non-null assertions, concatenation and template literals all resolve',
);
assert.deepEqual(
  unresolvedLocalizeCalls(resolvable),
  [],
  'nothing in the resolvable fixture is left unanalysed',
);
assert.deepEqual(
  findMissingDefaultStrings([{ file: 'src/components/example.class.ts', source: resolvable }], dynamicDefaults),
  [],
  'resolvable keys that all have English defaults pass',
);

const dynamicallyBroken = `
  const KIND_LABEL_KEY = { tool: 'kindTool', model: 'kindMissing' };
  class Broken {
    render() {
      this.localize(this.expanded ? 'agentControlled' : 'ternaryMissing');
      this.localize(KIND_LABEL_KEY[this.kind]);
    }
  }
`;
assert.deepEqual(
  findMissingDefaultStrings(
    [{ file: 'src/components/broken.class.ts', source: dynamicallyBroken }],
    dynamicDefaults,
  ),
  [
    { file: 'src/components/broken.class.ts', key: 'kindMissing', line: 6 },
    { file: 'src/components/broken.class.ts', key: 'ternaryMissing', line: 5 },
  ],
  'a missing default reached through a ternary arm or a lookup-table value is now a finding',
);

const undecidable = `
  class Runtime {
    render() {
      this.localize(key);
      this.localize(descriptor.key);
      this.localize(this.keyFor(x));
    }
  }
`;
assert.deepEqual(
  unresolvedLocalizeCalls(undecidable).map(({ line, expression }) => [line, expression]),
  [
    [4, 'key'],
    [5, 'descriptor.key'],
    [6, 'this.keyFor(x)'],
  ],
  'a key the file cannot decide is reported as unanalysable rather than silently accepted',
);
assert.deepEqual(
  findMissingDefaultStrings([{ file: 'src/components/runtime.class.ts', source: undecidable }], dynamicDefaults),
  [],
  'an unanalysable key is not invented into a finding either',
);
assert.deepEqual(
  localizeCalls(undecidable).map(({ keys }) => keys),
  [undefined, undefined, undefined],
);

// A half-literal table is dropped whole -- a partial key list would read as complete and hide the
// members it could not see.
assert.deepEqual(
  unresolvedLocalizeCalls([
    "const MIXED = { a: 'pending', b: computeIt() };",
    'class Half { render() { this.localize(MIXED[k]); } }',
  ].join('\n')).length,
  1,
);

const sharedSource = "export const FILE_SIZE_UNIT_KEYS = { b: 'unitBytes' };";
const consumer = 'class Consumer { render() { this.localize(FILE_SIZE_UNIT_KEYS[unit]); } }';
assert.deepEqual(
  literalLocalizeCalls(consumer, 'consumer.ts', sharedStringConstants([
    { file: 'shared.ts', source: sharedSource },
  ])).map(({ key }) => key),
  ['unitBytes'],
  'an exported key table resolves for the modules that import it',
);
assert.deepEqual(
  unresolvedLocalizeCalls(consumer).length,
  1,
  'without the shared pool the same call is honestly reported as undecidable',
);
assert.equal(
  sharedStringConstants([
    { file: 'a.ts', source: "export const T = { x: 'one' };" },
    { file: 'b.ts', source: "export const T = { x: 'two' };" },
  ]).has('T'),
  false,
  'two modules disagreeing about a name drops it rather than merging an over-wide key set',
);

console.log('Default-string checker self-tests passed.');
