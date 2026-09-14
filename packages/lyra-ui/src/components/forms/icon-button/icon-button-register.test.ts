import { expect, fixture, html } from '@open-wc/testing';
import './icon-button-register.js';
import type { LyraIconButton } from './icon-button.class.js';

describe('lr-icon-button: lean registration entry', () => {
  it('registers lr-icon-button and nothing else', () => {
    expect(customElements.get('lr-icon-button') !== undefined, 'lr-icon-button is defined').to.equal(
      true
    );
    // The whole point of the entry: a slot-only consumer does not ship lr-icon's implementation in
    // the entry chunk, nor the sanitizer chunk its guarded remote-SVG loader reaches for.
    expect(customElements.get('lr-icon') === undefined, 'lr-icon stays unregistered').to.equal(true);
  });

  it('upgrades and renders slotted icon content with no lr-icon in the graph', async () => {
    const el = (await fixture(html`
      <lr-icon-button aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
      </lr-icon-button>
    `)) as LyraIconButton;
    await el.updateComplete;
    const control = el.shadowRoot!.querySelector('[part~="button"]');
    expect(control?.localName, 'the native control rendered').to.equal('button');
    expect(control?.getAttribute('aria-label')).to.equal('Close');
    expect(
      el.shadowRoot!.querySelectorAll('lr-icon').length,
      'no nested lr-icon is rendered for slot-only content'
    ).to.equal(0);
  });
});
