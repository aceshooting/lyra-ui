import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './pagination.js';
import type { LyraPagination } from './pagination.js';
import { styles } from './pagination.styles.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

function sinkElement(politeness: 'polite' | 'assertive'): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`);
}

function sinkTexts(politeness: 'polite' | 'assertive'): string[] {
  const element = sinkElement(politeness);
  return element ? Array.from(element.children).map((child) => child.textContent ?? '') : [];
}

async function pagination(
  template = html`<lr-pagination total="95" page-size="10" with-summary></lr-pagination>`,
): Promise<LyraPagination> {
  const el = (await fixture(template)) as LyraPagination;
  await el.updateComplete;
  return el;
}

/** The editable page-jump field is the compact layout's centrepiece; the default `standard` layout
 *  renders the numbered page list instead. */
async function compactPagination(
  template = html`
    <lr-pagination format="compact" total="95" page-size="10" with-summary></lr-pagination>
  `,
): Promise<LyraPagination> {
  return pagination(template);
}

it('derives the pageCount and totalPages aliases plus a localized item-range summary', async () => {
  const el = await pagination();

  expect(el.pageCount).to.equal(10);
  expect(el.totalPages).to.equal(10);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal(
    '1–10 of 95 items',
  );
});

it('recognizes a pending focus target created in another realm as inside the host', async () => {
  const el = await pagination();
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  try {
    const target = iframe.contentDocument!.createElement('button');
    el.append(target);
    expect(target instanceof Node, 'fixture really crosses constructor realms').to.equal(false);
    const inside = (el as unknown as {
      focusTargetIsInside(target: EventTarget): boolean;
    }).focusTargetIsInside(target);
    expect(inside).to.equal(true);
  } finally {
    iframe.remove();
  }
});

it('publishes the disabled CSS custom state only for the public disabled property', async () => {
  const el = await pagination();

  expect(el.matches(':state(disabled)')).to.equal(false);

  el.loading = true;
  await el.updateComplete;
  expect(el.matches(':state(disabled)')).to.equal(false);

  el.disabled = true;
  await el.updateComplete;
  expect(el.matches(':state(disabled)')).to.equal(true);

  el.disabled = false;
  await el.updateComplete;
  expect(el.matches(':state(disabled)')).to.equal(false);
});

it('forwards a host aria-label to the internal navigation landmark', async () => {
  const el = await pagination(html`
    <lr-pagination aria-label="Search result pages" total="95"></lr-pagination>
  `);

  expect(el.shadowRoot!.querySelector('nav')!.getAttribute('aria-label')).to.equal(
    'Search result pages',
  );
});

it('is controlled and emits the requested page without mutating page itself', async () => {
  const el = await pagination();
  const next = el.shadowRoot!.querySelector('[part~="next-button"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lr-page-change');

  next.click();
  const event = await eventPromise;

  expect(event.detail).to.deep.equal({ page: 2, pageSize: 10 });
  expect(el.page).to.equal(1);
});

it('moves focus to the applied current-page control after navigation is accepted', async () => {
  const applyRequestedPage = (el: LyraPagination): void => {
    el.addEventListener('lr-page-change', (event) => {
      el.page = (event as CustomEvent<{ page: number }>).detail.page;
    });
  };

  const nextPage = await pagination(html`
    <lr-pagination total="200" page-size="10" page="10"></lr-pagination>
  `);
  applyRequestedPage(nextPage);
  const nextButton = nextPage.shadowRoot!.querySelector(
    '[part~="next-button"]',
  ) as HTMLButtonElement;
  nextButton.focus();
  nextButton.click();
  await nextPage.updateComplete;
  const nextCurrent = nextPage.shadowRoot!.querySelector('[part~="page-current"]') as HTMLElement;
  expect(nextCurrent.textContent?.trim()).to.equal('11');
  expect(nextPage.shadowRoot!.activeElement === nextCurrent).to.equal(true);

  const skippedRange = await pagination(html`
    <lr-pagination total="200" page-size="10" page="10" sibling-count="1"></lr-pagination>
  `);
  applyRequestedPage(skippedRange);
  const trailingGap = skippedRange.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="ellipsis"]')[1]!;
  trailingGap.click();
  await skippedRange.updateComplete;
  const gapCurrent = skippedRange.shadowRoot!.querySelector('[part~="page-current"]') as HTMLElement;
  expect(skippedRange.shadowRoot!.activeElement === gapCurrent).to.equal(true);

  const compact = await compactPagination();
  applyRequestedPage(compact);
  (compact.shadowRoot!.querySelector('[part~="next-button"]') as HTMLButtonElement).click();
  await compact.updateComplete;
  expect(compact.shadowRoot!.activeElement === compact.shadowRoot!.querySelector('[part="page-input"]')).to.equal(true);
});

it('does not reclaim focus when an asynchronously accepted request applies after focus left', async () => {
  const wrapper = (await fixture(html`
    <div>
      <lr-pagination total="50" page="2"></lr-pagination>
      <button type="button">Continue elsewhere</button>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-pagination') as LyraPagination;
  const outside = wrapper.querySelector('button') as HTMLButtonElement;
  await el.updateComplete;
  const next = el.shadowRoot!.querySelector('[part~="next-button"]') as HTMLButtonElement;
  let requestedPage = 0;
  el.addEventListener('lr-page-change', (event) => {
    requestedPage = event.detail.page;
  });

  next.focus();
  next.click();
  outside.focus();
  await Promise.resolve();
  expect(requestedPage).to.equal(3);
  expect(document.activeElement === outside).to.equal(true);

  el.page = requestedPage;
  await el.updateComplete;
  expect(document.activeElement === outside).to.equal(true);
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
});

it('does not reclaim focus after a synthetic request when focus later moves outside', async () => {
  const wrapper = (await fixture(html`
    <div>
      <lr-pagination total="50" page="2"></lr-pagination>
      <button type="button">Continue elsewhere</button>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-pagination') as LyraPagination;
  const outside = wrapper.querySelector('button') as HTMLButtonElement;
  await el.updateComplete;
  let requestedPage = 0;
  el.addEventListener('lr-page-change', (event) => {
    requestedPage = event.detail.page;
  });

  (el.shadowRoot!.querySelector('[part~="next-button"]') as HTMLButtonElement).click();
  outside.focus();
  el.page = requestedPage;
  await el.updateComplete;

  expect(requestedPage).to.equal(3);
  expect(document.activeElement === outside).to.equal(true);
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
});

it('clears a pending synthetic focus-follow request when disconnected', async () => {
  const wrapper = (await fixture(html`
    <div>
      <lr-pagination total="50" page="2"></lr-pagination>
      <button type="button">Continue elsewhere</button>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-pagination') as LyraPagination;
  const outside = wrapper.querySelector('button') as HTMLButtonElement;
  await el.updateComplete;
  let requestedPage = 0;
  el.addEventListener('lr-page-change', (event) => {
    requestedPage = event.detail.page;
  });

  (el.shadowRoot!.querySelector('[part~="next-button"]') as HTMLButtonElement).click();
  el.remove();
  wrapper.prepend(el);
  outside.focus();
  el.page = requestedPage;
  await el.updateComplete;

  expect(requestedPage).to.equal(3);
  expect(document.activeElement === outside).to.equal(true);
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
});

it('announces a page after the controlled value is applied', async () => {
  const el = await pagination();
  el.page = 4;
  await el.updateComplete;

  const liveRegion = el.shadowRoot!.querySelector('[part="live-region"]')!;
  expect(liveRegion.textContent).to.equal('Page 4 of 10');
  expect(sinkTexts('polite')).to.deep.equal(['Page 4 of 10']);
  // The retained part is a styling/inspection mirror only -- a live region inside a shadow root is
  // not reliably announced, and leaving it live would double-announce where it *is* honored.
  expect(liveRegion.getAttribute('role')).to.equal(null);
  expect(liveRegion.getAttribute('aria-live')).to.equal(null);
  expect(liveRegion.getAttribute('aria-hidden')).to.equal('true');
});

it('announces the same page again when it is revisited, instead of rewriting one text node', async () => {
  const el = await pagination();
  el.page = 4;
  await el.updateComplete;
  el.page = 5;
  await el.updateComplete;
  el.page = 4;
  await el.updateComplete;
  expect(
    sinkTexts('polite').filter((text) => text === 'Page 4 of 10').length,
    'an identical repeat must be a second addition so assistive tech reads it again',
  ).to.equal(2);
});

it('ref-counts the shared sink away once the last pagination disconnects', async () => {
  const first = await pagination();
  const second = await pagination();
  expect(sinkElement('polite') !== null, 'a connected pagination holds the sink').to.be.true;
  first.remove();
  expect(sinkElement('polite') !== null, 'a still-connected pagination keeps it mounted').to.be.true;
  second.remove();
  expect(sinkElement('polite') === null, 'the last disconnect unmounts it').to.be.true;
});

it('commits a valid numeric page jump on Enter', async () => {
  const el = await compactPagination();
  const input = el.shadowRoot!.querySelector('[part="page-input"]') as HTMLInputElement;
  input.value = '7';
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  const eventPromise = oneEvent(el, 'lr-page-change');

  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
  );
  const event = await eventPromise;
  await el.updateComplete;

  expect(event.detail).to.deep.equal({ page: 7, pageSize: 10 });
  expect(input.value).to.equal('1');
});

it('forwards public focus and blur to the page input', async () => {
  const el = await compactPagination();

  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('page-input');
  el.blur();
  expect(el.shadowRoot!.activeElement).to.equal(null);
});

it('forwards host click to the page input and suppresses it while effectively disabled', async () => {
  const el = await compactPagination();
  const input = el.shadowRoot!.querySelector('[part="page-input"]') as HTMLInputElement;
  let clicks = 0;
  input.addEventListener('click', () => clicks++);

  el.click();
  expect(clicks).to.equal(1);

  el.disabled = true;
  await el.updateComplete;
  el.click();
  expect(clicks).to.equal(1);
});

it('keeps previous and next actions at the shared hit-area floor in every size', async () => {
  for (const size of ['xs', 's', 'm', 'l', 'xl'] as const) {
    const el = await pagination(
      html`<lr-pagination size=${size} total="95" page-size="10"></lr-pagination>`,
    );
    for (const part of ['previous-button', 'next-button']) {
      const button = el.shadowRoot!.querySelector(`[part~="${part}"]`) as HTMLElement;
      expect(button.getBoundingClientRect().width, `${size} ${part}`).to.be.at.least(40);
      expect(button.getBoundingClientRect().height, `${size} ${part}`).to.be.at.least(40);
    }
  }
});

it('relays exactly one native FocusEvent from button, link, and compact controls', async () => {
  const cases = [
    {
      name: 'button',
      template: html`<lr-pagination total="50" page="2"></lr-pagination>`,
      selector: '[part~="next-button"]',
      localName: 'button',
    },
    {
      name: 'link',
      template: html`
        <lr-pagination
          total="50"
          page="2"
          href-template="/results?page={page}"
        ></lr-pagination>
      `,
      selector: '[part~="next-button"]',
      localName: 'a',
    },
    {
      name: 'compact input',
      template: html`<lr-pagination format="compact" total="50" page="2"></lr-pagination>`,
      selector: '[part="page-input"]',
      localName: 'input',
    },
  ] as const;

  for (const testCase of cases) {
    const wrapper = (await fixture(html`
      <div>
        ${testCase.template}
        <button type="button">Related target</button>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-pagination') as LyraPagination;
    await el.updateComplete;
    const control = el.shadowRoot!.querySelector(testCase.selector) as HTMLElement;
    const relatedTarget = wrapper.querySelector('button') as HTMLButtonElement;
    expect(control.localName, testCase.name).to.equal(testCase.localName);

    for (const type of ['focus', 'blur'] as const) {
      const hostEvents: Array<{ event: Event; origin: EventTarget | undefined }> = [];
      const delegatedEvents: Array<{ event: Event; origin: EventTarget | undefined }> = [];
      el.addEventListener(type, (event) => {
        hostEvents.push({ event, origin: event.composedPath()[0] });
      });
      wrapper.addEventListener(type, (event) => {
        delegatedEvents.push({ event, origin: event.composedPath()[0] });
      });

      control.dispatchEvent(
        new FocusEvent(type, {
          bubbles: true,
          composed: true,
          relatedTarget,
          view: window,
          detail: 7,
        }),
      );

      expect(hostEvents.length, `${testCase.name} ${type} host count`).to.equal(1);
      expect(delegatedEvents.length, `${testCase.name} ${type} delegated count`).to.equal(1);
      for (const seen of [hostEvents[0]!, delegatedEvents[0]!]) {
        expect(seen.event.constructor, `${testCase.name} ${type} constructor`).to.equal(FocusEvent);
        expect(seen.event instanceof CustomEvent, `${testCase.name} ${type} is not custom`).to.equal(
          false,
        );
        expect(seen.event.target === el, `${testCase.name} ${type} target`).to.equal(true);
        expect(seen.origin === el, `${testCase.name} ${type} shadow original stopped`).to.equal(true);
        expect(seen.event.bubbles, `${testCase.name} ${type} bubbles`).to.equal(true);
        expect(seen.event.composed, `${testCase.name} ${type} composed`).to.equal(true);
        expect(
          (seen.event as FocusEvent).relatedTarget === relatedTarget,
          `${testCase.name} ${type} relatedTarget`,
        ).to.equal(true);
        expect((seen.event as FocusEvent).view === window, `${testCase.name} ${type} view`).to.equal(
          true,
        );
        expect((seen.event as FocusEvent).detail, `${testCase.name} ${type} detail`).to.equal(7);
      }
    }
  }
});

it('rejects out-of-range and fractional page jumps', async () => {
  const el = await compactPagination();
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
  const el = await pagination(html`<lr-pagination with-summary></lr-pagination>`);
  const controls = () => [
    ...el.shadowRoot!.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input'),
  ];

  expect(el.pageCount).to.equal(0);
  expect(controls().every((control) => control.disabled)).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('0 items');
  await expect(el).to.be.accessible();

  el.total = 10;
  el.disabled = true;
  await el.updateComplete;
  expect(controls().every((control) => control.disabled)).to.equal(true);

  el.disabled = false;
  el.loading = true;
  await el.updateComplete;
  expect(controls().every((control) => control.disabled)).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-busy')).to.equal('true');
});

it('uses singular item text and accepts localized label overrides', async () => {
  const el = await pagination(html`
    <lr-pagination
      format="compact"
      total="1"
      with-summary
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
    (el.shadowRoot!.querySelector('[part~="previous-button"]') as HTMLButtonElement).ariaLabel,
  ).to.equal('Back');
  expect(
    (el.shadowRoot!.querySelector('[part~="next-button"]') as HTMLButtonElement).ariaLabel,
  ).to.equal('Forward');
  expect(
    (el.shadowRoot!.querySelector('[part="page-input"]') as HTMLInputElement).ariaLabel,
  ).to.equal('Result page');
});

it('localizes the empty summary as one interpolated message', async () => {
  const el = await pagination(html`
    <lr-pagination
      item-label="résultats"
      with-summary
      .strings=${{ paginationEmptySummary: 'Aucun contenu ({total} {itemLabel})' }}
    ></lr-pagination>
  `);

  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal(
    'Aucun contenu (0 résultats)',
  );
});

it('omits the built-in summary by default, without removing the controls', async () => {
  // Opt-in, matching `wa-pagination`'s `with-summary`. The attribute used to be `hide-summary`,
  // whose default rendered the row, so a mechanical rename silently added a summary to every
  // migrated pager.
  const el = await pagination(html`
    <lr-pagination total="30"></lr-pagination>
  `);

  expect(el.withSummary).to.equal(false);
  expect(el.shadowRoot!.querySelector('[part="summary"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part~="next-button"]')).to.exist;
});

it('renders the built-in summary when with-summary is set', async () => {
  const el = await pagination(html`
    <lr-pagination total="30" with-summary></lr-pagination>
  `);

  expect(el.shadowRoot!.querySelector('[part="summary"]')).to.exist;
});

it('mirrors the directional icons under RTL', async () => {
  const ltr = await pagination();
  const rtl = await pagination(html`
    <lr-pagination dir="rtl" total="95" page-size="10"></lr-pagination>
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
      total="95"
      page-size="10"
    ></lr-pagination>
  `);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!).flexDirection).to.equal(
    'column',
  );
});

it('contains long translated labels in a narrow allocation', async () => {
  const el = await pagination(html`
    <lr-pagination
      style="inline-size: 18rem"
      total="95"
      page-size="10"
      with-summary
      previous-label="Zur vorherigen Ergebnisseite wechseln"
      next-label="Zur nächsten Ergebnisseite wechseln"
      .strings=${{
        paginationSummary: '{start}–{end} von insgesamt {total} {itemLabel}',
      }}
    ></lr-pagination>
  `);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
  expect(getComputedStyle(base).flexDirection).to.equal('column');
  expect(summary.scrollWidth).to.be.at.most(base.clientWidth);
});

it('is accessible', async () => {
  const el = await pagination();
  await expect(el).to.be.accessible();
});

it('normalizes NaN/negative pageSize and total to an empty, zero-page state instead of NaN', async () => {
  const el = await pagination(html`
    <lr-pagination total="95" page-size="10" with-summary></lr-pagination>
  `);

  el.pageSize = NaN;
  el.total = -50;
  await el.updateComplete;
  expect(el.pageCount).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('0 items');
});

it('clamps an oversized or negative page to the last/first valid page instead of NaN/out-of-range', async () => {
  const el = await pagination(html`
    <lr-pagination format="compact" total="95" page-size="10"></lr-pagination>
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
    el.shadowRoot!.querySelector('[part~="next-button"]') as HTMLElement;
  const pageInput = (el: LyraPagination): HTMLElement | null =>
    el.shadowRoot!.querySelector('[part="page-input"]');

  it('defaults the control padding to var(--lr-space-xs) (4px) identically at every tier', async () => {
    // Byte-identical to today, which hardcoded var(--lr-space-xs) at every tier on both sites.
    for (const size of ['xs', 's', 'm', 'l', 'xl'] as const) {
      const el = await pagination(
        html`<lr-pagination format="compact" size=${size} total="95" page-size="10"></lr-pagination>`,
      );
      expect(getComputedStyle(nextButton(el)).paddingTop, `${size} button`).to.equal('4px');
      const input = pageInput(el);
      if (input) expect(getComputedStyle(input).paddingTop, `${size} input`).to.equal('4px');
    }
  });

  it('applies --lr-pagination-control-padding to both the nav buttons and the page input', async () => {
    const el = await compactPagination();
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

describe('nav button hover specificity', () => {
  it('wraps the internal hover:not(:disabled) rule in :where() so a consumer ::part(...):hover override wins without !important', async () => {
    const el = await pagination();
    const internalRule = (el.shadowRoot!.adoptedStyleSheets ?? [])
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText.replace(/"/g, "'"))
      .find(
        (text) =>
          text.includes(':hover') &&
          (text.includes("[part~='previous-button']") || text.includes("[part~='next-button']")),
      );
    expect(internalRule).to.contain(':where(');
  });

  it('wraps every interactive state qualifier in :where()', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    for (const selector of [
      "[part~='next-button']:where(:hover)",
      "[part~='next-button']:where(:active)",
      "[part~='next-button']:where(:focus-visible)",
      "[part~='next-button']:where(:disabled)",
      "[part~='button']:where([aria-disabled='true'])",
      "[part~='page-current']:where(:hover)",
      "[part~='page-current']:where(:active)",
    ]) {
      expect(css, selector).to.contain(selector);
    }
  });
});

describe('page-input invalid-state specificity (regression)', () => {
  it('wraps the internal [aria-invalid] rule in :where() so a consumer ::part(page-input) border-color override wins', async () => {
    const el = await compactPagination();
    const internalRule = (el.shadowRoot!.adoptedStyleSheets ?? [])
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText.replace(/"/g, "'"))
      .find((text) => text.includes("[part='page-input']") && text.includes("aria-invalid"));
    expect(internalRule).to.contain(':where(');
  });

  it('lets a consumer retint the invalid page-input border via the scoped --lr-pagination-invalid-border cssprop (regression)', async () => {
    const el = await compactPagination();
    el.style.setProperty('--lr-pagination-invalid-border', 'rgb(1, 2, 3)');
    const input = el.shadowRoot!.querySelector('[part="page-input"]') as HTMLInputElement;
    input.value = '0';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(input.getAttribute('aria-invalid')).to.equal('true');
    expect(getComputedStyle(input).borderTopColor).to.equal('rgb(1, 2, 3)');
  });
});

describe('numbered page list', () => {
  function pageNodes(el: LyraPagination): HTMLElement[] {
    return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="page"]')];
  }

  function pageLabels(el: LyraPagination): string[] {
    return pageNodes(el).map((node) => node.textContent!.trim());
  }

  function itemCount(el: LyraPagination): number {
    return el.shadowRoot!.querySelectorAll('[part="pages"] > li').length;
  }

  /** Resolves what `declaration` computes to *inside this component's shadow root*, where the
   *  `--lr-*` tokens live, so an appearance default can be asserted against the token it uses. */
  function resolvedInShadow(el: LyraPagination, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  it('renders every page as its own control when they all fit', async () => {
    const el = await pagination(html`
      <lr-pagination total="50" page-size="10" page="2" sibling-count="1" boundary-count="1"></lr-pagination>
    `);

    expect(el.format).to.equal('standard');
    expect(pageLabels(el)).to.deep.equal(['1', '2', '3', '4', '5']);
    expect(el.shadowRoot!.querySelectorAll('[part~="ellipsis"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="page-input"]').length).to.equal(0);
  });

  it('marks the current page with aria-current and renders the false state on the others', async () => {
    const el = await pagination(html`
      <lr-pagination total="50" page-size="10" page="3" sibling-count="1" boundary-count="1"></lr-pagination>
    `);
    const current = el.shadowRoot!.querySelector('[part~="page-current"]') as HTMLElement;

    expect(current.textContent!.trim()).to.equal('3');
    expect(current.getAttribute('aria-current')).to.equal('page');
    expect(
      pageNodes(el)
        .filter((node) => node !== current)
        .map((node) => node.getAttribute('aria-current')),
    ).to.deep.equal(['false', 'false', 'false', 'false']);
  });

  it('elides long runs and keeps the item count constant as the page moves', async () => {
    const el = await pagination(html`
      <lr-pagination total="200" page-size="10" page="10" sibling-count="1" boundary-count="1"></lr-pagination>
    `);

    expect(pageLabels(el)).to.deep.equal(['1', '9', '10', '11', '20']);
    expect(el.shadowRoot!.querySelectorAll('[part~="ellipsis"]').length).to.equal(2);
    const middleCount = itemCount(el);

    el.page = 1;
    await el.updateComplete;
    expect(itemCount(el), 'the control must not resize as the page changes').to.equal(middleCount);
    el.page = 20;
    await el.updateComplete;
    expect(itemCount(el)).to.equal(middleCount);
    expect(pageLabels(el).at(-1)).to.equal('20');
  });

  it('renders each elided gap as a named control that requests a multi-page jump', async () => {
    const el = await pagination(html`
      <lr-pagination total="200" page-size="10" page="10" sibling-count="1" boundary-count="1"></lr-pagination>
    `);
    const gaps = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="ellipsis"]')];

    expect(gaps.length).to.equal(2);
    for (const gap of gaps) {
      expect(gap.localName).to.equal('button');
      expect(gap.getAttribute('aria-label')).to.match(/^Jump to page \d+$/);
      expect(gap.hasAttribute('aria-current')).to.be.false;
    }
    const request = oneEvent(el, 'lr-page-change');
    gaps[1]!.click();
    expect((await request).detail).to.deep.equal({ page: 14, pageSize: 10 });
    expect(el.page, 'the stronger Lyra API remains controlled').to.equal(10);
  });

  it('widens the window with sibling-count and pins more pages with boundary-count', async () => {
    const el = await pagination(html`
      <lr-pagination total="200" page-size="10" page="10" sibling-count="2" boundary-count="2"></lr-pagination>
    `);

    expect(pageLabels(el)).to.deep.equal(['1', '2', '8', '9', '10', '11', '12', '19', '20']);
  });

  it('emits a page request from a numbered control without mutating page', async () => {
    const el = await pagination(html`
      <lr-pagination total="50" page-size="10" page="1" sibling-count="1"></lr-pagination>
    `);
    const target = pageNodes(el)[3] as HTMLButtonElement;
    const eventPromise = oneEvent(el, 'lr-page-change');

    target.click();
    const event = await eventPromise;

    expect(event.detail).to.deep.equal({ page: 4, pageSize: 10 });
    expect(el.page).to.equal(1);
  });

  it('renders no first/last controls until with-edges is set', async () => {
    const el = await pagination(html`
      <lr-pagination total="50" page-size="10" page="3"></lr-pagination>
    `);
    expect(el.withEdges).to.equal(false);
    expect(el.shadowRoot!.querySelectorAll('[part~="first-button"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part~="last-button"]').length).to.equal(0);
  });

  it('jumps to the first and last page through the edge controls', async () => {
    const el = await pagination(html`
      <lr-pagination total="50" page-size="10" page="3" with-edges></lr-pagination>
    `);
    const first = el.shadowRoot!.querySelector('[part~="first-button"]') as HTMLButtonElement;
    const last = el.shadowRoot!.querySelector('[part~="last-button"]') as HTMLButtonElement;

    const lastRequest = oneEvent(el, 'lr-page-change');
    last.click();
    expect((await lastRequest).detail).to.deep.equal({ page: 5, pageSize: 10 });

    const firstRequest = oneEvent(el, 'lr-page-change');
    first.click();
    expect((await firstRequest).detail).to.deep.equal({ page: 1, pageSize: 10 });

    el.page = 1;
    await el.updateComplete;
    expect(first.disabled, 'the first-page control is spent on page 1').to.equal(true);
    expect(last.disabled).to.equal(false);
  });

  it('renders pages as links from an href-template string, current page excepted', async () => {
    const el = await pagination(html`
      <lr-pagination
        total="50"
        page-size="10"
        page="2"
        href-template="/products?page={page}"
      ></lr-pagination>
    `);
    const nodes = pageNodes(el);

    expect(nodes.map((node) => node.localName)).to.deep.equal(['a', 'a', 'a', 'a', 'a']);
    expect(nodes[0].getAttribute('href')).to.equal('/products?page=1');
    expect(nodes[2].getAttribute('href')).to.equal('/products?page=3');
    expect(nodes[1].hasAttribute('href'), 'the current page is where the reader already is').to.be
      .false;
    expect(nodes[1].getAttribute('aria-current')).to.equal('page');
    // No target, therefore no rel to get wrong.
    expect(nodes[0].hasAttribute('target')).to.be.false;
  });

  it('removes every link-mode tab stop while disabled or loading', async () => {
    const enabled = await pagination(html`
      <lr-pagination
        total="50"
        page="2"
        href-template="/products?page={page}"
      ></lr-pagination>
    `);
    const enabledCurrent = enabled.shadowRoot!.querySelector(
      '[part~="page-current"]',
    ) as HTMLAnchorElement;
    expect(enabledCurrent.localName).to.equal('a');
    expect(enabledCurrent.getAttribute('tabindex')).to.equal('0');

    const inertCases = [
      {
        name: 'disabled',
        template: html`
          <lr-pagination
            total="50"
            page="2"
            href-template="/products?page={page}"
            disabled
          ></lr-pagination>
        `,
      },
      {
        name: 'loading',
        template: html`
          <lr-pagination
            total="50"
            page="2"
            href-template="/products?page={page}"
            loading
          ></lr-pagination>
        `,
      },
    ] as const;

    for (const testCase of inertCases) {
      const el = await pagination(testCase.template);
      const anchors = el.shadowRoot!.querySelectorAll('a');
      expect(anchors.length, `${testCase.name} link branch`).to.be.greaterThan(0);
      expect(
        el.shadowRoot!.querySelectorAll('a[href], a[tabindex="0"]').length,
        `${testCase.name} tab stops`,
      ).to.equal(0);
      expect(
        el.shadowRoot!.querySelector('[part~="page-current"]')!.hasAttribute('tabindex'),
        `${testCase.name} current tabindex`,
      ).to.equal(false);
    }
  });

  it('calls an href-template function only for active valid page targets', async () => {
    const seen: number[] = [];
    const el = await pagination(html`
      <lr-pagination total="50" page="1" with-edges></lr-pagination>
    `);
    el.hrefTemplate = (page: number) => {
      seen.push(page);
      return `/products?page=${page}`;
    };
    await el.updateComplete;

    expect(seen.length).to.be.greaterThan(0);
    expect(
      seen.every((page) => page >= 1 && page <= el.pageCount && page !== el.page),
      'first-page render',
    ).to.equal(true);

    seen.length = 0;
    el.page = el.pageCount;
    await el.updateComplete;
    expect(seen.length).to.be.greaterThan(0);
    expect(
      seen.every((page) => page >= 1 && page <= el.pageCount && page !== el.page),
      'last-page render',
    ).to.equal(true);

    for (const testCase of [
      { name: 'disabled', apply: () => { el.disabled = true; } },
      {
        name: 'loading',
        apply: () => {
          el.disabled = false;
          el.loading = true;
        },
      },
      {
        name: 'empty',
        apply: () => {
          el.loading = false;
          el.total = 0;
        },
      },
    ]) {
      seen.length = 0;
      testCase.apply();
      await el.updateComplete;
      expect(seen.length, `${testCase.name} callback count`).to.equal(0);
      const anchors = [...el.shadowRoot!.querySelectorAll('a')];
      expect(anchors.length, `${testCase.name} configured link branch`).to.be.greaterThan(0);
      expect(
        anchors.every((anchor) => !anchor.hasAttribute('href')),
        `${testCase.name} href omission`,
      ).to.equal(true);
    }
  });

  it('accepts a function href-template and formats the URL page as a plain integer', async () => {
    const el = await pagination(html`
      <lr-pagination locale="ar-EG" total="50" page-size="10" page="1"></lr-pagination>
    `);
    el.hrefTemplate = (page: number) => `#results/${page}`;
    await el.updateComplete;
    const nodes = pageNodes(el);

    expect(nodes[2].getAttribute('href')).to.equal('#results/3');
    expect(nodes[2].textContent!.trim(), 'the visible label is still localized').to.equal(
      new Intl.NumberFormat('ar-EG').format(3),
    );
  });

  it('falls back to buttons when an href-template resolves to an unsafe scheme', async () => {
    const el = await pagination(html`
      <lr-pagination
        total="30"
        page-size="10"
        href-template="javascript:alert({page})"
      ></lr-pagination>
    `);

    const nodes = pageNodes(el);
    expect(nodes.map((node) => node.localName)).to.deep.equal(['a', 'button', 'button']);
    expect(nodes[0].hasAttribute('href'), 'the inactive current link is not resolved').to.equal(
      false,
    );
  });

  it('disables every page control while disabled or loading', async () => {
    const el = await pagination(html`
      <lr-pagination total="50" page-size="10" page="2" with-edges disabled></lr-pagination>
    `);
    expect(
      [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('button')].every(
        (button) => button.disabled,
      ),
    ).to.equal(true);

    el.disabled = false;
    el.hrefTemplate = '/page/{page}';
    await el.updateComplete;
    expect(
      pageNodes(el).every((node) => node.getAttribute('aria-disabled') === 'false'),
    ).to.equal(true);

    el.loading = true;
    await el.updateComplete;
    expect(pageNodes(el).every((node) => node.getAttribute('aria-disabled') === 'true')).to.equal(
      true,
    );
    expect(pageNodes(el).some((node) => node.hasAttribute('href'))).to.equal(false);
  });

  it('keeps every numbered control at the shared hit-area floor in every size', async () => {
    for (const size of ['xs', 's', 'm', 'l', 'xl'] as const) {
      const el = await pagination(
        html`<lr-pagination size=${size} total="50" page-size="10" with-edges></lr-pagination>`,
      );
      for (const node of [
        ...pageNodes(el),
        el.shadowRoot!.querySelector('[part~="first-button"]') as HTMLElement,
        el.shadowRoot!.querySelector('[part~="last-button"]') as HTMLElement,
      ]) {
        const box = node.getBoundingClientRect();
        expect(box.width, `${size} ${node.getAttribute('part')}`).to.be.at.least(40);
        expect(box.height, `${size} ${node.getAttribute('part')}`).to.be.at.least(40);
      }
    }
  });

  it('formats every page number with the effective locale', async () => {
    const el = await pagination(html`
      <lr-pagination locale="ar-EG" total="30" page-size="10" page="2"></lr-pagination>
    `);
    const arabic = new Intl.NumberFormat('ar-EG');

    expect(pageLabels(el)).to.deep.equal([arabic.format(1), arabic.format(2), arabic.format(3)]);
  });

  it('localizes the edge-control names through .strings', async () => {
    const el = await pagination(html`
      <lr-pagination
        total="50"
        page-size="10"
        page="3"
        with-edges
        .strings=${{
          paginationFirstPage: 'Première page',
          paginationLastPage: 'Dernière page',
        }}
      ></lr-pagination>
    `);

    expect(
      el.shadowRoot!.querySelector('[part~="first-button"]')!.getAttribute('aria-label'),
    ).to.equal('Première page');
    expect(
      el.shadowRoot!.querySelector('[part~="last-button"]')!.getAttribute('aria-label'),
    ).to.equal('Dernière page');
  });

  it('mirrors the edge-control glyphs under RTL', async () => {
    const ltr = await pagination(html`
      <lr-pagination total="50" page-size="10" with-edges></lr-pagination>
    `);
    const rtl = await pagination(html`
      <lr-pagination dir="rtl" total="50" page-size="10" with-edges></lr-pagination>
    `);

    expect(
      getComputedStyle(ltr.shadowRoot!.querySelector('[part="first-icon"]') as HTMLElement)
        .transform,
    ).to.not.equal(
      getComputedStyle(rtl.shadowRoot!.querySelector('[part="first-icon"]') as HTMLElement)
        .transform,
    );
  });

  it('renders the compact layout as previous/next around the page-jump field', async () => {
    const el = await compactPagination();

    expect(el.shadowRoot!.querySelectorAll('[part="page-input"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="pages"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part~="page"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part~="next-button"]').length).to.equal(1);
  });

  it('is accessible as a populated page list, as links, and in the compact layout', async () => {
    const standard = await pagination(html`
      <lr-pagination total="200" page-size="10" page="10" with-edges with-summary></lr-pagination>
    `);
    expect(standard.shadowRoot!.querySelectorAll('[part~="ellipsis"]').length).to.be.greaterThan(0);
    await expect(standard).to.be.accessible();

    const links = await pagination(html`
      <lr-pagination total="200" page-size="10" page="10" href-template="/p/{page}"></lr-pagination>
    `);
    await expect(links).to.be.accessible();

    await expect(await compactPagination()).to.be.accessible();
  });

  describe('appearance', () => {
    async function appearanceFixture(appearance?: string): Promise<LyraPagination> {
      return pagination(html`
        <lr-pagination
          total="50"
          page-size="10"
          page="2"
          appearance=${appearance ?? 'outlined'}
        ></lr-pagination>
      `);
    }

    it('defaults to outlined: a bordered control on the surface', async () => {
      const el = await appearanceFixture();
      expect(el.appearance).to.equal('outlined');
      const page = pageNodes(el)[0];
      expect(getComputedStyle(page).borderTopStyle).to.equal('solid');
      expect(getComputedStyle(page).borderTopColor).to.equal(
        resolvedInShadow(el, 'border-color: var(--lr-color-border)', 'border-top-color'),
      );
      expect(getComputedStyle(page).backgroundColor).to.equal(
        resolvedInShadow(el, 'background: var(--lr-color-surface)', 'background-color'),
      );
    });

    it('strips both the fill and the border for plain, and keeps the border for filled-outlined', async () => {
      const plain = await appearanceFixture('plain');
      expect(getComputedStyle(pageNodes(plain)[0]).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
      expect(getComputedStyle(pageNodes(plain)[0]).borderTopColor).to.equal('rgba(0, 0, 0, 0)');

      const filled = await appearanceFixture('filled');
      expect(getComputedStyle(pageNodes(filled)[0]).borderTopColor).to.equal('rgba(0, 0, 0, 0)');
      expect(getComputedStyle(pageNodes(filled)[0]).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');

      const filledOutlined = await appearanceFixture('filled-outlined');
      expect(getComputedStyle(pageNodes(filledOutlined)[0]).borderTopColor).to.not.equal(
        'rgba(0, 0, 0, 0)',
      );
      expect(getComputedStyle(pageNodes(filledOutlined)[0]).backgroundColor).to.equal(
        getComputedStyle(pageNodes(filled)[0]).backgroundColor,
      );
    });

    it('keeps the current page a solid brand chip in every appearance, accent included', async () => {
      for (const appearance of ['accent', 'filled', 'outlined', 'filled-outlined', 'plain']) {
        const el = await appearanceFixture(appearance);
        const current = el.shadowRoot!.querySelector('[part~="page-current"]') as HTMLElement;
        const other = pageNodes(el)[0];
        expect(getComputedStyle(current).backgroundColor, appearance).to.equal(
          resolvedInShadow(el, 'background: var(--lr-color-brand)', 'background-color'),
        );
        expect(getComputedStyle(current).backgroundColor, appearance).to.not.equal(
          getComputedStyle(other).backgroundColor,
        );
      }
    });

    it('tints the resting controls for accent without erasing the current-page chip', async () => {
      const accent = await appearanceFixture('accent');
      const outlined = await appearanceFixture('outlined');
      expect(getComputedStyle(pageNodes(accent)[0]).backgroundColor).to.not.equal(
        getComputedStyle(pageNodes(outlined)[0]).backgroundColor,
      );
    });
  });
});

it('exposes the numbered pages as a real list', async () => {
  const el = await pagination(html`
    <lr-pagination total="200" page-size="10" page="10"></lr-pagination>
  `);
  const list = el.shadowRoot!.querySelector('[part="pages"]') as HTMLElement;

  // list-style: none strips list semantics in some engines, so the roles are explicit.
  expect(list.localName).to.equal('ul');
  expect(list.getAttribute('role')).to.equal('list');
  for (const item of list.querySelectorAll(':scope > li')) {
    expect(item.getAttribute('role')).to.equal('listitem');
  }
});

it('wraps a long page list into a narrow allocation instead of overflowing it', async () => {
  const el = await pagination(html`
    <lr-pagination
      style="inline-size: 18rem"
      total="4000"
      page-size="20"
      page="87"
      with-edges
      with-summary
    ></lr-pagination>
  `);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

  expect(el.shadowRoot!.querySelectorAll('[part~="page"]').length).to.be.greaterThan(4);
  expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
});

describe('the shared size ladder', () => {
  const baseFontSize = async (size: string): Promise<string> => {
    const el = await pagination(
      html`<lr-pagination size=${size} total="95" page-size="10"></lr-pagination>`,
    );
    return getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement).fontSize;
  };

  it('accepts the Web Awesome / Shoelace spellings as exact synonyms of s/m/l', async () => {
    expect(await baseFontSize('s')).to.equal(await baseFontSize('small'));
    expect(await baseFontSize('m')).to.equal(await baseFontSize('medium'));
    expect(await baseFontSize('l')).to.equal(await baseFontSize('large'));
  });

  it('carries the full six-step ladder, 2xs included, with every step distinct from the default', async () => {
    const medium = await baseFontSize('m');
    for (const size of ['2xs', 'xs', 's', 'l', 'xl'] as const) {
      expect(await baseFontSize(size), size).to.not.equal(medium);
    }
  });

  it('keeps every control at the shared hit-area floor even at the smallest new tier', async () => {
    const el = await pagination(
      html`<lr-pagination size="2xs" total="95" page-size="10" with-edges></lr-pagination>`,
    );
    for (const part of ['first-button', 'previous-button', 'next-button', 'last-button']) {
      const button = el.shadowRoot!.querySelector(`[part~="${part}"]`) as HTMLElement;
      expect(button.getBoundingClientRect().width, part).to.be.at.least(40);
      expect(button.getBoundingClientRect().height, part).to.be.at.least(40);
    }
  });

  it('keeps interactive ellipses and the compact page field at the shared hit-area floor', async () => {
    const paged = await pagination(html`
      <lr-pagination size="2xs" total="950" page-size="10" page="48"></lr-pagination>
    `);
    for (const ellipsis of paged.shadowRoot!.querySelectorAll<HTMLElement>('[part~="ellipsis"]')) {
      const box = ellipsis.getBoundingClientRect();
      expect(box.width, 'ellipsis width').to.be.at.least(40);
      expect(box.height, 'ellipsis height').to.be.at.least(40);
    }

    const compact = await pagination(html`
      <lr-pagination
        size="2xs"
        format="compact"
        total="950"
        page-size="10"
        page="48"
      ></lr-pagination>
    `);
    const field = compact.shadowRoot!.querySelector<HTMLElement>('[part="page-input"]')!;
    const box = field.getBoundingClientRect();
    expect(box.width, 'page input width').to.be.at.least(40);
    expect(box.height, 'page input height').to.be.at.least(40);
  });
});

describe('Web Awesome navigation surface', () => {
  it('defaults page/page-size exactly and derives the matching page count', async () => {
    const el = await pagination(html`<lr-pagination total="95"></lr-pagination>`);
    expect(el.page).to.equal(1);
    expect(el.pageSize).to.equal(10);
    expect(el.pageCount).to.equal(10);
    expect(el.withoutNav).to.be.false;
    expect(el.hideSinglePage).to.be.false;
  });

  it('emits a cancelable before-change with pageSize and suppresses the request when vetoed', async () => {
    const el = await pagination(html`<lr-pagination total="95"></lr-pagination>`);
    let changed = 0;
    el.addEventListener('lr-page-change', () => changed++);
    el.addEventListener('lr-before-page-change', (event) => event.preventDefault());
    const before = oneEvent(el, 'lr-before-page-change');

    (el.shadowRoot!.querySelector('[part~="next-button"]') as HTMLButtonElement).click();
    const event = await before;
    await el.updateComplete;
    expect(event.cancelable).to.be.true;
    expect(event.detail).to.deep.equal({ page: 2, pageSize: 10 });
    expect(changed).to.equal(0);
    expect(el.page).to.equal(1);
  });

  it('without-nav removes only previous/next and hide-single-page renders nothing', async () => {
    const withoutNav = await pagination(html`
      <lr-pagination total="50" without-nav with-edges></lr-pagination>
    `);
    expect(withoutNav.shadowRoot!.querySelector('[part~="previous-button"]')).to.not.exist;
    expect(withoutNav.shadowRoot!.querySelector('[part~="next-button"]')).to.not.exist;
    expect(withoutNav.shadowRoot!.querySelector('[part~="first-button"]')).to.exist;
    expect(withoutNav.shadowRoot!.querySelector('[part~="page"]')).to.exist;

    const single = await pagination(html`
      <lr-pagination total="5" hide-single-page></lr-pagination>
    `);
    expect(single.shadowRoot!.querySelector('nav')).to.not.exist;
  });

  it('projects all four custom icon slots without replacing accessible button names', async () => {
    const el = await pagination(html`<lr-pagination total="50" page="3" with-edges>
      <span slot="first-icon">first</span>
      <span slot="previous-icon">previous</span>
      <span slot="next-icon">next</span>
      <span slot="last-icon">last</span>
    </lr-pagination>`);
    for (const name of ['first', 'previous', 'next', 'last']) {
      const icon = el.shadowRoot!.querySelector(`[part="${name}-icon"]`)!;
      const slot = icon.querySelector('slot') as HTMLSlotElement;
      expect(slot.assignedElements()).to.have.length(1);
      expect(el.shadowRoot!.querySelector(`[part~="${name}-button"]`)!.getAttribute('aria-label'))
        .to.be.a('string').and.not.equal('');
    }
  });

  it('renders every link-mode navigation control through href-template', async () => {
    const el = await pagination(html`
      <lr-pagination total="50" page="2" with-edges href-template="/results?page={page}"></lr-pagination>
    `);
    const expected = new Map([
      ['first-button', '/results?page=1'],
      ['previous-button', '/results?page=1'],
      ['next-button', '/results?page=3'],
      ['last-button', '/results?page=5'],
    ]);
    for (const [part, href] of expected) {
      const control = el.shadowRoot!.querySelector(`[part~="${part}"]`) as HTMLAnchorElement;
      expect(control.localName).to.equal('a');
      expect(control.getAttribute('href')).to.equal(href);
      expect(control.part.contains('button')).to.be.true;
    }
  });

  it('puts the shared button part on pages, ellipses, and navigation and label on compact output', async () => {
    const standard = await pagination(html`
      <lr-pagination total="200" page="10" with-edges></lr-pagination>
    `);
    const controls = [...standard.shadowRoot!.querySelectorAll<HTMLElement>('[part~="button"]')];
    expect(controls.length).to.be.greaterThan(8);
    expect(controls.some((control) => control.part.contains('ellipsis'))).to.be.true;
    expect(controls.every((control) => control.matches('button, a'))).to.be.true;

    const compact = await compactPagination();
    const label = compact.shadowRoot!.querySelector('[part~="label"]') as HTMLElement;
    expect(label.part.contains('page-field')).to.be.true;
  });

  it('is accessible with interactive ellipses, custom icons, and an RTL link surface', async () => {
    const el = await pagination(html`<lr-pagination
      dir="rtl"
      label="Search result pages"
      total="200"
      page="10"
      with-edges
      href-template="/results?page={page}"
    >
      <span slot="previous-icon" aria-hidden="true">→</span>
      <span slot="next-icon" aria-hidden="true">←</span>
    </lr-pagination>`);
    await expect(el).to.be.accessible();
  });
});
