#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  analyzeComposedChildContracts,
  extractComposedChildBindings,
} from './check-composed-child-contracts.mjs';

const manifest = {
  schemaVersion: '1.0.0',
  modules: [
    {
      kind: 'javascript-module',
      path: 'src/internal/base.ts',
      declarations: [
        {
          kind: 'class',
          name: 'FixtureBase',
          members: [
            { kind: 'field', name: 'inheritedValue' },
            { kind: 'field', name: 'privateValue', privacy: 'private' },
          ],
          attributes: [{ name: 'inherited-attribute', fieldName: 'inheritedAttribute' }],
        },
      ],
    },
    {
      kind: 'javascript-module',
      path: 'src/internal/fixture-mixin.ts',
      declarations: [
        {
          kind: 'mixin',
          name: 'FixtureMixin',
          members: [{ kind: 'field', name: 'mixedValue', attribute: 'mixed-value' }],
          attributes: [{ name: 'mixed-value', fieldName: 'mixedValue' }],
        },
      ],
    },
    {
      kind: 'javascript-module',
      path: 'src/components/fixture-child/fixture-child.class.ts',
      declarations: [
        {
          kind: 'class',
          name: 'FixtureChild',
          tagName: 'lr-fixture-child',
          superclass: { name: 'FixtureBase', module: '/src/internal/base.js' },
          mixins: [{ name: 'FixtureMixin', module: '/src/internal/fixture-mixin.js' }],
          members: [
            { kind: 'field', name: 'ownValue', attribute: 'own-value' },
            { kind: 'field', name: 'enabled', attribute: 'enabled' },
          ],
          attributes: [
            { name: 'own-value', fieldName: 'ownValue' },
            { name: 'enabled', fieldName: 'enabled' },
          ],
        },
      ],
    },
    {
      kind: 'javascript-module',
      path: 'src/components/media/av-player/av-player.class.ts',
      declarations: [
        {
          kind: 'class',
          name: 'FixtureAvPlayer',
          tagName: 'lr-av-player',
          members: [],
          attributes: [],
        },
      ],
    },
  ],
};

function writeFixture({ componentSource, storySource = '', selfSource = '' }) {
  const packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-composed-contracts-'));
  const componentDir = path.join(packageDir, 'src', 'components', 'fixture-parent');
  fs.mkdirSync(componentDir, { recursive: true });
  fs.writeFileSync(path.join(packageDir, 'custom-elements.json'), `${JSON.stringify(manifest)}\n`);
  fs.writeFileSync(path.join(componentDir, 'fixture-parent.class.ts'), componentSource);
  if (storySource) fs.writeFileSync(path.join(componentDir, 'fixture-parent.stories.ts'), storySource);
  if (selfSource) {
    const selfDir = path.join(packageDir, 'src', 'components', 'fixture-child');
    fs.mkdirSync(selfDir, { recursive: true });
    fs.writeFileSync(path.join(selfDir, 'fixture-child.class.ts'), selfSource);
  }
  return packageDir;
}

function analyzeFixture(sources) {
  const packageDir = writeFixture(sources);
  try {
    return analyzeComposedChildContracts({ packageDir });
  } finally {
    fs.rmSync(packageDir, { recursive: true, force: true });
  }
}

const positive = analyzeFixture({
  componentSource: `
    import { html } from 'lit';
    export const view = (value: string, enabled: boolean) => html\`
      <lr-fixture-child
        .inheritedValue=\${value}
        inherited-attribute="yes"
        .mixedValue=\${value}
        mixed-value="yes"
        .ownValue=\${value}
        own-value=\${value}
        ?enabled=\${enabled}
        part="child"
        aria-label="Fixture"
        data-testid="child"
        @lr-change=\${() => undefined}
      ></lr-fixture-child>
      <lr-av-player .anchor=\${'page:1'} active-highlight-id="page:1"></lr-av-player>
    \`;
  `,
  storySource: `
    import { html } from 'lit';
    const mentioned = '<lr-fixture-child missing-in-a-string>';
    // html\`<lr-fixture-child missing-in-a-comment></lr-fixture-child>\`
    export const story = () => html\`<lr-fixture-child .ownValue=\${mentioned} inert></lr-fixture-child>\`;
  `,
});
assert.deepEqual(positive.findings, []);
assert.equal(positive.stats.files, 2);
assert.equal(positive.stats.storyFiles, 1);
assert.equal(positive.stats.templates, 2);
assert.equal(positive.stats.tags, 3);
assert.ok(positive.stats.bindings >= 12);

const negative = analyzeFixture({
  componentSource: `
    import { html } from 'lit';
    export const view = (value: string) => html\`
      <lr-fixture-child .missingProperty=\${value} missing-attribute="yes"></lr-fixture-child>
    \`;
  `,
  storySource: `
    import { html } from 'lit';
    export const story = () => html\`
      <lr-fixture-child story-only-typo="yes"></lr-fixture-child>
    \`;
  `,
});
assert.equal(negative.findings.length, 3);
assert.match(negative.findings.join('\n'), /\.missingProperty/);
assert.match(negative.findings.join('\n'), /missing-attribute/);
assert.match(negative.findings.join('\n'), /story-only-typo/);
assert.match(negative.findings.join('\n'), /fixture-parent\.stories\.ts/);

const privateMember = analyzeFixture({
  componentSource: `
    import { html } from 'lit';
    export const view = (value: string) => html\`
      <lr-fixture-child .privateValue=\${value}></lr-fixture-child>
    \`;
  `,
});
assert.equal(privateMember.findings.length, 1);
assert.match(privateMember.findings[0], /\.privateValue/);

const recursiveSelfComposition = analyzeFixture({
  componentSource: `
    import { html } from 'lit';
    export const view = () => html\`<lr-fixture-child .ownValue=\${'public'}></lr-fixture-child>\`;
  `,
  selfSource: `
    import { html } from 'lit';
    export class FixtureChild {
      private privateValue = '';
      render() {
        return html\`
          <lr-fixture-child
            .privateValue=\${this.privateValue}
            unknown-attribute="still-public-markup"
          ></lr-fixture-child>
        \`;
      }
    }
  `,
});
assert.equal(recursiveSelfComposition.findings.length, 1);
assert.match(recursiveSelfComposition.findings[0], /unknown-attribute/);

const unknownTag = analyzeFixture({
  componentSource: `
    import { html } from 'lit';
    export const view = () => html\`<lr-not-in-manifest value="x"></lr-not-in-manifest>\`;
  `,
});
assert.equal(unknownTag.findings.length, 1);
assert.match(unknownTag.findings[0], /lr-not-in-manifest/);

const zero = analyzeFixture({
  componentSource: `export const selector = '<lr-fixture-child unknown="only text">';`,
});
assert.equal(zero.stats.templates, 0);
assert.equal(zero.stats.tags, 0);
assert.equal(zero.stats.bindings, 0);
assert.match(zero.findings.join('\n'), /nonzero coverage/);

const extracted = extractComposedChildBindings(
  `
    const plain = \`<lr-fixture-child bogus>\`;
    const cssText = css\`:host { display: block; }\`;
    const markup = html\`<lr-fixture-child .ownValue=\${plain}></lr-fixture-child>\`;
  `,
  'fixture.ts',
);
assert.equal(extracted.templates, 1);
assert.deepEqual(extracted.tags.map((entry) => entry.tag), ['lr-fixture-child']);
assert.deepEqual(extracted.tags[0].bindings.map((binding) => binding.name), ['ownValue']);

console.log('composed-child contract checker tests passed');
