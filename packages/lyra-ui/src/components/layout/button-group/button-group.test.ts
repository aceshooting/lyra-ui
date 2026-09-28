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

  it('retains an explicit empty host aria-label until the attribute is removed', async () => {
    const el = await fixture<LyraButtonGroup>(html`
      <lr-button-group label="Visible actions" aria-label="">
        <lr-button>Open</lr-button>
      </lr-button-group>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;

    expect(base.getAttribute('aria-label')).to.equal('');

    el.setAttribute('aria-label', 'Archived actions');
    await el.updateComplete;
    expect(base.getAttribute('aria-label')).to.equal('Archived actions');

    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(base.getAttribute('aria-label')).to.equal('Visible actions');
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

  it('fits a constrained allocation and keeps wider rows compact', async () => {
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

  it('uses its content width inside a shrink-to-fit flex parent', async () => {
    // The group must derive its intrinsic width from its slotted actions.
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
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(el.getBoundingClientRect().width).to.be.greaterThan(100);
    expect(base.scrollWidth).to.be.at.most(el.clientWidth);
  });

  it('contains long localized RTL actions at an exact 320px allocation', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
        <lr-button-group label="إجراءات المستند" style="inline-size: 320px; max-inline-size: 100%;">
          <lr-button variant="brand">حفظ-المستند-بالتفاصيل-الكاملة</lr-button>
          <lr-button>معاينة-الإصدار-قبل-النشر</lr-button>
          <lr-button>مشاركة-النتيجة-مع-فريق-العمل</lr-button>
        </lr-button-group>
      </div>
    `);
    const el = wrapper.querySelector('lr-button-group') as LyraButtonGroup;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;

    expect(el.scrollWidth).to.be.at.most(el.clientWidth);
    expect(base.scrollWidth).to.be.at.most(base.clientWidth);
    expect(getComputedStyle(base).direction).to.equal('rtl');
  });
});

it("restores the declared orientation default when the attribute is removed", async () => {
  const el = (await fixture(
    html`<lr-button-group orientation="vertical"></lr-button-group>`
  )) as LyraButtonGroup;
  el.removeAttribute("orientation");
  await el.updateComplete;
  expect(el.orientation).to.equal("horizontal");
});

it('keeps narrow allocated groups compact unless the base is explicitly filled', async () => {
  const el = await fixture<LyraButtonGroup>(html`<lr-button-group style="inline-size:300px"><lr-button>Go</lr-button></lr-button-group>`);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  expect(el.getBoundingClientRect().width).to.equal(300);
  expect(base.getBoundingClientRect().width).to.be.lessThan(250);
  base.style.inlineSize = '100%';
  expect(base.getBoundingClientRect().width).to.equal(300);
});
