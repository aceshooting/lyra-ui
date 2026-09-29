// Focused rendering and accessibility cases. Test bodies and titles were moved intact from the prior suite.
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { fixture, expect, oneEvent, html, waitUntil } from "@open-wc/testing";
import "./date-picker.js";
import type { LyraDatePicker } from "./date-picker.js";
import { styles } from "./date-picker.styles.js";
import { weekdayLabels, monthTitle, resolveFirstDayOfWeek } from "./calendar-core.js";
import { hoverUntilMatched, resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";

const requiredItem = <T>(items: ArrayLike<T>, index: number, description: string): T => {
  const item = items[index];
  if (item === undefined) throw new Error(`Missing ${description} at index ${index}.`);
  return item;
};

expectLocaleFallback('fa-IR', ['nextMonth', 'previousMonth']);

expectLocaleFallback('fr', ['nextMonth', 'previousMonth']);

expectLocaleFallback('fr-FR', ['nextMonth', 'previousMonth']);

expectLocaleFallback('not-a-locale', ['nextMonth', 'previousMonth']);

function dispatchGridKey(el: LyraDatePicker, key: string): void {
  const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
  grid.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

async function settle(): Promise<void> {
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
}

function resolvedBackground(el: LyraDatePicker, declaration: string): string {
  const probe = document.createElement("span");
  probe.setAttribute("style", declaration);
  el.shadowRoot!.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
}

const HOVER_ACTIVE_DECLARATIONS = {
  '[part~="day"]': {
    hover: "background: var(--lr-date-picker-day-hover-bg, var(--lr-color-brand-quiet))",
    active:
      "background: var(--lr-date-picker-day-active-bg, color-mix(in oklab, var(--lr-date-picker-day-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active)))",
  },
  '[part="next"]': {
    hover: "background: var(--lr-date-picker-nav-hover-bg, var(--lr-color-brand-quiet))",
    active:
      "background: var(--lr-date-picker-nav-active-bg, color-mix(in oklab, var(--lr-date-picker-nav-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active)))",
  },
} as const;

it("gates enabled previous/next hover backgrounds behind :where() (regression)", () => {
  const css = styles.cssText.replace(/"/g, "'").replace(/\s+/g, " ");
  expect(css).to.match(
    /:where\(\[part='previous'\]\):hover:not\(:disabled\),\s*:where\(\[part='next'\]\):hover:not\(:disabled\)/
  );
  // The old over-specific, unwrapped shape must be gone, not merely joined by the new one.
  expect(css).to.not.include("[part='previous']:hover,");
});

it("lets a consumer retint the previous/next hover background via the scoped --lr-date-picker-nav-hover-bg cssprop (regression)", async () => {
  const el = (await fixture(html`
    <lr-date-picker
      value="2026-07-15"
      style="--lr-date-picker-nav-hover-bg: rgb(1, 2, 3);"
    ></lr-date-picker>
  `)) as LyraDatePicker;
  await el.updateComplete;
  const next = el.shadowRoot!.querySelector('[part="next"]') as HTMLElement;
  const before = getComputedStyle(next).backgroundColor;
  try {
    await hoverUntilMatched(next, "next button never reported :hover");
    await waitUntil(
      () => getComputedStyle(next).backgroundColor === "rgb(1, 2, 3)",
      "next button background never eased to the configured colour"
    );
    expect(getComputedStyle(next).backgroundColor).to.not.equal(before);
  } finally {
    await resetMouse();
  }
});

it("inherits title hover/pressed hooks including radius while direct host values still win", async () => {
  const wrapper = await fixture(html`
    <div
      style="--lr-date-picker-title-hover-color: rgb(1, 2, 3); --lr-date-picker-title-active-color: rgb(4, 5, 6); --lr-date-picker-title-active-bg: rgb(7, 8, 9); --lr-date-picker-title-active-radius: 11px"
    >
      <lr-date-picker value="2026-07-15"></lr-date-picker>
    </div>
  `);
  const el = wrapper.querySelector("lr-date-picker") as LyraDatePicker;
  const title = el.shadowRoot!.querySelector(
    '[part="title"]'
  ) as HTMLButtonElement;
  const rect = title.getBoundingClientRect();
  const position: [number, number] = [
    Math.round(rect.left + rect.width / 2),
    Math.round(rect.top + rect.height / 2),
  ];

  try {
    await sendMouse({ type: "move", position });
    await waitUntil(() => getComputedStyle(title).color === "rgb(1, 2, 3)");
    await sendMouse({ type: "down" });
    await waitUntil(
      () => getComputedStyle(title).backgroundColor === "rgb(7, 8, 9)"
    );
    expect(getComputedStyle(title).color).to.equal("rgb(4, 5, 6)");
    expect(getComputedStyle(title).borderRadius).to.equal("11px");

    el.style.setProperty("--lr-date-picker-title-active-radius", "17px");
    await waitUntil(() => getComputedStyle(title).borderRadius === "17px");
  } finally {
    await sendMouse({ type: "up" });
    await resetMouse();
  }
});

it("scales day-cell size across every tier, floored at the 24px WCAG minimum", async () => {
  const expected: Record<string, string> = {
    "2xs": "24px",
    xs: "28px",
    s: "32px",
    m: "36px",
    l: "40px",
    xl: "48px",
  };
  for (const [size, px] of Object.entries(expected)) {
    const el = await fixture(
      html`<lr-date-picker size=${size} value="2026-07-15"></lr-date-picker>`
    );
    const day = el.shadowRoot!.querySelector('[part~="day"]') as HTMLElement;
    expect(getComputedStyle(day).blockSize, `size=${size}`).to.equal(px);
    expect(getComputedStyle(day).inlineSize, `size=${size}`).to.equal(px);
  }
});

it('co-tokenizes the mirrored date-picker part and permanent base compatibility name', async () => {
  const el = (await fixture(html`
    <lr-date-picker value="2026-07-15"></lr-date-picker>
  `)) as LyraDatePicker;

  expect(
    el.shadowRoot!.querySelectorAll('[part~="base"][part~="date-picker"]')
      .length
  ).to.equal(1);
  expect(el.shadowRoot!.querySelectorAll('[part~="base"]').length).to.equal(1);
  expect(
    el.shadowRoot!.querySelectorAll('[part~="date-picker"]').length
  ).to.equal(1);
});

it("renders equivalent shell chrome through either date-picker part spelling", async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <style>
        .through-base::part(base),
        .through-date-picker::part(date-picker) {
          padding: 13px;
          background: rgb(3, 17, 29);
          border-color: rgb(41, 53, 67);
          border-radius: 11px;
        }
      </style>
      <lr-date-picker class="through-base" value="2026-07-15"></lr-date-picker>
      <lr-date-picker
        class="through-date-picker"
        value="2026-07-15"
      ></lr-date-picker>
    </div>
  `);
  const pickers = [
    ...wrapper.querySelectorAll<LyraDatePicker>("lr-date-picker"),
  ];
  const renderedShell = (picker: LyraDatePicker) => {
    const shell =
      picker.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    const computed = getComputedStyle(shell);
    return [
      computed.padding,
      computed.backgroundColor,
      computed.borderTopColor,
      computed.borderRadius,
    ];
  };

  expect(renderedShell(pickers[0]!)).to.deep.equal([
    "13px",
    "rgb(3, 17, 29)",
    "rgb(41, 53, 67)",
    "11px",
  ]);
  expect(renderedShell(pickers[1]!)).to.deep.equal(renderedShell(pickers[0]!));
  expect(Math.round(pickers[1]!.getBoundingClientRect().width)).to.equal(
    Math.round(pickers[0]!.getBoundingClientRect().width)
  );
});

it("accepts the Web Awesome size spellings, rendering small/medium/large as s/m/l", async () => {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ["small", "s"],
    ["medium", "m"],
    ["large", "l"],
  ];
  const cell = (el: Element) =>
    el.shadowRoot!.querySelector('[part~="day"]') as HTMLElement;
  for (const [alias, step] of pairs) {
    const aliasEl = await fixture(
      html`<lr-date-picker size=${alias} value="2026-07-15"></lr-date-picker>`
    );
    const stepEl = await fixture(
      html`<lr-date-picker size=${step} value="2026-07-15"></lr-date-picker>`
    );
    expect(
      getComputedStyle(cell(aliasEl)).blockSize,
      `day block-size for ${alias}`
    ).to.equal(getComputedStyle(cell(stepEl)).blockSize);
    expect(
      getComputedStyle(cell(aliasEl)).inlineSize,
      `day inline-size for ${alias}`
    ).to.equal(getComputedStyle(cell(stepEl)).inlineSize);
  }
});

it('defaults to size "m" and reflects a size attribute', async () => {
  const defaultEl = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  expect(defaultEl.size).to.equal("m");
  const el = (await fixture(
    html`<lr-date-picker size="s" value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  expect(el.getAttribute("size")).to.equal("s");
  expect(el.size).to.equal("s");
});

it("renders two months when requested", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15" months="2"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="month"]').length).to.equal(2);
});

it("uses safe render fallbacks for direct invalid union and locale property writes", async () => {
  const el = (await fixture(
    html`<lr-date-picker></lr-date-picker>`
  )) as LyraDatePicker;
  el.mode = "bogus" as LyraDatePicker["mode"];
  el.weekdayFormat = "bogus" as LyraDatePicker["weekdayFormat"];
  el.locale = "not_a_locale";
  await el.updateComplete;

  expect(el.valueAsDate).to.equal(null);
  expect(el.shadowRoot!.querySelectorAll('[part="weekday"]')).to.have.length(7);
  expect(el.shadowRoot!.querySelectorAll('[part="month"]')).to.have.length(1);
});

it("renders selected day text from the shared --lr-color-on-brand fallback", async () => {
  const el = (await fixture(html`
    <lr-date-picker
      value="2026-07-15"
      style="--lr-color-on-brand: rgb(1, 2, 3)"
    ></lr-date-picker>
  `)) as LyraDatePicker;
  await el.updateComplete;

  const selected = el.shadowRoot!.querySelector(
    '[part~="day-selected"]'
  ) as HTMLButtonElement;
  expect(getComputedStyle(selected).color).to.equal("rgb(1, 2, 3)");
});

it('swaps ArrowLeft/ArrowRight under dir="rtl", since the day grid mirrors visually (no explicit direction override on [part="grid"])', async () => {
  const el = (await fixture(
    html`<lr-date-picker dir="rtl" value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, "ArrowLeft");
  await el.updateComplete;
  let focused = el.shadowRoot!.querySelector(
    '[data-date="2026-07-16"]'
  ) as HTMLButtonElement;
  expect(focused.getAttribute("tabindex")).to.equal("0");
  expect(el.shadowRoot!.activeElement === focused).to.be.true;

  dispatchGridKey(el, "ArrowRight");
  await el.updateComplete;
  focused = el.shadowRoot!.querySelector(
    '[data-date="2026-07-15"]'
  ) as HTMLButtonElement;
  expect(focused.getAttribute("tabindex")).to.equal("0");
  expect(el.shadowRoot!.activeElement === focused).to.be.true;
});

it("jumps a month with PageUp/PageDown, re-rendering the grid for the new month", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const title = () =>
    el
      .shadowRoot!.querySelector('[part="title"]')!
      .textContent!.trim()
      .toLowerCase();

  dispatchGridKey(el, "PageDown");
  await el.updateComplete;
  expect(title()).to.contain("august");
  expect(el.shadowRoot!.querySelector('[data-date="2026-08-15"]')).to.exist;

  dispatchGridKey(el, "PageUp");
  await el.updateComplete;
  expect(title()).to.contain("july");
  expect(el.shadowRoot!.querySelector('[data-date="2026-07-15"]')).to.exist;
});

it("is accessible", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it("renders chevron icons for month navigation instead of text glyphs", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const previous = el.shadowRoot!.querySelector(
    '[part="previous"]'
  ) as HTMLButtonElement;
  const next = el.shadowRoot!.querySelector(
    '[part="next"]'
  ) as HTMLButtonElement;
  expect(previous.querySelector("svg") != null).to.equal(true);
  expect(next.querySelector("svg") != null).to.equal(true);
  expect(previous.textContent).to.not.contain("‹");
  expect(next.textContent).to.not.contain("›");
});

it("gives the month-navigation buttons the shared minimum hit area", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const previous = el.shadowRoot!.querySelector(
    '[part="previous"]'
  ) as HTMLElement;
  const next = el.shadowRoot!.querySelector('[part="next"]') as HTMLElement;
  expect(getComputedStyle(previous).minInlineSize).to.equal("40px");
  expect(getComputedStyle(previous).minBlockSize).to.equal("40px");
  expect(getComputedStyle(next).minInlineSize).to.equal("40px");
  expect(getComputedStyle(next).minBlockSize).to.equal("40px");
});

it("resolves the nav-button labels through a .strings override when the label props are left at their defaults", async () => {
  // previousLabel/nextLabel stay at their built-in defaults here, so the
  // conditional fallback passed to localize() must be undefined and the
  // localization registry/.strings path must win -- a customized prop
  // (covered by the test above) would short-circuit it verbatim instead.
  const el = (await fixture(html`
    <lr-date-picker
      value="2026-07-15"
      .strings=${{ previousMonth: "Mois précédent", nextMonth: "Mois suivant" }}
    ></lr-date-picker>
  `)) as LyraDatePicker;
  await el.updateComplete;
  expect(
    el
      .shadowRoot!.querySelector('[part="previous"]')!
      .getAttribute("aria-label")
  ).to.equal("Mois précédent");
  expect(
    el.shadowRoot!.querySelector('[part="next"]')!.getAttribute("aria-label")
  ).to.equal("Mois suivant");
});

it("gives each visible month grid its own accessible name via aria-labelledby, distinguishing them with months=2", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15" months="2"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  const grids = Array.from(el.shadowRoot!.querySelectorAll('[part="grid"]'));
  const titles = Array.from(el.shadowRoot!.querySelectorAll('[part="title"]'));
  expect(grids.length).to.equal(2);
  expect(titles.length).to.equal(2);
  const firstGrid = requiredItem(grids, 0, 'first month grid');
  const secondGrid = requiredItem(grids, 1, 'second month grid');
  const firstTitle = requiredItem(titles, 0, 'first month title');
  const secondTitle = requiredItem(titles, 1, 'second month title');

  const labelledBy0 = firstGrid.getAttribute("aria-labelledby");
  const labelledBy1 = secondGrid.getAttribute("aria-labelledby");
  expect(labelledBy0, "expected the first grid to reference a title id")
    .to.be.a("string")
    .with.length.greaterThan(0);
  expect(labelledBy1, "expected the second grid to reference a title id")
    .to.be.a("string")
    .with.length.greaterThan(0);
  expect(labelledBy0).to.not.equal(labelledBy1);

  expect(firstTitle.getAttribute("id")).to.equal(labelledBy0);
  expect(secondTitle.getAttribute("id")).to.equal(labelledBy1);
  expect(firstTitle.textContent!.trim().toLowerCase()).to.contain("july");
  expect(secondTitle.textContent!.trim().toLowerCase()).to.contain("august");
});

it("formats each day cell aria-label with the full localized weekday/month/day/year", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15" locale="fr-FR"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  const cell = el.shadowRoot!.querySelector(
    '[data-date="2026-07-15"]'
  ) as HTMLButtonElement;
  const expected = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(2026, 6, 15));
  expect(cell.getAttribute("aria-label")).to.equal(expected);
});

it("derives month/weekday labels and first-day-of-week from an inherited lang ancestor when no locale attribute is set", async () => {
  // Regression test: every Intl call used to read the raw `locale` prop
  // directly (default '', resolved by Intl as the browser's own locale)
  // instead of `effectiveLocale`, which also walks lang/locale ancestors --
  // so an inherited <div lang="fr"> was silently ignored.
  const wrapper = await fixture(html`
    <div lang="fr"><lr-date-picker value="2026-07-15"></lr-date-picker></div>
  `);
  const el = wrapper.querySelector("lr-date-picker") as LyraDatePicker;
  await el.updateComplete;

  const title = el
    .shadowRoot!.querySelector('[part="title"]')!
    .textContent!.trim();
  expect(title).to.equal(monthTitle(2026, 6, "fr"));

  const fdow = resolveFirstDayOfWeek("auto", "fr");
  const labels = Array.from(
    el.shadowRoot!.querySelectorAll('[part="weekday"]')
  ).map((w) => w.textContent!.trim());
  expect(labels).to.deep.equal(weekdayLabels(fdow, "short", "fr"));

  const cell = el.shadowRoot!.querySelector(
    '[data-date="2026-07-15"]'
  ) as HTMLButtonElement;
  const expected = new Intl.DateTimeFormat("fr", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(2026, 6, 15));
  expect(cell.getAttribute("aria-label")).to.equal(expected);
});

it("gives an outside-month day inside a selected range normal text contrast, not the quiet outside color", async () => {
  const el = (await fixture(
    html`<lr-date-picker
      mode="range"
      with-outside-days
      value="2026-06-28/2026-07-05"
    ></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  // Viewing June (from's month): June 28 → July 5 puts July 1–4 in the trailing
  // "outside" days of the June grid, strictly between from/to, so they carry both
  // day-outside and day-range-inner.
  const overlapCell = el.shadowRoot!.querySelector(
    '[part~="day-outside"][part~="day-range-inner"]'
  ) as HTMLButtonElement;
  expect(
    overlapCell != null,
    "expected an outside day cell inside the selected range"
  ).to.equal(true);

  const plainOutsideCell = el.shadowRoot!.querySelector(
    '[part~="day-outside"]:not([part~="day-range-inner"])'
  ) as HTMLButtonElement;
  expect(
    plainOutsideCell != null,
    "expected a plain outside day cell for comparison"
  ).to.equal(true);

  const normalCell = el.shadowRoot!.querySelector(
    '[part~="day"]:not([part~="day-outside"]):not([part~="day-selected"]):not([part~="day-range-start"]):not([part~="day-range-end"])'
  ) as HTMLButtonElement;
  expect(
    normalCell != null,
    "expected a plain in-month day cell for comparison"
  ).to.equal(true);

  const overlapColor = getComputedStyle(overlapCell).color;
  const plainOutsideColor = getComputedStyle(plainOutsideCell).color;
  const normalColor = getComputedStyle(normalCell).color;

  expect(overlapColor).to.equal(normalColor);
  expect(overlapColor).to.not.equal(plainOutsideColor);
});

it("renders two months as contained rows at a 320px allocation in LTR and RTL", async () => {
  for (const direction of ["ltr", "rtl"] as const) {
    const wrapper = (await fixture(html`
      <div
        dir=${direction}
        style="inline-size: 320px; max-inline-size: 100%; overflow: auto"
      >
        <lr-date-picker
          mode="range"
          months="2"
          value="2026-07-15"
          style="inline-size: 100%; max-inline-size: 100%"
        ></lr-date-picker>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector("lr-date-picker") as LyraDatePicker;
    await el.updateComplete;

    const monthElements = Array.from(
      el.shadowRoot!.querySelectorAll('[part="month"]')
    ) as HTMLElement[];
    expect(monthElements.length).to.equal(2);
    const wrapperRect = wrapper.getBoundingClientRect();
    const firstRect = requiredItem(monthElements, 0, 'first month').getBoundingClientRect();
    const secondRect = requiredItem(monthElements, 1, 'second month').getBoundingClientRect();
    for (const rect of [firstRect, secondRect]) {
      expect(rect.left).to.be.at.least(wrapperRect.left - 1);
      expect(rect.right).to.be.at.most(wrapperRect.right + 1);
    }
    expect(secondRect.top).to.be.greaterThan(firstRect.top);
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth + 1);
  }
});

it('scrolls, rather than shrinks, a single month\'s day grid past the WCAG hit-area floor at a 320px allocation with size="xl", in LTR and RTL', async () => {
  for (const direction of ["ltr", "rtl"] as const) {
    const wrapper = (await fixture(html`
      <div
        dir=${direction}
        style="inline-size: 320px; max-inline-size: 100%; overflow: auto"
      >
        <lr-date-picker
          value="2026-07-15"
          size="xl"
          style="inline-size: 100%; max-inline-size: 100%"
        ></lr-date-picker>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector("lr-date-picker") as LyraDatePicker;
    await el.updateComplete;
    await settle();

    // The picker itself never leaks past its given allocation -- an ancestor no narrower than
    // this must not need to grow or clip to contain it.
    expect(
      wrapper.scrollWidth,
      `${direction} wrapper must not overflow its 320px allocation`
    ).to.be.at.most(wrapper.clientWidth + 1);

    const scrollRegion = el.shadowRoot!.querySelector(
      ".calendar-scroll"
    ) as HTMLElement;
    // Compares a boolean, never the DOM node itself, as chai's actual -- a failing
    // node/NodeList assertion hangs the whole file (see AGENTS.md's testing conventions).
    expect(
      Boolean(scrollRegion),
      `${direction} calendar scroll region exists`
    ).to.be.true;
    expect(
      scrollRegion.scrollWidth,
      `${direction} the oversized xl grid genuinely overflows its own region`
    ).to.be.greaterThan(scrollRegion.clientWidth);

    // Every day cell keeps its full token-derived size -- 3rem (48px) for size="xl" -- rather
    // than being shrunk by a container-query step to fit the narrow allocation, which would
    // otherwise trade this reachability bug for a WCAG 2.5.8 hit-area regression.
    const firstRowDays = Array.from(
      el.shadowRoot!.querySelectorAll('[part="week"]')[0]!.querySelectorAll(
        '[part~="day"]'
      )
    ) as HTMLButtonElement[];
    for (const cell of firstRowDays) {
      const rect = cell.getBoundingClientRect();
      expect(
        Math.round(rect.width),
        `${direction} day cell width stays at the size="xl" token size`
      ).to.equal(48);
      expect(
        Math.round(rect.height),
        `${direction} day cell height stays at the size="xl" token size`
      ).to.equal(48);
      expect(rect.width, `${direction} day cell meets the WCAG 2.5.8 floor`).to
        .be.at.least(24);
    }

    // Scrolling the region to its trailing edge reaches the last (trailing) column's day cell --
    // it is not simply lost past the edge of the allocation.
    const lastCellInFirstRow = firstRowDays[firstRowDays.length - 1]!;
    const maxScroll = scrollRegion.scrollWidth - scrollRegion.clientWidth;
    scrollRegion.scrollLeft = direction === "rtl" ? -maxScroll : maxScroll;
    scrollRegion.dispatchEvent(new Event("scroll"));
    await settle();
    const regionRect = scrollRegion.getBoundingClientRect();
    const cellRect = lastCellInFirstRow.getBoundingClientRect();
    expect(
      cellRect.left,
      `${direction} trailing day cell reachable (left) after scrolling`
    ).to.be.at.least(regionRect.left - 1);
    expect(
      cellRect.right,
      `${direction} trailing day cell reachable (right) after scrolling`
    ).to.be.at.most(regionRect.right + 1);
  }
});

it('scrolls, rather than shrinks, a single month\'s day grid past the WCAG hit-area floor at a 320px allocation with with-week-numbers, in LTR and RTL', async () => {
  for (const direction of ["ltr", "rtl"] as const) {
    const wrapper = (await fixture(html`
      <div
        dir=${direction}
        style="inline-size: 320px; max-inline-size: 100%; overflow: auto"
      >
        <lr-date-picker
          value="2026-07-15"
          with-week-numbers
          size="l"
          style="inline-size: 100%; max-inline-size: 100%"
        ></lr-date-picker>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector("lr-date-picker") as LyraDatePicker;
    await el.updateComplete;
    await settle();

    expect(
      wrapper.scrollWidth,
      `${direction} wrapper must not overflow its 320px allocation`
    ).to.be.at.most(wrapper.clientWidth + 1);

    const scrollRegion = el.shadowRoot!.querySelector(
      ".calendar-scroll"
    ) as HTMLElement;
    // Compares a boolean, never the DOM node itself, as chai's actual -- a failing
    // node/NodeList assertion hangs the whole file (see AGENTS.md's testing conventions).
    expect(
      Boolean(scrollRegion),
      `${direction} calendar scroll region exists`
    ).to.be.true;
    // The eighth (week-number) column is what tips a size="l" month over a 320px allocation --
    // size="l" alone (without with-week-numbers) fits comfortably, so this genuinely exercises
    // the week-number-column overflow path rather than the size="xl" one above.
    expect(
      scrollRegion.scrollWidth,
      `${direction} the week-numbers column genuinely overflows the region`
    ).to.be.greaterThan(scrollRegion.clientWidth);

    // The size="l" token is 2.5rem (40px) -- unaffected by the extra week-number column
    // needing to scroll.
    const firstRowDays = Array.from(
      el.shadowRoot!.querySelectorAll('[part="week"]')[0]!.querySelectorAll(
        '[part~="day"]'
      )
    ) as HTMLButtonElement[];
    for (const cell of firstRowDays) {
      const rect = cell.getBoundingClientRect();
      expect(
        Math.round(rect.width),
        `${direction} day cell width stays at the size="l" token size`
      ).to.equal(40);
      expect(rect.width, `${direction} day cell meets the WCAG 2.5.8 floor`).to
        .be.at.least(24);
    }

    const lastCellInFirstRow = firstRowDays[firstRowDays.length - 1]!;
    const maxScroll = scrollRegion.scrollWidth - scrollRegion.clientWidth;
    scrollRegion.scrollLeft = direction === "rtl" ? -maxScroll : maxScroll;
    scrollRegion.dispatchEvent(new Event("scroll"));
    await settle();
    const regionRect = scrollRegion.getBoundingClientRect();
    const cellRect = lastCellInFirstRow.getBoundingClientRect();
    expect(
      cellRect.left,
      `${direction} trailing day cell reachable (left) after scrolling`
    ).to.be.at.least(regionRect.left - 1);
    expect(
      cellRect.right,
      `${direction} trailing day cell reachable (right) after scrolling`
    ).to.be.at.most(regionRect.right + 1);

    // The week-number column stays legible alongside the grid -- it isn't clipped away by the
    // new scroll region.
    const weeknumber = el.shadowRoot!.querySelector(
      '[part="weeknumber"]'
    ) as HTMLElement;
    expect(weeknumber.getBoundingClientRect().width).to.be.greaterThan(0);
  }
});

it("renders a disabled day cell's opacity from the shared --lr-opacity-disabled fallback", async () => {
  const el = (await fixture(html`
    <lr-date-picker
      value="2026-07-15"
      disabled
      style="--lr-opacity-disabled: 0.42"
    ></lr-date-picker>
  `)) as LyraDatePicker;
  await el.updateComplete;
  const day = el.shadowRoot!.querySelector(
    '[part~="day"]'
  ) as HTMLButtonElement;
  expect(
    day.disabled,
    "expected the picker-level disabled state to disable its day cells"
  ).to.be.true;
  expect(getComputedStyle(day).opacity).to.equal("0.42");
});

it("gives the previous/next month-nav buttons a focus-visible ring, matching their existing hover", () => {
  const css = styles.cssText.replace(/"/g, "'").replace(/\s+/g, " ");
  expect(css).to.match(
    /\[part='previous'\]:focus-visible,\s*\[part='next'\]:focus-visible\s*\{[^}]*outline:/
  );
});

it("wires locale, weekday-format and first-day-of-week through to the rendered weekday headers, month title and grid alignment", async () => {
  const el = (await fixture(
    html`<lr-date-picker
      value="2026-07-15"
      locale="fr-FR"
      first-day-of-week="mon"
      weekday-format="narrow"
    ></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  const labels = Array.from(
    el.shadowRoot!.querySelectorAll('[part="weekday"]')
  ).map((w) => w.textContent!.trim());
  expect(labels).to.deep.equal(weekdayLabels(1, "narrow", "fr-FR"));

  const title = el
    .shadowRoot!.querySelector('[part="title"]')!
    .textContent!.trim();
  expect(title).to.equal(monthTitle(2026, 6, "fr-FR"));

  // July 1 2026 is a Wednesday; with a Monday-first grid it must land in the
  // third column (index 2), proving first-day-of-week reached monthMatrix().
  const cells = Array.from(
    el.shadowRoot!.querySelectorAll('[part="grid"] [role="gridcell"]')
  );
  const idx = cells.findIndex(
    (c) => (c as HTMLElement).dataset['date'] === "2026-07-01"
  );
  expect(idx % 7).to.equal(2);
});

it("hides outside-month placeholders from the accessibility tree only in rows that also have a real visible day", async () => {
  // July 2026 (Sunday-first, the default) has a mixed leading row (June 28-30
  // outside, July 1-4 inside) and a fully-outside trailing row (Aug 2-8) --
  // only the former may have its placeholders aria-hidden.
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  const weeks = el.shadowRoot!.querySelectorAll('[part="week"]');
  const firstRowPlaceholders = requiredItem(weeks, 0, 'first week').querySelectorAll(
    '[part="day-placeholder"]'
  );
  const lastRowPlaceholders = requiredItem(weeks, weeks.length - 1, 'last week').querySelectorAll(
    '[part="day-placeholder"]'
  );
  expect(firstRowPlaceholders.length, "expected a mixed leading row").to.equal(
    3
  );
  expect(
    lastRowPlaceholders.length,
    "expected a fully-outside trailing row"
  ).to.equal(7);

  for (const cell of Array.from(firstRowPlaceholders)) {
    expect(
      cell.getAttribute("aria-hidden"),
      "mixed row already has a visible day cell"
    ).to.equal("true");
  }
  for (const cell of Array.from(lastRowPlaceholders)) {
    expect(
      cell.hasAttribute("aria-hidden"),
      "row role requires at least one visible gridcell; this row has none but placeholders"
    ).to.be.false;
  }
});

for (const [label, selector] of [
  ["a day cell", '[part~="day"]'],
  ["the next-month button", '[part="next"]'],
] as const) {
  it(`paints ${label} one step deeper while it is pressed than while it is merely hovered`, async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
    )) as LyraDatePicker;
    await el.updateComplete;
    const target = el.shadowRoot!.querySelector(selector) as HTMLElement;
    const rest = getComputedStyle(target).backgroundColor;
    const declarations = HOVER_ACTIVE_DECLARATIONS[selector];
    const hoverExpected = resolvedBackground(el, declarations.hover);
    const activeExpected = resolvedBackground(el, declarations.active);
    try {
      await hoverUntilMatched(target, `${label} never reported :hover`);
      await waitUntil(
        () => getComputedStyle(target).backgroundColor === hoverExpected,
        `${label} hover background never eased to the expected colour`
      );
      expect(
        getComputedStyle(target).backgroundColor,
        "hover must move the fill off its resting colour"
      ).to.not.equal(rest);
      await sendMouse({ type: "down" });
      await waitUntil(
        () => getComputedStyle(target).backgroundColor === activeExpected,
        `${label} pressed background never eased to the expected colour`
      );
      expect(
        getComputedStyle(target).backgroundColor,
        "pressed must be visibly stronger than hover, not identical to it"
      ).to.not.equal(hoverExpected);
      await sendMouse({ type: "up" });
    } finally {
      await resetMouse();
    }
  });
}

describe("reviewed date-picker parity surface", () => {
  it("exposes and reflects reviewed IDL values and defaults", async () => {
    const el = (await fixture(
      html`<lr-date-picker></lr-date-picker>`
    )) as LyraDatePicker;
    const callback = (_date: Date): boolean => true;
    const content = (date: Date): string => `day ${date.getDate()}`;
    const dates = [new Date(2026, 6, 4)];
    el.disabledDates = dates;
    el.isDateDisabled = callback;
    el.dayContent = content;
    el.maxRange = 9;
    el.minRange = 2;
    el.pageBy = "single";
    el.today = "2026-07-04";
    el.view = "months";
    el.withWeekNumbers = true;
    await el.updateComplete;

    expect(el.disabledDates).to.equal(dates);
    expect(el.isDateDisabled).to.equal(callback);
    expect(el.dayContent).to.equal(content);
    expect(el.getAttribute("max-range")).to.equal("9");
    expect(el.getAttribute("min-range")).to.equal("2");
    expect(el.getAttribute("page-by")).to.equal("single");
    expect(el.getAttribute("today")).to.equal("2026-07-04");
    expect(el.getAttribute("view")).to.equal("months");
    expect(el.hasAttribute("with-week-numbers")).to.be.true;
    expect(el.firstDayOfWeek).to.equal("auto");
    expect(el.weekdayFormat).to.equal("short");
  });

  it("round-trips valueAsDate and valueAsRange through the reflected ISO value", async () => {
    const el = (await fixture(
      html`<lr-date-picker></lr-date-picker>`
    )) as LyraDatePicker;
    el.valueAsDate = new Date(2026, 6, 15);
    await el.updateComplete;
    expect(el.value).to.equal("2026-07-15");
    expect(el.getAttribute("value")).to.equal("2026-07-15");
    el.mode = "range";
    el.valueAsRange = {
      from: new Date(2026, 6, 20),
      to: new Date(2026, 6, 10),
    };
    await el.updateComplete;
    expect(el.value).to.equal("2026-07-10/2026-07-20");
    expect(el.valueAsRange.from?.getDate()).to.equal(10);
    expect(el.valueAsRange.to?.getDate()).to.equal(20);
  });

  it('writes selection through the range normalizer without emitting user-change events', async () => {
    const el = (await fixture(
      html`<lr-date-picker mode="range"></lr-date-picker>`,
    )) as LyraDatePicker;
    const events: string[] = [];
    for (const type of ['input', 'change', 'lr-input', 'lr-change']) {
      el.addEventListener(type, () => events.push(type));
    }

    el.selection = {
      from: new Date(2026, 6, 20),
      to: new Date(2026, 6, 10),
    };
    await el.updateComplete;

    expect(el.value).to.equal('2026-07-10/2026-07-20');
    expect(el.selection.from?.getDate()).to.equal(10);
    expect(el.selection.to?.getDate()).to.equal(20);
    expect(events, 'controlled range selection stays silent').to.deep.equal([]);

    el.selection = { from: null, to: new Date(2026, 6, 15) };
    await el.updateComplete;
    expect(el.value, 'an incomplete range clears through valueAsRange semantics').to.equal('');
    expect(events).to.deep.equal([]);
  });

  it("accepts branded Date values from another realm for values, ranges, and disabled dates", async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const ForeignDate = frame.contentWindow!.Date;
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
    )) as LyraDatePicker;

    const single = new ForeignDate(2026, 6, 12);
    expect(single instanceof Date).to.equal(false);
    el.valueAsDate = single;
    expect(el.value).to.equal("2026-07-12");

    el.mode = "range";
    el.valueAsRange = {
      from: new ForeignDate(2026, 6, 20),
      to: new ForeignDate(2026, 6, 10),
    };
    expect(el.value).to.equal("2026-07-10/2026-07-20");

    el.mode = "single";
    el.value = "2026-07-15";
    el.disabledDates = [new ForeignDate(2026, 6, 16)];
    await el.updateComplete;
    const disabledDay = el.shadowRoot!.querySelector(
      '[data-date="2026-07-16"]'
    ) as HTMLButtonElement;
    expect(disabledDay.disabled).to.equal(true);
  });

  it("rejects structural Date lookalikes for values, ranges, and disabled dates", async () => {
    const forged = {
      getTime: () => new Date(2026, 6, 16).getTime(),
      getFullYear: () => 2026,
      getMonth: () => 6,
      getDate: () => 16,
      [Symbol.toStringTag]: "Date",
    } as unknown as Date;
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
    )) as LyraDatePicker;

    el.valueAsDate = forged;
    expect(el.value).to.equal("");

    el.mode = "range";
    el.valueAsRange = { from: forged, to: new Date(2026, 6, 20) };
    expect(el.value).to.equal("");

    el.mode = "single";
    el.value = "2026-07-15";
    el.disabledDates = [forged];
    await el.updateComplete;
    const ordinaryDay = el.shadowRoot!.querySelector(
      '[data-date="2026-07-16"]'
    ) as HTMLButtonElement;
    expect(ordinaryDay.disabled).to.equal(false);
  });

  it('uses native Date slots rather than an overridable getTime property', async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`,
    )) as LyraDatePicker;
    const guarded = new Date(2026, 6, 16);
    Object.defineProperty(guarded, 'getTime', {
      configurable: true,
      get(): never {
        throw new Error('component must use the native Date slot');
      },
    });

    expect(() => {
      el.valueAsDate = guarded;
    }).to.not.throw();
    expect(el.value).to.equal('2026-07-16');

    el.mode = 'range';
    expect(() => {
      el.valueAsRange = { from: guarded, to: new Date(2026, 6, 20) };
    }).to.not.throw();
    expect(el.value).to.equal('2026-07-16/2026-07-20');

    el.mode = 'single';
    el.disabledDates = [guarded];
    await el.updateComplete;
    const disabled = el.shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-date="2026-07-16"]',
    )!;
    expect(disabled.disabled).to.equal(true);
  });

  it('keeps a branded disabled-date value working before safely omitting a revoked disabledDates array', async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`,
    )) as LyraDatePicker;
    const guarded = new Date(2026, 6, 16);
    Object.defineProperty(guarded, 'getTime', {
      configurable: true,
      get(): never {
        throw new Error('component must use the native Date slot');
      },
    });

    el.disabledDates = [guarded];
    await el.updateComplete;
    const day = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-date="2026-07-16"]')!;
    expect(day.disabled).to.equal(true);

    const { proxy: revoked, revoke } = Proxy.revocable(['2026-07-16'], {});
    revoke();
    el.disabledDates = revoked as unknown as typeof el.disabledDates;
    await el.updateComplete;

    expect(day.disabled).to.equal(false);
  });

  it('projects a live disabledDates proxy through descriptors, skips an unsafe entry, and retains a later valid date', async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`,
    )) as LyraDatePicker;
    const values: unknown[] = [];
    Object.defineProperty(values, '0', {
      configurable: true,
      enumerable: true,
      get(): never {
        throw new Error('unsafe disabled-date entry');
      },
    });
    values[1] = '2026-07-17';
    const liveProxy = new Proxy(values, {
      get(): never {
        throw new Error('disabledDates must not use live array reads');
      },
    });

    el.disabledDates = liveProxy as unknown as typeof el.disabledDates;
    await el.updateComplete;

    const unsafeDay = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-date="2026-07-16"]')!;
    const retainedDay = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-date="2026-07-17"]')!;
    expect(unsafeDay.disabled, 'the unsafe entry is omitted').to.equal(false);
    expect(retainedDay.disabled, 'the later safe descriptor entry remains effective').to.equal(true);
  });

  it('contains a throwing shadow-root activeElement getter during view updates', async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`,
    )) as LyraDatePicker;
    const root = el.shadowRoot!;
    const prior = Object.getOwnPropertyDescriptor(root, 'activeElement');
    Object.defineProperty(root, 'activeElement', {
      configurable: true,
      get(): never {
        throw new TypeError('hostile activeElement getter');
      },
    });
    try {
      el.view = 'months';
      await el.updateComplete;
      expect(el.view).to.equal('months');
      expect(root.querySelector('[part~="view-item"]') != null).to.equal(true);
    } finally {
      if (prior) Object.defineProperty(root, 'activeElement', prior);
      else delete (root as unknown as { activeElement?: unknown }).activeElement;
    }
  });

  it("combines disabled dates, weekdays, predicates, range limits, and semantic day parts", async () => {
    const el = (await fixture(html`
      <lr-date-picker
        mode="range"
        value="2026-07-10"
        disabled-dates="2026-07-12, 2026-07-13"
        disabled-days-of-week="sun"
        min-range="3"
        max-range="5"
      ></lr-date-picker>
    `)) as LyraDatePicker;
    el.isDateDisabled = (date) => date.getDate() === 14;
    await el.updateComplete;

    for (const iso of [
      "2026-07-11",
      "2026-07-12",
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
    ]) {
      const day = el.shadowRoot!.querySelector(
        `[data-date="${iso}"]`
      ) as HTMLButtonElement;
      expect(day.disabled, iso).to.be.true;
      expect(day.getAttribute("part"), iso).to.include("day-disabled");
    }
    const weekend = el.shadowRoot!.querySelector(
      '[data-date="2026-07-18"]'
    ) as HTMLButtonElement;
    expect(weekend.getAttribute("part")).to.include("day-weekend");
  });

  it("renders reviewed structural parts, week numbers, and all four slots", async () => {
    const el = (await fixture(html`
      <lr-date-picker value="2026-07-15" with-week-numbers>
        <span slot="header">Custom header</span>
        <span slot="previous-icon">Prev</span>
        <span slot="next-icon">Next</span>
        <span slot="footer">Custom footer</span>
      </lr-date-picker>
    `)) as LyraDatePicker;
    await el.updateComplete;
    for (const part of [
      "date-picker",
      "months",
      "month",
      "header",
      "nav",
      "previous",
      "next",
      "title",
      "month-label",
      "weekdays",
      "weekday",
      "weeknumbers",
      "weeknumber",
      "grid",
      "day",
      "day-label",
      "footer",
    ]) {
      expect(el.shadowRoot!.querySelector(`[part~="${part}"]`), part).to.exist;
    }
    for (const name of ["header", "previous-icon", "next-icon", "footer"]) {
      const slot = el.shadowRoot!.querySelector(
        `slot[name="${name}"]`
      ) as HTMLSlotElement;
      expect(slot.assignedElements().length, name).to.equal(1);
    }
  });

  it("supports day content and emits non-cancelable focus/view events with reviewed detail", async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
    )) as LyraDatePicker;
    el.dayContent = (date) => (date.getDate() === 15 ? "Payday" : undefined);
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[data-date="2026-07-15"]')!.textContent
    ).to.include("Payday");

    const focusEvent = oneEvent(el, "lr-focus-day");
    (
      el.shadowRoot!.querySelector(
        '[data-date="2026-07-16"]'
      ) as HTMLButtonElement
    ).focus();
    const focused = (await focusEvent) as CustomEvent<{ date: Date }>;
    expect(focused.cancelable).to.be.false;
    expect(focused.detail.date.getDate()).to.equal(16);
    expect(el.focusedDate).to.equal("2026-07-16");

    const viewEvent = oneEvent(el, "lr-view-change");
    (
      el.shadowRoot!.querySelector('[part~="title"]') as HTMLButtonElement
    ).click();
    const viewed = (await viewEvent) as CustomEvent<{
      view: string;
      date: Date;
    }>;
    expect(viewed.cancelable).to.be.false;
    expect(viewed.detail.view).to.equal("months");
    expect(viewed.detail.date).to.be.instanceOf(Date);
  });

  it("emits exactly one native InputEvent/Event pair in order from the host", async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
    )) as LyraDatePicker;
    await el.updateComplete;
    const seen: Event[] = [];
    for (const name of ["input", "change"])
      el.addEventListener(name, (event) => seen.push(event));
    (
      el.shadowRoot!.querySelector(
        '[data-date="2026-07-20"]'
      ) as HTMLButtonElement
    ).click();
    expect(seen.map((event) => event.type)).to.deep.equal(["input", "change"]);
    expect(seen[0] instanceof InputEvent).to.be.true;
    expect(seen[1] instanceof Event).to.be.true;
    expect(seen[1] instanceof CustomEvent).to.be.false;
    for (const event of seen) {
      expect(event.target === el, event.type).to.be.true;
      expect(event.bubbles, event.type).to.be.true;
      expect(event.composed, event.type).to.be.true;
      expect(event.cancelable, event.type).to.be.false;
    }
  });

  it("publishes disabled/range/readonly states and is accessible when populated", async () => {
    const el = (await fixture(html`
      <lr-date-picker
        mode="range"
        value="2026-07-10/2026-07-15"
        readonly
        with-week-numbers
      >
        <span slot="footer">Choose a reporting period</span>
      </lr-date-picker>
    `)) as LyraDatePicker;
    await el.updateComplete;
    const internals = (el as unknown as { internals: ElementInternals })
      .internals;
    expect(internals.states.has("range")).to.be.true;
    expect(internals.states.has("readonly")).to.be.true;
    expect(internals.states.has("disabled")).to.be.false;
    await expect(el).shadowDom.to.be.accessible();
  });
});

// vocabulary but no date logic. This reuses that vocabulary here rather than inventing a second one.
describe('range presets', () => {
  const PRESETS = [
    { label: 'Last 7 days', start: '2026-08-13', end: '2026-08-19' },
    { label: 'Last 30 days', start: '2026-07-21', end: '2026-08-19' },
  ];

  async function pickerWith(mode: string): Promise<LyraDatePicker> {
    const el = (await fixture(
      html`<lr-date-picker mode=${mode}></lr-date-picker>`,
    )) as LyraDatePicker;
    el.presets = PRESETS;
    await el.updateComplete;
    return el;
  }

  const buttons = (el: LyraDatePicker): HTMLButtonElement[] =>
    Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="preset-button"]'));

  it('renders nothing at all while presets are unset', async () => {
    const el = (await fixture(
      html`<lr-date-picker mode="range"></lr-date-picker>`,
    )) as LyraDatePicker;
    await el.updateComplete;

    expect(buttons(el).length, 'opt-in only').to.equal(0);
    expect(
      el.shadowRoot!.querySelector('[part~="presets"]') === null,
      'no empty row either',
    ).to.be.true;
  });

  it('normalizes non-array preset assignments to an empty collection and remains recoverable', async () => {
    const el = (await fixture(
      html`<lr-date-picker mode="range"></lr-date-picker>`,
    )) as LyraDatePicker;

    el.presets = null as unknown as readonly (typeof PRESETS)[number][];
    await el.updateComplete;
    expect(el.presets).to.deep.equal([]);
    expect(buttons(el)).to.have.lengthOf(0);

    el.presets = { label: 'not a collection' } as unknown as readonly (typeof PRESETS)[number][];
    await el.updateComplete;
    expect(el.presets).to.deep.equal([]);

    el.presets = PRESETS;
    await el.updateComplete;
    expect(buttons(el).map((button) => button.textContent?.trim())).to.deep.equal([
      'Last 7 days',
      'Last 30 days',
    ]);
  });

  it('omits non-object entries from an otherwise valid preset collection', async () => {
    const el = (await fixture(
      html`<lr-date-picker mode="range"></lr-date-picker>`,
    )) as LyraDatePicker;

    el.presets = [null, 42, PRESETS[0]] as unknown as readonly (typeof PRESETS)[number][];
    await el.updateComplete;

    expect(buttons(el).map((button) => button.textContent?.trim())).to.deep.equal([
      'Last 7 days',
    ]);
  });

  it('renders one labelled button per preset in range mode', async () => {
    const el = await pickerWith('range');
    const labels = buttons(el).map((button) => button.textContent?.trim());

    expect(labels).to.deep.equal(['Last 7 days', 'Last 30 days']);
    expect(buttons(el)[0]!.getAttribute('aria-pressed')).to.equal('false');
  });

  it('ignores presets outside range mode, where a two-date range has no meaning', async () => {
    const el = await pickerWith('single');
    expect(buttons(el).length, 'a single-date picker cannot apply a range').to.equal(0);
  });

  it('commits the range and emits input then change, exactly like a two-click selection', async () => {
    const el = await pickerWith('range');
    const seen: string[] = [];
    el.addEventListener('input', () => seen.push('input'));
    el.addEventListener('change', () => seen.push('change'));

    buttons(el)[0]!.click();
    await el.updateComplete;

    expect(el.value).to.equal('2026-08-13/2026-08-19');
    expect(seen, 'the documented pair, in order').to.deep.equal(['input', 'change']);
  });

  it('marks the active preset with aria-pressed and data-active', async () => {
    const el = await pickerWith('range');
    buttons(el)[1]!.click();
    await el.updateComplete;

    expect(buttons(el)[1]!.getAttribute('aria-pressed')).to.equal('true');
    expect(buttons(el)[1]!.hasAttribute('data-active')).to.be.true;
    expect(buttons(el)[0]!.getAttribute('aria-pressed'), 'only one at a time').to.equal('false');
  });

  it('normalizes a reversed preset instead of committing a backwards range', async () => {
    const el = await pickerWith('range');
    el.presets = [{ label: 'Backwards', start: '2026-08-19', end: '2026-08-13' }];
    await el.updateComplete;

    buttons(el)[0]!.click();
    await el.updateComplete;
    expect(el.value).to.equal('2026-08-13/2026-08-19');
  });

  it('ignores a malformed preset rather than clearing the current value', async () => {
    const el = await pickerWith('range');
    buttons(el)[0]!.click();
    await el.updateComplete;
    const committed = el.value;

    el.presets = [{ label: 'Broken', start: 'not-a-date', end: '2026-08-19' }];
    await el.updateComplete;
    buttons(el)[0]!.click();
    await el.updateComplete;

    expect(el.value, 'a bad config entry must not read as "the user picked nothing"').to.equal(
      committed,
    );
  });

  it('refuses to apply while disabled or readonly', async () => {
    const el = await pickerWith('range');
    el.disabled = true;
    await el.updateComplete;
    buttons(el)[0]!.click();
    await el.updateComplete;
    expect(el.value).to.equal('');

    el.disabled = false;
    el.readonly = true;
    await el.updateComplete;
    buttons(el)[0]!.click();
    await el.updateComplete;
    expect(el.value).to.equal('');
  });

  it('is accessible with a preset row', async () => {
    const el = await pickerWith('range');
    await expect(el).to.be.accessible();
  });
});
