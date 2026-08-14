import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
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

it('relays the range platform\'s native Event after synchronously committing the live position', async () => {
  const el = (await fixture(html`<lr-image-comparer></lr-image-comparer>`)) as LyraImageComparer;
  await el.updateComplete;
  const handle = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  const events: Event[] = [];
  const positionsAtDispatch: number[] = [];
  const aliases: CustomEvent<{ position: number }>[] = [];
  const sequence: string[] = [];
  el.addEventListener('input', (event) => {
    events.push(event);
    positionsAtDispatch.push(el.position);
    sequence.push('input');
  });
  el.addEventListener('lr-position-change', (event) => {
    aliases.push(event);
    sequence.push('lr-position-change');
  });

  handle.focus();
  await sendKeys({ press: 'ArrowRight' });

  expect(events).to.have.length(1);
  expect(events[0]!.constructor === el.ownerDocument.defaultView!.Event).to.be.true;
  expect(events[0] instanceof InputEvent).to.be.false;
  expect(events[0]!.target === el).to.be.true;
  expect(events[0]!.bubbles).to.be.true;
  expect(events[0]!.composed).to.be.true;
  expect(positionsAtDispatch).to.deep.equal([51]);
  expect(aliases).to.have.length(1);
  expect(aliases[0]!.detail).to.deep.equal({ position: 51 });
  expect(sequence).to.deep.equal(['input', 'lr-position-change']);
  expect(el.position).to.equal(51);
});

it('relays one native change after synchronously committing position plus one prefixed alias', async () => {
  const el = (await fixture(html`<lr-image-comparer></lr-image-comparer>`)) as LyraImageComparer;
  const input = el.shadowRoot!.querySelector('input[type="range"]') as HTMLInputElement;
  const events: Event[] = [];
  const positionsAtDispatch: number[] = [];
  const aliases: CustomEvent<undefined>[] = [];
  const sequence: string[] = [];
  el.addEventListener('change', (event) => {
    events.push(event);
    positionsAtDispatch.push(el.position);
    sequence.push('change');
  });
  el.addEventListener('lr-change', (event) => {
    aliases.push(event);
    sequence.push('lr-change');
  });

  input.value = '64';
  input.dispatchEvent(new Event('change', { bubbles: true, composed: false }));

  expect(events).to.have.length(1);
  expect(events[0]!.constructor === Event).to.be.true;
  expect(events[0]!.target === el).to.be.true;
  expect(events[0]!.bubbles).to.be.true;
  expect(events[0]!.composed).to.be.true;
  expect(positionsAtDispatch).to.deep.equal([64]);
  expect(aliases).to.have.length(1);
  expect(aliases[0] instanceof CustomEvent).to.be.true;
  expect(sequence).to.deep.equal(['change', 'lr-change']);
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

it('exposes namespaced sizing properties that the bare upstream names still feed', async () => {
  const namespaced = (await fixture(html`<lr-image-comparer
    style="--lr-image-comparer-divider-width: 9px; --lr-image-comparer-handle-size: 37px"
  ></lr-image-comparer>`)) as LyraImageComparer;
  const namespacedDivider = namespaced.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  const namespacedHandle = namespaced.shadowRoot!.querySelector('.handle-visual') as HTMLElement;
  expect(getComputedStyle(namespacedDivider).inlineSize).to.equal('9px');
  expect(getComputedStyle(namespacedHandle).inlineSize).to.equal('37px');
  expect(getComputedStyle(namespacedHandle).blockSize).to.equal('37px');

  // The namespaced name wins when both are set, so a themed app is never overridden by a stray
  // generic --handle-size inherited from somewhere up the tree.
  const both = (await fixture(html`<lr-image-comparer
    style="--divider-width: 3px; --handle-size: 21px; --lr-image-comparer-divider-width: 9px; --lr-image-comparer-handle-size: 37px"
  ></lr-image-comparer>`)) as LyraImageComparer;
  expect(getComputedStyle(both.shadowRoot!.querySelector('[part="divider"]') as HTMLElement).inlineSize)
    .to.equal('9px');
  expect(getComputedStyle(both.shadowRoot!.querySelector('.handle-visual') as HTMLElement).inlineSize)
    .to.equal('37px');
});

it('keeps the full-bleed range hit surface at the icon floor and fills an explicit host allocation', async () => {
  const empty = (await fixture(html`
    <lr-image-comparer style="inline-size: 320px" aria-label="Empty comparison"></lr-image-comparer>
  `)) as LyraImageComparer;
  const oneLine = (await fixture(html`
    <lr-image-comparer style="inline-size: 320px" aria-label="Short comparison">
      <div slot="before">Before</div>
      <div slot="after">After</div>
    </lr-image-comparer>
  `)) as LyraImageComparer;
  const fixedHeight = (await fixture(html`
    <lr-image-comparer style="inline-size: 320px; block-size: 200px" aria-label="Fixed comparison">
      <div slot="before">Before</div>
      <div slot="after">After</div>
    </lr-image-comparer>
  `)) as LyraImageComparer;
  await Promise.all([empty.updateComplete, oneLine.updateComplete, fixedHeight.updateComplete]);

  const inputFor = (el: LyraImageComparer) => el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  expect(inputFor(empty).getBoundingClientRect().height, 'an empty comparer keeps a usable drag surface').to.be.at.least(40);
  expect(inputFor(oneLine).getBoundingClientRect().height, 'one-line content cannot shrink the drag surface').to.be.at.least(40);

  const base = fixedHeight.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const input = inputFor(fixedHeight);
  const hostRect = fixedHeight.getBoundingClientRect();
  const baseRect = base.getBoundingClientRect();
  const inputRect = input.getBoundingClientRect();
  expect(hostRect.height).to.equal(200);
  expect(baseRect.height, 'the comparison viewport fills an explicit host block size').to.equal(hostRect.height);
  expect(inputRect.height, 'the native range fills the comparison viewport').to.equal(baseRect.height);

  const clientX = Math.round(inputRect.left + inputRect.width / 2);
  const clientY = Math.round(inputRect.bottom - 4);
  const hit = fixedHeight.shadowRoot!.elementFromPoint(clientX, clientY) as HTMLElement | null;
  expect(hit?.getAttribute('part'), 'the lower explicit allocation remains a real drag target').to.equal('input');
  try {
    await sendMouse({ type: 'move', position: [clientX, clientY] });
    await sendMouse({ type: 'down' });
    expect(fixedHeight.matches(':state(dragging)')).to.be.true;
  } finally {
    await resetMouse();
  }
  expect(fixedHeight.matches(':state(dragging)')).to.be.false;
});

it('contains long unbroken 320px comparisons in LTR and Arabic RTL and mirrors the handle', async () => {
  const longLtr = `BeforeSurfaceWithoutAnyNaturalBreakOpportunity${'BeforeAfter'.repeat(14)}`;
  const longArabic = `سطحقبلمقارنةدونفاصلطبيعي${'قبوبعد'.repeat(36)}`;
  const root = await fixture<HTMLDivElement>(html`
    <div style="display: grid; gap: var(--lr-space-m)">
      <div data-case="ltr" style="inline-size: 320px; max-inline-size: 320px">
        <lr-image-comparer
          position="35"
          aria-label="Before and after comparison"
          style="block-size: var(--lr-size-10rem)"
        >
          <div slot="before" style="padding: var(--lr-space-m)">${longLtr}</div>
          <div slot="after" style="padding: var(--lr-space-m)">${longLtr}</div>
          <span slot="handle" aria-hidden="true">⇆</span>
        </lr-image-comparer>
      </div>
      <div data-case="rtl" dir="rtl" lang="ar" style="inline-size: 320px; max-inline-size: 320px">
        <lr-image-comparer
          position="35"
          aria-label="مقارنة قبل وبعد"
          style="block-size: var(--lr-size-10rem)"
        >
          <div slot="before" style="padding: var(--lr-space-m)">${longArabic}</div>
          <div slot="after" style="padding: var(--lr-space-m)">${longArabic}</div>
          <span slot="handle" aria-hidden="true">⇆</span>
        </lr-image-comparer>
      </div>
    </div>
  `);

  const comparerFor = (direction: 'ltr' | 'rtl') => {
    const wrapper = root.querySelector<HTMLElement>(`[data-case="${direction}"]`)!;
    const el = wrapper.querySelector<LyraImageComparer>('lr-image-comparer')!;
    return {
      direction,
      wrapper,
      el,
      base: el.shadowRoot!.querySelector<HTMLElement>("[part~='base'][part~='comparison']")!,
      before: el.shadowRoot!.querySelector<HTMLElement>("[part='before']")!,
      after: el.shadowRoot!.querySelector<HTMLElement>("[part='after']")!,
      divider: el.shadowRoot!.querySelector<HTMLElement>("[part='divider']")!,
      input: el.shadowRoot!.querySelector<HTMLInputElement>("[part='input']")!,
      handle: el.shadowRoot!.querySelector<HTMLElement>('.handle-visual')!,
      beforeContent: el.querySelector<HTMLElement>('[slot="before"]')!,
      afterContent: el.querySelector<HTMLElement>('[slot="after"]')!,
    };
  };

  const ltr = comparerFor('ltr');
  const rtl = comparerFor('rtl');
  await Promise.all([ltr.el.updateComplete, rtl.el.updateComplete]);

  const expectContained = (inner: DOMRect, outer: DOMRect, label: string) => {
    expect(inner.left, `${label} left edge`).to.be.at.least(outer.left - 2);
    expect(inner.right, `${label} right edge`).to.be.at.most(outer.right + 2);
    expect(inner.top, `${label} top edge`).to.be.at.least(outer.top - 2);
    expect(inner.bottom, `${label} bottom edge`).to.be.at.most(outer.bottom + 2);
  };

  for (
    const { direction, wrapper, el, base, before, after, input, beforeContent, afterContent } of [ltr, rtl]
  ) {
    const wrapperRect = wrapper.getBoundingClientRect();
    const hostRect = el.getBoundingClientRect();
    const baseRect = base.getBoundingClientRect();
    const beforeRect = before.getBoundingClientRect();
    const afterRect = after.getBoundingClientRect();
    const beforeContentRect = beforeContent.getBoundingClientRect();
    const afterContentRect = afterContent.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();

    expect(wrapper.scrollWidth, `${direction} wrapper has no horizontal overflow`).to.be.at.most(
      wrapper.clientWidth + 1,
    );
    for (const [name, element] of [
      ['base', base],
      ['before layer', before],
      ['after layer', after],
      ['before content', beforeContent],
      ['after content', afterContent],
    ] as const) {
      expect(element.scrollWidth, `${direction} ${name} has no horizontal overflow`).to.be.at.most(
        element.clientWidth + 1,
      );
    }
    expectContained(hostRect, wrapperRect, `${direction} host`);
    expectContained(baseRect, hostRect, `${direction} base/comparison`);
    expectContained(beforeRect, baseRect, `${direction} before layer`);
    expectContained(afterRect, baseRect, `${direction} after layer`);
    expectContained(beforeContentRect, beforeRect, `${direction} before content`);
    expectContained(afterContentRect, afterRect, `${direction} after content`);
    expectContained(inputRect, baseRect, `${direction} native range`);
    expect(inputRect.width, `${direction} native range keeps a 40px inline interaction floor`).to.be.at.least(
      40,
    );
    expect(inputRect.height, `${direction} native range keeps a 40px block interaction floor`).to.be.at.least(
      40,
    );
  }

  const ltrBase = ltr.base.getBoundingClientRect();
  const rtlBase = rtl.base.getBoundingClientRect();
  const ltrDivider = ltr.divider.getBoundingClientRect();
  const rtlDivider = rtl.divider.getBoundingClientRect();
  const ltrHandle = ltr.handle.getBoundingClientRect();
  const rtlHandle = rtl.handle.getBoundingClientRect();
  const ltrCenter = ltrHandle.left + ltrHandle.width / 2;
  const rtlCenter = rtlHandle.left + rtlHandle.width / 2;
  const ltrDividerCenter = ltrDivider.left + ltrDivider.width / 2;
  const rtlDividerCenter = rtlDivider.left + rtlDivider.width / 2;
  expect(ltrDividerCenter, 'LTR divider and handle share a center').to.be.closeTo(ltrCenter, 1);
  expect(rtlDividerCenter, 'RTL divider and handle share a center').to.be.closeTo(rtlCenter, 1);
  expect(ltrCenter - ltrBase.left, 'LTR position 35 starts 35% from the physical left').to.be.closeTo(
    ltrBase.width * 0.35,
    1,
  );
  expect(rtlBase.right - rtlCenter, 'RTL position 35 mirrors to 35% from the physical right').to.be.closeTo(
    rtlBase.width * 0.35,
    1,
  );
});

it('keeps interactive descendants of the decorative handle slot out of focus and the accessibility tree', async () => {
  const el = (await fixture(html`<lr-image-comparer aria-label="Compare images">
    <div slot="before">Before</div>
    <div slot="after">After</div>
    <button slot="handle" type="button">Decorative button</button>
  </lr-image-comparer>`)) as LyraImageComparer;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  const decorativeButton = el.querySelector('[slot="handle"]') as HTMLButtonElement;

  input.focus();
  decorativeButton.focus();

  expect(document.activeElement?.localName).to.equal('lr-image-comparer');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('input');
  await expect(el).to.be.accessible();
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

it('preserves present host aria-labels on the comparison group and range, then restores the fallback on removal', async () => {
  const el = (await fixture(html`
    <lr-image-comparer aria-label="" .strings=${{ imageComparerLabel: 'Localized comparison' }}>
      <div slot="before">Before</div>
      <div slot="after">After</div>
    </lr-image-comparer>
  `)) as LyraImageComparer;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;
  const labels = (): Array<string | null> => [base.getAttribute('aria-label'), input.getAttribute('aria-label')];

  expect(base.getAttribute('role')).to.equal('group');
  expect(input.type).to.equal('range');
  expect(labels()).to.deep.equal(['', '']);

  el.setAttribute('aria-label', 'Updated comparison');
  await el.updateComplete;
  expect(labels()).to.deep.equal(['Updated comparison', 'Updated comparison']);

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(labels()).to.deep.equal(['', '']);

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(labels()).to.deep.equal(['Localized comparison', 'Localized comparison']);
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
  expect((el.shadowRoot!.activeElement) === (null)).to.equal(true);
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

it('relays one native focus/blur pair with payload plus one prefixed alias pair', async () => {
  const el = (await fixture(html`<lr-image-comparer></lr-image-comparer>`)) as LyraImageComparer;
  const handle = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  const related = document.createElement('button');
  const nativeEvents: FocusEvent[] = [];
  const aliases: string[] = [];
  const sequence: string[] = [];
  el.addEventListener('focus', (event) => {
    nativeEvents.push(event as FocusEvent);
    sequence.push('focus');
  });
  el.addEventListener('blur', (event) => {
    nativeEvents.push(event as FocusEvent);
    sequence.push('blur');
  });
  el.addEventListener('lr-focus', () => {
    aliases.push('lr-focus');
    sequence.push('lr-focus');
  });
  el.addEventListener('lr-blur', () => {
    aliases.push('lr-blur');
    sequence.push('lr-blur');
  });

  handle.dispatchEvent(new FocusEvent('focus', {
    bubbles: true,
    composed: true,
    relatedTarget: related,
    view: window,
  }));
  handle.dispatchEvent(new FocusEvent('blur', {
    bubbles: true,
    composed: true,
    relatedTarget: related,
    view: window,
  }));

  expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
  expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
  expect(nativeEvents.every((event) => event.relatedTarget === related)).to.be.true;
  expect(aliases).to.deep.equal(['lr-focus', 'lr-blur']);
  expect(sequence).to.deep.equal(['focus', 'lr-focus', 'blur', 'lr-blur']);
});
