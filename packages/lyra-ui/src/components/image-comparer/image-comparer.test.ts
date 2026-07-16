import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './image-comparer.js';
import type { LyraImageComparer } from './image-comparer.js';

it('renders before and after slots with a positioned divider', async () => {
  const el = (await fixture(html`
    <lyra-image-comparer position="35" aria-label="Before and after">
      <img slot="before" alt="Before" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" />
      <img slot="after" alt="After" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" />
    </lyra-image-comparer>
  `)) as LyraImageComparer;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="before"] slot[name="before"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="after"] slot[name="after"]')).to.exist;
  expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).style.getPropertyValue('--lyra-comparer-position')).to.equal('35%');
});

it('emits position changes from the native range handle', async () => {
  const el = (await fixture(html`<lyra-image-comparer></lyra-image-comparer>`)) as LyraImageComparer;
  await el.updateComplete;
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLInputElement;
  handle.value = '70';
  const eventPromise = oneEvent(el, 'lyra-position-change');
  handle.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  const event = await eventPromise;

  expect(event.detail).to.deep.equal({ position: 70 });
  expect(el.position).to.equal(70);
});

it('falls back to the localized default label when no aria-label is set', async () => {
  const el = (await fixture(html`
    <lyra-image-comparer>
      <div slot="before">Before</div>
      <div slot="after">After</div>
    </lyra-image-comparer>
  `)) as LyraImageComparer;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Image comparison');
  expect(handle.getAttribute('aria-label')).to.equal('Image comparison');
});

it('renders a .strings override for the default label', async () => {
  const el = (await fixture(html`
    <lyra-image-comparer .strings=${{ imageComparerLabel: 'Comparaison des images' }}>
      <div slot="before">Before</div>
      <div slot="after">After</div>
    </lyra-image-comparer>
  `)) as LyraImageComparer;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Comparaison des images');
});

it('is accessible', async () => {
  const el = (await fixture(html`
    <lyra-image-comparer aria-label="Compare images">
      <div slot="before">Before</div>
      <div slot="after">After</div>
    </lyra-image-comparer>
  `)) as LyraImageComparer;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
