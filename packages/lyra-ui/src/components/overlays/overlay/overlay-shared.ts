/**
 * Leaf module shared by `<lr-popover>` and `<lr-tooltip>`.
 *
 * The two are deliberately unrelated classes -- `LyraTooltip` extends `LyraElement` directly rather
 * than `LyraPopover`, because a tooltip is a description attached to someone else's trigger while a
 * popover is a click-owned surface, and forcing one to inherit the other's open/close ownership
 * model would be worse than the duplication. What they genuinely do share is *anchor resolution*:
 * both accept the same `showAt()` rectangle and the same virtual-anchor / `anchor` / `for` /
 * slotted-trigger precedence, and both had a byte-identical private copy of each. Those two copies
 * live here instead, on this library's `x-shared.ts` convention.
 */

import type { VirtualAnchor } from '../../../internal/positioner.js';
import { subscribeInheritedAttributes } from '../../../internal/inherited-attribute-hub.js';

/** One realm-bound delayed show/hide request, replaced or cancelled by the next interaction. */
export class OverlayDelayTimer {
  private timer?: number;
  private view?: Window;
  pendingDirection?: 'show' | 'hide';

  schedule(view: Window, delay: number, direction: 'show' | 'hide', commit: () => void): void {
    this.cancel();
    this.pendingDirection = direction;
    this.view = view;
    const timer = view.setTimeout(() => {
      if (this.view !== view || this.timer !== timer) return;
      this.timer = undefined;
      this.view = undefined;
      this.pendingDirection = undefined;
      commit();
    }, delay);
    this.timer = timer;
  }

  cancel(): void {
    if (this.timer !== undefined) this.view?.clearTimeout(this.timer);
    this.timer = undefined;
    this.view = undefined;
    this.pendingDirection = undefined;
  }
}

/** Runs the common render, placement, motion, and closed-layout phases of an overlay transition.
 * Each owner supplies its placement failure policy and its own registered animation. */
export async function settleOverlayTransition(options: {
  showing: boolean;
  updateComplete: () => Promise<unknown>;
  isCurrent: () => boolean;
  readyToShow: () => Promise<boolean>;
  animate: () => Promise<void>;
  afterHide: () => void;
  settled: () => void;
}): Promise<void> {
  await options.updateComplete();
  if (!options.isCurrent()) return;
  if (options.showing) {
    if (!await options.readyToShow() || !options.isCurrent()) return;
    await options.updateComplete();
    if (!options.isCurrent()) return;
  }
  await options.animate();
  if (!options.isCurrent()) return;
  if (!options.showing) {
    options.afterHide();
    await options.updateComplete();
    if (!options.isCurrent()) return;
  }
  options.settled();
}

/**
 * Coalesces a lifecycle request made again from inside its own synchronous preflight event.
 *
 * The state owner still decides whether an opposite request is meaningful. This gate only keeps
 * a same-target `show()`/`hide()` call from recursively dispatching the same event before the
 * outer call has had a chance to commit, and gives both callers the exact same completion promise.
 */
export class OverlayTransitionGate {
  private target?: boolean;
  private completion?: Promise<void>;

  request(target: boolean, transition: () => void | Promise<void>): Promise<void> {
    if (this.target === target && this.completion) return this.completion;

    let resolve!: () => void;
    let reject!: (reason?: unknown) => void;
    const completion = new Promise<void>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    this.target = target;
    this.completion = completion;

    let result: void | Promise<void>;
    try {
      result = transition();
    } catch (error) {
      this.target = undefined;
      this.completion = undefined;
      reject(error);
      return completion;
    }

    this.target = undefined;
    this.completion = undefined;
    void Promise.resolve(result).then(resolve, reject);
    return completion;
  }
}

/** The rectangle `showAt()` accepts on both components: a point, optional dimensions, and an
 *  optional `contextElement` so Floating UI can resolve the right containing block. */
export type OverlayVirtualRect = {
  x: number;
  y: number;
  width?: number;
  height?: number;
  contextElement?: Element;
};

/**
 * Validates and normalizes a `showAt()` rectangle.
 *
 * Returns `undefined` for any non-finite coordinate or dimension, which both callers treat as
 * "ignore this call and leave the current open/anchor state unchanged" -- a `NaN` reaching Floating
 * UI would otherwise place the surface at an unrecoverable position rather than failing loudly.
 * Missing dimensions collapse to a zero-size point, and negative ones clamp to zero.
 */
export function normalizeVirtualRect(rect: OverlayVirtualRect): OverlayVirtualRect | undefined {
  const width = rect.width ?? 0;
  const height = rect.height ?? 0;
  if (![rect.x, rect.y, width, height].every(Number.isFinite)) return undefined;
  return {
    x: rect.x,
    y: rect.y,
    width: Math.max(0, width),
    height: Math.max(0, height),
    contextElement: rect.contextElement,
  };
}

/**
 * Resolves what a floating surface is positioned against, in the precedence both components
 * document: an explicit `showAt()` virtual anchor first, then the direct `anchor` element, then the
 * `for` idref (looked up in the host's own root, so it resolves inside a shadow tree as well as in
 * the document), then the slotted trigger.
 *
 * The trigger is passed in rather than read off the host because the two components track it under
 * different private names, and it is the only part of the chain that differs between them.
 */
export function resolveOverlayAnchor(
  host: Node & { getRootNode(options?: GetRootNodeOptions): Node },
  sources: {
    virtualAnchor?: VirtualAnchor;
    anchor?: Element | null;
    for?: string;
    trigger?: Element | null;
  },
): Element | VirtualAnchor | null {
  if (sources.virtualAnchor) return sources.virtualAnchor;
  if (sources.anchor?.isConnected) return sources.anchor;
  if (sources.for) {
    const root = host.getRootNode() as Document | ShadowRoot;
    const target = root.getElementById?.(sources.for) ?? null;
    if (target) return target;
  }
  return sources.trigger?.isConnected ? sources.trigger : null;
}

/** Watches structural and `id`-identity changes in the host's current root. Callers compare their
 * resolved anchor before doing any work, so unrelated mutations remain a cheap no-op. */
export function observeOverlayAnchorIdentity(host: Node, callback: () => void): () => void {
  const root = host.getRootNode();
  const ownerDocument = root.nodeType === 9 ? root as Document : root.ownerDocument;
  // One shared observer per root, however many overlays watch it.
  return subscribeInheritedAttributes(root, ownerDocument?.defaultView?.MutationObserver, {
    attributes: ['id'],
    childList: true,
    changed: () => callback(),
  }) ?? (() => undefined);
}

/** Resolves a trigger id in the host's own root and checks its owning realm. */
export function resolveOverlayTriggerById(host: Node, id: string): HTMLElement | undefined {
  if (!id) return undefined;
  const root = host.getRootNode() as Document | ShadowRoot;
  const target = root.getElementById?.(id) ?? null;
  const HTMLElementCtor = target?.ownerDocument.defaultView?.HTMLElement;
  return target && HTMLElementCtor && target instanceof HTMLElementCtor ? target : undefined;
}

/** Watches host and external direct-anchor roots as one identity observation. */
export function observeOverlayAnchorRoots(
  host: Element,
  directAnchor: Element | undefined,
  onIdentityChange: () => void,
): () => void {
  // Observe the host's entire root, including a direct anchor that is its sibling rather than a
  // descendant. Observing only the host subtree would miss that sibling's removal or replacement.
  const hostRoot = host.getRootNode();
  const roots = new Set<Node>([hostRoot]);
  if (directAnchor && directAnchor.getRootNode() !== hostRoot) {
    roots.add(directAnchor.isConnected ? directAnchor.getRootNode() : directAnchor.ownerDocument);
  }
  const cleanups = [...roots].map(root => observeOverlayAnchorIdentity(root, onIdentityChange));
  return () => { for (const cleanup of cleanups) cleanup(); };
}

/** The element a popover or tooltip binds interactions to: none for a virtual anchor, else the
 *  slotted trigger, else the `for` target. */
export function resolveOverlayInteractionTrigger(
  host: Node,
  virtualAnchor: unknown,
  slotted: HTMLElement | undefined,
  forId: string,
): HTMLElement | undefined {
  return virtualAnchor ? undefined : (slotted ?? resolveOverlayTriggerById(host, forId));
}

/** Tracks the direct `anchor` an open overlay is positioned against and reports its removal. */
export class OverlayAnchorIdentity {
  private observed?: Element;
  private wasConnected = false;
  private stopObserving?: () => void;

  stop(): void {
    this.stopObserving?.();
    this.stopObserving = undefined;
  }

  /** Restarts observation. `onChange` receives whether the direct anchor was just removed. */
  observe(
    host: Element,
    directAnchor: Element | undefined,
    forId: string,
    currentAnchor: () => Element | null,
    onChange: (directAnchorRemoved: boolean) => void,
  ): void {
    this.stop();
    this.observed = directAnchor;
    this.wasConnected = directAnchor?.isConnected === true;
    if (!host.isConnected || (!forId && !directAnchor)) return;
    this.stopObserving = observeOverlayAnchorRoots(host, directAnchor, () => {
      const removed =
        currentAnchor() === this.observed && this.wasConnected && this.observed?.isConnected === false;
      this.wasConnected = this.observed?.isConnected === true;
      onChange(removed);
    });
  }

  /** Whether an `anchor` property change dropped the connected anchor observed so far. */
  lostAnchorProperty(changed: Map<PropertyKey, unknown>, current: Element | null): boolean {
    return changed.has('anchor') && changed.get('anchor') === this.observed && this.wasConnected
      && current?.isConnected !== true;
  }
}
