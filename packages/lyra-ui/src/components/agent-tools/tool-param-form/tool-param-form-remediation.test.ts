import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './tool-param-form.js';
import type { LyraToolParamForm } from './tool-param-form.js';
import type { LyraSelect } from '../../forms/select/select.js';

for (const key of ['enabled', '__proto__']) {
  for (const defaultValue of [true, false]) {
    it(`keeps explicit ${key} Boolean Unset distinct from the ${defaultValue} schema default`, async () => {
      const schema = { type: 'object' as const, properties: { [key]: { type: 'boolean' as const, default: defaultValue } } };
      const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`);
      expect(el.effectiveValue[key]).to.equal(defaultValue);
      const select = el.shadowRoot!.querySelector<LyraSelect>('lr-select')!;
      select.value = '';
      const changed = oneEvent(el, 'lr-input');
      select.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true }));
      const event = await changed;
      await el.updateComplete;
      await select.updateComplete;
      expect(Object.hasOwn(el.value, key)).to.equal(true);
      expect(Object.hasOwn(el.effectiveValue, key)).to.equal(true);
      expect(el.effectiveValue[key]).to.equal(undefined);
      expect(Object.hasOwn(event.detail.value, key)).to.equal(true);
      expect(event.detail.value[key]).to.equal(undefined);
      expect(select.value).to.equal('');
      el.value = {};
      await el.updateComplete;
      expect(el.effectiveValue[key]).to.equal(defaultValue);
    });
  }
}
