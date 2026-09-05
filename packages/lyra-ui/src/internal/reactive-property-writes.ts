import type { ReactiveElement } from 'lit';

const observedSetters = new WeakSet<object>();

/** @internal Observes actual writes after Lit has finalized reactive property accessors. */
export function observeReactivePropertyWrites<T extends ReactiveElement>(
  prototype: T,
  names: readonly PropertyKey[],
  onWrite: (instance: T, name: PropertyKey, value: unknown) => void,
): void {
  for (const name of names) {
    let owner: object | null = prototype;
    let descriptor: PropertyDescriptor | undefined;
    while (owner && !descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(owner, name);
      owner = Object.getPrototypeOf(owner) as object | null;
    }
    const originalSet = descriptor?.set;
    if (!originalSet || observedSetters.has(originalSet)) continue;
    const set = function (this: T, value: unknown): void {
      originalSet.call(this, value);
      onWrite(this, name, value);
    };
    observedSetters.add(set);
    Object.defineProperty(prototype, name, { ...descriptor, set });
  }
}
