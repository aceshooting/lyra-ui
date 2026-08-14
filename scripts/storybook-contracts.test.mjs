import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStorybookDocsAuditPlan,
  findStoryOwnershipFailures,
  manifestTagNames,
  resolveStoryOwnerDocs,
  storyOwnerFromSource,
} from './storybook-contracts.mjs';

test('extracts the component owner only from the default Meta object', () => {
  const source = `
    const meta: Meta = {
      title: 'Forms/Checkbox',
      component: 'lr-checkbox',
      parameters: { docs: { description: { component: 'description' } } },
    };
    export default meta;
    export const Default = { render: () => html\`<lr-checkbox></lr-checkbox>\` };
  `;

  assert.deepEqual(storyOwnerFromSource(source, './checkbox.stories.ts'), {
    tag: 'lr-checkbox',
    importPath: './checkbox.stories.ts',
  });
});

test('reports a duplicate and a missing owner even when the totals are equal', () => {
  const failures = findStoryOwnershipFailures(
    ['lr-alpha', 'lr-beta'],
    [
      { tag: 'lr-alpha', importPath: './alpha-a.stories.ts' },
      { tag: 'lr-alpha', importPath: './alpha-b.stories.ts' },
    ]
  );

  assert.ok(failures.some((failure) => failure.includes('lr-beta') && failure.includes('missing')));
  assert.ok(
    failures.some((failure) => failure.includes('lr-alpha') && failure.includes('duplicate'))
  );
});

test('reads every declared custom-element tag from the manifest once', () => {
  assert.deepEqual(
    manifestTagNames({
      modules: [
        { declarations: [{ tagName: 'lr-beta' }, { kind: 'class' }] },
        { declarations: [{ tagName: 'lr-alpha' }, { tagName: 'lr-beta' }] },
      ],
    }),
    ['lr-alpha', 'lr-beta']
  );
});

test('resolves each owner to one exact Storybook docs import', () => {
  const owners = [{ tag: 'lr-alpha', importPath: './src/alpha.stories.ts' }];
  const entries = [
    { id: 'alpha--docs', type: 'docs', importPath: './src/alpha.stories.ts' },
    { id: 'guide--docs', type: 'docs', importPath: './src/guide.stories.ts' },
  ];

  assert.deepEqual(resolveStoryOwnerDocs(entries, owners), {
    docs: [{ entry: entries[0], expectedTag: 'lr-alpha' }],
    failures: [],
  });

  assert.match(
    resolveStoryOwnerDocs(entries, [{ tag: 'lr-alpha', importPath: './src/wrong.stories.ts' }])
      .failures[0],
    /exact docs import/i
  );
});

test('plans one docs navigation per owner while retaining every layout matrix', () => {
  const entries = [
    { entry: { id: 'alpha--docs' }, expectedTag: 'lr-alpha' },
    { entry: { id: 'beta--docs' }, expectedTag: 'lr-beta' },
  ];

  const plan = buildStorybookDocsAuditPlan(entries);

  assert.equal(plan.length, 2);
  assert.deepEqual(
    plan[0].matrices.map(({ name, width, direction }) => ({ name, width, direction })),
    [
      { name: 'desktop', width: 980, direction: 'ltr' },
      { name: 'narrow', width: 390, direction: 'ltr' },
      { name: 'narrow-rtl', width: 390, direction: 'rtl' },
    ]
  );
  assert.equal(
    plan.reduce((total, audit) => total + audit.matrices.length, 0),
    6
  );
});
