import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraCounter } from './counter.class.js';
import { addCalendarMonths, splitDuration } from './counter-time.js';
import '../../lr-counter.js';

const texts = (el: LyraCounter, part: string): string[] =>
  [...el.shadowRoot!.querySelectorAll(`[part~="${part}"]`)].map(node => node.textContent!.trim());

/** The first visible label text per unit (the stacked label's first child, not the sizers). */
const labels = (el: LyraCounter): string[] =>
  [...el.shadowRoot!.querySelectorAll('[part~="label"] .label-stack > span:first-child')].map(node => node.textContent!.trim());

describe('splitDuration', () => {
  it('rolls larger time into the largest unit and drops time below the smallest', () => {
    const from = new Date('2030-01-01T00:00:00Z');
    const to = new Date(from.getTime() + 2 * 86_400_000 + 3 * 3_600_000 + 4_500);
    expect(splitDuration(from, to, 'hours', 'seconds')).to.deep.equal({ hours: 51, minutes: 0, seconds: 4 });
    expect(splitDuration(from, to, 'days', 'hours')).to.deep.equal({ days: 2, hours: 3 });
  });

  it('treats an end before the start as zero', () => {
    const from = new Date('2030-01-01T00:00:00Z');
    expect(splitDuration(from, new Date(from.getTime() - 5000), 'days', 'seconds')).to.deep.equal({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });

  it('clamps calendar months to the last day of a shorter month', () => {
    expect(addCalendarMonths(new Date(2031, 0, 31), 1).getDate()).to.equal(28);
    const from = new Date(2031, 0, 31, 12);
    const to = new Date(2031, 2, 31, 12);
    expect(splitDuration(from, to, 'years', 'days')).to.deep.include({ years: 0, months: 2, days: 0 });
  });

  it('rounds a countdown up when its smallest unit is months', () => {
    const from = new Date(2031, 0, 1);
    const to = new Date(2031, 1, 15);
    expect(splitDuration(from, to, 'months', 'months', true)).to.deep.equal({ months: 2 });
    expect(splitDuration(from, to, 'months', 'months', false)).to.deep.equal({ months: 1 });
  });
});

describe('<lr-counter>', () => {
  it('renders the remaining units with values, long labels and a named timer', async () => {
    const el = await fixture<LyraCounter>(
      html`<lr-counter label="Sale ends" .date=${new Date(Date.now() + 90_000 + 60 * 60_000 * 25)}></lr-counter>`,
    );
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('timer');
    expect(base.getAttribute('aria-label')).to.equal('Sale ends');
    
    expect(texts(el, 'value').length).to.equal(4);
    
    expect(labels(el)[0]).to.equal('day');
    expect(base.querySelector('.sr-only')!.textContent).to.match(/1 day/);
    expect(base.hasAttribute('aria-live')).to.equal(false);
    expect(el.shadowRoot!.querySelector('[aria-live], [role="status"], [role="alert"]') === null).to.equal(true);
  });

  it('is accessible in its populated state', async () => {
    const el = await fixture<LyraCounter>(
      html`<lr-counter label="Launch" delimiter=":" .date=${new Date(Date.now() + 3_700_000)}></lr-counter>`,
    );
    await expect(el).to.be.accessible();
  });

  it('hides leading zero units unless without-labels keeps them all', async () => {
    const date = new Date(Date.now() + 30_000);
    const hidden = await fixture<LyraCounter>(html`<lr-counter .date=${date}></lr-counter>`);
    expect(texts(hidden, 'unit').length).to.equal(1);
    const clock = await fixture<LyraCounter>(html`<lr-counter without-labels .date=${date}></lr-counter>`);
    expect(texts(clock, 'unit').length).to.equal(4);
    expect(getComputedStyle(clock.shadowRoot!.querySelector('[part="label"]')!).display).to.equal('none');
  });

  it('applies the largest/smallest unit range and falls back when it is invalid', async () => {
    const date = new Date(Date.now() + 2 * 86_400_000 + 5_000);
    const hours = await fixture<LyraCounter>(
      html`<lr-counter largest-unit="hours" smallest-unit="minutes" without-labels .date=${date}></lr-counter>`,
    );
    expect(texts(hours, 'value')).to.deep.equal(['48', '01']);
    const bad = await fixture<LyraCounter>(
      html`<lr-counter largest-unit="seconds" smallest-unit="days" without-labels .date=${date}></lr-counter>`,
    );
    expect(texts(bad, 'value').length).to.equal(4);
  });

  it('formats labels through the effective locale and the format attribute', async () => {
    const date = new Date(Date.now() + 2 * 86_400_000 + 5_500);
    const short = await fixture<LyraCounter>(html`<lr-counter format="short" .date=${date}></lr-counter>`);
    expect(labels(short)[0]).to.match(/^days?$/i);
    expect(labels(short)[1]).to.match(/^hr/);
    const fr = await fixture<LyraCounter>(html`<lr-counter lang="fr" .date=${date}></lr-counter>`);
    expect(labels(fr)[0]).to.equal('jours');
    expect(fr.shadowRoot!.querySelector('.sr-only')!.textContent).to.contain('jours');
  });

  it('shows the delimiter between units and not before the first', async () => {
    const el = await fixture<LyraCounter>(
      html`<lr-counter delimiter=":" without-labels .date=${new Date(Date.now() + 90_000)}></lr-counter>`,
    );
    expect(texts(el, 'delimiter')).to.deep.equal([':', ':', ':']);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.firstElementChild!.getAttribute('part')).to.not.equal('delimiter');
  });

  it('keeps clock-style counters left to right in a right-to-left page', async () => {
    const el = await fixture<LyraCounter>(
      html`<div dir="rtl"><lr-counter without-labels .date=${new Date(Date.now() + 90_000)}></lr-counter></div>`,
    );
    const counter = el.querySelector('lr-counter') as LyraCounter;
    expect(getComputedStyle(counter.shadowRoot!.querySelector('[part="base"]')!).direction).to.equal('ltr');
  });

  it('lets slots replace unit labels and applies valueFormatter without changing the spoken phrase', async () => {
    const el = await fixture<LyraCounter>(html`<lr-counter .date=${new Date(Date.now() + 2 * 86_400_000 + 5_500)}
      .valueFormatter=${(value: number, unit: string) => `${value}${unit[0]}`}>
      <span slot="days">DAYS</span></lr-counter>`);
    const slot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="days"]')!;
    expect(slot.assignedElements()[0]!.textContent).to.equal('DAYS');
    expect(texts(el, 'value')[0]).to.equal('2d');
    expect(el.shadowRoot!.querySelector('.sr-only')!.textContent).to.match(/^2 days/);
  });

  it('counts up from a past date and keeps running', async () => {
    const el = await fixture<LyraCounter>(
      html`<lr-counter direction="up" without-labels .date=${new Date(Date.now() - 65_000)}></lr-counter>`,
    );
    expect(texts(el, 'value').slice(2)).to.deep.equal(['01', '05']);
    await waitUntil(() => texts(el, 'value')[3] !== '05', 'count-up advanced', { timeout: 2500 });
  });

  it('counts down from a duration and emits lr-finish exactly once, then shows the finished slot', async () => {
    const el = await fixture<LyraCounter>(
      html`<lr-counter .duration=${1200}><strong slot="finished">Done</strong></lr-counter>`,
    );
    let finishes = 0;
    el.addEventListener('lr-finish', () => finishes++);
    expect(el.matches(':state(finished)')).to.equal(false);
    const event = await oneEvent(el, 'lr-finish');
    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(el.matches(':state(finished)')).to.equal(true);
    // wait-reason: asserting no second lr-finish fires once the countdown has finished
    await aTimeout(1300);
    expect(finishes).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="base"]') === null).to.equal(true);
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="finished"]')!).display).to.not.equal('none');
  });

  it('is finished without an event when the date had already passed', async () => {
    const el = await fixture<LyraCounter>(html`<lr-counter .date=${new Date(Date.now() - 5000)}></lr-counter>`);
    let finishes = 0;
    el.addEventListener('lr-finish', () => finishes++);
    // wait-reason: asserting an already-passed date never emits lr-finish
    await aTimeout(1200);
    expect(finishes).to.equal(0);
    expect(el.matches(':state(finished)')).to.equal(true);
    expect(texts(el, 'value')).to.deep.equal(['00']);
  });

  it('stops while paused and continues from the time shown', async () => {
    const el = await fixture<LyraCounter>(
      html`<lr-counter paused without-labels .date=${new Date(Date.now() + 100_000)}></lr-counter>`,
    );
    const frozen = texts(el, 'value').join();
    // wait-reason: asserting a paused counter keeps showing the same reading across a tick
    await aTimeout(1300);
    expect(texts(el, 'value').join()).to.equal(frozen);
    el.paused = false;
    await el.updateComplete;
    // The paused span moved the target, so resuming continues from the frozen reading.
    expect(texts(el, 'value').join()).to.equal(frozen);
    await waitUntil(() => texts(el, 'value').join() !== frozen, 'resumed', { timeout: 3000 });
  });

  it('clears its timer on disconnect and resumes on reconnect without a second finish', async () => {
    const host = await fixture<HTMLDivElement>(html`<div><lr-counter .duration=${1500}></lr-counter></div>`);
    const el = host.querySelector('lr-counter') as LyraCounter;
    let finishes = 0;
    el.addEventListener('lr-finish', () => finishes++);
    el.remove();
    // wait-reason: asserting a disconnected counter never finishes past its duration
    await aTimeout(1700);
    expect(finishes).to.equal(0);
    host.append(el);
    await oneEvent(el, 'lr-finish');
    // wait-reason: asserting reconnecting does not emit a second lr-finish
    await aTimeout(300);
    expect(finishes).to.equal(1);
  });

  it('restarts a countdown when duration changes after finishing', async () => {
    const el = await fixture<LyraCounter>(html`<lr-counter .duration=${1100}></lr-counter>`);
    await oneEvent(el, 'lr-finish');
    el.duration = 1300;
    await el.updateComplete;
    expect(el.matches(':state(finished)')).to.equal(false);
    await oneEvent(el, 'lr-finish');
  });

  it('shows zeros and never throws for an invalid date', async () => {
    const el = await fixture<LyraCounter>(html`<lr-counter date="not a date" without-labels></lr-counter>`);
    expect(texts(el, 'value').every(value => value === '00')).to.equal(true);
  });
});
