import { validateNavigationDestination } from '@aceshooting/lyra-gen/content-policy.js';
import type { LyraGenConfirmation, LyraGenViewElement } from '@aceshooting/lyra-gen/gen-view.class.js';
import type { LyraGenAction, LyraGenUrlPolicy } from '@aceshooting/lyra-gen/types.js';

export interface GeneratedNavigationOptions {
  readonly actionName: string;
  /** Return the current viewer's exact approved origins; checked again at the effect boundary. */
  readonly policy: () => LyraGenUrlPolicy;
  readonly authorize: (action: LyraGenAction, destination: string) => boolean;
  readonly strings: { readonly heading: string; readonly open: string; readonly cancel: string; readonly unavailable: string };
}

/** A navigation-only host composition. The generated payload is { kind: 'navigation', destination }. */
export function connectGeneratedNavigation(view: LyraGenViewElement, region: HTMLElement, options: GeneratedNavigationOptions) {
  const previous = view.confirmAction;
  const container = region.ownerDocument.createElement('section');
  region.append(container);
  let disposed = false;
  let cancelPending: (() => void) | undefined;
  let permit: { action: LyraGenAction; destination: string; valid: () => boolean } | undefined;

  const destinationFor = (action: LyraGenAction): string | undefined => {
    const payload = action.payload;
    if (action.name !== options.actionName || !payload || typeof payload !== 'object' || Array.isArray(payload)
      || !('kind' in payload) || payload['kind'] !== 'navigation' || !('destination' in payload)) return;
    try {
      const checked = validateNavigationDestination(payload['destination'], options.policy());
      if (checked.ok && options.authorize(action, checked.value) === true
        && validateNavigationDestination(checked.value, options.policy()).ok) return checked.value;
    } catch { /* Host authorization failure denies the request. */ }
    return;
  };
  const refuse = (): void => { container.textContent = options.strings.unavailable; };
  const confirm: LyraGenConfirmation = (action, signal) => {
    cancelPending?.();
    permit = undefined;
    const source = view.document;
    const catalog = view.catalog;
    const actions = view.enabledActions;
    const state = view.bindingState;
    const valid = (): boolean => !disposed && !signal.aborted && view.isConnected && region.isConnected
      && view.confirmAction === confirm && view.document === source && view.catalog === catalog
      && view.enabledActions === actions && view.bindingState === state && view.status === 'ready'
      && (!view.enabledActions || view.enabledActions.includes(action.name));
    const destination = destinationFor(action);
    if (!valid() || !destination || catalog.actions?.[action.name]?.confirm !== true) { refuse(); return false; }

    const heading = region.ownerDocument.createElement('h2');
    heading.textContent = options.strings.heading;
    const address = region.ownerDocument.createElement('p');
    address.id = `navigation-destination-${crypto.randomUUID()}`;
    address.textContent = destination;
    address.style.overflowWrap = 'anywhere';
    const open = region.ownerDocument.createElement('button');
    open.type = 'button';
    open.textContent = options.strings.open;
    open.setAttribute('aria-describedby', address.id);
    const cancel = region.ownerDocument.createElement('button');
    cancel.type = 'button';
    cancel.textContent = options.strings.cancel;
    container.replaceChildren(heading, address, open, cancel);
    return new Promise<boolean>(resolve => {
      let settled = false;
      const finish = (approved: boolean): void => {
        if (settled) return;
        settled = true;
        open.disabled = true;
        cancel.disabled = true;
        signal.removeEventListener('abort', abort);
        if (cancelPending === abort) cancelPending = undefined;
        resolve(approved);
      };
      const abort = (): void => { permit = undefined; finish(false); };
      cancelPending = abort;
      signal.addEventListener('abort', abort, { once: true });
      cancel.addEventListener('click', abort);
      open.addEventListener('click', event => {
        if (!event.isTrusted || event.defaultPrevented || !region.ownerDocument.defaultView?.navigator.userActivation?.isActive) return;
        if (!valid() || destinationFor(action) !== destination || address.textContent !== destination) {
          abort(); refuse(); return;
        }
        permit = { action, destination, valid };
        finish(true);
      });
    });
  };
  const navigate = (event: CustomEvent<LyraGenAction>): void => {
    const approved = permit;
    if (!approved || event.target !== view || event.detail !== approved.action) return;
    permit = undefined;
    const owner = region.ownerDocument.defaultView;
    if (!owner?.navigator.userActivation?.isActive || !approved.valid()
      || destinationFor(event.detail) !== approved.destination || !approved.valid()) { refuse(); return; }
    owner.open(approved.destination, '_blank', 'noopener,noreferrer');
  };
  view.confirmAction = confirm;
  view.addEventListener('lr-gen-action', navigate);
  return {
    cancel() { cancelPending?.(); permit = undefined; },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelPending?.();
      permit = undefined;
      view.removeEventListener('lr-gen-action', navigate);
      if (view.confirmAction === confirm) view.confirmAction = previous;
      container.remove();
    },
  };
}
