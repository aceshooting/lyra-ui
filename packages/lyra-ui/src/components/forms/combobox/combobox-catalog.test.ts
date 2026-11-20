import { expect } from '@open-wc/testing';
import './combobox-catalog.js';
import { fetchedModule } from '../../../../test/resource-entries.js';

describe('catalog combobox registration', () => {
  it('retains combobox and its empty-state component without registering options', () => {
    expect(typeof customElements.get('lr-combobox')).to.equal('function');
    expect(typeof customElements.get('lr-empty')).to.equal('function');
    expect(customElements.get('lr-option') === undefined).to.equal(true);
    expect(fetchedModule(/\/option\.class\.(?:ts|js)$/u, { control: '/combobox-catalog.ts' })).to.equal(false);
  });
});
