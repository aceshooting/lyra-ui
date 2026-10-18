import { twoFrames } from './frames.js';
export { measureArrayProbeReads } from './array-probe-reads.js';
export { measureArrayMembership } from './array-membership-cost.js';
export { measureElementArrayLookups } from './element-array-lookup-cost.js';

export interface ScaleMeasurement {
  tag: string;
  scenario: string;
  counters: Record<string, number>;
  advisory?: Record<string, number>;
}
declare global {
  interface Window { __LYRA_SCALE__?: ScaleMeasurement[]; }
}

/** Count rendered elements across light DOM and every open descendant shadow root. */
export function renderedNodeCount(host: Element): number {
  let count = 0;
  const visit = (root: Element | ShadowRoot) => {
    for (const child of root.children) {
      count++;
      visit(child);
      if (child.shadowRoot) visit(child.shadowRoot);
    }
  };
  visit(host);
  if (host.shadowRoot) visit(host.shadowRoot);
  return count;
}

/** A reversible method spy. Restore in finally, including when the measured operation rejects. */
export function countCalls<T extends object, K extends keyof T>(target: T, key: K): { readonly calls: number; restore(): void } {
  const own = Object.getOwnPropertyDescriptor(target, key);
  const original = target[key];
  if (typeof original !== 'function') throw new TypeError('countCalls requires a method');
  let calls = 0;
  Object.defineProperty(target, key, { configurable: true, writable: true, value: new Proxy(original, {
    apply(fn, receiver, args) { calls++; return Reflect.apply(fn, receiver, args); },
    construct(fn, args, newTarget) { calls++; return Reflect.construct(fn, args, newTarget); },
  }) });
  return {
    get calls() { return calls; },
    restore() { if (own) Object.defineProperty(target, key, own); else Reflect.deleteProperty(target, key); },
  };
}

/** Memory is advisory: garbage collection and browser support differ between runs. */
export async function measureMemory(): Promise<number | null> {
  const api = performance as Performance & {
    measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
    memory?: { usedJSHeapSize: number };
  };
  if (globalThis.crossOriginIsolated && api.measureUserAgentSpecificMemory) {
    try { return (await api.measureUserAgentSpecificMemory()).bytes; } catch { /* Fall back when unavailable. */ }
  }
  return api.memory?.usedJSHeapSize ?? null;
}

export async function measureScale(host: HTMLElement, options: {
  update: () => unknown;
  settle?: () => Promise<unknown>;
}) {
  const before = await measureMemory();
  const restores: (() => void)[] = [];
  let layoutReads = 0;
  let rectReads = 0;
  let styleReads = 0;
  let definePropertyCalls = 0;
  let intlConstructions = 0;
  const define = Object.defineProperty;
  const method = (target: object, key: PropertyKey, increment: () => void) => {
    const own = Object.getOwnPropertyDescriptor(target, key);
    const original = Reflect.get(target, key) as Function;
    define(target, key, { configurable: true, writable: true, value: new Proxy(original, {
      apply(fn, receiver, args) { increment(); return Reflect.apply(fn, receiver, args); },
      construct(fn, args, newTarget) { increment(); return Reflect.construct(fn, args, newTarget); },
    }) });
    restores.push(() => { if (own) define(target, key, own); else Reflect.deleteProperty(target, key); });
  };
  try {
    method(Element.prototype, 'getBoundingClientRect', () => { layoutReads++; rectReads++; });
    method(window, 'getComputedStyle', () => styleReads++);
    for (const key of ['offsetWidth', 'offsetHeight', 'clientWidth', 'clientHeight', 'scrollTop', 'scrollLeft']) {
      let owner: object | null = HTMLElement.prototype;
      while (owner && !Object.hasOwn(owner, key)) owner = Object.getPrototypeOf(owner) as object | null;
      if (!owner) continue;
      const descriptor = Object.getOwnPropertyDescriptor(owner, key)!;
      if (!descriptor.get) continue;
      const getter = descriptor.get;
      define(owner, key, { ...descriptor, get() { layoutReads++; return getter.call(this); } });
      const originalOwner = owner;
      restores.push(() => { define(originalOwner, key, descriptor); });
    }
    for (const key of ['NumberFormat', 'DateTimeFormat', 'Collator']) method(Intl, key, () => intlConstructions++);
    method(Object, 'defineProperty', () => definePropertyCalls++);
    await options.update();
    await (options.settle ?? twoFrames)();
  } finally {
    for (const restore of restores.reverse()) restore();
  }
  const memoryBytes = await measureMemory();
  return { layoutReads, rectReads, styleReads, domNodes: renderedNodeCount(host), definePropertyCalls, intlConstructions,
    heapDeltaBytes: before === null || memoryBytes === null ? null : memoryBytes - before, memoryBytes };
}

export function recordScaleMeasurement(tag: string, scenario: string, counters: Record<string, number>, advisory?: Record<string, number>): void {
  if (!/^lr-[a-z0-9-]+$/.test(tag) || !scenario.trim() || !Object.keys(counters).length) throw new Error('Invalid scale measurement');
  for (const [key, value] of Object.entries(counters)) {
    if (!Number.isSafeInteger(value) || value < 0 || /(?:ms$|time|duration|heap|memory|bytes)/i.test(key)) throw new Error(`Invalid deterministic counter: ${key}`);
  }
  const measurement: ScaleMeasurement = { tag, scenario, counters: { ...counters }, ...(advisory ? { advisory: { ...advisory } } : {}) };
  (window.__LYRA_SCALE__ ??= []).push(measurement);
  console.log(`[lr-scale] ${JSON.stringify(measurement)}`);
}

/** Warmed wall-time samples are advisory; deterministic counters are available via measureScale. */
export async function benchmark(host: HTMLElement, update: (iteration: number) => void, settle: () => Promise<unknown>, iterations = 5) {
  await settle();
  const samples: number[] = [];
  const measured = await measureScale(host, {
    update: async () => {
      for (let iteration = 0; iteration < iterations; iteration++) {
        const start = performance.now();
        update(iteration);
        await settle();
        samples.push(performance.now() - start);
      }
    },
    settle: async () => {},
  });
  samples.sort((a, b) => a - b);
  return { medianMs: samples[Math.floor(samples.length / 2)] ?? 0, layoutReads: measured.rectReads,
    domNodes: measured.domNodes, heapDelta: measured.heapDeltaBytes };
}
