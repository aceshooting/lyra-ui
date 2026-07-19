import { expect } from '@open-wc/testing';
import './lyra.js';
import { ROOT_BARREL_TAGS } from './internal/root-registration-allowlist.js';

/**
 * Universal lifecycle contracts, applied uniformly to every tag the root
 * barrel registers (the optional-peer chart/map/graph families are excluded
 * because importing them requires peers this environment must not assume).
 *
 * Three contracts per tag, each in its default state (no attributes, no
 * properties, no slotted content):
 *
 * 1. reconnect-smoke — an element survives disconnect + reconnect: no thrown
 *    errors, the shadow root still renders, and `requestUpdate()` still
 *    schedules and completes an update afterwards.
 * 2. leak-contract — across one connect → update → disconnect cycle, every
 *    `window`/`document` listener the element added is removed again, and
 *    every Resize/Intersection/MutationObserver it constructed no longer
 *    observes any target.
 * 3. focusable-name-contract — every rendered shadow-tree element that is
 *    natively focusable (or opts into the tab order via `tabindex="0"`)
 *    exposes a role and at least one accessible-name source.
 */

type ContractName = 'reconnect-smoke' | 'leak-contract' | 'focusable-name-contract';

/**
 * Per-tag, per-contract opt-outs. Every entry needs a specific technical
 * reason; an entry prefixed with `KNOWN-ISSUE:` marks a real defect that is
 * intentionally documented here rather than silently skipped.
 */
const OPT_OUTS: ReadonlyMap<string, Partial<Record<ContractName, string>>> = new Map([
  [
    'lr-heatmap',
    {
      'focusable-name-contract':
        'KNOWN-ISSUE: with accessible-cells off (the default), the keyboard tab stop is the bare ' +
        '<canvas part="canvas"> with no role and no accessible name. The host deliberately takes ' +
        'role="group" plus a computed summary aria-label instead of role="img" (an img host would ' +
        'flatten the focusable canvas and the live region out of the accessibility tree — see ' +
        'heatmap.test.ts), so naming the canvas itself needs a designed role choice for an ' +
        'arrow-key-interactive canvas, not a mechanical attribute addition.',
    },
  ],
  [
    'lr-virtual-list',
    {
      'focusable-name-contract':
        'The scrollable role="list" container carries tabindex="0" so caller-rendered rows with no ' +
        'focusable content stay keyboard-scrollable, and role="list" requires no accessible name ' +
        'per ARIA. Naming is deliberately delegated to the consumer via host aria-label forwarding ' +
        '(virtual-list.test.ts asserts the unlabeled default): renderItem content is caller-supplied, ' +
        'and a built-in generic label would double-announce under composers that already label their ' +
        'wrapper (dataset-viewer, csv-viewer, the av-player transcript).',
    },
  ],
]);

function optOutReason(tag: string, contract: ContractName): string | undefined {
  return OPT_OUTS.get(tag)?.[contract];
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface MaybeLit {
  updateComplete?: Promise<boolean>;
  requestUpdate?: () => void;
  isUpdatePending?: boolean;
}

async function settle(el: Element): Promise<void> {
  const pending = (el as MaybeLit).updateComplete;
  if (pending) await pending;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function macrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Drains the queues deferred cleanup work is scheduled on: microtasks
 * (queueMicrotask-based teardown such as the overlay manager's suspend
 * grace period), one animation frame (rAF-debounced handlers), and one
 * macrotask (setTimeout(0) deferrals).
 */
async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await nextFrame();
  await macrotask();
}

function mountPoint(): HTMLDivElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}

/** Keep the generic lifecycle checks independent of optional data-loader peers. */
function prepareDefaultElement(tag: string, el: Element): void {
  if (tag === 'lr-emoji-picker') {
    (el as unknown as { loadGroups: () => Promise<null> }).loadGroups = () => Promise.resolve(null);
  }
}

// ---------------------------------------------------------------------------
// Contract 1 — reconnect-smoke
// ---------------------------------------------------------------------------

describe('lifecycle contract: reconnect-smoke', () => {
  for (const tag of ROOT_BARREL_TAGS) {
    it(`<${tag}> survives disconnect and reconnect`, async function () {
      if (optOutReason(tag, 'reconnect-smoke')) return this.skip();

      const host = mountPoint();
      try {
        const el = document.createElement(tag);
        prepareDefaultElement(tag, el);
        host.appendChild(el);
        await settle(el);

        const hadShadowRoot = el.shadowRoot !== null;
        const hadShadowChildren = (el.shadowRoot?.childElementCount ?? 0) > 0;

        el.remove();
        // Let disconnect-scheduled microtasks/frames run while detached so the
        // reconnect below exercises a genuinely settled detached state.
        await flushAsyncWork();

        host.appendChild(el);
        await settle(el);

        expect(el.isConnected, `<${tag}> should be connected after re-append`).to.be.true;
        if (hadShadowRoot) {
          expect(el.shadowRoot, `<${tag}> should retain its shadow root across reconnect`).to.exist;
        }
        if (hadShadowChildren) {
          expect(
            el.shadowRoot!.childElementCount,
            `<${tag}> should still render shadow content after reconnect`,
          ).to.be.greaterThan(0);
        }

        const lit = el as MaybeLit;
        if (typeof lit.requestUpdate === 'function') {
          lit.requestUpdate();
          expect(
            lit.isUpdatePending,
            `<${tag}> should schedule an update from requestUpdate() after reconnect`,
          ).to.be.true;
          await lit.updateComplete;
        }
      } finally {
        host.remove();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Contract 2 — leak-contract
// ---------------------------------------------------------------------------

interface Instrumentation {
  /** Human-readable descriptions of everything still held. */
  leaks(): string[];
  /** Removes the instrumentation. Must always run, even on failure. */
  restore(): void;
}

/**
 * Shadows `addEventListener`/`removeEventListener` on `window` and `document`
 * with tallying wrappers. Tallying keys on (target, type, listener identity,
 * capture flag) — the same identity the DOM itself dedupes and removes by.
 * Listeners registered with `once` or an abort `signal` are not tallied:
 * both can be torn down without a `removeEventListener` call, so a tally
 * would misreport correct cleanup as a leak.
 */
function instrumentGlobalListeners(): Instrumentation {
  const active = new Map<string, string>();
  const listenerIds = new Map<object, number>();
  let nextListenerId = 0;

  const idFor = (listener: unknown): number => {
    if ((typeof listener !== 'object' && typeof listener !== 'function') || listener === null) return -1;
    let id = listenerIds.get(listener);
    if (id === undefined) {
      id = nextListenerId++;
      listenerIds.set(listener, id);
    }
    return id;
  };

  const captureOf = (options: boolean | AddEventListenerOptions | undefined): boolean =>
    typeof options === 'boolean' ? options : options?.capture === true;

  const untracked = (options: boolean | AddEventListenerOptions | undefined): boolean =>
    typeof options === 'object' && options !== null && (options.once === true || options.signal !== undefined);

  const restores: Array<() => void> = [];

  const patch = (target: Window | Document, name: 'window' | 'document'): void => {
    const originalAdd = target.addEventListener.bind(target) as (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) => void;
    const originalRemove = target.removeEventListener.bind(target) as (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) => void;

    const wrappedAdd = (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void => {
      if (listener && !untracked(options)) {
        const capture = captureOf(options);
        active.set(
          `${name}|${type}|${capture}|${idFor(listener)}`,
          `${name} "${type}" listener (capture=${capture})`,
        );
      }
      originalAdd(type, listener, options);
    };

    const wrappedRemove = (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ): void => {
      if (listener) {
        // Removals of listeners added before instrumentation began are not
        // this element's leaks; deleting an absent key is a no-op.
        active.delete(`${name}|${type}|${captureOf(options)}|${idFor(listener)}`);
      }
      originalRemove(type, listener, options);
    };

    // Own properties shadow the EventTarget.prototype methods; deleting them
    // restores the untouched prototype implementations.
    Reflect.set(target, 'addEventListener', wrappedAdd);
    Reflect.set(target, 'removeEventListener', wrappedRemove);
    restores.push(() => {
      Reflect.deleteProperty(target, 'addEventListener');
      Reflect.deleteProperty(target, 'removeEventListener');
    });
  };

  patch(window, 'window');
  patch(document, 'document');

  return {
    leaks: () => [...active.values()],
    restore: () => {
      for (const restore of restores) restore();
    },
  };
}

interface ObserverRecord {
  kind: string;
  observed: Set<unknown>;
}

/**
 * Wraps the Resize/Intersection/MutationObserver constructors so instances
 * created while instrumented are tracked. An instance counts as cleaned up
 * once it observes nothing: `disconnect()` clears everything, and per-target
 * `unobserve()` calls that empty the set are equally valid teardown.
 */
function instrumentObservers(): Instrumentation {
  const records: ObserverRecord[] = [];
  const restores: Array<() => void> = [];
  const scope = globalThis as Record<string, unknown>;

  // Structural stand-in for all three observer interfaces; MutationObserver
  // has no unobserve(), hence optional.
  interface ObserverLike {
    observe(...args: unknown[]): void;
    unobserve?(target: unknown): void;
    disconnect(): void;
  }

  const wrap = (kind: 'ResizeObserver' | 'IntersectionObserver' | 'MutationObserver'): void => {
    const Original = scope[kind] as (new (...args: unknown[]) => ObserverLike) | undefined;
    if (typeof Original !== 'function') return;
    const tracked = new WeakMap<object, ObserverRecord>();

    const Wrapped = class extends Original {
      constructor(...args: unknown[]) {
        super(...args);
        const record: ObserverRecord = { kind, observed: new Set() };
        records.push(record);
        tracked.set(this, record);
      }

      observe(...args: unknown[]): void {
        tracked.get(this)?.observed.add(args[0]);
        super.observe(...args);
      }

      unobserve(target: unknown): void {
        tracked.get(this)?.observed.delete(target);
        super.unobserve?.(target);
      }

      disconnect(): void {
        tracked.get(this)?.observed.clear();
        super.disconnect();
      }
    };

    scope[kind] = Wrapped;
    restores.push(() => {
      scope[kind] = Original;
    });
  };

  wrap('ResizeObserver');
  wrap('IntersectionObserver');
  wrap('MutationObserver');

  return {
    leaks: () =>
      records
        .filter((record) => record.observed.size > 0)
        .map((record) => `${record.kind} still observing ${record.observed.size} target(s)`),
    restore: () => {
      for (const restore of restores) restore();
    },
  };
}

describe('lifecycle contract: leak-contract', () => {
  for (const tag of ROOT_BARREL_TAGS) {
    it(`<${tag}> releases global listeners and observers on disconnect`, async function () {
      if (optOutReason(tag, 'leak-contract')) return this.skip();

      const host = mountPoint();
      const listeners = instrumentGlobalListeners();
      const observers = instrumentObservers();
      try {
        const el = document.createElement(tag);
        prepareDefaultElement(tag, el);
        host.appendChild(el);
        await settle(el);
        // One extra full update cycle between connect and disconnect, so
        // update-driven listener/observer churn is inside the tallied window.
        (el as MaybeLit).requestUpdate?.();
        await settle(el);
        // Setup deferred to firstUpdated continuations, rAF, or timeouts must
        // land while instrumented, or its later teardown would tally as an
        // unmatched removal.
        await flushAsyncWork();

        el.remove();
        // Two flush rounds: teardown itself may queue a second wave (e.g. a
        // microtask that only then cancels a frame-scheduled handler).
        await flushAsyncWork();
        await flushAsyncWork();

        const leakedListeners = listeners.leaks();
        expect(
          leakedListeners,
          `<${tag}> left global listeners behind after disconnect: ${leakedListeners.join(', ')}`,
        ).to.deep.equal([]);

        const leakedObservers = observers.leaks();
        expect(
          leakedObservers,
          `<${tag}> left observers connected after disconnect: ${leakedObservers.join(', ')}`,
        ).to.deep.equal([]);
      } finally {
        observers.restore();
        listeners.restore();
        host.remove();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Contract 3 — focusable-name-contract
// ---------------------------------------------------------------------------

/** Tags with an implicit ARIA role (or, for media/iframe, an exposed accessibility object). */
const IMPLICIT_ROLE_TAGS = new Set(['button', 'input', 'select', 'textarea', 'summary', 'audio', 'video', 'iframe']);

const FOCUSABLE_CANDIDATE_SELECTOR = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  'audio[controls]',
  'video[controls]',
  'iframe',
  '[tabindex="0"]',
].join(', ');

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** True for candidates assistive tech does not expose in the default render. */
function isExcludedFromA11yTree(candidate: HTMLElement): boolean {
  if (candidate.closest('[aria-hidden="true"], [hidden], [inert]')) return true;
  if (candidate.matches(':disabled') || candidate.hasAttribute('disabled')) return true;
  const checkVisibility = (
    candidate as HTMLElement & { checkVisibility?: (options?: { checkVisibilityCSS?: boolean }) => boolean }
  ).checkVisibility;
  if (typeof checkVisibility === 'function' && !checkVisibility.call(candidate, { checkVisibilityCSS: true })) {
    return true;
  }
  return false;
}

function exposesRole(candidate: HTMLElement): boolean {
  if (hasText(candidate.getAttribute('role'))) return true;
  if (candidate.localName === 'a') return candidate.hasAttribute('href');
  return IMPLICIT_ROLE_TAGS.has(candidate.localName);
}

/**
 * Conservative accessible-name detection: any recognized name source counts,
 * and content the consumer supplies through a `<slot>` counts as named (the
 * component cannot know what will be slotted; naming it is the consumer's
 * responsibility, exactly as with a native `<button>`'s children).
 */
function exposesNameSource(candidate: HTMLElement, root: ShadowRoot): boolean {
  if (hasText(candidate.getAttribute('aria-label')) || hasText(candidate.getAttribute('title'))) return true;

  const labelledby = candidate.getAttribute('aria-labelledby');
  if (labelledby) {
    for (const id of labelledby.split(/\s+/)) {
      if (id && root.getElementById(id)) return true;
    }
  }

  if (hasText(candidate.textContent)) return true;
  if (candidate.localName === 'slot' || candidate.querySelector('slot')) return true;

  const isFormControl =
    candidate.localName === 'input' || candidate.localName === 'select' || candidate.localName === 'textarea';
  if (isFormControl) {
    if (hasText(candidate.getAttribute('placeholder'))) return true;
    if (hasText(candidate.getAttribute('alt'))) return true;
    if (candidate.closest('label')) return true;
    if (candidate.id && root.querySelector(`label[for="${CSS.escape(candidate.id)}"]`)) return true;
  }

  // A descendant carrying its own label text (img[alt], nested components
  // with label/aria-label/title attributes) names the control's content.
  for (const source of candidate.querySelectorAll('[aria-label], [alt], [label], [title]')) {
    if (
      hasText(source.getAttribute('aria-label')) ||
      hasText(source.getAttribute('alt')) ||
      hasText(source.getAttribute('label')) ||
      hasText(source.getAttribute('title'))
    ) {
      return true;
    }
  }
  return false;
}

function describeCandidate(candidate: HTMLElement): string {
  const part = candidate.getAttribute('part');
  const id = candidate.id ? `#${candidate.id}` : '';
  return `<${candidate.localName}${id}${part ? ` part="${part}"` : ''}>`;
}

describe('lifecycle contract: focusable-name-contract', () => {
  for (const tag of ROOT_BARREL_TAGS) {
    it(`<${tag}> names and roles its default-state focusable shadow elements`, async function () {
      if (optOutReason(tag, 'focusable-name-contract')) return this.skip();

      const host = mountPoint();
      try {
        const el = document.createElement(tag);
        prepareDefaultElement(tag, el);
        host.appendChild(el);
        await settle(el);
        // Some components finish composing their default state a frame after
        // the first update (measured layout, deferred renders).
        await flushAsyncWork();
        await settle(el);

        const root = el.shadowRoot;
        if (!root) return;

        const failures: string[] = [];
        for (const candidate of root.querySelectorAll<HTMLElement>(FOCUSABLE_CANDIDATE_SELECTOR)) {
          if (isExcludedFromA11yTree(candidate)) continue;
          if (!exposesRole(candidate)) {
            failures.push(`${describeCandidate(candidate)} is focusable but exposes no role`);
          }
          if (!exposesNameSource(candidate, root)) {
            failures.push(`${describeCandidate(candidate)} is focusable but has no accessible-name source`);
          }
        }

        expect(failures, `<${tag}> focusable-name violations:\n${failures.join('\n')}`).to.deep.equal([]);
      } finally {
        host.remove();
      }
    });
  }
});
