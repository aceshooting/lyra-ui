import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './image-comparer.js';
import type { LyraImageComparer } from './image-comparer.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

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
  expect((el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement).style.getPropertyValue('--lr-comparer-position')).to.equal('35%');
});

it('clamps a NaN/out-of-range position into [0, 100] for rendering, without mutating the raw property', async () => {
  const el = (await fixture(html`<lr-image-comparer></lr-image-comparer>`)) as LyraImageComparer;
  await el.updateComplete;
  const base = () => el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

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
  const handle = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  handle.value = '70';
  const eventPromise = oneEvent(el, 'lr-position-change');
  handle.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  const event = await eventPromise;

  expect(event.detail).to.deep.equal({ position: 70 });
  expect(el.position).to.equal(70);
});

it('bridges the native range change event as a bubbling composed native Event', async () => {
  const el = (await fixture(html`<lr-image-comparer></lr-image-comparer>`)) as LyraImageComparer;
  const input = el.shadowRoot!.querySelector('input[type="range"]') as HTMLInputElement;
  input.value = '64';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const changed = oneEvent(el, 'change');
  const mappedChanged = oneEvent(el, 'lr-change');
  input.dispatchEvent(new Event('change', { bubbles: true }));
  const event = await changed;
  const mappedEvent = await mappedChanged;

  expect(event.constructor.name).to.equal('Event');
  expect(event.bubbles).to.be.true;
  expect(event.composed).to.be.true;
  expect(mappedEvent instanceof CustomEvent).to.be.true;
  expect(mappedEvent.bubbles).to.be.true;
  expect(mappedEvent.composed).to.be.true;
  expect(mappedEvent.cancelable).to.be.false;
  expect(el.position).to.equal(64);
});

it('renders the handle slot and resolves both upstream sizing properties', async () => {
  const el = (await fixture(html`<lr-image-comparer
    style="--divider-width: 7px; --handle-size: 31px"
  >
    <span slot="handle" aria-hidden="true">drag</span>
  </lr-image-comparer>`)) as LyraImageComparer;
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  const handleVisual = el.shadowRoot!.querySelector('.handle-visual') as HTMLElement;
  const handleSlot = el.shadowRoot!.querySelector('slot[name="handle"]') as HTMLSlotElement;

  expect(handleSlot.assignedElements().map((node) => node.localName)).to.deep.equal(['span']);
  expect(getComputedStyle(divider).inlineSize).to.equal('7px');
  expect(getComputedStyle(handleVisual).inlineSize).to.equal('31px');
  expect(getComputedStyle(handleVisual).blockSize).to.equal('31px');
});

it('publishes dragging only for the active pointer gesture and clears it on cancellation', async () => {
  const el = (await fixture(html`<lr-image-comparer></lr-image-comparer>`)) as LyraImageComparer;
  const input = el.shadowRoot!.querySelector('input[type="range"]') as HTMLInputElement;

  input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }));
  expect(el.matches(':state(dragging)')).to.be.true;
  input.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 7 }));
  expect(el.matches(':state(dragging)')).to.be.false;

  input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8 }));
  expect(el.matches(':state(dragging)')).to.be.true;
  el.remove();
  expect(el.matches(':state(dragging)')).to.be.false;
});

it('falls back to the localized default label when no aria-label is set', async () => {
  const el = (await fixture(html`
    <lr-image-comparer>
      <div slot="before">Before</div>
      <div slot="after">After</div>
    </lr-image-comparer>
  `)) as LyraImageComparer;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const handle = el.shadowRoot!.querySelector('[part="input"]') as HTMLElement;
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
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Comparaison des images');
});

it('switches the native range handle to a vertical writing-mode so drag input maps to the visible vertical divider', async () => {
  const horizontal = (await fixture(html`<lr-image-comparer></lr-image-comparer>`)) as LyraImageComparer;
  await horizontal.updateComplete;
  const horizontalHandle = horizontal.shadowRoot!.querySelector('[part="input"]') as HTMLElement;
  expect(getComputedStyle(horizontalHandle).writingMode).to.equal('horizontal-tb');

  const vertical = (await fixture(html`<lr-image-comparer orientation="vertical"></lr-image-comparer>`)) as LyraImageComparer;
  await vertical.updateComplete;
  const verticalHandle = vertical.shadowRoot!.querySelector('[part="input"]') as HTMLElement;
  expect(getComputedStyle(verticalHandle).writingMode).to.equal('vertical-lr');
  // Pinned to ltr regardless of an ambient dir="rtl" so the handle's top-to-bottom value
  // progression always matches the divider's own always-top-anchored inset-block-start.
  expect(getComputedStyle(verticalHandle).direction).to.equal('ltr');
  expect(verticalHandle.getAttribute('aria-orientation')).to.equal('vertical');
  expect(horizontalHandle.getAttribute('aria-orientation')).to.equal('horizontal');
});

it('forwards host focus(), blur(), and click() to the range handle', async () => {
  const el = (await fixture(html`<lr-image-comparer></lr-image-comparer>`)) as LyraImageComparer;
  const handle = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  let clicks = 0;
  handle.addEventListener('click', () => clicks++);
  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('input');
  el.blur();
  expect(el.shadowRoot!.activeElement).to.equal(null);
  el.click();
  expect(clicks).to.equal(1);
});

it('tints the divider on hover and deepens it while the drag handle is pressed', async () => {
  // [part="input"] is a 1%-opacity full-bleed range input, so it has nothing of its own to tint:
  // both interaction states reach the divider through a :has() indirection. That is exactly the
  // shape that silently never matches if the selector drifts, and a stylesheet-text assertion
  // cannot tell a matching selector from a dead one -- so this reads the rendered colour.
  const el = (await fixture(html`
    <lr-image-comparer aria-label="Compare images">
      <div slot="before" style="inline-size: 200px; block-size: 120px">Before</div>
      <div slot="after" style="inline-size: 200px; block-size: 120px">After</div>
    </lr-image-comparer>
  `)) as LyraImageComparer;
  await el.updateComplete;
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  const handle = el.shadowRoot!.querySelector('[part="input"]') as HTMLElement;

  const resting = getComputedStyle(divider).backgroundColor;
  const rect = handle.getBoundingClientRect();
  expect(rect.width, 'the handle covers the comparer, so it is what the pointer lands on').to.be.greaterThan(0);
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    const hovered = getComputedStyle(divider).backgroundColor;
    expect(hovered, 'hovering the invisible handle tints the visible divider').to.not.equal(resting);

    await sendMouse({ type: 'down' });
    const pressed = getComputedStyle(divider).backgroundColor;
    expect(pressed, 'pressed is a further step, not a repeat of hover').to.not.equal(hovered);
    await sendMouse({ type: 'up' });
  } finally {
    await resetMouse();
  }
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

it('bridges native focus and blur from the range handle as bubbling composed host events', async () => {
  const el = (await fixture(html`<lr-image-comparer></lr-image-comparer>`)) as LyraImageComparer;
  const handle = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;

  const focusEvent = oneEvent(el, 'focus');
  handle.dispatchEvent(new FocusEvent('focus'));
  const focus = await focusEvent;
  expect(focus.bubbles).to.be.true;
  expect(focus.composed).to.be.true;

  const blurEvent = oneEvent(el, 'blur');
  handle.dispatchEvent(new FocusEvent('blur'));
  const blur = await blurEvent;
  expect(blur.bubbles).to.be.true;
  expect(blur.composed).to.be.true;
});
