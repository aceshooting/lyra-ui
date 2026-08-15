/**
 * Installs a read-only `type` accessor pair on a `LyraChart` subclass's
 * prototype, locking it to `value` — assigning `.type` afterwards (attribute
 * or property) is silently ignored. `LyraChart` declares `type` as a plain
 * (decorator-managed) class field, and TypeScript forbids a subclass from
 * re-declaring a base field as a getter/setter pair via ordinary class
 * syntax (TS2611), so the accessor pair is installed directly on the
 * prototype instead, which is runtime-equivalent (same shadowing semantics
 * as a class-syntax override) without tripping that check. Used by
 * `lr-histogram`, the one `LyraChart` subclass whose `type` is fixed rather
 * than author-settable; the `lr-*-chart` subclasses (bar/line/pie/doughnut/
 * scatter/bubble/radar/polarArea) each keep a plain writable `override type`
 * field instead, since their mirrored WA counterpart leaves `type` settable.
 *
 * Internal only — not re-exported from the public `chart.ts` barrel. The one
 * caller (`histogram.class.ts`) imports this module directly.
 */
export function lockChartType(ctor: Function, value: string): void {
  Object.defineProperty(ctor.prototype, 'type', {
    configurable: true,
    enumerable: true,
    get(): string {
      return value;
    },
    set(_v: string) {
      /* locked to `value`; direct writes are ignored */
    },
  });
}
