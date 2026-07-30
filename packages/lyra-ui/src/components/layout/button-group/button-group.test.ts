import { expect, fixture, html } from '@open-wc/testing';
import './button-group.js';
import '../../forms/button/button.js';
import type { LyraButtonGroup } from './button-group.class.js';

describe('<lr-button-group>', () => {
  it('groups slotted actions and forwards its accessible name', async () => {
    const el = await fixture<LyraButtonGroup>(html`
      <lr-button-group aria-label="View actions">
        <lr-button>Open</lr-button>
        <lr-button>Save</lr-button>
      </lr-button-group>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('View actions');
  });

  it('lets a host aria-label override the label prop on the internal group', async () => {
    const el = await fixture<LyraButtonGroup>(html`
      <lr-button-group label="Visible actions" aria-label="Author actions">
        <lr-button>Open</lr-button>
      </lr-button-group>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('aria-label')).to.equal('Author actions');
  });

  it('is accessible', async () => {
    const el = await fixture<LyraButtonGroup>(html`<lr-button-group label="Actions"><lr-button>Open</lr-button></lr-button-group>`);
    await expect(el).to.be.accessible();
  });

  it('honors an overridden --lr-button-group-gap custom property', async () => {
    const el = await fixture<LyraButtonGroup>(html`
      <lr-button-group style="--lr-button-group-gap: 24px;">
        <lr-button>Open</lr-button>
        <lr-button>Save</lr-button>
      </lr-button-group>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).gap).to.equal('24px');
  });

  it('goes full-width when its own allocation is narrow, via a container query rather than a viewport media query', async () => {
    const narrow = await fixture<LyraButtonGroup>(html`
      <lr-button-group style="inline-size: 120px;">
        <lr-button>Open</lr-button>
        <lr-button>Save</lr-button>
      </lr-button-group>
    `);
    const narrowBase = narrow.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const narrowHostWidth = narrow.getBoundingClientRect().width;
    const narrowBaseWidth = narrowBase.getBoundingClientRect().width;
    expect(narrowBaseWidth).to.be.closeTo(narrowHostWidth, 2);

    const wide = await fixture<LyraButtonGroup>(html`
      <lr-button-group style="inline-size: 500px;">
        <lr-button>Open</lr-button>
        <lr-button>Save</lr-button>
      </lr-button-group>
    `);
    const wideBase = wide.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const wideHostWidth = wide.getBoundingClientRect().width;
    const wideBaseWidth = wideBase.getBoundingClientRect().width;
    // Under the old viewport media query this would also have gone full-width
    // whenever the *test runner's* viewport happened to be <= 20rem; pinning the
    // host's own allocated width instead proves the query reacts to allocation.
    expect(wideBaseWidth).to.be.lessThan(wideHostWidth - 20);
  });

  it('does not collapse to ~0 width inside a shrink-to-fit flex parent with no explicit width', async () => {
    // :host's own container-type: inline-size makes it a query container, which forces it out of
    // normal inline flow sizing unless something floors its inline-size -- without that floor, an
    // inline-flex host with min-inline-size: 0 dropped into a `display:flex` parent (which gives
    // its children shrink-to-fit sizing, not their content size) collapsed to ~0 wide. The floor
    // has to be a length (--lr-icon-button-size), not a content-based keyword: inline-size
    // containment makes fit-content/max-content/auto resolve as if the box had no content, so the
    // rendered width settles at the floor itself rather than growing to fit the slotted buttons.
    const wrap = await fixture(html`
      <div style="display:flex">
        <lr-button-group label="Actions">
          <lr-button>Open</lr-button>
          <lr-button>Save</lr-button>
        </lr-button-group>
      </div>
    `);
    const el = wrap.querySelector('lr-button-group') as LyraButtonGroup;
    await el.updateComplete;
    expect(el.getBoundingClientRect().width).to.be.greaterThan(20);
  });
});
