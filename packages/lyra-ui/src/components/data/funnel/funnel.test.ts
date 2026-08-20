import { expect, fixture, html } from '@open-wc/testing';
import type { LyraFunnel, LyraFunnelStage } from './funnel.class.js';
import './funnel.js';

const SIGNUP_FUNNEL: LyraFunnelStage[] = [
  { label: 'Visited', value: 12_000 },
  { label: 'Signed up', value: 4800 },
  { label: 'Activated', value: 1200 },
];

function part(el: LyraFunnel, name: string): HTMLElement | null {
  return el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
}

function parts(el: LyraFunnel, name: string): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>(`[part~="${name}"]`)];
}

// Locale-aware formatters use narrow/non-breaking spaces (German percent, French grouping);
// normalize them so assertions read as plain text.
function text(node: Element | null | undefined): string {
  return (node?.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ').trim();
}

describe('<lr-funnel>', () => {
  it('renders one stage per entry with both the absolute value and the share of the FIRST stage, and stays accessible', async () => {
    const el = await fixture<LyraFunnel>(
      html`<lr-funnel label="Signup funnel" .stages=${SIGNUP_FUNNEL}></lr-funnel>`,
    );
    await el.updateComplete;

    expect(parts(el, 'stage').length).to.equal(3);
    expect(parts(el, 'stage-label').map(text)).to.deep.equal([
      'Visited',
      'Signed up',
      'Activated',
    ]);
    expect(parts(el, 'stage-value').map(text)).to.deep.equal(['12,000', '4,800', '1,200']);
    // Normalized to the first stage (12,000), never to the data maximum.
    expect(parts(el, 'stage-share').map(text)).to.deep.equal(['100%', '40%', '10%']);
    expect(parts(el, 'bar').map((bar) => bar.style.inlineSize)).to.deep.equal([
      '100%',
      '40%',
      '10%',
    ]);
    await expect(el).to.be.accessible();
  });

  it('names the stage list from label, and lets a host aria-label win', async () => {
    const el = await fixture<LyraFunnel>(
      html`<lr-funnel label="Signup funnel" .stages=${SIGNUP_FUNNEL}></lr-funnel>`,
    );
    expect(part(el, 'stages')?.getAttribute('aria-label')).to.equal('Signup funnel');

    el.setAttribute('aria-label', 'Q3 cohort');
    await el.updateComplete;
    expect(part(el, 'stages')?.getAttribute('aria-label')).to.equal('Q3 cohort');
  });

  it('announces drop-off between consecutive stages and can switch it off', async () => {
    const el = await fixture<LyraFunnel>(html`<lr-funnel .stages=${SIGNUP_FUNNEL}></lr-funnel>`);
    // No drop-off row above the first stage; one above each later stage.
    expect(parts(el, 'dropoff').map(text)).to.deep.equal(['decreased 60%', 'decreased 75%']);

    el.dropoff = false;
    await el.updateComplete;
    expect(parts(el, 'dropoff').length).to.equal(0);
  });

  it('reports a re-entry stage above 100% in text while clamping its bar', async () => {
    const el = await fixture<LyraFunnel>(
      html`<lr-funnel
        .stages=${[
          { label: 'Trial', value: 100 },
          { label: 'Re-engaged', value: 150 },
        ]}
      ></lr-funnel>`,
    );
    expect(parts(el, 'stage-share').map(text)).to.deep.equal(['100%', '150%']);
    expect(parts(el, 'bar').map((bar) => bar.style.inlineSize)).to.deep.equal(['100%', '100%']);
    expect(parts(el, 'bar-overflow').length).to.equal(1);
    expect(parts(el, 'dropoff').map(text)).to.deep.equal(['increased 50%']);
    // The clamped bar cannot show that it ran past the end, so the end cap does.
    const [normal, overflowed] = parts(el, 'bar');
    expect(getComputedStyle(normal!).borderInlineEndWidth).to.equal('0px');
    expect(getComputedStyle(overflowed!).borderInlineEndWidth).to.not.equal('0px');
    // The extra part token must not cost the bar its own styling: an exact [part='bar'] selector
    // silently stops matching part="bar bar-overflow", and nothing but a rendered check sees it.
    const overflowStyle = getComputedStyle(overflowed!);
    const normalStyle = getComputedStyle(normal!);
    expect(overflowStyle.position).to.equal('absolute');
    expect(overflowStyle.backgroundColor).to.equal(normalStyle.backgroundColor);
    expect(parts(el, 'bar')[1]!.getBoundingClientRect().height).to.be.greaterThan(0);
  });

  it('suppresses shares when the first stage is zero, keeping the values readable', async () => {
    const el = await fixture<LyraFunnel>(
      html`<lr-funnel
        .stages=${[
          { label: 'Visited', value: 0 },
          { label: 'Signed up', value: 40 },
        ]}
      ></lr-funnel>`,
    );
    expect(parts(el, 'stage-value').map(text)).to.deep.equal(['0', '40']);
    expect(parts(el, 'stage-share').length).to.equal(0);
    expect(parts(el, 'bar').map((bar) => bar.style.inlineSize)).to.deep.equal(['0%', '0%']);
    // A drop-off from a zero baseline is undefined, so nothing is claimed about it.
    expect(parts(el, 'dropoff').length).to.equal(0);
  });

  it('renders a single stage without any drop-off row', async () => {
    const el = await fixture<LyraFunnel>(
      html`<lr-funnel .stages=${[{ label: 'Visited', value: 9 }]}></lr-funnel>`,
    );
    expect(parts(el, 'stage').length).to.equal(1);
    expect(parts(el, 'dropoff').length).to.equal(0);
    expect(text(part(el, 'stage-share'))).to.equal('100%');
  });

  it('renders a localized empty state instead of a list when there are no stages', async () => {
    const el = await fixture<LyraFunnel>(html`<lr-funnel></lr-funnel>`);
    expect(text(part(el, 'empty'))).to.equal('No data');
    expect(parts(el, 'stages').length).to.equal(0);
    await expect(el).to.be.accessible();
  });

  it('normalizes the comparison series to its OWN first stage and pairs it by index', async () => {
    const el = await fixture<LyraFunnel>(
      html`<lr-funnel
        .stages=${SIGNUP_FUNNEL}
        .comparison=${[
          { label: 'Visited', value: 50 },
          { label: 'Signed up', value: 30 },
        ]}
        comparison-label="Peer group"
      ></lr-funnel>`,
    );
    // 50 -> 100%, 30 -> 60%; the third stage has no counterpart at all.
    expect(parts(el, 'comparison-bar').map((bar) => bar.style.inlineSize)).to.deep.equal([
      '100%',
      '60%',
    ]);
    expect(parts(el, 'comparison-value').map(text)).to.deep.equal([
      'Peer group: 100%',
      'Peer group: 60%',
    ]);
    // A bar with an outline behind it is inset so the outline stays visible; the unpaired third
    // stage keeps a full-height bar.
    const bars = parts(el, 'bar');
    const paired = bars[0]!.getBoundingClientRect();
    const unpaired = bars[2]!.getBoundingClientRect();
    expect(paired.height).to.be.lessThan(unpaired.height);
    await expect(el).to.be.accessible();
  });

  it('ignores comparison entries beyond the stage count', async () => {
    const el = await fixture<LyraFunnel>(
      html`<lr-funnel
        .stages=${[{ label: 'Visited', value: 10 }]}
        .comparison=${[
          { label: 'a', value: 4 },
          { label: 'b', value: 2 },
          { label: 'c', value: 1 },
        ]}
      ></lr-funnel>`,
    );
    expect(parts(el, 'comparison-bar').length).to.equal(1);
    expect(text(part(el, 'comparison-value'))).to.equal('Comparison: 100%');
  });

  it('treats non-finite stage values as zero rather than producing NaN geometry', async () => {
    const el = await fixture<LyraFunnel>(
      html`<lr-funnel
        .stages=${[
          { label: 'Visited', value: 200 },
          { label: 'Broken', value: Number.NaN },
          { label: 'Infinite', value: Number.POSITIVE_INFINITY },
        ]}
      ></lr-funnel>`,
    );
    expect(parts(el, 'stage-value').map(text)).to.deep.equal(['200', '0', '0']);
    expect(parts(el, 'bar').map((bar) => bar.style.inlineSize)).to.deep.equal(['100%', '0%', '0%']);
  });

  it('formats values and shares through the effective locale, never a hardcoded English one', async () => {
    const el = await fixture<LyraFunnel>(
      html`<lr-funnel
        locale="de-DE"
        share-precision="1"
        .stages=${[
          { label: 'Besucht', value: 12_000 },
          { label: 'Registriert', value: 4800 },
        ]}
      ></lr-funnel>`,
    );
    expect(parts(el, 'stage-value').map(text)).to.deep.equal(['12.000', '4.800']);
    expect(parts(el, 'stage-share').map(text)).to.deep.equal(['100,0 %', '40,0 %']);
  });

  it('lets a strings override reach the DOM for every localized message', async () => {
    const el = await fixture<LyraFunnel>(html`<lr-funnel></lr-funnel>`);
    expect(text(part(el, 'empty'))).to.equal('No data');

    el.strings = { noData: 'Nothing yet' };
    await el.updateComplete;
    expect(text(part(el, 'empty'))).to.equal('Nothing yet');
  });

  it('grows every bar from the inline-start edge in both directions', async () => {
    const rtl = await fixture<LyraFunnel>(
      html`<lr-funnel
        dir="rtl"
        .stages=${SIGNUP_FUNNEL}
        .comparison=${SIGNUP_FUNNEL}
      ></lr-funnel>`,
    );
    const rtlTrack = parts(rtl, 'track')[1]!.getBoundingClientRect();
    const rtlBar = parts(rtl, 'bar')[1]!.getBoundingClientRect();
    const rtlGhost = parts(rtl, 'comparison-bar')[1]!.getBoundingClientRect();
    // A 40% bar hugs the right edge under rtl and leaves the left edge clear.
    expect(Math.round(rtlBar.right)).to.equal(Math.round(rtlTrack.right));
    expect(rtlBar.left).to.be.greaterThan(rtlTrack.left);
    expect(Math.round(rtlGhost.right)).to.equal(Math.round(rtlTrack.right));
    // The component never sets its own direction; it reads the inherited one.
    expect(rtl.getAttribute('dir')).to.equal('rtl');

    const ltr = await fixture<LyraFunnel>(
      html`<lr-funnel .stages=${SIGNUP_FUNNEL}></lr-funnel>`,
    );
    const ltrTrack = parts(ltr, 'track')[1]!.getBoundingClientRect();
    const ltrBar = parts(ltr, 'bar')[1]!.getBoundingClientRect();
    expect(Math.round(ltrBar.left)).to.equal(Math.round(ltrTrack.left));
    expect(ltrBar.right).to.be.lessThan(ltrTrack.right);
  });

  it('stops bar motion under prefers-reduced-motion', async () => {
    const el = await fixture<LyraFunnel>(html`<lr-funnel .stages=${SIGNUP_FUNNEL}></lr-funnel>`);
    const bar = part(el, 'bar')!;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      expect(getComputedStyle(bar).transitionProperty).to.equal('none');
      return;
    }
    expect(getComputedStyle(bar).transitionProperty).to.equal('inline-size');

    const reducedRule = el.shadowRoot!.adoptedStyleSheets
      .flatMap((sheet) => [...sheet.cssRules])
      .find(
        (rule): rule is CSSMediaRule =>
          rule instanceof CSSMediaRule &&
          rule.conditionText === '(prefers-reduced-motion: reduce)' &&
          [...rule.cssRules].some(
            (nested) => nested instanceof CSSStyleRule && nested.selectorText.includes('bar'),
          ),
      );
    expect(reducedRule !== undefined).to.equal(true);
    const originalCondition = reducedRule!.media.mediaText;
    try {
      reducedRule!.media.mediaText = 'all';
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(getComputedStyle(bar).transitionProperty).to.equal('none');
    } finally {
      reducedRule!.media.mediaText = originalCondition;
    }
  });

  it('fits a 320px allocation with unbreakable long labels without overflowing', async () => {
    const el = await fixture<LyraFunnel>(
      html`<lr-funnel
        style="inline-size: 320px"
        .stages=${[
          { label: 'reached-the-pricing-page-from-paid-search-campaign-42', value: 12_000 },
          { label: 'started-a-trial-after-reading-the-pricing-page-twice', value: 800 },
        ]}
      ></lr-funnel>`,
    );
    await el.updateComplete;
    const base = part(el, 'base')!;
    expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
    expect(el.scrollWidth).to.be.at.most(el.clientWidth + 1);
  });

  it('gives the stage name its own line once the container query fires, not the viewport', async () => {
    const wide = await fixture<LyraFunnel>(
      html`<lr-funnel style="inline-size: 640px" .stages=${SIGNUP_FUNNEL}></lr-funnel>`,
    );
    const narrow = await fixture<LyraFunnel>(
      html`<lr-funnel style="inline-size: 240px" .stages=${SIGNUP_FUNNEL}></lr-funnel>`,
    );
    await Promise.all([wide.updateComplete, narrow.updateComplete]);

    const wideLabel = part(wide, 'stage-label')!.getBoundingClientRect();
    const wideValue = part(wide, 'stage-value')!.getBoundingClientRect();
    expect(Math.round(wideLabel.top)).to.equal(Math.round(wideValue.top));

    const narrowLabel = part(narrow, 'stage-label')!.getBoundingClientRect();
    const narrowValue = part(narrow, 'stage-value')!.getBoundingClientRect();
    expect(narrowValue.top).to.be.greaterThan(narrowLabel.top);
  });
});
