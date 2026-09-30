import { html, nothing, type TemplateResult } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { nextId } from './a11y.js';
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

  constructor(private readonly host: HTMLElement, private readonly options: NativeModalCarrierOptions) {}

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

  /** Promote after render, before the overlay manager applies its cancellable initial focus. */
  show(): boolean {
    const carrier = this.element;
    if (!this.requested || !carrier || !this.host.isConnected) {
      this.host.removeAttribute('data-native-modal-active');
      return false;
    }
    if (carrier.matches(':modal')) {
      this.host.setAttribute('data-native-modal-active', '');
      return true;
    }
    if (carrier.open) carrier.close();
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
      this.host.removeAttribute('data-native-modal-active');
      this.releaseContext?.();
      this.releaseContext = undefined;
      this.helperMountElement.remove();
      this.helperMountElement = undefined;
      throw error;
    } finally {
      this.inheritedInert = !inert && this.host.inert;
      carrier.inert = inert || this.host.inert;
    }
    return true;
  }

  /** Call after any exit animation, and on disconnect. This leaves the render mode intact. */
  hide(): void {
    this.host.removeAttribute('data-native-modal-active');
    this.releaseContext?.();
    this.releaseContext = undefined;
    this.helperMountElement?.remove();
    this.helperMountElement = undefined;
    if (this.inheritedInert && this.element) this.element.inert = false;
    this.inheritedInert = false;
    if (this.element?.open) this.element.close();
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
