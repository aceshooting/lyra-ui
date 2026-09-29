import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../components/overlays/chip/chip.js';
import '../components/overlays/badge/tag.js';
import '../components/layout/card/card.js';
import '../components/layout/widget/widget.js';
import '../components/overlays/progress/progress-bar.js';
import '../components/overlays/progress/progress-ring.js';

const surfaces = [
  { tag: 'lr-chip', attribute: 'removable', selector: '[part~="remove-button"]' },
  { tag: 'lr-tag', attribute: 'with-remove', selector: '[part~="remove-button"]' },
  { tag: 'lr-card', attribute: 'actionable', selector: '[part="activation-button"]' },
  { tag: 'lr-widget', attribute: 'fullscreen', selector: '[part="base"]', slot: 'label' },
  { tag: 'lr-progress-bar', attribute: '', selector: '[role="progressbar"]' },
  { tag: 'lr-progress-ring', attribute: '', selector: '[role="progressbar"]' },
] as const;

describe('live composed labels', () => {
  for (const surface of surfaces) {
    for (const lazy of [false, true]) {
      it(`${surface.tag} refreshes after ${lazy ? 'custom-element upgrade' : 'shadow text mutation'}`, async () => {
        const wrapper = await fixture<HTMLElement>(html`<div></div>`);
        const host = document.createElement(surface.tag);
        if (surface.attribute) host.setAttribute(surface.attribute, '');
        const childName = `test-live-label-${crypto.randomUUID()}`;
        const child = document.createElement(lazy ? childName : 'span');
        if ('slot' in surface) child.slot = surface.slot;
        if (!lazy) child.attachShadow({ mode: 'open' }).innerHTML = '<span>Alpha</span>';
        host.append(child);
        wrapper.append(host);
        const label = () => host.shadowRoot?.querySelector(surface.selector)?.getAttribute('aria-label') ?? '';
        if (lazy) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          customElements.define(childName, class extends HTMLElement {
            constructor() {
              super();
              this.attachShadow({ mode: 'open' }).innerHTML = '<span>Beta</span>';
            }
          });
        } else {
          await waitUntil(() => label().includes('Alpha'), 'initial composed label was not sampled');
          child.shadowRoot!.innerHTML = '<span>Beta</span>';
        }
        await waitUntil(() => label().includes('Beta'), 'changed composed label stayed stale');
        expect(label()).not.to.include('Alpha');
      });
    }
  }
});
