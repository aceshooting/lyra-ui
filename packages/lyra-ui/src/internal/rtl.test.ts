import { fixture, expect, html } from '@open-wc/testing';
import { isRtl, rtlAwareSide, rtlAwarePlacement } from './rtl.js';

it('reads the resolved direction off the element, not a fixed default', async () => {
  const ltr = await fixture(html`<div dir="ltr"></div>`);
  const rtl = await fixture(html`<div dir="rtl"></div>`);
  expect(isRtl(ltr)).to.be.false;
  expect(isRtl(rtl)).to.be.true;
});

it('inherits direction from an ancestor when not set directly on the element', async () => {
  const wrapper = await fixture(html`<div dir="rtl"><span></span></div>`);
  const child = wrapper.querySelector('span')!;
  expect(isRtl(child)).to.be.true;
});

describe('rtlAwareSide', () => {
  it('passes the side through unchanged under LTR', async () => {
    const ltr = await fixture(html`<div dir="ltr"></div>`);
    expect(rtlAwareSide('left', ltr)).to.equal('left');
    expect(rtlAwareSide('right', ltr)).to.equal('right');
  });

  it('swaps the side under RTL', async () => {
    const rtl = await fixture(html`<div dir="rtl"></div>`);
    expect(rtlAwareSide('left', rtl)).to.equal('right');
    expect(rtlAwareSide('right', rtl)).to.equal('left');
  });
});

describe('rtlAwarePlacement', () => {
  it('passes a left/right placement through unchanged under LTR', async () => {
    const ltr = await fixture(html`<div dir="ltr"></div>`);
    expect(rtlAwarePlacement('right-start', ltr)).to.equal('right-start');
    expect(rtlAwarePlacement('left-end', ltr)).to.equal('left-end');
  });

  it('swaps a left/right placement, preserving its alignment suffix, under RTL', async () => {
    const rtl = await fixture(html`<div dir="rtl"></div>`);
    expect(rtlAwarePlacement('right-start', rtl)).to.equal('left-start');
    expect(rtlAwarePlacement('left-end', rtl)).to.equal('right-end');
    expect(rtlAwarePlacement('left', rtl)).to.equal('right');
  });

  it('leaves a top/bottom placement unchanged under RTL', async () => {
    const rtl = await fixture(html`<div dir="rtl"></div>`);
    expect(rtlAwarePlacement('bottom-start', rtl)).to.equal('bottom-start');
    expect(rtlAwarePlacement('top-end', rtl)).to.equal('top-end');
  });
});
