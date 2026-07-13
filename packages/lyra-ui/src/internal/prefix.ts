export const LYRA_PREFIX = 'lyra';

export const tag = (name: string): string => `${LYRA_PREFIX}-${name}`;

/** Idempotent registration — safe if a module is imported twice. */
export function defineElement(name: string, ctor: CustomElementConstructor): void {
  const t = tag(name);
  const existing = customElements.get(t);
  if (existing) {
    if (existing !== ctor) {
      console.warn(`[lyra] tag "${t}" is already registered with a different constructor`);
    }
    return;
  }
  customElements.define(t, ctor);
}
