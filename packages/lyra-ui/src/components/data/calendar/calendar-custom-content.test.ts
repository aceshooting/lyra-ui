import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../../lr-calendar.js';
import type { LyraCalendar, LyraCalendarDayContext } from '../../lr-calendar.js';
import { readCanvasRgba } from '../../../internal/canvas-color.js';
import { contrastRatio } from '../../../internal/color-math.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const rgb = (css: string): [number, number, number] => {
  const value = readCanvasRgba(document, css);
  expect(value, `expected ${css} to resolve`).to.not.equal(undefined);
  return [value![0], value![1], value![2]];
};

const eventIn = (el: LyraCalendar, date: string): HTMLElement =>
  el.shadowRoot!.querySelector(`[data-date="${date}"] [part="event"]`) as HTMLElement;

const contrastOf = (node: Element): number => {
  const style = getComputedStyle(node);
  return contrastRatio(rgb(style.color), rgb(style.backgroundColor));
};

describe('lr-calendar event text color', () => {
  it('keeps the unchanged brand pairing and no inline foreground for an uncolored event', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-07-01"></lr-calendar>`);
    el.events = [{ date: '2026-07-15', title: 'Plain' }];
    await el.updateComplete;
    const marker = eventIn(el, '2026-07-15');
    expect(marker.style.color).to.equal('');
    expect(marker.style.backgroundColor).to.equal('');
    const probe = document.createElement('span');
    el.shadowRoot!.append(probe);
    probe.style.color = 'var(--lr-color-on-brand)';
    probe.style.backgroundColor = 'var(--lr-color-brand)';
    const expected = getComputedStyle(probe);
    expect(getComputedStyle(marker).color).to.equal(expected.color);
    expect(getComputedStyle(marker).backgroundColor).to.equal(expected.backgroundColor);
    probe.remove();
  });

  it('paints uncolored events from the public fill and text tokens', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar
      view-date="2026-07-01"
      style="--lr-calendar-event-bg: rgb(250, 240, 200); --lr-calendar-event-color: rgb(20, 30, 40);"
    ></lr-calendar>`);
    el.events = [{ date: '2026-07-15', title: 'Tokened' }];
    await el.updateComplete;
    const style = getComputedStyle(eventIn(el, '2026-07-15'));
    expect(style.backgroundColor).to.equal('rgb(250, 240, 200)');
    expect(style.color).to.equal('rgb(20, 30, 40)');
  });

  it('applies a per-event textColor in month and agenda views', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-07-01"></lr-calendar>`);
    el.events = [
      { date: '2026-07-15', title: 'Explicit', color: 'rgb(255, 230, 230)', textColor: 'rgb(120, 0, 0)' },
      { date: '2026-07-16', title: 'Text only', textColor: 'rgb(0, 60, 0)' },
    ];
    await el.updateComplete;
    expect(getComputedStyle(eventIn(el, '2026-07-15')).color).to.equal('rgb(120, 0, 0)');
    expect(getComputedStyle(eventIn(el, '2026-07-15')).backgroundColor).to.equal('rgb(255, 230, 230)');
    expect(getComputedStyle(eventIn(el, '2026-07-16')).color).to.equal('rgb(0, 60, 0)');
    el.view = 'agenda';
    await el.updateComplete;
    const [explicit, textOnly] = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="agenda-event"]');
    expect(getComputedStyle(explicit!).color).to.equal('rgb(120, 0, 0)');
    expect(getComputedStyle(explicit!).backgroundColor).to.equal('rgb(255, 230, 230)');
    expect(getComputedStyle(textOnly!).color).to.equal('rgb(0, 60, 0)');
  });

  it('rejects an unsafe textColor', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-07-01"></lr-calendar>`);
    el.events = [{ date: '2026-07-15', title: 'Bad', textColor: 'red; position: fixed' }];
    await el.updateComplete;
    const marker = eventIn(el, '2026-07-15');
    expect(marker.style.position).to.equal('');
    expect(marker.style.color).to.equal('');
  });

  it('derives a readable foreground for light and dark custom fills', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-07-01"></lr-calendar>`);
    el.events = [
      { date: '2026-07-14', title: 'Quiet', color: '#dbeafe' },
      { date: '2026-07-15', title: 'Yellow', color: 'rgb(255, 235, 59)' },
      { date: '2026-07-16', title: 'Navy', color: '#0b2545' },
      { date: '2026-07-17', title: 'Translucent', color: 'rgba(0, 0, 0, 0.05)' },
    ];
    await el.updateComplete;
    for (const date of ['2026-07-14', '2026-07-15', '2026-07-16']) {
      expect(contrastOf(eventIn(el, date)), date).to.be.at.least(4.5);
    }
    // A nearly transparent fill reads over the surface, so the derived text must not be the
    // light on-brand color.
    const translucent = getComputedStyle(eventIn(el, '2026-07-17'));
    const surfaceProbe = document.createElement('span');
    el.shadowRoot!.append(surfaceProbe);
    surfaceProbe.style.color = 'var(--lr-color-surface)';
    const surface = rgb(getComputedStyle(surfaceProbe).color);
    surfaceProbe.remove();
    expect(contrastRatio(rgb(translucent.color), surface)).to.be.at.least(4.5);

    el.view = 'agenda';
    await el.updateComplete;
    for (const node of [...el.shadowRoot!.querySelectorAll('[part="agenda-event"]')].slice(0, 3)) {
      expect(contrastOf(node), node.textContent ?? '').to.be.at.least(4.5);
    }
  });

  it('re-derives the foreground when the theme tokens change', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-07-01"></lr-calendar>`);
    el.events = [{ date: '2026-07-15', title: 'Quiet', color: '#dbeafe' }];
    await el.updateComplete;
    expect(contrastOf(eventIn(el, '2026-07-15'))).to.be.at.least(4.5);
    el.style.setProperty('--lr-color-text', 'rgb(230, 230, 230)');
    el.style.setProperty('--lr-color-on-brand', 'rgb(240, 240, 240)');
    el.refreshTheme();
    await el.updateComplete;
    expect(contrastOf(eventIn(el, '2026-07-15'))).to.be.at.least(4.5);
  });

  it('is accessible with light custom event fills in both views', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar aria-label="Schedule" view-date="2026-07-01"></lr-calendar>`);
    el.events = [
      { date: '2026-07-15', title: 'Quiet', color: '#dbeafe' },
      { date: '2026-07-16', title: 'Yellow', color: 'rgb(255, 235, 59)' },
      { date: '2026-07-17', title: 'Mint', color: 'hsl(150 60% 85%)' },
    ];
    await el.updateComplete;
    await expect(el).to.be.accessible({ ignoredRules: ['label-content-name-mismatch'] });
    el.view = 'agenda';
    await el.updateComplete;
    await expect(el).to.be.accessible({ ignoredRules: ['label-content-name-mismatch'] });
  });
});

describe('lr-calendar dayContent', () => {
  it('renders nothing extra when unset', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-07-01"></lr-calendar>`);
    expect(el.shadowRoot!.querySelectorAll('[part="day-content"]')).to.have.length(0);
    expect(el.shadowRoot!.querySelectorAll('[part="day"][aria-describedby]')).to.have.length(0);
  });

  it('renders caller content under the day number and describes the cell with it', async () => {
    const contexts: LyraCalendarDayContext[] = [];
    const el = await fixture<LyraCalendar>(html`<lr-calendar
      view-date="2026-07-01"
      value="2026-07-15"
      locale="en-US"
      .events=${[{ date: '2026-07-15', title: 'Standup' }]}
      .dayContent=${(date: Date, context: LyraCalendarDayContext) => {
        contexts.push(context);
        return date.getDate() === 15 ? html`<span class="price">$120</span>` : null;
      }}
    ></lr-calendar>`);
    const cell = el.shadowRoot!.querySelector('[data-date="2026-07-15"]') as HTMLElement;
    const content = cell.querySelector('[part="day-content"]') as HTMLElement;
    expect(content.textContent!.trim()).to.equal('$120');
    expect(cell.querySelector('[part="date"]')!.nextElementSibling).to.equal(content);
    expect(cell.getAttribute('aria-label')).to.equal(
      new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(new Date(2026, 6, 15)),
    );
    expect(cell.getAttribute('aria-describedby')).to.equal(content.id);
    expect(el.shadowRoot!.querySelectorAll('[part="day-content"]')).to.have.length(1);
    expect(el.shadowRoot!.querySelectorAll('[part="day"][aria-describedby]')).to.have.length(1);
    const context = contexts.find((entry) => entry.date === '2026-07-15')!;
    expect(context.selected).to.equal(true);
    expect(context.outside).to.equal(false);
    expect(context.events.map((event) => event.title)).to.deep.equal(['Standup']);
    expect(contexts.find((entry) => entry.date === '2026-06-28')?.outside).to.equal(true);
  });

  it('keeps the grid when the renderer throws', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar
      view-date="2026-07-01"
      .dayContent=${() => { throw new Error('boom'); }}
    ></lr-calendar>`);
    expect(el.shadowRoot!.querySelectorAll('[part="day"]')).to.have.length(42);
    expect(el.shadowRoot!.querySelectorAll('[part="day-content"]')).to.have.length(0);
  });

  it('selects the day when its content is clicked', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar
      view-date="2026-07-01"
      .dayContent=${() => html`<span class="note">Note</span>`}
    ></lr-calendar>`);
    const selected = oneEvent(el, 'lr-date-select');
    (el.shadowRoot!.querySelector('[data-date="2026-07-15"] .note') as HTMLElement).click();
    expect((await selected).detail.date).to.equal('2026-07-15');
  });

  it('does not select the day when an interactive descendant of the content is clicked', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar
      view-date="2026-07-01"
      .dayContent=${() => html`<a href="#x" class="link">Book</a>`}
    ></lr-calendar>`);
    let selections = 0;
    el.addEventListener('lr-date-select', () => selections++);
    const link = el.shadowRoot!.querySelector('[data-date="2026-07-15"] .link') as HTMLElement;
    link.addEventListener('click', (event) => event.preventDefault());
    link.click();
    expect(selections).to.equal(0);
  });

  it('keeps arrow-key grid navigation (mirrored under RTL) with content present', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar
      dir="rtl"
      view-date="2026-07-01"
      value="2026-07-15"
      .dayContent=${() => 'x'}
    ></lr-calendar>`);
    const day = el.shadowRoot!.querySelector('[data-date="2026-07-15"]') as HTMLElement;
    await focusByKeyboard(day);
    await sendKeys({ press: 'ArrowLeft' });
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((el.shadowRoot!.activeElement as HTMLElement).dataset['date']).to.equal('2026-07-16');
  });

  it('is accessible with day content', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar
      aria-label="Schedule"
      view-date="2026-07-01"
      .dayContent=${(date: Date) => (date.getDate() % 5 === 0 ? 'Busy' : undefined)}
    ></lr-calendar>`);
    await expect(el).to.be.accessible({ ignoredRules: ['label-content-name-mismatch'] });
  });
});
