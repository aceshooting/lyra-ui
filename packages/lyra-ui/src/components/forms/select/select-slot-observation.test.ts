import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './select.js';
import type { LyraSelect } from './select.js';

const unknownBadgeCount = (select: LyraSelect): number =>
  select.shadowRoot?.querySelectorAll('[part="unknown-value"]').length ?? 0;

const unknownRowCount = (select: LyraSelect): number =>
  select.shadowRoot?.querySelectorAll('[part="option"][data-unknown-value]').length ?? 0;

describe('lr-select observed option catalog', () => {
  it('retains the raw code without an invented unknown verdict on the first render', async () => {
    const select = document.createElement('lr-select');
    select.value = 'USD';
    select.innerHTML = '<lr-option value="EUR">Euro</lr-option><lr-option value="USD">US dollar</lr-option>';
    const phases: { badgeCount: number; display: string }[] = [];
    select.addController({ hostUpdated: () => phases.push({
      badgeCount: unknownBadgeCount(select),
      display: select.shadowRoot?.querySelector('[part="display-input"]')?.textContent?.trim() ?? '',
    }) });
    await fixture(html`${select}`);
    await waitUntil(() => select.shadowRoot?.querySelector('[part="display-input"]')?.textContent?.trim() === 'US dollar');
    expect(phases.length).to.be.greaterThan(1);
    expect(phases[0]!.badgeCount).to.equal(0);
    expect(phases[0]!.display).to.equal('USD');
    expect(unknownBadgeCount(select)).to.equal(0);
    expect(select.value).to.equal('USD');
  });

  it('treats an observed empty slot as authoritative without calling an unknown-label hook early', async () => {
    const select = document.createElement('lr-select');
    select.value = 'ZZZ';
    select.withUnknownOption = true;
    let labelCalls = 0;
    select.getUnknownLabel = (value) => { labelCalls++; return `Saved ${value}`; };
    const phases: { badgeCount: number; labelCalls: number; display: string }[] = [];
    select.addController({ hostUpdated: () => phases.push({
      badgeCount: unknownBadgeCount(select), labelCalls,
      display: select.shadowRoot?.querySelector('[part="display-input"]')?.textContent?.trim() ?? '',
    }) });
    await fixture(html`${select}`);
    await waitUntil(() => unknownBadgeCount(select) === 1 && unknownRowCount(select) === 1);
    expect(phases[0]!.badgeCount).to.equal(0);
    expect(phases[0]!.labelCalls).to.equal(0);
    expect(phases[0]!.display).to.equal('ZZZ');
    expect(labelCalls).to.be.greaterThan(0);
    expect(select.shadowRoot?.querySelector('[part="display-input"]')?.textContent).to.contain('Saved ZZZ');
    expect(select.value).to.equal('ZZZ');
  });

  it('preserves later declarative defaults through reset and reconnect after an empty observation', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-select name="currency"></lr-select></form>`);
    const select = form.querySelector<LyraSelect>('lr-select')!;
    await select.updateComplete;
    select.innerHTML = '<lr-option value="EUR" selected>Euro</lr-option><lr-option value="USD">US dollar</lr-option>';
    await waitUntil(() => select.value === 'EUR');
    select.value = 'USD';
    form.reset();
    await waitUntil(() => select.value === 'EUR');
    select.remove();
    form.append(select);
    await select.updateComplete;
    expect([...new FormData(form).entries()]).to.deep.equal([['currency', 'EUR']]);
    expect(unknownBadgeCount(select)).to.equal(0);
  });

  it('keeps genuine removed-option feedback and synthetic rows while loading suppresses them', async () => {
    const select = await fixture<LyraSelect>(html`<lr-select value="USD" with-unknown-option>
      <lr-option value="USD">US dollar</lr-option>
    </lr-select>`);
    await waitUntil(() => select.selectedOptions.length === 1);
    select.querySelector('lr-option')!.remove();
    await waitUntil(() => unknownBadgeCount(select) === 1 && unknownRowCount(select) === 1);
    select.loading = true;
    await select.updateComplete;
    expect(unknownBadgeCount(select)).to.equal(0);
    expect(unknownRowCount(select)).to.equal(0);
    expect(select.value).to.equal('USD');
    select.loading = false;
    await select.updateComplete;
    expect(unknownBadgeCount(select)).to.equal(1);
    select.innerHTML = '<lr-option value="USD">Restored dollar</lr-option>';
    await waitUntil(() => unknownBadgeCount(select) === 0);
    expect(select.value).to.equal('USD');
  });

  it('preserves multiple unmatched values after observed catalog removal', async () => {
    const select = await fixture<LyraSelect>(html`<lr-select .multiple=${true} .value=${['EUR', 'ZZZ']} with-unknown-option>
      <lr-option value="EUR">Euro</lr-option>
    </lr-select>`);
    await waitUntil(() => unknownBadgeCount(select) === 1);
    select.querySelector('lr-option')!.remove();
    await waitUntil(() => unknownBadgeCount(select) === 2 && unknownRowCount(select) === 2);
    select.loading = true;
    await select.updateComplete;
    expect(unknownBadgeCount(select)).to.equal(0);
    expect(unknownRowCount(select)).to.equal(0);
    expect(select.value).to.deep.equal(['EUR', 'ZZZ']);
    select.loading = false;
    await select.updateComplete;
    expect(unknownBadgeCount(select)).to.equal(2);
  });
});
