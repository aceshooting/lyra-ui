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
  const root = host.getRootNode() as Document | ShadowRoot;
  const ownerDocument = root.nodeType === 9
    ? root as Document
    : (root as ShadowRoot).ownerDocument;
  const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
  if (!MutationObserverCtor) return () => undefined;
  const observer = new MutationObserverCtor(callback);
  observer.observe(root, {
    attributes: true,
    attributeFilter: ['id'],
    childList: true,
    subtree: true,
  });
  return () => observer.disconnect();
}
