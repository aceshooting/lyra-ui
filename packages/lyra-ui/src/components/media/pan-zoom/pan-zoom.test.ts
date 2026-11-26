import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-pan-zoom.js';
import type { LyraPanZoom } from '../../lr-pan-zoom.js';
import { hoverUntilMatched, resetMouse, sendMouse, sendWheel, settlePointer } from '../../../../test/wtr-mouse.js';
import { ignoreResizeObserverLoopErrors } from '../../../../test/resize-observer-noise.js';

ignoreResizeObserverLoopErrors(
  'changing the zoom under an open overlay rewrites its compensating zoom inside the positioner resize callback',
);

it('projects a host description onto the focusable viewport', async function () {
  if (!('ariaDescribedByElements' in HTMLElement.prototype)) this.skip();
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <p id="pan-zoom-help">Use the arrow keys to pan</p>
    <lr-pan-zoom aria-describedby="pan-zoom-help"></lr-pan-zoom>
  </div>`);
  const host = wrapper.querySelector<LyraPanZoom>('lr-pan-zoom')!;
  const help = wrapper.querySelector<HTMLElement>('#pan-zoom-help')!;
  const viewport = host.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
  const described = (): boolean =>
    viewport.ariaDescribedByElements?.includes(help) === true ||
    (viewport.getAttribute('aria-describedby')?.split(/\s+/).includes(help.id) ?? false);
  expect(described()).to.equal(true);
  host.removeAttribute('aria-describedby');
  await waitUntil(() => !described());
});

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
  try {
    await hoverUntilMatched(button, 'the disabled zoom-out button never reported :hover');
    // A hover that must change nothing cannot be polled for; settle first so the read is real.
    await settlePointer();
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
  expect(viewport.getBoundingClientRect().height).to.be.lessThan(333);
  expect(content.style.getPropertyValue('--lr-zoomable-frame-zoom')).to.equal('');
  expect(Number(getComputedStyle(content).zoom)).to.equal(1);

  el.style.setProperty('--lr-pan-zoom-min-block-size', '123px');
  el.zoom = 1.5;
  await el.updateComplete;
  expect(viewport.getBoundingClientRect().height).to.equal(123);
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

it('forwards the host name to the focusable viewport', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom aria-label="Map preview" .strings=${{ pdfViewerCurrentZoom: '{percent} pourcent' }}></lr-pan-zoom>
  `);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  expect(viewport.getAttribute('role')).to.equal('group');
  expect(viewport.getAttribute('aria-label')).to.equal('Map preview');
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

it('forwards host aria-label changes, with an empty one falling back to the localized name, to the viewport', async () => {
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
  expect(labels()).to.deep.equal(['Updated zoom surface', 'Updated zoom surface']);

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
    expect(zoomOut.getBoundingClientRect().width, `${direction} zoom-out hit area`).to.be.at.least(36);
    expect(zoomIn.getBoundingClientRect().width, `${direction} zoom-in hit area`).to.be.at.least(36);
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

describe('anchored overlays in zoomed content', () => {
  async function zoomedDropdown(strategy: 'fixed' | 'absolute', positionedWrapper = false) {
    await import('../../lr-dropdown.js');
    await import('../../lr-dropdown-item.js');
    const dropdown = html`<lr-dropdown data-lr-theme-scope positioning-strategy=${strategy} style="--lr-transition-fast:0ms">
      <button slot="trigger" style="margin: 10px">Actions</button>
      <lr-dropdown-item value="a">Alpha</lr-dropdown-item>
    </lr-dropdown>`;
    const el = await fixture<LyraPanZoom>(html`
      <lr-pan-zoom zoom="2" style="inline-size: 400px; block-size: 200px">
        <div style="inline-size: 180px; block-size: 90px; ${positionedWrapper ? 'position: relative' : ''}">${dropdown}</div>
      </lr-pan-zoom>
    `);
    const dd = el.querySelector('lr-dropdown') as HTMLElement & {
      show(): Promise<void>;
      hide(o?: { focusTrigger?: boolean }): Promise<void>;
    };
    const popup = dd.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
    const trigger = dd.querySelector('button')!;
    return { el, dd, popup, trigger };
  }

  async function expectAligned(popup: HTMLElement, trigger: HTMLElement): Promise<void> {
    await waitUntil(() => popup.style.left !== '' && popup.getBoundingClientRect().width > 0);
    await waitUntil(() => {
      const t = trigger.getBoundingClientRect();
      const p = popup.getBoundingClientRect();
      return Math.abs(p.left - t.left) < 1.5 && Math.abs(p.top - t.bottom) < 1.5;
    }, 'the popup opens at its trigger in zoomed content');
  }

  it('aligns a fixed dropdown to its trigger inside zoom="2" content without promoting it', async () => {
    const { dd, popup, trigger } = await zoomedDropdown('fixed');
    await dd.show();
    await expectAligned(popup, trigger);
    expect(popup.matches(':popover-open'), 'zoom alone is not a trap').to.equal(false);
    expect(Number.parseFloat(getComputedStyle(popup).zoom)).to.be.closeTo(0.5, 0.001);
    await dd.hide({ focusTrigger: false });
    await waitUntil(() => popup.hidden);
    await waitUntil(() => popup.style.getPropertyValue('zoom') === '', 'the settle releases the compensation');
  });

  it('aligns a default-absolute dropdown whose offset parent lies outside the zoomed content', async () => {
    const { dd, popup, trigger } = await zoomedDropdown('absolute');
    await dd.show();
    await expectAligned(popup, trigger);
    expect(Number.parseFloat(getComputedStyle(popup).zoom)).to.be.closeTo(0.5, 0.001);
    await dd.hide({ focusTrigger: false });
  });

  it('writes no zoom for an absolute dropdown whose offset parent is inside the zoomed content', async () => {
    const { dd, popup, trigger } = await zoomedDropdown('absolute', true);
    await dd.show();
    await expectAligned(popup, trigger);
    expect(popup.style.getPropertyValue('zoom')).to.equal('');
    await dd.hide({ focusTrigger: false });
  });

  it('keeps an open tooltip aligned when the zoom changes', async () => {
    await import('../../lr-tooltip.js');
    const el = await fixture<LyraPanZoom>(html`
      <lr-pan-zoom zoom="2" style="inline-size: 400px; block-size: 200px">
        <div style="inline-size: 180px; block-size: 90px">
          <lr-tooltip data-lr-theme-scope placement="bottom-start" distance="0" style="--lr-transition-fast:0ms"
            ><button slot="trigger" style="margin: 10px">Hint</button><span>Tip</span></lr-tooltip
          >
        </div>
      </lr-pan-zoom>
    `);
    const tooltip = el.querySelector('lr-tooltip') as HTMLElement & { show(): Promise<void>; hide(): Promise<void> };
    const popup = tooltip.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
    const trigger = tooltip.querySelector('button')!;
    await tooltip.show();
    await expectAligned(popup, trigger);
    el.zoom = 3;
    await el.updateComplete;
    await expectAligned(popup, trigger);
    await tooltip.hide();
  });
});


it('zooms out and resets from the focused viewport keyboard controls', async () => {
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom zoom="2" zoom-step="0.25"></lr-pan-zoom>`);
  const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
  const changes: number[] = [];
  el.addEventListener('lr-zoom-change', event => { changes.push(event.detail.zoom); });
  await focusByKeyboard(viewport);

  await sendKeys({ press: '-' });
  await el.updateComplete;
  expect(el.zoom).to.equal(1.75);
  expect(el.shadowRoot!.querySelector('[part="content"]')!.getAttribute('data-zoom')).to.equal('1.75');
  await sendKeys({ press: '0' });
  await el.updateComplete;
  expect(el.zoom).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="content"]')!.getAttribute('data-zoom')).to.equal('1');
  expect(changes).to.deep.equal([1.75, 1]);
  expect(el.shadowRoot!.activeElement === viewport).to.equal(true);
});

it('keeps keyboard focus in the controls when a zoom button disables itself at its limit', async () => {
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom zoom="1" max-zoom="1.25" zoom-step="0.25"></lr-pan-zoom>`);
  const zoomIn = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="zoom-in"]')!;
  await focusByKeyboard(zoomIn);
  await sendKeys({ press: 'Enter' });
  await el.updateComplete;
  expect(zoomIn.disabled).to.equal(true);
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('zoom-out');
});

it('keeps the focusable viewport named when the host aria-label is empty or blank', async () => {
  for (const value of ['', '   ']) {
    const el = (await fixture(html`<lr-pan-zoom aria-label=${value}></lr-pan-zoom>`)) as LyraPanZoom;
    expect(el.shadowRoot!.querySelector('[part="viewport"]')!.getAttribute('aria-label')).to.equal('Zoomable content');
  }
});

const portrait = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1363" height="2048"%3E%3Crect width="100%25" height="100%25" fill="blue"/%3E%3C/svg%3E';

it('fits a portrait image to both dimensions of a bounded viewport and refits on resize', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom fit="contain" style="inline-size: 500px; block-size: 300px"></lr-pan-zoom>
  `);
  const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
  const controls = el.shadowRoot!.querySelector<HTMLElement>('[part="controls"]')!;
  el.src = portrait;
  await el.updateComplete;
  const image = el.shadowRoot!.querySelector('img')!;
  await image.decode();

  for (const height of [300, 210]) {
    el.style.blockSize = `${height}px`;
    expect(controls.getBoundingClientRect().bottom).to.be.at.most(el.getBoundingClientRect().bottom);
    expect(image.getBoundingClientRect().height).to.be.closeTo(viewport.clientHeight, 1);
    expect(viewport.scrollHeight).to.equal(viewport.clientHeight);
    expect(viewport.scrollWidth).to.equal(viewport.clientWidth);
  }

  el.zoom = 2;
  await el.updateComplete;
  expect(viewport.scrollHeight).to.be.at.least(2 * viewport.clientHeight - 1);
  expect(viewport.scrollWidth).to.be.at.least(2 * viewport.clientWidth - 1);

  el.zoom = 0.5;
  await el.updateComplete;
  expect(viewport.scrollHeight).to.equal(viewport.clientHeight);
  expect(viewport.scrollWidth).to.equal(viewport.clientWidth);
  const viewportBounds = viewport.getBoundingClientRect();
  const imageBounds = image.getBoundingClientRect();
  expect(imageBounds.height).to.be.closeTo(viewport.clientHeight / 2, 1);
  expect(imageBounds.top + imageBounds.height / 2).to.be.closeTo(viewportBounds.top + viewportBounds.height / 2, 1);
});

it('keeps actual-size content reachable with wheel and keyboard in an absolutely allocated frame', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="position: relative; inline-size: 500px; block-size: 300px; overflow: hidden">
      <lr-pan-zoom fit="actual" src=${portrait}
        style="position: absolute; inset: 0; block-size: 100%; --lr-pan-zoom-min-block-size: 100%"
      ></lr-pan-zoom>
    </div>`);
  const el = wrapper.querySelector<LyraPanZoom>('lr-pan-zoom')!;
  const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
  const controls = el.shadowRoot!.querySelector<HTMLElement>('[part="controls"]')!;
  const image = el.shadowRoot!.querySelector('img')!;
  await image.decode();

  expect(controls.getBoundingClientRect().bottom).to.be.at.most(wrapper.getBoundingClientRect().bottom);
  expect(image.getBoundingClientRect().height).to.equal(image.naturalHeight);
  expect(viewport.scrollHeight).to.be.at.least(image.naturalHeight);
  try {
    await hoverUntilMatched(viewport, 'the actual-size viewport receives the wheel');
    await sendWheel({ deltaX: 0, deltaY: 100 });
    await waitUntil(() => viewport.scrollTop > 0);
    await focusByKeyboard(viewport);
    await sendKeys({ press: 'End' });
    await waitUntil(() => viewport.scrollTop === viewport.scrollHeight - viewport.clientHeight);
    expect(image.getBoundingClientRect().bottom).to.be.closeTo(viewport.getBoundingClientRect().bottom, 2);
  } finally {
    await resetMouse();
  }
});

it('fits width while keeping the tall image scrollable at the selected zoom', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom fit="width" src=${portrait}
      style="inline-size: 360px; block-size: 240px"
    ></lr-pan-zoom>
  `);
  const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
  const image = el.shadowRoot!.querySelector('img')!;
  await image.decode();
  expect(image.getBoundingClientRect().width).to.be.closeTo(viewport.clientWidth, 1);
  expect(viewport.scrollHeight).to.be.greaterThan(viewport.clientHeight);
  expect(viewport.scrollWidth).to.equal(viewport.clientWidth);
  el.zoom = 1.5;
  await el.updateComplete;
  expect(image.getBoundingClientRect().width).to.be.closeTo(viewport.clientWidth * 1.5, 1);
});

for (const direction of ['ltr', 'rtl']) {
  it(`pans an overflowing src image with a mouse drag in ${direction}`, async () => {
    const el = await fixture<LyraPanZoom>(html`
      <lr-pan-zoom dir=${direction} fit="contain" zoom="2" src=${portrait}
        style="inline-size: 350px; block-size: 250px"></lr-pan-zoom>
    `);
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
    const image = el.shadowRoot!.querySelector('img')!;
    await image.decode();
    try {
      await hoverUntilMatched(viewport, 'the viewport receives the drag');
      const { left, top, width, height } = viewport.getBoundingClientRect();
      const x = Math.round(left + width / 2);
      const y = Math.round(top + height / 2);
      await sendMouse({ type: 'move', position: [x, y] });
      await sendMouse({ type: 'down' });
      await waitUntil(() => getComputedStyle(image).cursor === 'grabbing');
      await sendMouse({ type: 'move', position: [x + (direction === 'rtl' ? 55 : -55), y - 70] });
      await waitUntil(() => Math.abs(viewport.scrollLeft) >= 54 && viewport.scrollTop >= 69);
      await sendMouse({ type: 'up' });
      await waitUntil(() => getComputedStyle(image).cursor !== 'grabbing');
      const { scrollLeft, scrollTop } = viewport;
      await sendMouse({ type: 'move', position: [x, y] });
      await settlePointer();
      expect(viewport.scrollLeft).to.equal(scrollLeft);
      expect(viewport.scrollTop).to.equal(scrollTop);
    } finally {
      await resetMouse();
    }
  });
}

function nextPointerDown(image: HTMLImageElement): Promise<PointerEvent> {
  return new Promise(resolve => image.addEventListener('pointerdown', resolve, { once: true }));
}

for (const termination of ['pointercancel', 'disconnect', 'source replacement'] as const) {
  it(`clears the captured mouse pan on ${termination}`, async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><lr-pan-zoom src=${portrait}
      style="inline-size: 350px; block-size: 250px"></lr-pan-zoom></div>`);
    const el = wrapper.querySelector<LyraPanZoom>('lr-pan-zoom')!;
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
    const image = el.shadowRoot!.querySelector('img')!;
    await image.decode();
    try {
      await hoverUntilMatched(viewport, 'the viewport receives the drag');
      const pointerDown = nextPointerDown(image);
      await sendMouse({ type: 'down' });
      const { pointerId } = await pointerDown;
      await waitUntil(() => image.hasPointerCapture(pointerId) && image.hasAttribute('data-panning'));

      if (termination === 'pointercancel') {
        image.dispatchEvent(new PointerEvent('pointercancel', { pointerId }));
      } else if (termination === 'disconnect') {
        el.remove();
        wrapper.append(el);
      } else {
        el.src = `${portrait}#replacement`;
        await el.updateComplete;
        await el.shadowRoot!.querySelector('img')!.decode();
      }

      await waitUntil(() => !image.hasPointerCapture(pointerId) && !image.hasAttribute('data-panning'));
      const { left, top, width, height } = viewport.getBoundingClientRect();
      await sendMouse({ type: 'move', position: [Math.round(left + width / 2), Math.round(top + height / 4)] });
      await settlePointer();
      expect(viewport.scrollTop).to.equal(0);
    } finally {
      await resetMouse();
    }
  });
}

it('leaves clicks on a fitted image and secondary presses on an overflowing image uncaptured', async () => {
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom fit="contain" src=${portrait}
    style="inline-size: 350px; block-size: 250px"></lr-pan-zoom>`);
  const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
  const image = el.shadowRoot!.querySelector('img')!;
  await image.decode();
  try {
    await hoverUntilMatched(viewport, 'the viewport receives the mouse press');
    for (const button of ['left', 'right'] as const) {
      el.zoom = button === 'left' ? 1 : 2;
      await el.updateComplete;
      const pointerDown = nextPointerDown(image);
      await sendMouse({ type: 'down', button });
      const { pointerId } = await pointerDown;
      expect(image.hasPointerCapture(pointerId)).to.equal(false);
      expect(image.hasAttribute('data-panning')).to.equal(false);
      await sendMouse({ type: 'up', button });
    }
  } finally {
    await resetMouse();
  }
});
