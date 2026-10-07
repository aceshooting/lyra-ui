import { buildMirrorMap } from '../migrate-wa.mjs';
import { reviewedAccessibilityMetadata } from './accessibility.mjs';
import { reviewedTypeEquivalences, normalizedNormalizations, reviewedMappingNormalizations, hasReviewedMappingNormalizations } from './mapping-normalizations.mjs';
import { REWRITE_RULE_SECTIONS, compareMappedSurfaces, deriveStaticApiReviewStatus, emptyRewrites } from '../component-inventory.mjs';

const REQUIRED_TARGETS = new Map([
  ['sl-alert', 'lr-alert'],
  ['sl-split-panel', 'lr-split-panel'],
  ['wa-data-grid', 'lr-data-grid'],
  ['wa-page', 'lr-page'],
  ['wa-split-panel', 'lr-split-panel'],
  ['wa-video', 'lr-video'],
  ['wa-video-playlist', 'lr-video-playlist'],
]);

const INCLUDE_SECURITY_DRIFT = [
  { code: 'missing-attribute', section: 'attributes', member: 'allow-scripts' },
  {
    code: 'default-mismatch',
    section: 'attributes',
    member: 'mode',
    expected: 'cors',
    actual: 'same-origin',
  },
  { code: 'missing-property', section: 'properties', member: 'allowScripts' },
];

const CAROUSEL_EVENT_DETAIL_DRIFT = (member) => [
  {
    code: 'event-type-mismatch',
    section: 'events',
    member,
    expected: '{ index: number, slide: LyraCarouselItem }',
    actual: 'CustomEvent<{ index: number; slide: HTMLElement }>',
  },
];

const WA_CAROUSEL_V9_DRIFT = [
  { code: 'missing-attribute', section: 'attributes', member: 'slides' },
  ...CAROUSEL_EVENT_DETAIL_DRIFT('wa-slide-change'),
  {
    code: 'readonly-mismatch',
    section: 'properties',
    member: 'slides',
    expected: false,
    actual: true,
  },
];

const WA_VIDEO_PLAYING_DRIFT = [
  { code: 'missing-attribute', section: 'attributes', member: 'playing' },
  { code: 'readonly-mismatch', section: 'properties', member: 'playing', expected: false, actual: true },
];

const WA_RANDOM_CONTENT_V9_DRIFT = [
  {
    code: 'event-type-mismatch',
    section: 'events',
    member: 'wa-content-change',
    expected: '{ items: Element[] }',
    actual: 'CustomEvent<{ readonly items: readonly Element[] }>',
  },
  {
    code: 'method-signature-mismatch',
    section: 'methods',
    member: 'randomize',
    expected: [{ parameters: [], returnType: 'Element[]' }],
    actual: [{ parameters: [], returnType: 'readonly Element[]' }],
  },
];

const immutableTreeSelectionDrift = (member) => [
  {
    code: 'event-type-mismatch',
    section: 'events',
    member,
    expected: '{ selection: LyraTreeItem[] }',
    actual:
      'CustomEvent< LyraEventDetailSnapshot<{ readonly selection: readonly LyraTreeItem[] }> >',
  },
];

const WA_DATA_GRID_V9_DRIFT = [
  {
    code: 'type-mismatch',
    section: 'attributes',
    member: 'child-rows',
    expected: 'string | ((row: Row) => Row[] | undefined) | null',
    actual: '| string | ((row: Row) => readonly Row[] | undefined) | null',
  },
  {
    code: 'type-mismatch',
    section: 'attributes',
    member: 'group-by',
    expected: 'string | string[] | null',
    actual: 'string | readonly string[] | null',
  },
  {
    code: 'event-type-mismatch',
    section: 'events',
    member: 'request',
    expected: 'Event',
    actual: 'CustomEvent<LyraEventDetailSnapshot<DataGridRequest>>',
  },
  {
    code: 'event-type-mismatch',
    section: 'events',
    member: 'wa-column-move',
    expected: 'Event',
    actual: 'CustomEvent<LyraEventDetailSnapshot<DataGridColumnMoveDetail>>',
  },
  {
    code: 'event-type-mismatch',
    section: 'events',
    member: 'wa-data-error',
    expected: 'Event',
    actual: 'CustomEvent<LyraEventDetailSnapshot<DataGridDataErrorDetail>>',
  },
  {
    code: 'missing-event',
    section: 'events',
    member: 'wa-data-request',
  },
  {
    code: 'event-type-mismatch',
    section: 'events',
    member: 'wa-filter-change',
    expected: 'Event',
    actual:
      'CustomEvent<Readonly<{ filters: readonly DataGridFilter[] }>>',
  },
  {
    code: 'event-type-mismatch',
    section: 'events',
    member: 'wa-row-select',
    expected: 'Event',
    actual: 'CustomEvent<Readonly<DataGridSelectionDetail<Row>>>',
  },
  {
    code: 'event-type-mismatch',
    section: 'events',
    member: 'wa-sort-change',
    expected: 'Event',
    actual: 'CustomEvent<Readonly<{ sort: DataGridSortingState }>>',
  },
  {
    code: 'type-mismatch',
    section: 'properties',
    member: 'columnOrder',
    expected: 'string[]',
    actual: 'readonly string[]',
  },
  {
    code: 'type-mismatch',
    section: 'properties',
    member: 'columns',
    expected: 'DataGridColumn[]',
    actual: 'readonly DataGridColumn<Row>[]',
  },
  {
    code: 'type-mismatch',
    section: 'properties',
    member: 'data',
    expected: 'Row[]',
    actual: 'readonly Row[]',
  },
  {
    code: 'type-mismatch',
    section: 'properties',
    member: 'expandedKeys',
    expected: '(string | number)[]',
    actual: 'readonly DataGridKey[]',
  },
  {
    code: 'type-mismatch',
    section: 'properties',
    member: 'filters',
    expected: '{ id: string; value: unknown }[]',
    actual: 'readonly DataGridFilter[]',
  },
  {
    code: 'type-mismatch',
    section: 'properties',
    member: 'pageSizeOptions',
    expected: 'number[]',
    actual: 'readonly number[]',
  },
  {
    code: 'type-mismatch',
    section: 'properties',
    member: 'selectedKeys',
    expected: '(string | number)[]',
    actual: 'readonly DataGridKey[]',
  },
  {
    code: 'type-mismatch',
    section: 'properties',
    member: 'selectedRows',
    expected: 'Row[]',
    actual: 'readonly Row[]',
  },
];

const WA_FILE_INPUT_V9_DRIFT = [
  {
    code: 'readonly-mismatch',
    section: 'properties',
    member: 'dragging',
    expected: false,
    actual: true,
  },
  {
    code: 'readonly-mismatch',
    section: 'properties',
    member: 'fileCount',
    expected: false,
    actual: true,
  },
];

const shoelaceLifecycleCancelabilityDrift = (hideCancelable) => [
  {
    code: 'cancelability-mismatch',
    section: 'events',
    member: 'sl-hide',
    expected: 'never',
    actual: hideCancelable,
  },
  {
    code: 'cancelability-mismatch',
    section: 'events',
    member: 'sl-show',
    expected: 'never',
    actual: 'always',
  },
];

const SHOELACE_LIFECYCLE_CANCELABILITY_RATIONALE =
  'Pinned runtime evidence shows Shoelace emits non-cancelable state-change lifecycle notifications while Lyra provides synchronous pre-state veto events; automatic migration therefore requires review of listener timing and preventDefault() behavior.';

const SL_SPLIT_PANEL_MODULE_EXPORT_DRIFT = [
  {
    code: 'type-mismatch',
    section: 'attributes',
    member: 'snap',
    expected: 'string | SnapFunction',
    actual: 'string | LyraSplitPanelSnapFunction | undefined',
  },
  {
    code: 'module-export-signature-mismatch',
    section: 'moduleExports',
    member: 'SNAP_NONE',
    module: 'components/split-panel/split-panel.js',
    expected: [
      {
        parameters: [],
        returnType: 'unspecified-public-documentation',
      },
    ],
    actual: [
      [
        {
          parameters: [
            {
              name: '{ pos }',
              type: 'unknown',
              optional: false,
              hasDefault: false,
            },
          ],
          returnType: 'unknown',
        },
      ],
    ],
  },
];

const DECISION_OVERRIDES = new Map([
  ...['wa-radio-group', 'wa-switch'].map((tag) => [
    tag,
    {
      classification: 'warning-required',
      rationale:
        'Native input notifications are Event instances. Migrated handlers must not require InputEvent-specific fields.',
      expectedDrift: [
        { code: 'event-constructor-mismatch', section: 'events', member: 'input', expected: 'InputEvent', actual: 'Event' },
        { code: 'event-type-mismatch', section: 'events', member: 'input', expected: 'InputEvent', actual: 'Event' },
      ],
    },
  ]),
  [
    'sl-split-panel',
    {
      classification: 'warning-required',
      rationale:
        'The published Shoelace manifest exports SNAP_NONE without documenting its callable signature; Lyra exports the same helper with an explicit typed parameter, so the tag rewrite remains available but consumers that call the helper require review. Lyra also renamed its own SnapFunction export to LyraSplitPanelSnapFunction (a Lyra-original type, not part of the Shoelace public surface) as part of the 9.0.0 Lyra*-prefix harmonization.',
      expectedDrift: SL_SPLIT_PANEL_MODULE_EXPORT_DRIFT,
    },
  ],
  ...[
    ['sl-alert', 'always'],
    ['sl-dialog', 'conditional'],
    ['sl-drawer', 'always'],
    ['sl-dropdown', 'always'],
    ['sl-tooltip', 'always'],
  ].map(([tag, hideCancelable]) => [
    tag,
    {
      classification: 'warning-required',
      rationale: SHOELACE_LIFECYCLE_CANCELABILITY_RATIONALE,
      expectedDrift: shoelaceLifecycleCancelabilityDrift(hideCancelable),
    },
  ]),
  [
    'sl-checkbox',
    {
      classification: 'warning-required',
      rationale:
        'Lyra uses the checked attribute as the reset default while Shoelace reflects the live checked state; migration leaves the use unchanged and reports the reflection-sensitive CSS, observer, serialization, and property-write difference.',
      expectedDrift: [],
    },
  ],
  [
    'sl-carousel',
    {
      classification: 'warning-required',
      rationale:
        'Lyra accepts arbitrary HTMLElement slides, so its slide-change detail is wider than the upstream carousel-item class; migrated handlers that rely on item-specific members require review.',
      expectedDrift: CAROUSEL_EVENT_DETAIL_DRIFT('sl-slide-change'),
    },
  ],
  [
    'wa-carousel',
    {
      classification: 'warning-required',
      rationale:
        'Lyra accepts arbitrary HTMLElement slides, so its slide-change detail is wider than the upstream carousel-item class; in v9 the slides member is a read-only live composition count rather than a writable reflected attribute. Migrated handlers that rely on item-specific members or write slides require review.',
      expectedDrift: WA_CAROUSEL_V9_DRIFT,
    },
  ],
  [
    'wa-markdown',
    {
      classification: 'warning-required',
      rationale:
        'The source and target light-DOM Markdown content models and optional-peer runtime requirements are not mechanically equivalent; migration leaves the use unchanged and reports the required review.',
      expectedDrift: [],
    },
  ],
  [
    'wa-data-grid',
    {
      classification: 'warning-required',
      rationale:
        'Lyra snapshots collection inputs and event details synchronously into frozen readonly values, and removes the redundant wa-data-request alias in favor of the typed request event. Migrated code that mutates arrays or event details in place, assigns derived collections, or listens for the removed alias must be reviewed.',
      expectedDrift: WA_DATA_GRID_V9_DRIFT,
    },
  ],
  [
    'wa-random-content',
    {
      classification: 'warning-required',
      rationale:
        'Lyra returns frozen readonly selection snapshots instead of mutable arrays. The migrator also reports the exercised behavior differences: host and multi-item layout, bounded unique selection, forwarded-slot candidates, and autoplay semantics.',
      expectedDrift: WA_RANDOM_CONTENT_V9_DRIFT,
    },
  ],
  [
    'wa-video',
    {
      classification: 'warning-required',
      rationale:
        'Lyra exposes playing as read-only live state that is reflected but not observed as an attribute; migrated code that assigned playing or authored the playing attribute must call play() or pause() instead.',
      expectedDrift: WA_VIDEO_PLAYING_DRIFT,
    },
  ],
  ...[
    ['sl-tree', 'sl-selection-change'],
    ['wa-tree', 'wa-selection-change'],
  ].map(([tag, member]) => [
    tag,
    {
      classification: 'warning-required',
      rationale:
        'Lyra freezes each selection snapshot and exposes it as readonly so listeners cannot mutate component-owned selection state. Migrated handlers that modify the event array in place must create their own copy.',
      expectedDrift: immutableTreeSelectionDrift(member),
    },
  ]),
  [
    'wa-file-input',
    {
      classification: 'warning-required',
      rationale:
        'Lyra exposes dragging and fileCount as getter-only derived state. Migrated code that assigned either upstream field must instead drive them through drag interaction or the selected-files input contract.',
      expectedDrift: WA_FILE_INPUT_V9_DRIFT,
    },
  ],
  [
    'wa-include',
    {
      classification: 'warning-required',
      rationale:
        'Lyra intentionally sanitizes included markup and keeps a same-origin default; uses that depend on cross-origin or script-executing behavior require an explicit security warning rather than a silent rename.',
      expectedDrift: INCLUDE_SECURITY_DRIFT,
    },
  ],
  [
    'sl-include',
    {
      classification: 'warning-required',
      rationale:
        'Lyra intentionally sanitizes included markup and keeps a same-origin default; uses that depend on cross-origin or script-executing behavior require an explicit security warning rather than a silent rename.',
      // 8.0.0: lr-include gained the upstream-compatible `lr-error` alias alongside its canonical
      // `lr-include-error`, so `sl-error` is no longer missing and this drift now matches
      // wa-include's exactly. The remaining entries are the deliberate security divergence.
      expectedDrift: INCLUDE_SECURITY_DRIFT,
    },
  ],
  [
    'wa-zoomable-frame',
    {
      classification: 'warning-required',
      rationale:
        'Lyra always renders a sandbox with an `allow-same-origin` default, rejects active and non-embeddable URL schemes, and drops `allow-same-origin` when paired with `allow-scripts`; migration leaves the use unchanged and reports the security-sensitive difference.',
      expectedDrift: [],
    },
  ],
  [
    'sl-resize-observer',
    {
      classification: 'warning-required',
      rationale:
        'Lyra freezes the entries array into an immutable snapshot at dispatch time; migrated code that mutates the array in place must create its own copy.',
      expectedDrift: [
        {
          code: 'event-type-mismatch',
          section: 'events',
          member: 'sl-resize',
          expected: '{ entries: ResizeObserverEntry[] }',
          actual:
            'CustomEvent< Readonly<{ entries: readonly ResizeObserverEntry[] }> >',
        },
      ],
    },
  ],
  [
    'wa-accordion',
    {
      classification: 'warning-required',
      rationale:
        'Lyra snapshots each expand/collapse event detail into a frozen readonly value at dispatch time rather than exposing a live mutable item reference; migrated handlers that mutate the event detail in place must be reviewed.',
      expectedDrift: [
        {
          code: 'event-type-mismatch',
          section: 'events',
          member: 'wa-after-collapse',
          expected: '{ item: LyraAccordionItem }',
          actual:
            'CustomEvent<LyraEventDetailSnapshot<LyraAccordionEventDetail>>',
        },
        {
          code: 'event-type-mismatch',
          section: 'events',
          member: 'wa-after-expand',
          expected: '{ item: LyraAccordionItem }',
          actual:
            'CustomEvent<LyraEventDetailSnapshot<LyraAccordionEventDetail>>',
        },
        {
          code: 'event-type-mismatch',
          section: 'events',
          member: 'wa-collapse',
          expected: '{ item: LyraAccordionItem }',
          actual:
            'CustomEvent<LyraEventDetailSnapshot<LyraAccordionEventDetail>>',
        },
        {
          code: 'event-type-mismatch',
          section: 'events',
          member: 'wa-expand',
          expected: '{ item: LyraAccordionItem }',
          actual:
            'CustomEvent<LyraEventDetailSnapshot<LyraAccordionEventDetail>>',
        },
      ],
    },
  ],
  [
    'wa-combobox',
    {
      classification: 'warning-required',
      rationale:
        'Lyra snapshots each input/change event\'s value into a frozen readonly value at dispatch time, and since 16.0.0 narrows it through the picker value generic, so the detail reads as string when multiple is false rather than the upstream union; migrated handlers that mutate the event detail in place, or that rely on the union being present on a single-select combobox, must be reviewed. Its appearance also accepts the full shared LyraAppearance vocabulary (accent and plain in addition to the three upstream values) since 20.0.0; every upstream value keeps its meaning, so only exhaustive TypeScript switches over the narrower upstream union need review.',
      expectedDrift: [
        {
          code: 'type-mismatch',
          section: 'attributes',
          member: 'appearance',
          expected: '\'filled\' | \'outlined\' | \'filled-outlined\'',
          actual: 'LyraAppearance',
        },
        {
          code: 'event-type-mismatch',
          section: 'events',
          member: 'change',
          expected: 'CustomEvent<{ value: string | string[] }>',
          actual:
            'CustomEvent< LyraEventDetailSnapshot<{ readonly value: LyraPickerDetailValue<Multiple>; readonly previousValue: LyraPickerDetailValue<Multiple>; readonly data: readonly unknown[]; }> >',
        },
        {
          code: 'event-constructor-mismatch',
          section: 'events',
          member: 'input',
          expected: 'InputEvent | CustomEvent<{ value: string | string[] }>',
          actual:
            'InputEvent | CustomEvent< LyraEventDetailSnapshot<{ readonly value: LyraPickerDetailValue<Multiple>; readonly previousValue: LyraPickerDetailValue<Multiple>; readonly data: readonly unknown[]; }> >',
        },
        {
          code: 'event-type-mismatch',
          section: 'events',
          member: 'input',
          expected: 'InputEvent | CustomEvent<{ value: string | string[] }>',
          actual:
            'InputEvent | CustomEvent< LyraEventDetailSnapshot<{ readonly value: LyraPickerDetailValue<Multiple>; readonly previousValue: LyraPickerDetailValue<Multiple>; readonly data: readonly unknown[]; }> >',
        },
      ],
    },
  ],
  [
    'wa-date-input',
    {
      classification: 'warning-required',
      rationale:
        'Since 20.0.0 lr-date-input accepts the full shared LyraAppearance vocabulary (accent and plain in addition to the three upstream values). Every upstream value keeps its meaning, so migrated markup is unaffected; only exhaustive TypeScript switches over the narrower upstream union need review. Its lr-hide is cancelable except when disabling the field or making it readonly closes an open popup, which a listener cannot veto; handlers that rely on vetoing every hide need review.',
      expectedDrift: [
        {
          code: 'type-mismatch',
          section: 'attributes',
          member: 'appearance',
          expected: '\'filled\' | \'outlined\' | \'filled-outlined\'',
          actual: 'LyraAppearance',
        },
        {
          code: 'cancelability-mismatch',
          section: 'events',
          member: 'wa-hide',
          expected: 'always',
          actual: 'conditional',
        },
      ],
    },
  ],
  [
    'wa-resize-observer',
    {
      classification: 'warning-required',
      rationale:
        'Lyra freezes the entries array into an immutable snapshot at dispatch time; migrated code that mutates the array in place must create its own copy.',
      expectedDrift: [
        {
          code: 'event-type-mismatch',
          section: 'events',
          member: 'wa-resize',
          expected: '{ entries: ResizeObserverEntry[] }',
          actual:
            'CustomEvent< Readonly<{ entries: readonly ResizeObserverEntry[] }> >',
        },
      ],
    },
  ],
  [
    'wa-toast',
    {
      classification: 'warning-required',
      rationale:
        'Lyra\'s create() overloads reference the Lyra*-prefixed LyraToastOptions/LyraToastCreateOptions type names (renamed from the unprefixed spellings in 9.0.0) instead of the upstream\'s own ToastCreateOptions text; the method\'s actual parameter count, order, and runtime shape are unchanged, only the printed TypeScript type names differ.',
      expectedDrift: [
        {
          code: 'method-signature-mismatch',
          section: 'methods',
          member: 'create',
          expected: [
            {
              parameters: [
                {
                  name: 'message',
                  type: 'string',
                  optional: false,
                  hasDefault: false,
                },
                {
                  name: 'options',
                  type: 'ToastCreateOptions',
                  optional: true,
                  hasDefault: false,
                },
              ],
              returnType: 'Promise<WaToastItem>',
            },
          ],
          actual: [
            {
              parameters: [
                {
                  name: 'options',
                  type: 'LyraToastOptions',
                  optional: false,
                  hasDefault: false,
                },
              ],
              returnType: 'Promise<LyraToastItem>',
            },
            {
              parameters: [
                {
                  name: 'message',
                  type: 'string',
                  optional: false,
                  hasDefault: false,
                },
                {
                  name: 'options',
                  type: 'LyraToastCreateOptions',
                  optional: true,
                  hasDefault: false,
                },
              ],
              returnType: 'Promise<LyraToastItem>',
            },
            {
              parameters: [
                {
                  name: 'messageOrOptions',
                  type: 'string | LyraToastOptions',
                  optional: false,
                  hasDefault: false,
                },
                {
                  name: 'legacyOptions',
                  type: 'LyraToastCreateOptions',
                  optional: false,
                  hasDefault: true,
                  default: '{}',
                },
              ],
              returnType: 'Promise<LyraToastItem>',
            },
          ],
        },
      ],
    },
  ],
]);

export function reviewedMigrationDecision(upstreamTag) {
  const decision = DECISION_OVERRIDES.get(upstreamTag);
  return decision ? structuredClone(decision) : null;
}

const BEHAVIOR_PARITY_OVERRIDES = new Map([
  ...['sl-alert', 'sl-dialog', 'sl-drawer', 'sl-dropdown', 'sl-tooltip'].map(
    (tag) => [
      tag,
      {
        behaviorReviewFlags: ['lifecycle-event-cancelability-and-phase'],
      },
    ]
  ),
  [
    'sl-carousel',
    {
      behaviorReviewFlags: ['event-detail-slide-type-widening'],
    },
  ],
  [
    'wa-carousel',
    {
      behaviorReviewFlags: [
        'event-detail-slide-type-widening',
        'readonly-derived-slide-count',
      ],
    },
  ],
  [
    'wa-markdown',
    {
      lightDom: 'warning-required',
      behaviorReviewFlags: [
        'light-dom-markdown-source',
        'optional-peer-runtime',
      ],
    },
  ],
  [
    'wa-data-grid',
    {
      behaviorReviewFlags: [
        'immutable-collection-snapshots',
        'removed-data-request-event',
      ],
    },
  ],
  [
    'wa-random-content',
    {
      lightDom: 'warning-required',
      behaviorReviewFlags: [
        'immutable-selection-snapshots',
        'host-layout',
        'multi-item-layout',
        'unique-retry-bound',
        'forwarded-slot-candidates',
        'autoplay-semantics',
      ],
    },
  ],
  ...['sl-tree', 'wa-tree'].map((tag) => [
    tag,
    {
      behaviorReviewFlags: ['immutable-selection-snapshots'],
    },
  ]),
  [
    'wa-file-input',
    {
      behaviorReviewFlags: [
        'readonly-derived-drag-state',
        'readonly-derived-file-count',
      ],
    },
  ],
  [
    'wa-zoomable-frame',
    {
      behaviorReviewFlags: ['sandbox-and-url-safety'],
    },
  ],
]);

const PAGE_METHOD_EDGE_RATIONALE =
  'Lyra returns a finite 0 for null and for an element in a detached document with no viewport; Web Awesome 3.11 returns null for null and measures detached-document geometry against the ambient page viewport.';

const REVIEWED_METHOD_EDGE_SEMANTICS = new Map([
  [
    'wa-page',
    [
      {
        method: 'visiblePixelsInViewport',
        cases: [
          {
            case: 'null-argument',
            arguments: ['null'],
            upstream: { kind: 'sentinel', value: null },
            target: { kind: 'sentinel', value: 0 },
          },
          {
            case: 'detached-document-element',
            arguments: ['detached-document-element'],
            upstream: {
              kind: 'measurement',
              basis: 'ambient-page-viewport',
            },
            target: { kind: 'sentinel', value: 0 },
          },
        ],
        rationale: PAGE_METHOD_EDGE_RATIONALE,
      },
    ],
  ],
]);

/** Compares artifact-bound upstream method-edge observations with reviewed Lyra behavior. The
 * upstream half is pinned twice on purpose: once to the exact package fixture and once here to the
 * adjudication. A changed observation therefore stops generation until its migration impact is
 * reviewed instead of silently rewriting the warning. */
export function reviewedMethodEdgeParity(upstream, target) {
  const reviewed = REVIEWED_METHOD_EDGE_SEMANTICS.get(upstream?.tag) ?? [];
  const observed = (upstream?.surface?.methods ?? []).filter(
    (method) => method.edgeSemantics
  );
  const reviewedMethods = new Set(reviewed.map(({ method }) => method));
  for (const method of observed) {
    if (!reviewedMethods.has(method.name)) {
      throw new Error(
        `${upstream.tag}#${method.name}: pinned method-edge evidence has no reviewed migration adjudication`
      );
    }
  }
  if (reviewed.length === 0) {
    return { status: 'not-applicable', rationale: null, methods: [] };
  }

  const methods = reviewed.map((entry) => {
    const upstreamMethod = (upstream?.surface?.methods ?? []).find(
      (method) => method.name === entry.method
    );
    const targetMethod = (target?.surface?.methods ?? []).find(
      (method) => method.name === entry.method
    );
    if (!upstreamMethod?.edgeSemantics) {
      throw new Error(
        `${upstream?.tag}#${entry.method}: reviewed method-edge evidence is missing`
      );
    }
    if (!targetMethod) {
      throw new Error(
        `${target?.tag ?? 'no Lyra target'}#${entry.method}: reviewed method-edge target is missing`
      );
    }
    const expectedUpstreamCases = entry.cases.map(
      ({ case: caseName, arguments: args, upstream: outcome }) => ({
        case: caseName,
        arguments: args,
        outcome,
      })
    );
    if (
      upstreamMethod.edgeSemantics.evidence !== 'pinned-runtime' ||
      JSON.stringify(upstreamMethod.edgeSemantics.cases) !==
        JSON.stringify(expectedUpstreamCases)
    ) {
      throw new Error(
        `${upstream.tag}#${entry.method}: reviewed upstream method-edge evidence changed`
      );
    }
    return {
      method: entry.method,
      evidence: {
        upstream: 'pinned-package-black-box',
        target: 'lyra-authored-contract-and-automated-tests',
      },
      cases: entry.cases.map(
        ({ case: caseName, arguments: args, upstream: source, target: destination }) => ({
          case: caseName,
          arguments: args,
          upstream: structuredClone(source),
          target: structuredClone(destination),
          status:
            JSON.stringify(source) === JSON.stringify(destination)
              ? 'equivalent'
              : 'different',
        })
      ),
      rationale: entry.rationale,
    };
  });
  const warningRequired = methods.some((method) =>
    method.cases.some(({ status }) => status === 'different')
  );
  return {
    status: warningRequired ? 'warning-required' : 'equivalent',
    rationale: warningRequired
      ? methods.map(({ rationale }) => rationale).join(' ')
      : null,
    methods,
  };
}

export function migrationParityMetadata({
  upstream,
  target,
  classification,
  comparisonPerformed = false,
  methodEdges = [],
}) {
  const behaviorOverride = BEHAVIOR_PARITY_OVERRIDES.get(upstream.tag);
  const hasLightDomSurface = (upstream.surface.slots?.length ?? 0) > 0;
  const methodEdgeFlags = methodEdges.some((method) =>
    method.cases?.some(({ status }) => status === 'different')
  )
    ? ['method-edge-return-sentinel-divergence']
    : [];
  const behaviorReviewFlags = [
    ...(behaviorOverride?.behaviorReviewFlags ??
      (methodEdgeFlags.length > 0
        ? []
        : classification === 'exact' || classification === 'rewritten'
          ? []
          : [`${classification}-mapping`])),
    ...methodEdgeFlags,
  ].filter((flag, index, flags) => flags.indexOf(flag) === index);
  return {
    staticApi: deriveStaticApiReviewStatus({
      upstreamReviewStatus: upstream.review?.status,
      targetPresent: Boolean(target),
      comparisonPerformed,
    }),
    lightDom:
      behaviorOverride?.lightDom ??
      (hasLightDomSurface ? 'surface-only' : 'not-applicable'),
    runtime: {
      registration: !target
        ? 'unavailable'
        : target.rootIncluded === false
        ? 'granular'
        : 'all',
      optionalPeers: [...(target?.optionalPeers ?? [])].sort(),
    },
    accessibility: reviewedAccessibilityMetadata(
      upstream.tag,
      target?.tag ?? 'no Lyra target'
    ),
    behaviorReviewFlags,
    ...(methodEdges.length > 0
      ? { methodEdges: structuredClone(methodEdges) }
      : {}),
  };
}

const DECISION_NOTES = new Map([
  [
    'wa-video',
    'Lyra adds load(), validates media and thumbnail URLs, preserves consumer source/track nodes, caps thumbnail VTT input, and rejects unsupported fullscreen requests. These fail-closed additions do not change the documented safe-use contract.',
  ],
  [
    'wa-video-playlist',
    'Lyra preserves the reviewed direct-child, first-active, navigation, control-forwarding, immutable event-snapshot, and ended auto-advance behavior. It adds without-auto-advance and repeat controls without removing or changing the mapped upstream surface.',
  ],
]);

// When Lyra intentionally keeps a v8 default that differs from a source contract, migration
// inserts the source default only when the consumer omitted the attribute. This preserves source
// behavior without changing Lyra's own default for newly-authored markup.
const REVIEWED_DEFAULT_REWRITES = new Map([
  [
    'sl-badge',
    [
      {
        memberKind: 'attribute',
        member: 'variant',
        action: 'insert-if-absent',
        value: 'primary',
      },
    ],
  ],
  [
    'sl-qr-code',
    [
      {
        memberKind: 'attribute',
        member: 'background',
        action: 'insert-if-absent',
        value: 'white',
      },
      {
        memberKind: 'attribute',
        member: 'fill',
        action: 'insert-if-absent',
        value: 'black',
      },
    ],
  ],
  [
    'sl-radio-group',
    [
      {
        memberKind: 'attribute',
        member: 'name',
        action: 'insert-if-absent',
        value: 'option',
      },
    ],
  ],
  [
    'sl-range',
    [
      {
        memberKind: 'attribute',
        member: 'tooltip',
        action: 'insert-if-absent',
        value: 'top',
      },
    ],
  ],
  [
    'wa-badge',
    [
      {
        memberKind: 'attribute',
        member: 'appearance',
        action: 'insert-if-absent',
        value: 'accent',
      },
      {
        memberKind: 'attribute',
        member: 'variant',
        action: 'insert-if-absent',
        value: 'brand',
      },
    ],
  ],
]);

function summarizeDrift(drift) {
  const byCode = new Map();
  for (const finding of drift) {
    const members = byCode.get(finding.code) ?? [];
    members.push(finding.member);
    byCode.set(finding.code, members);
  }
  const summaries = [...byCode]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, members]) => {
      const examples = [...new Set(members)].slice(0, 5).join(', ');
      return `${members.length} ${code}${examples ? ` (${examples})` : ''}`;
    });
  return `Prefix substitution is not currently public-surface safe: ${summaries.join(
    '; '
  )}.`;
}

function attributeRewrites(fixture, upstreamTag) {
  return (fixture.attributeRenames ?? [])
    .filter((entry) => entry.upstream === upstreamTag)
    .map(({ from, to }) => ({ from, to }))
    .filter((entry) => entry.from !== entry.to)
    .sort((a, b) => a.from.localeCompare(b.from));
}

function normalizedRewrites(rewrites = {}) {
  const normalized = emptyRewrites();
  for (const section of Object.keys(normalized)) {
    normalized[section] = Array.isArray(rewrites[section])
      ? rewrites[section]
      : [];
  }
  return normalized;
}

function prefixEventRewrites(component, target, upstream) {
  if (!target) return [];
  const prefix = upstream === 'webawesome' ? 'wa-' : 'sl-';
  const targetEvents = new Set(
    target.surface.events.map((event) => event.name)
  );
  return component.surface.events
    .filter((event) => event.name.startsWith(prefix))
    .map((event) => {
      const suffix = event.name.slice(prefix.length);
      const prefixed = `lr-${suffix}`;
      // focus/blur are bridged through the already-bubbling native DOM event
      // (relayNativeEvent()), not a prefixed lr-focus/lr-blur alias -- 9.0.0 removed that v8-era
      // compatibility pair library-wide. Prefer the bare native name when the prefixed one isn't
      // a real target event but the native one is, instead of silently dropping the rewrite (and
      // thus reporting a false missing-event drift) the moment a mirrored component's lr-focus/
      // lr-blur goes away.
      const to =
        (suffix === 'focus' || suffix === 'blur') &&
        !targetEvents.has(prefixed) &&
        targetEvents.has(suffix)
          ? suffix
          : prefixed;
      return { from: event.name, to };
    })
    .filter(
      (rewrite) => rewrite.from !== rewrite.to && targetEvents.has(rewrite.to)
    )
    .sort((left, right) => left.from.localeCompare(right.from));
}

export function mappingDecisions({
  fixture,
  readme,
  components,
  upstreams,
  existing,
}) {
  const { map: mirrorMap, conflicts } = buildMirrorMap(readme);
  if (conflicts.length)
    throw new Error(
      `README mirror table has conflicts: ${conflicts.join('; ')}`
    );
  const lyraByTag = new Map(
    components.map((component) => [component.tag, component])
  );
  const previous = new Map(
    (existing?.mappings ?? []).map((mapping) => [mapping.upstreamTag, mapping])
  );
  const entries = [
    ...upstreams.webawesome.components.map((component) => ({
      upstream: 'webawesome',
      component,
    })),
    ...upstreams.shoelace.components.map((component) => ({
      upstream: 'shoelace',
      component,
    })),
  ];

  return entries
    .map(({ upstream, component }) => {
      const upstreamTag = component.tag;
      const targetTag =
        REQUIRED_TARGETS.get(upstreamTag) || mirrorMap.get(upstreamTag) || null;
      const existingDecision = previous.get(upstreamTag);
      const target = lyraByTag.get(targetTag);
      const rewrites =
        existingDecision?.decisionSource === 'reviewed'
          ? normalizedRewrites(existingDecision.rewrites)
          : normalizedRewrites({
              attributes: attributeRewrites(fixture, upstreamTag),
              events: prefixEventRewrites(component, target, upstream),
              defaults: REVIEWED_DEFAULT_REWRITES.get(upstreamTag) ?? [],
            });
      const reviewedNormalizations = hasReviewedMappingNormalizations(
        upstreamTag
      )
        ? reviewedMappingNormalizations(upstreamTag)
        : null;
      const normalizations =
        reviewedNormalizations ??
        normalizedNormalizations(existingDecision?.normalizations);
      // Type reviews are authoritative even when a mapping has no other comparison-only
      // normalization. Replacing this section (instead of appending it) keeps regeneration
      // idempotent when the previous inventory already contains the same exact member rules.
      normalizations.typeEquivalences = reviewedTypeEquivalences(upstreamTag);
      const comparisonPerformed =
        component.review.status === 'complete' && Boolean(target);
      const drift = comparisonPerformed
        ? compareMappedSurfaces(component.surface, target.surface, {
            upstreamPrefix: upstream === 'webawesome' ? 'wa-' : 'sl-',
            rewrites,
            normalizations,
          })
        : [];
      const methodEdgeReview = reviewedMethodEdgeParity(component, target);

      let classification;
      let rationale;
      let decisionSource = 'derived';
      if (DECISION_OVERRIDES.has(upstreamTag)) {
        const override = DECISION_OVERRIDES.get(upstreamTag);
        if (JSON.stringify(drift) !== JSON.stringify(override.expectedDrift)) {
          throw new Error(
            `${upstreamTag}: warning-required override drift changed; expected ${JSON.stringify(
              override.expectedDrift
            )} but found ${JSON.stringify(drift)}`
          );
        }
        ({ classification, rationale } = override);
      } else if (methodEdgeReview.status === 'warning-required') {
        classification = 'warning-required';
        rationale = [
          methodEdgeReview.rationale,
          drift.length > 0 ? summarizeDrift(drift) : null,
        ]
          .filter(Boolean)
          .join(' ');
      } else if (existingDecision?.decisionSource === 'reviewed') {
        classification = existingDecision.classification;
        rationale = existingDecision.rationale;
        decisionSource = 'reviewed';
      } else if (targetTag && !target) {
        classification = 'unsupported';
        rationale = `The required ${targetTag} target is not registered yet; automatic migration remains blocked until its complete public contract ships.`;
      } else if (!target) {
        classification = 'unsupported';
        rationale =
          'The pinned upstream tag has no reviewed Lyra target; automatic migration is blocked.';
      } else if (component.review.status !== 'complete') {
        classification = 'unsupported';
        rationale =
          'The pinned public snapshot identifies this tag but does not include a member-level manifest; automatic migration remains blocked until every documented member is fully recorded.';
      } else if (drift.length === 0) {
        const hasRewrite = REWRITE_RULE_SECTIONS.some(
          (section) => rewrites[section]?.length > 0
        );
        classification = hasRewrite ? 'rewritten' : 'exact';
        rationale = hasRewrite
          ? 'All reviewed differences are covered by deterministic member rewrites.'
          : null;
      } else {
        classification = 'unsupported';
        rationale = summarizeDrift(drift);
      }

      return {
        upstream,
        upstreamTag,
        upstreamTier: component.tier,
        targetTag,
        classification,
        rationale,
        decisionSource,
        parity: migrationParityMetadata({
          upstream: component,
          target,
          classification,
          comparisonPerformed,
          methodEdges: methodEdgeReview.methods,
        }),
        ...(DECISION_NOTES.has(upstreamTag)
          ? { notes: DECISION_NOTES.get(upstreamTag) }
          : {}),
        rewrites,
        normalizations,
        drift,
      };
    })
    .sort((a, b) => a.upstreamTag.localeCompare(b.upstreamTag));
}

export function addCounterparts(components, mappings) {
  const byTag = new Map(
    components.map((component) => [component.tag, component])
  );
  for (const mapping of mappings) {
    const target = byTag.get(mapping.targetTag);
    if (!target) continue;
    target.counterparts.push({
      upstream: mapping.upstream,
      tag: mapping.upstreamTag,
      tier: mapping.upstreamTier,
      classification: mapping.classification,
    });
  }
  for (const component of components)
    component.counterparts.sort((a, b) => a.tag.localeCompare(b.tag));
}
