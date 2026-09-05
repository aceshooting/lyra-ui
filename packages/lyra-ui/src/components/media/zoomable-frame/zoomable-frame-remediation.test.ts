import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './zoomable-frame.js';
import type { LyraZoomableFrame } from './zoomable-frame.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

it('uses a reactive property-only iframe title while retaining host-name and empty-title rules', async () => {
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
  expect(frame.title).to.equal('');
  el.setAttribute('aria-label', 'Host purpose');
  await el.updateComplete;
  expect(frame.title).to.equal('Frame');
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
  await aTimeout(25);
  expect(el.hasAttribute('data-frame-focused')).to.equal(false);
  expect(relays).to.deep.equal(['focus', 'blur', 'focus', 'blur']);
});
