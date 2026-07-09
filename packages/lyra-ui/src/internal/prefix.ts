export const LYRA_PREFIX = 'lyra';

export const tag = (name: string): string => `${LYRA_PREFIX}-${name}`;

/** Idempotent registration — safe if a module is imported twice. */
export function defineElement(name: string, ctor: CustomElementConstructor): void {
  const t = tag(name);
  if (!customElements.get(t)) customElements.define(t, ctor);
}
