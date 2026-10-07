import { expect } from '@open-wc/testing';
import './combobox-catalog.js';

describe('catalog combobox registration', () => {
  it('retains combobox and its empty-state component without registering options', () => {
    expect(typeof customElements.get('lr-combobox')).to.equal('function');
    expect(typeof customElements.get('lr-empty')).to.equal('function');
    expect(customElements.get('lr-option') === undefined).to.equal(true);
    const fetchedModules = performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname);
    expect(fetchedModules.some(name => /\/option\.class\.(?:ts|js)$/u.test(name))).to.equal(false);
  });
});
