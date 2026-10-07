import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './voice-picker.js';
import type { LyraVoicePicker } from './voice-picker.js';

for (const closedMode of [false, true]) {
  for (const attribute of ['label', 'hint', 'error-text'] as const) {
    it(`removes ${attribute} safely in ${closedMode ? 'catalog' : 'free-text'} mode`, async () => {
      const el = await fixture<LyraVoicePicker>(html`<lr-voice-picker .catalog=${closedMode ? ['Choice'] : undefined}></lr-voice-picker>`);
      expect(el.shadowRoot!.querySelector('[role="combobox"]')!.localName).to.equal(closedMode ? 'button' : 'input');
      const property = attribute === 'error-text' ? 'errorText' : attribute;
      el.setAttribute(attribute, 'Original copy');
      await el.updateComplete;
      expect(el[property]).to.equal('Original copy');
      el.removeAttribute(attribute);
      await el.updateComplete;
      expect(el[property]).to.equal(null);
      expect(el.shadowRoot!.textContent!.includes('Original copy')).to.equal(false);
      el.setAttribute(attribute, '');
      await el.updateComplete;
      expect(el[property]).to.equal('');
      el.setAttribute(attribute, 'Restored copy');
      await el.updateComplete;
      expect(el[property]).to.equal('Restored copy');
      expect(el.shadowRoot!.textContent!.includes('Restored copy')).to.equal(true);
    });
  }
}

const press = (control: Element, key: string): void => {
  control.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
};
const activeRowVisible = (el: LyraVoicePicker): boolean => {
  const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!.getBoundingClientRect();
  const row = el.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-active]')?.getBoundingClientRect();
  return !!row && row.top >= listbox.top - 1 && row.bottom <= listbox.bottom + 1;
};

it('keeps the keyboard-active row visible and reopens on the committed row', async () => {
  const catalog = Array.from({ length: 20 }, (_, i) => ({ id: `v${i}`, label: `Voice ${i}`, description: 'Calm' }));
  const el = await fixture<LyraVoicePicker>(html`<lr-voice-picker .catalog=${catalog}></lr-voice-picker>`);
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]')!;
  press(trigger, 'ArrowDown');
  await el.updateComplete;
  press(trigger, 'End');
  await el.updateComplete;
  await waitUntil(() => activeRowVisible(el), 'End leaves the active row outside the listbox');
  press(trigger, 'Enter');
  await el.updateComplete;
  expect(el.value).to.equal('v19');
  press(trigger, 'ArrowDown');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector<HTMLElement>('[data-active]')?.dataset['value']).to.equal('v19');
  await waitUntil(() => activeRowVisible(el), 'reopening does not reveal the committed row');
});

it('keeps a playing preview when the same catalog array is bound again', async () => {
  const proto = HTMLMediaElement.prototype;
  const play = proto.play;
  proto.play = () => Promise.resolve();
  try {
    const catalog = [{ id: 'aria', label: 'Aria', previewUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZF' }];
    const el = await fixture<LyraVoicePicker>(html`<lr-voice-picker .catalog=${catalog} value="aria"></lr-voice-picker>`);
    const started = oneEvent(el, 'lr-preview-change');
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="preview-button"]')!.click();
    expect((await started).detail).to.deep.equal({ voiceId: 'aria' });
    let stopped = false;
    el.addEventListener('lr-preview-change', () => (stopped = true));
    el.catalog = catalog;
    await el.updateComplete;
    expect(stopped).to.be.false;
    const preview = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="preview-button"]')!;
    expect(preview.getAttribute('aria-label')).to.equal('Stop preview');
    expect(preview.hasAttribute('aria-pressed')).to.be.false;
  } finally {
    proto.play = play;
  }
});

it('rebases an open free-text draft when the controlled value changes', async () => {
  const el = await fixture<LyraVoicePicker>(html`<lr-voice-picker
    allow-custom value="aria" .catalog=${[{ id: 'aria', label: 'Aria' }, { id: 'sage', label: 'Sage' }]}
  ></lr-voice-picker>`);
  const field = el.shadowRoot!.querySelector<HTMLInputElement>('[part="combobox-input"]')!;
  field.focus();
  field.value = 'obsolete draft';
  field.dispatchEvent(new Event('input'));
  await el.updateComplete;
  el.value = 'sage';
  await el.updateComplete;
  expect(field.value).to.equal('Sage');
});

it('omits blank-id catalog rows', async () => {
  const el = await fixture<LyraVoicePicker>(html`<lr-voice-picker
    .catalog=${[{ id: 'aria', label: 'Aria' }, '   ', { id: '', label: 'Ghost' }]}
  ></lr-voice-picker>`);
  el.open = true;
  await el.updateComplete;
  const values = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]')].map((row) => row.dataset['value']);
  expect(values).to.deep.equal(['aria']);
});
