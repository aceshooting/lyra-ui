import { readFileSync } from 'node:fs';

import { applyComponentMetadataToManifest } from './scripts/component-metadata.mjs';
import { sourceEventTypeContracts } from './scripts/check-event-contracts.mjs';

const componentMetadata = JSON.parse(
  readFileSync(
    new URL('./scripts/fixtures/component-metadata.json', import.meta.url),
    'utf8'
  )
);
const packageVersion = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
).version;

// Public accessors whose initial values live in private backing fields (or named constants) are
// invisible to CEM's syntax-only analyzer. Keep the small, explicit projection in one exported
// table so its synthetic test covers every entry and a source rename fails closed.
export const ACCESSOR_RUNTIME_CONTRACTS = new Map([
  [
    'lr-avatar',
    {
      image: { default: "''", attribute: 'image' },
    },
  ],
  [
    'lr-alert',
    {
      variant: { default: "'primary'", attribute: 'variant' },
    },
  ],
  [
    'lr-button',
    {
      disabled: { default: 'false', attribute: 'disabled' },
      href: { default: 'undefined', attribute: 'href' },
      name: { default: "''", attribute: 'name' },
      variant: { default: "'neutral'", attribute: 'variant' },
    },
  ],
  [
    'lr-callout',
    {
      size: { default: "'m'", attribute: 'size' },
      variant: { default: "'brand'", attribute: 'variant' },
    },
  ],
  [
    'lr-breadcrumb-item',
    {
      href: { default: "''", attribute: 'href' },
    },
  ],
  [
    'lr-checkbox',
    {
      checked: { default: 'false', attribute: 'checked' },
      defaultChecked: {
        default: 'false',
        attribute: 'checked',
        reflects: true,
      },
      customError: { default: 'null', attribute: 'custom-error' },
      disabled: { default: 'false', attribute: 'disabled' },
      form: {
        default: 'null',
        attribute: 'form',
        createAttribute: true,
        reflects: true,
      },
      indeterminate: { default: 'false', attribute: 'indeterminate' },
      name: { default: "''", attribute: 'name' },
      required: { default: 'false', attribute: 'required' },
    },
  ],
  [
    'lr-checkbox-group',
    {
      required: { default: 'false', attribute: 'required' },
    },
  ],
  [
    'lr-color-picker',
    {
      form: { default: 'null', attribute: 'form' },
      open: { default: 'false', attribute: 'open' },
    },
  ],
  [
    'lr-combobox',
    {
      autocorrect: { default: 'true', attribute: 'autocorrect' },
      disabled: { default: 'false', attribute: 'disabled' },
      inputValue: { default: "''" },
      maxOptionsVisible: { default: '3', attribute: 'max-options-visible' },
      multiple: { default: 'false', attribute: 'multiple' },
      name: { default: "''", attribute: 'name' },
      open: { default: 'false', attribute: 'open' },
      required: { default: 'false', attribute: 'required' },
    },
  ],
  [
    'lr-copy-button',
    {
      feedbackDuration: { default: '1000', attribute: 'feedback-duration' },
    },
  ],
  [
    'lr-date-input',
    {
      disableFuture: { default: 'false', attribute: 'disable-future' },
      disablePast: { default: 'false', attribute: 'disable-past' },
      max: { default: "''", attribute: 'max' },
      min: { default: "''", attribute: 'min' },
      mode: { default: "'single'", attribute: 'mode' },
      open: { default: 'false', attribute: 'open' },
      readonly: { default: 'false', attribute: 'readonly' },
    },
  ],
  [
    'lr-details',
    {
      open: { default: 'false', attribute: 'open' },
    },
  ],
  [
    'lr-dropdown',
    {
      arrow: { default: 'false', attribute: 'arrow' },
      disabled: { default: 'false', attribute: 'disabled' },
      distance: { default: '0', attribute: 'distance' },
      placement: { default: "'bottom-start'", attribute: 'placement' },
      popupRole: { default: "'menu'", attribute: 'popup-role' },
      sync: { default: 'undefined', attribute: 'sync' },
    },
  ],
  [
    'lr-dropdown-item',
    {
      submenuOpen: {
        default: 'false',
        attribute: 'submenu-open',
        reflects: true,
      },
    },
  ],
  [
    'lr-file-input',
    {
      disabled: { default: 'false', attribute: 'disabled' },
      dragging: { default: 'false' },
      files: { default: '[]' },
      name: { default: 'null', attribute: 'name' },
      required: { default: 'false', attribute: 'required' },
    },
  ],
  [
    'lr-icon',
    {
      name: { default: "''", attribute: 'name' },
      src: { default: "''", attribute: 'src' },
    },
  ],
  [
    'lr-include',
    {
      mode: { default: "'same-origin'", attribute: 'mode' },
    },
  ],
  [
    'lr-icon-button',
    {
      disabled: { default: 'false', attribute: 'disabled' },
      name: { default: "''", attribute: 'name' },
    },
  ],
  [
    'lr-image-comparer',
    {
      position: { default: '50', attribute: 'position' },
    },
  ],
  [
    'lr-input',
    {
      autocorrect: { default: 'true', attribute: 'autocorrect' },
      type: { default: "'text'", attribute: 'type' },
    },
  ],
  [
    'lr-known-date',
    {
      max: { default: "''", attribute: 'max', reflects: true },
      min: { default: "''", attribute: 'min', reflects: true },
      parts: { default: '{ ...EMPTY_PARTS }' },
      readonly: { default: 'false', attribute: 'readonly', reflects: true },
    },
  ],
  [
    'lr-otp-input',
    {
      length: { default: '6', attribute: 'length' },
    },
  ],
  [
    'lr-number-input',
    {
      inputMode: { default: "'numeric'", attribute: 'inputmode' },
      step: { default: '1', attribute: 'step' },
      type: { default: "'number'", attribute: 'type', reflects: true },
    },
  ],
  [
    'lr-pagination',
    {
      format: { default: "'standard'", attribute: 'format' },
    },
  ],
  [
    'lr-popover',
    {
      for: { default: "''", attribute: 'for' },
    },
  ],
  [
    'lr-qr-code',
    {
      errorCorrection: { default: "'H'", attribute: 'error-correction' },
      radius: { default: '0', attribute: 'radius' },
      size: { default: '128', attribute: 'size' },
    },
  ],
  [
    'lr-random-content',
    {
      mode: { default: "'unique'", attribute: 'mode' },
    },
  ],
  [
    'lr-radio',
    {
      checked: { default: 'false', attribute: 'checked' },
      customError: { default: 'null', attribute: 'custom-error' },
      disabled: { default: 'false', attribute: 'disabled' },
      name: { default: "''", attribute: 'name' },
      required: { default: 'false', attribute: 'required' },
    },
  ],
  [
    'lr-radio-button',
    {
      checked: { default: 'false', attribute: 'checked' },
      customError: { default: 'null', attribute: 'custom-error' },
      disabled: { default: 'false', attribute: 'disabled' },
      name: { default: "''", attribute: 'name' },
      required: { default: 'false', attribute: 'required' },
    },
  ],
  [
    'lr-radio-group',
    {
      customError: { default: 'null', attribute: 'custom-error' },
      defaultValue: { default: "''", attribute: 'value', reflects: true },
      disabled: { default: 'false', attribute: 'disabled' },
      form: { default: 'null', attribute: 'form', reflects: true },
      name: { default: "''", attribute: 'name' },
      required: { default: 'false', attribute: 'required' },
      value: { default: "''", attribute: 'value' },
    },
  ],
  [
    'lr-rating',
    {
      customError: { default: 'null', attribute: 'custom-error' },
      disabled: { default: 'false', attribute: 'disabled' },
      max: { default: '5', attribute: 'max' },
      name: { default: "''", attribute: 'name' },
      required: { default: 'false', attribute: 'required' },
      value: { default: '0', attribute: 'value' },
    },
  ],
  [
    'lr-select',
    {
      form: { default: 'null', attribute: 'form', reflects: true },
      open: { default: 'false', attribute: 'open' },
      selectedOptions: { default: '[]', readonly: false },
      value: { default: "''", attribute: 'value' },
    },
  ],
  [
    'lr-slider',
    {
      form: {
        default: 'null',
        attribute: 'form',
        createAttribute: true,
        reflects: true,
      },
      name: { default: 'null', attribute: 'name' },
    },
  ],
  [
    'lr-split-panel',
    {
      snap: { default: "''", attribute: 'snap' },
    },
  ],
  [
    'lr-switch',
    {
      checked: { default: 'false', attribute: 'checked' },
      defaultChecked: {
        default: 'false',
        attribute: 'checked',
        reflects: true,
      },
      customError: { default: 'null', attribute: 'custom-error' },
      disabled: { default: 'false', attribute: 'disabled' },
      form: {
        default: 'null',
        attribute: 'form',
        createAttribute: true,
        reflects: true,
      },
      name: { default: "''", attribute: 'name' },
      required: { default: 'false', attribute: 'required' },
    },
  ],
  [
    'lr-tag',
    {
      removable: { default: 'false', attribute: 'removable', reflects: true },
      withRemove: {
        default: 'false',
        attribute: 'with-remove',
        reflects: true,
      },
    },
  ],
  [
    'lr-textarea',
    {
      autocorrect: { default: 'true', attribute: 'autocorrect' },
    },
  ],
  [
    'lr-tooltip',
    {
      for: { default: "''", attribute: 'for' },
    },
  ],
]);

// TypeScript can model a narrow getter and wider setter on one accessor, but CEM has only one
// `type.text` slot for both the JavaScript member and its attribute. Project the public write
// vocabulary here so migration aliases reach manifests and editor completions without widening
// the source getter/read type that application code relies on.
export const ACCESSOR_WRITE_TYPE_CONTRACTS = new Map([
  [
    'lr-breadcrumb-item',
    {
      href: {
        readType: 'string',
        writeType: 'string | undefined',
      },
    },
  ],
  [
    'lr-icon',
    {
      name: {
        readType: 'string',
        writeType: 'string | undefined',
      },
      src: {
        readType: 'string',
        writeType: 'string | undefined',
      },
    },
  ],
  [
    'lr-icon-button',
    {
      name: {
        readType: 'string',
        writeType: 'string | undefined',
      },
    },
  ],
  [
    'lr-filter-bar',
    {
      filters: {
        readType: 'readonly LyraFilterBarFilterDefinition[]',
        writeType:
          'readonly LyraFilterBarFilterDefinition[] | null | undefined',
        attribute: false,
      },
      value: {
        readType: 'LyraFilterBarValue',
        writeType: 'LyraFilterBarValue | null | undefined',
        attribute: false,
      },
    },
  ],
  [
    'lr-input',
    {
      autocorrect: {
        readType: 'boolean',
        writeType: "boolean | 'off' | 'on'",
      },
    },
  ],
  [
    'lr-split-panel',
    {
      snap: {
        readType: 'string | LyraSplitPanelSnapFunction',
        writeType: 'string | LyraSplitPanelSnapFunction | undefined',
      },
    },
  ],
  [
    'lr-textarea',
    {
      autocorrect: {
        readType: 'boolean',
        writeType: 'boolean | string',
      },
    },
  ],
]);

// CEM's inheritance pass omits a small class-field edge case: a public readonly field initialized
// on the base class is not copied to a subclass even though the runtime instance inherits the
// field normally. Its compact form can likewise prune an event that a permanent registration
// alias inherits at runtime. Keep each compatibility projection explicit and source-linked so a
// rename fails closed.
export const INHERITED_PUBLIC_MEMBER_CONTRACTS = new Map([
  [
    'lr-archive-viewer',
    { sourceClass: 'LyraElement', members: ['locale', 'strings'] },
  ],
  ['lr-drawer', { sourceTag: 'lr-dialog', members: ['modal'] }],
  [
    'lr-geojson-view',
    {
      sourceTag: 'lr-geojson-viewer',
      events: ['lr-anchor-result'],
    },
  ],
  [
    'lr-tag',
    {
      sourceTag: 'lr-badge',
      members: ['size', 'variant'],
      memberTypes: { variant: 'TagVariant' },
    },
  ],
]);

/**
 * Returns every class that directly or transitively adopts the document-anchor mixins. The
 * analyzer reports only concrete registered declarations, while shared abstract bases such as
 * `MarkdownRuntimeBase` deliberately own the mixin composition. Following the source inheritance
 * edges keeps the reviewed tag inventory fail-closed after that kind of extraction.
 */
export function documentAnchorTargetClassNames(sources) {
  const inheritance = [];
  const classPattern =
    /\b(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)\s+extends\s+([A-Za-z_$][\w$]*)/gu;
  const composedBasePattern =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(DocumentAnchorTarget|TextViewerTarget)\s*\(/gu;
  for (const source of sources) {
    for (const match of source.matchAll(classPattern)) {
      inheritance.push([match[1], match[2]]);
    }
    for (const match of source.matchAll(composedBasePattern)) {
      inheritance.push([match[1], match[2]]);
    }
  }

  const adopters = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [derived, base] of inheritance) {
      if (
        base !== 'DocumentAnchorTarget' &&
        base !== 'TextViewerTarget' &&
        !adopters.has(base)
      ) {
        continue;
      }
      if (adopters.has(derived)) continue;
      adopters.add(derived);
      changed = true;
    }
  }
  return adopters;
}

/** Every concrete element that adopts the source-only `DocumentAnchorTarget` mixin, directly or
 * through the source-only `TextViewerTarget` mixin. */
export const DOCUMENT_ANCHOR_TARGET_TAGS = Object.freeze([
  'lr-archive-viewer',
  'lr-av-player',
  'lr-calendar-viewer',
  'lr-contact-viewer',
  'lr-csv-viewer',
  'lr-dataset-viewer',
  'lr-docx-viewer',
  'lr-ebook-viewer',
  'lr-email-viewer',
  'lr-geojson-view',
  'lr-geojson-viewer',
  'lr-html-viewer',
  'lr-image-viewer',
  'lr-include',
  'lr-markdown',
  'lr-markdown-core',
  'lr-notebook-viewer',
  'lr-pdf-viewer',
  'lr-pptx-viewer',
  'lr-spreadsheet-viewer',
  'lr-svg-viewer',
  'lr-xml-viewer',
]);

// Exported so source-composition governance and the CEM projection consume one effective public
// contract. The mixin implementation lives outside the analyzer globs and must not be exposed as
// a fake registered element merely to make its members visible.
export const DOCUMENT_ANCHOR_TARGET_CONTRACT = Object.freeze({
  fields: Object.freeze({
    highlights: Object.freeze({
      type: 'LyraHighlight[]',
      default: '[]',
      description:
        'Highlights rendered by the document target. Reassign after mutation.',
    }),
    activeHighlightId: Object.freeze({
      type: 'string | null',
      attribute: 'active-highlight-id',
      default: 'null',
      description:
        'Id of the currently active highlight, or null when none is active.',
    }),
    anchor: Object.freeze({
      type: 'LyraAnchor | string | null',
      default: 'null',
      description: 'Anchor or highlight id to resolve and scroll into view.',
    }),
    anchorKinds: Object.freeze({
      type: 'readonly LyraAnchorKind[]',
      default: '[]',
      readonly: true,
      description: 'Anchor kinds supported by this viewer instance.',
    }),
  }),
  methods: Object.freeze({
    scrollToAnchor: Object.freeze({
      parameters: Object.freeze([
        { name: 'target', type: { text: 'LyraAnchor | string' } },
      ]),
      returnType: 'Promise<boolean>',
      description:
        'Resolves an anchor or highlight id, scrolls it into view, and reports whether it was found.',
    }),
  }),
  cssParts: Object.freeze([
    Object.freeze({
      name: 'anchor-live-region',
      description:
        'The aria-hidden, non-live shadow mirror of the latest anchor-jump message.',
    }),
  ]),
});

/** Content attributes deliberately owned without a same-named public JavaScript property. */
export const ATTRIBUTE_ONLY_CONTRACTS = new Map([
  ['lr-app-rail-item', { 'icon-only': { type: 'boolean' } }],
]);

/** Reflected attributes that exist only as framework/hydration transport and must not be
 * advertised as consumer-settable HTML API. The private field and its Lit attribute mapping stay
 * in source so hydration can consume the declarative seed; only the published CEM projection is
 * suppressed. */
export const INTERNAL_ATTRIBUTE_CONTRACTS = new Map([
  ['lr-multi-split', { 'data-lr-panel-count': { fieldName: 'panelCount' } }],
]);

// CEM reports a generic class field using its type parameter (`Variant`) rather than the concrete
// default selected by the public component class. Project only that syntax-level generic back to
// the exported closed public type; inherited `lr-tag` then refines it to `TagVariant` below.
export const CONCRETE_GENERIC_MEMBER_CONTRACTS = new Map([
  ['lr-badge', { variant: { genericType: 'Variant', type: 'BadgeVariant' } }],
]);

// Event-map interfaces are the runtime/type source of truth, but CEM does not connect a class's
// LyraElement<TEventMap> parameter to its `@event` records. These explicit native-event canaries
// are also exercised by the synthetic plugin test; the package-link phase merges them with every
// concrete EventMap schema discovered from source.
export const EVENT_RUNTIME_CONTRACTS = new Map([
  ['lr-checkbox', { change: 'Event' }],
  [
    'lr-color-picker',
    {
      change: 'Event',
      input: 'InputEvent',
      'lr-hide': 'CustomEvent<null>',
      'lr-show': 'CustomEvent<null>',
    },
  ],
  ['lr-drawer', { 'lr-hide': 'CustomEvent<LyraDialogHideDetail>' }],
  ['lr-input', { change: 'Event', input: 'InputEvent' }],
  ['lr-number-input', { change: 'Event', input: 'InputEvent' }],
  ['lr-otp-input', { change: 'Event', input: 'InputEvent' }],
  ['lr-radio-group', { change: 'Event', input: 'InputEvent' }],
  ['lr-select', { change: 'Event', input: 'InputEvent' }],
  [
    'lr-slider',
    {
      blur: 'FocusEvent',
      change: 'Event',
      focus: 'FocusEvent',
      input: 'InputEvent',
    },
  ],
  ['lr-switch', { change: 'Event', input: 'InputEvent' }],
  ['lr-time-input', { change: 'Event', input: 'InputEvent' }],
  ['lr-zoomable-frame', { error: 'Event', load: 'Event' }],
]);

export default {
  globs: ['src/components/**/*.ts', 'src/internal/lyra-element.ts'],
  exclude: ['**/*.test.ts', '**/*.styles.ts', '**/*.stories.ts'],
  outdir: '.',
  litelement: true,
  plugins: [
    {
      name: 'lr-define-element-registration',
      // `defineElement('name', Class)` is the library's idempotent registration
      // helper. Teach CEM about that small wrapper so class-only modules still
      // receive the tag and registration entry even when their API JSDoc is
      // attached to an event-map interface immediately before the class.
      analyzePhase({ ts, node, moduleDoc }) {
        if (node.kind !== ts.SyntaxKind.CallExpression) return;
        if (node.expression.getText() !== 'defineElement') return;
        const lazyFunctionKinds = new Set([
          ts.SyntaxKind.FunctionDeclaration,
          ts.SyntaxKind.FunctionExpression,
          ts.SyntaxKind.ArrowFunction,
          ts.SyntaxKind.MethodDeclaration,
          ts.SyntaxKind.Constructor,
          ts.SyntaxKind.GetAccessor,
          ts.SyntaxKind.SetAccessor,
        ]);
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (lazyFunctionKinds.has(parent.kind)) return;
          if (parent.kind === ts.SyntaxKind.SourceFile) break;
        }
        const [name, classReference] = node.arguments ?? [];
        if (!name?.text || !classReference) return;

        const tagName = `lr-${name.text}`;
        const className = classReference.getText();
        if (
          moduleDoc.exports.some(
            (entry) =>
              entry.kind === 'custom-element-definition' &&
              entry.name === tagName
          )
        ) {
          return;
        }
        moduleDoc.exports.push({
          kind: 'custom-element-definition',
          name: tagName,
          declaration: { name: className },
        });
      },
      packageLinkPhase({ customElementsManifest }) {
        const classes = new Map();
        for (const module of customElementsManifest.modules) {
          for (const declaration of module.declarations ?? []) {
            if (declaration.kind === 'class')
              classes.set(declaration.name, { declaration, module });
          }
        }

        for (const module of customElementsManifest.modules) {
          for (const entry of module.exports ?? []) {
            if (entry.kind !== 'custom-element-definition') continue;
            const linked = classes.get(entry.declaration?.name);
            if (!linked) continue;
            linked.declaration.tagName ??= entry.name;
            linked.declaration.customElement = true;
            entry.declaration.module = linked.module.path;
          }
        }
      },
    },
    {
      name: 'lr-internal-base-class-is-not-a-custom-element',
      // `src/internal/lyra-element.ts` is analyzed (see `globs` above) purely so
      // every real `lr-*` element inherits documentation for its shared
      // `emit()` method -- but `LyraElement` is only ever `extend`ed, never
      // registered via `customElements.define()`/`defineElement()`. The
      // analyzer's built-in `--litelement` heuristic (`isCustomElementPlugin`)
      // flags *any* class whose superclass is `LitElement` as
      // `customElement: true`, which produces a spurious top-level manifest
      // entry for `LyraElement` with no `tagName`.
      //
      // User-supplied `plugins` run after every built-in phase (see
      // `@custom-elements-manifest/analyzer`'s `create()`: `mergedPlugins =
      // [...FEATURES, ...plugins]`), so by the time this `packageLinkPhase`
      // runs, `applyInheritancePlugin` has already copied `LyraElement`'s
      // members onto each of the 34 real elements' own declarations. It's
      // then safe to strip just the misleading `customElement` flag from
      // this one declaration -- the module/class doc itself is left alone so
      // `emit()` stays documented as part of the shared base class.
      packageLinkPhase({ customElementsManifest }) {
        const mod = customElementsManifest.modules.find(
          (m) => m.path === 'src/internal/lyra-element.ts'
        );
        const decl = mod?.declarations?.find((d) => d.name === 'LyraElement');
        if (decl) delete decl.customElement;

        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-form-associated-mixin-members',
      // `FormAssociated<T>` (`src/internal/form-associated.ts`) is a mixin *function* whose
      // public accessors and validity methods are hand-written, not declarative class fields. The
      // analyzer only flattens members from a statically-resolvable superclass declaration, so
      // `class X extends FormAssociated(Base)` otherwise loses that inherited public contract.
      // The built-in mixin detector still records `{ name: 'FormAssociated' }` on
      // `declaration.mixins`, so project the mixin interface into the manifest here. This is CEM
      // metadata only: subclasses do not need fake fields that would shadow the real accessors.
      packageLinkPhase({ customElementsManifest }) {
        const MIXIN_FIELDS = {
          customError: {
            type: 'string | null',
            attribute: 'custom-error',
            reflects: true,
            default: 'null',
            description:
              'Consumer-supplied validation message reflected through `custom-error`.',
          },
          defaultValue: {
            type: 'string',
            attribute: 'value',
            reflects: true,
            default: "''",
          },
          disabled: {
            type: 'boolean',
            attribute: 'disabled',
            reflects: true,
            default: 'false',
          },
          // The public accessor intentionally has a split native-like contract: reads return the
          // resolved owner element, while writes accept an element or id string and reflect the
          // `form` content attribute. CEM's effective member type is the write vocabulary;
          // `lyraReadType` preserves the narrower getter for framework declaration generation.
          form: {
            type: 'HTMLFormElement | string | null',
            readType: 'HTMLFormElement | null',
            attribute: 'form',
            reflects: true,
            default: 'null',
          },
          labels: { type: 'NodeList', readonly: true },
          name: {
            type: 'string',
            attribute: 'name',
            reflects: true,
            default: "''",
          },
          required: {
            type: 'boolean',
            attribute: 'required',
            reflects: true,
            default: 'false',
          },
          validationMessage: { type: 'string', readonly: true },
          validity: { type: 'ValidityState', readonly: true },
          value: { type: 'string' },
          willValidate: { type: 'boolean', readonly: true },
        };
        const MIXIN_METHODS = {
          checkValidity: {
            returnType: 'boolean',
            description:
              'Runs constraint validation and returns whether the control is valid.',
          },
          getForm: {
            returnType: 'HTMLFormElement | null',
            description:
              'Returns the browser-resolved form owner, including an external owner selected by `form`.',
          },
          reportValidity: {
            returnType: 'boolean',
            description:
              'Runs interactive constraint validation and reports an invalid result.',
          },
          resetValidity: {
            returnType: 'void',
            description:
              'Clears consumer-supplied validity and restores the current intrinsic constraints.',
          },
          setCustomValidity: {
            returnType: 'void',
            parameters: [{ name: 'message', type: { text: 'string' } }],
            description:
              'Sets or clears a consumer-supplied validation message without discarding intrinsic validity.',
          },
          formStateRestoreCallback: {
            returnType: 'void',
            parameters: [
              {
                name: 'state',
                type: { text: 'string | File | FormData | null' },
              },
              { name: 'reason', type: { text: "'autocomplete' | 'restore'" } },
            ],
            description:
              'Restores browser session-history or autocomplete state without emitting a user event.',
          },
        };

        const declarationEntries = (
          customElementsManifest.modules ?? []
        ).flatMap((module) =>
          (module.declarations ?? []).map((declaration) => ({
            declaration,
            module,
          }))
        );
        const declarationByName = new Map(
          declarationEntries.map((entry) => [entry.declaration.name, entry])
        );
        // CEM's built-in inheritance projection runs before this project plugin. Carry the
        // synthesized mixin contract through subclasses here as well, otherwise a class such as
        // LyraNativeTimeInput inherits LyraInput at runtime but loses the form surface in CEM.
        const formAssociated = new Map();
        for (const { declaration } of declarationEntries) {
          if (
            (declaration.mixins ?? []).some(
              (mixin) => mixin.name === 'FormAssociated'
            )
          ) {
            formAssociated.set(declaration, null);
          }
        }
        let discoveredSubclass = true;
        while (discoveredSubclass) {
          discoveredSubclass = false;
          for (const { declaration } of declarationEntries) {
            if (formAssociated.has(declaration)) continue;
            const parentEntry = declarationByName.get(
              declaration.superclass?.name
            );
            if (!parentEntry || !formAssociated.has(parentEntry.declaration))
              continue;
            formAssociated.set(declaration, {
              name: parentEntry.declaration.name,
              module: parentEntry.module.path,
            });
            discoveredSubclass = true;
          }
        }

        for (const { declaration } of declarationEntries) {
          if (!formAssociated.has(declaration)) continue;
          const inheritedFrom = formAssociated.get(declaration);

          declaration.members ??= [];
          declaration.attributes ??= [];
          declaration.cssParts ??= [];

          for (const [name, metadata] of Object.entries(MIXIN_FIELDS)) {
            let member = declaration.members.find(
              (candidate) =>
                candidate.kind === 'field' && candidate.name === name
            );
            if (!member) {
              member = {
                kind: 'field',
                name,
                privacy: 'public',
                ...(inheritedFrom ? { inheritedFrom } : {}),
              };
              declaration.members.push(member);
            }
            if (metadata.readType) {
              const current = member.type?.text;
              if (
                current !== undefined &&
                current !== metadata.readType &&
                current !== metadata.type
              ) {
                throw new Error(
                  `${declaration.name}.${name}: mixin accessor type must be canonical ${metadata.readType}`
                );
              }
              member.type = { ...member.type, text: metadata.type };
              member.lyraReadType = { text: metadata.readType };
            } else {
              member.type ??= { text: metadata.type };
            }
            if (metadata.description)
              member.description ??= metadata.description;
            if (metadata.attribute && member.attribute === undefined) {
              member.attribute = metadata.attribute;
            }
            if (metadata.reflects && member.reflects === undefined)
              member.reflects = true;
            if (metadata.readonly && member.readonly === undefined)
              member.readonly = true;
            if (
              metadata.default !== undefined &&
              member.default === undefined
            ) {
              member.default = metadata.default;
            }

            if (metadata.attribute) {
              let attribute = declaration.attributes.find(
                (candidate) => candidate.name === metadata.attribute
              );
              if (!attribute) {
                attribute = {
                  name: metadata.attribute,
                  type: { text: metadata.type },
                  fieldName: name,
                  ...(inheritedFrom ? { inheritedFrom } : {}),
                };
                declaration.attributes.push(attribute);
              }
              if (metadata.readType) {
                attribute.type = { ...attribute.type, text: metadata.type };
              } else {
                attribute.type ??= { text: metadata.type };
              }
              if (metadata.description)
                attribute.description ??= metadata.description;
              attribute.fieldName ??= name;
              if (
                metadata.default !== undefined &&
                attribute.default === undefined
              ) {
                attribute.default = metadata.default;
              }
            }
          }

          for (const [name, metadata] of Object.entries(MIXIN_METHODS)) {
            let member = declaration.members.find(
              (candidate) =>
                candidate.kind === 'method' && candidate.name === name
            );
            if (!member) {
              member = {
                kind: 'method',
                name,
                ...(inheritedFrom ? { inheritedFrom } : {}),
              };
              declaration.members.push(member);
            }
            member.return ??= { type: { text: metadata.returnType } };
            if (metadata.parameters && member.parameters === undefined) {
              member.parameters = metadata.parameters;
            }
            if (metadata.description)
              member.description ??= metadata.description;
          }
        }

        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-effective-mixin-and-wrapper-surfaces',
      // The analyzer records these mixin/superclass relationships but cannot materialize their
      // effective public API in the compact raw CEM. Project the runtime surface as own effective
      // entries so editor/framework/composition consumers do not need source-path exceptions.
      packageLinkPhase({ customElementsManifest }) {
        const declarations = new Map();
        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            if (declaration.tagName)
              declarations.set(declaration.tagName, { declaration, module });
          }
        }

        const moduleSources = new Map(
          (customElementsManifest.modules ?? []).map((module) => {
            const sourcePath = normalizeSourcePath(module.path);
            return [
              module,
              readFileSync(new URL(`./${sourcePath}`, import.meta.url), 'utf8'),
            ];
          })
        );
        const anchorTargetClasses = documentAnchorTargetClassNames(
          moduleSources.values()
        );
        const expectedAnchorTags = new Set(DOCUMENT_ANCHOR_TARGET_TAGS);
        const discoveredAnchorTags = new Set(
          [...declarations]
            .filter(([, { declaration }]) =>
              anchorTargetClasses.has(declaration.name)
            )
            .map(([tagName]) => tagName)
        );
        const unexpected = [...discoveredAnchorTags].filter(
          (tagName) => !expectedAnchorTags.has(tagName)
        );
        const missing = [...expectedAnchorTags].filter(
          (tagName) => !discoveredAnchorTags.has(tagName)
        );
        if (unexpected.length || missing.length) {
          throw new Error(
            `DocumentAnchorTarget adopter inventory drifted` +
              `${missing.length ? `; missing ${missing.join(', ')}` : ''}` +
              `${
                unexpected.length ? `; unexpected ${unexpected.join(', ')}` : ''
              }`
          );
        }

        for (const tagName of DOCUMENT_ANCHOR_TARGET_TAGS) {
          const declaration = declarations.get(tagName)?.declaration;
          if (!declaration)
            throw new Error(
              `${tagName}: DocumentAnchorTarget projection requires declaration`
            );
          declaration.members ??= [];
          declaration.attributes ??= [];

          for (const [name, metadata] of Object.entries(
            DOCUMENT_ANCHOR_TARGET_CONTRACT.fields
          )) {
            let member = declaration.members.find(
              (candidate) =>
                candidate.kind === 'field' && candidate.name === name
            );
            if (!member) {
              member = { kind: 'field', name, privacy: 'public' };
              declaration.members.push(member);
            }
            member.type ??= { text: metadata.type };
            member.default ??= metadata.default;
            member.description ??= metadata.description;
            if (metadata.attribute) member.attribute ??= metadata.attribute;
            if (metadata.readonly) member.readonly ??= true;
            delete member.inheritedFrom;

            if (!metadata.attribute) continue;
            let attribute = declaration.attributes.find(
              (candidate) => candidate.name === metadata.attribute
            );
            if (!attribute) {
              attribute = { name: metadata.attribute, fieldName: name };
              declaration.attributes.push(attribute);
            }
            attribute.fieldName = name;
            attribute.type ??= structuredClone(member.type);
            attribute.default ??= member.default;
            attribute.description ??= member.description;
            delete attribute.inheritedFrom;
          }

          for (const [name, metadata] of Object.entries(
            DOCUMENT_ANCHOR_TARGET_CONTRACT.methods
          )) {
            let method = declaration.members.find(
              (candidate) =>
                candidate.kind === 'method' && candidate.name === name
            );
            if (!method) {
              method = { kind: 'method', name };
              declaration.members.push(method);
            }
            method.parameters ??= structuredClone(metadata.parameters);
            method.return ??= { type: { text: metadata.returnType } };
            method.description ??= metadata.description;
            delete method.inheritedFrom;
          }

          for (const metadata of DOCUMENT_ANCHOR_TARGET_CONTRACT.cssParts) {
            const part = declaration.cssParts.find(
              (candidate) => candidate.name === metadata.name
            );
            if (part) part.description ??= metadata.description;
            else declaration.cssParts.push(structuredClone(metadata));
          }
        }

        const radio = declarations.get('lr-radio')?.declaration;
        const radioButton = declarations.get('lr-radio-button')?.declaration;
        if (!radio || !radioButton) {
          throw new Error(
            'lr-radio-button effective wrapper projection requires lr-radio and lr-radio-button'
          );
        }
        for (const collection of ['members', 'attributes', 'events']) {
          radioButton[collection] ??= [];
          const identity = (entry) =>
            collection === 'members'
              ? `${entry.kind}:${entry.name}`
              : entry.name;
          const existing = new Map(
            radioButton[collection].map((entry) => [identity(entry), entry])
          );
          for (const sourceEntry of radio[collection] ?? []) {
            const key = identity(sourceEntry);
            const targetEntry = existing.get(key);
            const effective = {
              ...structuredClone(sourceEntry),
              ...(targetEntry ?? {}),
            };
            delete effective.inheritedFrom;
            if (targetEntry) {
              Object.assign(targetEntry, effective);
              delete targetEntry.inheritedFrom;
            } else radioButton[collection].push(effective);
          }
        }

        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-internal-implementation-attributes',
      packageLinkPhase({ customElementsManifest }) {
        const declarations = new Map();
        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            if (declaration.tagName)
              declarations.set(declaration.tagName, declaration);
          }
        }

        for (const [tagName, contract] of INTERNAL_ATTRIBUTE_CONTRACTS) {
          const declaration = declarations.get(tagName);
          if (!declaration) {
            throw new Error(
              `${tagName}: internal-attribute projection requires component declaration`
            );
          }
          for (const [attributeName, metadata] of Object.entries(contract)) {
            const member = declaration.members?.find(
              (candidate) =>
                candidate.kind === 'field' &&
                candidate.name === metadata.fieldName
            );
            if (
              !member ||
              !['private', 'protected'].includes(member.privacy) ||
              member.attribute !== attributeName
            ) {
              throw new Error(
                `${tagName}[${attributeName}]: internal-attribute projection requires private field ${metadata.fieldName}`
              );
            }
          }
          declaration.attributes = (declaration.attributes ?? []).filter(
            (attribute) => !Object.hasOwn(contract, attribute.name)
          );
          if (declaration.attributes.length === 0)
            delete declaration.attributes;
        }

        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-default-value-attribute-alias',
      // Lit needs a reactive accessor to accept the mapped `default-value` spelling, but the
      // supported JavaScript property is the native-like `defaultValue`. Keep the content
      // attribute public while classifying the implementation adapter as internal API and map
      // framework/editor consumers to the canonical property. The controls using this adapter do
      // not all share a value type, so project type/default from that canonical property rather
      // than inventing string metadata here.
      packageLinkPhase({ customElementsManifest }) {
        const declarationsByName = new Map();
        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            if (declaration.kind === 'class')
              declarationsByName.set(declaration.name, declaration);
          }
        }

        const canonicalContract = (declaration, member) => {
          let type = member.type;
          let defaultValue = member.default;
          let current = member;
          const seen = new Set([declaration.name]);
          while (
            (!type || defaultValue === undefined) &&
            current?.inheritedFrom?.name
          ) {
            const ownerName = current.inheritedFrom.name;
            if (seen.has(ownerName)) break;
            seen.add(ownerName);
            const owner = declarationsByName.get(ownerName);
            current = owner?.members?.find(
              (candidate) =>
                candidate.kind === 'field' && candidate.name === 'defaultValue'
            );
            if (!current) break;
            type ??= current.type;
            defaultValue ??= current.default;
          }
          return { type, defaultValue };
        };

        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            const adapter = declaration.members?.find(
              (candidate) =>
                candidate.kind === 'field' &&
                candidate.name === 'defaultValueAlias' &&
                candidate.attribute === 'default-value'
            );
            const attribute = declaration.attributes?.find(
              (candidate) => candidate.name === 'default-value'
            );
            if (!adapter || !attribute) continue;
            const canonical = declaration.members.find(
              (candidate) =>
                candidate.kind === 'field' && candidate.name === 'defaultValue'
            );
            if (!canonical) {
              throw new Error(
                `${
                  declaration.tagName ?? declaration.name
                }: default-value adapter requires the supported defaultValue property`
              );
            }
            const { type, defaultValue } = canonicalContract(
              declaration,
              canonical
            );
            if (!type || defaultValue === undefined) {
              throw new Error(
                `${
                  declaration.tagName ?? declaration.name
                }: default-value adapter requires defaultValue type and default metadata`
              );
            }

            adapter.privacy = 'private';
            attribute.fieldName = 'defaultValue';
            attribute.type = structuredClone(type);
            attribute.default = defaultValue;
            attribute.description =
              'Compatibility attribute alias for the supported `defaultValue` reset value.';
          }
        }

        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-locked-chart-type-defaults',
      // The mirrored typed-chart subclasses change only the writable type property's default.
      // Histogram alone installs lockChartType(), so only its type is narrowed to a literal.
      // Project both distinctions because CEM inheritance otherwise retains LyraChart's default
      // and cannot observe the prototype-installed histogram accessor.
      packageLinkPhase({ customElementsManifest }) {
        const DEFAULT_TYPES = new Map([
          ['lr-bar-chart', 'bar'],
          ['lr-bubble-chart', 'bubble'],
          ['lr-doughnut-chart', 'doughnut'],
          ['lr-histogram', 'bar'],
          ['lr-line-chart', 'line'],
          ['lr-pie-chart', 'pie'],
          ['lr-polar-area-chart', 'polarArea'],
          ['lr-radar-chart', 'radar'],
          ['lr-scatter-chart', 'scatter'],
        ]);
        const LITERAL_TYPES = new Set(['lr-histogram']);

        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            const defaultType = DEFAULT_TYPES.get(declaration.tagName);
            if (!defaultType) continue;
            const member = declaration.members?.find(
              (candidate) =>
                candidate.kind === 'field' && candidate.name === 'type'
            );
            const attribute = declaration.attributes?.find(
              (candidate) => candidate.name === 'type'
            );
            if (!member || !attribute) {
              throw new Error(
                `${declaration.tagName}: chart type projection requires inherited type member and attribute metadata`
              );
            }
            const literalType = `'${defaultType}'`;
            if (LITERAL_TYPES.has(declaration.tagName)) {
              member.type = { text: literalType };
              attribute.type = { text: literalType };
            }
            member.default = literalType;
            // CEM labels syntax-level subclass overrides as inherited. This projection records the
            // subclass's effective default, so retain it during compacting instead of falling back
            // to LyraChart's default.
            delete member.inheritedFrom;
            attribute.default = literalType;
            delete attribute.inheritedFrom;
          }
        }

        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-inherited-public-member-contracts',
      packageLinkPhase({ customElementsManifest }) {
        const declarations = new Map();
        const classes = new Map();
        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            if (declaration.kind === 'class' && declaration.name)
              classes.set(declaration.name, { declaration, module });
            if (declaration.tagName)
              declarations.set(declaration.tagName, { declaration, module });
          }
        }

        for (const [targetTag, contract] of INHERITED_PUBLIC_MEMBER_CONTRACTS) {
          const target = declarations.get(targetTag);
          const source = contract.sourceClass
            ? classes.get(contract.sourceClass)
            : declarations.get(contract.sourceTag);
          const sourceName = contract.sourceClass ?? contract.sourceTag;
          if (!target)
            throw new Error(
              `${targetTag}: inherited-member projection requires target declaration`
            );
          if (!source) {
            throw new Error(
              `${targetTag}: inherited-member projection requires source ${sourceName}`
            );
          }
          target.declaration.members ??= [];
          for (const name of contract.members ?? []) {
            const sourceMember = source.declaration.members?.find(
              (member) => member.name === name
            );
            if (!sourceMember) {
              throw new Error(
                `${targetTag}: inherited-member projection requires ${sourceName}.${name}`
              );
            }
            const projected = {
              ...structuredClone(sourceMember),
              inheritedFrom: {
                name: source.declaration.name,
                module: source.module.path,
              },
            };
            const projectedType = contract.memberTypes?.[name];
            if (projectedType) {
              projected.type = { ...projected.type, text: projectedType };
              delete projected.inheritedFrom;
            }
            const existingMember = target.declaration.members.find(
              (member) => member.name === name
            );
            if (existingMember) {
              Object.assign(existingMember, projected);
              if (!projected.inheritedFrom) delete existingMember.inheritedFrom;
            } else target.declaration.members.push(projected);

            if (!projected.attribute) continue;
            target.declaration.attributes ??= [];
            const sourceAttribute = source.declaration.attributes?.find(
              (attribute) => attribute.name === projected.attribute
            );
            if (!sourceAttribute) continue;
            const projectedAttribute = structuredClone(sourceAttribute);
            if (projectedType) {
              projectedAttribute.type = {
                ...projectedAttribute.type,
                text: projectedType,
              };
              delete projectedAttribute.inheritedFrom;
            } else {
              projectedAttribute.inheritedFrom = {
                name: source.declaration.name,
                module: source.module.path,
              };
            }
            const existingAttribute = target.declaration.attributes.find(
              (attribute) => attribute.name === projected.attribute
            );
            if (existingAttribute) {
              Object.assign(existingAttribute, projectedAttribute);
              if (!projectedAttribute.inheritedFrom)
                delete existingAttribute.inheritedFrom;
            } else target.declaration.attributes.push(projectedAttribute);
          }

          if (contract.events?.length) target.declaration.events ??= [];
          for (const name of contract.events ?? []) {
            const sourceEvent = source.declaration.events?.find(
              (event) => event.name === name
            );
            if (!sourceEvent) {
              throw new Error(
                `${targetTag}: inherited-member projection requires ${sourceName}#${name}`
              );
            }
            const projectedEvent = structuredClone(sourceEvent);
            // This is the permanent tag alias's own effective manifest contract. Retaining an
            // inheritance marker would make compactManifest remove the event even though the
            // alias dispatches it through the same inherited runtime path.
            delete projectedEvent.inheritedFrom;
            const existingEvent = target.declaration.events.find(
              (event) => event.name === name
            );
            if (existingEvent) {
              Object.assign(existingEvent, projectedEvent);
              delete existingEvent.inheritedFrom;
            } else target.declaration.events.push(projectedEvent);
          }
        }

        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-concrete-generic-member-contracts',
      packageLinkPhase({ customElementsManifest }) {
        const declarations = new Map();
        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            if (declaration.tagName)
              declarations.set(declaration.tagName, declaration);
          }
        }
        for (const [tagName, contract] of CONCRETE_GENERIC_MEMBER_CONTRACTS) {
          const declaration = declarations.get(tagName);
          if (!declaration)
            throw new Error(
              `${tagName}: generic-member projection requires declaration`
            );
          for (const [name, metadata] of Object.entries(contract)) {
            const member = declaration.members?.find(
              (candidate) =>
                candidate.kind === 'field' && candidate.name === name
            );
            const attribute = declaration.attributes?.find(
              (candidate) => candidate.name === (member?.attribute ?? name)
            );
            if (!member || !attribute) {
              throw new Error(
                `${tagName}.${name}: generic-member projection requires member and attribute`
              );
            }
            for (const [surface, entry] of [
              ['member', member],
              ['attribute', attribute],
            ]) {
              const current = entry.type?.text;
              if (
                current !== metadata.genericType &&
                current !== metadata.type
              ) {
                throw new Error(
                  `${tagName}.${name}: ${surface} type must be generic ${metadata.genericType} before projection`
                );
              }
              entry.type = { ...entry.type, text: metadata.type };
              delete entry.inheritedFrom;
            }
          }
        }
        for (const [tagName, contract] of ATTRIBUTE_ONLY_CONTRACTS) {
          const declaration = (customElementsManifest.modules ?? [])
            .flatMap((module) => module.declarations ?? [])
            .find((candidate) => candidate.tagName === tagName);
          if (!declaration)
            throw new Error(
              `${tagName}: attribute-only contract requires declaration`
            );
          for (const [name, metadata] of Object.entries(contract)) {
            const attribute = declaration.attributes?.find(
              (candidate) => candidate.name === name
            );
            if (!attribute)
              throw new Error(
                `${tagName}[${name}]: attribute-only contract requires attribute`
              );
            attribute.type = { text: metadata.type };
          }
        }
        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-accessor-runtime-contracts',
      // CEM cannot infer the initial value of a hand-written accessor from its private backing
      // field. Project only the declared accessors whose runtime defaults are covered by component
      // tests. Derived custom states remain getter-only properties: state publication may mirror
      // an implementation attribute, but that does not make the attribute author-configurable.
      packageLinkPhase({ customElementsManifest }) {
        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            const contract = ACCESSOR_RUNTIME_CONTRACTS.get(
              declaration.tagName
            );
            if (!contract) continue;
            declaration.members ??= [];
            declaration.attributes ??= [];

            for (const [name, metadata] of Object.entries(contract)) {
              const member = declaration.members.find(
                (candidate) =>
                  candidate.kind === 'field' && candidate.name === name
              );
              if (!member) {
                throw new Error(
                  `${declaration.tagName}: accessor projection requires public member ${name}`
                );
              }
              member.default = metadata.default;
              if (metadata.attribute) member.attribute ??= metadata.attribute;
              if (metadata.reflects !== undefined)
                member.reflects = metadata.reflects;
              if (metadata.readonly !== undefined)
                member.readonly = metadata.readonly;
              // Every entry in this table is backed by a focused runtime contract. Once projected,
              // it is an effective subclass override and must survive compact-manifest inheritance
              // pruning instead of being replaced with its base class's default/type/reflection.
              delete member.inheritedFrom;

              if (!metadata.attribute) continue;
              let attribute = declaration.attributes.find(
                (candidate) => candidate.name === metadata.attribute
              );
              if (!attribute && metadata.createAttribute) {
                attribute = {
                  name: metadata.attribute,
                  fieldName: name,
                  type: member.type ?? { text: 'unknown' },
                  ...(member.description
                    ? { description: member.description }
                    : {}),
                };
                declaration.attributes.push(attribute);
              }
              if (!attribute) {
                throw new Error(
                  `${declaration.tagName}: accessor projection requires attribute ${metadata.attribute}`
                );
              }
              attribute.fieldName ??= name;
              attribute.default = metadata.default;
              delete attribute.inheritedFrom;
            }
          }
        }

        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-form-owner-write-types',
      // Getter/setter pairs expose one JavaScript property but two useful TypeScript types. Apply
      // the native-like form-owner contract after every inheritance/runtime projection so direct
      // ElementInternals controls and FormAssociated mixin consumers receive identical metadata.
      packageLinkPhase({ customElementsManifest }) {
        const readType = 'HTMLFormElement | null';
        const writeType = 'HTMLFormElement | string | null';
        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            const member = declaration.members?.find(
              (candidate) =>
                candidate.kind === 'field' &&
                candidate.name === 'form' &&
                candidate.privacy !== 'private' &&
                candidate.privacy !== 'protected'
            );
            if (!member) continue;
            const current = member.type?.text;
            if (current !== readType && current !== writeType) {
              throw new Error(
                `${declaration.tagName ?? declaration.name}.form: form-owner type must be canonical ${readType}`
              );
            }
            member.type = { ...member.type, text: writeType };
            member.lyraReadType = { text: readType };
            member.attribute ??= 'form';
            member.reflects = true;
            member.default ??= 'null';

            declaration.attributes ??= [];
            let attribute = declaration.attributes.find(
              (candidate) => candidate.name === 'form'
            );
            if (!attribute) {
              attribute = { name: 'form' };
              declaration.attributes.push(attribute);
            }
            const attributeType = attribute.type?.text;
            if (
              attributeType !== undefined &&
              attributeType !== readType &&
              attributeType !== writeType
            ) {
              throw new Error(
                `${declaration.tagName ?? declaration.name}[form]: form-owner type must be canonical ${readType}`
              );
            }
            attribute.type = { ...attribute.type, text: writeType };
            attribute.fieldName = 'form';
            attribute.default ??= 'null';
          }
        }
        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-accessor-write-types',
      packageLinkPhase({ customElementsManifest }) {
        const declarations = new Map();
        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            if (declaration.tagName)
              declarations.set(declaration.tagName, declaration);
          }
        }

        for (const [tagName, contract] of ACCESSOR_WRITE_TYPE_CONTRACTS) {
          const declaration = declarations.get(tagName);
          if (!declaration)
            throw new Error(
              `${tagName}: write-type projection requires component declaration`
            );
          for (const [name, metadata] of Object.entries(contract)) {
            const member = declaration.members?.find(
              (candidate) =>
                candidate.kind === 'field' && candidate.name === name
            );
            const attribute =
              metadata.attribute === false
                ? undefined
                : declaration.attributes?.find(
                    (candidate) =>
                      candidate.name === (member?.attribute ?? name)
                  );
            if (!member || (metadata.attribute !== false && !attribute)) {
              throw new Error(
                `${tagName}.${name}: write-type projection requires member${metadata.attribute === false ? '' : ' and attribute'} metadata`
              );
            }
            member.lyraReadType = { text: metadata.readType };
            for (const [surface, entry] of [
              ['member', member],
              ...(attribute ? [['attribute', attribute]] : []),
            ]) {
              const current = entry.type?.text;
              if (
                current !== metadata.readType &&
                current !== metadata.writeType
              ) {
                throw new Error(
                  `${tagName}.${name}: ${surface} type must be canonical ${metadata.readType} before write projection`
                );
              }
              entry.type = { ...entry.type, text: metadata.writeType };
              // The wider setter vocabulary is the reviewed effective contract for this tag, not
              // an unchanged inherited entry. Keep it in the compact declaration (notably
              // lr-tag's additional `text` write token).
              delete entry.inheritedFrom;
            }
          }
        }

        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-effective-attribute-contracts',
      // CEM derives an attribute and its linked field in separate passes. Named field constants
      // and inherited accessor overrides can consequently leave the attribute with an identifier
      // default or no type even when the effective field is precise. Resolve source-local literal
      // constants, then make the associated field authoritative for type/default metadata.
      packageLinkPhase({ customElementsManifest }) {
        const modulesByPath = new Map(
          (customElementsManifest.modules ?? []).map((module) => [
            normalizeSourcePath(module.path),
            module,
          ])
        );
        const constantsByPath = new Map();
        const constantsFor = (modulePath) => {
          const normalized = normalizeSourcePath(modulePath);
          if (constantsByPath.has(normalized))
            return constantsByPath.get(normalized);
          const module = modulesByPath.get(normalized);
          const constants = new Map();
          if (module) {
            const source = readFileSync(
              new URL(`./${normalized}`, import.meta.url),
              'utf8'
            );
            const declaration =
              /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)[^=;\n]*=\s*([^;\n]+)\s*;/g;
            for (const match of source.matchAll(declaration)) {
              const value = match[2].trim();
              if (
                /^(?:'[^']*'|"[^"]*"|-?\d+(?:\.\d+)?|true|false|null|undefined|Infinity)$/.test(
                  value
                )
              ) {
                constants.set(
                  match[1],
                  value.startsWith('"') ? `'${value.slice(1, -1)}'` : value
                );
              }
            }
          }
          constantsByPath.set(normalized, constants);
          return constants;
        };
        const resolveDefault = (value, modulePath) => {
          let current = value;
          const seen = new Set();
          while (
            typeof current === 'string' &&
            /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(current) &&
            !['true', 'false', 'null', 'undefined', 'Infinity'].includes(
              current
            )
          ) {
            if (seen.has(current)) return undefined;
            seen.add(current);
            current = constantsFor(modulePath).get(current);
            if (current === undefined) return undefined;
          }
          return current;
        };

        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            if (!declaration.tagName) continue;
            for (const attribute of declaration.attributes ?? []) {
              const member =
                (declaration.members ?? []).find(
                  (candidate) =>
                    candidate.kind === 'field' &&
                    candidate.name === (attribute.fieldName ?? attribute.name)
                ) ??
                (declaration.members ?? []).find(
                  (candidate) =>
                    candidate.kind === 'field' &&
                    candidate.attribute === attribute.name
                );
              // A few compatibility-only attributes intentionally target private adapters. They
              // remain in the CEM, but have no public property contract to synchronize here.
              if (!member) continue;
              const ownerPath = member.inheritedFrom?.module ?? module.path;
              if (member.default !== undefined) {
                const resolved = resolveDefault(member.default, ownerPath);
                if (resolved === undefined) {
                  throw new Error(
                    `${declaration.tagName}.${member.name}: unresolved public default ${member.default}`
                  );
                }
                member.default = resolved;
                attribute.default = resolved;
              } else if (attribute.default !== undefined) {
                const resolved = resolveDefault(attribute.default, ownerPath);
                if (resolved === undefined) {
                  throw new Error(
                    `${declaration.tagName}[${attribute.name}]: unresolved public default ${attribute.default}`
                  );
                }
                attribute.default = resolved;
              }
              if (member.type?.text)
                attribute.type = structuredClone(member.type);
              attribute.fieldName = member.name;
            }
          }
        }
        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-event-runtime-contracts',
      packageLinkPhase({ customElementsManifest }) {
        const contracts = sourceEventTypeContracts(customElementsManifest);
        const visitedExplicitTags = new Set();
        for (const [tagName, explicit] of EVENT_RUNTIME_CONTRACTS) {
          const contract = contracts.get(tagName) ?? {};
          for (const [name, type] of Object.entries(explicit)) {
            if (contract[name] !== undefined && contract[name] !== type) {
              throw new Error(
                `${tagName}#${name}: explicit event type ${type} conflicts with source EventMap ${contract[name]}`
              );
            }
            contract[name] = type;
          }
          contracts.set(tagName, contract);
        }
        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            if (EVENT_RUNTIME_CONTRACTS.has(declaration.tagName)) {
              visitedExplicitTags.add(declaration.tagName);
            }
            const contract = contracts.get(declaration.tagName);
            if (!contract) continue;
            for (const [name, type] of Object.entries(contract)) {
              const event = declaration.events?.find(
                (candidate) => candidate.name === name
              );
              if (!event) {
                if (
                  EVENT_RUNTIME_CONTRACTS.get(declaration.tagName)?.[name] !==
                  undefined
                ) {
                  throw new Error(
                    `${declaration.tagName}: event projection requires public event ${name}`
                  );
                }
                // Shared/mixin EventMaps may intentionally document inherited events once on the
                // owner rather than materializing them on every consumer declaration.
                continue;
              }
              event.type = { text: type };
              // A subclass-authored event description can deliberately refine inherited runtime
              // behavior. The projection table is the review boundary that makes retaining that
              // event in the compact subclass declaration explicit.
              if (
                EVENT_RUNTIME_CONTRACTS.get(declaration.tagName)?.[name] !==
                undefined
              ) {
                delete event.inheritedFrom;
              }
            }
          }
        }
        for (const tagName of EVENT_RUNTIME_CONTRACTS.keys()) {
          if (!visitedExplicitTags.has(tagName)) {
            throw new Error(
              `${tagName}: event projection requires component declaration`
            );
          }
        }

        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-component-maturity-metadata',
      // Status assignments and introduction versions come from centralized metadata: the latter are
      // derived from exact release-manifest history, not guessed from the current source tree.
      // Project them after every analyzer/inheritance correction so CEM, Storybook, editor data,
      // and generated component references all consume the same structured contract.
      packageLinkPhase({ customElementsManifest }) {
        applyComponentMetadataToManifest(
          componentMetadata,
          customElementsManifest,
          {
            packageVersion,
          }
        );
        sortManifest(customElementsManifest);
      },
    },
  ],
};

function compareText(left, right) {
  const a = String(left ?? '');
  const b = String(right ?? '');
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalizeSourcePath(path = '') {
  return path.replace(/^\//, '').replace(/\.js$/, '.ts');
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort(compareText)
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sortRecords(records, keys) {
  records.sort((left, right) => {
    for (const key of keys) {
      const result = compareText(left?.[key], right?.[key]);
      if (result !== 0) return result;
    }
    return compareText(stableStringify(left), stableStringify(right));
  });
}

function sortManifest(manifest) {
  sortRecords(manifest.modules, ['path']);
  for (const module of manifest.modules) {
    sortRecords(module.declarations ?? [], ['kind', 'name', 'tagName']);
    sortRecords(module.exports ?? [], ['kind', 'name']);

    for (const declaration of module.declarations ?? []) {
      sortRecords(declaration.members ?? [], ['kind', 'name', 'attribute']);
      sortRecords(declaration.attributes ?? [], ['name', 'fieldName']);
      sortRecords(declaration.events ?? [], ['name']);
      sortRecords(declaration.cssParts ?? [], ['name']);
      sortRecords(declaration.slots ?? [], ['name']);
    }
  }
}
