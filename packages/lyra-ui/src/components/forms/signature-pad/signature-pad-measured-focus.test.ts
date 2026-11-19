import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { shadowFocusTarget } from '../../../internal/active-element.js';
import type { LyraSignaturePad, SignatureStroke } from './signature-pad.class.js';
import './signature-pad.js';

const LINE: SignatureStroke[] = [[[0.1, 0.5], [0.9, 0.5]]];

async function pngSize(url: string): Promise<[number, number]> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return [image.naturalWidth, image.naturalHeight];
}

describe('lr-signature-pad measured export', () => {
  it('re-exports the cached PNG and form value once the surface is measured at its real ratio', async () => {
    const pad = document.createElement('lr-signature-pad') as LyraSignaturePad;
    pad.style.setProperty('--lr-signature-pad-aspect-ratio', '1 / 1');
    pad.style.display = 'block';
    pad.style.inlineSize = '200px';
    pad.strokes = LINE;
    expect(await pngSize(pad.value)).to.deep.equal([1024, 341]);
    const form = document.createElement('form');
    pad.name = 'sig';
    form.append(pad);
    await fixture(html`<div></div>`);
    document.body.append(form);
    try {
      await pad.updateComplete;
      await waitUntil(async () => (await pngSize(pad.value))[1] === 1024, 'the PNG is rebuilt at 1:1');
      expect(await pngSize(pad.value)).to.deep.equal([1024, 1024]);
      expect(new FormData(form).get('sig')).to.equal(pad.value);
    } finally {
      form.remove();
    }
  });
});

describe('lr-signature-pad focus and key repeat', () => {
  it('forwards host focus() and blur() to the drawing surface and ignores them while disabled', async () => {
    const el = await fixture<LyraSignaturePad>(html`<lr-signature-pad></lr-signature-pad>`);
    const surface = el.shadowRoot!.querySelector<HTMLElement>('[part="surface"]')!;
    let focusEvents = 0;
    el.addEventListener('focus', () => focusEvents++);
    el.focus();
    expect(shadowFocusTarget(el) === surface, 'surface focused').to.equal(true);
    expect(focusEvents).to.equal(1);
    el.blur();
    expect(shadowFocusTarget(el) === null, 'nothing focused').to.equal(true);
    el.disabled = true;
    await el.updateComplete;
    el.focus();
    expect(shadowFocusTarget(el) === null, 'nothing focused').to.equal(true);
  });

  it('lowers and lifts the pen once for a held Space or Enter', async () => {
    const el = await fixture<LyraSignaturePad>(html`<lr-signature-pad></lr-signature-pad>`);
    let changes = 0;
    el.addEventListener('lr-change', () => changes++);
    el.focus();
    const surface = el.shadowRoot!.querySelector<HTMLElement>('[part="surface"]')!;
    const press = (key: string, repeat: boolean): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key, repeat, bubbles: true, cancelable: true });
      surface.dispatchEvent(event);
      return event;
    };
    press(' ', false);
    for (let n = 0; n < 5; n++) press(' ', true);
    await el.updateComplete;
    expect(changes).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="cursor"]')!.hasAttribute('data-down')).to.equal(true);
    press(' ', false);
    await el.updateComplete;
    expect(changes).to.equal(1);
    expect(el.strokes.length).to.equal(1);
  });
});

it('themes the signature surface and both pointer states of its clear button', async () => {
  const pad = await fixture<LyraSignaturePad>(html`
    <lr-signature-pad .strokes=${LINE} style="--lr-signature-pad-fill: rgb(1, 2, 3);
      --lr-signature-pad-radius: 17px; --lr-signature-pad-border-color: rgb(2, 3, 4);
      --lr-signature-pad-hover-border-color: rgb(3, 4, 5);
      --lr-signature-pad-clear-hover-bg: rgb(4, 5, 6); --lr-signature-pad-clear-active-bg: rgb(5, 6, 7);
      --lr-transition-interactive: none"></lr-signature-pad>
  `);
  const surface = pad.shadowRoot!.querySelector<HTMLElement>('[part="surface"]')!;
  const button = pad.shadowRoot!.querySelector<HTMLElement>('[part="clear-button"]')!;
  try {
    await hoverUntilMatched(button, 'the enabled clear button receives the pointer');
    expect(getComputedStyle(surface).borderTopColor).to.equal('rgb(2, 3, 4)');
    expect(getComputedStyle(surface).backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(surface).borderStartStartRadius).to.equal('17px');
    expect(getComputedStyle(button).backgroundColor).to.equal('rgb(4, 5, 6)');
    await sendMouse({ type: 'down' });
    await waitUntil(() => getComputedStyle(button).backgroundColor === 'rgb(5, 6, 7)');
    await sendMouse({ type: 'up' });
    await hoverUntilMatched(surface, 'the drawing surface receives the pointer');
    expect(getComputedStyle(surface).borderTopColor).to.equal('rgb(3, 4, 5)');
    pad.style.setProperty('--lr-form-control-invalid-border-color', 'rgb(7, 8, 9)');
    pad.style.setProperty('--lr-signature-pad-invalid-border-color', 'rgb(6, 7, 8)');
    pad.setCustomValidity('Invalid signature');
    expect(pad.reportValidity()).to.equal(false);
    await waitUntil(() => getComputedStyle(surface).borderTopColor === 'rgb(6, 7, 8)');
  } finally {
    await resetMouse();
  }
});
