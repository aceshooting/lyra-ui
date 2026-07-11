export default {
  globs: ['src/components/**/*.ts', 'src/internal/lyra-element.ts'],
  exclude: ['**/*.test.ts', '**/*.styles.ts'],
  outdir: '.',
  litelement: true,
  plugins: [
    {
      name: 'lyra-internal-base-class-is-not-a-custom-element',
      // `src/internal/lyra-element.ts` is analyzed (see `globs` above) purely so
      // every real `lyra-*` element inherits documentation for its shared
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
      },
    },
  ],
};
