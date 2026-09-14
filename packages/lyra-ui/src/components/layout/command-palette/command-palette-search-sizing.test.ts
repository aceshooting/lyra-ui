import { expect, fixture, html } from '@open-wc/testing';
import './command-palette.js';
import type { LyraCommand, LyraCommandPalette } from './command-palette.js';

const COMMANDS: LyraCommand[] = [
  { commandId: 'open', label: 'Open file' },
  { commandId: 'save', label: 'Save file' },
];

function resolveInShadow(
  el: HTMLElement,
  declarations: readonly (readonly [string, string])[]
): Record<string, string> {
  const probe = document.createElement('div');
  for (const [property, value] of declarations) {
    probe.style.setProperty(property, value);
  }
  el.shadowRoot!.append(probe);
  const computed = getComputedStyle(probe);
  const resolved: Record<string, string> = {};
  for (const [property] of declarations) {
    resolved[property] = computed.getPropertyValue(property);
  }
  probe.remove();
  return resolved;
}

async function openPalette(): Promise<LyraCommandPalette> {
  const el = (await fixture(
    html`<lr-command-palette .commands=${COMMANDS}></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  return el;
}

function queryField(el: LyraCommandPalette): HTMLInputElement {
  return el.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;
}

function searchRow(el: LyraCommandPalette): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part="search"]')!;
}

describe('lr-command-palette query-field sizing', () => {
  it('renders the query row on exactly its pre-hook geometry when no hook is set', async () => {
    const el = await openPalette();
    const expected = resolveInShadow(el, [
      ['padding-inline-start', 'var(--lr-space-m)'],
      ['column-gap', 'var(--lr-space-s)'],
    ]);
    const row = getComputedStyle(searchRow(el));
    const field = getComputedStyle(queryField(el));

    expect(row.getPropertyValue('padding-inline-start')).to.equal(
      expected['padding-inline-start']
    );
    expect(row.getPropertyValue('column-gap')).to.equal(
      expected['column-gap']
    );
    // Unset hooks must leave the field at its shipped auto height and inherited text size.
    expect(field.getPropertyValue('min-block-size')).to.equal('auto');
    expect(field.getPropertyValue('font-size')).to.equal(
      row.getPropertyValue('font-size')
    );
  });

  it('sizes the query field and its row through --lr-command-palette-search-*', async () => {
    const el = await openPalette();
    el.style.setProperty('--lr-command-palette-search-min-height', '37px');
    el.style.setProperty('--lr-command-palette-search-font-size', '13px');
    el.style.setProperty('--lr-command-palette-search-padding', '41px');
    el.style.setProperty('--lr-command-palette-search-gap', '7px');
    await el.updateComplete;

    const row = getComputedStyle(searchRow(el));
    const field = getComputedStyle(queryField(el));
    expect(field.getPropertyValue('min-block-size')).to.equal('37px');
    expect(field.getPropertyValue('font-size')).to.equal('13px');
    expect(row.getPropertyValue('padding-inline-start')).to.equal('41px');
    expect(row.getPropertyValue('column-gap')).to.equal('7px');
  });

  it('keeps the sized query row accessible with commands rendered', async () => {
    const el = await openPalette();
    el.style.setProperty('--lr-command-palette-search-min-height', '48px');
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
