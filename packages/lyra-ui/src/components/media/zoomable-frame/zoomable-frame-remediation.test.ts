import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './zoomable-frame.js';
import type { LyraZoomableFrame } from './zoomable-frame.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

it('titles the iframe from the property or the host aria-label', async () => {
  const el = await fixture<LyraZoomableFrame>(html`<lr-zoomable-frame .strings=${{ zoomableFrameLabel: 'Frame' }}></lr-zoomable-frame>`);
  const frame = el.shadowRoot!.querySelector('iframe')!;
  el.accessibleLabel = 'Preview';
  await el.updateComplete;
  expect(frame.title).to.equal('Preview');
  expect(el.hasAttribute('aria-label')).to.equal(false);
  el.accessibleLabel = 'Updated preview';
  await el.updateComplete;
  expect(frame.title).to.equal('Updated preview');
  el.accessibleLabel = '';
  await el.updateComplete;
  expect(frame.title).to.equal('Frame');
  el.setAttribute('aria-label', 'Host purpose');
  await el.updateComplete;
  expect(frame.title).to.equal('Host purpose');
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(frame.title).to.equal('');
  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(frame.title).to.equal('Frame');
});

it('distinguishes zoom control focus from iframe entry, exit, public blur and reconnect', async () => {
  const el = await fixture<LyraZoomableFrame>(html`<lr-zoomable-frame srcdoc="<button>Inside</button>"></lr-zoomable-frame>`);
  const control = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="zoom-in-button"]')!;
  const frame = el.shadowRoot!.querySelector('iframe')!;
  await waitUntil(() => Boolean(el.contentDocument?.querySelector('button')));
  const relays: string[] = [];
  // The native control focus events are composed but do not bubble; only the iframe relay does.
  el.addEventListener('focus', (event) => { if (event.bubbles) relays.push('focus'); });
  el.addEventListener('blur', (event) => { if (event.bubbles) relays.push('blur'); });
  control.focus();
  // wait-reason: asserting that focusing the zoom control does NOT enter the iframe
  await aTimeout(25);
  expect(el.shadowRoot!.activeElement === control).to.equal(true);
  expect(el.hasAttribute('data-frame-focused')).to.equal(false);
  expect(relays).to.deep.equal([]);
  el.blur();
  expect(el.shadowRoot!.activeElement === control).to.equal(true);
  el.focus();
  await waitUntil(() => el.hasAttribute('data-frame-focused'));
  expect(el.shadowRoot!.activeElement === frame).to.equal(true);
  expect(relays).to.deep.equal(['focus']);
  // Native Tab traversal needs the nested document to own focus, even when its button is
  // already activeElement. A native click establishes that browsing-context focus first.
  const frameDocument = el.contentDocument!;
  const innerButton = frameDocument.querySelector('button')!;
  try {
    await resetMouse();
    const frameBounds = frame.getBoundingClientRect();
    const buttonBounds = innerButton.getBoundingClientRect();
    await sendMouse({
      type: 'click',
      position: [
        Math.round(frameBounds.left + buttonBounds.left + buttonBounds.width / 2),
        Math.round(frameBounds.top + buttonBounds.top + buttonBounds.height / 2),
      ],
    });
    await waitUntil(
      () => frameDocument.hasFocus() && frameDocument.activeElement === innerButton,
      'The iframe button must own native focus before Tab',
    );
    await sendKeys({ press: 'Tab' });
  } finally {
    await resetMouse();
  }
  await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('part') === 'zoom-out-button', 'Tab should leave the iframe for its first zoom control');
  await waitUntil(() => !el.hasAttribute('data-frame-focused'));
  expect(relays).to.deep.equal(['focus', 'blur']);
  el.focus();
  el.blur();
  await waitUntil(() => !el.hasAttribute('data-frame-focused'));
  expect(relays).to.deep.equal(['focus', 'blur', 'focus', 'blur']);
  const parent = el.parentElement!;
  el.remove();
  parent.append(el);
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="zoom-in-button"]')!.focus();
  // wait-reason: asserting that focusing the zoom control does NOT enter the iframe
  await aTimeout(25);
  expect(el.hasAttribute('data-frame-focused')).to.equal(false);
  expect(relays).to.deep.equal(['focus', 'blur', 'focus', 'blur']);
});

it('emits lr-zoom-change for zoomIn()/zoomOut() but not for zoom assignments', async () => {
  const el = await fixture<LyraZoomableFrame>(html`<lr-zoomable-frame zoom-levels="50% 100% 150%"></lr-zoomable-frame>`);
  const zooms: unknown[] = [];
  el.addEventListener('lr-zoom-change', (event) => zooms.push((event as CustomEvent).detail));
  el.zoom = 0.5;
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="zoom-in-button"]')!.click();
  el.zoomOut();
  expect(zooms).to.deep.equal([{ zoom: 1 }, { zoom: 0.5 }]);
});

it('observes no theme while theme sync is off', async () => {
  let themeObservers = 0;
  const observe = MutationObserver.prototype.observe;
  MutationObserver.prototype.observe = function (target: Node, options?: MutationObserverInit) {
    if (target === document.documentElement && options?.attributeFilter?.join() === 'data-lr-theme') {
      themeObservers += 1;
    }
    return observe.call(this, target, options);
  };
  try {
    await fixture<LyraZoomableFrame>(html`<lr-zoomable-frame></lr-zoomable-frame>`);
  } finally {
    MutationObserver.prototype.observe = observe;
  }
  expect(themeObservers).to.equal(0);
});

it('shares one set of owner-document focus listeners across frames', async () => {
  let focusinListeners = 0;
  const add = document.addEventListener;
  document.addEventListener = function (this: Document, type: string, ...rest: unknown[]) {
    if (type === 'focusin') focusinListeners += 1;
    return (add as (...args: unknown[]) => void).call(this, type, ...rest);
  } as typeof document.addEventListener;
  try {
    await fixture(html`<div><lr-zoomable-frame></lr-zoomable-frame><lr-zoomable-frame></lr-zoomable-frame><lr-zoomable-frame></lr-zoomable-frame></div>`);
  } finally {
    document.addEventListener = add;
  }
  expect(focusinListeners).to.be.at.most(1);
});

it('stops observing the theme once theme sync is turned off', async () => {
  const el = await fixture<LyraZoomableFrame>(html`<lr-zoomable-frame with-theme-sync></lr-zoomable-frame>`);
  expect(Reflect.get(el, 'themeWatcher')).to.not.equal(undefined);
  el.withThemeSync = false;
  await el.updateComplete;
  expect(Reflect.get(el, 'themeWatcher')).to.equal(undefined);
});

it('projects a host description onto the iframe', async function () {
  if (!('ariaDescribedByElements' in HTMLElement.prototype)) this.skip();
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <p id="zf-help">Preview help</p>
    <lr-zoomable-frame aria-describedby="zf-help"></lr-zoomable-frame>
  </div>`);
  const frame = wrapper.querySelector<LyraZoomableFrame>('lr-zoomable-frame')!.shadowRoot!.querySelector<HTMLElement>('iframe')!;
  const help = wrapper.querySelector<HTMLElement>('#zf-help')!;
  expect(
    frame.ariaDescribedByElements?.includes(help) === true ||
    (frame.getAttribute('aria-describedby')?.split(/\s+/).includes('zf-help') ?? false),
  ).to.equal(true);
});
