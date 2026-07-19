import { expect, fixture, html } from '@open-wc/testing';
import './control-group.js';
import '../../forms/button/button.js';
import '../../forms/select/select.js';
import type { LyraControlGroup } from './control-group.class.js';

describe('<lr-control-group>', () => {
  it('groups mixed slotted controls and forwards its accessible name', async () => {
    const el = await fixture<LyraControlGroup>(html`
      <lr-control-group aria-label="Chart toolbar">
        <lr-select size="s"></lr-select>
        <lr-button size="s">Export</lr-button>
      </lr-control-group>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('Chart toolbar');
  });

  it('prefers the label prop over a forwarded host aria-label', async () => {
    const el = await fixture<LyraControlGroup>(html`
      <lr-control-group label="Toolbar" aria-label="Ignored">
        <lr-button>Open</lr-button>
      </lr-control-group>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('aria-label')).to.equal('Toolbar');
  });

  it('is accessible', async () => {
    const el = await fixture<LyraControlGroup>(html`
      <lr-control-group label="Actions"><lr-button>Open</lr-button></lr-control-group>
    `);
    await expect(el).to.be.accessible();
  });

  it('honors an overridden --lr-control-group-gap custom property', async () => {
    const el = await fixture<LyraControlGroup>(html`
      <lr-control-group style="--lr-control-group-gap: 24px;">
        <lr-button>Open</lr-button>
        <lr-button>Save</lr-button>
      </lr-control-group>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).gap).to.equal('24px');
  });

  it('centers children of differing intrinsic height instead of stretching them (unlike lr-button-group)', async () => {
    const el = await fixture<LyraControlGroup>(html`
      <lr-control-group>
        <lr-select size="l"></lr-select>
        <lr-button size="xs">Export</lr-button>
      </lr-control-group>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).alignItems).to.equal('center');
  });

  it('wraps onto multiple lines instead of overflowing a narrow allocation', async () => {
    const el = await fixture<LyraControlGroup>(html`
      <lr-control-group style="inline-size: 120px;">
        <lr-button>Open</lr-button>
        <lr-button>Save</lr-button>
        <lr-button>Share</lr-button>
      </lr-control-group>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).flexWrap).to.equal('wrap');
  });
});
