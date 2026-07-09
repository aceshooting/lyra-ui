import { expect } from '@open-wc/testing';
import './lyra.js';

it('registers every component', () => {
  const tags = [
    'sparkline',
    'toast',
    'toast-item',
    'combobox',
    'option',
    'date-picker',
    'date-input',
    'flag',
  ];
  for (const t of tags) {
    expect(customElements.get(`lyra-${t}`), `lyra-${t}`).to.exist;
  }
});
