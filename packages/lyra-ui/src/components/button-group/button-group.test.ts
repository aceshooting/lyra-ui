import { expect, fixture, html } from '@open-wc/testing';
import './button-group.js';
import '../button/button.js';
import type { LyraButtonGroup } from './button-group.class.js';

describe('<lyra-button-group>', () => {
  it('groups slotted actions and forwards its accessible name', async () => {
    const el = await fixture<LyraButtonGroup>(html`
      <lyra-button-group aria-label="View actions">
        <lyra-button>Open</lyra-button>
        <lyra-button>Save</lyra-button>
      </lyra-button-group>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('View actions');
  });

  it('is accessible', async () => {
    const el = await fixture<LyraButtonGroup>(html`<lyra-button-group label="Actions"><lyra-button>Open</lyra-button></lyra-button-group>`);
    await expect(el).to.be.accessible();
  });
});
