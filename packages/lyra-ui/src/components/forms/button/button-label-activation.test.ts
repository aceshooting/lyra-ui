import { expect, fixture, html } from '@open-wc/testing';
import './button.js';
import type { LyraButton } from './button.class.js';

const settle = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

async function labelled(): Promise<{ label: HTMLLabelElement; button: LyraButton; clicks: () => number }> {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <label for="label-activation-target">Save draft</label>
    <lr-button id="label-activation-target">Go</lr-button>
    <span id="label-activation-other"></span>
  </div>`);
  const button = wrapper.querySelector<LyraButton>('lr-button')!;
  await button.updateComplete;
  // The UA's own label-forwarded click targets the host and carries no activation behavior; the
  // button's label controller then activates the inner control, which is what counts here.
  let count = 0;
  button.addEventListener('click', (event) => { if (event.composedPath()[0] !== button) count += 1; });
  return { label: wrapper.querySelector('label')!, button, clicks: () => count };
}

describe('lr-button external label activation', () => {
  it('activates the button once from an associated label click', async () => {
    const { label, clicks } = await labelled();
    label.click();
    await settle();
    expect(clicks()).to.equal(1);
  });

  it('does not activate the button once the label points elsewhere, and drops the stale name', async () => {
    const { label, button, clicks } = await labelled();
    const base = button.shadowRoot!.querySelector('[part~="base"]')!;
    expect(base.getAttribute('aria-label')).to.equal('Save draft');

    label.htmlFor = 'label-activation-other';
    label.click();
    await settle();
    await button.updateComplete;

    expect(clicks()).to.equal(0);
    expect(base.hasAttribute('aria-label')).to.equal(false);
  });

  it('respects a label click whose default action was prevented', async () => {
    const { label, clicks } = await labelled();
    label.addEventListener('click', (event) => event.preventDefault());
    label.click();
    await settle();
    expect(clicks()).to.equal(0);
  });

  it('does not activate a button removed before the queued activation runs', async () => {
    const { label, button, clicks } = await labelled();
    label.click();
    button.remove();
    await settle();
    expect(clicks()).to.equal(0);
  });
});

describe('lr-button type normalization', () => {
  it('falls back to a plain button for a non-string type', async () => {
    const button = await fixture<LyraButton>(html`<lr-button type="submit">Go</lr-button>`);
    (button as unknown as { type: unknown }).type = 7;
    expect(button.type).to.equal('button');
  });

  it('treats a submit button outside any form as inert', async () => {
    const button = await fixture<LyraButton>(html`<lr-button type="submit">Go</lr-button>`);
    let submits = 0;
    const onSubmit = () => { submits += 1; };
    document.addEventListener('submit', onSubmit, true);
    try {
      button.click();
      await settle();
    } finally {
      document.removeEventListener('submit', onSubmit, true);
    }
    expect(submits).to.equal(0);
  });
});
