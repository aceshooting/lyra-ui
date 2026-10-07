import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import './color-picker.js';
import type { LyraColorPicker } from './color-picker.js';

function part<T extends HTMLElement = HTMLElement>(picker: LyraColorPicker, name: string): T {
  return picker.shadowRoot!.querySelector<T>(`[part~="${name}"]`)!;
}

function changes(picker: LyraColorPicker): string[] {
  const events: string[] = [];
  for (const name of ['input', 'lr-input', 'change', 'lr-change']) {
    picker.addEventListener(name, () => events.push(name));
  }
  return events;
}

describe('color picker disabled draft and action boundaries', () => {
  for (const draft of ['', '#00ff00']) {
    it(`preserves the enabled ${draft === '' ? 'empty' : 'nonempty'} native draft through unrelated updates`, async () => {
      const picker = await fixture<LyraColorPicker>(html`<lr-color-picker inline value="#ff0000"></lr-color-picker>`);
      const input = part<HTMLInputElement>(picker, 'input');
      const events = changes(picker);
      input.focus();
      input.select();
      await sendKeys({ press: 'Backspace' });
      if (draft) await sendKeys({ type: draft });
      expect(input.value).to.equal(draft);
      picker.hint = 'Choose a color';
      await picker.updateComplete;
      expect(input.value).to.equal(draft);
      expect(picker.shadowRoot!.activeElement === input).to.equal(true);
      expect(picker.value).to.equal('#ff0000');
      expect(events).to.deep.equal([]);
      picker.disabled = true;
      await picker.updateComplete;
      expect(input.value).to.equal('#ff0000');
      expect(picker.value).to.equal('#ff0000');
      expect(events).to.deep.equal([]);
    });
  }

  for (const channel of ['property', 'attribute', 'fieldset']) {
    it(`discards a real dirty native draft when ${channel} disablement forces change`, async () => {
      const fieldset = await fixture<HTMLFieldSetElement>(html`<fieldset><lr-color-picker inline value="#ff0000"></lr-color-picker></fieldset>`);
      const picker = fieldset.querySelector('lr-color-picker')!;
      const input = part<HTMLInputElement>(picker, 'input');
      const events = changes(picker);
      input.focus();
      input.select();
      await sendKeys({ type: '#00ff00' });
      expect(input.value).to.equal('#00ff00');
      expect(picker.value).to.equal('#ff0000');
      if (channel === 'fieldset') fieldset.disabled = true;
      else if (channel === 'attribute') picker.setAttribute('disabled', '');
      else picker.disabled = true;
      await picker.updateComplete;
      expect(picker.value).to.equal('#ff0000');
      expect(events).to.deep.equal([]);
      expect(input.value).to.equal('#ff0000');
      fieldset.disabled = false;
      picker.disabled = false;
      await picker.updateComplete;
      input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      expect(picker.value).to.equal('#ff0000');
      expect(events).to.deep.equal([]);
    });

    for (const action of ['input', 'change', 'Enter', 'swatch', 'format']) {
      it(`blocks same-task ${action} after ${channel} disablement`, async () => {
        const fieldset = await fixture<HTMLFieldSetElement>(html`<fieldset><lr-color-picker inline value="#ff0000" swatches="#00ff00"></lr-color-picker></fieldset>`);
        const picker = fieldset.querySelector('lr-color-picker')!;
        const events = changes(picker);
        const input = part<HTMLInputElement>(picker, 'input');
        if (channel === 'fieldset') fieldset.disabled = true;
        else if (channel === 'attribute') picker.setAttribute('disabled', '');
        else picker.disabled = true;
        if (action === 'swatch') part<HTMLButtonElement>(picker, 'swatch').click();
        else if (action === 'format') part<HTMLButtonElement>(picker, 'format-button').click();
        else {
          input.value = '#00ff00';
          if (action === 'Enter') input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
          else input.dispatchEvent(new Event(action, { bubbles: true, composed: true }));
        }
        await picker.updateComplete;
        expect(picker.value).to.equal('#ff0000');
        expect(picker.format).to.equal('hex');
        expect(events).to.deep.equal([]);
        fieldset.disabled = false;
        picker.disabled = false;
        await picker.updateComplete;
        expect(input.value).to.equal('#ff0000');
      });
    }
  }

  it('retains enabled native blur commits and silent format changes', async () => {
    const picker = await fixture<LyraColorPicker>(html`<lr-color-picker inline value="#ff0000"></lr-color-picker>`);
    const input = part<HTMLInputElement>(picker, 'input');
    const events = changes(picker);
    input.focus();
    input.select();
    await sendKeys({ type: '#00ff00' });
    input.blur();
    await picker.updateComplete;
    expect(picker.value).to.equal('#00ff00');
    expect(events).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
    events.length = 0;
    part<HTMLButtonElement>(picker, 'format-button').click();
    await picker.updateComplete;
    expect(picker.format).to.equal('rgb');
    expect(picker.value).to.equal('rgb(0, 255, 0)');
    expect(events).to.deep.equal([]);
  });

  it('leaves the native first-legend exception interactive', async () => {
    const fieldset = await fixture<HTMLFieldSetElement>(html`<fieldset disabled><legend><lr-color-picker inline value="#ff0000" swatches="#00ff00"></lr-color-picker></legend></fieldset>`);
    const picker = fieldset.querySelector('lr-color-picker')!;
    part<HTMLButtonElement>(picker, 'swatch').click();
    expect(picker.value).to.equal('#00ff00');
  });
});

describe('color picker trigger external descriptions', () => {
  it('updates external identities before local guidance through source changes and reconnect', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><span id="color-external">External</span><lr-color-picker aria-describedby="color-external missing color-external" hint="Hint" error-text="Error" value="#ff0000"></lr-color-picker></div>`);
    const picker = wrapper.querySelector('lr-color-picker')!;
    const source = wrapper.querySelector('span')!;
    const refs = (): readonly Element[] => part(picker, 'trigger').ariaDescribedByElements ?? [];
    const localIds = refs().map((node) => node.id);
    await waitUntil(() => refs()[0] === source);
    expect(refs().slice(1).map((node) => node.id)).to.deep.equal(localIds.filter((id) => id !== source.id));
    expect(refs().some((node) => node === part(picker, 'hint'))).to.equal(true);
    expect(refs().some((node) => node === part(picker, 'error'))).to.equal(true);
    const replacement = document.createElement('span');
    replacement.id = source.id;
    source.replaceWith(replacement);
    await waitUntil(() => refs()[0] === replacement);
    replacement.textContent = 'Replacement';
    expect(refs()[0]?.textContent).to.equal('Replacement');
    replacement.remove();
    await waitUntil(() => !refs().includes(replacement));
    wrapper.prepend(replacement);
    await waitUntil(() => refs()[0] === replacement);
    replacement.id = 'color-renamed';
    await waitUntil(() => !refs().includes(replacement));
    picker.setAttribute('aria-describedby', replacement.id);
    await waitUntil(() => refs()[0] === replacement);
    picker.hint = '';
    await picker.updateComplete;
    await waitUntil(() => !refs().includes(part(picker, 'hint')));
    picker.removeAttribute('aria-describedby');
    await waitUntil(() => !refs().includes(replacement));
    picker.remove();
    picker.setAttribute('aria-describedby', replacement.id);
    wrapper.append(picker);
    await waitUntil(() => refs()[0] === replacement);
    picker.inline = true;
    await picker.updateComplete;
    expect(picker.shadowRoot!.querySelectorAll('[part="trigger"]').length).to.equal(0);
    picker.inline = false;
    await picker.updateComplete;
    await waitUntil(() => refs()[0] === replacement);
  });

  it('resolves in the host shadow root and current adopted document', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><iframe></iframe></div>`);
    const scope = document.createElement('div');
    wrapper.append(scope);
    const root = scope.attachShadow({ mode: 'open' });
    root.innerHTML = '<span id="color-scoped">Scoped</span><lr-color-picker aria-describedby="color-scoped"></lr-color-picker>';
    const picker = root.querySelector('lr-color-picker')!;
    await picker.updateComplete;
    const refs = (): readonly Element[] => part(picker, 'trigger').ariaDescribedByElements ?? [];
    await waitUntil(() => refs()[0] === root.querySelector('span'));
    const targetDocument = wrapper.querySelector('iframe')!.contentDocument!;
    const target = targetDocument.createElement('span');
    target.id = 'color-scoped';
    targetDocument.body.append(target, picker);
    await waitUntil(() => refs()[0] === target);
  });
});

function press(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, composed: true }));
}

describe('color picker palette', () => {
  const palette = [
    { color: '#ff0000', label: 'Red' },
    { color: '#00ff00', label: 'Green' },
    { color: '#0000ff', label: 'Blue', disabled: true },
    { color: '#ffff00', label: 'Yellow' },
  ];

  it('is one roving radiogroup with a single tab stop', async () => {
    const picker = await fixture<LyraColorPicker>(html`<lr-color-picker inline value="#00ff00" .swatches=${palette}></lr-color-picker>`);
    expect(part(picker, 'swatches').getAttribute('role')).to.equal('radiogroup');
    const radios = [...picker.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="swatch"]')];
    expect(radios.map((radio) => radio.getAttribute('role'))).to.deep.equal(['radio', 'radio', 'radio', 'radio']);
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).to.deep.equal(['false', 'true', 'false', 'false']);
    expect(radios.map((radio) => radio.tabIndex)).to.deep.equal([-1, 0, -1, -1]);
    await expect(picker).to.be.accessible();
  });

  it('moves, selects and wraps with the arrow keys, skipping disabled entries', async () => {
    const picker = await fixture<LyraColorPicker>(html`<lr-color-picker inline value="#00ff00" .swatches=${palette}></lr-color-picker>`);
    const radios = [...picker.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="swatch"]')];
    radios[1]!.focus();
    press(radios[1]!, 'ArrowRight');
    expect(picker.value).to.equal('#ffff00');
    expect(picker.shadowRoot!.activeElement === radios[3]).to.equal(true);
    press(radios[3]!, 'ArrowDown');
    expect(picker.value).to.equal('#ff0000');
    press(radios[0]!, 'End');
    expect(picker.value).to.equal('#ffff00');
    press(radios[3]!, 'Home');
    expect(picker.value).to.equal('#ff0000');
  });
});

it('parses a palette once instead of on every render', async () => {
  const swatches = Array.from({ length: 100 }, (_, index) => `oklch(0.6 0.1 ${index * 3})`);
  const picker = await fixture<LyraColorPicker>(html`<lr-color-picker inline .swatches=${swatches}></lr-color-picker>`);
  await picker.updateComplete;
  let probes = 0;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement && node.style.visibility === 'hidden') probes += 1;
      }
    }
  });
  observer.observe(document.body, { childList: true });
  for (const value of ['#112233', '#223344', '#334455']) {
    picker.value = value;
    await picker.updateComplete;
  }
  observer.disconnect();
  expect(probes).to.equal(0);
});

it('normalizes format to its supported vocabulary', async () => {
  const upper = await fixture<LyraColorPicker>(html`<lr-color-picker format="HEX" value="#ff0000"></lr-color-picker>`);
  expect(upper.format).to.equal('hex');
  const alpha = await fixture<LyraColorPicker>(html`<lr-color-picker format="rgba" opacity value="#ff0000"></lr-color-picker>`);
  await alpha.updateComplete;
  expect(alpha.format).to.equal('rgb');
  expect(alpha.value).to.match(/^rgba\(/);
  (alpha as unknown as { format: string }).format = 'bogus';
  expect(alpha.format).to.equal('hex');
});

it('steps the colour handles by ten with PageUp and PageDown', async () => {
  const picker = await fixture<LyraColorPicker>(html`<lr-color-picker inline opacity value="hsva(100, 50%, 50%, 0.5)"></lr-color-picker>`);
  const hue = part(picker, 'hue-slider-handle');
  press(hue, 'PageUp');
  await picker.updateComplete;
  expect(hue.getAttribute('aria-valuenow')).to.equal('110');
  press(hue, 'PageDown');
  await picker.updateComplete;
  expect(hue.getAttribute('aria-valuenow')).to.equal('100');
  press(part(picker, 'grid-handle'), 'PageUp');
  expect(picker.getFormattedValue('hsv')).to.equal('hsv(100, 50%, 60%)');
  const opacity = part(picker, 'opacity-slider-handle');
  press(opacity, 'PageUp');
  await picker.updateComplete;
  expect(opacity.getAttribute('aria-valuenow')).to.equal('60');
});

it('paints no pointer affordance on its sliders while disabled or readonly', async () => {
  const outlineOnHover = async (attribute: string): Promise<string> => {
    const picker = await fixture<LyraColorPicker>(`<lr-color-picker inline ${attribute} value="#ff0000" style="--lr-transition-fast: 0s"></lr-color-picker>`);
    const slider = part(picker, 'hue-slider');
    try {
      await hoverUntilMatched(slider, 'the pointer never hovered the slider');
      await settlePointer();
      return getComputedStyle(slider).outlineStyle;
    } finally {
      await resetMouse();
    }
  };
  expect(await outlineOnHover('')).to.equal('solid');
  expect(await outlineOnHover('disabled')).to.equal('none');
  expect(await outlineOnHover('readonly')).to.equal('none');
});
