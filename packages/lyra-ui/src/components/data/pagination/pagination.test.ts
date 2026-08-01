import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './pagination.js';
import type { LyraPagination } from './pagination.js';
import { styles } from './pagination.styles.js';

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

it('derives pageCount and a localized item-range summary', async () => {
  const el = await pagination();

  expect(el.pageCount).to.equal(10);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal(
    '1–10 of 95 items',
  );
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

  expect(event.detail).to.deep.equal({ page: 7 });
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
      const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
      expect(button.getBoundingClientRect().width, `${size} ${part}`).to.be.at.least(40);
      expect(button.getBoundingClientRect().height, `${size} ${part}`).to.be.at.least(40);
    }
  }
});

it('bridges internal focus and blur as bubbling, composed host events', async () => {
  const el = await compactPagination();
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
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('true');
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
  expect(el.shadowRoot!.querySelector('[part="next-button"]')).to.exist;
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

  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!).flexDirection).to.equal(
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

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
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
    el.shadowRoot!.querySelector('[part="next-button"]') as HTMLElement;
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
          (text.includes("[part='previous-button']") || text.includes("[part='next-button']")),
      );
    expect(internalRule).to.contain(':where(');
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
    expect(el.shadowRoot!.querySelectorAll('[part="ellipsis"]').length).to.equal(0);
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
    expect(el.shadowRoot!.querySelectorAll('[part="ellipsis"]').length).to.equal(2);
    const middleCount = itemCount(el);

    el.page = 1;
    await el.updateComplete;
    expect(itemCount(el), 'the control must not resize as the page changes').to.equal(middleCount);
    el.page = 20;
    await el.updateComplete;
    expect(itemCount(el)).to.equal(middleCount);
    expect(pageLabels(el).at(-1)).to.equal('20');
  });

  it('never announces an elided gap as a page control', async () => {
    const el = await pagination(html`
      <lr-pagination total="200" page-size="10" page="10" sibling-count="1" boundary-count="1"></lr-pagination>
    `);
    const gaps = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="ellipsis"]')];

    expect(gaps.length).to.equal(2);
    for (const gap of gaps) {
      expect(gap.getAttribute('aria-hidden')).to.equal('true');
      expect(gap.localName).to.not.equal('button');
      expect(gap.localName).to.not.equal('a');
      expect(gap.querySelectorAll('button, a, [tabindex]').length).to.equal(0);
      expect(gap.hasAttribute('aria-current')).to.be.false;
    }
    // The page list's only focusable stops are real pages.
    expect(el.shadowRoot!.querySelectorAll('[part="pages"] button, [part="pages"] a').length).to.equal(
      pageNodes(el).length,
    );
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

    expect(event.detail).to.deep.equal({ page: 4 });
    expect(el.page).to.equal(1);
  });

  it('renders no first/last controls until with-edges is set', async () => {
    const el = await pagination(html`
      <lr-pagination total="50" page-size="10" page="3"></lr-pagination>
    `);
    expect(el.withEdges).to.equal(false);
    expect(el.shadowRoot!.querySelectorAll('[part="first-button"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="last-button"]').length).to.equal(0);
  });

  it('jumps to the first and last page through the edge controls', async () => {
    const el = await pagination(html`
      <lr-pagination total="50" page-size="10" page="3" with-edges></lr-pagination>
    `);
    const first = el.shadowRoot!.querySelector('[part="first-button"]') as HTMLButtonElement;
    const last = el.shadowRoot!.querySelector('[part="last-button"]') as HTMLButtonElement;

    const lastRequest = oneEvent(el, 'lr-page-change');
    last.click();
    expect((await lastRequest).detail).to.deep.equal({ page: 5 });

    const firstRequest = oneEvent(el, 'lr-page-change');
    first.click();
    expect((await firstRequest).detail).to.deep.equal({ page: 1 });

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

    expect(pageNodes(el).map((node) => node.localName)).to.deep.equal([
      'button',
      'button',
      'button',
    ]);
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
        el.shadowRoot!.querySelector('[part="first-button"]') as HTMLElement,
        el.shadowRoot!.querySelector('[part="last-button"]') as HTMLElement,
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
      el.shadowRoot!.querySelector('[part="first-button"]')!.getAttribute('aria-label'),
    ).to.equal('Première page');
    expect(
      el.shadowRoot!.querySelector('[part="last-button"]')!.getAttribute('aria-label'),
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
    expect(el.shadowRoot!.querySelectorAll('[part="next-button"]').length).to.equal(1);
  });

  it('is accessible as a populated page list, as links, and in the compact layout', async () => {
    const standard = await pagination(html`
      <lr-pagination total="200" page-size="10" page="10" with-edges with-summary></lr-pagination>
    `);
    expect(standard.shadowRoot!.querySelectorAll('[part="ellipsis"]').length).to.be.greaterThan(0);
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
  for (const page of el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="page"]')) {
    expect(page.parentElement!.localName).to.equal('li');
    expect(page.parentElement!.getAttribute('role')).to.equal('listitem');
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
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  expect(el.shadowRoot!.querySelectorAll('[part~="page"]').length).to.be.greaterThan(4);
  expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
});

describe('the shared size ladder', () => {
  const baseFontSize = async (size: string): Promise<string> => {
    const el = await pagination(
      html`<lr-pagination size=${size} total="95" page-size="10"></lr-pagination>`,
    );
    return getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).fontSize;
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
      const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
      expect(button.getBoundingClientRect().width, part).to.be.at.least(40);
      expect(button.getBoundingClientRect().height, part).to.be.at.least(40);
    }
  });
});
