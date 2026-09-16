/**
 * Part-name state tokens.
 *
 * `::part()` accepts only pseudo-classes after it, so `::part(segment)[data-selected]` is invalid
 * CSS and a consumer cannot reach a per-entry state through an attribute. The state has to live in
 * the PART NAME itself — `part="segment segment-selected"`, styled as `::part(segment-selected)`.
 *
 * Four components had each hand-rolled that string independently (a `statePart(base, selected)`
 * taking one boolean, two `[...].filter(Boolean).join(' ')` arrays, and a nested ternary emitting
 * two alias names), so every new state meant a new bespoke expression and the emitted vocabulary
 * drifted: some components join with `-`, the ones mirroring an upstream tag join with `--`, and
 * one emits both. This builds all of those shapes from one declaration so the token order is
 * stable, a falsy state never emits an empty token, and an unstated element still renders the bare
 * base name unchanged.
 *
 * Three shipped shapes it deliberately does NOT serve, because adopting it would silently RENAME a
 * public part name: `lr-checkbox`/`lr-radio`/`lr-radio-button` publish a bare word alongside the
 * prefixed alias (`checked` AND `control--checked`), and `lr-otp-input` publishes state tokens with
 * no base prefix at all (`active`, `masked`, `invalid`). Those stay hand-rolled until their
 * vocabulary is revisited deliberately. `lr-tree-item`'s `item--selected` family IS expressible,
 * through `separators: ['--']`.
 */

/**
 * States for one part, in the order their tokens should appear.
 *
 * `true` emits `<base><sep><name>`. A non-empty string emits `<base><sep><name>-<value>`, which is
 * how a parameterized state is published (a highlight tone, say). `false`, `undefined`, `null` and
 * the empty string emit nothing.
 */
export type PartStates = Readonly<Record<string, boolean | string | undefined | null>>;

export interface StatePartOptions {
  /**
   * Separators between the base name and each active state name. Defaults to `['-']`.
   *
   * A component mirroring a `wa-*`/`sl-*` tag whose published part vocabulary uses `--` passes
   * `['--']`; one that has shipped both spellings passes `['-', '--']` and keeps emitting both, so
   * neither an existing consumer stylesheet nor a migrating one breaks.
   */
  readonly separators?: readonly string[];
}

const DEFAULT_SEPARATORS: readonly string[] = ['-'];

/**
 * Builds the `part` attribute value for a part that carries state in its name.
 *
 * Returns the bare `base` when no state is active, which is what makes migrating an existing
 * component safe: its unstated output is byte-identical to the literal it replaced.
 *
 * @example
 * statePart('segment', { selected: true, empty: false, disabled: true });
 * // 'segment segment-selected segment-disabled'
 */
export function statePart(base: string, states?: PartStates, options?: StatePartOptions): string {
  if (!states) return base;
  const separators = options?.separators ?? DEFAULT_SEPARATORS;
  const names: string[] = [base];
  for (const [state, active] of Object.entries(states)) {
    if (active === undefined || active === null || active === false || active === '') continue;
    const suffix = active === true ? state : `${state}-${active}`;
    for (const separator of separators) {
      const name = `${base}${separator}${suffix}`;
      if (!names.includes(name)) names.push(name);
    }
  }
  return names.join(' ');
}
