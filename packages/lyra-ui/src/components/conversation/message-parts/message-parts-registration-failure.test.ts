import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import type { LyraMessageParts } from './message-parts.class.js';
import '../../lr-message-parts.js';

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
      @lr-render-error=${(event: CustomEvent<{ error: unknown }>) => errors.push(event.detail.error)}
    ></lr-message-parts>`);
    const failed = oneEvent(el, 'lr-render-error');
    el.parts = [
      { id: 'answer', type: 'text', text: 'The answer remains available.' },
      { id: 'source', type: 'citation', citation: { id: 'cite', label: 'Source' } },
    ];
    await failed;
    await el.updateComplete;
    expect(errors.length).to.equal(1);
    expect(el.shadowRoot!.querySelector('[aria-busy="false"]') !== null).to.equal(true);
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
    const parent = el.parentNode!;
    const retried = oneEvent(el, 'lr-render-error');
    el.remove();
    parent.append(el);
    await retried;
    expect(errors.length, 'a reconnect retries the failed registration').to.equal(2);
    el.renderPart = part => part.type === 'citation' ? html`<a href="#source">Source details</a>` : undefined;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('a')?.textContent).to.equal('Source details');
    expect(el.shadowRoot!.querySelectorAll('[aria-busy]').length).to.equal(0);
    expect(errors.length).to.equal(2);
  } finally {
    customElements.define = original;
  }
});

it('loads the shared resume button when the first interrupted part arrives', async () => {
  const el = await fixture<LyraMessageParts>(html`<lr-message-parts content-mode="plain"></lr-message-parts>`);
  expect(Boolean(customElements.get('lr-button'))).to.equal(false);
  el.parts = [{ id: 'draft', type: 'text', text: 'Draft', state: 'interrupted', interruption: { resumable: true } }];
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="resume"]')?.shadowRoot?.querySelector('button');
  expect(Boolean(button)).to.equal(true);
  const resumed = oneEvent(el, 'lr-part-resume');
  button!.click();
  expect((await resumed).detail.part.id).to.equal('draft');
});
