import { expect } from '@open-wc/testing';
import './dashboard-grid-register.js';

describe('dashboard-grid lean registration entry', () => {
  it('registers the grid and its empty state without the widget stack', () => {
    expect(customElements.get('lr-dashboard-grid')).to.not.equal(undefined);
    expect(customElements.get('lr-empty')).to.not.equal(undefined);
    expect(customElements.get('lr-widget')).to.equal(undefined);
    expect(customElements.get('lr-widget-renderer')).to.equal(undefined);
  });
});
