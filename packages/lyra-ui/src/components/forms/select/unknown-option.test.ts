import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './select.js';
import '../combobox/combobox.js';
import type { LyraSelect } from './select.js';
import type { LyraCombobox } from '../combobox/combobox.js';

const rows = (el: LyraSelect | LyraCombobox): HTMLElement[] =>
  Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="option"]'));

const unknownRows = (el: LyraSelect | LyraCombobox): HTMLElement[] =>
  rows(el).filter((row) => row.hasAttribute('data-unknown-value'));

const buildSelect = (attrs: string) =>
  fixture<LyraSelect>(`<lr-select ${attrs}>
    <lr-option value="a">Alpha</lr-option>
    <lr-option value="b">Bravo</lr-option>
  </lr-select>`);

describe('lr-select out-of-list value', () => {
  it('renders no synthetic row until the policy is opted into', async () => {
    const el = await buildSelect('value="ghost" open');
    await el.updateComplete;
    expect(el.value).to.equal('ghost');
    expect(rows(el).length).to.equal(2, 'only the authored options render');
    expect(unknownRows(el).length).to.equal(0);
  });

  it('appends the committed unmatched value as a badged synthetic row', async () => {
    const el = await buildSelect('value="ghost" open show-unknown-option');
    await el.updateComplete;
    expect(rows(el).length).to.equal(3);
    const synthetic = unknownRows(el);
    expect(synthetic.length).to.equal(1);
    expect(synthetic[0]!.getAttribute('data-value')).to.equal('ghost');
    expect(synthetic[0]!.getAttribute('aria-selected')).to.equal('true');
    expect(
      synthetic[0]!.querySelector('[part~="option-badge"]')?.textContent?.trim()
    ).to.equal('not in catalog');
  });

  it('drops the synthetic row once an option claims the value', async () => {
    const el = await buildSelect('value="ghost" open show-unknown-option');
    await el.updateComplete;
    expect(unknownRows(el).length).to.equal(1);
    el.value = 'a';
    await el.updateComplete;
    expect(unknownRows(el).length).to.equal(0);
    expect(rows(el).length).to.equal(2);
  });

  it('is re-selectable by pointer, committing the same value again', async () => {
    const el = await buildSelect('value="ghost" open show-unknown-option');
    await el.updateComplete;
    const activations: string[] = [];
    el.addEventListener('lr-activate', (event) => {
      activations.push((event as CustomEvent<{ value: string }>).detail.value);
    });
    unknownRows(el)[0]!.click();
    await el.updateComplete;
    expect(activations).to.deep.equal(['ghost']);
    expect(el.value).to.equal('ghost');
  });

  it('is reachable by keyboard from the actually focused trigger', async () => {
    const el = await buildSelect('value="ghost" show-unknown-option');
    await el.updateComplete;
    const trigger = el.shadowRoot!.querySelector<HTMLElement>('[part~="trigger"]')!;
    trigger.focus();
    const press = (key: string): void => {
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, composed: true })
      );
    };
    press('ArrowDown');
    await waitUntil(() => el.open, 'ArrowDown opens the listbox');
    press('End');
    await el.updateComplete;
    const active = el.shadowRoot!.querySelector<HTMLElement>('[part~="option"][data-active]');
    expect(active === null).to.equal(false, 'End lands on a row');
    expect(active!.getAttribute('data-value')).to.equal(
      'ghost',
      'the synthetic row is the last navigable row'
    );
  });

  it('toggles a multi-select unknown value off without duplicating it', async () => {
    const el = await buildSelect('multiple open show-unknown-option');
    el.value = ['a', 'ghost'];
    await el.updateComplete;
    expect(unknownRows(el).length).to.equal(1);
    unknownRows(el)[0]!.click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(['a']);
    expect(unknownRows(el).length).to.equal(0, 'the row goes with the value');
  });

  it('routes an unmatched value through the public label override', async () => {
    const el = await buildSelect('value="ghost" open show-unknown-option');
    el.getUnknownLabel = (value) => `Saved: ${value}`;
    await el.updateComplete;
    expect(unknownRows(el)[0]!.textContent).to.contain('Saved: ghost');
    const triggerLabel = el.shadowRoot!.querySelector<HTMLElement>(
      '[part~="trigger-label"], [part~="display"], [part~="trigger"]'
    )!;
    expect(triggerLabel.textContent).to.contain('Saved: ghost');
  });

  it('leaves a matched option untouched by the label override', async () => {
    const el = await buildSelect('value="a" open show-unknown-option');
    el.getUnknownLabel = () => 'SHOULD NOT APPEAR';
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.not.contain('SHOULD NOT APPEAR');
  });

  it('localizes the badge through a .strings override', async () => {
    const el = await fixture<LyraSelect>(html`<lr-select
      value="ghost"
      open
      show-unknown-option
      .strings=${{ notInCatalog: 'hors catalogue' }}
    >
      <lr-option value="a">Alpha</lr-option>
    </lr-select>`);
    await el.updateComplete;
    expect(
      unknownRows(el)[0]!.querySelector('[part~="option-badge"]')?.textContent?.trim()
    ).to.equal('hors catalogue');
  });

  it('passes an accessibility audit with the synthetic row showing', async () => {
    const el = await buildSelect('label="Pick" value="ghost" open show-unknown-option');
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('lr-combobox out-of-list value', () => {
  const buildCombobox = (attrs: string) =>
    fixture<LyraCombobox>(`<lr-combobox ${attrs}>
      <lr-option value="a">Alpha</lr-option>
      <lr-option value="b">Bravo</lr-option>
    </lr-combobox>`);

  it('renders no synthetic row until the policy is opted into', async () => {
    const el = await buildCombobox('value="ghost" open');
    await el.updateComplete;
    expect(unknownRows(el).length).to.equal(0);
    expect(rows(el).length).to.equal(2);
  });

  it('appends the committed unmatched value as a badged synthetic row', async () => {
    const el = await buildCombobox('value="ghost" open show-unknown-option');
    await el.updateComplete;
    const synthetic = unknownRows(el);
    expect(synthetic.length).to.equal(1);
    expect(synthetic[0]!.getAttribute('data-value')).to.equal('ghost');
    expect(
      synthetic[0]!.querySelector('[part~="option-badge"]')?.textContent?.trim()
    ).to.equal('not in catalog');
  });

  it('is re-selectable and drops out once an option claims the value', async () => {
    const el = await buildCombobox('value="ghost" open show-unknown-option');
    await el.updateComplete;
    unknownRows(el)[0]!.click();
    await el.updateComplete;
    expect(el.value).to.equal('ghost');
    el.value = 'a';
    await el.updateComplete;
    expect(unknownRows(el).length).to.equal(0);
  });

  it('routes an unmatched value through the public label override', async () => {
    const el = await buildCombobox('value="ghost" open show-unknown-option');
    el.getUnknownLabel = (value) => `Saved: ${value}`;
    await el.updateComplete;
    expect(unknownRows(el)[0]!.textContent).to.contain('Saved: ghost');
  });

  it('keeps the unknown badge and the row after the synthetic row is re-picked', async () => {
    const el = await buildCombobox('value="ghost" open show-unknown-option');
    await el.updateComplete;
    const badgeMissing = (): boolean =>
      el.shadowRoot!.querySelector('[part~="unknown-value"]') === null;
    expect(unknownRows(el).length).to.equal(1);
    unknownRows(el)[0]!.click();
    await waitUntil(() => !el.open, 'picking a row closes the single-select listbox');
    await el.updateComplete;
    expect(el.value).to.equal('ghost');
    expect(badgeMissing()).to.equal(
      false,
      'the re-pick must not launder an unmatched value into a known one'
    );
    el.open = true;
    await el.updateComplete;
    expect(unknownRows(el).length).to.equal(1, 'the synthetic row is still offered');
  });

  it('never reports a synthetic row through the public selectedRows', async () => {
    const el = await buildCombobox('value="ghost" open show-unknown-option');
    await el.updateComplete;
    unknownRows(el)[0]!.click();
    await waitUntil(() => !el.open, 'picking a row closes the single-select listbox');
    expect(el.selectedRows.length).to.equal(
      0,
      'a row this component invented is not a row the consumer can read back'
    );
  });

  it('filters the synthetic row by the active query and restores the empty copy', async () => {
    const el = await buildCombobox('value="ghost" open show-unknown-option');
    await el.updateComplete;
    expect(unknownRows(el).length).to.equal(1, 'an empty query keeps the row');
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="combobox-input"]')!;
    input.value = 'zzz';
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, composed: true, data: 'zzz', inputType: 'insertText' })
    );
    await el.updateComplete;
    expect(unknownRows(el).length).to.equal(0, 'a query it does not match drops the row');
    expect(el.shadowRoot!.querySelector('.empty') === null).to.equal(
      false,
      'the no-matches copy can render again'
    );
    input.value = 'gho';
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, composed: true, data: 'o', inputType: 'insertText' })
    );
    await el.updateComplete;
    expect(unknownRows(el).length).to.equal(1, 'a matching query brings it back');
  });

  it('keeps the synthetic row alongside an async source', async () => {
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox source-delay="0" open show-unknown-option value="ghost"></lr-combobox>`
    );
    el.source = async () => [{ value: 'a', label: 'Alpha' }];
    await waitUntil(() => rows(el).length >= 2, 'the async rows arrive');
    await aTimeout(10);
    expect(unknownRows(el).length).to.equal(1, 'the committed unknown value keeps its row');
  });
});
