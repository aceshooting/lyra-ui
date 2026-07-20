import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './pagination.js';
import type { LyraPagination } from './pagination.js';
import { styles } from './pagination.styles.js';

async function pagination(
  template = html`<lr-pagination total-items="95" page-size="10"></lr-pagination>`,
): Promise<LyraPagination> {
  const el = (await fixture(template)) as LyraPagination;
  await el.updateComplete;
  return el;
}

it('derives pageCount and a localized item-range summary', async () => {
  const el = await pagination();

  expect(el.pageCount).to.equal(10);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal(
    '1–10 of 95 items',
  );
});

it('forwards a host aria-label to the internal navigation landmark', async () => {
  const el = await pagination(html`
    <lr-pagination aria-label="Search result pages" total-items="95"></lr-pagination>
  `);

  expect(el.shadowRoot!.querySelector('nav')!.getAttribute('aria-label')).to.equal(
    'Search result pages',
  );
});

it('is controlled and emits the requested page without mutating page itself', async () => {
  const el = await pagination();
  const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lr-page-change');

  next.click();
  const event = await eventPromise;

  expect(event.detail).to.deep.equal({ page: 2 });
  expect(el.page).to.equal(1);
});

it('announces a page after the controlled value is applied', async () => {
  const el = await pagination();
  el.page = 4;
  await el.updateComplete;

  const liveRegion = el.shadowRoot!.querySelector('[part="live-region"]')!;
  expect(liveRegion.textContent).to.equal('Page 4 of 10');
});

it('commits a valid numeric page jump on Enter', async () => {
  const el = await pagination();
  const input = el.shadowRoot!.querySelector('[part="page-input"]') as HTMLInputElement;
  input.value = '7';
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  const eventPromise = oneEvent(el, 'lr-page-change');

  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
  );
  const event = await eventPromise;
  await el.updateComplete;

  expect(event.detail).to.deep.equal({ page: 7 });
  expect(input.value).to.equal('1');
});

it('forwards public focus and blur to the page input', async () => {
  const el = await pagination();

  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('page-input');
  el.blur();
  expect(el.shadowRoot!.activeElement).to.equal(null);
});

it('bridges internal focus and blur as bubbling, composed host events', async () => {
  const el = await pagination();
  const input = el.shadowRoot!.querySelector('[part="page-input"]') as HTMLInputElement;

  const focusPromise = oneEvent(el, 'focus');
  input.focus();
  const focusEvent = await focusPromise;
  expect(focusEvent.bubbles).to.be.true;
  expect(focusEvent.composed).to.be.true;

  const blurPromise = oneEvent(el, 'blur');
  input.blur();
  const blurEvent = await blurPromise;
  expect(blurEvent.bubbles).to.be.true;
  expect(blurEvent.composed).to.be.true;
});

it('rejects out-of-range and fractional page jumps', async () => {
  const el = await pagination();
  const input = el.shadowRoot!.querySelector('[part="page-input"]') as HTMLInputElement;
  let calls = 0;
  el.addEventListener('lr-page-change', () => calls++);

  for (const value of ['0', '11', '2.5']) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(input.getAttribute('aria-invalid')).to.equal('true');
  }

  expect(calls).to.equal(0);
});

it('disables every control for empty data, disabled, and loading states', async () => {
  const el = await pagination(html`<lr-pagination></lr-pagination>`);
  const controls = () => [
    ...el.shadowRoot!.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input'),
  ];

  expect(el.pageCount).to.equal(0);
  expect(controls().every((control) => control.disabled)).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('0 items');
  await expect(el).to.be.accessible();

  el.totalItems = 10;
  el.disabled = true;
  await el.updateComplete;
  expect(controls().every((control) => control.disabled)).to.equal(true);

  el.disabled = false;
  el.loading = true;
  await el.updateComplete;
  expect(controls().every((control) => control.disabled)).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('true');
});

it('uses singular item text and accepts localized label overrides', async () => {
  const el = await pagination(html`
    <lr-pagination
      total-items="1"
      .strings=${{
        item: 'entry',
        previous: 'Back',
        next: 'Forward',
        paginationPage: 'Result page',
        paginationSummary: '{start}–{end} / {total} {itemLabel}',
      }}
    ></lr-pagination>
  `);

  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal(
    '1–1 / 1 entry',
  );
  expect(
    (el.shadowRoot!.querySelector('[part="previous-button"]') as HTMLButtonElement).ariaLabel,
  ).to.equal('Back');
  expect(
    (el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement).ariaLabel,
  ).to.equal('Forward');
  expect(
    (el.shadowRoot!.querySelector('[part="page-input"]') as HTMLInputElement).ariaLabel,
  ).to.equal('Result page');
});

it('localizes the empty summary as one interpolated message', async () => {
  const el = await pagination(html`
    <lr-pagination
      item-label="résultats"
      .strings=${{ paginationEmptySummary: 'Aucun contenu ({total} {itemLabel})' }}
    ></lr-pagination>
  `);

  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal(
    'Aucun contenu (0 résultats)',
  );
});

it('hides the built-in summary without removing the controls', async () => {
  const el = await pagination(html`
    <lr-pagination total-items="30" hide-summary></lr-pagination>
  `);

  expect(el.shadowRoot!.querySelector('[part="summary"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="next-button"]')).to.exist;
});

it('mirrors the directional icons under RTL', async () => {
  const ltr = await pagination();
  const rtl = await pagination(html`
    <lr-pagination dir="rtl" total-items="95" page-size="10"></lr-pagination>
  `);
  const ltrPrevious = ltr.shadowRoot!.querySelector('[part="previous-icon"]') as HTMLElement;
  const rtlPrevious = rtl.shadowRoot!.querySelector('[part="previous-icon"]') as HTMLElement;

  expect(getComputedStyle(ltrPrevious).transform).to.not.equal(
    getComputedStyle(rtlPrevious).transform,
  );
});

it('stacks its summary and controls in a narrow allocation', async () => {
  const el = await pagination(html`
    <lr-pagination
      style="inline-size: 18rem"
      total-items="95"
      page-size="10"
    ></lr-pagination>
  `);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!).flexDirection).to.equal(
    'column',
  );
});

it('contains long translated labels in a narrow allocation', async () => {
  const el = await pagination(html`
    <lr-pagination
      style="inline-size: 18rem"
      total-items="95"
      page-size="10"
      previous-label="Zur vorherigen Ergebnisseite wechseln"
      next-label="Zur nächsten Ergebnisseite wechseln"
      .strings=${{
        paginationSummary: '{start}–{end} von insgesamt {total} {itemLabel}',
      }}
    ></lr-pagination>
  `);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
  expect(getComputedStyle(base).flexDirection).to.equal('column');
  expect(summary.scrollWidth).to.be.at.most(base.clientWidth);
});

it('is accessible', async () => {
  const el = await pagination();
  await expect(el).to.be.accessible();
});

it('normalizes NaN/negative pageSize and totalItems to an empty, zero-page state instead of NaN', async () => {
  const el = await pagination(html`
    <lr-pagination total-items="95" page-size="10"></lr-pagination>
  `);

  el.pageSize = NaN;
  el.totalItems = -50;
  await el.updateComplete;
  expect(el.pageCount).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('0 items');
});

it('clamps an oversized or negative page to the last/first valid page instead of NaN/out-of-range', async () => {
  const el = await pagination(html`
    <lr-pagination total-items="95" page-size="10"></lr-pagination>
  `);
  const input = el.shadowRoot!.querySelector('[part="page-input"]') as HTMLInputElement;

  el.page = 9999;
  await el.updateComplete;
  expect(input.value).to.equal('10'); // clamped to the last valid page

  el.page = -7;
  await el.updateComplete;
  expect(input.value).to.equal('1'); // clamped to the first valid page

  el.page = NaN;
  await el.updateComplete;
  expect(input.value).to.equal('1'); // non-finite falls back to the first valid page
});

describe('control padding knob (--lr-pagination-control-padding)', () => {
  const nextButton = (el: LyraPagination): HTMLElement =>
    el.shadowRoot!.querySelector('[part="next-button"]') as HTMLElement;
  const pageInput = (el: LyraPagination): HTMLElement | null =>
    el.shadowRoot!.querySelector('[part="page-input"]');

  it('defaults the control padding to var(--lr-space-xs) (4px) identically at every tier', async () => {
    // Byte-identical to today, which hardcoded var(--lr-space-xs) at every tier on both sites.
    for (const size of ['xs', 's', 'm', 'l', 'xl'] as const) {
      const el = await pagination(
        html`<lr-pagination size=${size} total-items="95" page-size="10"></lr-pagination>`,
      );
      expect(getComputedStyle(nextButton(el)).paddingTop, `${size} button`).to.equal('4px');
      const input = pageInput(el);
      if (input) expect(getComputedStyle(input).paddingTop, `${size} input`).to.equal('4px');
    }
  });

  it('applies --lr-pagination-control-padding to both the nav buttons and the page input', async () => {
    const el = await pagination();
    el.style.setProperty('--lr-pagination-control-padding', '9px');
    await el.updateComplete;
    expect(getComputedStyle(nextButton(el)).paddingTop).to.equal('9px');
    const input = pageInput(el);
    if (input) expect(getComputedStyle(input).paddingTop).to.equal('9px');
  });
});

it('resets the native number spin-button on the page-input', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='page-input'\]\s*\{[^}]*appearance:\s*textfield/);
  expect(css).to.match(/\[part='page-input'\]::-webkit-inner-spin-button/);
});
