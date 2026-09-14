import { expect, fixture } from '@open-wc/testing';
import { normalizeCatalog, withSyntheticCatalogValue } from './catalog-picker.js';
import '../components/conversation/model-select/model-select.js';
import '../components/conversation/voice-picker/voice-picker.js';
import type { LyraModelSelect } from '../components/conversation/model-select/model-select.js';
import type { LyraVoicePicker } from '../components/conversation/voice-picker/voice-picker.js';

type CatalogPickerElement = LyraModelSelect | LyraVoicePicker;

async function catalogPicker(tag: string, markup = ''): Promise<CatalogPickerElement> {
  const el = (await fixture(`<${tag} ${markup}></${tag}>`)) as CatalogPickerElement;
  el.catalog = ['alpha', 'beta'];
  await el.updateComplete;
  return el;
}

function optionRows(el: CatalogPickerElement): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="option"]')];
}

/**
 * `<lr-select>`/`<lr-combobox>` were corrected so `''` is a candidate option value rather than an
 * implicit "clear". The catalog family's answer to the same question is deliberately the opposite,
 * and it is pinned here so the next sweep reads a test instead of re-deriving it: a catalog row's
 * `id` is required to be a nonblank string, so `''` is never a selectable identity and stays the
 * family's "nothing committed" sentinel. Characterization tests for a documented contract, not
 * regression tests for a fixed defect.
 */
describe('catalog-picker empty-value contract', () => {
  it('rejects blank ids at the catalog boundary, so no row can ever be empty-valued', () => {
    const rows = normalizeCatalog([
      { id: '', label: 'Blank' },
      { id: '   ', label: 'Whitespace' },
      { id: 'alpha', label: 'Alpha' },
      { id: 'beta', label: '   ' },
    ]);
    expect(rows.map((row) => row.id)).to.deep.equal(['alpha']);
  });

  it('never appends a synthetic row for an empty or blank committed value', () => {
    const catalog = [{ id: 'alpha', label: 'Alpha' }];
    expect(withSyntheticCatalogValue(catalog, '').map((row) => row.id)).to.deep.equal(['alpha']);
    expect(withSyntheticCatalogValue(catalog, '   ').map((row) => row.id)).to.deep.equal(['alpha']);
    expect(
      withSyntheticCatalogValue(catalog, 'zeta').map((row) => [row.id, row.synthetic]),
    ).to.deep.equal([
      ['alpha', false],
      ['zeta', true],
    ]);
  });

  for (const tag of ['lr-model-select', 'lr-voice-picker']) {
    it(`${tag} treats an empty value as no selection, with no badged row`, async () => {
      const el = await catalogPicker(tag, 'placeholder="Pick one"');
      el.open = true;
      await el.updateComplete;
      expect(el.value).to.equal('');
      const rows = optionRows(el);
      expect(rows.map((row) => row.dataset['value'])).to.deep.equal(['alpha', 'beta']);
      expect(rows.some((row) => row.getAttribute('aria-selected') === 'true')).to.equal(
        false,
        'an empty value selects nothing',
      );
      expect(el.shadowRoot!.querySelector('[part~="option-badge"]') === null).to.equal(
        true,
        'an empty value is not an unknown value, so it is never badged',
      );
      expect(el.shadowRoot!.querySelector<HTMLElement>('.trigger-label')!.textContent!.trim()).to.equal(
        'Pick one',
      );
    });

    it(`${tag} clears back to no selection when an empty string is assigned after a real pick`, async () => {
      const el = await catalogPicker(tag);
      el.value = 'beta';
      el.open = true;
      await el.updateComplete;
      expect(
        optionRows(el)
          .filter((row) => row.getAttribute('aria-selected') === 'true')
          .map((row) => row.dataset['value']),
      ).to.deep.equal(['beta']);

      el.value = '';
      await el.updateComplete;
      expect(el.value).to.equal('');
      const rows = optionRows(el);
      expect(rows.map((row) => row.dataset['value'])).to.deep.equal(['alpha', 'beta']);
      expect(rows.some((row) => row.getAttribute('aria-selected') === 'true')).to.equal(false);
      expect(el.shadowRoot!.querySelector('[part~="option-badge"]') === null).to.equal(true);
    });

    it(`${tag} still badges a genuinely unknown committed value`, async () => {
      const el = await catalogPicker(tag);
      el.value = 'retired-id';
      el.open = true;
      await el.updateComplete;
      const rows = optionRows(el);
      expect(rows.map((row) => row.dataset['value'])).to.deep.equal(['alpha', 'beta', 'retired-id']);
      const badge = el.shadowRoot!.querySelector<HTMLElement>('[part~="option-badge"]');
      expect(badge === null).to.equal(false, 'a stale value keeps its explanatory badge');
      expect(badge!.textContent!.trim().length > 0).to.equal(true);
    });
  }
});
