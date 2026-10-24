import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import { SIGNATURE_PAD_MAX_STROKES, type LyraSignaturePad } from './signature-pad.class.js';
import './signature-pad.js';

function surfaceOf(el: LyraSignaturePad): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part="surface"]')!;
}

function cursorOf(el: LyraSignaturePad): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part="cursor"]')!;
}

function activePath(el: LyraSignaturePad): string | null {
  return el.shadowRoot!.querySelector('path.active')!.getAttribute('d');
}

function observeChanges(el: LyraSignaturePad): string[] {
  const changes: string[] = [];
  el.addEventListener('change', () => changes.push('change'));
  el.addEventListener('lr-change', () => changes.push('lr-change'));
  return changes;
}

describe('signature pad public stroke boundaries', () => {
  afterEach(() => resetMouse());

  it('refuses keyboard and pointer starts at the stroke ceiling and draws again after a public clear', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form><lr-signature-pad name="signature" style="inline-size: 640px"></lr-signature-pad></form>
    `);
    const el = form.querySelector('lr-signature-pad')!;
    const changes = observeChanges(el);
    el.strokes = Array.from({ length: SIGNATURE_PAD_MAX_STROKES }, (_, index) => [
      [index / SIGNATURE_PAD_MAX_STROKES, 0.5] as const,
    ]);
    await el.updateComplete;
    const retained = el.strokes;
    const value = el.value;
    expect(retained.length).to.equal(SIGNATURE_PAD_MAX_STROKES);
    expect(value).to.match(/^data:image\/png;base64,/);
    expect(new FormData(form).get('signature')).to.equal(value);
    expect(changes).to.deep.equal([]);
    const surface = surfaceOf(el);
    let spaces = 0;
    surface.addEventListener('keydown', event => { if (event.key === ' ') spaces++; });
    await focusByKeyboard(surface);
    await sendKeys({ press: 'Space' });
    await waitUntil(() => spaces === 1, 'the native pen-toggle key reached the full pad');
    await el.updateComplete;
    expect(cursorOf(el).hasAttribute('data-down')).to.equal(false);
    expect(activePath(el)).to.equal(null);
    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(() => cursorOf(el).style.left === '51%', 'the cursor moves without starting a stroke');

    let downs = 0;
    let ups = 0;
    surface.addEventListener('pointerdown', () => downs++);
    surface.addEventListener('pointerup', () => ups++);
    await hoverUntilMatched(surface, 'the full pad receives the pointer');
    await sendMouse({ type: 'down' });
    await waitUntil(() => downs === 1, 'the native pointer press reached the full pad');
    await settlePointer();
    expect(activePath(el)).to.equal(null);
    await sendMouse({ type: 'up' });
    await waitUntil(() => ups === 1, 'the native pointer release completed');
    expect(el.strokes === retained).to.equal(true);
    expect(el.value).to.equal(value);
    expect(new FormData(form).get('signature')).to.equal(value);
    expect(changes).to.deep.equal([]);
    expect(el.shadowRoot!.querySelectorAll('svg path:not(.active)').length).to.equal(SIGNATURE_PAD_MAX_STROKES);

    el.clear();
    await el.updateComplete;
    expect(el.strokes.length).to.equal(0);
    expect(new FormData(form).has('signature')).to.equal(false);
    expect(changes).to.deep.equal([]);
    await focusByKeyboard(surface);
    await sendKeys({ press: 'Space' });
    await waitUntil(() => cursorOf(el).hasAttribute('data-down'), 'clearing permits a new pen-down');
    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(() => cursorOf(el).style.left === '52%', 'the new stroke moves to its endpoint');
    await sendKeys({ press: 'Space' });
    await waitUntil(() => el.strokes.length === 1, 'the new stroke commits');
    expect(el.strokes).to.deep.equal([[[0.51, 0.5], [0.52, 0.5]]]);
    expect(new FormData(form).get('signature')).to.equal(el.value);
    expect(changes).to.deep.equal(['change', 'lr-change']);
  });

  it('omits delivered one-pixel pointer jitter but retains a larger movement and its painted stroke', async () => {
    const el = await fixture<LyraSignaturePad>(html`
      <lr-signature-pad style="inline-size: 640px"></lr-signature-pad>
    `);
    const surface = surfaceOf(el);
    const changes = observeChanges(el);
    await hoverUntilMatched(surface, 'the drawing surface receives the pointer', rect => [
      rect.left + rect.width / 4, rect.top + rect.height / 2,
    ]);
    const rect = surface.getBoundingClientRect();
    expect(rect.width).to.be.greaterThan(600);
    const start: [number, number] = [
      Math.round(rect.left + rect.width / 4), Math.round(rect.top + rect.height / 2),
    ];
    let deliveredX = -1;
    surface.addEventListener('pointermove', event => { deliveredX = event.clientX; });
    await sendMouse({ type: 'down' });
    await waitUntil(() => activePath(el) !== null, 'the initial point is painted');
    const initialPaint = activePath(el);
    await sendMouse({ type: 'move', position: [start[0] + 1, start[1]] });
    await waitUntil(() => deliveredX === start[0] + 1, 'the one-pixel native move was delivered');
    await settlePointer();
    expect(activePath(el)).to.equal(initialPaint);
    expect(el.strokes.length).to.equal(0);
    expect(changes).to.deep.equal([]);

    await sendMouse({ type: 'move', position: [start[0] + 64, start[1]] });
    await waitUntil(() => deliveredX === start[0] + 64 && activePath(el) !== initialPaint,
      'the larger native move adds visible ink');
    await sendMouse({ type: 'up' });
    await waitUntil(() => el.strokes.length === 1, 'the pointer stroke commits');
    await el.updateComplete;
    const stroke = el.strokes[0]!;
    expect(stroke.length).to.equal(2);
    expect(stroke[0]![0]).to.be.closeTo(0.25, 0.002);
    expect(stroke[1]![0] - stroke[0]![0]).to.be.closeTo(64 / rect.width, 0.0002);
    expect(stroke[1]![1]).to.equal(stroke[0]![1]);
    expect(activePath(el)).to.equal(null);
    expect(el.shadowRoot!.querySelectorAll('svg path:not(.active)').length).to.equal(1);
    expect(el.value).to.match(/^data:image\/png;base64,/);
    expect(changes).to.deep.equal(['change', 'lr-change']);
  });

  it('commits a keyboard stroke on native blur exactly once and keeps it submitted after refocus', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form>
        <lr-signature-pad name="signature" required label="Signature"></lr-signature-pad>
        <button type="button">Continue</button>
      </form>
    `);
    const el = form.querySelector('lr-signature-pad')!;
    const surface = surfaceOf(el);
    const changes = observeChanges(el);
    expect(el.validity.valueMissing).to.equal(true);
    await focusByKeyboard(surface);
    await sendKeys({ press: 'Space' });
    await waitUntil(() => cursorOf(el).hasAttribute('data-down'), 'the keyboard pen is down');
    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(() => cursorOf(el).style.left === '51%', 'the keyboard stroke reached its endpoint');
    expect(activePath(el) !== null).to.equal(true);
    expect(el.strokes.length).to.equal(0);
    expect(new FormData(form).has('signature')).to.equal(false);
    expect(changes).to.deep.equal([]);

    await sendKeys({ press: 'Tab' });
    await waitUntil(() => el.shadowRoot!.activeElement !== surface && el.strokes.length === 1,
      'native blur commits the pending keyboard stroke');
    await el.updateComplete;
    expect(el.strokes).to.deep.equal([[[0.5, 0.5], [0.51, 0.5]]]);
    expect(cursorOf(el).hasAttribute('data-down')).to.equal(false);
    expect(activePath(el)).to.equal(null);
    expect(el.shadowRoot!.querySelectorAll('svg path:not(.active)').length).to.equal(1);
    expect(el.validity.valid).to.equal(true);
    const committed = el.strokes;
    const value = el.value;
    expect(value).to.match(/^data:image\/png;base64,/);
    expect(new FormData(form).get('signature')).to.equal(value);
    expect(changes).to.deep.equal(['change', 'lr-change']);

    await focusByKeyboard(surface);
    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(() => cursorOf(el).style.left === '52%', 'the lifted cursor can move after refocus');
    await sendKeys({ press: 'Tab' });
    await waitUntil(() => el.shadowRoot!.activeElement !== surface, 'the refocused surface blurs again');
    expect(el.strokes === committed).to.equal(true);
    expect(new FormData(form).get('signature')).to.equal(value);
    expect(changes).to.deep.equal(['change', 'lr-change']);
  });
});
