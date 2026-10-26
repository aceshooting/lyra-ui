/** Host-owned inline approval; the renderer remains the only publisher of admitted actions. */
import { LyraConfirmBar } from '@aceshooting/lyra-ui/components/lr-confirm-bar.js';
import type { LyraGenViewElement, LyraGenConfirmation } from '@aceshooting/lyra-gen/gen-view.class.js';
import type { LyraGenAction } from '@aceshooting/lyra-gen/types.js';

function availableFocusTarget(target: HTMLElement, document: Document): boolean {
  if (!target.isConnected || target.ownerDocument !== document || target.matches(':disabled')) return false;
  let ancestor: Element | null = target;
  for (let depth = 0; ancestor && depth < 64; depth++) {
    if (ancestor.hasAttribute('hidden') || ancestor.hasAttribute('inert') || ancestor.getAttribute('aria-hidden') === 'true') return false;
    const style = document.defaultView?.getComputedStyle(ancestor);
    if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') return false;
    const root = ancestor.getRootNode();
    ancestor = ancestor.assignedSlot ?? ancestor.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  }
  return ancestor === null && target.getClientRects().length > 0;
}

export function connectGeneratedApproval(view: LyraGenViewElement, region: HTMLElement, options: {
  /** Application-localized explanation of the proposed action. */
  readonly heading?: (action: LyraGenAction) => string;
  readonly returnFocusTo?: (action: LyraGenAction) => HTMLElement | null;
} = {}) {
  const previous = view.confirmAction;
  const container = region.ownerDocument.createElement('div');
  region.append(container);
  let disposed = false;
  let pending: { readonly bar: LyraConfirmBar; readonly cancel: () => void } | undefined;
  const confirm: LyraGenConfirmation = (action, signal) => {
    pending?.cancel();
    if (disposed || signal.aborted || !view.isConnected || !region.isConnected) return false;
    const bar = new LyraConfirmBar();
    bar.heading = options.heading?.(action) ?? '';
    bar.toolName = action.name;
    bar.args = { surfaceId: action.surfaceId, nodeId: action.nodeId, revision: action.revision, payload: action.payload };
    bar.autofocus = true;
    bar.escapeDenies = true;
    let focused = region.ownerDocument.activeElement;
    while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
    const original = focused instanceof HTMLElement && focused !== region.ownerDocument.body ? focused : null;
    bar.returnFocusTo = () => options.returnFocusTo ? options.returnFocusTo(action) : original;
    return new Promise<boolean>(resolve => {
      let approvedRequest = false;
      let settled = false;
      const finish = (approved: boolean): void => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', cancel);
        bar.removeEventListener('lr-approve-request', approve);
        bar.removeEventListener('lr-decision-settled', decide);
        if (pending?.bar === bar) pending = undefined;
        resolve(approved && !disposed && !signal.aborted && view.isConnected && region.isConnected);
      };
      const approve = (event: Event): void => { if (event.target === bar) approvedRequest = true; };
      const decide = (event: CustomEvent<{ decision: 'approved' | 'denied' }>): void => {
        if (event.target === bar) finish(approvedRequest && event.detail.decision === 'approved');
      };
      const cancel = (): void => {
        if (settled) return;
        bar.decision = 'denied';
        bar.disabled = true;
        finish(false);
        // An external decision does not run the bar's native activation focus handoff.
        if (!bar.matches(':focus-within')) return;
        let preferred: HTMLElement | null = null;
        try { preferred = options.returnFocusTo ? options.returnFocusTo(action) : original; } catch { /* Cancellation still settles if the host callback fails. */ }
        for (const target of [preferred, original]) {
          // A host callback or focus method may deliberately move focus elsewhere.
          if (!bar.matches(':focus-within')) break;
          if (!target || !availableFocusTarget(target, region.ownerDocument)) continue;
          try { target.focus({ preventScroll: true }); } catch { /* Try the original control only while approval still owns focus. */ }
        }
      };
      pending = { bar, cancel };
      signal.addEventListener('abort', cancel, { once: true });
      bar.addEventListener('lr-approve-request', approve);
      bar.addEventListener('lr-decision-settled', decide);
      container.replaceChildren(bar);
    });
  };
  view.confirmAction = confirm;
  return {
    get pending() { return pending?.bar; },
    /** Host cancellation is a refusal; it never synthesizes approval. */
    cancel() { pending?.cancel(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      pending?.cancel();
      if (view.confirmAction === confirm) view.confirmAction = previous;
      container.remove();
    },
  };
}
