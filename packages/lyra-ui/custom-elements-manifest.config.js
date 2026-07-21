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
        const mod = customElementsManifest.modules.find(
          (m) => m.path === 'src/internal/lyra-element.ts',
        );
        const decl = mod?.declarations?.find((d) => d.name === 'LyraElement');
        if (decl) delete decl.customElement;

        sortManifest(customElementsManifest);
      },
    },
    {
      name: 'lr-form-associated-mixin-members',
      // `FormAssociated<T>` (`src/internal/form-associated.ts`) is a mixin *function* whose
      // `name`/`value`/`disabled`/`required` accessors are hand-written (`noAccessor: true`),
      // not declarative `@property() accessor` fields. The analyzer only flattens members from a
      // statically-resolvable superclass declaration, so `class X extends FormAssociated(Base)`
      // never inherits these four -- they appear only when a subclass happens to redeclare one
      // itself (e.g. `lr-date-input`'s strict-ISO `value` override). The built-in mixin detector
      // still records `{ name: 'FormAssociated' }` on `declaration.mixins`, so that's the signal
      // used here to inject the missing members onto every other consumer.
      packageLinkPhase({ customElementsManifest }) {
        const MIXIN_MEMBERS = {
          name: { type: 'string', reflects: true },
          value: { type: 'string', reflects: false },
          disabled: { type: 'boolean', reflects: true },
          required: { type: 'boolean', reflects: true },
        };

        for (const module of customElementsManifest.modules ?? []) {
          for (const declaration of module.declarations ?? []) {
            const isFormAssociated = (declaration.mixins ?? []).some(
              (mixin) => mixin.name === 'FormAssociated',
            );
            if (!isFormAssociated) continue;

            declaration.members ??= [];
            declaration.attributes ??= [];

            for (const [name, { type, reflects }] of Object.entries(MIXIN_MEMBERS)) {
              if (declaration.members.some((member) => member.name === name)) continue;

              const member = {
                kind: 'field',
                name,
                privacy: 'public',
                type: { text: type },
              };
              if (reflects) {
                member.attribute = name;
                member.reflects = true;
              }
              declaration.members.push(member);

              if (reflects && !declaration.attributes.some((attribute) => attribute.name === name)) {
                declaration.attributes.push({ name, type: { text: type }, fieldName: name });
              }
            }
          }
        }

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
