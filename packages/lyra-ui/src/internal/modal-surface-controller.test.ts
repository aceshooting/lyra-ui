import { expect, fixture, html as fixtureHtml } from '@open-wc/testing';
import { LitElement, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { ModalSurfaceController } from './modal-surface-controller.js';
import { NativeModalCarrier } from './native-modal-carrier.js';
import { activateOverlay, type OverlayHandle } from './overlay-manager.js';

class ModalHost extends LitElement {
  @property({ type: Boolean }) open = false;
  overlay?: OverlayHandle;
  activations = 0;
  private readonly carrier = new NativeModalCarrier(this, { onCancel: () => undefined, onUnexpectedClose: () => undefined });
  readonly surface = new ModalSurfaceController(this, this.carrier);

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('open')) return;
    if (this.open) this.surface.open(() => this.activate());
    else if (changed.get('open') === true) {
      this.surface.close(this.overlay !== undefined, () => { this.overlay?.deactivate(); this.overlay = undefined; }, () => !this.open);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (this.open) this.surface.show();
    if (changed.has('open') && this.open) this.overlay?.focusInitial();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.surface.reconnect({ isOpen: () => this.open, overlay: () => this.overlay, activate: () => this.activate() });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.surface.disconnect();
    this.overlay?.suspend();
  }

  activate(): void {
    this.activations += 1;
    this.overlay = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]') ?? null,
      onEscape: () => { this.open = false; },
      lockScroll: true,
      suspendWhenUnrendered: true,
    });
  }

  protected override render() {
    return this.open ? html`<div part="panel"><button id="first">First</button></div>` : html``;
  }
}
customElements.define('h3c-modal-host', ModalHost);

const focusedId = (host: ModalHost) => (host.shadowRoot?.activeElement as HTMLElement | null)?.id ?? null;
const presented = (host: ModalHost) => host.matches(':popover-open');

describe('ModalSurfaceController.reconnect', () => {
  it('resumes the trap, restores focus before the update and presents again after it', async () => {
    const host = await fixture<ModalHost>(fixtureHtml`<h3c-modal-host open></h3c-modal-host>`);
    await host.updateComplete;
    expect([focusedId(host), presented(host), host.activations]).to.deep.equal(['first', true, 1]);
    const target = document.createElement('div');
    document.body.append(target);
    try {
      target.append(host);
      expect(focusedId(host), 'focus before the update').to.equal('first');
      expect(document.documentElement.style.overflow).to.equal('hidden');
      await host.updateComplete;
      expect([focusedId(host), presented(host), host.activations]).to.deep.equal(['first', true, 1]);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await host.updateComplete;
      expect([host.open, document.documentElement.style.overflow]).to.deep.equal([false, '']);
    } finally {
      target.remove();
    }
  });

  it('activates a fresh overlay when the suspended handle is gone', async () => {
    const host = await fixture<ModalHost>(fixtureHtml`<h3c-modal-host open></h3c-modal-host>`);
    await host.updateComplete;
    const target = document.createElement('div');
    document.body.append(target);
    try {
      host.remove();
      host.overlay?.deactivate();
      host.overlay = undefined;
      target.append(host);
      expect(host.activations).to.equal(2);
      await host.updateComplete;
      expect([focusedId(host), presented(host), document.documentElement.style.overflow]).to.deep.equal(['first', true, 'hidden']);
    } finally {
      host.overlay?.deactivate();
      target.remove();
    }
  });

  it('does nothing while closed or before the first update', async () => {
    const closed = await fixture<ModalHost>(fixtureHtml`<h3c-modal-host></h3c-modal-host>`);
    const target = document.createElement('div');
    document.body.append(target);
    try {
      target.append(closed);
      await closed.updateComplete;
      expect([closed.activations, presented(closed)]).to.deep.equal([0, false]);
      const fresh = document.createElement('h3c-modal-host') as ModalHost;
      fresh.open = true;
      target.append(fresh);
      expect(fresh.activations, 'the first update owns activation').to.equal(0);
      await fresh.updateComplete;
      expect([fresh.activations, presented(fresh)]).to.deep.equal([1, true]);
      fresh.open = false;
      await fresh.updateComplete;
    } finally {
      target.remove();
    }
  });

  it('skips the deferred presentation when the host closes or leaves before the update', async () => {
    const host = await fixture<ModalHost>(fixtureHtml`<h3c-modal-host open></h3c-modal-host>`);
    await host.updateComplete;
    const target = document.createElement('div');
    document.body.append(target);
    try {
      target.append(host);
      host.remove();
      await host.updateComplete;
      expect(presented(host), 'detached').to.equal(false);
      target.append(host);
      host.open = false;
      await host.updateComplete;
      expect(presented(host), 'closed').to.equal(false);
    } finally {
      target.remove();
    }
  });

  it('runs only the latest deferred presentation, also after a rejected update', async () => {
    for (const settle of [() => Promise.resolve(true), () => Promise.reject(new Error('update failed'))]) {
      const updateComplete = settle();
      const host = Object.assign(document.createElement('div'), { hasUpdated: true, updateComplete, requestUpdate: () => undefined });
      document.body.append(host);
      const controller = new ModalSurfaceController(host, new NativeModalCarrier(host, {
        onCancel: () => undefined, onUnexpectedClose: () => undefined,
      }));
      const calls: string[] = [];
      const overlay = (label: string) => ({
        focusInitial: () => { calls.push(label); },
        isActive: () => true,
        resume: () => { calls.push(`resume ${label}`); },
      });
      try {
        controller.reconnect({ isOpen: () => true, overlay: () => overlay('a'), activate: () => undefined });
        controller.reconnect({ isOpen: () => true, overlay: () => overlay('b'), activate: () => undefined });
        await updateComplete.catch(() => undefined);
        await Promise.resolve();
        expect(calls).to.deep.equal(['resume a', 'a', 'resume b', 'b', 'b']);
      } finally {
        controller.disconnect();
        host.remove();
      }
    }
  });
});
