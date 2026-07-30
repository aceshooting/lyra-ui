#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  defaultStringKeys,
  findMissingDefaultStrings,
  literalLocalizeCalls,
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

console.log('Default-string checker self-tests passed.');
