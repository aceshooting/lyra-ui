import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraNumberTicker } from './number-ticker.class.js';
import '../../lr-number-ticker.js';

const shownText = (el: LyraNumberTicker): string => el.shadowRoot!.querySelector('[part="value"]')!.textContent!.trim();
const srText = (el: LyraNumberTicker): string | undefined =>
  el.shadowRoot!.querySelector('.sr-only')?.textContent?.trim();

describe('<lr-number-ticker>', () => {
  it('shows the start value, counts to value, and emits lr-finish once', async () => {
    const el = await fixture<LyraNumberTicker>(html`<lr-number-ticker eager value="1234" duration="400"></lr-number-ticker>`);
    let finishes = 0;
    el.addEventListener('lr-finish', () => finishes++);
    await waitUntil(() => el.matches(':state(counting)') || shownText(el) === '1,234', 'started', { timeout: 2000 });
    await waitUntil(() => shownText(el) === '1,234', 'settled', { timeout: 3000 });
    // wait-reason: asserting no second lr-finish arrives after the run settles
    await aTimeout(300);
    expect(finishes).to.be.at.most(1);
    expect(el.matches(':state(counting)')).to.equal(false);
    expect(el.shadowRoot!.querySelector('.sr-only') === null).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll('[aria-hidden="true"]').length).to.equal(0);
  });

  it('emits exactly one lr-finish for a run', async () => {
    const el = await fixture<LyraNumberTicker>(html`<lr-number-ticker value="50" duration="300"></lr-number-ticker>`);
    let finishes = 0;
    el.addEventListener('lr-finish', () => finishes++);
    await waitUntil(() => finishes > 0, 'finish', { timeout: 3000 });
    // wait-reason: asserting no second lr-finish arrives after the first
    await aTimeout(600);
    expect(finishes).to.equal(1);
  });

  it('keeps the animated text out of the accessibility tree and exposes the final value while counting', async () => {
    const el = await fixture<LyraNumberTicker>(
      html`<lr-number-ticker eager value="1000" duration="1500" easing="linear"></lr-number-ticker>`,
    );
    await waitUntil(() => el.matches(':state(counting)') && shownText(el) !== '1,000', 'counting', { timeout: 2000 });
    const animated = el.shadowRoot!.querySelector('[part="value"]')!;
    expect(animated.getAttribute('aria-hidden')).to.equal('true');
    expect(srText(el)).to.equal('1,000');
    expect(el.shadowRoot!.querySelector('[aria-live], [role="status"]') === null).to.equal(true);
    await expect(el).to.be.accessible();
  });

  it('waits until it is visible and counts when scrolled into view', async () => {
    const host = await fixture<HTMLDivElement>(
      html`<div><div style="block-size: 4000px"></div><lr-number-ticker value="80" duration="200"></lr-number-ticker></div>`,
    );
    const el = host.querySelector('lr-number-ticker') as LyraNumberTicker;
    // wait-reason: asserting an off-screen ticker does not start counting
    await aTimeout(300);
    expect(shownText(el)).to.equal('0');
    el.scrollIntoView();
    await oneEvent(el, 'lr-finish');
    expect(shownText(el)).to.equal('80');
  });

  it('restart() counts again from the start value', async () => {
    const el = await fixture<LyraNumberTicker>(html`<lr-number-ticker eager value="40" duration="200"></lr-number-ticker>`);
    await oneEvent(el, 'lr-finish');
    expect(shownText(el)).to.equal('40');
    el.restart();
    await el.updateComplete;
    expect(shownText(el)).to.equal('0');
    await oneEvent(el, 'lr-finish');
    expect(shownText(el)).to.equal('40');
  });

  it('formats with Intl options in the effective locale', async () => {
    const currency = await fixture<LyraNumberTicker>(
      html`<lr-number-ticker eager type="currency" currency="EUR" lang="de" value="1234.5" duration="0"></lr-number-ticker>`,
    );
    await waitUntil(() => shownText(currency).includes('1.234,50'), 'de currency');
    expect(shownText(currency)).to.contain('€');
    const percent = await fixture<LyraNumberTicker>(
      html`<lr-number-ticker eager type="percent" value="0.256" maximum-fraction-digits="1" duration="0"></lr-number-ticker>`,
    );
    await waitUntil(() => shownText(percent) === '25.6%', 'percent');
    const ungrouped = await fixture<LyraNumberTicker>(
      html`<lr-number-ticker eager without-grouping value="12345" duration="0"></lr-number-ticker>`,
    );
    await waitUntil(() => shownText(ungrouped) === '12345', 'without grouping');
    const rtl = await fixture<LyraNumberTicker>(
      html`<div dir="rtl"><lr-number-ticker eager lang="ar" value="12" duration="0"></lr-number-ticker></div>`,
    );
    const arabic = rtl.querySelector('lr-number-ticker') as LyraNumberTicker;
    await waitUntil(() => shownText(arabic) !== '0' && shownText(arabic) !== '', 'arabic digits');
    expect(shownText(arabic)).to.equal(new Intl.NumberFormat('ar').format(12));
  });

  it('uses a property-only valueFormatter and survives one that throws', async () => {
    const el = await fixture<LyraNumberTicker>(html`<lr-number-ticker eager value="7" duration="0"></lr-number-ticker>`);
    el.valueFormatter = (n: number) => `#${Math.round(n)}`;
    await el.updateComplete;
    expect(shownText(el)).to.equal('#7');
    el.valueFormatter = () => {
      throw new Error('boom');
    };
    await el.updateComplete;
    el.requestUpdate();
    await el.updateComplete;
    expect(shownText(el)).to.equal('');
  });

  it('jumps straight to the final value under reduced motion and counts otherwise', async () => {
    let jumped = 0;
    const reduced = await fixture<HTMLDivElement>(
      html`<div data-lr-motion="reduce" @lr-finish=${() => jumped++}><lr-number-ticker eager value="900" duration="5000"></lr-number-ticker></div>`,
    );
    const jump = reduced.querySelector('lr-number-ticker') as LyraNumberTicker;
    await waitUntil(() => jumped === 1, 'instant finish', { timeout: 2000 });
    expect(shownText(jump)).to.equal('900');
    expect(jump.matches(':state(counting)')).to.equal(false);

    const full = await fixture<LyraNumberTicker>(
      html`<lr-number-ticker eager value="900" duration="1500" easing="linear"></lr-number-ticker>`,
    );
    await waitUntil(() => shownText(full) !== '0' && shownText(full) !== '900', 'intermediate frame', { timeout: 2500 });
    expect(full.matches(':state(counting)')).to.equal(true);
  });

  it('stops its frame loop on disconnect and resumes an interrupted run on reconnect', async () => {
    const host = await fixture<HTMLDivElement>(
      html`<div><lr-number-ticker eager value="500" duration="800" easing="linear"></lr-number-ticker></div>`,
    );
    const el = host.querySelector('lr-number-ticker') as LyraNumberTicker;
    await waitUntil(() => el.matches(':state(counting)'), 'counting');
    let finishes = 0;
    el.addEventListener('lr-finish', () => finishes++);
    el.remove();
    // wait-reason: asserting a disconnected ticker never finishes its run
    await aTimeout(1000);
    expect(finishes).to.equal(0);
    host.append(el);
    await oneEvent(el, 'lr-finish');
    expect(shownText(el)).to.equal('500');
    // wait-reason: asserting reconnecting does not emit a second lr-finish
    await aTimeout(200);
    expect(finishes).to.equal(1);
  });

  it('counts on from the shown number when value changes after the first run', async () => {
    const el = await fixture<LyraNumberTicker>(html`<lr-number-ticker eager value="10" duration="150"></lr-number-ticker>`);
    await oneEvent(el, 'lr-finish');
    el.value = 20;
    await oneEvent(el, 'lr-finish');
    expect(shownText(el)).to.equal('20');
  });

  it('settles early once the shown text equals the final text', async () => {
    // This curve reaches 99% progress in well under a tenth of the duration, so "10" is shown
    // almost at once and every later frame would repaint the same text.
    const started = performance.now();
    const el = await fixture<LyraNumberTicker>(
      html`<lr-number-ticker eager value="10" duration="6000" easing="cubic-bezier(0, 1, 0, 1)"></lr-number-ticker>`,
    );
    let finishes = 0;
    el.addEventListener('lr-finish', () => finishes++);
    await waitUntil(() => finishes === 1, 'early finish', { timeout: 4000 });
    expect(performance.now() - started).to.be.below(4000);
    expect(shownText(el)).to.equal('10');
    expect(el.matches(':state(counting)')).to.equal(false);
    expect(el.shadowRoot!.querySelector('.sr-only') === null).to.equal(true);
  });

  it('keeps counting to a value changed mid-count, and settles at once when reduced motion turns on', async () => {
    const host = await fixture<HTMLDivElement>(
      html`<div><lr-number-ticker eager value="1000" duration="4000" easing="linear"></lr-number-ticker></div>`,
    );
    const el = host.querySelector('lr-number-ticker') as LyraNumberTicker;
    let finishes = 0;
    el.addEventListener('lr-finish', () => finishes++);
    await waitUntil(() => el.matches(':state(counting)') && shownText(el) !== '0', 'counting');
    el.value = 2000;
    await waitUntil(() => Number(shownText(el).replace(/\D/g, '')) > 0 && el.matches(':state(counting)'), 'still counting');
    expect(finishes).to.equal(0);
    host.setAttribute('data-lr-motion', 'reduce');
    await waitUntil(() => finishes === 1, 'reduced-motion settle', { timeout: 2000 });
    expect(shownText(el)).to.equal('2,000');
    expect(el.matches(':state(counting)')).to.equal(false);
  });

  it('keeps the default for a blank numeric attribute', async () => {
    const el = await fixture<LyraNumberTicker>(html`<lr-number-ticker duration="" delay="" start-value=""></lr-number-ticker>`);
    expect(el.duration).to.equal(2000);
    expect(el.delay).to.equal(0);
    expect(el.startValue).to.equal(0);
  });
});
