import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './image-comparer.js';
import type { LyraImageComparer } from './image-comparer.js';
import { styles } from './image-comparer.styles.js';

it('renders before and after slots with a positioned divider', async () => {
  const el = (await fixture(html`
    <lr-image-comparer position="35" aria-label="Before and after">
      <img slot="before" alt="Before" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" />
      <img slot="after" alt="After" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" />
    </lr-image-comparer>
  `)) as LyraImageComparer;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="before"] slot[name="before"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="after"] slot[name="after"]')).to.exist;
  expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).style.getPropertyValue('--lr-comparer-position')).to.equal('35%');
});

it('clamps a NaN/out-of-range position into [0, 100] for rendering, without mutating the raw property', async () => {
  const el = (await fixture(html`<lr-image-comparer></lr-image-comparer>`)) as LyraImageComparer;
  await el.updateComplete;
  const base = () => el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  el.position = NaN;
  await el.updateComplete;
  expect(base().style.getPropertyValue('--lr-comparer-position')).to.equal('50%'); // documented fallback

  el.position = -20;
  await el.updateComplete;
  expect(base().style.getPropertyValue('--lr-comparer-position')).to.equal('0%');

  el.position = 150;
  await el.updateComplete;
  expect(base().style.getPropertyValue('--lr-comparer-position')).to.equal('100%');
  expect(el.position).to.equal(150); // the raw property itself is left untouched, matching native <input type=range>
});

it('emits position changes from the native range handle', async () => {
  const el = (await fixture(html`<lr-image-comparer></lr-image-comparer>`)) as LyraImageComparer;
  await el.updateComplete;
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLInputElement;
  handle.value = '70';
  const eventPromise = oneEvent(el, 'lr-position-change');
  handle.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  const event = await eventPromise;

  expect(event.detail).to.deep.equal({ position: 70 });
  expect(el.position).to.equal(70);
});

it('falls back to the localized default label when no aria-label is set', async () => {
  const el = (await fixture(html`
    <lr-image-comparer>
      <div slot="before">Before</div>
      <div slot="after">After</div>
    </lr-image-comparer>
  `)) as LyraImageComparer;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Image comparison');
  expect(handle.getAttribute('aria-label')).to.equal('Image comparison');
});

it('renders a .strings override for the default label', async () => {
  const el = (await fixture(html`
    <lr-image-comparer .strings=${{ imageComparerLabel: 'Comparaison des images' }}>
      <div slot="before">Before</div>
      <div slot="after">After</div>
    </lr-image-comparer>
  `)) as LyraImageComparer;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Comparaison des images');
});

it('switches the native range handle to a vertical writing-mode so drag input maps to the visible vertical divider', async () => {
  const horizontal = (await fixture(html`<lr-image-comparer></lr-image-comparer>`)) as LyraImageComparer;
  await horizontal.updateComplete;
  const horizontalHandle = horizontal.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  expect(getComputedStyle(horizontalHandle).writingMode).to.equal('horizontal-tb');

  const vertical = (await fixture(html`<lr-image-comparer orientation="vertical"></lr-image-comparer>`)) as LyraImageComparer;
  await vertical.updateComplete;
  const verticalHandle = vertical.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  expect(getComputedStyle(verticalHandle).writingMode).to.equal('vertical-lr');
  // Pinned to ltr regardless of an ambient dir="rtl" so the handle's top-to-bottom value
  // progression always matches the divider's own always-top-anchored inset-block-start.
  expect(getComputedStyle(verticalHandle).direction).to.equal('ltr');
  expect(verticalHandle.getAttribute('aria-orientation')).to.equal('vertical');
  expect(horizontalHandle.getAttribute('aria-orientation')).to.equal('horizontal');
});

it('forwards host focus(), blur(), and click() to the range handle', async () => {
  const el = (await fixture(html`<lr-image-comparer></lr-image-comparer>`)) as LyraImageComparer;
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLInputElement;
  let clicks = 0;
  handle.addEventListener('click', () => clicks++);
  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('handle');
  el.blur();
  expect(el.shadowRoot!.activeElement).to.equal(null);
  el.click();
  expect(clicks).to.equal(1);
});

it('gives the drag handle a hover state matching its focus-visible affordance', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='handle'\]:hover/);
});

it('is accessible', async () => {
  const el = (await fixture(html`
    <lr-image-comparer aria-label="Compare images">
      <div slot="before">Before</div>
      <div slot="after">After</div>
    </lr-image-comparer>
  `)) as LyraImageComparer;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
