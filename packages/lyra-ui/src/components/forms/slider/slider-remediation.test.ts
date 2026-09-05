import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './slider.js';
import type { LyraSlider } from './slider.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

function thumb(slider: LyraSlider): HTMLElement {
  return slider.shadowRoot!.querySelector<HTMLElement>('[role="slider"]')!;
}

function descriptions(slider: LyraSlider): readonly Element[] {
  return thumb(slider).ariaDescribedByElements ?? [];
}

function recordEvents(slider: LyraSlider): string[] {
  const events: string[] = [];
  for (const name of ['input', 'lr-input', 'change', 'lr-change']) {
    slider.addEventListener(name, () => events.push(name));
  }
  return events;
}

function pointer(slider: LyraSlider, type: string, ratio: number, init: PointerEventInit = {}): void {
  const track = slider.shadowRoot!.querySelector<HTMLElement>('[part="track"]')!;
  const rect = track.getBoundingClientRect();
  const event = new PointerEvent(type, {
    bubbles: true,
    pointerId: 17,
    pointerType: 'mouse',
    button: 0,
    clientX: rect.left + rect.width * ratio,
    clientY: rect.top + rect.height / 2,
    ...init,
  });
  if (type === 'pointerdown') track.dispatchEvent(event);
  else window.dispatchEvent(event);
}

function stubCapture(slider: LyraSlider): void {
  // Synthetic pointer events cannot acquire native pointer capture. Only this fixture is stubbed.
  thumb(slider).setPointerCapture = () => {};
}

describe('slider attribute removal', () => {
  for (const [attribute, property, selector] of [
    ['label', 'label', '[part~="label"]'],
    ['hint', 'hint', '[part~="hint"]'],
    ['help-text', 'helpText', '[part~="hint"]'],
    ['error-text', 'errorText', '[part="error"]'],
  ] as const) {
    it(`renders safely after removing ${attribute}, retaining null readback and later recovery`, async () => {
      const slider = await fixture<LyraSlider>(html`<lr-slider></lr-slider>`);
      slider.setAttribute(attribute, 'Guidance');
      await slider.updateComplete;
      expect(slider.shadowRoot!.querySelector<HTMLElement>(selector)!.hidden).to.equal(false);
      slider.removeAttribute(attribute);
      const error = await slider.updateComplete.then(() => '', (reason: Error) => reason.message);
      expect(error).to.equal('');
      expect(slider[property]).to.equal(null);
      expect(slider.shadowRoot!.querySelector<HTMLElement>(selector)!.hidden).to.equal(true);
      slider.setAttribute(attribute, '');
      await slider.updateComplete;
      expect(slider[property]).to.equal('');
      slider.setAttribute(attribute, 'Restored');
      await slider.updateComplete;
      expect(slider.shadowRoot!.querySelector(selector)!.textContent).to.include('Restored');
    });
  }
});

describe('single slider external descriptions', () => {
  it('preserves external identities before local error and hint through live source changes and reconnect', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div><span id="slider-external">External</span>
        <lr-slider aria-describedby="slider-external missing slider-external" hint="Hint" error-text="Error"></lr-slider>
      </div>
    `);
    const slider = wrapper.querySelector('lr-slider')!;
    const source = wrapper.querySelector('span')!;
    const local = ['slider-error', 'slider-hint'];
    await waitUntil(() => descriptions(slider)[0] === source);
    expect(descriptions(slider).map((el) => el.id)).to.deep.equal([source.id, ...local]);
    source.textContent = 'Changed';
    expect(descriptions(slider)[0]?.textContent).to.equal('Changed');
    const replacement = document.createElement('span');
    replacement.id = source.id;
    replacement.textContent = 'Replacement';
    source.replaceWith(replacement);
    await waitUntil(() => descriptions(slider)[0] === replacement);
    replacement.remove();
    await waitUntil(() => descriptions(slider).length === 2);
    wrapper.prepend(replacement);
    await waitUntil(() => descriptions(slider)[0] === replacement);
    replacement.id = 'renamed-description';
    await waitUntil(() => descriptions(slider).length === 2);
    slider.setAttribute('aria-describedby', replacement.id);
    await waitUntil(() => descriptions(slider)[0] === replacement);
    slider.hint = '';
    await slider.updateComplete;
    await waitUntil(() => descriptions(slider).length === 2);
    expect(descriptions(slider).map((el) => el.id)).to.deep.equal([replacement.id, 'slider-error']);
    slider.removeAttribute('aria-describedby');
    await waitUntil(() => descriptions(slider).length === 1);
    slider.remove();
    slider.setAttribute('aria-describedby', replacement.id);
    wrapper.append(slider);
    await waitUntil(() => descriptions(slider)[0] === replacement);
  });

  it('resolves within the current host shadow root and adopted document', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><iframe></iframe></div>`);
    const scope = document.createElement('div');
    wrapper.append(scope);
    const root = scope.attachShadow({ mode: 'open' });
    root.innerHTML = '<span id="scoped-slider-description">Scoped</span><lr-slider aria-describedby="scoped-slider-description"></lr-slider>';
    const slider = root.querySelector('lr-slider')!;
    await slider.updateComplete;
    await waitUntil(() => descriptions(slider)[0] === root.querySelector('span'));
    const targetDocument = wrapper.querySelector('iframe')!.contentDocument!;
    const targetDescription = targetDocument.createElement('span');
    targetDescription.id = 'scoped-slider-description';
    targetDescription.textContent = 'Adopted';
    targetDocument.body.append(targetDescription, slider);
    await waitUntil(() => descriptions(slider)[0] === targetDescription);
    expect(descriptions(slider).length).to.equal(1);
  });
});

describe('slider terminal events', () => {
  it('releases native capture and retires dragging when disabled before mouse release', async () => {
    const slider = await fixture<LyraSlider>(html`<lr-slider value="20" style="inline-size: 300px"></lr-slider>`);
    const events = recordEvents(slider);
    const target = thumb(slider);
    const track = slider.shadowRoot!.querySelector<HTMLElement>('[part="track"]')!;
    try {
      await hoverUntilMatched(target, 'slider thumb did not receive hover');
      await sendMouse({ type: 'down' });
      await waitUntil(() => slider.matches(':state(dragging)'));
      const rect = track.getBoundingClientRect();
      await sendMouse({ type: 'move', position: [Math.round(rect.left + rect.width * 0.8), Math.round(rect.top + rect.height / 2)] });
      await waitUntil(() => slider.value > 20);
      const live = slider.value;
      slider.disabled = true;
      await waitUntil(() => !slider.matches(':state(dragging)'));
      await sendMouse({ type: 'up' });
      expect(slider.value).to.equal(live);
      expect(events.filter((name) => name === 'change' || name === 'lr-change')).to.deep.equal([]);
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });

  for (const channel of ['disabled', 'readonly'] as const) {
    it(`does not revive a pointer after ${channel} toggles back before release`, async () => {
      const slider = await fixture<LyraSlider>(html`<lr-slider value="20" style="inline-size: 300px"></lr-slider>`);
      stubCapture(slider);
      const events = recordEvents(slider);
      pointer(slider, 'pointerdown', 0.7);
      const live = slider.value;
      slider[channel] = true;
      slider[channel] = false;
      pointer(slider, 'pointermove', 0.9);
      pointer(slider, 'pointerup', 0.9);
      expect(slider.value).to.equal(live);
      expect(events).to.deep.equal(['input', 'lr-input']);
    });
  }

  for (const channel of ['disabled-property', 'disabled-attribute', 'fieldset', 'readonly-property', 'readonly-attribute'] as const) {
    for (const settle of [false, true]) {
      it(`cancels a changed pointer on ${channel} before release (settled=${settle})`, async () => {
        const fieldset = await fixture<HTMLFieldSetElement>(html`<fieldset><lr-slider value="20" style="inline-size: 300px"></lr-slider></fieldset>`);
        const slider = fieldset.querySelector('lr-slider')!;
        stubCapture(slider);
        const events = recordEvents(slider);
        pointer(slider, 'pointerdown', 0.7);
        const live = slider.value;
        expect(live).to.be.greaterThan(20);
        if (channel === 'fieldset') fieldset.disabled = true;
        else if (channel === 'disabled-property') slider.disabled = true;
        else if (channel === 'readonly-property') slider.readonly = true;
        else slider.setAttribute(channel === 'disabled-attribute' ? 'disabled' : 'readonly', '');
        if (settle) await slider.updateComplete;
        pointer(slider, 'pointerup', 0.7);
        expect(slider.value).to.equal(live);
        expect(events).to.deep.equal(['input', 'lr-input']);
        fieldset.disabled = false;
        slider.disabled = false;
        slider.readonly = false;
        await slider.updateComplete;
        pointer(slider, 'pointermove', 0.9);
        pointer(slider, 'pointerup', 0.9);
        expect(slider.value).to.equal(live);
        expect(events).to.deep.equal(['input', 'lr-input']);
      });
    }
  }

  it('commits an enabled changed keyboard sequence once on ordinary blur', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-slider value="20"></lr-slider><button>Next</button></div>`);
    const slider = wrapper.querySelector('lr-slider')!;
    const events = recordEvents(slider);
    slider.focus();
    thumb(slider).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    wrapper.querySelector('button')!.focus();
    expect(slider.value).to.equal(21);
    expect(events).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
    thumb(slider).dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
    expect(events.length).to.equal(4);
  });

  it('does not revive a disabled keyboard sequence after re-enabling and blur', async () => {
    const slider = await fixture<LyraSlider>(html`<lr-slider value="20"></lr-slider>`);
    const events = recordEvents(slider);
    slider.focus();
    thumb(slider).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    slider.disabled = true;
    slider.disabled = false;
    slider.blur();
    thumb(slider).dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
    expect(events).to.deep.equal(['input', 'lr-input']);
  });

  it('does not commit a keyboard sequence canceled inside its live input notification', async () => {
    const slider = await fixture<LyraSlider>(html`<lr-slider value="20"></lr-slider>`);
    const events = recordEvents(slider);
    slider.addEventListener('lr-input', () => { slider.disabled = true; });
    slider.focus();
    thumb(slider).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    slider.disabled = false;
    slider.blur();
    thumb(slider).dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
    expect(events).to.deep.equal(['input', 'lr-input']);
  });

  it('retains held-pointer continuation after form reset', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-slider name="amount" value="20" style="inline-size: 300px"></lr-slider></form>`);
    const slider = form.querySelector('lr-slider')!;
    stubCapture(slider);
    pointer(slider, 'pointerdown', 0.7);
    form.reset();
    expect(slider.value).to.equal(20);
    pointer(slider, 'pointermove', 0.9);
    expect(slider.value).to.be.greaterThan(70);
    pointer(slider, 'pointerup', 0.9);
  });

  it('keeps the native first-legend exception interactive', async () => {
    const fieldset = await fixture<HTMLFieldSetElement>(html`<fieldset disabled><legend><lr-slider value="20"></lr-slider></legend></fieldset>`);
    const slider = fieldset.querySelector('lr-slider')!;
    const events = recordEvents(slider);
    slider.focus();
    thumb(slider).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    thumb(slider).dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
    expect(slider.value).to.equal(21);
    expect(events).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
  });
});

describe('slider pointer buttons', () => {
  for (const button of [1, 2]) {
    for (const start of ['track', 'thumb']) {
      it(`ignores mouse button ${button} on the ${start}`, async () => {
        const slider = await fixture<LyraSlider>(html`<lr-slider value="20" style="inline-size: 300px"></lr-slider>`);
        stubCapture(slider);
        const events = recordEvents(slider);
        if (start === 'track') pointer(slider, 'pointerdown', 0.7, { button });
        else thumb(slider).dispatchEvent(new PointerEvent('pointerdown', { pointerId: 17, pointerType: 'mouse', button, bubbles: true }));
        pointer(slider, 'pointermove', 0.9, { button });
        pointer(slider, 'pointerup', 0.9, { button });
        expect(slider.value).to.equal(20);
        expect(events).to.deep.equal([]);
      });
    }
  }
  for (const pointerType of ['mouse', 'touch', 'pen']) {
    it(`retains primary-button ${pointerType} interaction without requiring isPrimary`, async () => {
      const slider = await fixture<LyraSlider>(html`<lr-slider value="20" style="inline-size: 300px"></lr-slider>`);
      stubCapture(slider);
      const events = recordEvents(slider);
      pointer(slider, 'pointerdown', 0.7, { pointerType, isPrimary: false });
      pointer(slider, 'pointerup', 0.7, { pointerType, isPrimary: false });
      expect(slider.value).to.be.greaterThan(20);
      expect(events).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
    });
  }
});
