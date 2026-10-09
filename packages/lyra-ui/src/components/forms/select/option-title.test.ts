import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './select.js';
import '../combobox/combobox.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';
import type { LyraCombobox } from '../combobox/combobox.js';
import type { LyraOption } from '../combobox/option.js';

for (const kind of ['select', 'combobox'] as const) {
  describe(`${kind} option title`, () => {
    const make = (multiple: boolean) =>
      fixture<LyraSelect | LyraCombobox>(
        kind === 'select'
          ? html`<lr-select label="Choice" open ?multiple=${multiple} .value=${multiple ? ['a'] : 'a'}>
              <lr-option value="a" title="Alpha tip">Alpha</lr-option>
              <lr-option value="b">Beta</lr-option>
            </lr-select>`
          : html`<lr-combobox label="Choice" open ?multiple=${multiple} .value=${multiple ? ['a'] : 'a'}>
              <lr-option value="a" title="Alpha tip">Alpha</lr-option>
              <lr-option value="b">Beta</lr-option>
            </lr-combobox>`
      );
    const rows = (control: Element) =>
      Array.from(control.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]'));

    it('forwards the option title to its row without changing the name, and omits it when unset', async () => {
      const control = await make(false);
      await waitUntil(() => rows(control).length === 2);
      const [alpha, beta] = rows(control);
      expect(alpha!.getAttribute('title')).to.equal('Alpha tip');
      expect(alpha!.hasAttribute('aria-label')).to.equal(false);
      expect(alpha!.textContent).to.contain('Alpha');
      expect(beta!.hasAttribute('title')).to.equal(false);
    });

    it('updates the row when the option title changes', async () => {
      const control = await make(false);
      await waitUntil(() => rows(control).length === 2);
      const option = control.querySelector('lr-option[value="a"]') as LyraOption;
      option.title = 'Changed';
      await waitUntil(() => rows(control)[0]!.getAttribute('title') === 'Changed');
      option.title = '';
      await waitUntil(() => !rows(control)[0]!.hasAttribute('title'));
    });

    it('forwards the option title to the multiple-mode tag', async () => {
      const control = await make(true);
      await waitUntil(() => control.shadowRoot!.querySelector('[part~="tag"]') !== null);
      expect(control.shadowRoot!.querySelector('[part~="tag"]')!.getAttribute('title')).to.equal('Alpha tip');
    });
  });
}
