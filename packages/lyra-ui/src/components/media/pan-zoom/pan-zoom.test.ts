import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './pan-zoom.js';
import type { LyraPanZoom } from './pan-zoom.js';

it('preserves the former zoomable-frame slotted pan/zoom contract under lr-pan-zoom', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom zoom="2" aria-label="Map preview">
      <div style="inline-size: 20rem; block-size: 10rem;">Map</div>
    </lr-pan-zoom>
  `);

  expect(el.shadowRoot!.querySelector('[part="content"]')!.getAttribute('data-zoom')).to.equal('2');
  expect(el.shadowRoot!.querySelectorAll('[part="zoom-out"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelectorAll('[part="zoom-in"]').length).to.equal(1);
});

it('preserves image source safety and an absent src attribute for rejected URLs', async () => {
  const safe = await fixture<LyraPanZoom>(
    html`<lr-pan-zoom src="https://example.test/a.png" alt="A map"></lr-pan-zoom>`,
  );
  expect(safe.shadowRoot!.querySelector('img')!.getAttribute('src')).to.equal('https://example.test/a.png');

  const unsafe = await fixture<LyraPanZoom>(
    html`<lr-pan-zoom src="javascript:alert(1)" alt="A map"></lr-pan-zoom>`,
  );
  const image = unsafe.shadowRoot!.querySelector('img') as HTMLImageElement;
  expect(image.hasAttribute('src')).to.be.false;
  expect(image.src).to.equal('');
});

it('keeps zoom methods, reset semantics, and lr-zoom-change', async () => {
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom></lr-pan-zoom>`);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  const scrollCalls: ScrollToOptions[] = [];
  viewport.scrollTo = ((options: ScrollToOptions) => scrollCalls.push(options)) as typeof viewport.scrollTo;

  const changed = oneEvent(el, 'lr-zoom-change');
  el.zoomIn();
  expect((await changed).detail).to.deep.equal({ zoom: 1.25 });
  el.resetZoom();
  await el.updateComplete;
  expect(el.zoom).to.equal(1);
  expect(scrollCalls).to.deep.equal([]);

  el.resetView();
  expect(scrollCalls).to.deep.equal([{ left: 0, top: 0 }]);
});

it('keeps keyboard zoom while leaving slotted editors alone', async () => {
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom><input value="10" /></lr-pan-zoom>`);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  viewport.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.zoom).to.equal(1.25);

  const input = el.querySelector('input')!;
  const key = new KeyboardEvent('keydown', { key: '+', bubbles: true, composed: true, cancelable: true });
  input.dispatchEvent(key);
  await el.updateComplete;
  expect(el.zoom).to.equal(1.25);
  expect(key.defaultPrevented).to.be.false;
});

it('leaves iframe-realm slotted editors alone after adoption', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom></lr-pan-zoom>`);

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;

    const editor = frameDocument.createElement('input');
    el.append(editor);
    const key = new frameWindow.KeyboardEvent('keydown', {
      key: '+',
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    editor.dispatchEvent(key);
    await el.updateComplete;

    expect(el.zoom, 'an editor created by the adopted realm must retain the keystroke').to.equal(1);
    expect(key.defaultPrevented).to.be.false;
  } finally {
    el.remove();
    frame.remove();
  }
});

it('normalizes malformed zoom configuration to finite usable values', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom zoom="NaN" min-zoom="NaN" max-zoom="Infinity" zoom-step="-1"></lr-pan-zoom>
  `);
  const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
  expect(Number.isFinite(Number(content.dataset['zoom']))).to.be.true;
  const before = Number(content.dataset['zoom']);
  el.zoomIn();
  await el.updateComplete;
  expect(Number.isFinite(el.zoom)).to.be.true;
  expect(el.zoom).to.be.greaterThan(before);
});

it('forwards aria-label to the focusable viewport and localizes visible zoom output', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom aria-label="Map preview" .strings=${{ pdfViewerCurrentZoom: '{percent} pourcent' }}></lr-pan-zoom>
  `);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  expect(viewport.getAttribute('role')).to.equal('group');
  expect(viewport.getAttribute('aria-label')).to.equal('Map preview');
  expect(el.shadowRoot!.querySelector('[part="reset"]')!.textContent?.trim()).to.equal('100 pourcent');
});

it('recomputes the reset button percentage from live zoom, not a hardcoded 100', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom .strings=${{ pdfViewerCurrentZoom: '{percent} pourcent' }}></lr-pan-zoom>
  `);
  const reset = el.shadowRoot!.querySelector('[part="reset"]') as HTMLButtonElement;
  expect(reset.textContent?.trim()).to.equal('100 pourcent');

  el.zoomIn();
  await el.updateComplete;
  expect(el.zoom).to.equal(1.25);
  expect(reset.textContent?.trim()).to.equal('125 pourcent');

  el.zoomOut();
  el.zoomOut();
  await el.updateComplete;
  expect(reset.textContent?.trim()).to.equal('75 pourcent');

  reset.click();
  await el.updateComplete;
  expect(reset.textContent?.trim()).to.equal('100 pourcent');
});

it('forwards host focus()/blur()/click() to the keyboard-zoomable viewport', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><lr-pan-zoom></lr-pan-zoom></div>`);
  const el = wrapper.querySelector('lr-pan-zoom') as LyraPanZoom;
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  const nativeEvents: FocusEvent[] = [];
  const aliases: string[] = [];
  const sequence: string[] = [];
  wrapper.addEventListener('focus', (event) => {
    nativeEvents.push(event as FocusEvent);
    sequence.push('focus');
  });
  wrapper.addEventListener('blur', (event) => {
    nativeEvents.push(event as FocusEvent);
    sequence.push('blur');
  });
  wrapper.addEventListener('lr-focus', () => {
    aliases.push('lr-focus');
    sequence.push('lr-focus');
  });
  wrapper.addEventListener('lr-blur', () => {
    aliases.push('lr-blur');
    sequence.push('lr-blur');
  });

  el.focus();
  expect(el.shadowRoot!.activeElement === viewport).to.equal(true);

  let clicks = 0;
  viewport.addEventListener('click', () => {
    clicks += 1;
  });
  el.click();
  expect(clicks).to.equal(1);

  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
  expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
  expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
  expect(aliases).to.deep.equal(['lr-focus', 'lr-blur']);
  expect(sequence).to.deep.equal(['focus', 'lr-focus', 'blur', 'lr-blur']);
});

it('preserves present host aria-labels on the region and viewport, then restores the fallback on removal', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom aria-label="" .strings=${{ zoomableFrameLabel: 'Localized zoom surface' }}></lr-pan-zoom>
  `);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
  const labels = (): Array<string | null> => [base.getAttribute('aria-label'), viewport.getAttribute('aria-label')];

  expect(base.getAttribute('role')).to.equal('region');
  expect(viewport.getAttribute('role')).to.equal('group');
  expect(labels()).to.deep.equal(['', '']);

  el.setAttribute('aria-label', 'Updated zoom surface');
  await el.updateComplete;
  expect(labels()).to.deep.equal(['Updated zoom surface', 'Updated zoom surface']);

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(labels()).to.deep.equal(['', '']);

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(labels()).to.deep.equal(['Localized zoom surface', 'Localized zoom surface']);
});

it('contains unbroken localized reset labels inside 320px LTR and RTL allocations', async () => {
  const longCurrentZoom = `${'Zoom'.repeat(120)} {percent}`;
  for (const direction of ['ltr', 'rtl']) {
    const wrapper = await fixture<HTMLElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%">
        <lr-pan-zoom .strings=${{ pdfViewerCurrentZoom: longCurrentZoom }}></lr-pan-zoom>
      </div>
    `);
    const el = wrapper.querySelector('lr-pan-zoom') as LyraPanZoom;
    await el.updateComplete;
    const controls = el.shadowRoot!.querySelector('[part="controls"]') as HTMLElement;
    const reset = el.shadowRoot!.querySelector('[part="reset"]') as HTMLButtonElement;
    const zoomOut = el.shadowRoot!.querySelector('[part="zoom-out"]') as HTMLButtonElement;
    const zoomIn = el.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement;
    const allocation = wrapper.getBoundingClientRect();
    const resetBounds = reset.getBoundingClientRect();
    const resetStyle = getComputedStyle(reset);

    expect(wrapper.scrollWidth, `${direction} wrapper scroll width`).to.be.at.most(wrapper.clientWidth);
    expect(controls.scrollWidth, `${direction} controls scroll width`).to.be.at.most(controls.clientWidth);
    expect(resetBounds.left, `${direction} reset start`).to.be.at.least(allocation.left);
    expect(resetBounds.right, `${direction} reset end`).to.be.at.most(allocation.right);
    expect(zoomOut.getBoundingClientRect().width, `${direction} zoom-out hit area`).to.be.at.least(40);
    expect(zoomIn.getBoundingClientRect().width, `${direction} zoom-in hit area`).to.be.at.least(40);
    expect(resetStyle.textOverflow, `${direction} reset label truncation`).to.equal('ellipsis');
    expect(reset.textContent).to.contain('100');
    wrapper.remove();
  }
});

it('keeps the pan/zoom surface accessible in populated state', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom aria-label="Diagram preview"><div>Diagram</div></lr-pan-zoom>
  `);
  await expect(el).to.be.accessible();
});
