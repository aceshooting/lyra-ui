import { readFileSync } from 'node:fs';

import { applyComponentMetadataToManifest } from './scripts/component-metadata.mjs';
import { sourceEventTypeContracts } from './scripts/check-event-contracts.mjs';

const componentMetadata = JSON.parse(
  readFileSync(new URL('./scripts/fixtures/component-metadata.json', import.meta.url), 'utf8'),
);
const packageVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

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
    'lr-badge',
    {
      size: { default: "'m'", attribute: 'size' },
      variant: { default: "'neutral'", attribute: 'variant' },
    },
  ],
  [
    'lr-button',
    {
      disabled: { default: 'false', attribute: 'disabled' },
      href: { default: 'undefined', attribute: 'href' },
      name: { default: "''", attribute: 'name' },
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
      defaultChecked: { default: 'false', attribute: 'checked', reflects: true },
      customError: { default: 'null', attribute: 'custom-error' },
      disabled: { default: 'false', attribute: 'disabled' },
      form: { default: 'null', attribute: 'form', createAttribute: true, reflects: true },
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
      disabled: { default: 'false', attribute: 'disabled' },
      distance: { default: '0', attribute: 'distance' },
      placement: { default: "'bottom-start'", attribute: 'placement' },
      sync: { default: 'undefined', attribute: 'sync' },
    },
  ],
  [
    'lr-dropdown-item',
    {
      submenuOpen: { default: 'false', attribute: 'submenu-open', reflects: true },
    },
  ],
  [
    'lr-file-input',
    {
      disabled: { default: 'false', attribute: 'disabled' },
      dragging: {
        default: 'false',
        attribute: 'dragging',
        reflects: true,
        readonly: false,
        createAttribute: true,
      },
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
    'lr-icon-button',
    {
      disabled: { default: 'false', attribute: 'disabled' },
      name: { default: "''", attribute: 'name' },
    },
  ],
  [
    'lr-input',
    {
      autocorrect: { default: 'true', attribute: 'autocorrect' },
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
      disabled: { default: 'false', attribute: 'disabled' },
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
      size: { default: "'m'", attribute: 'size' },
      value: { default: '0', attribute: 'value' },
    },
  ],
  [
    'lr-select',
    {
      form: { default: 'null', attribute: 'form', reflects: true },
      selectedOptions: { default: '[]', readonly: false },
      value: { default: "''", attribute: 'value' },
    },
  ],
  [
    'lr-slider',
    {
      form: { default: 'null', attribute: 'form', createAttribute: true, reflects: true },
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
      defaultChecked: { default: 'false', attribute: 'checked', reflects: true },
      customError: { default: 'null', attribute: 'custom-error' },
      disabled: { default: 'false', attribute: 'disabled' },
      form: { default: 'null', attribute: 'form', createAttribute: true, reflects: true },
      name: { default: "''", attribute: 'name' },
      required: { default: 'false', attribute: 'required' },
    },
  ],
  [
    'lr-tag',
    {
      removable: { default: 'false', attribute: 'removable' },
      size: { default: "'m'", attribute: 'size' },
      variant: { default: "'neutral'", attribute: 'variant' },
    },
  ],
  [
    'lr-textarea',
    {
      autocorrect: { default: 'true', attribute: 'autocorrect' },
    },
  ],
  [
    'lr-toast-item',
    {
      size: { default: "'m'", attribute: 'size' },
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
    'lr-badge',
    {
      variant: {
        readType: 'BadgeVariant',
        writeType: "BadgeVariant | 'primary'",
      },
      size: {
        readType: 'BadgeSize',
        writeType: "BadgeSize | 'small' | 'medium' | 'large'",
      },
    },
  ],
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
    'lr-input',
    {
      autocorrect: {
        readType: 'boolean',
        writeType: "boolean | 'off' | 'on'",
      },
    },
  ],
  [
    'lr-tag',
    {
      variant: {
        readType: 'BadgeVariant',
        writeType: "BadgeVariant | 'primary' | 'text'",
      },
      size: {
        readType: 'BadgeSize',
        writeType: "BadgeSize | 'small' | 'medium' | 'large'",
      },
    },
  ],
  [
    'lr-rating',
    {
      size: {
        readType: 'LyraRatingSize',
        writeType: "LyraRatingSize | 'small' | 'medium' | 'large'",
      },
    },
  ],
  [
    'lr-split-panel',
    {
      snap: {
        readType: 'string | SnapFunction',
        writeType: 'string | SnapFunction | undefined',
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
  [
    'lr-toast-item',
    {
      size: {
        readType: 'ToastSize',
        writeType: "ToastSize | 'small' | 'medium' | 'large'",
      },
    },
  ],
]);

// CEM's inheritance pass omits a small class-field edge case: a public readonly field initialized
// on the base class is not copied to a subclass even though the runtime instance inherits the
// field normally. Keep the compatibility projection explicit and source-linked so a rename fails closed.
export const INHERITED_PUBLIC_MEMBER_CONTRACTS = new Map([
  ['lr-drawer', { sourceTag: 'lr-dialog', members: ['modal'] }],
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
      'lr-hide': 'CustomEvent<undefined>',
      'lr-show': 'CustomEvent<undefined>',
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
        const [name, classReference] = node.arguments ?? [];
        if (!name?.text || !classReference) return;

        const tagName = `lr-${name.text}`;
        const className = classReference.getText();
        if (moduleDoc.exports.some((entry) => entry.kind === 'custom-element-definition' && entry.name === tagName)) {
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
            if (declaration.kind === 'class') classes.set(declaration.name, { declaration, module });
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
        const mod = customElementsManifest.modules.find((m) => m.path === 'src/internal/lyra-element.ts');
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
            description: 'Consumer-supplied validation message reflected through `custom-error`.',
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
          // `form` content attribute. CEM cannot spell different getter/setter types, but it must
          // still advertise the real attribute and the element-valued read/default.
          form: {
            type: 'HTMLFormElement | null',
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
            description: 'Runs constraint validation and returns whether the control is valid.',
          },
          getForm: {
            returnType: 'HTMLFormElement | null',
            description: 'Returns the browser-resolved form owner, including an external owner selected by `form`.',
          },
          reportValidity: {
            returnType: 'boolean',
            description: 'Runs interactive constraint validation and reports an invalid result.',
          },
          resetValidity: {
            returnType: 'void',
            description: 'Clears consumer-supplied validity and restores the current intrinsic constraints.',
          },
          setCustomValidity: {
            returnType: 'void',
            parameters: [{ name: 'message', type: { text: 'string' } }],
            description: 'Sets or clears a consumer-supplied validation message without discarding intrinsic validity.',
          },
          formStateRestoreCallback: {
            returnType: 'void',
            parameters: [
              { name: 'state', type: { text: 'string | File | FormData | null' } },
              { name: 'reason', type: { text: "'autocomplete' | 'restore'" } },
            ],
            description: 'Restores browser session-history or autocomplete state without emitting a user event.',
          },
        };

        const declarationEntries = (customElementsManifest.modules ?? []).flatMap((module) =>
          (module.declarations ?? []).map((declaration) => ({
            declaration,
            module,
          })),
        );
        const declarationByName = new Map(declarationEntries.map((entry) => [entry.declaration.name, entry]));
        // CEM's built-in inheritance projection runs before this project plugin. Carry the
        // synthesized mixin contract through subclasses here as well, otherwise a class such as
        // LyraNativeTimeInput inherits LyraInput at runtime but loses the form surface in CEM.
        const formAssociated = new Map();
        for (const { declaration } of declarationEntries) {
          if ((declaration.mixins ?? []).some((mixin) => mixin.name === 'FormAssociated')) {
            formAssociated.set(declaration, null);
          }
        }
        let discoveredSubclass = true;
        while (discoveredSubclass) {
          discoveredSubclass = false;
          for (const { declaration } of declarationEntries) {
            if (formAssociated.has(declaration)) continue;
            const parentEntry = declarationByName.get(declaration.superclass?.name);
            if (!parentEntry || !formAssociated.has(parentEntry.declaration)) continue;
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

          for (const [name, metadata] of Object.entries(MIXIN_FIELDS)) {
            let member = declaration.members.find((candidate) => candidate.kind === 'field' && candidate.name === name);
            if (!member) {
              member = {
                kind: 'field',
                name,
                privacy: 'public',
                ...(inheritedFrom ? { inheritedFrom } : {}),
              };
              declaration.members.push(member);
            }
            member.type ??= { text: metadata.type };
            if (metadata.description) member.description ??= metadata.description;
            if (metadata.attribute && member.attribute === undefined) {
              member.attribute = metadata.attribute;
            }
            if (metadata.reflects && member.reflects === undefined) member.reflects = true;
            if (metadata.readonly && member.readonly === undefined) member.readonly = true;
            if (metadata.default !== undefined && member.default === undefined) {
              member.default = metadata.default;
            }

            if (metadata.attribute) {
              let attribute = declaration.attributes.find((candidate) => candidate.name === metadata.attribute);
              if (!attribute) {
                attribute = {
                  name: metadata.attribute,
                  type: { text: metadata.type },
                  fieldName: name,
                  ...(inheritedFrom ? { inheritedFrom } : {}),
                };
                declaration.attributes.push(attribute);
              }
              attribute.type ??= { text: metadata.type };
              if (metadata.description) attribute.description ??= metadata.description;
              attribute.fieldName ??= name;
              if (metadata.default !== undefined && attribute.default === undefined) {
                attribute.default = metadata.default;
              }
            }
          }

          for (const [name, metadata] of Object.entries(MIXIN_METHODS)) {
            let member = declaration.members.find(
              (candidate) => candidate.kind === 'method' && candidate.name === name,
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
            if (metadata.description) member.description ??= metadata.description;
          }
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
            if (declaration.kind === 'class') declarationsByName.set(declaration.name, declaration);
          }
        }

        const canonicalContract = (declaration, member) => {
          let type = member.type;
          let defaultValue = member.default;
          let current = member;
          const seen = new Set([declaration.name]);
          while ((!type || defaultValue === undefined) && current?.inheritedFrom?.name) {
            const ownerName = current.inheritedFrom.name;
            if (seen.has(ownerName)) break;
            seen.add(ownerName);
            const owner = declarationsByName.get(ownerName);
            current = owner?.members?.find(
              (candidate) => candidate.kind === 'field' && candidate.name === 'defaultValue',
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
                candidate.attribute === 'default-value',
            );
            const attribute = declaration.attributes?.find((candidate) => candidate.name === 'default-value');
            if (!adapter || !attribute) continue;
            const canonical = declaration.members.find(
              (candidate) => candidate.kind === 'field' && candidate.name === 'defaultValue',
            );
            if (!canonical) {
              throw new Error(
                `${
                  declaration.tagName ?? declaration.name
                }: default-value adapter requires the supported defaultValue property`,
              );
            }
            const { type, defaultValue } = canonicalContract(declaration, canonical);
            if (!type || defaultValue === undefined) {
              throw new Error(
                `${
                  declaration.tagName ?? declaration.name
                }: default-value adapter requires defaultValue type and default metadata`,
              );
            }

            adapter.privacy = 'private';
            attribute.fieldName = 'defaultValue';
            attribute.type = structuredClone(type);
            attribute.default = defaultValue;
            attribute.description = 'Compatibility attribute alias for the supported `defaultValue` reset value.';
          }
        }

        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-locked-chart-type-defaults',
      // Typed chart subclasses lock their runtime `type` accessor through `lockChartType()` rather
      // than by shadowing LyraChart's reactive field. Inheritance therefore gives CEM the base
      // default (`bar`) for every subclass even though both property reads and the reflected
      // attribute begin at the locked subtype. Correct only those inherited defaults here; the
      // source stays on the single shared implementation and the manifest reports runtime truth.
      packageLinkPhase({ customElementsManifest }) {
        const LOCKED_TYPES = new Map([
          ['lr-bar-chart', 'bar'],
          ['lr-bubble-chart', 'bubble'],
          ['lr-doughnut-chart', 'doughnut'],
          ['lr-line-chart', 'line'],
          ['lr-pie-chart', 'pie'],
          ['lr-polar-area-chart', 'polarArea'],
          ['lr-radar-chart', 'radar'],
          ['lr-scatter-chart', 'scatter'],
        ]);

        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            const lockedType = LOCKED_TYPES.get(declaration.tagName);
            if (!lockedType) continue;
            const member = declaration.members?.find(
              (candidate) => candidate.kind === 'field' && candidate.name === 'type',
            );
            const attribute = declaration.attributes?.find((candidate) => candidate.name === 'type');
            if (!member || !attribute) {
              throw new Error(
                `${declaration.tagName}: locked chart projection requires inherited type member and attribute metadata`,
              );
            }
            member.default = `'${lockedType}'`;
            // CEM labels syntax-level subclass overrides as inherited. This entry is now a
            // reviewed runtime projection for the locked subclass, so retain it during compacting
            // as the subclass's own effective default rather than falling back to LyraChart's.
            delete member.inheritedFrom;
            attribute.default = `'${lockedType}'`;
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
        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            if (declaration.tagName) declarations.set(declaration.tagName, { declaration, module });
          }
        }

        for (const [targetTag, contract] of INHERITED_PUBLIC_MEMBER_CONTRACTS) {
          const target = declarations.get(targetTag);
          const source = declarations.get(contract.sourceTag);
          if (!target) throw new Error(`${targetTag}: inherited-member projection requires target declaration`);
          if (!source) {
            throw new Error(`${targetTag}: inherited-member projection requires source ${contract.sourceTag}`);
          }
          target.declaration.members ??= [];
          for (const name of contract.members) {
            if (target.declaration.members.some((member) => member.name === name)) continue;
            const sourceMember = source.declaration.members?.find((member) => member.name === name);
            if (!sourceMember) {
              throw new Error(`${targetTag}: inherited-member projection requires ${contract.sourceTag}.${name}`);
            }
            target.declaration.members.push({
              ...structuredClone(sourceMember),
              inheritedFrom: {
                name: source.declaration.name,
                module: source.module.path,
              },
            });
          }
        }

        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-accessor-runtime-contracts',
      // CEM cannot infer the initial value of a hand-written accessor from its private backing
      // field. Project only the declared accessors whose runtime defaults are covered by component
      // tests. File Input's read-only `dragging` state is also reflected synchronously by
      // `publishCustomStates()`, so expose the real attribute without adding a writable reactive
      // field that would misrepresent its API.
      packageLinkPhase({ customElementsManifest }) {
        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            const contract = ACCESSOR_RUNTIME_CONTRACTS.get(declaration.tagName);
            if (!contract) continue;
            declaration.members ??= [];
            declaration.attributes ??= [];

            for (const [name, metadata] of Object.entries(contract)) {
              const member = declaration.members.find(
                (candidate) => candidate.kind === 'field' && candidate.name === name,
              );
              if (!member) {
                throw new Error(`${declaration.tagName}: accessor projection requires public member ${name}`);
              }
              member.default = metadata.default;
              if (metadata.attribute) member.attribute ??= metadata.attribute;
              if (metadata.reflects !== undefined) member.reflects = metadata.reflects;
              if (metadata.readonly !== undefined) member.readonly = metadata.readonly;
              // Every entry in this table is backed by a focused runtime contract. Once projected,
              // it is an effective subclass override and must survive compact-manifest inheritance
              // pruning instead of being replaced with its base class's default/type/reflection.
              delete member.inheritedFrom;

              if (!metadata.attribute) continue;
              let attribute = declaration.attributes.find((candidate) => candidate.name === metadata.attribute);
              if (!attribute && metadata.createAttribute) {
                attribute = {
                  name: metadata.attribute,
                  fieldName: name,
                  type: member.type ?? { text: 'unknown' },
                  ...(member.description ? { description: member.description } : {}),
                };
                declaration.attributes.push(attribute);
              }
              if (!attribute) {
                throw new Error(`${declaration.tagName}: accessor projection requires attribute ${metadata.attribute}`);
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
      name: 'lr-accessor-write-types',
      packageLinkPhase({ customElementsManifest }) {
        const declarations = new Map();
        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            if (declaration.tagName) declarations.set(declaration.tagName, declaration);
          }
        }

        for (const [tagName, contract] of ACCESSOR_WRITE_TYPE_CONTRACTS) {
          const declaration = declarations.get(tagName);
          if (!declaration) throw new Error(`${tagName}: write-type projection requires component declaration`);
          for (const [name, metadata] of Object.entries(contract)) {
            const member = declaration.members?.find(
              (candidate) => candidate.kind === 'field' && candidate.name === name,
            );
            const attribute = declaration.attributes?.find(
              (candidate) => candidate.name === (member?.attribute ?? name),
            );
            if (!member || !attribute) {
              throw new Error(`${tagName}.${name}: write-type projection requires member and attribute metadata`);
            }
            for (const [surface, entry] of [['member', member], ['attribute', attribute]]) {
              const current = entry.type?.text;
              if (current !== metadata.readType && current !== metadata.writeType) {
                throw new Error(
                  `${tagName}.${name}: ${surface} type must be canonical ${metadata.readType} before write projection`,
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
      name: 'lr-event-runtime-contracts',
      packageLinkPhase({ customElementsManifest }) {
        const contracts = sourceEventTypeContracts(customElementsManifest);
        const visitedExplicitTags = new Set();
        for (const [tagName, explicit] of EVENT_RUNTIME_CONTRACTS) {
          const contract = contracts.get(tagName) ?? {};
          for (const [name, type] of Object.entries(explicit)) {
            if (contract[name] !== undefined && contract[name] !== type) {
              throw new Error(
                `${tagName}#${name}: explicit event type ${type} conflicts with source EventMap ${contract[name]}`,
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
              const event = declaration.events?.find((candidate) => candidate.name === name);
              if (!event) {
                if (EVENT_RUNTIME_CONTRACTS.get(declaration.tagName)?.[name] !== undefined) {
                  throw new Error(`${declaration.tagName}: event projection requires public event ${name}`);
                }
                // Shared/mixin EventMaps may intentionally document inherited events once on the
                // owner rather than materializing them on every consumer declaration.
                continue;
              }
              event.type = { text: type };
              // A subclass-authored event description can deliberately refine inherited runtime
              // behavior. The projection table is the review boundary that makes retaining that
              // event in the compact subclass declaration explicit.
              if (EVENT_RUNTIME_CONTRACTS.get(declaration.tagName)?.[name] !== undefined) {
                delete event.inheritedFrom;
              }
            }
          }
        }
        for (const tagName of EVENT_RUNTIME_CONTRACTS.keys()) {
          if (!visitedExplicitTags.has(tagName)) {
            throw new Error(`${tagName}: event projection requires component declaration`);
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
        applyComponentMetadataToManifest(componentMetadata, customElementsManifest, {
          packageVersion,
        });
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
