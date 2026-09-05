import { expect, fixture, html } from '@open-wc/testing';
import './tool-call-chip.js';
import type { LyraToolCallChip } from './tool-call-chip.js';

describe('lr-tool-call-chip removed copy', () => {
  for (const attribute of ['category', 'summary'] as const) {
    it(`clears removed ${attribute} and preserves later and explicit-empty values`, async () => {
      const el = await fixture<LyraToolCallChip>(html`<lr-tool-call-chip name="Tool" category="Group" summary="Result"></lr-tool-call-chip>`);
      el.removeAttribute(attribute);
      await el.updateComplete;
      expect(el[attribute]).to.equal(null);
      const part = el.shadowRoot!.querySelector(`[part="${attribute}"]`)!;
      expect(part.hasAttribute('hidden')).to.equal(true);
      el.setAttribute(attribute, '');
      await el.updateComplete;
      expect(el[attribute]).to.equal('');
      expect(part.hasAttribute('hidden')).to.equal(true);
      el.setAttribute(attribute, 'Restored');
      await el.updateComplete;
      expect(part.hasAttribute('hidden')).to.equal(false);
      expect(part.textContent).to.equal('Restored');
    });
  }
});
