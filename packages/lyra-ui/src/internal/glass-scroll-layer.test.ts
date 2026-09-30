import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { css } from 'lit';
import { LyraElement } from './lyra-element.js';
import { GlassScrollLayer } from './glass-scroll-layer.js';

class LazyGlassFixture extends LyraElement {
  static override properties = { visible: { type: Boolean } };
  visible = false;
  updates = 0;
  readonly material = new GlassScrollLayer(this, '.surface', () => this.visible);
  static override styles = [LyraElement.styles, css`
    :host { display: block; }
    .surface { height: 100px; width: 160px; overflow: auto; }
  `];
  protected override updated(): void { this.updates++; }
  override render() {
    return html`<div class="surface" ?hidden=${!this.visible}><span class="glass-scroll-layer"></span></div>`;
  }
}
customElements.define('test-lazy-glass-layer', LazyGlassFixture);

describe('lazy glass scroll measurements', () => {
  it('does not allocate observers while closed and releases observation on hide', async () => {
    const original = window.ResizeObserver;
    let created = 0;
    let disconnected = 0;
    class TrackedObserver extends original {
      constructor(callback: ResizeObserverCallback) { super(callback); created++; }
      override disconnect(): void { super.disconnect(); disconnected++; }
    }
    window.ResizeObserver = TrackedObserver;
    try {
      const host = await fixture<LazyGlassFixture>(html`<test-lazy-glass-layer></test-lazy-glass-layer>`);
      const layer = host.shadowRoot!.querySelector<HTMLElement>('.glass-scroll-layer')!;
      expect(created).to.equal(0);
      expect(layer.style.getPropertyValue('--_lr-glass-viewport-height')).to.equal('');
      host.visible = true;
      await host.updateComplete;
      await waitUntil(() => layer.style.getPropertyValue('--_lr-glass-viewport-height') === '100px');
      expect(created).to.equal(1);
      host.visible = false;
      await host.updateComplete;
      expect(disconnected).to.equal(1);
      host.visible = true;
      await host.updateComplete;
      await waitUntil(() => created === 2);
      host.remove();
    } finally { window.ResizeObserver = original; }
  });

  it('measures the current replacement surface when queued without ResizeObserver', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'ResizeObserver')!;
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: undefined });
    try {
      const host = await fixture<LazyGlassFixture>(html`<test-lazy-glass-layer visible></test-lazy-glass-layer>`);
      const original = host.shadowRoot!.querySelector<HTMLElement>('.surface')!;
      host.material.hostUpdated();
      const replacement = document.createElement('div');
      replacement.className = 'surface';
      replacement.style.height = '180px';
      replacement.innerHTML = '<span class="glass-scroll-layer"></span>';
      original.replaceWith(replacement);
      host.material.hostUpdated();
      host.material.hostUpdated();
      await Promise.resolve();
      const layer = replacement.querySelector<HTMLElement>('.glass-scroll-layer')!;
      expect(layer.style.getPropertyValue('--_lr-glass-viewport-height')).to.equal('180px');
      const updates = host.updates;
      const parent = host.parentElement!;
      host.remove();
      layer.style.removeProperty('--_lr-glass-viewport-height');
      parent.append(host);
      await waitUntil(() => layer.style.getPropertyValue('--_lr-glass-viewport-height') === '180px');
      expect(host.updates).to.equal(updates);
    } finally { Object.defineProperty(window, 'ResizeObserver', descriptor); }
  });

  it('observes live resizes after replacing an already measured surface', async () => {
    const host = await fixture<LazyGlassFixture>(html`<test-lazy-glass-layer visible></test-lazy-glass-layer>`);
    const original = host.shadowRoot!.querySelector<HTMLElement>('.surface')!;
    const originalLayer = original.querySelector<HTMLElement>('.glass-scroll-layer')!;
    await waitUntil(() => originalLayer.style.getPropertyValue('--_lr-glass-viewport-width') === '160px');
    const replacement = document.createElement('div');
    replacement.className = 'surface';
    replacement.innerHTML = '<span class="glass-scroll-layer"></span>';
    original.replaceWith(replacement);
    host.material.hostUpdated();
    const layer = replacement.querySelector<HTMLElement>('.glass-scroll-layer')!;
    await waitUntil(() => layer.style.getPropertyValue('--_lr-glass-viewport-width') === '160px');
    replacement.style.width = '220px';
    await waitUntil(() => layer.style.getPropertyValue('--_lr-glass-viewport-width') === '220px');
    expect(originalLayer.style.getPropertyValue('--_lr-glass-viewport-width')).to.equal('160px');
  });
});
