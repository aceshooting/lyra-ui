import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import {
  SIGNATURE_PAD_MAX_POINTS,
  SIGNATURE_PAD_MAX_STROKES,
  type LyraSignaturePad,
  type SignatureStroke,
} from './signature-pad.class.js';
import './signature-pad.js';

const LINE: SignatureStroke[] = [[[0.1, 0.5], [0.9, 0.5]]];
const INSTRUCTIONS =
  'Draw with a pointer, or press Space to lower or lift the pen and the arrow keys to move it.';

const part = (el: LyraSignaturePad, name: string): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;

/** Viewport point at fractions of the surface box. */
function at(el: LyraSignaturePad, x: number, y: number): [number, number] {
  const rect = part(el, 'surface').getBoundingClientRect();
  return [Math.round(rect.left + rect.width * x), Math.round(rect.top + rect.height * y)];
}

function countEvents(el: LyraSignaturePad): { change: number; lrChange: number } {
  const counts = { change: 0, lrChange: 0 };
  el.addEventListener('change', () => counts.change++);
  el.addEventListener('lr-change', () => counts.lrChange++);
  return counts;
}

const announced = (): string =>
  document.querySelector('[data-lr-live-region="polite"]')?.textContent ?? '';

async function pngSize(dataUrl: string): Promise<[number, number]> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  return [image.naturalWidth, image.naturalHeight];
}

describe('<lr-signature-pad>', () => {
  afterEach(() => resetMouse());

  it('draws a stroke with a mouse and commits one change pair', async () => {
    const el = await fixture<LyraSignaturePad>(
      html`<lr-signature-pad style="inline-size: 300px"></lr-signature-pad>`,
    );
    const counts = countEvents(el);
    await sendMouse({ type: 'move', position: at(el, 0.2, 0.5) });
    await sendMouse({ type: 'down' });
    await sendMouse({ type: 'move', position: at(el, 0.5, 0.3) });
    await sendMouse({ type: 'move', position: at(el, 0.8, 0.6) });
    await sendMouse({ type: 'up' });
    await waitUntil(() => el.strokes.length === 1);
    const stroke = el.strokes[0]!;
    const [first, last] = [stroke[0]!, stroke[stroke.length - 1]!];
    expect(stroke.length).to.be.at.least(2);
    expect(first[0]).to.be.closeTo(0.2, 0.03);
    expect(first[1]).to.be.closeTo(0.5, 0.05);
    expect(last[0]).to.be.closeTo(0.8, 0.03);
    expect(counts).to.deep.equal({ change: 1, lrChange: 1 });
    expect(el.value).to.match(/^data:image\/png;base64,/);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('svg path:not(.active)').length).to.equal(1);
  });

  it('draws with touch without scrolling and commits the drawn part on pointercancel', async () => {
    const el = await fixture<LyraSignaturePad>(
      html`<lr-signature-pad style="inline-size: 300px"></lr-signature-pad>`,
    );
    const surface = part(el, 'surface');
    expect(getComputedStyle(surface).touchAction).to.equal('none');
    const counts = countEvents(el);
    const touch = (type: string, [clientX, clientY]: [number, number]): boolean =>
      surface.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          composed: true,
          pointerId: 7,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          clientX,
          clientY,
        }),
      );
    touch('pointerdown', at(el, 0.1, 0.1));
    touch('pointermove', at(el, 0.4, 0.9));
    touch('pointercancel', at(el, 0.4, 0.9));
    expect(el.strokes.length).to.equal(1);
    expect(el.strokes[0]?.length).to.equal(2);
    expect(counts).to.deep.equal({ change: 1, lrChange: 1 });
  });

  it('draws with the keyboard and announces the pen state', async () => {
    const el = await fixture<LyraSignaturePad>(html`<lr-signature-pad label="Signature"></lr-signature-pad>`);
    const counts = countEvents(el);
    await focusByKeyboard(part(el, 'surface'));
    expect(getComputedStyle(part(el, 'cursor')).display).not.to.equal('none');
    await sendKeys({ press: 'Space' });
    await waitUntil(() => announced().includes('Pen down'));
    await sendKeys({ press: 'ArrowRight' });
    await sendKeys({ press: 'ArrowRight' });
    await sendKeys({ press: 'Shift+ArrowDown' });
    expect(counts.change).to.equal(0);
    await sendKeys({ press: 'Enter' });
    expect(el.strokes).to.deep.equal([[[0.5, 0.5], [0.51, 0.5], [0.52, 0.5], [0.52, 0.6]]]);
    expect(counts).to.deep.equal({ change: 1, lrChange: 1 });
    await waitUntil(() => announced().includes('Pen up'));
    await sendKeys({ press: 'Space' });
    await sendKeys({ press: 'ArrowLeft' });
    await sendKeys({ press: 'Escape' });
    expect(el.strokes.length).to.equal(2);
    expect(counts).to.deep.equal({ change: 2, lrChange: 2 });
  });

  it('keeps physical arrow directions in a right-to-left document', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      html`<div dir="rtl"><lr-signature-pad></lr-signature-pad></div>`,
    );
    const el = wrapper.querySelector('lr-signature-pad')!;
    await focusByKeyboard(part(el, 'surface'));
    await sendKeys({ press: 'Space' });
    await sendKeys({ press: 'ArrowRight' });
    await sendKeys({ press: 'Space' });
    expect(el.strokes).to.deep.equal([[[0.5, 0.5], [0.51, 0.5]]]);
  });

  it('clears on request with one change pair and moves focus to the surface', async () => {
    const el = await fixture<LyraSignaturePad>(html`<lr-signature-pad></lr-signature-pad>`);
    const counts = countEvents(el);
    el.strokes = LINE;
    await el.updateComplete;
    const clear = part(el, 'clear-button') as HTMLButtonElement;
    expect(clear.disabled).to.be.false;
    expect(counts).to.deep.equal({ change: 0, lrChange: 0 });
    const rect = clear.getBoundingClientRect();
    await sendMouse({
      type: 'click',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await el.updateComplete;
    expect(el.strokes.length).to.equal(0);
    expect(el.value).to.equal('');
    expect(counts).to.deep.equal({ change: 1, lrChange: 1 });
    expect(clear.disabled).to.be.true;
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('surface');
    el.strokes = LINE;
    el.clear();
    expect(el.strokes.length).to.equal(0);
    expect(counts).to.deep.equal({ change: 1, lrChange: 1 });
  });

  it('blocks drawing, focus and clearing while disabled directly or by a fieldset', async () => {
    const form = await fixture<HTMLFormElement>(
      html`<form><fieldset><lr-signature-pad style="inline-size: 300px"></lr-signature-pad></fieldset></form>`,
    );
    const el = form.querySelector('lr-signature-pad')!;
    el.strokes = LINE;
    el.disabled = true;
    await el.updateComplete;
    const surface = part(el, 'surface');
    expect(el.matches(':disabled')).to.be.true;
    expect(surface.hasAttribute('tabindex')).to.be.false;
    expect(surface.getAttribute('aria-disabled')).to.equal('true');
    expect((part(el, 'clear-button') as HTMLButtonElement).disabled).to.be.true;
    await sendMouse({ type: 'move', position: at(el, 0.2, 0.2) });
    await sendMouse({ type: 'down' });
    await sendMouse({ type: 'move', position: at(el, 0.6, 0.6) });
    await sendMouse({ type: 'up' });
    expect(el.strokes.length).to.equal(1);

    el.disabled = false;
    await el.updateComplete;
    expect(surface.getAttribute('tabindex')).to.equal('0');
    form.querySelector('fieldset')!.disabled = true;
    await el.updateComplete;
    expect(surface.hasAttribute('tabindex')).to.be.false;
    expect((part(el, 'clear-button') as HTMLButtonElement).disabled).to.be.true;
  });

  it('reports valueMissing while a required pad is empty', async () => {
    const el = await fixture<LyraSignaturePad>(html`<lr-signature-pad required></lr-signature-pad>`);
    expect(el.checkValidity()).to.be.false;
    expect(el.validity.valueMissing).to.be.true;
    expect(el.validationMessage).to.equal('This field is required.');
    expect(el.matches(':state(invalid)')).to.be.true;
    expect(el.matches(':state(user-invalid)')).to.be.false;
    el.strokes = LINE;
    expect(el.checkValidity()).to.be.true;
    el.setCustomValidity('Signature rejected');
    expect(el.validity.customError).to.be.true;
    el.setCustomValidity('');
    expect(el.checkValidity()).to.be.true;
  });

  it('submits no entry while empty and the PNG data URL once signed', async () => {
    const form = await fixture<HTMLFormElement>(
      html`<form><lr-signature-pad name="signature"></lr-signature-pad></form>`,
    );
    const el = form.querySelector('lr-signature-pad')!;
    expect(new FormData(form).has('signature')).to.be.false;
    el.strokes = LINE;
    expect(el.value).to.match(/^data:image\/png;base64,/);
    expect(new FormData(form).get('signature') === el.value).to.be.true;
  });

  it('resets to empty and restores validated strokes from saved form state', async () => {
    const form = await fixture<HTMLFormElement>(
      html`<form><lr-signature-pad name="signature" required></lr-signature-pad></form>`,
    );
    const el = form.querySelector('lr-signature-pad')!;
    const counts = countEvents(el);
    el.reportValidity();
    expect(el.matches(':state(user-invalid)')).to.be.true;
    el.strokes = LINE;
    form.reset();
    expect(el.strokes.length).to.equal(0);
    expect(new FormData(form).has('signature')).to.be.false;
    expect(el.matches(':state(user-invalid)')).to.be.false;
    el.formStateRestoreCallback(JSON.stringify([[[0.25, 0.5], [2, -1], ['x', 0.1]]]));
    expect(el.strokes).to.deep.equal([[[0.25, 0.5], [1, 0]]]);
    el.formStateRestoreCallback('not json');
    expect(el.strokes.length).to.equal(0);
    expect(counts).to.deep.equal({ change: 0, lrChange: 0 });
  });

  it('copies, sanitizes and caps assigned strokes and ignores a same-reference assignment', async () => {
    const el = await fixture<LyraSignaturePad>(html`<lr-signature-pad></lr-signature-pad>`);
    const input = [
      [[0.1, 0.2], [Number.NaN, 0.5], [Infinity, 0], ['0.3', 0.3], [1.5, -2], null, [0.4]],
      [],
      'nope',
      [[0.6, 0.7]],
    ] as unknown as SignatureStroke[];
    el.strokes = input;
    expect(el.strokes).to.deep.equal([[[0.1, 0.2], [1, 0]], [[0.6, 0.7]]]);
    (input[0] as unknown as unknown[]).length = 0;
    expect(el.strokes[0]?.length).to.equal(2);
    const current = el.strokes;
    el.strokes = current;
    expect(el.strokes === current).to.be.true;

    el.strokes = Array.from({ length: SIGNATURE_PAD_MAX_STROKES + 1 }, () => [[0.5, 0.5]]);
    expect(el.strokes.length).to.equal(SIGNATURE_PAD_MAX_STROKES);
    el.strokes = [Array.from({ length: SIGNATURE_PAD_MAX_POINTS + 1 }, (_, i): [number, number] => [i / 4096, 0.5])];
    expect(el.strokes[0]?.length).to.equal(SIGNATURE_PAD_MAX_POINTS);
  });

  it('exports a bounded PNG that does not depend on the rendered size', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      html`<div style="inline-size: 600px"><lr-signature-pad></lr-signature-pad></div>`,
    );
    const el = wrapper.querySelector('lr-signature-pad')!;
    el.strokes = LINE;
    const before = el.value;
    expect(await pngSize(before)).to.deep.equal([1024, 341]);
    wrapper.style.inlineSize = '250px';
    el.strokes = JSON.parse(JSON.stringify(LINE)) as SignatureStroke[];
    expect(el.value === before).to.be.true;
    el.style.setProperty('--lr-signature-pad-aspect-ratio', '1 / 2');
    el.strokes = [[[0.5, 0.1], [0.5, 0.9]]];
    expect(await pngSize(el.value)).to.deep.equal([512, 1024]);
  });

  it('names the surface from the label, lets a host aria-label win and describes its state', async () => {
    const el = await fixture<LyraSignaturePad>(
      html`<lr-signature-pad label="Signature" hint="Sign inside the box"></lr-signature-pad>`,
    );
    const surface = part(el, 'surface');
    const text = (id: string): string | undefined => el.shadowRoot!.getElementById(id)?.textContent?.trim();
    const described = (): (string | undefined)[] => surface.getAttribute('aria-describedby')!.split(' ').map(text);
    expect(surface.getAttribute('role')).to.equal('application');
    expect(surface.getAttribute('aria-roledescription')).to.equal('signature pad');
    expect(text(surface.getAttribute('aria-labelledby')!)).to.equal('Signature');
    expect(described()).to.deep.equal(['Sign inside the box', INSTRUCTIONS, 'No signature']);
    el.strokes = LINE;
    await el.updateComplete;
    expect(described().at(-1)).to.equal('Signed, 1 stroke');
    el.setAttribute('aria-label', 'Customer signature');
    await el.updateComplete;
    expect(surface.getAttribute('aria-label')).to.equal('Customer signature');
    expect(surface.hasAttribute('aria-labelledby')).to.be.false;
  });

  it('renders English without a registered locale and lets .strings reach the DOM', async () => {
    const el = await fixture<LyraSignaturePad>(html`<lr-signature-pad></lr-signature-pad>`);
    const surface = part(el, 'surface');
    const status = (): string | undefined => el.shadowRoot!.getElementById('status')?.textContent?.trim();
    expect(part(el, 'clear-button').textContent?.trim()).to.equal('Clear');
    expect(surface.getAttribute('aria-roledescription')).to.equal('signature pad');
    expect(surface.getAttribute('aria-label')).to.equal('Signature');
    expect(status()).to.equal('No signature');
    el.strings = {
      signaturePad: 'zone de signature',
      signaturePadLabel: 'Signature manuscrite',
      clear: 'Effacer',
      signaturePadEmpty: 'Aucune signature',
    };
    await el.updateComplete;
    expect(part(el, 'clear-button').textContent?.trim()).to.equal('Effacer');
    expect(surface.getAttribute('aria-roledescription')).to.equal('zone de signature');
    expect(surface.getAttribute('aria-label')).to.equal('Signature manuscrite');
    expect(status()).to.equal('Aucune signature');
  });

  it('fits a 320px allocation', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div style="inline-size: 320px">
        <lr-signature-pad
          label="Signature of the account holder or an authorised representative"
          hint="Sign with a finger, a stylus, a mouse or the keyboard"
        ></lr-signature-pad>
      </div>
    `);
    const el = wrapper.querySelector('lr-signature-pad')!;
    const host = el.getBoundingClientRect();
    const surface = part(el, 'surface').getBoundingClientRect();
    expect(host.width).to.equal(320);
    expect(surface.width).to.be.closeTo(320, 1);
    expect(surface.height).to.be.closeTo(320 / 3, 1);
    expect(part(el, 'clear-button').getBoundingClientRect().right).to.be.at.most(host.right + 0.5);
    expect(el.scrollWidth).to.be.at.most(320);
  });

  it('is accessible in its empty, populated, disabled and invalid states', async () => {
    const el = await fixture<LyraSignaturePad>(
      html`<lr-signature-pad label="Signature" hint="Sign inside the box" required></lr-signature-pad>`,
    );
    await expect(el).to.be.accessible();
    el.strokes = LINE;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('svg path:not(.active)').length).to.equal(1);
    await expect(el).to.be.accessible();
    el.disabled = true;
    await el.updateComplete;
    expect(part(el, 'surface').getAttribute('aria-disabled')).to.equal('true');
    await expect(el).to.be.accessible();
    el.disabled = false;
    el.clear();
    el.errorText = 'Please sign before continuing.';
    el.reportValidity();
    await el.updateComplete;
    expect(part(el, 'surface').getAttribute('aria-invalid')).to.equal('true');
    expect(part(el, 'error').hidden).to.be.false;
    await expect(el).to.be.accessible();
  });
});
