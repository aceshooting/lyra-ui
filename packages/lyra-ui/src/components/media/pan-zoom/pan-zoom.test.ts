import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './pan-zoom.js';
import type { LyraPanZoom } from './pan-zoom.js';
import { resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';

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

it('keeps a bound-disabled zoom control visually inert on hover and press', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom zoom="0.5" min-zoom="0.5" max-zoom="2"></lr-pan-zoom>
  `);
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="zoom-out"]')!;
  expect(button.disabled).to.equal(true);
  const rest = getComputedStyle(button).backgroundColor;
  const rect = button.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    expect(getComputedStyle(button).backgroundColor).to.equal(rest);
    await sendMouse({ type: 'down' });
    // A press that must change nothing cannot be polled for; settle first so the read is real.
    await settlePointer();
    expect(getComputedStyle(button).backgroundColor).to.equal(rest);
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it('uses only pan-zoom geometry tokens after the v9 component split', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom
      style="--lr-zoomable-frame-min-block-size:333px;--lr-zoomable-frame-zoom:3"
    ></lr-pan-zoom>
  `);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
  expect(getComputedStyle(viewport).minBlockSize).to.not.equal('333px');
  expect(content.style.getPropertyValue('--lr-zoomable-frame-zoom')).to.equal('');
  expect(Number(getComputedStyle(content).zoom)).to.equal(1);

  el.style.setProperty('--lr-pan-zoom-min-block-size', '123px');
  el.zoom = 1.5;
  await el.updateComplete;
  expect(getComputedStyle(viewport).minBlockSize).to.equal('123px');
  expect(content.style.getPropertyValue('--lr-pan-zoom-zoom').trim()).to.equal('1.5');
  expect(Number(getComputedStyle(content).zoom)).to.equal(1.5);
});

it('renders an image only for an accepted source and falls back to slotted content for rejected URLs', async () => {
  const safe = await fixture<LyraPanZoom>(
    html`<lr-pan-zoom src="https://example.test/a.png" alt="A map"></lr-pan-zoom>`,
  );
  expect(safe.shadowRoot!.querySelector('img')!.getAttribute('src')).to.equal('https://example.test/a.png');

  const unsafe = await fixture<LyraPanZoom>(
    html`<lr-pan-zoom src="javascript:alert(1)" alt="A map"><span>Safe fallback</span></lr-pan-zoom>`,
  );
  expect(unsafe.shadowRoot!.querySelector('img') === null).to.be.true;
  expect(unsafe.shadowRoot!.querySelector('slot') !== null).to.be.true;
  expect(unsafe.textContent).to.contain('Safe fallback');
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

it('resets to exactly 100 percent when zoom-step does not divide one', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom zoom="1.3" zoom-step="0.3"></lr-pan-zoom>
  `);
  const reset = el.shadowRoot!.querySelector('[part="reset"]') as HTMLButtonElement;

  const changed = oneEvent(el, 'lr-zoom-change');
  reset.click();
  expect((await changed).detail).to.deep.equal({ zoom: 1 });
  expect(el.zoom).to.equal(1);

  el.zoom = 1.3;
  await el.updateComplete;
  el.resetZoom();
  expect(el.zoom).to.equal(1);

  el.zoom = 1.3;
  await el.updateComplete;
  el.resetView();
  expect(el.zoom).to.equal(1);
});

it('uses group semantics for independently tabbable zoom controls', async () => {
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom></lr-pan-zoom>`);
  const controls = el.shadowRoot!.querySelector('[part="controls"]') as HTMLElement;
  const buttons = [...controls.querySelectorAll<HTMLButtonElement>('button')];

  expect(controls.getAttribute('role')).to.equal('group');
  expect(controls.getAttribute('aria-label')).to.equal('Zoom controls');
  expect(buttons.map((button) => button.tabIndex)).to.deep.equal([0, 0, 0]);

  const arrow = new KeyboardEvent('keydown', {
    key: 'ArrowRight',
    bubbles: true,
    cancelable: true,
  });
  buttons[0]!.dispatchEvent(arrow);
  expect(arrow.defaultPrevented).to.equal(false);
  expect(el.zoom).to.equal(1);
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

it('keeps the host name on the host and gives the focusable viewport a purpose name', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom aria-label="Map preview" .strings=${{ pdfViewerCurrentZoom: '{percent} pourcent' }}></lr-pan-zoom>
  `);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  expect(viewport.getAttribute('role')).to.equal('group');
  expect(el.getAttribute('aria-label')).to.equal('Map preview');
  expect(viewport.getAttribute('aria-label')).to.equal('Zoomable content');
  const reset = el.shadowRoot!.querySelector('[part="reset"]') as HTMLButtonElement;
  expect(reset.textContent).to.contain('Reset zoom');
  expect(reset.textContent).to.contain('100 pourcent');
  expect(reset.hasAttribute('aria-label')).to.be.false;
});

it('recomputes the reset button percentage from live zoom, not a hardcoded 100', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom .strings=${{ pdfViewerCurrentZoom: '{percent} pourcent' }}></lr-pan-zoom>
  `);
  const reset = el.shadowRoot!.querySelector('[part="reset"]') as HTMLButtonElement;
  const visibleValue = (): string => reset.querySelector('span:not(.sr-only)')?.textContent?.trim() ?? '';
  expect(visibleValue()).to.equal('100 pourcent');

  el.zoomIn();
  await el.updateComplete;
  expect(el.zoom).to.equal(1.25);
  expect(visibleValue()).to.equal('125 pourcent');

  el.zoomOut();
  el.zoomOut();
  await el.updateComplete;
  expect(visibleValue()).to.equal('75 pourcent');

  reset.click();
  await el.updateComplete;
  expect(visibleValue()).to.equal('100 pourcent');
});

it('expands scroll geometry with the scaled paint footprint at narrow LTR and RTL allocations', async () => {
  for (const direction of ['ltr', 'rtl']) {
    for (const width of [319, 320]) {
      const wrapper = await fixture<HTMLElement>(html`
        <div dir=${direction} style=${`inline-size: ${width}px`}>
          <lr-pan-zoom zoom="2">
            <div style="inline-size: 400px; block-size: 80px">Wide content</div>
          </lr-pan-zoom>
        </div>
      `);
      const el = wrapper.querySelector('lr-pan-zoom') as LyraPanZoom;
      const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
      const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
      const paintedWidth = content.getBoundingClientRect().width;

      expect(paintedWidth, `${direction} ${width}px scaled paint`).to.be.greaterThan(790);
      expect(viewport.scrollWidth, `${direction} ${width}px reachable footprint`).to.be.at.least(
        Math.floor(paintedWidth) - 1,
      );
      wrapper.remove();
    }
  }
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
  });
  wrapper.addEventListener('lr-blur', () => {
    aliases.push('lr-blur');
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
  expect(sequence).to.deep.equal(['focus', 'blur']);
  expect(aliases, 'lr-focus/lr-blur compatibility aliases must not fire').to.deep.equal([]);
});

it('preserves host aria-label presence without duplicating it on the nested semantic owner', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom aria-label="" .strings=${{ zoomableFrameLabel: 'Localized zoom surface' }}></lr-pan-zoom>
  `);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
  const labels = (): Array<string | null> => [el.getAttribute('aria-label'), viewport.getAttribute('aria-label')];

  expect(base.hasAttribute('role')).to.equal(false);
  expect(base.hasAttribute('aria-label')).to.equal(false);
  expect(viewport.getAttribute('role')).to.equal('group');
  expect(labels()).to.deep.equal(['', 'Localized zoom surface']);

  el.setAttribute('aria-label', 'Updated zoom surface');
  await el.updateComplete;
  expect(labels()).to.deep.equal(['Updated zoom surface', 'Localized zoom surface']);

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(labels()).to.deep.equal(['', 'Localized zoom surface']);

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(labels()).to.deep.equal([null, 'Localized zoom surface']);
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
