import { html, nothing, type TemplateResult } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { nextId } from './a11y.js';
import { OwnedTimeout } from './owned-timer.js';
import { authoredOverlayInert } from './overlay-manager.js';
import { composedContains } from './overlay-stack.js';
import { getActiveNativeModal, registerNativeModalContext } from './native-modal-context.js';

export interface NativeModalCarrierOptions {
  onCancel: (event: Event) => void;
  onUnexpectedClose: (carrier: HTMLDialogElement) => void;
}

export interface NativeModalCarrierSemantics {
  label?: string | null;
  labelledBy?: string | null;
  describedBy?: string | null;
  role?: 'dialog' | 'alertdialog';
  /** Preserve an existing outer part on both the ordinary div and the native carrier. */
  part?: string;
}

/** Native modality for an overlay whose declarative host lies outside an existing modal. */
export class NativeModalCarrier {
  requested = false;
  private element?: HTMLDialogElement;
  private releaseContext?: () => void;
  private readonly helperSlot = nextId('native-modal-content');
  private helperMountElement?: HTMLElement;
  private inheritedInert = false;
  private predecessorDocument?: Document;
  private predecessors?: WeakSet<HTMLDialogElement>;
  private predecessorObserver?: MutationObserver;
  private tracksPredecessorReopening = false;
  private coveringModal?: HTMLDialogElement;
  private coveringObserver?: MutationObserver;
  private recoveryGeneration = 0;
  private readonly recoveryTask: OwnedTimeout;

  constructor(private readonly host: HTMLElement, private readonly options: NativeModalCarrierOptions) {
    this.recoveryTask = new OwnedTimeout(host);
  }

  /** Auxiliary focus/inert scope for a helper slot placed outside the primary focus panel. */
  get helperMount(): HTMLElement | null {
    return this.helperMountElement ?? null;
  }

  /** Call before rendering/activating a newly opened modal, not while an exit is animating. */
  prepare(enabled = true): void {
    if (this.element?.matches(':modal') && enabled) return;
    const modal = enabled ? getActiveNativeModal(this.host.ownerDocument) : null;
    this.requested = modal !== null && !composedContains(modal, this.host);
  }

  /** Wrap only the modal surface; the host and its authored children retain their ownership. */
  render(content: TemplateResult, semantics: NativeModalCarrierSemantics = {}): TemplateResult {
    if (!this.requested) {
      return semantics.part ? html`<div part=${semantics.part}>${content}</div>` : content;
    }
    return html`<dialog
      data-native-modal-carrier
      part=${semantics.part ?? nothing}
      role=${semantics.role ?? 'dialog'}
      aria-modal="true"
      aria-label=${semantics.label ?? nothing}
      aria-labelledby=${semantics.labelledBy ?? nothing}
      aria-describedby=${semantics.describedBy ?? nothing}
      ${ref(this.capture)}
      @cancel=${this.cancel}
      @close=${this.closed}
    >${content}</dialog>`;
  }

  /** Place inside the existing focus panel so helper actions share its trap and inert scope. */
  renderHelperSlot(): TemplateResult {
    return this.requested ? html`<slot name=${this.helperSlot}></slot>` : html``;
  }

  /** Own the native presentation, including recovery waiting behind a newer native modal.
   * Returns false only when the owner should use its ordinary non-carrier presentation. */
  show(): boolean {
    const carrier = this.element;
    if (!this.requested || !carrier || !this.host.isConnected) {
      this.stopRecovery();
      this.host.removeAttribute('data-native-modal-active');
      return false;
    }
    if (this.predecessorDocument && this.predecessorDocument !== this.host.ownerDocument) this.stopRecovery();
    if (carrier.matches(':modal')) {
      this.stopCoverObservation();
      this.host.setAttribute('data-native-modal-active', '');
      return true;
    }
    if (this.predecessors && this.releaseContext) {
      this.processPredecessorRecords(this.predecessorObserver?.takeRecords() ?? []);
      const active = getActiveNativeModal(this.host.ownerDocument);
      if (active && active !== carrier && (!this.tracksPredecessorReopening || !this.predecessors.has(active))) {
        this.host.removeAttribute('data-native-modal-active');
        this.observeCover(active);
        return true;
      }
    }
    this.stopCoverObservation();
    if (carrier.open) carrier.close();
    if (!this.predecessors) this.observePredecessors();
    this.releaseContext?.();
    this.helperMountElement?.remove();
    this.helperMountElement = this.host.ownerDocument.createElement('span');
    this.helperMountElement.slot = this.helperSlot;
    this.helperMountElement.style.display = 'contents';
    this.host.append(this.helperMountElement);
    this.releaseContext = registerNativeModalContext(carrier, this.host, this.helperMountElement);
    const inert = carrier.inert && !this.inheritedInert;
    carrier.inert = true;
    try {
      carrier.showModal();
      this.host.setAttribute('data-native-modal-active', '');
    } catch (error) {
      this.stopRecovery();
      this.host.removeAttribute('data-native-modal-active');
      this.releaseContext?.();
      this.releaseContext = undefined;
      this.helperMountElement.remove();
      this.helperMountElement = undefined;
      throw error;
    } finally {
      const hostInert = authoredOverlayInert(this.host);
      this.inheritedInert = !inert && hostInert;
      carrier.inert = inert || hostInert;
    }
    return true;
  }

  /** Call after any exit animation, and on disconnect. This leaves the render mode intact. */
  hide(): void {
    this.stopRecovery();
    this.host.removeAttribute('data-native-modal-active');
    this.releaseContext?.();
    this.releaseContext = undefined;
    this.helperMountElement?.remove();
    this.helperMountElement = undefined;
    if (this.inheritedInert && this.element) this.element.inert = false;
    this.inheritedInert = false;
    if (this.element?.open) this.element.close();
  }

  private observePredecessors(): void {
    const document = this.host.ownerDocument;
    const predecessors = new Set<HTMLDialogElement>();
    const roots: Array<Document | ShadowRoot> = [document];
    while (roots.length > 0) {
      const walker = document.createTreeWalker(roots.pop()!, 1);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const element = node as Element;
        if (element.localName === 'dialog' && element.matches(':modal')) predecessors.add(element as HTMLDialogElement);
        if (element.shadowRoot) roots.push(element.shadowRoot);
      }
    }
    this.predecessorDocument = document;
    this.predecessors = new WeakSet(predecessors);
    const Observer = document.defaultView?.MutationObserver;
    this.tracksPredecessorReopening = Boolean(Observer);
    if (!Observer || predecessors.size === 0) return;
    const observer = new Observer(records => {
      if (this.predecessorObserver === observer) this.processPredecessorRecords(records);
    });
    this.predecessorObserver = observer;
    for (const predecessor of predecessors) {
      observer.observe(predecessor, { attributes: true, attributeFilter: ['open'], attributeOldValue: true });
    }
  }

  private processPredecessorRecords(records: readonly MutationRecord[]): void {
    for (const record of records) {
      // A previously closed dialog reopened above this activation is no longer below it.
      if (record.attributeName === 'open' && record.oldValue === null) {
        this.predecessors?.delete(record.target as HTMLDialogElement);
      }
    }
  }

  private observeCover(modal: HTMLDialogElement): void {
    if (this.coveringModal === modal) return;
    this.stopCoverObservation();
    this.coveringModal = modal;
    modal.addEventListener('close', this.scheduleRecovery);
    const Observer = this.host.ownerDocument.defaultView?.MutationObserver;
    if (!Observer) return;
    const observer = new Observer(() => {
      if (this.coveringObserver === observer) this.scheduleRecovery();
    });
    this.coveringObserver = observer;
    observer.observe(modal, { attributes: true, attributeFilter: ['open'] });
    // Removing any DOM or shadow ancestor can dismiss a native modal without a close event.
    let ancestor: Node | null = modal.parentNode;
    while (ancestor) {
      observer.observe(ancestor, { childList: true });
      ancestor = ancestor.parentNode ?? (ancestor.nodeType === 11 && 'host' in ancestor
        ? (ancestor as ShadowRoot).host : null);
    }
  }

  private scheduleRecovery = (): void => {
    if (this.recoveryTask.pending) return;
    const generation = this.recoveryGeneration;
    const document = this.host.ownerDocument;
    this.recoveryTask.schedule(0, () => {
      if (generation !== this.recoveryGeneration || document !== this.predecessorDocument || !this.releaseContext) return;
      // Rebind after reparenting and let native close listeners finish opening any replacement.
      this.stopCoverObservation();
      this.show();
    });
  };

  private stopCoverObservation(): void {
    this.recoveryTask.cancel();
    this.coveringModal?.removeEventListener('close', this.scheduleRecovery);
    this.coveringModal = undefined;
    this.coveringObserver?.disconnect();
    this.coveringObserver = undefined;
  }

  private stopRecovery(): void {
    this.recoveryGeneration += 1;
    this.stopCoverObservation();
    this.predecessorObserver?.disconnect();
    this.predecessorObserver = undefined;
    this.tracksPredecessorReopening = false;
    this.predecessors = undefined;
    this.predecessorDocument = undefined;
  }

  private capture = (element?: Element): void => {
    if (this.element === element) return;
    this.hide();
    this.element = element as HTMLDialogElement | undefined;
  };

  private cancel = (event: Event): void => {
    event.preventDefault();
    this.options.onCancel(event);
  };

  private closed = (): void => {
    if (!this.releaseContext || !this.host.isConnected || !this.element || this.element.open) return;
    this.host.removeAttribute('data-native-modal-active');
    this.options.onUnexpectedClose(this.element);
  };
}
