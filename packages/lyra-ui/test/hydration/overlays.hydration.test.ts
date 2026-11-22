import { html, ssrFixture } from '../wtr-ssr-fixture.js';
import { expect, waitUntil } from '@open-wc/testing';

interface AlertHost extends HTMLElement {
  open: boolean;
  updateComplete: Promise<boolean>;
}

interface RatingHost extends HTMLElement {
  value: number;
  updateComplete: Promise<boolean>;
}

describe('hydrated overlays', () => {
  it('lr-alert keeps its server open state and closes from its button after hydration', async () => {
    const alert = await ssrFixture<AlertHost>(html`<lr-alert open closable variant="success">Saved</lr-alert>`);
    expect(alert.open).to.equal(true);
    alert.shadowRoot!.querySelector<HTMLElement>('[part~="close-button"]')!.click();
    await waitUntil(() => !alert.open, 'the hydrated close button must close the alert');
  });

  it('lr-rating keeps its server value, form entry and keyboard control after hydration', async () => {
    const form = await ssrFixture<HTMLFormElement>(html`<form><lr-rating name="score" value="3" label="Score"></lr-rating></form>`);
    const rating = form.querySelector<RatingHost>('lr-rating')!;
    expect(rating.value).to.equal(3);
    expect(rating.getAttribute('aria-valuenow')).to.equal('3');
    expect(new FormData(form).get('score')).to.equal('3');
    rating.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await rating.updateComplete;
    expect(rating.value).to.equal(4);
    expect(new FormData(form).get('score')).to.equal('4');
  });

  it('lr-badge adopts its server shadow tree with slotted start and end content', async () => {
    const badge = await ssrFixture(html`<lr-badge variant="primary"><span slot="start">●</span>Live<span slot="end">3</span></lr-badge>`);
    expect(badge.getAttribute('variant')).to.equal('primary');
    expect(badge.shadowRoot!.querySelector('slot[name="start"]')).to.not.equal(null);
  });
});
