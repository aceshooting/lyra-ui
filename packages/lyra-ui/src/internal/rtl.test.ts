import { fixture, expect, html } from '@open-wc/testing';
import { isRtl, rtlAwarePlacement } from './rtl.js';

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

it('resolves an adopted element through its owner window without consulting the ambient window', () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const foreignWindow = iframe.contentWindow!;
  const foreignDocument = iframe.contentDocument!;
  const ambientDescriptor = Object.getOwnPropertyDescriptor(window, 'getComputedStyle');
  const ownerDescriptor = Object.getOwnPropertyDescriptor(foreignWindow, 'getComputedStyle');
  const ownerGetComputedStyle = foreignWindow.getComputedStyle.bind(foreignWindow);
  let ownerCalls = 0;
  const element = foreignDocument.createElement('div');
  element.dir = 'rtl';
  foreignDocument.body.append(element);

  Object.defineProperty(window, 'getComputedStyle', {
    configurable: true,
    value() {
      throw new Error('ambient getComputedStyle used');
    },
  });
  Object.defineProperty(foreignWindow, 'getComputedStyle', {
    configurable: true,
    value(target: Element, pseudo?: string | null) {
      ownerCalls += 1;
      return ownerGetComputedStyle(target, pseudo);
    },
  });

  try {
    expect(isRtl(element)).to.equal(true);
    expect(ownerCalls).to.be.greaterThan(0);
  } finally {
    if (ambientDescriptor) Object.defineProperty(window, 'getComputedStyle', ambientDescriptor);
    if (ownerDescriptor) Object.defineProperty(foreignWindow, 'getComputedStyle', ownerDescriptor);
    element.remove();
    iframe.remove();
  }
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
