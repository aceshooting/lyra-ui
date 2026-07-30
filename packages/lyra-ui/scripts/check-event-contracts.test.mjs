#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  eventNamesFromAuthoredSection,
  eventNamesFromComponentJsDoc,
  findEventContractDrift,
  splitAuthoredEventSections,
} from './check-event-contracts.mjs';

const sorted = (values) => [...values].sort();

const source = `
/** A helper whose prose mentions \`lr-not-an-event\`. */
class Helper {}

/**
 * A fixture component.
 * @customElement lr-fixture
 * @event {CustomEvent<{ ready: boolean }>} lr-ready - The fixture became ready.
 * @event focus - The inner control received focus.
 */
export class LyraFixture {}
`;

assert.deepEqual(
  sorted(eventNamesFromComponentJsDoc(source, 'lr-fixture')),
  ['focus', 'lr-ready'],
  'only @event tags from the matching component JSDoc are events',
);

const authored = `
## \`lr-fixture\`

The \`lr-not-an-event\` property is unrelated.

**Events:**
- \`lr-ready\` — emitted when ready inside \`lr-child-one\` or \`lr-child-two\`.
- \`focus\` — bridged from the inner control.

Later lifecycle prose mentions \`lr-late-component\`, but does not declare it as an event.

**Slots:** \`lr-slot-shaped-text\` is still not an event.
`;

assert.deepEqual(
  sorted(eventNamesFromAuthoredSection(authored)),
  ['focus', 'lr-ready'],
  'the authored parser is limited to the Events contract block',
);

assert.deepEqual(
  sorted(
    eventNamesFromAuthoredSection(`
      ## \`lr-button-fixture\`
      **Events:** none (an ordinary native \`click\` still bubbles).
    `),
  ),
  [],
  'an explicit none contract does not turn a native click explanation into a component event',
);

assert.deepEqual(
  sorted(
    eventNamesFromAuthoredSection(`
      ## \`lr-composed-fixture\`
      **Events:** composed child events bubble unchanged: \`lr-ready\`, then \`focus\`.
    `),
  ),
  ['focus', 'lr-ready'],
  'a prose lead-in inside an explicit Events block can introduce a declaration list',
);

const [authoredAfterFence] = splitAuthoredEventSections(`
## \`lr-after-fence\`

\`\`\`html
<lr-after-fence></lr-after-fence>
\`\`\`

A property example uses the valid Markdown span \`\` \`value\` \`\`.
A formatter example uses \`(value) => \\\`formatted\\\`\`.

**Events:** \`lr-ready\` (\`detail: {
  ready: boolean
}\`), then \`focus\`.
`);

assert.deepEqual(
  sorted(authoredAfterFence.mentionedEvents),
  ['focus', 'lr-ready'],
  'only the explicit Events block counts, and fenced examples do not consume later event mentions',
);

const positive = findEventContractDrift({
  components: [
    {
      tag: 'lr-fixture',
      className: 'LyraFixture',
      sourceFile: 'src/components/fixture/fixture.class.ts',
      eventMapName: 'LyraFixtureEventMap',
      directEventMapEvents: new Set(['lr-ready', 'focus']),
      effectiveEventMapEvents: new Set(['lr-ready', 'focus', 'lr-shared']),
      jsdocEvents: new Set(['lr-ready', 'focus']),
      cemEvents: new Set(['lr-ready', 'focus']),
    },
  ],
  authoredSections: [
    {
      file: 'llms/fixture.md',
      title: '`lr-fixture`',
      tags: ['lr-fixture'],
      events: new Set(['lr-ready', 'focus']),
    },
  ],
});

assert.deepEqual(
  positive,
  [],
  'matching direct EventMap/JSDoc/CEM/authored events pass while an inherited shared event may stay documented once',
);

const negative = findEventContractDrift({
  components: [
    {
      tag: 'lr-broken',
      className: 'LyraBroken',
      sourceFile: 'src/components/fixture/broken.class.ts',
      eventMapName: 'LyraBrokenEventMap',
      directEventMapEvents: new Set(['lr-ready', 'lr-map-only']),
      effectiveEventMapEvents: new Set(['lr-ready', 'lr-map-only']),
      jsdocEvents: new Set(['lr-ready', 'lr-untyped']),
      cemEvents: new Set(['lr-ready', 'lr-cem-only']),
    },
  ],
  authoredSections: [
    {
      file: 'llms/fixture.md',
      title: '`lr-broken`',
      tags: ['lr-broken'],
      events: new Set(['lr-ready', 'lr-doc-only']),
    },
  ],
});

assert.deepEqual(
  negative.map(({ code, event }) => `${code}:${event}`).sort(),
  [
    'authored-event-missing-cem:lr-doc-only',
    'cem-event-missing-authored:lr-cem-only',
    'cem-event-missing-jsdoc:lr-cem-only',
    'cem-event-untyped:lr-cem-only',
    'eventmap-event-missing-cem:lr-map-only',
    'eventmap-event-missing-jsdoc:lr-map-only',
    'jsdoc-event-missing-cem:lr-untyped',
    'jsdoc-event-untyped:lr-untyped',
  ],
  'every map-only, advertised-only, CEM-only, and authored-only direction is diagnosed',
);

assert.ok(
  negative.every(({ message }) => /lr-broken|llms\/fixture\.md/.test(message)),
  'each diagnostic identifies the component or authored file that needs correction',
);

console.log('Event-contract checker self-tests passed.');
