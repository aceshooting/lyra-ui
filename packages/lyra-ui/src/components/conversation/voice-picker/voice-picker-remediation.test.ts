import { expect, fixture, html } from '@open-wc/testing';
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
