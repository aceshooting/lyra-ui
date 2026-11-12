import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraMessageParts } from './message-parts.class.js';
import './message-parts.js';

it('replaces a failed lazy citation registration with a localized, settled fallback and permits a host renderer', async () => {
  const original = customElements.define;
  const failure = new Error('Private renderer registration diagnostic');
  let attempts = 0;
  customElements.define = function (name, constructor, options) {
    if (name === 'lr-citation-badge') {
      attempts++;
      throw failure;
    }
    original.call(this, name, constructor, options);
  };
  const errors: unknown[] = [];
  try {
    const el = await fixture<LyraMessageParts>(html`<lr-message-parts content-mode="plain"
      .strings=${{ messagePartError: 'Source preview unavailable' }}
      .parts=${[
        { id: 'answer', type: 'text', text: 'The answer remains available.' },
        { id: 'source', type: 'citation', citation: { id: 'cite', label: 'Source' } },
      ]}
      @lr-render-error=${(event: CustomEvent<{ error: unknown }>) => errors.push(event.detail.error)}
    ></lr-message-parts>`);
    await waitUntil(() => errors.length === 1 && el.shadowRoot!.querySelector('[aria-busy="false"]') !== null);
    expect(errors[0]).to.equal(failure);
    expect(attempts).to.equal(1);
    expect(el.shadowRoot!.querySelector('[aria-busy="false"]')!.textContent).to.equal('Source preview unavailable');
    expect(el.shadowRoot!.textContent).to.include('The answer remains available.');
    expect(el.shadowRoot!.textContent).not.to.include(failure.message);
    expect(el.shadowRoot!.querySelectorAll('[aria-busy="true"]').length).to.equal(0);
    el.requestUpdate();
    await el.updateComplete;
    expect(attempts).to.equal(1);
    expect(errors.length).to.equal(1);
    el.renderPart = part => part.type === 'citation' ? html`<a href="#source">Source details</a>` : undefined;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('a')?.textContent).to.equal('Source details');
    expect(el.shadowRoot!.querySelectorAll('[aria-busy]').length).to.equal(0);
    expect(errors.length).to.equal(1);
  } finally {
    customElements.define = original;
  }
});
