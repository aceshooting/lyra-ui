/**
 * The `value` shape a picker's `multiple` flag implies, at the type level only.
 *
 * `<lr-select>` and `<lr-combobox>` have always returned a `string` outside `multiple` mode and a
 * `string[]` inside it, but nothing said so to TypeScript: the declared type was the union of both,
 * so every consumer that knew perfectly well which mode its own markup was in still had to narrow
 * by hand, and a genuine mistake (`el.value.trim()` on a multi-select) type-checked.
 *
 * Parameterizing the two components on `Multiple` lets the declared type follow the flag. The
 * default parameter is `boolean`, and `boolean extends Multiple` is true only for that unnarrowed
 * default, so an untyped `<lr-select>` — which is every shipped call site — keeps exactly today's
 * union and compiles unchanged. This is deliberately a types-only change: the runtime, the
 * reflected attributes, and the mirrored Web Awesome/Shoelace surface are all untouched.
 *
 * ```ts
 * declare const single: LyraSelect<false>;
 * declare const many: LyraSelect<true>;
 * declare const unknown: LyraSelect;
 * single.value.trim();          // string
 * many.value.length;            // string[]
 * unknown.value;                // string | string[], exactly as before
 * ```
 */
export type LyraPickerValue<Multiple extends boolean> = boolean extends Multiple
  ? string | string[]
  : Multiple extends true
    ? string[]
    : string;

/**
 * The same narrowing for an event detail, where the array half is readonly.
 *
 * Event details are frozen snapshots (`LyraEventDetailSnapshot`), so the multi-select half is
 * `readonly string[]` rather than `string[]` — mirroring the detail types these components already
 * publish, so adopting the generic changes no existing listener's inferred type.
 */
export type LyraPickerDetailValue<Multiple extends boolean> =
  boolean extends Multiple
    ? string | readonly string[]
    : Multiple extends true
      ? readonly string[]
      : string;
