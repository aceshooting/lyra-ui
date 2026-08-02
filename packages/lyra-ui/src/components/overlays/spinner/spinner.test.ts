import { fixture, expect, html } from '@open-wc/testing';
import './spinner.js';
import type { LyraSpinner } from './spinner.js';

it('accepts the mapped spinner color, width, and speed hooks', async () => {
  const el = (await fixture(html`
    <lr-spinner
      style="--track-width: 7px; --track-color: rgb(1, 2, 3); --indicator-color: rgb(4, 5, 6); --speed: 3s"
    ></lr-spinner>
  `)) as LyraSpinner;
  const indicator = el.shadowRoot!.querySelector<HTMLElement>('[part~="spinner-indicator"]')!;
  const computed = getComputedStyle(indicator);
  expect(computed.borderTopWidth).to.equal('7px');
  expect(computed.borderRightColor).to.equal('rgb(1, 2, 3)');
  expect(computed.borderTopColor).to.equal('rgb(4, 5, 6)');
  expect(computed.animationDuration).to.equal('3s');
});

it('renders a localized busy status', async () => {
  const el = (await fixture(html`<lr-spinner></lr-spinner>`)) as LyraSpinner;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('status');
  expect(base.getAttribute('aria-label')).to.equal('Loading…');
  await expect(el).to.be.accessible();
});

it('lets a host aria-label override the localized default', async () => {
  const el = (await fixture(html`<lr-spinner aria-label="Loading users"></lr-spinner>`)) as LyraSpinner;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Loading users');
});

it('keeps the slotted label sr-only when label-placement is "none" (default)', async () => {
  const el = (await fixture(html`<lr-spinner>Loading data</lr-spinner>`)) as LyraSpinner;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.true;
});

it('shows the slotted label in flow when label-placement is "after"', async () => {
  const el = (await fixture(html`<lr-spinner label-placement="after">Loading data</lr-spinner>`)) as LyraSpinner;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(label.hidden).to.be.false;
  expect(base.getAttribute('aria-label')).to.equal('Loading data');
  const computed = getComputedStyle(label);
  expect(computed.position).to.not.equal('absolute');
  expect(computed.clipPath).to.not.equal('inset(50%)');
});

it('stops the rendered indicator animation under prefers-reduced-motion', async () => {
  const el = (await fixture(html`<lr-spinner></lr-spinner>`)) as LyraSpinner;
  const indicator = el.shadowRoot!.querySelector<HTMLElement>('[part~="spinner-indicator"]')!;
  expect(getComputedStyle(indicator).animationName).to.equal('lr-spin');
  const reducedRule = el.shadowRoot!.adoptedStyleSheets
    .flatMap((sheet) => [...sheet.cssRules])
    .find(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule &&
        rule.conditionText === '(prefers-reduced-motion: reduce)' &&
        [...rule.cssRules].some(
          (nested) =>
            nested instanceof CSSStyleRule && nested.selectorText.includes('spinner-indicator'),
        ),
    );
  expect(reducedRule?.conditionText).to.equal('(prefers-reduced-motion: reduce)');
  const originalCondition = reducedRule!.media.mediaText;
  try {
    reducedRule!.media.mediaText = 'all';
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(getComputedStyle(indicator).animationName).to.equal('none');
  } finally {
    reducedRule!.media.mediaText = originalCondition;
  }
});

it('inherits the shared ambient timing token unless its component duration is overridden', async () => {
  const el = (await fixture(
    html`<lr-spinner style="--lr-transition-ambient: 3s linear"></lr-spinner>`,
  )) as LyraSpinner;
  const spinner = el.shadowRoot!.querySelector('[part~="spinner-indicator"]') as HTMLElement;
  expect(getComputedStyle(spinner).animationDuration).to.equal('3s');
  expect(getComputedStyle(spinner).animationTimingFunction).to.equal('linear');
});
