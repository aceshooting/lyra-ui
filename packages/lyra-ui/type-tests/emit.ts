// Compile-only contract for `LyraElement`'s `emit()`.
//
// `addEventListener`/`removeEventListener` have always been keyed by a component's `Events` map,
// but the dispatch side was `emit<T = unknown>(name: string, detail?: T)` -- a bare `string` name
// and an unconstrained detail. A typo'd event name and a wrong detail shape both type-checked, so
// the EventMap, the class JSDoc, `custom-elements.json` and `llms/<family>.md` could stay in
// perfect agreement with each other while disagreeing with the code that actually dispatches.
// Nothing in `scripts/check-event-*.mjs` looks at `emit()` call sites, so this file is the gate.
//
// `emit()` is `protected`, so every assertion below is written from inside a subclass, which is
// also exactly how a real component calls it.

import { LyraElement } from '../src/lyra.js';

interface ProbeEventMap {
  /** A detail-carrying event: `detail` is required and structurally checked. */
  'lr-probe-change': CustomEvent<{ value: string; count: number }>;
  /** A notification with no payload: `detail` is omittable. */
  'lr-probe-done': CustomEvent<undefined>;
}

class Probe extends LyraElement<ProbeEventMap> {
  /** The calls a correct component makes. None of these may become an error. */
  correct(): void {
    this.emit('lr-probe-change', { value: 'ok', count: 1 });
    this.emit('lr-probe-done');
    this.emit('lr-probe-done', undefined, { cancelable: true });

    // The return type follows the map too, so a veto point can read its own detail back.
    const vetoable = this.emit('lr-probe-change', { value: 'ok', count: 1 }, { cancelable: true });
    const value: string = vetoable.detail.value;
    const prevented: boolean = vetoable.defaultPrevented;
    void value;
    void prevented;
  }

  /** A misspelled event name is a compile error. */
  wrongName(): void {
    // @ts-expect-error - `lr-probe-chnage` is not a key of `ProbeEventMap`. Before `emit()` was
    // keyed by the map this line compiled and dispatched an event nothing could ever listen for.
    this.emit('lr-probe-chnage', { value: 'ok', count: 1 });
  }

  /** A detail whose property names do not match the map is a compile error. */
  wrongDetailKeys(): void {
    // @ts-expect-error - the declared detail is `{ value: string; count: number }`; there is no
    // `valu`, and `value` is missing entirely.
    this.emit('lr-probe-change', { valu: 'ok', count: 1 });
  }

  /** A detail whose property types do not match the map is a compile error. */
  wrongDetailTypes(): void {
    // @ts-expect-error - `value` is declared `string`, not `number`.
    this.emit('lr-probe-change', { value: 1, count: 1 });
  }

  /** Omitting a non-optional detail is a compile error. */
  missingRequiredDetail(): void {
    // @ts-expect-error - `lr-probe-change` declares a detail, so it cannot be omitted.
    this.emit('lr-probe-change');
  }

  /** Passing a detail to an event that declares none is a compile error. */
  unexpectedDetail(): void {
    // @ts-expect-error - `lr-probe-done`'s detail is `undefined`; there is nothing to carry.
    this.emit('lr-probe-done', { value: 'ok' });
  }
}
void Probe;

// A component that declares no event map keeps the permissive `LyraEventMap` default, so the
// constraint is opt-in per component and cannot break an un-migrated subclass.
class UntypedProbe extends LyraElement {
  anything(): void {
    this.emit('lr-whatever', { free: 'form' });
    this.emit('lr-whatever');
  }
}
void UntypedProbe;
