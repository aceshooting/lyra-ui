#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  eventContractManifestDeclarations,
  eventCancelabilityFromComponentJsDoc,
  eventNamesFromAuthoredSection,
  eventNamesFromComponentJsDoc,
  findEventContractDrift,
  runtimeEventCancelabilityFromSource,
  sourceEventTypeContracts,
  splitAuthoredEventSections,
} from './check-event-contracts.mjs';
import { createManifestInheritanceFixture } from './fixtures/manifest-inheritance.mjs';
import { compactManifest } from './manifest-compact.mjs';

const sorted = (values) => [...values].sort();

const compactDeclarations = eventContractManifestDeclarations(
  compactManifest(createManifestInheritanceFixture()),
);
const compactChild = compactDeclarations.find(
  ({ declaration }) => declaration.tagName === 'lr-fixture-child',
)?.declaration;
assert.deepEqual(
  compactChild?.events?.map(({ name }) => name),
  ['lr-change', 'lr-ready'],
  'event-contract checks must include inherited events from a compact manifest',
);
assert.equal(
  compactChild?.events?.find(({ name }) => name === 'lr-ready')?.type?.text,
  'CustomEvent<{ ready: boolean }>',
  'event-contract checks must preserve the inherited event detail type',
);

const interfaceFixtureRoot = mkdtempSync(path.join(tmpdir(), 'lyra-event-contracts-'));
try {
  mkdirSync(path.join(interfaceFixtureRoot, 'src'));
  writeFileSync(path.join(interfaceFixtureRoot, 'src', 'fixture.ts'), `
    interface BaseEvents {
      'lr-a': CustomEvent<{ event: 'a' }>;
      'lr-b': CustomEvent<{ event: 'b' }>;
    }
    interface CombinedEvents extends Omit<BaseEvents, 'lr-a'>, Pick<BaseEvents, 'lr-a'> {}
    export class LyraCombined extends LyraElement<CombinedEvents> {}
  `);
  const contracts = sourceEventTypeContracts({
    modules: [{
      path: 'src/fixture.ts',
      declarations: [{
        kind: 'class',
        name: 'LyraCombined',
        customElement: true,
        tagName: 'lr-combined',
        events: [{ name: 'lr-a' }, { name: 'lr-b' }],
      }],
    }],
  }, interfaceFixtureRoot);
  assert.deepEqual(
    contracts.get('lr-combined'),
    {
      'lr-a': "CustomEvent<{ event: 'a' }>",
      'lr-b': "CustomEvent<{ event: 'b' }>",
    },
    'sibling Omit/Pick heritage branches resolve independently instead of sharing cycle state',
  );

  writeFileSync(path.join(interfaceFixtureRoot, 'src', 'unsafe.ts'), `
    interface LyraUnsafeEventMap {
      'lr-unsafe': CustomEvent<unknown | { ready: boolean }>;
    }
    export class LyraUnsafe extends LyraElement<LyraUnsafeEventMap> {}
  `);
  assert.throws(
    () => sourceEventTypeContracts({
      modules: [{
        path: 'src/unsafe.ts',
        declarations: [{
          kind: 'class',
          name: 'LyraUnsafe',
          customElement: true,
          tagName: 'lr-unsafe',
          events: [{ name: 'lr-unsafe' }],
        }],
      }],
    }, interfaceFixtureRoot),
    /source EventMap must publish a concrete type/u,
    'source EventMaps reject top-level unknown unions before CEM projection',
  );
} finally {
  rmSync(interfaceFixtureRoot, { recursive: true, force: true });
}

const source = `
/** A helper whose prose mentions \`lr-not-an-event\`. */
class Helper {}

/**
 * A fixture component.
 * @customElement lr-fixture
 * @event {CustomEvent<{ ready: boolean }>} lr-ready - The fixture became ready.
 * @event focus - The inner control received focus.
 * @event load - The native resource loaded.
 * @event request - The data consumer received a request.
 */
export class LyraFixture {}
`;

assert.deepEqual(
  sorted(eventNamesFromComponentJsDoc(source, 'lr-fixture')),
  ['focus', 'load', 'lr-ready', 'request'],
  'only @event tags from the matching component JSDoc are events',
);

assert.deepEqual(
  [...eventCancelabilityFromComponentJsDoc(`
    /**
     * @customElement lr-cancelability-fixture
     * @event lr-never - Not cancelable. The separate cancelable \`lr-veto\` event is the veto point.
     * @event lr-always - Cancelable; preventDefault() vetoes this event. Unlike non-cancelable \`lr-after\`.
     * @event lr-conditional - Conditionally cancelable: disconnect cleanup cannot be vetoed.
     */
    export class LyraCancelabilityFixture {}
  `, 'lr-cancelability-fixture')],
  [
    ['lr-never', 'never'],
    ['lr-always', 'always'],
    ['lr-conditional', 'conditional'],
  ],
  'cancelability metadata describes the event itself instead of scanning unrelated later prose',
);

assert.deepEqual(
  [...runtimeEventCancelabilityFromSource(`
    class Fixture {
      never() { this.emit('lr-never'); }
      always() { this.emit('lr-always', undefined, { cancelable: true }); }
      sometimes(flag: boolean) {
        this.emit('lr-sometimes');
        if (flag) this.emit('lr-sometimes', undefined, { cancelable: true });
      }
      dynamic(flag: boolean) {
        this.emit('lr-dynamic', undefined, { cancelable: flag });
      }
      transition(open: boolean) {
        const name = open ? 'lr-show' : 'lr-hide';
        if (!this.isConnected) {
          this.emit(name);
          return;
        }
        this.emit(name, undefined, { cancelable: true });
      }
      settle(event: 'lr-after-show' | 'lr-after-hide') { this.emit(event); }
      casted(init: { cancelable: true }) {
        (this as unknown as { emit(name: string, detail: undefined, options: { cancelable: true }): Event })
          .emit('lr-casted', undefined, init);
      }
      decide(next: 'approved' | 'denied') {
        const eventName = next === 'approved' ? 'lr-approve' : 'lr-deny';
        this.emit(eventName, undefined, { cancelable: true });
      }
      unrelated() { other.emit('lr-not-owned', undefined, { cancelable: true }); }
    }
  `)],
  [
    ['lr-after-hide', 'never'],
    ['lr-after-show', 'never'],
    ['lr-always', 'always'],
    ['lr-approve', 'always'],
    ['lr-casted', 'always'],
    ['lr-deny', 'always'],
    ['lr-dynamic', 'conditional'],
    ['lr-hide', 'conditional'],
    ['lr-never', 'never'],
    ['lr-show', 'conditional'],
    ['lr-sometimes', 'conditional'],
  ],
  'runtime cancelability resolves local names and typed event parameters, then combines every reachable call path',
);

assert.deepEqual(
  [...runtimeEventCancelabilityFromSource(`
    class Fixture {
      dynamicFlag = false;
      readonly fixedFlag = true;
      get fixedGetter() { return false; }
      typed(init: { cancelable: true }) { this.emit('lr-typed-init', undefined, init); }
      objectOrder(opts: CustomEventInit) {
        this.emit('lr-spread-last', undefined, { cancelable: false, ...opts });
        this.emit('lr-property-last', undefined, { ...opts, cancelable: false });
        this.emit('lr-duplicate', undefined, { cancelable: false, cancelable: true });
      }
      memberFlags() {
        this.emit('lr-dynamic-member', undefined, { cancelable: this.dynamicFlag });
        this.emit('lr-readonly-member', undefined, { cancelable: this.fixedFlag });
        this.emit('lr-getter-member', undefined, { cancelable: this.fixedGetter });
      }
      template() { this.emit(\`lr-template\`); }
      private forward(name: string) { this.emit(name); }
      caller() { this.forward('lr-forwarded'); }
    }
  `)],
  [
    ['lr-duplicate', 'always'],
    ['lr-dynamic-member', 'conditional'],
    ['lr-forwarded', 'never'],
    ['lr-getter-member', 'never'],
    ['lr-property-last', 'never'],
    ['lr-readonly-member', 'always'],
    ['lr-spread-last', 'conditional'],
    ['lr-template', 'never'],
    ['lr-typed-init', 'always'],
  ],
  'runtime analysis is source-order aware, resolves typed init/helper calls, and folds only invariant members',
);

assert.throws(
  () => runtimeEventCancelabilityFromSource(`
    class Fixture {
      opaque(options: CustomEventInit) { this.emit('lr-opaque', undefined, options); }
    }
  `),
  /unresolved EventInit.*lr-opaque/u,
  'an opaque EventInit cannot silently disappear from runtime cancelability checks',
);

assert.throws(
  () => runtimeEventCancelabilityFromSource(`
    class Fixture {
      dynamic(kind: string) { this.emit(\`lr-\${kind}\`); }
    }
  `),
  /statically resolve.*event name/u,
  'a dynamic emitted name cannot silently disappear from runtime event checks',
);

assert.deepEqual(
  [...runtimeEventCancelabilityFromSource(`
    class Fixture {
      lexical() {
        const name = 'lr-outer';
        this.emit(name);
        {
          const name = 'lr-inner';
          this.emit(name, undefined, { cancelable: true });
        }
      }
      reassigned() {
        let name = 'lr-first';
        this.emit(name);
        name = 'lr-second';
        this.emit(name, undefined, { cancelable: true });
      }
      nestedInit(init: { cancelable: true }) {
        this.emit('lr-outer-init', undefined, init);
        (() => {
          const init = { cancelable: false };
          this.emit('lr-inner-init', undefined, init);
        })();
      }
    }
  `)],
  [
    ['lr-first', 'never'],
    ['lr-inner', 'always'],
    ['lr-inner-init', 'never'],
    ['lr-outer', 'never'],
    ['lr-outer-init', 'always'],
    ['lr-second', 'always'],
  ],
  'runtime bindings honor lexical shadowing, source-order assignment, and callable-local EventInit types',
);

assert.throws(
  () => runtimeEventCancelabilityFromSource(`
    class Fixture {
      private forward(name: string) { this.emit(name); }
      caller(dynamic: string) {
        this.forward('lr-known');
        this.forward(dynamic);
      }
    }
  `),
  /statically resolve.*event name/u,
  'one literal call cannot hide a dynamic path through the same private forwarding helper',
);

assert.throws(
  () => runtimeEventCancelabilityFromSource(`
    class Fixture {
      forward(name: string) { this.emit(name); }
      caller() { this.forward('lr-known'); }
    }
  `),
  /statically resolve.*event name/u,
  'public forwarding helpers remain open to arbitrary external event names',
);

assert.deepEqual(
  [...runtimeEventCancelabilityFromSource(`
    class Fixture {
      readonly fixed = true;
      readonly assigned = true;
      constructor(value: boolean) { this.assigned = value; }
      memberFlags() {
        this.emit('lr-fixed', undefined, { cancelable: this.fixed });
        this.emit('lr-assigned', undefined, { cancelable: this.assigned });
        class Nested {
          readonly fixed = false;
          nested() { this.emit('lr-nested', undefined, { cancelable: this.fixed }); }
        }
      }
    }
  `)],
  [
    ['lr-assigned', 'conditional'],
    ['lr-fixed', 'always'],
  ],
  'readonly folding is class-local and invalidated by a declaring-constructor write',
);

assert.deepEqual(
  [...runtimeEventCancelabilityFromSource(`
    class Fixture {
      computed(key: string, cancelable: string) {
        this.emit('lr-dynamic-key', undefined, { [key]: true });
        this.emit('lr-template-key', undefined, { [\`cancelable\`]: true });
        this.emit('lr-identifier-key', undefined, { [cancelable]: true });
      }
    }
  `)],
  [
    ['lr-dynamic-key', 'conditional'],
    ['lr-identifier-key', 'conditional'],
    ['lr-template-key', 'always'],
  ],
  'computed EventInit keys resolve only from static values, never identifier source spelling',
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
  sorted(eventNamesFromAuthoredSection(`
    ## \`lr-native-relay\`
    **Events:** \`load\`, \`error\`, \`play\`, \`request\`, and \`timeupdate\`.
  `)),
  ['error', 'load', 'play', 'request', 'timeupdate'],
  'explicit native relay names and the reviewed data request event are valid authored events',
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

const typeDrift = findEventContractDrift({
  components: [
    {
      tag: 'lr-typed',
      className: 'LyraTyped',
      sourceFile: 'src/components/fixture/typed.class.ts',
      eventMapName: 'LyraTypedEventMap',
      directEventMapEvents: new Set(['lr-ready', 'lr-unsafe']),
      effectiveEventMapEvents: new Set(['lr-ready', 'lr-unsafe']),
      directEventMapTypes: new Map([
        ['lr-ready', 'CustomEvent<{ ready: boolean }>'],
        ['lr-unsafe', 'CustomEvent<any>'],
      ]),
      effectiveEventMapTypes: new Map([
        ['lr-ready', 'CustomEvent<{ ready: boolean }>'],
        ['lr-unsafe', 'CustomEvent<any>'],
      ]),
      jsdocEvents: new Set(['lr-ready', 'lr-unsafe']),
      jsdocEventTypes: new Map([
        ['lr-ready', 'CustomEvent<{ ready: string }>'],
        ['lr-unsafe', 'CustomEvent<any>'],
      ]),
      cemEvents: new Set(['lr-ready', 'lr-unsafe']),
      cemEventTypes: new Map([
        ['lr-ready', 'CustomEvent<{ ready: number }>'],
        ['lr-unsafe', 'CustomEvent<any>'],
      ]),
    },
  ],
  authoredSections: [{
    file: 'llms/fixture.md',
    title: '`lr-typed`',
    tags: ['lr-typed'],
    events: new Set(['lr-ready', 'lr-unsafe']),
  }],
});

assert.deepEqual(
  typeDrift.map(({ code, event }) => `${code}:${event}`).sort(),
  [
    'cem-event-type-any:lr-unsafe',
    'cem-event-type-mismatch:lr-ready',
    'eventmap-event-type-any:lr-unsafe',
    'jsdoc-event-type-any:lr-unsafe',
    'jsdoc-event-type-mismatch:lr-ready',
  ],
  'event detail types reject any and stay aligned across EventMap, JSDoc, and CEM',
);

const implicitAnyDrift = findEventContractDrift({
  components: [
    {
      tag: 'lr-implicit-any',
      className: 'LyraImplicitAny',
      sourceFile: 'src/components/fixture/implicit-any.class.ts',
      eventMapName: 'LyraImplicitAnyEventMap',
      directEventMapEvents: new Set(['lr-bare', 'lr-literal-any', 'lr-property-any']),
      effectiveEventMapEvents: new Set(['lr-bare', 'lr-literal-any', 'lr-property-any']),
      directEventMapTypes: new Map([
        ['lr-bare', 'CustomEvent'],
        ['lr-literal-any', "CustomEvent<{ mode: 'any' | 'all' }>"],
        ['lr-property-any', 'CustomEvent<{ any: string }>'],
      ]),
      effectiveEventMapTypes: new Map([
        ['lr-bare', 'CustomEvent'],
        ['lr-literal-any', "CustomEvent<{ mode: 'any' | 'all' }>"],
        ['lr-property-any', 'CustomEvent<{ any: string }>'],
      ]),
      jsdocEvents: new Set(['lr-bare', 'lr-literal-any', 'lr-property-any']),
      jsdocEventTypes: new Map([
        ['lr-bare', 'CustomEvent'],
        ['lr-literal-any', "CustomEvent<{ mode: 'any' | 'all' }>"],
        ['lr-property-any', 'CustomEvent<{ any: string }>'],
      ]),
      cemEvents: new Set(['lr-bare', 'lr-literal-any', 'lr-property-any']),
      cemEventTypes: new Map([
        ['lr-bare', 'CustomEvent'],
        ['lr-literal-any', "CustomEvent<{ mode: 'any' | 'all' }>"],
        ['lr-property-any', 'CustomEvent<{ any: string }>'],
      ]),
    },
  ],
  authoredSections: [{
    file: 'llms/fixture.md',
    title: '`lr-implicit-any`',
    tags: ['lr-implicit-any'],
    events: new Set(['lr-bare', 'lr-literal-any', 'lr-property-any']),
  }],
});

assert.deepEqual(
  implicitAnyDrift.map(({ code, event }) => `${code}:${event}`).sort(),
  [
    'cem-event-type-any:lr-bare',
    'eventmap-event-type-any:lr-bare',
    'jsdoc-event-type-any:lr-bare',
  ],
  'bare CustomEvent is implicit-any while quoted discriminators and property keys remain concrete',
);

const unknownUnionDrift = findEventContractDrift({
  components: [{
    tag: 'lr-unknown-union',
    className: 'LyraUnknownUnion',
    sourceFile: 'src/components/fixture/unknown-union.class.ts',
    eventMapName: 'LyraUnknownUnionEventMap',
    directEventMapEvents: new Set(['lr-unsafe', 'lr-nested']),
    effectiveEventMapEvents: new Set(['lr-unsafe', 'lr-nested']),
    directEventMapTypes: new Map([
      ['lr-unsafe', 'CustomEvent<unknown | { ready: boolean }>'],
      ['lr-nested', 'CustomEvent<{ error: unknown }>'],
    ]),
    effectiveEventMapTypes: new Map([
      ['lr-unsafe', 'CustomEvent<unknown | { ready: boolean }>'],
      ['lr-nested', 'CustomEvent<{ error: unknown }>'],
    ]),
    jsdocEvents: new Set(['lr-unsafe', 'lr-nested']),
    jsdocEventTypes: new Map([
      ['lr-unsafe', 'CustomEvent<unknown | { ready: boolean }>'],
      ['lr-nested', 'CustomEvent<{ error: unknown }>'],
    ]),
    cemEvents: new Set(['lr-unsafe', 'lr-nested']),
    cemEventTypes: new Map([
      ['lr-unsafe', 'CustomEvent<unknown | { ready: boolean }>'],
      ['lr-nested', 'CustomEvent<{ error: unknown }>'],
    ]),
  }],
  authoredSections: [{
    file: 'llms/fixture.md',
    title: '`lr-unknown-union`',
    tags: ['lr-unknown-union'],
    events: new Set(['lr-unsafe', 'lr-nested']),
  }],
});

assert.deepEqual(
  unknownUnionDrift.map(({ code, event }) => `${code}:${event}`).sort(),
  [
    'cem-event-type-unknown:lr-unsafe',
    'eventmap-event-type-unknown:lr-unsafe',
    'jsdoc-event-type-unknown:lr-unsafe',
  ],
  'top-level unknown unions fail closed while unknown inside a concrete detail field remains valid',
);

const runtimeSurfaceDrift = findEventContractDrift({
  components: [{
    tag: 'lr-runtime-only',
    className: 'LyraRuntimeOnly',
    sourceFile: 'src/components/fixture/runtime-only.class.ts',
    directEventMapEvents: new Set(),
    effectiveEventMapEvents: new Set(),
    jsdocEvents: new Set(),
    cemEvents: new Set(),
    runtimeEventCancelability: new Map([['lr-runtime-only-event', 'never']]),
    unresolvedRuntimeEmitCalls: 1,
  }],
  authoredSections: [{
    file: 'llms/fixture.md',
    title: '`lr-runtime-only`',
    tags: ['lr-runtime-only'],
    events: new Set(),
  }],
});

assert.deepEqual(
  runtimeSurfaceDrift.map(({ code, event }) => `${code}:${event}`).sort(),
  [
    'runtime-event-missing-cem:lr-runtime-only-event',
    'runtime-event-missing-jsdoc:lr-runtime-only-event',
    'runtime-event-name-unresolved:<dynamic>',
    'runtime-event-untyped:lr-runtime-only-event',
  ],
  'runtime emissions fail closed when their name is unresolved or absent from a public surface',
);

const cancelabilityDrift = findEventContractDrift({
  components: [
    {
      tag: 'lr-runtime-contract',
      className: 'LyraRuntimeContract',
      sourceFile: 'src/components/fixture/runtime-contract.class.ts',
      eventMapName: 'LyraRuntimeContractEventMap',
      directEventMapEvents: new Set(['lr-always', 'lr-never', 'lr-conditional']),
      effectiveEventMapEvents: new Set(['lr-always', 'lr-never', 'lr-conditional']),
      jsdocEvents: new Set(['lr-always', 'lr-never', 'lr-conditional']),
      jsdocEventCancelability: new Map([
        ['lr-always', 'always'],
        ['lr-never', 'always'],
        ['lr-conditional', 'conditional'],
      ]),
      cemEvents: new Set(['lr-always', 'lr-never', 'lr-conditional']),
      cemEventCancelability: new Map([
        ['lr-always', 'never'],
        ['lr-never', 'never'],
        ['lr-conditional', 'always'],
      ]),
      runtimeEventCancelability: new Map([
        ['lr-always', 'always'],
        ['lr-never', 'never'],
        ['lr-conditional', 'conditional'],
      ]),
    },
  ],
  authoredSections: [{
    file: 'llms/fixture.md',
    title: '`lr-runtime-contract`',
    tags: ['lr-runtime-contract'],
    events: new Set(['lr-always', 'lr-never', 'lr-conditional']),
  }],
});

assert.deepEqual(
  cancelabilityDrift.map(({ code, event }) => `${code}:${event}`).sort(),
  [
    'cem-event-cancelability-mismatch:lr-always',
    'cem-event-cancelability-mismatch:lr-conditional',
    'jsdoc-event-cancelability-mismatch:lr-never',
  ],
  'runtime emit options are authoritative over stale or ambiguous cancelability prose',
);

console.log('Event-contract checker self-tests passed.');
