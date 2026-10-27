import type { NativeModalCarrier } from './native-modal-carrier.js';
import { isLibraryPromotedAndShowing, promoteToTopLayer, releaseTopLayer } from './top-layer-escape.js';
import { observeOverlayStack } from './overlay-stack.js';
import {
  cancelDeferredFocusReturn,
  captureFocusReturnOpener,
  scheduleDeferredFocusReturn,
} from './deferred-focus-return.js';

const presentations = new WeakMap<Document, Set<ModalSurfaceController>>();

/** Keeps a modal host above sibling top-layer surfaces when no nested native carrier is needed. */
export class ModalSurfaceController {
  private opener: HTMLElement | null = null;
  private active = false;
  private observationDocument?: Document;
  private releaseObservation?: () => void;
  private generation = 0;
  private reconcileQueued = false;
  private highestModal?: HTMLElement;
  private presentedSurface?: HTMLElement;
  private previousHostPopover?: string | null;
  private presentationDocument?: Document;
  private activationOrder?: number;
  private closing = false;
  constructor(
    private readonly host: HTMLElement & { readonly updateComplete: Promise<unknown> },
    private readonly carrier: NativeModalCarrier,
    private readonly surface?: () => HTMLElement | null,
  ) {}

  prepare(): void {
    this.carrier.prepare();
  }

  /** Applies the common open effect before component-specific state resets. */
  open(activate: () => void): void {
    cancelDeferredFocusReturn(this.host);
    this.opener = captureFocusReturnOpener(this.host);
    this.prepare();
    activate();
  }

  /** Returns focus after the owner's synchronous overlay deactivation if its opener reappears. */
  close(hadOverlay: boolean, deactivate: () => void, isCurrent: () => boolean): void {
    this.hide();
    deactivate();
    const opener = this.opener;
    this.opener = null;
    if (hadOverlay && opener && this.host.isConnected) {
      scheduleDeferredFocusReturn({
        host: this.host,
        candidates: () => [opener],
        isCurrent,
      });
    }
  }

  disconnect(): void {
    this.hide();
    cancelDeferredFocusReturn(this.host);
  }

  show(): void {
    if (!this.host.isConnected) return;
    this.active = true;
    const document = this.host.ownerDocument;
    this.closing = false;
    if (this.presentationDocument !== document) {
      this.releasePresentation();
      let owners = presentations.get(document);
      if (!owners) {
        owners = new Set();
        presentations.set(document, owners);
      }
      owners.add(this);
      this.presentationDocument = document;
    }
    if (this.observationDocument !== document) {
      this.stopObservation();
      this.observationDocument = document;
      this.releaseObservation = observeOverlayStack(document, ({ entries }) => {
        const own = entries.find(entry => entry.host === this.host);
        if (own) this.activationOrder = own.order;
        this.highestModal = undefined;
        for (let index = entries.length - 1; index >= 0; index -= 1) {
          const entry = entries[index]!;
          if (!entry.modal) continue;
          this.highestModal = entry.host;
          break;
        }
        this.queueReconcile(document);
      });
    }
    try {
      if (this.carrier.show()) {
        this.releaseSurface();
        return;
      }
    } catch (error) {
      this.active = false;
      this.stopObservation();
      this.releasePresentation();
      throw error;
    }
    this.reconcile();
  }

  /** Keeps a closing surface visible until its owner finishes the exit animation. */
  beginClose(): void {
    this.active = false;
    this.closing = this.presentedSurface !== undefined && this.surfaceIsShowing();
    this.stopObservation();
    if (!this.closing) this.releasePresentation();
  }

  private queueReconcile(document: Document): void {
    if (this.reconcileQueued) return;
    const view = document.defaultView;
    if (!view) return;
    this.reconcileQueued = true;
    const generation = this.generation;
    view.queueMicrotask(() => {
      if (generation !== this.generation || document !== this.host.ownerDocument) return;
      this.reconcileQueued = false;
      this.reconcile();
    });
  }

  private reconcile(): void {
    if (!this.active || !this.host.isConnected || this.observationDocument !== this.host.ownerDocument) return;
    // Native presentation is attempted only by the owner's explicit show call. A stack update
    // must not reopen a carrier that native close handling is currently dismissing.
    if (this.carrier.requested) return;
    const surface = this.surface ? this.surface() : this.host;
    if (this.presentedSurface !== surface) this.releaseSurface();
    if (!surface) return;
    // Leave an existing promotion in place: a newer modal promotes above it, preserving the
    // native order of any retained author-owned nonmodal popovers inside this surface.
    if (this.surface ? isLibraryPromotedAndShowing(surface) : this.hostIsShowing()) return;
    // A reconnect loses native membership but retains logical activation order. Wait until
    // exposed instead of inserting this older surface above a newer modal and its children.
    if (this.highestModal !== this.host) return;
    if (this.activationOrder === undefined) return;
    for (const other of presentations.get(this.host.ownerDocument) ?? []) {
      if (other.closing && other.activationOrder !== undefined && other.activationOrder > this.activationOrder) return;
    }
    if (this.surface) {
      if (promoteToTopLayer(surface)) this.presentedSurface = surface;
      return;
    }
    if (typeof this.host.showPopover !== 'function') return;
    this.previousHostPopover = this.host.getAttribute('popover');
    this.host.setAttribute('popover', 'manual');
    try {
      this.host.showPopover();
      this.presentedSurface = this.host;
    } catch {
      this.restoreHostPopover();
    }
  }

  private hostIsShowing(): boolean {
    try {
      return this.host.matches(':popover-open');
    } catch {
      return false;
    }
  }

  private surfaceIsShowing(): boolean {
    const surface = this.presentedSurface;
    return surface !== undefined && (this.surface ? isLibraryPromotedAndShowing(surface) : this.hostIsShowing());
  }

  private releasePresentation(): void {
    const document = this.presentationDocument;
    this.presentationDocument = undefined;
    this.activationOrder = undefined;
    this.closing = false;
    if (!document) return;
    const owners = presentations.get(document);
    owners?.delete(this);
    if (!owners?.size) presentations.delete(document);
    else for (const owner of owners) owner.queueReconcile(document);
  }

  private restoreHostPopover(): void {
    const previous = this.previousHostPopover;
    this.previousHostPopover = undefined;
    if (previous === undefined || this.host.getAttribute('popover') !== 'manual') return;
    if (previous === null) this.host.removeAttribute('popover');
    else this.host.setAttribute('popover', previous);
  }

  private stopObservation(): void {
    this.generation += 1;
    this.reconcileQueued = false;
    this.releaseObservation?.();
    this.releaseObservation = undefined;
    this.observationDocument = undefined;
    this.highestModal = undefined;
  }

  private releaseSurface(): void {
    const surface = this.presentedSurface;
    this.presentedSurface = undefined;
    if (!surface) return;
    if (this.surface) {
      releaseTopLayer(surface);
      return;
    }
    try {
      if (this.hostIsShowing()) surface.hidePopover();
    } catch {
      // Removal or a native close may already have ended presentation.
    } finally {
      this.restoreHostPopover();
    }
  }

  hide(): void {
    this.beginClose();
    this.carrier.hide();
    this.releaseSurface();
    this.releasePresentation();
  }
}
