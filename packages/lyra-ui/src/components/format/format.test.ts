import { fixture, expect, html } from '@open-wc/testing';
import './format-number.js';
import './format-date.js';
import './format-bytes.js';
import './relative-time.js';

it('formats numbers and bytes through Intl', async () => {
  const el = await fixture(html`<div><lyra-format-number value="1234.5"></lyra-format-number><lyra-format-bytes value="1024"></lyra-format-bytes></div>`);
  expect(el.querySelector('lyra-format-number')?.shadowRoot?.textContent).to.contain('1,234.5');
  expect(el.querySelector('lyra-format-bytes')?.shadowRoot?.textContent).to.match(/1\s?kB/i);
});

it('formats dates and relative time', async () => {
  const el = await fixture(html`<div>
    <lyra-format-date date="2024-01-01T00:00:00Z" locale="en-US"></lyra-format-date>
    <lyra-relative-time date="2030-01-01T00:00:00Z" locale="en-US"></lyra-relative-time>
  </div>`);
  expect(el.querySelector('lyra-format-date')?.shadowRoot?.textContent).to.contain('January');
  expect(el.querySelector('lyra-relative-time')?.shadowRoot?.textContent).to.contain('in');
});
