import { expect, fixture, html } from '@open-wc/testing';
import { labelWithVisibleText, normalizeLabel, resolveAccessibleName } from './accessible-name.js';

describe('accessible name helpers', () => {
  it('treats blank, whitespace and non-string values as absent', () => {
    for (const value of ['', '   ', '\n\t', undefined, null, 3, {}, []]) {
      expect(normalizeLabel(value), String(value)).to.equal(undefined);
    }
    expect(normalizeLabel('  Save  ')).to.equal('Save');
  });

  it('prefers the host aria-label, then the first usable candidate', async () => {
    const plain = await fixture<HTMLElement>(html`<div></div>`);
    expect(resolveAccessibleName(plain, '  ', undefined, ' Search ', 'Default')).to.equal('Search');
    expect(resolveAccessibleName(plain, '', null)).to.equal(undefined);
    const named = await fixture<HTMLElement>(html`<div aria-label=" Run 42 "></div>`);
    expect(resolveAccessibleName(named, 'Default')).to.equal('Run 42');
    const empty = await fixture<HTMLElement>(html`<div aria-label=""></div>`);
    expect(resolveAccessibleName(empty, 'Default')).to.equal('Default');
  });

  it('keeps the visible text inside the name', () => {
    expect(labelWithVisibleText('Modified', 'src/app.ts')).to.equal('Modified src/app.ts');
    expect(labelWithVisibleText('  Add  ')).to.equal('Add');
    expect(labelWithVisibleText('', 'Context')).to.equal('Context');
    expect(labelWithVisibleText('', '')).to.equal('');
  });
});
