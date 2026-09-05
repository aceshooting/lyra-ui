import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './date-picker.js';
import './date-input.js';
import '../../data/calendar/calendar.js';
import type { LyraDatePicker, LyraDateRangePreset } from './date-picker.js';
import type { LyraDateInput } from './date-input.js';
import { parseISO, formatISO } from './calendar-core.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

function button(el: LyraDatePicker | LyraDateInput, selector: string): HTMLButtonElement {
  const result = el.shadowRoot!.querySelector<HTMLButtonElement>(selector);
  if (!result) throw new Error(`Missing button ${selector}`);
  return result;
}
async function settle(el: LyraDatePicker | LyraDateInput): Promise<void> {
  await el.updateComplete;
  await el.updateComplete;
}
function press(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
}

describe('calendar admission and lifecycle regressions', () => {
  for (const [attribute, property] of [['label', 'label'], ['hint', 'hint'], ['error-text', 'errorText']] as const) {
    it(`renders date-input after removing ${attribute} and recovers`, async () => {
      const el = await fixture<LyraDateInput>(html`<lr-date-input></lr-date-input>`);
      el.setAttribute(attribute, 'Guidance');
      await settle(el);
      el.removeAttribute(attribute);
      let completed = true;
      try { await settle(el); } catch { completed = false; }
      expect(completed).to.equal(true);
      expect(el[property]).to.equal(null);
      const part = attribute === 'label' ? 'form-control-label' : attribute === 'hint' ? 'hint' : 'error';
      expect(el.shadowRoot!.querySelector<HTMLElement>(`[part="${part}"]`)!.hidden).to.equal(true);
      el.setAttribute(attribute, 'Recovered');
      await settle(el);
      expect(el.shadowRoot!.textContent).to.contain('Recovered');
    });
  }
  it('treats a removed date-picker value as empty while retaining null readback', async () => {
    const el = await fixture<LyraDatePicker>(html`<lr-date-picker value="2026-07-15"></lr-date-picker>`);
    el.removeAttribute('value');
    let completed = true;
    try { await settle(el); } catch { completed = false; }
    expect(completed).to.equal(true);
    expect(el.value).to.equal(null);
    expect(el.selection.from).to.equal(null);
    el.value = '2026-08-01';
    await settle(el);
    expect(button(el, '[part~="day-selected"]').dataset['date']).to.equal('2026-08-01');
  });

  for (const tag of ['lr-date-picker', 'lr-date-input'] as const) {
    it(`${tag} rejects a same-day completion below minRange without accepted events`, async () => {
      const el = tag === 'lr-date-picker'
        ? await fixture<LyraDatePicker>(html`<lr-date-picker mode="range" value="2026-07-15" min-range="3"></lr-date-picker>`)
        : await fixture<LyraDateInput>(html`<lr-date-input mode="range" value="2026-07-15" min-range="3"></lr-date-input>`);
      if (tag === 'lr-date-input') await (el as LyraDateInput).show();
      const picker = tag === 'lr-date-picker' ? el as LyraDatePicker : el.shadowRoot!.querySelector<LyraDatePicker>('lr-date-picker')!;
      await settle(picker);
      const events: string[] = [];
      el.addEventListener('input', () => events.push('input'));
      el.addEventListener('change', () => events.push('change'));
      button(picker, '[data-date="2026-07-15"]').click();
      await settle(el);
      expect(el.value).to.equal('2026-07-15');
      expect(events).to.deep.equal([]);
      button(picker, '[data-date="2026-07-17"]').click();
      await settle(el);
      expect(el.value).to.equal('2026-07-15/2026-07-17');
      expect(events).to.deep.equal(['input', 'change']);
    });
    it(`${tag} disables presets violating endpoint and inclusive length constraints`, async () => {
      const presets: LyraDateRangePreset[] = [
        { label: 'Disabled endpoint', start: '2026-07-13', end: '2026-07-18' },
        { label: 'Too short', start: '2026-07-15', end: '2026-07-15' },
        { label: 'Too long', start: '2026-07-10', end: '2026-07-20' },
        { label: 'Accepted reversed', start: '2026-07-17', end: '2026-07-15' },
      ];
      const el = tag === 'lr-date-picker'
        ? await fixture<LyraDatePicker>(html`<lr-date-picker mode="range" min="2026-07-10" max="2026-07-20" min-range="3" max-range="7" disabled-dates="2026-07-13" .presets=${presets}></lr-date-picker>`)
        : await fixture<LyraDateInput>(html`<lr-date-input mode="range" min="2026-07-10" max="2026-07-20" min-range="3" max-range="7" disabled-dates="2026-07-13" .presets=${presets}></lr-date-input>`);
      if (tag === 'lr-date-input') await (el as LyraDateInput).show();
      const picker = tag === 'lr-date-picker' ? el as LyraDatePicker : el.shadowRoot!.querySelector<LyraDatePicker>('lr-date-picker')!;
      await settle(picker);
      const buttons = [...picker.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="preset-button"]')];
      expect(buttons.map((item) => item.disabled)).to.deep.equal([true, true, true, false]);
      const events: string[] = [];
      el.addEventListener('input', () => events.push('input'));
      el.addEventListener('change', () => events.push('change'));
      buttons[0]!.click();
      expect(events).to.deep.equal([]);
      buttons[3]!.click();
      await settle(el);
      expect(el.value).to.equal('2026-07-15/2026-07-17');
      expect(events).to.deep.equal(['input', 'change']);
      expect(el.appliedPreset === presets[3]).to.equal(true);
    });
  }
  it('clamps explicit presets, resolves open bounds and permits disabled interior days', async () => {
    const presets = [
      { label: 'Clamped', start: '2026-07-01', end: '2026-07-31' },
      { label: 'Open', start: '', end: '' },
    ];
    const el = await fixture<LyraDatePicker>(html`<lr-date-picker mode="range" min="2026-07-10" max="2026-07-20" disabled-dates="2026-07-15" .presets=${presets}></lr-date-picker>`);
    for (const item of el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="preset-button"]')) {
      expect(item.disabled).to.equal(false);
      item.click();
      await settle(el);
      expect(el.value).to.equal('2026-07-10/2026-07-20');
    }
  });
  it('clears preset origin before clear events and on external value changes', async () => {
    const preset = { label: 'Range', start: '2026-07-10', end: '2026-07-12' };
    const el = await fixture<LyraDatePicker>(html`<lr-date-picker mode="range" .presets=${[preset]}></lr-date-picker>`);
    button(el, '[part="preset-button"]').click();
    await settle(el);
    expect(el.appliedPreset === preset).to.equal(true);
    const origins: boolean[] = [];
    for (const event of ['input', 'change']) el.addEventListener(event, () => origins.push(el.appliedPreset === undefined));
    el.clear();
    expect(origins).to.deep.equal([true, true]);
    button(el, '[part="preset-button"]').click();
    await settle(el);
    el.value = '2026-07-14/2026-07-16';
    await settle(el);
    expect(el.appliedPreset === undefined).to.equal(true);
    expect(origins.length).to.equal(4);
  });
  it('omits blank preset labels while keeping literal named siblings', async () => {
    const el = await fixture<LyraDatePicker>(html`<lr-date-picker mode="range" min="2026-07-10" max="2026-07-20" .presets=${['', '  \n ', ' Named '].map((label) => ({ label }))}></lr-date-picker>`);
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="preset-button"]')];
    expect(buttons.map((item) => item.textContent!.trim())).to.deep.equal(['Named']);
    buttons[0]!.click();
    expect(el.value).to.equal('2026-07-10/2026-07-20');
  });
  it('repairs background constraints without stealing unrelated focus, but recovers an owned day', async () => {
    const wrap = await fixture<HTMLDivElement>(html`<div><input id="outside"><lr-date-picker value="2026-07-15"></lr-date-picker></div>`);
    const el = wrap.querySelector<LyraDatePicker>('lr-date-picker')!;
    const outside = wrap.querySelector<HTMLInputElement>('input')!;
    outside.focus();
    el.min = '2026-07-20';
    await settle(el);
    expect(document.activeElement?.id).to.equal('outside');
    expect(button(el, '[part~="day"][tabindex="0"]').dataset['date']).to.equal('2026-07-20');
    el.focus();
    el.min = '2026-07-22';
    await settle(el);
    expect(el.shadowRoot!.activeElement?.getAttribute('data-date')).to.equal('2026-07-22');
  });
  for (const view of ['days', 'months', 'years', 'decades'] as const) {
    it(`rehomes ${view} into distant explicit valid bounds with bounded predicate work`, async () => {
      let calls = 0;
      const el = await fixture<LyraDatePicker>(html`<lr-date-picker value="2026-07-15" .view=${view}></lr-date-picker>`);
      el.min = '9000-06-15';
      el.max = '9000-06-15';
      el.isDateDisabled = () => { calls++; return false; };
      await settle(el);
      const stop = button(el, '[tabindex="0"]');
      const date = stop.dataset['date'] ?? stop.dataset['viewStart'];
      expect(date?.startsWith('9000-')).to.equal(true);
      expect(stop.disabled).to.equal(false);
      expect(calls).to.be.lessThan(100);
      el.isDateDisabled = () => true;
      await settle(el);
      expect(el.shadowRoot!.querySelectorAll('[tabindex="0"]:not(:disabled)').length).to.equal(0);
    });
  }
  for (const [value, key, nav] of [['0000-01-01', 'ArrowLeft', 'previous'], ['9999-12-31', 'ArrowRight', 'next']] as const) {
    for (const view of ['days', 'months', 'years', 'decades'] as const) {
      it(`keeps ${view} navigation round-trippable at ${value}`, async () => {
        const el = await fixture<LyraDatePicker>(html`<lr-date-picker .value=${value} .view=${view} with-outside-days></lr-date-picker>`);
        const stop = button(el, '[tabindex="0"]');
        stop.focus();
        press(stop, key);
        await settle(el);
        const focused = el.shadowRoot!.activeElement as HTMLElement;
        const anchor = focused?.dataset['date'] ?? focused?.dataset['viewStart'];
        expect(typeof anchor).to.equal('string');
        expect(parseISO(anchor!) !== null).to.equal(true);
        expect(formatISO(parseISO(anchor!)!)).to.equal(anchor);
        expect(el.shadowRoot!.querySelectorAll('[tabindex="0"]:not(:disabled)').length).to.equal(1);
        button(el, `[part="${nav}"]`).click();
        await settle(el);
        expect(el.shadowRoot!.querySelectorAll('[tabindex="0"]:not(:disabled)').length).to.equal(1);
        expect(el.value).to.equal(value);
      });
    }
  }
});

describe('calendar labels and rendered styles', () => {
  for (const [property, attribute, selector, key, initial] of [
    ['previousLabel', 'previous-label', '[part="previous"]', 'previousMonth', 'Previous month'],
    ['nextLabel', 'next-label', '[part="next"]', 'nextMonth', 'Next month'],
  ] as const) {
    it(`preserves ${property} authorship and default readback`, async () => {
      const el = await fixture<LyraDatePicker>(html`<lr-date-picker .strings=${{ [key]: 'Translated' }}></lr-date-picker>`);
      expect(el[property]).to.equal(initial);
      expect(button(el, selector).getAttribute('aria-label')).to.equal('Translated');
      for (const value of [initial, 'Custom', '']) {
        el[property] = value;
        await settle(el);
        expect(button(el, selector).getAttribute('aria-label')).to.equal(value);
      }
      el.setAttribute(attribute, 'Attribute');
      el.removeAttribute(attribute);
      await settle(el);
      expect(el[property]).to.equal(null);
      expect(button(el, selector).getAttribute('aria-label')).to.equal('Translated');
    });
  }
  for (const [property, attribute, selector, key, initial, english] of [
    ['clearLabel', 'clear-label', '[part="clear-button"]', 'clear', '', 'Clear'],
    ['openLabel', 'open-label', '[part="expand-button"]', 'openCalendar', '', 'Open calendar'],
    ['dialogLabel', 'dialog-label', '[part="popup"]', 'chooseDate', 'Choose date', 'Choose date'],
  ] as const) {
    it(`preserves date-input ${property} authorship and default readback`, async () => {
      const el = await fixture<LyraDateInput>(html`<lr-date-input value="2026-07-15" with-clear .strings=${{ [key]: 'Translated' }}></lr-date-input>`);
      expect(el[property]).to.equal(initial);
      expect(button(el, selector).getAttribute('aria-label')).to.equal('Translated');
      for (const value of [english, 'Custom', '']) {
        el[property] = value;
        await settle(el);
        expect(button(el, selector).getAttribute('aria-label')).to.equal(value);
      }
      el.setAttribute(attribute, 'Attribute');
      el.removeAttribute(attribute);
      await settle(el);
      expect(el[property]).to.equal(null);
      expect(button(el, selector).getAttribute('aria-label')).to.equal('Translated');
    });
  }
  it('projects live external descriptions before local date-input guidance', async () => {
    const wrap = await fixture<HTMLDivElement>(html`<div><p id="help">External</p><lr-date-input aria-describedby="help missing" hint="Hint" error-text="Error"></lr-date-input></div>`);
    const el = wrap.querySelector<LyraDateInput>('lr-date-input')!;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('input')!;
    const targets = (): readonly Element[] => Reflect.get(input, 'ariaDescribedByElements') ?? [];
    await waitUntil(() => targets().some((target) => target.id === 'help'));
    expect(targets().map((target) => target.id)).to.deep.equal(['help', 'date-input-error', 'date-input-hint']);
    const replacement = document.createElement('p');
    replacement.id = 'help';
    replacement.textContent = 'Replacement';
    wrap.querySelector('#help')!.replaceWith(replacement);
    await waitUntil(() => targets()[0] === replacement);
    replacement.remove();
    await waitUntil(() => targets().length === 2);
    wrap.prepend(replacement);
    await waitUntil(() => targets()[0] === replacement);
    el.removeAttribute('aria-describedby');
    await waitUntil(() => targets().length === 2);
    el.remove();
    el.setAttribute('aria-describedby', 'help');
    wrap.append(el);
    await waitUntil(() => targets()[0] === replacement);
    el.hint = '';
    await settle(el);
    await waitUntil(() => targets().length === 2);
    expect(targets().map((target) => target.id)).to.deep.equal(['help', 'date-input-error']);
  });
  it('names an encompassing group while keeping two distinct month names and author role', async () => {
    const el = await fixture<LyraDatePicker>(html`<lr-date-picker value="2026-07-15" months="2" aria-label="Departure" role="application"></lr-date-picker>`);
    const group = el.shadowRoot!.querySelector<HTMLElement>('[role="group"]');
    expect(group !== null).to.equal(true);
    expect(group!.getAttribute('aria-label')).to.equal('Departure');
    expect(el.getAttribute('role')).to.equal('application');
    const ids = [...el.shadowRoot!.querySelectorAll('[role="grid"]')].map((grid) => grid.getAttribute('aria-labelledby'));
    expect(new Set(ids).size).to.equal(2);
    const names = ids.map((id) => el.shadowRoot!.getElementById(id!)!.textContent!.trim());
    expect(new Set(names).size).to.equal(2);
    el.setAttribute('aria-label', 'Return');
    await waitUntil(() => group!.getAttribute('aria-label') === 'Return');
    el.view = 'years';
    await settle(el);
    expect(el.shadowRoot!.querySelector('[role="grid"]')!.getAttribute('aria-label')!.length > 0).to.equal(true);
    el.removeAttribute('aria-label');
    await waitUntil(() => !group!.hasAttribute('aria-label'));
  });
  for (const view of ['months', 'years', 'decades'] as const) {
    it(`keeps common ${view} button metrics for ordinary, today, selected and disabled states`, async () => {
      const el = await fixture<LyraDatePicker>(html`<lr-date-picker value="2026-07-15" today=${view === 'months' ? '2026-08-15' : view === 'years' ? '2027-08-15' : '2037-08-15'} .view=${view} style="font-size: 20px; --lr-icon-button-size: 40px; --lr-space-s: 12px;"></lr-date-picker>`);
      const inspect = (): void => {
        for (const item of el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="view-item"]')) {
          const style = getComputedStyle(item);
          expect(style.fontSize).to.equal('20px');
          expect(style.paddingTop).to.equal('12px');
          expect(style.borderTopWidth).to.equal('0px');
          expect(item.getBoundingClientRect().height).to.be.at.least(40);
        }
      };
      inspect();
      el.disabled = true;
      await settle(el);
      inspect();
    });
  }
  for (const dir of ['ltr', 'rtl']) {
    it(`wraps unbroken preset labels at 320px in ${dir}`, async () => {
      const wrap = await fixture<HTMLDivElement>(html`<div dir=${dir} style="inline-size:320px"><lr-date-picker mode="range" months="2" min="2026-07-01" max="2026-07-31" .presets=${[{ label: 'Long'.repeat(60) }]}></lr-date-picker></div>`);
      const el = wrap.querySelector<LyraDatePicker>('lr-date-picker')!;
      await settle(el);
      const item = button(el, '[part="preset-button"]');
      expect(wrap.scrollWidth).to.be.at.most(321);
      expect(item.scrollWidth).to.be.at.most(item.clientWidth + 1);
      expect(item.getBoundingClientRect().height).to.be.at.least(24);
      expect(item.textContent).to.contain('Long'.repeat(60));
    });
  }
  for (const value of ['2026-07-15', '2026-07-15/2026-07-18']) {
    it(`honors author hover and active backgrounds on selected dates for ${value}`, async () => {
      const el = await fixture<LyraDatePicker>(html`<lr-date-picker
        style="--lr-date-picker-selected-bg:rgb(40,50,60);--lr-date-picker-day-hover-bg:rgb(1,2,3);--lr-date-picker-day-active-bg:rgb(10,20,30)"
        .mode=${value.includes('/') ? 'range' : 'single'} .value=${value}></lr-date-picker>`);
      const selectedDays = el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="day-selected"], [part~="day-range-start"], [part~="day-range-end"]');
      expect(selectedDays.length).to.equal(value.includes('/') ? 2 : 1);
      for (const selected of selectedDays) {
        expect(getComputedStyle(selected).backgroundColor).to.equal('rgb(40, 50, 60)');
        try {
          await hoverUntilMatched(selected, 'custom selected day hover');
          await waitUntil(() => getComputedStyle(selected).backgroundColor === 'rgb(1, 2, 3)');
          await sendMouse({ type: 'down' });
          await waitUntil(() => selected.matches(':active'));
          await waitUntil(() => getComputedStyle(selected).backgroundColor === 'rgb(10, 20, 30)');
        } finally { await sendMouse({ type: 'move', position: [0, 0] }); await resetMouse(); }
      }
    });
    it(`retains selected foreground/background pairing through hover and press for ${value}`, async () => {
      const el = await fixture<LyraDatePicker>(html`<lr-date-picker .mode=${value.includes('/') ? 'range' : 'single'} .value=${value}></lr-date-picker>`);
      for (const selected of el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="day-selected"]')) {
        const rest = getComputedStyle(selected).backgroundColor;
        const foreground = getComputedStyle(selected).color;
        try {
          await hoverUntilMatched(selected, 'selected day hover');
          expect(getComputedStyle(selected).backgroundColor).to.equal(rest);
          expect(getComputedStyle(selected).color).to.equal(foreground);
          await sendMouse({ type: 'down' });
          await waitUntil(() => selected.matches(':active'));
          expect(getComputedStyle(selected).backgroundColor).to.equal(rest);
          expect(getComputedStyle(selected).color).to.equal(foreground);
        } finally { await sendMouse({ type: 'move', position: [0, 0] }); await resetMouse(); }
      }
    });
  }
});

for (const view of ['months', 'years', 'decades'] as const) {
  for (const bound of ['0001-06-15', '9000-06-15']) {
    it(`rehomes an unselected ${view} page directly into the distant ${bound} domain`, async () => {
      const el = await fixture<LyraDatePicker>(html`<lr-date-picker .view=${view}></lr-date-picker>`);
      el.min = bound;
      el.max = bound;
      await settle(el);
      const stop = button(el, '[part~="view-item"][tabindex="0"]');
      expect(stop.disabled).to.equal(false);
      const date = parseISO(stop.dataset['viewStart']!)!;
      const span = view === 'months' ? 1 : view === 'years' ? 12 : 120;
      const end = new Date(date);
      end.setMonth(end.getMonth() + span);
      expect(date <= parseISO(bound)! && parseISO(bound)! < end).to.equal(true);
    });
  }
}
it('does not reclaim repaired day focus after another update participant focuses an outside input', async () => {
  const wrap = await fixture<HTMLDivElement>(html`<div><input id="continuation-target"><lr-date-picker value="2026-07-15"></lr-date-picker></div>`);
  const el = wrap.querySelector<LyraDatePicker>('lr-date-picker')!;
  const outside = wrap.querySelector<HTMLInputElement>('input')!;
  el.focus();
  el.addController({ hostUpdated() { outside.focus(); } });
  el.min = '2026-07-20';
  await settle(el);
  expect(document.activeElement?.id).to.equal('continuation-target');
  expect(button(el, '[part~="day"][tabindex="0"]').dataset['date']).to.equal('2026-07-20');
});
it('rebases date-input descriptions when adopted into another document', async () => {
  const wrap = await fixture<HTMLDivElement>(html`<div><p id="adoption-help">Original</p><lr-date-input aria-describedby="adoption-help pending-help" hint="Local"></lr-date-input><iframe title="Description destination"></iframe></div>`);
  const el = wrap.querySelector<LyraDateInput>('lr-date-input')!;
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  const targets = (): readonly Element[] => Reflect.get(input, 'ariaDescribedByElements') ?? [];
  await waitUntil(() => targets()[0]?.textContent === 'Original');
  const destination = wrap.querySelector('iframe')!.contentDocument!;
  const target = destination.createElement('p');
  target.id = 'adoption-help';
  target.textContent = 'Adopted';
  destination.body.append(target, el);
  await waitUntil(() => targets()[0] === target);
  const pending = destination.createElement('p');
  pending.id = 'pending-help';
  destination.body.append(pending);
  await waitUntil(() => targets()[1] === pending);
  expect(targets().map((item) => item.id)).to.deep.equal(['adoption-help', 'pending-help', 'date-input-hint']);
  el.remove();
});


/** Composite the uniform pointer overlay over its actual rendered fill before measuring contrast. */
function paintedContrast(target: HTMLElement): number {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d')!;
  const style = getComputedStyle(target);
  context.fillStyle = style.backgroundColor;
  context.fillRect(0, 0, 1, 1);
  if (style.backgroundImage.startsWith('linear-gradient(')) {
    const stops = style.backgroundImage.slice('linear-gradient('.length);
    let depth = 0;
    let end = 0;
    for (; end < stops.length; end++) {
      const char = stops[end];
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (char === ',' && depth === 0) break;
    }
    context.fillStyle = stops.slice(0, end);
    context.fillRect(0, 0, 1, 1);
  }
  const background = context.getImageData(0, 0, 1, 1).data;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = style.color;
  context.fillRect(0, 0, 1, 1);
  const foreground = context.getImageData(0, 0, 1, 1).data;
  const luminance = (pixel: Uint8ClampedArray): number => {
    const channels = [pixel[0]!, pixel[1]!, pixel[2]!].map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  const values = [luminance(background), luminance(foreground)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}
for (const theme of ['light', 'dark']) {
  it(`keeps selected and brand-colored actions readable through pointer states in ${theme}`, async () => {
    const wrap = await fixture<HTMLDivElement>(html`<div>
      <lr-date-picker data-lr-theme=${theme} value="2026-07-15"></lr-date-picker>
      <lr-calendar data-lr-theme=${theme} view="agenda" view-date="2026-07-01" .events=${[{ date: '2026-07-15', title: 'Meeting', color: 'var(--lr-color-brand)' }]}></lr-calendar>
    </div>`);
    for (const host of wrap.children) {
      const target = host.shadowRoot!.querySelector<HTMLElement>('[part~="day-selected"], [part="agenda-event"]')!;
      expect(paintedContrast(target), 'resting contrast').to.be.at.least(4.5);
      try {
        await hoverUntilMatched(target, 'colored action hover');
        expect(paintedContrast(target), 'hover contrast').to.be.at.least(4.5);
        await sendMouse({ type: 'down' });
        await waitUntil(() => target.matches(':active'));
        expect(paintedContrast(target), 'pressed contrast').to.be.at.least(4.5);
      } finally { await sendMouse({ type: 'move', position: [0, 0] }); await resetMouse(); }
    }
  });
}
