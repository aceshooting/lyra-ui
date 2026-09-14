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

  it('lets a forwarded host aria-label override the label prop', async () => {
    const el = await fixture<LyraControlGroup>(html`
      <lr-control-group label="Toolbar" aria-label="Author toolbar">
        <lr-button>Open</lr-button>
      </lr-control-group>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('aria-label')).to.equal('Author toolbar');
  });

  it('preserves an explicitly empty host aria-label over the label prop', async () => {
    const el = await fixture<LyraControlGroup>(html`
      <lr-control-group label="Toolbar" aria-label="">
        <lr-button>Open</lr-button>
      </lr-control-group>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute('aria-label')).to.equal(true);
    expect(base.getAttribute('aria-label')).to.equal('');

    el.removeAttribute('aria-label');
    await el.updateComplete;
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

  it('does not collapse to 0 width by default inside a shrink-to-fit flex row', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div style="display:flex;">
        <lr-control-group>
          <lr-button size="s">Open</lr-button>
          <lr-button size="s">Save</lr-button>
        </lr-control-group>
      </div>
    `);
    const group = wrapper.querySelector('lr-control-group') as LyraControlGroup;
    expect(group.getBoundingClientRect().width).to.be.greaterThan(0);
    expect(getComputedStyle(group).containerType).to.equal('normal');
  });

  it('fills a host given an explicit definite inline-size, even without responsive', async () => {
    const el = await fixture<LyraControlGroup>(html`
      <lr-control-group style="inline-size: 300px;">
        <lr-button size="s">Open</lr-button>
      </lr-control-group>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).inlineSize).to.equal('300px');
  });

  it('stays shrink-to-fit when the host has no explicit size, even inside a wide block ancestor', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div style="inline-size: 1000px;">
        <lr-control-group>
          <lr-button size="s">Open</lr-button>
        </lr-control-group>
      </div>
    `);
    const group = wrapper.querySelector('lr-control-group') as LyraControlGroup;
    const base = group.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    // :host stays `inline-flex` (inline-level) and gets no size from the wide block ancestor on
    // its own, so the unconditional fill on [part='base'] has nothing definite to resolve
    // against and resolves as if `auto` -- the group must still hug its own content, not the
    // ancestor's 1000px allocation.
    expect(group.getBoundingClientRect().width).to.be.lessThan(200);
    expect(base.getBoundingClientRect().width).to.equal(
      group.getBoundingClientRect().width
    );
  });

  it('opts back into container-query sizing via responsive, with the base fill now unconditional regardless', async () => {
    const el = await fixture<LyraControlGroup>(html`
      <lr-control-group responsive style="inline-size: 120px;">
        <lr-button>Open</lr-button>
        <lr-button>Save</lr-button>
        <lr-button>Share</lr-button>
      </lr-control-group>
    `);
    expect(el.responsive).to.be.true;
    expect(el.hasAttribute('responsive')).to.be.true;
    expect(getComputedStyle(el).containerType).to.equal('inline-size');
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).inlineSize).to.equal('120px');
  });

  it('keeps a useful intrinsic width when responsive inside a shrink-to-fit parent', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div style="display: grid; place-items: center;">
        <lr-control-group responsive>
          <lr-button size="s">Open</lr-button>
          <lr-button size="s">Save</lr-button>
        </lr-control-group>
      </div>
    `);
    const group = wrapper.querySelector('lr-control-group') as LyraControlGroup;
    const base = group.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    expect(group.getBoundingClientRect().width).to.be.greaterThan(100);
    expect(base.scrollWidth).to.be.at.most(group.clientWidth);
  });
});
