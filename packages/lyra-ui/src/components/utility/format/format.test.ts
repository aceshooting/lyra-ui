import { aTimeout, fixture, expect, html } from '@open-wc/testing';
import './format-number.js';
import './format-date.js';
import './format-bytes.js';
import './relative-time.js';
import type { LyraFormatBytes } from './format-bytes.class.js';
import type { LyraFormatDate } from './format-date.class.js';
import type { LyraFormatNumber } from './format-number.class.js';
import type { LyraRelativeTime } from './relative-time.class.js';

it('formats numbers and bytes through Intl', async () => {
  const el = await fixture(
    html`<div>
      <lr-format-number value="1234.5"></lr-format-number><lr-format-bytes value="1024"></lr-format-bytes>
    </div>`,
  );
  expect(el.querySelector('lr-format-number')?.shadowRoot?.textContent).to.contain('1,234.5');
  expect(el.querySelector('lr-format-bytes')?.shadowRoot?.textContent).to.match(/1\s?kB/i);
});

it('supports the complete mapped number-format vocabulary and both grouping aliases', async () => {
  const percent = (await fixture(html`
    <lr-format-number value="0.25" type="percent" locale="en-US"></lr-format-number>
  `)) as LyraFormatNumber;
  expect(percent.shadowRoot?.textContent?.trim()).to.equal('25%');

  const currency = (await fixture(html`
    <lr-format-number
      value="1234.56"
      type="currency"
      currency="EUR"
      currency-display="code"
      without-grouping
      locale="en-US"
    ></lr-format-number>
  `)) as LyraFormatNumber;
  expect(currency.shadowRoot?.textContent?.trim()).to.equal('EUR\u00a01234.56');

  currency.withoutGrouping = false;
  currency.noGrouping = true;
  await currency.updateComplete;
  expect(currency.shadowRoot?.textContent?.trim()).to.equal('EUR\u00a01234.56');

  const digits = (await fixture(html`
    <lr-format-number
      value="12.3456"
      minimum-integer-digits="3"
      maximum-significant-digits="3"
      locale="en-US"
    ></lr-format-number>
  `)) as LyraFormatNumber;
  expect(digits.shadowRoot?.textContent?.trim()).to.equal('012.3');
});

it('formats dates and relative time', async () => {
  const el = await fixture(html`<div>
    <lr-format-date date="2024-01-01T00:00:00Z" locale="en-US"></lr-format-date>
    <lr-relative-time date="2030-01-01T00:00:00Z" locale="en-US"></lr-relative-time>
  </div>`);
  expect(el.querySelector('lr-format-date')?.shadowRoot?.textContent?.trim()).to.equal(
    new Intl.DateTimeFormat('en-US').format(new Date('2024-01-01T00:00:00Z')),
  );
  expect(el.querySelector('lr-relative-time')?.shadowRoot?.textContent).to.contain('in');
});

it('treats numeric date attributes as epoch milliseconds like numeric properties', async () => {
  const wrapper = await fixture(html`<div>
    <lr-format-date date="0" locale="en-US"></lr-format-date>
    <lr-format-date date="-1" locale="en-US"></lr-format-date>
    <lr-relative-time date="0" locale="en-US"></lr-relative-time>
  </div>`);
  const [epoch, negative] = [...wrapper.querySelectorAll('lr-format-date')] as LyraFormatDate[];
  const relative = wrapper.querySelector('lr-relative-time') as LyraRelativeTime;
  expect(epoch.date).to.equal(0);
  expect(epoch.shadowRoot!.querySelector('time')!.getAttribute('datetime')).to.equal('1970-01-01T00:00:00.000Z');
  expect(negative.date).to.equal(-1);
  expect(negative.shadowRoot!.querySelector('time')!.getAttribute('datetime')).to.equal('1969-12-31T23:59:59.999Z');
  expect(relative.date).to.equal(0);
  expect(relative.shadowRoot!.querySelector('time')!.getAttribute('datetime')).to.equal('1970-01-01T00:00:00.000Z');

  epoch.date = 0;
  await epoch.updateComplete;
  expect(epoch.shadowRoot!.querySelector('time')!.getAttribute('datetime')).to.equal('1970-01-01T00:00:00.000Z');
});

it('keeps ISO strings intact and rejects epochs outside the Date TimeClip boundary', async () => {
  const iso = (await fixture(html`<lr-format-date date="2024-01-01T00:00:00Z"></lr-format-date>`)) as LyraFormatDate;
  expect(iso.date).to.equal('2024-01-01T00:00:00Z');
  expect(iso.shadowRoot!.querySelector('time')!.getAttribute('datetime')).to.equal('2024-01-01T00:00:00.000Z');

  const clipped = (await fixture(
    html`<lr-format-date date="8640000000000001"><span>Invalid date</span></lr-format-date>`,
  )) as LyraFormatDate;
  expect(clipped.date).to.equal(8_640_000_000_000_001);
  expect(clipped.shadowRoot!.querySelectorAll('time').length).to.equal(0);
  expect(clipped.shadowRoot!.querySelectorAll('slot').length).to.equal(1);
});

it('defaults date/relative-time to now and renders machine-readable semantic time elements', async () => {
  const before = Date.now();
  const date = (await fixture(html`<lr-format-date locale="en-US"></lr-format-date>`)) as LyraFormatDate;
  const relative = (await fixture(html`<lr-relative-time locale="en-US"></lr-relative-time>`)) as LyraRelativeTime;
  const after = Date.now();

  const dateTime = date.shadowRoot!.querySelector('time')!;
  const relativeTime = relative.shadowRoot!.querySelector('time')!;
  const dateInstant = new Date(dateTime.getAttribute('datetime')!).getTime();
  const relativeInstant = new Date(relativeTime.getAttribute('datetime')!).getTime();
  expect(dateInstant).to.be.within(before, after);
  expect(relativeInstant).to.be.within(before, after);
  expect(relativeTime.textContent?.trim()).to.not.equal('');
});

it('forwards the complete validated granular date/time vocabulary', async () => {
  const instant = new Date('2024-01-01T00:30:45Z');
  const el = (await fixture(html`
    <lr-format-date
      .date=${instant}
      locale="en-US"
      weekday="short"
      era="short"
      year="2-digit"
      month="2-digit"
      day="2-digit"
      hour="2-digit"
      minute="2-digit"
      second="2-digit"
      time-zone-name="short"
      time-zone="UTC"
      hour-format="24"
    ></lr-format-date>
  `)) as LyraFormatDate;
  const expected = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    era: 'short',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    timeZone: 'UTC',
    hour12: false,
  }).format(instant);
  expect(el.shadowRoot?.querySelector('time')?.textContent).to.equal(expected);
});

it('uses mapped decimal byte scaling with byte/bit and display controls', async () => {
  const bytes = (await fixture(html`
    <lr-format-bytes value="1000" unit="byte" display="short" locale="en-US"></lr-format-bytes>
  `)) as LyraFormatBytes;
  expect(bytes.shadowRoot?.textContent?.trim()).to.match(/^1\s?kB$/i);

  const bits = (await fixture(html`
    <lr-format-bytes value="1000" unit="bit" display="long" locale="en-US"></lr-format-bytes>
  `)) as LyraFormatBytes;
  expect(bits.shadowRoot?.textContent?.trim()).to.match(/^1\s+kilobit$/i);
});

it('supports long/short/narrow relative-time output and machine-readable datetime', async () => {
  const target = new Date(Date.now() + 2 * 86_400_000);
  const el = (await fixture(html`
    <lr-relative-time .date=${target} unit="day" format="narrow" numeric="always" locale="en-US"></lr-relative-time>
  `)) as LyraRelativeTime;
  const expected = new Intl.RelativeTimeFormat('en-US', {
    numeric: 'always',
    style: 'narrow',
  }).format(2, 'day');
  const time = el.shadowRoot!.querySelector('time')!;
  expect(time.textContent).to.equal(expected);
  expect(time.getAttribute('datetime')).to.equal(target.toISOString());
});

it('supports style-based date formatting without mixing Intl option families', async () => {
  const el = await fixture(html`<lr-format-date date="2024-01-01T00:00:00Z" date-style="full"></lr-format-date>`);
  expect(el.shadowRoot?.textContent).to.contain('Monday');
});

it('forwards time-zone through granular and style-based date formatting', async () => {
  const instant = '2024-01-01T00:30:00Z';
  const granular = (await fixture(html`
    <lr-format-date
      date=${instant}
      locale="en-US"
      year="numeric"
      month="long"
      day="numeric"
      time-zone="UTC"
    ></lr-format-date>
  `)) as LyraFormatDate;
  expect(granular.timeZone).to.equal('UTC');
  expect(granular.shadowRoot?.textContent).to.contain('January 1, 2024');

  const styled = (await fixture(html`
    <lr-format-date date=${instant} locale="en-US" date-style="full" time-zone="America/Los_Angeles"></lr-format-date>
  `)) as LyraFormatDate;
  expect(styled.shadowRoot?.textContent).to.contain('Sunday, December 31, 2023');

  styled.timeZone = 'UTC';
  await styled.updateComplete;
  expect(styled.shadowRoot?.textContent).to.contain('Monday, January 1, 2024');
});

it('falls back to the browser time zone when time-zone is invalid instead of throwing', async () => {
  const el = await fixture(html`
    <lr-format-date date="2024-01-01T00:30:00Z" locale="en-US" time-zone="Not/AZone"></lr-format-date>
  `);
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
});

it('falls back safely for invalid Intl number/date/relative-time option values', async () => {
  const number = (await fixture(html`<lr-format-number value="1234"></lr-format-number>`)) as LyraFormatNumber;
  number.notation = 'invalid' as Intl.NumberFormatOptions['notation'];
  number.type = 'currency';
  number.currency = 'not-a-currency';
  await number.updateComplete;
  expect(number.shadowRoot?.textContent?.trim()).to.not.equal('');

  const date = (await fixture(html` <lr-format-date date="2024-01-01T00:00:00Z"></lr-format-date> `)) as LyraFormatDate;
  date.year = 'invalid' as Intl.DateTimeFormatOptions['year'];
  date.dateStyle = 'invalid' as Intl.DateTimeFormatOptions['dateStyle'];
  await date.updateComplete;
  expect(date.shadowRoot?.textContent?.trim()).to.not.equal('');

  const relative = (await fixture(html`
    <lr-relative-time date="2030-01-01T00:00:00Z"></lr-relative-time>
  `)) as LyraRelativeTime;
  relative.unit = 'invalid' as LyraRelativeTime['unit'];
  relative.numeric = 'invalid' as LyraRelativeTime['numeric'];
  relative.format = 'invalid' as LyraRelativeTime['format'];
  await relative.updateComplete;
  expect(relative.shadowRoot?.textContent?.trim()).to.not.equal('');

  const bytes = (await fixture(html`<lr-format-bytes value="1000"></lr-format-bytes>`)) as LyraFormatBytes;
  bytes.unit = 'invalid' as LyraFormatBytes['unit'];
  bytes.display = 'invalid' as LyraFormatBytes['display'];
  await bytes.updateComplete;
  expect(bytes.shadowRoot?.textContent?.trim()).to.match(/^1\s?kB$/i);
});

it('falls back safely when an explicit locale is invalid', async () => {
  const el = (await fixture(html`
    <lr-format-number value="1234" locale="not_a_locale"></lr-format-number>
  `)) as LyraFormatNumber;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
});

it('formats negative sub-byte values without selecting a negative unit index', async () => {
  const el = (await fixture(html`
    <lr-format-bytes value="-0.5" locale="en-US"></lr-format-bytes>
  `)) as LyraFormatBytes;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.match(/-0\.5\s*byte/i);
});

it('falls back safely when lr-format-bytes receives a malformed locale', async () => {
  const el = (await fixture(html`
    <lr-format-bytes value="1024" locale="not_a_locale"></lr-format-bytes>
  `)) as LyraFormatBytes;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.match(/1\s?kB/i);
});

it('preserves a valid effective locale while discarding invalid number options', async () => {
  const el = (await fixture(html`
    <lr-format-number value="1234.5" locale="ar-EG"></lr-format-number>
  `)) as LyraFormatNumber;
  el.type = 'currency';
  el.currency = 'x';
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.match(/[٠-٩]/);
});

it('preserves a valid effective locale while discarding invalid date options', async () => {
  const el = (await fixture(html`
    <lr-format-date date="2024-01-01T00:00:00Z" locale="ar-EG" time-zone="UTC"></lr-format-date>
  `)) as LyraFormatDate;
  el.year = 'invalid' as Intl.DateTimeFormatOptions['year'];
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.match(/[\u0600-\u06ff]/);
});

it('inherits locale from an ancestor when no explicit locale is set', async () => {
  const el = await fixture(
    html`<div lang="de-DE">
      <lr-format-number value="1234.5"></lr-format-number>
    </div>`,
  );
  expect(el.querySelector('lr-format-number')?.shadowRoot?.textContent).to.contain('1.234,5');
});

it('reacts to a live locale switch', async () => {
  const el = (await fixture(html`
    <lr-format-number value="1234.5" locale="en-US"></lr-format-number>
  `)) as LyraFormatNumber;
  expect(el.shadowRoot?.textContent?.trim()).to.equal('1,234.5');
  el.locale = 'de-DE';
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal('1.234,5');
});

it('schedules sync relative-time at the next rounded unit boundary instead of fixed polling', async () => {
  const originalSetTimeout = window.setTimeout;
  const originalClearTimeout = window.clearTimeout;
  const delays: number[] = [];
  let timer = 0;
  window.setTimeout = ((_handler: TimerHandler, delay?: number) => {
    delays.push(Number(delay));
    timer += 1;
    return timer;
  }) as typeof window.setTimeout;
  window.clearTimeout = (() => {}) as typeof window.clearTimeout;
  try {
    const target = new Date(Date.now() + 100_000);
    const el = (await fixture(html`
      <lr-relative-time .date=${target} unit="minute" numeric="always" sync></lr-relative-time>
    `)) as LyraRelativeTime;
    await el.updateComplete;
    const scheduled = delays.at(-1)!;
    expect(scheduled).to.be.greaterThan(9_000);
    expect(scheduled).to.be.lessThan(11_000);
  } finally {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
  }
});

it('schedules and clears relative-time refreshes through the adopted owner window', async () => {
  const el = (await fixture(html`<lr-relative-time></lr-relative-time>`)) as LyraRelativeTime;
  el.remove();
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('The iframe realm was unavailable.');
  }
  const originalSetTimeout = frameWindow.setTimeout;
  const originalClearTimeout = frameWindow.clearTimeout;
  let scheduledCallback: VoidFunction | undefined;
  const cleared: number[] = [];
  frameWindow.setTimeout = ((handler: TimerHandler): number => {
    scheduledCallback = handler as VoidFunction;
    return 88;
  }) as typeof frameWindow.setTimeout;
  frameWindow.clearTimeout = ((handle?: number): void => {
    if (handle !== undefined) cleared.push(handle);
  }) as typeof frameWindow.clearTimeout;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    el.date = new Date(Date.now() + 100_000);
    el.sync = true;
    await el.updateComplete;
    expect(scheduledCallback, 'the destination window schedules the refresh').to.be.a('function');

    document.adoptNode(el);
    expect(cleared, 'adoption clears through the window that returned the handle').to.include(88);
  } finally {
    frameWindow.setTimeout = originalSetTimeout;
    frameWindow.clearTimeout = originalClearTimeout;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    iframe.remove();
  }
});

it('does not schedule a sync relative-time refresh when the owner document has no associated window', async () => {
  const el = (await fixture(html`
    <lr-relative-time sync .date=${new Date(Date.now() + 60_000)} locale="en-US"></lr-relative-time>
  `)) as LyraRelativeTime;
  await el.updateComplete;
  expect((el as unknown as { timer?: number }).timer, 'a normal window schedules a wake timer').to.not.equal(undefined);

  // `defaultView` is null for a document with no browsing context; shadow it directly on the
  // shared `document` instance (own-property override, restored below) rather than reaching for
  // an actual windowless document, since custom elements never upgrade in one.
  Object.defineProperty(document, 'defaultView', {
    configurable: true,
    get: () => null,
  });
  try {
    el.date = new Date(Date.now() + 120_000); // re-triggers updated() -> schedule()
    await el.updateComplete;
    expect((el as unknown as { timer?: number }).timer, 'no window means nothing to schedule against').to.equal(
      undefined,
    );
  } finally {
    delete (document as unknown as Record<string, unknown>).defaultView;
  }
});

it('safely no-ops for a non-finite date: skips scheduling, reports no relative state, and renders nothing', async () => {
  const el = (await fixture(html`
    <lr-relative-time date="not-a-real-date" sync locale="en-US"></lr-relative-time>
  `)) as LyraRelativeTime;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal('');
  expect(el.shadowRoot?.querySelector('time') === null).to.equal(true);
  expect((el as unknown as { timer?: number }).timer, 'an unparseable date must not schedule a wake timer').to.equal(
    undefined,
  );
});

it('falls back to now when date is explicitly cleared to null (nullish-coalescing default)', async () => {
  const el = (await fixture(html`<lr-relative-time locale="en-US"></lr-relative-time>`)) as LyraRelativeTime;
  const before = Date.now();
  el.date = null as unknown as LyraRelativeTime['date'];
  await el.updateComplete;
  const after = Date.now();
  const time = el.shadowRoot!.querySelector('time')!;
  const instant = new Date(time.getAttribute('datetime')!).getTime();
  expect(instant).to.be.within(before, after);
});

it('schedules an additional previous-unit wake boundary for a past date once auto-selection resolves below the top unit', async () => {
  const originalSetTimeout = window.setTimeout;
  const originalClearTimeout = window.clearTimeout;
  const delays: number[] = [];
  let timer = 0;
  window.setTimeout = ((_handler: TimerHandler, delay?: number) => {
    delays.push(Number(delay));
    timer += 1;
    return timer;
  }) as typeof window.setTimeout;
  window.clearTimeout = (() => {}) as typeof window.clearTimeout;
  try {
    // 2 days ago -> auto-selection resolves to 'day', whose index in the unit list is > 0, which
    // is what makes the past-date branch compute a second (previous-unit) wake candidate.
    const target = new Date(Date.now() - 2 * 86_400_000);
    const el = (await fixture(html`
      <lr-relative-time .date=${target} numeric="always" sync locale="en-US"></lr-relative-time>
    `)) as LyraRelativeTime;
    await el.updateComplete;
    expect(el.shadowRoot?.textContent).to.contain('day');
    const scheduled = delays.at(-1)!;
    expect(scheduled).to.be.greaterThan(0);
    expect(Number.isFinite(scheduled)).to.equal(true);
  } finally {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
  }
});

it('executes the scheduled boundary refresh through a real timer and reschedules the next wake', async () => {
  const el = (await fixture(html`
    <lr-relative-time
      .date=${new Date(Date.now() + 100_000)}
      unit="minute"
      numeric="always"
      locale="en-US"
    ></lr-relative-time>
  `)) as LyraRelativeTime; // sync starts false -> connectedCallback's schedule() is a no-op, no timer yet
  expect((el as unknown as { timer?: number }).timer).to.equal(undefined);

  const originalSetTimeout = window.setTimeout;
  let scheduleCalls = 0;
  let callbackInvocations = 0;
  window.setTimeout = ((handler: TimerHandler, delay?: number): number => {
    scheduleCalls += 1;
    const wrapped = (): void => {
      callbackInvocations += 1;
      (handler as VoidFunction)();
    };
    // Fire through a REAL timer almost immediately (never a fake clock) so the guarded callback
    // body actually runs within the test's lifetime; capped at 2 accelerated rounds so the
    // legitimate reschedule that follows keeps its real (long) delay and never fires.
    return originalSetTimeout(wrapped, scheduleCalls <= 2 ? 0 : delay) as unknown as number;
  }) as typeof window.setTimeout;
  try {
    el.sync = true;
    await el.updateComplete; // the single schedule() call triggered by `sync` changing
    await aTimeout(100);

    expect(callbackInvocations, 'the scheduled boundary callback actually ran').to.be.greaterThan(0);
    expect(
      (el as unknown as { timer?: number }).timer,
      'a fresh timer handle replaced the one that just fired',
    ).to.not.equal(undefined);
  } finally {
    window.setTimeout = originalSetTimeout;
  }
});

it('ignores a stale scheduled callback whose timer/generation no longer match the live schedule (race-safety guard)', async () => {
  const originalSetTimeout = window.setTimeout;
  const originalClearTimeout = window.clearTimeout;
  const handlers: VoidFunction[] = [];
  let handleCounter = 0;
  window.setTimeout = ((handler: TimerHandler): number => {
    handleCounter += 1;
    handlers.push(handler as VoidFunction);
    return handleCounter; // never actually fires through a real timer -- invoked manually below
  }) as typeof window.setTimeout;
  // A clearTimeout that never actually cancels models the exact scenario the guard protects
  // against: a previously scheduled callback keeps existing (and could still fire) even after
  // the component has moved on to a new timer/generation.
  window.clearTimeout = (() => {}) as typeof window.clearTimeout;
  try {
    const el = (await fixture(html`
      <lr-relative-time
        .date=${new Date(Date.now() + 100_000)}
        unit="minute"
        numeric="always"
        sync
        locale="en-US"
      ></lr-relative-time>
    `)) as LyraRelativeTime;
    await el.updateComplete;
    expect(handlers.length, 'the initial connect scheduled at least one callback').to.be.greaterThan(0);
    const staleHandler = handlers.at(-1)!;
    const timerBeforeReschedule = (el as unknown as { timer?: number }).timer;

    // Force a fresh reschedule -- bumps timerGeneration and assigns a new timer handle.
    // `staleHandler` above closed over the now-superseded handle/generation.
    el.date = new Date(Date.now() + 90_000);
    await el.updateComplete;
    const timerAfterReschedule = (el as unknown as { timer?: number }).timer;
    expect(timerAfterReschedule, 'the reschedule produced a new, distinct timer handle').to.not.equal(
      timerBeforeReschedule,
    );

    // Firing the stale callback directly must be a safe no-op: it must not touch the live timer
    // bookkeeping (or trigger a further render/reschedule) despite the never-cancelled timer.
    expect(() => staleHandler()).to.not.throw();
    expect(
      (el as unknown as { timer?: number }).timer,
      'the stale callback left the live timer bookkeeping untouched',
    ).to.equal(timerAfterReschedule);
  } finally {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
  }
});

it('passes undefined (not an empty string) to Intl.RelativeTimeFormat when effectiveLocale resolves empty', async () => {
  const el = (await fixture(html`
    <lr-relative-time date="2030-01-01T00:00:00Z"></lr-relative-time>
  `)) as LyraRelativeTime;
  // effectiveLocale never actually resolves to '' via the public API -- resolveIntlLocale()
  // always falls back to 'en' at worst -- so shadow the protected getter directly on this
  // instance (same technique lr-heatmap's tests use) to exercise the defensive `|| undefined`
  // fallback that keeps an empty string from ever reaching the Intl constructor.
  Object.defineProperty(el, 'effectiveLocale', {
    configurable: true,
    get: () => '',
  });
  try {
    el.requestUpdate();
    await el.updateComplete;
    expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
  } finally {
    delete (el as unknown as Record<string, unknown>).effectiveLocale;
  }
});

it('falls back to the runtime-default relative-time formatter when Intl.RelativeTimeFormat throws for the requested options', async () => {
  const el = (await fixture(html`
    <lr-relative-time date="2030-01-01T00:00:00Z" locale="en-US"></lr-relative-time>
  `)) as LyraRelativeTime;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');

  const original = Intl.RelativeTimeFormat.prototype.format;
  let calls = 0;
  Intl.RelativeTimeFormat.prototype.format = function (
    this: Intl.RelativeTimeFormat,
    ...args: Parameters<typeof original>
  ) {
    calls += 1;
    if (calls === 1) throw new Error('forced Intl.RelativeTimeFormat failure');
    return original.apply(this, args);
  };
  try {
    el.requestUpdate();
    await el.updateComplete;
    expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
    expect(calls, 'both the primary and the runtime-default formatter were invoked').to.be.greaterThan(1);
  } finally {
    Intl.RelativeTimeFormat.prototype.format = original;
  }
});

it('is accessible', async () => {
  const el = await fixture(html`<lr-format-number value="1234.5"></lr-format-number>`);
  await expect(el).to.be.accessible();
});

it('lr-format-date is accessible', async () => {
  const el = await fixture(html`<lr-format-date date="2024-01-01T00:00:00Z" locale="en-US"></lr-format-date>`);
  await expect(el).to.be.accessible();
});

it('lr-format-bytes is accessible', async () => {
  const el = await fixture(html`<lr-format-bytes value="1024"></lr-format-bytes>`);
  await expect(el).to.be.accessible();
});

it('lr-relative-time is accessible', async () => {
  const el = await fixture(html`<lr-relative-time date="2030-01-01T00:00:00Z" locale="en-US"></lr-relative-time>`);
  await expect(el).to.be.accessible();
});

it('falls back to slotted content instead of throwing when value is non-finite', async () => {
  const el = await fixture(html`<lr-format-bytes value="abc">Unknown size</lr-format-bytes>`);
  expect(el.shadowRoot?.textContent?.trim()).to.equal('');
  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  expect(slot != null).to.equal(true);
  expect(el.textContent?.trim()).to.equal('Unknown size');
});

it('falls back gracefully when value is programmatically set to NaN', async () => {
  const el = (await fixture(html`<lr-format-bytes></lr-format-bytes>`)) as LyraFormatBytes;
  el.value = NaN;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal('');
});

it('clamps an out-of-range decimals instead of letting Intl.NumberFormat throw a RangeError (crash regression)', async () => {
  // Intl.NumberFormat's maximumFractionDigits only accepts [0, 100] and throws a RangeError
  // outside that (or for a non-finite value) -- decimals reaches it unguarded pre-fix.
  const el = (await fixture(html`<lr-format-bytes value="123456"></lr-format-bytes>`)) as LyraFormatBytes;

  el.decimals = -1;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
  expect(el.shadowRoot?.textContent).to.not.contain('NaN');

  el.decimals = 500;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');

  el.decimals = NaN;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
});

it('falls back to a safe default unit-step instead of dividing by Math.log(1) === 0 (crash regression)', async () => {
  const el = (await fixture(html`<lr-format-bytes value="123456"></lr-format-bytes>`)) as LyraFormatBytes;
  el.unitStep = 1;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
  expect(el.shadowRoot?.textContent).to.not.contain('NaN');

  el.unitStep = NaN;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
});

it('clamps out-of-range minimum/maximumFractionDigits instead of letting Intl.NumberFormat throw a RangeError (crash regression)', async () => {
  // Both minimumFractionDigits and maximumFractionDigits throw a RangeError outside [0, 100],
  // and throw even when each is individually in range if minimum > maximum -- unguarded pre-fix.
  const el = (await fixture(html`<lr-format-number value="1234.5"></lr-format-number>`)) as LyraFormatNumber;

  el.maximumFractionDigits = -1;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');

  el.maximumFractionDigits = 500;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');

  el.minimumFractionDigits = NaN;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');

  // Individually in-range, but inverted -- reordered rather than left to throw.
  el.minimumFractionDigits = 5;
  el.maximumFractionDigits = 2;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
});

it('clamps integer/significant digit options and orders crossed significant bounds', async () => {
  const el = (await fixture(html`<lr-format-number value="1234.567"></lr-format-number>`)) as LyraFormatNumber;

  el.minimumIntegerDigits = Number.NaN;
  el.minimumSignificantDigits = 500;
  el.maximumSignificantDigits = -1;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');

  el.minimumIntegerDigits = 99;
  el.minimumSignificantDigits = 5;
  el.maximumSignificantDigits = 2;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
  expect(el.shadowRoot?.textContent).to.not.contain('NaN');
});

it('reflects the locale property back to the locale attribute (inherited LyraElement `reflect: true`)', async () => {
  const numberEl = (await fixture(html`<lr-format-number value="1234.5"></lr-format-number>`)) as LyraFormatNumber;
  const dateEl = (await fixture(html`<lr-format-date date="2024-01-01T00:00:00Z"></lr-format-date>`)) as LyraFormatDate;
  const bytesEl = (await fixture(html`<lr-format-bytes value="1024"></lr-format-bytes>`)) as LyraFormatBytes;
  const relativeEl = (await fixture(
    html`<lr-relative-time date="2030-01-01T00:00:00Z"></lr-relative-time>`,
  )) as LyraRelativeTime;
  numberEl.locale = 'de-DE';
  dateEl.locale = 'de-DE';
  bytesEl.locale = 'de-DE';
  relativeEl.locale = 'de-DE';
  await Promise.all([
    numberEl.updateComplete,
    dateEl.updateComplete,
    bytesEl.updateComplete,
    relativeEl.updateComplete,
  ]);
  expect(numberEl.getAttribute('locale')).to.equal('de-DE');
  expect(dateEl.getAttribute('locale')).to.equal('de-DE');
  expect(bytesEl.getAttribute('locale')).to.equal('de-DE');
  expect(relativeEl.getAttribute('locale')).to.equal('de-DE');
});
