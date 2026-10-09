import { resolvedInShadow } from '../../../../test/shadow-style.js';
// Focused rendering and accessibility cases. Test bodies and titles were moved intact from the prior suite.
import { fixture, expect, html, waitUntil } from "@open-wc/testing";
import "./time-range.js";
import type { LyraTimeRange } from "./time-range.js";
import { styles } from "./time-range.styles.js";
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from "../../../../test/wtr-mouse.js";
import { setReducedMotion } from "../../../../test/wtr-media.js";

const PRESETS = [
  { label: "Last 7 days", start: 0, end: 7 },
  { label: "Last 30 days", start: 0, end: 30 },
  { label: "Last 90 days", start: 0, end: 90 },
];

it("is accessible", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  await expect(el).to.be.accessible();
});

it("formats each handle value as aria-valuetext while preserving numeric slider state", async () => {
  const labels = ["April 2023", "May 2023", "June 2023"];
  const el = (await fixture(html`
    <lr-time-range
      min="0"
      max="2"
      start="0"
      end="2"
      .valueFormatter=${(value: number, handle: "start" | "end") =>
        `${handle === "start" ? "From" : "Through"} ${labels[value]}`}
    ></lr-time-range>
  `)) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;

  expect(startHandle.getAttribute("aria-valuenow")).to.equal("0");
  expect(startHandle.getAttribute("aria-valuetext")).to.equal(
    "From April 2023"
  );
  expect(endHandle.getAttribute("aria-valuenow")).to.equal("2");
  expect(endHandle.getAttribute("aria-valuetext")).to.equal(
    "Through June 2023"
  );

  el.start = 1;
  await el.updateComplete;
  expect(startHandle.getAttribute("aria-valuetext")).to.equal("From May 2023");
});

it("omits aria-valuetext when valueFormatter is unset (opt-in regression)", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  expect(startHandle.hasAttribute("aria-valuetext")).to.be.false;
  expect(endHandle.hasAttribute("aria-valuetext")).to.be.false;
});

it("does not let start/end render outside the track after a domain change", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  el.max = 50;
  await el.updateComplete;
  const range = el.shadowRoot!.querySelector('[part="range"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  expect(parseFloat(range.style.insetInlineStart)).to.be.at.least(0);
  expect(
    parseFloat(range.style.insetInlineStart) +
      parseFloat(range.style.inlineSize)
  ).to.be.at.most(100);
  expect(parseFloat(startHandle.style.insetInlineStart)).to.be.within(0, 100);
  expect(parseFloat(endHandle.style.insetInlineStart)).to.be.within(0, 100);
});

// never elements — a DOM node as chai's actual/expected hangs the whole file.
it("moves a drag handle’s painted fill on hover, and further again while it is grabbed", async () => {
  // `--lr-transition-fast: 0s` for the same reason the three sibling paint tests below set it: the
  // handle fill TRANSITIONS between rest/hover/pressed, so a synchronous read right after a
  // synthetic pointer event samples a mid-transition colour and `pressed` can still equal
  // `hovered`. Observed failing exactly that way on Firefox under the parallel full-engine sweep.
  // The reads below additionally poll rather than snapshot once, mirroring the same fix already
  // applied to slider.test.ts's thumb hover/active assertions.
  const el = (await fixture(
    html`<lr-time-range data-lr-theme-scope
      min="0"
      max="100"
      start="20"
      end="80"
      style="--lr-transition-fast: 0s"
    ></lr-time-range>`
  )) as LyraTimeRange;
  await el.updateComplete;
  const handle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const fill = (): string => getComputedStyle(handle).backgroundColor;
  const rest = fill();
  try {
    // Land the pointer rather than merely dispatching one move at a rect read earlier:
    // `sendMouse` resolves when the synthesized command completes, not when the browser processed
    // the resulting native pointer event, and a track that settles late moves the handle out from
    // under an already-dispatched position -- the poll below would then time out on a hover that
    // never happened. hoverUntilMatched() re-reads the rect and re-dispatches until the handle
    // really matches `:hover` (docs/agents/testing.md).
    await hoverUntilMatched(handle, "the start handle never took the pointer");
    await waitUntil(
      () => fill() !== rest,
      "hover must move the fill off its resting colour"
    );
    const hovered = fill();
    await sendMouse({ type: "down" });
    await waitUntil(
      () => fill() !== hovered && fill() !== rest,
      "pressed must be visibly stronger than both hover and rest"
    );
    const pressed = fill();
    const grabbedCursor = getComputedStyle(handle).cursor;
    await sendMouse({ type: "up" });
    expect(pressed).to.not.equal(rest);
    expect(
      grabbedCursor,
      "a grabbed handle shows the closed-hand cursor"
    ).to.equal("grabbing");
  } finally {
    await resetMouse();
  }
});

it("fills a hovered preset from the shared hover-bg name", async () => {
  const el = (await fixture(html`
    <lr-time-range min="0" max="100" start="10" end="90"
      style="--lr-transition-interactive: none; --lr-time-range-preset-hover-bg: rgb(1, 2, 3)"></lr-time-range>
  `)) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const preset = el.shadowRoot!.querySelector('[part="preset-button"]') as HTMLElement;
  try {
    await hoverUntilMatched(preset, "the preset button never took the pointer");
    await waitUntil(() => getComputedStyle(preset).backgroundColor === "rgb(1, 2, 3)", "hover-bg never applied");
  } finally {
    await resetMouse();
  }
});

it("themes preset and handle hover/pressed paint through independent component hooks", async () => {
  const el = (await fixture(html`
    <lr-time-range data-lr-theme-scope
      min="0"
      max="100"
      start="10"
      end="90"
      style="
        --lr-transition-fast: 0s;
        --lr-time-range-preset-hover-border-color: rgb(1, 2, 3);
        --lr-time-range-preset-pressed-border-color: rgb(4, 5, 6);
        --lr-time-range-preset-pressed-bg: rgb(7, 8, 9);
        --lr-time-range-handle-hover-bg: rgb(10, 11, 12);
        --lr-time-range-handle-pressed-bg: rgb(13, 14, 15);
      "
    ></lr-time-range>
  `)) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const preset = el.shadowRoot!.querySelector(
    '[part="preset-button"]'
  ) as HTMLElement;
  const handle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  try {
    // Each read below is pointer-driven, so it is polled after the pointer is proven to have
    // landed: `sendMouse` resolves when the command completes, not when the browser processed the
    // native pointer event and recomputed `:hover`/`:active` (docs/agents/testing.md).
    await hoverUntilMatched(preset, "the preset button never took the pointer");
    await waitUntil(() => getComputedStyle(preset).borderTopColor === "rgb(1, 2, 3)", 'preset border top color never reached the hover hook "rgb(1, 2, 3)"');
    expect(getComputedStyle(preset).borderTopColor).to.equal("rgb(1, 2, 3)");
    await sendMouse({ type: "down" });
    await waitUntil(() => getComputedStyle(preset).borderTopColor === "rgb(4, 5, 6)", 'preset border top color never reached "rgb(4, 5, 6)"');
    expect(getComputedStyle(preset).backgroundColor).to.equal("rgb(7, 8, 9)");
    await sendMouse({ type: "up" });

    await hoverUntilMatched(handle, "the start handle never took the pointer");
    await waitUntil(() => getComputedStyle(handle).backgroundColor === "rgb(10, 11, 12)", 'handle background color never reached the hover hook "rgb(10, 11, 12)"');
    expect(getComputedStyle(handle).backgroundColor).to.equal(
      "rgb(10, 11, 12)"
    );
    await sendMouse({ type: "down" });
    await waitUntil(() => getComputedStyle(handle).backgroundColor === "rgb(13, 14, 15)", 'handle background color never reached "rgb(13, 14, 15)"');
    await sendMouse({ type: "up" });
  } finally {
    await resetMouse();
  }
});

describe("preset-button hover specificity", () => {
  it("wraps the internal :hover:not(:disabled) rule in :where() so a consumer ::part(preset-button):hover override does not need !important", async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <style>
          lr-time-range::part(preset-button):hover {
            border-color: rgb(7, 8, 9);
          }
        </style>
        <lr-time-range data-lr-theme-scope
          style="--lr-transition-fast: 0ms"
          .presets=${[{ label: "Last 7 days", start: 0, end: 7 }]}
        ></lr-time-range>
      </div>
    `);
    const el = wrapper.querySelector("lr-time-range") as LyraTimeRange;
    const preset = el.shadowRoot!.querySelector<HTMLElement>(
      '[part="preset-button"]'
    )!;
    try {
      // hoverUntilMatched() re-reads the rect and re-dispatches until the button really matches
      // `:hover`; one `sendMouse` move only proves the command was sent, so a preset row that
      // settled after its rect was read leaves the pointer beside the button and the poll below
      // fails on a hover that never happened.
      await hoverUntilMatched(
        preset,
        "the preset button never took the pointer"
      );
      await waitUntil(
        () => getComputedStyle(preset).borderColor === "rgb(7, 8, 9)",
        "consumer preset-button hover border did not win"
      );
      expect(getComputedStyle(preset).borderColor).to.equal("rgb(7, 8, 9)");
    } finally {
      await resetMouse();
    }
  });
});

it('targets the real preset-button part in the reduced-motion override, not a nonexistent "preset" part', async () => {
  const reducedMotionBlock =
    styles.cssText.match(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*/
    )?.[0] ?? "";
  expect(reducedMotionBlock).to.match(/\[part=["']preset-button["']\]/);
  // The pre-fix selector was `[part='preset']`, which never matches the button's real
  // `preset-button` part -- assert the exact broken selector string is gone.
  expect(reducedMotionBlock).to.not.match(/\[part=["']preset["']\]/);

  try {
    await setReducedMotion("no-preference");
    const el = (await fixture(
      html`<lr-time-range data-lr-theme-scope
        style="--lr-transition-fast: 2s"
        min="0"
        max="100"
        start="20"
        end="80"
        .presets=${[{ label: "Last hour", start: 0, end: 10 }]}
      ></lr-time-range>`
    )) as LyraTimeRange;
    const presetButton = el.shadowRoot!.querySelector<HTMLElement>(
      '[part="preset-button"]'
    )!;
    expect(
      getComputedStyle(presetButton).transitionDuration.split(',').map((value) => value.trim()),
    ).to.deep.equal(['2s', '2s', '2s']);

    await setReducedMotion("reduce");
    await waitUntil(
      () =>
        getComputedStyle(presetButton).transitionDuration
          .split(',')
          .every((value) => value.trim() === '0s'),
      "time-range preset transition did not stop under reduced motion"
    );
  } finally {
    await setReducedMotion("no-preference");
  }
});

it("renders handles/fill in the correct left-to-right order when min > max (inverted domain)", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="100"
      max="0"
      start="20"
      end="80"
      step="5"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const range = el.shadowRoot!.querySelector('[part="range"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  // Before the fix, percentOf() indexed off this.min/this.max directly, so
  // start (20) rendered at 80% and end (80) at 20% — visually swapped, with
  // a negative (invalid) fill width. It must instead match willUpdate()'s
  // lo/hi normalization of the min>max domain, same as a min=0/max=100 case.
  expect(startHandle.style.insetInlineStart).to.equal("20%");
  expect(endHandle.style.insetInlineStart).to.equal("80%");
  expect(range.style.insetInlineStart).to.equal("20%");
  expect(range.style.inlineSize).to.equal("60%");
});

it('does not render invalid CSS or an aria-valuenow="NaN" when start fails Number attribute conversion', async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="not-a-number"
      end="80"
    ></lr-time-range>`
  )) as LyraTimeRange;
  expect(Number.isNaN(el.start)).to.be.true;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  // Before the fix, percentOf(NaN) produced `inset-inline-start:NaN%`, an
  // invalid CSS value the browser silently drops, and the template bound
  // aria-valuenow to the literal NaN.
  expect(startHandle.style.insetInlineStart).to.equal("0%");
  expect(startHandle.hasAttribute("aria-valuenow")).to.be.false;
});

it("keeps infinities out of domain geometry and ARIA attributes", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="Infinity"
      max="100"
      start="Infinity"
      end="-Infinity"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const handles = [
    ...el.shadowRoot!.querySelectorAll('[role="slider"]'),
  ] as HTMLElement[];
  handles.forEach((handle) => {
    expect(handle.getAttribute("aria-valuemin") ?? "").to.not.include(
      "Infinity"
    );
    expect(handle.getAttribute("aria-valuemax") ?? "").to.not.include(
      "Infinity"
    );
    expect(handle.getAttribute("aria-valuenow") ?? "").to.not.include(
      "Infinity"
    );
    expect(handle.getAttribute("style")).to.not.match(/NaN|Infinity/);
  });
});

it("lets a formatter omit aria-valuetext for either handle with a nullish result", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="38" start="0" end="38"></lr-time-range>`
  )) as LyraTimeRange;
  el.valueFormatter = (value, handle) =>
    handle === "start" ? `Month ${value}` : undefined;
  await el.updateComplete;

  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  expect(startHandle.getAttribute("aria-valuetext")).to.equal("Month 0");
  expect(endHandle.hasAttribute("aria-valuetext")).to.be.false;
});

it("never passes a non-finite handle value to valueFormatter or aria-valuetext", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="38"
      start="not-a-number"
      end="38"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const formattedHandles: string[] = [];
  el.valueFormatter = (value, handle) => {
    formattedHandles.push(`${handle}:${value}`);
    return `Month ${value}`;
  };
  await el.updateComplete;

  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  expect(formattedHandles).to.deep.equal(["end:38"]);
  expect(startHandle.hasAttribute("aria-valuetext")).to.be.false;
  expect(endHandle.getAttribute("aria-valuetext")).to.equal("Month 38");
});

it("defaults each handle's aria-label and lets startLabel/endLabel override them", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  // Unset, these match the literal text this component always rendered
  // before startLabel/endLabel existed -- non-breaking default.
  expect(startHandle.getAttribute("aria-label")).to.equal("Range start");
  expect(endHandle.getAttribute("aria-label")).to.equal("Range end");

  el.startLabel = "From";
  el.endLabel = "To";
  await el.updateComplete;
  // Before the fix, both aria-labels were hardcoded literals with no
  // property to override them, so this assignment would have had no effect
  // on what's actually rendered.
  expect(startHandle.getAttribute("aria-label")).to.equal("From");
  expect(endHandle.getAttribute("aria-label")).to.equal("To");
});

it("resolves the rangeStart/rangeEnd aria-label keys through a .strings override", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      .strings=${{ rangeStart: "Début de plage", rangeEnd: "Fin de plage" }}
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  // With startLabel/endLabel left at their defaults, the aria-labels must resolve through the
  // localization registry -- a strings override reaching the DOM proves the call sites pass no
  // unconditional fallback that would short-circuit it.
  expect(startHandle.getAttribute("aria-label")).to.equal("Début de plage");
  expect(endHandle.getAttribute("aria-label")).to.equal("Fin de plage");
});

it("treats every supplied handle label literally, including the former English sentinels and empty strings", async () => {
  const el = (await fixture(html`
    <lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      start-label="Range start"
      end-label="Range end"
      .strings=${{ rangeStart: "Début de plage", rangeEnd: "Fin de plage" }}
    ></lr-time-range>
  `)) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;

  expect(startHandle.getAttribute("aria-label")).to.equal("Range start");
  expect(endHandle.getAttribute("aria-label")).to.equal("Range end");

  el.startLabel = "";
  el.endLabel = "";
  await el.updateComplete;
  expect(startHandle.getAttribute("aria-label")).to.equal("");
  expect(endHandle.getAttribute("aria-label")).to.equal("");
});

it("reflects startLabel/endLabel from their start-label/end-label content attributes", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      start-label="From"
      end-label="To"
    ></lr-time-range>`
  )) as LyraTimeRange;
  expect(el.startLabel).to.equal("From");
  expect(el.endLabel).to.equal("To");
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  expect(startHandle.getAttribute("aria-label")).to.equal("From");
  expect(endHandle.getAttribute("aria-label")).to.equal("To");
});

it("marks handles aria-disabled when disabled, for screen readers browsing by virtual cursor", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      disabled
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  expect(startHandle.getAttribute("aria-disabled")).to.equal("true");
  expect(endHandle.getAttribute("aria-disabled")).to.equal("true");

  el.disabled = false;
  await el.updateComplete;
  expect(startHandle.getAttribute("aria-disabled")).to.equal("false");
  expect(endHandle.getAttribute("aria-disabled")).to.equal("false");
});

it("renders a stable 0%/100% pair instead of dividing by zero when min === max", async () => {
  const el = (await fixture(
    html`<lr-time-range min="50" max="50" start="50" end="50"></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  expect(startHandle.style.insetInlineStart).to.equal("0%");
  expect(endHandle.style.insetInlineStart).to.equal("0%");
});

it("binds each handle's aria-valuemin/aria-valuemax to its reachable sub-range bounded by the sibling handle, not the full domain", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  // Before the fix, both handles reported the full [min, max]=[0, 100] pair,
  // implying a reachable range that clamp() actually forbids past the
  // sibling handle's current value.
  expect(startHandle.getAttribute("aria-valuemin")).to.equal("0");
  expect(startHandle.getAttribute("aria-valuemax")).to.equal("80");
  expect(endHandle.getAttribute("aria-valuemin")).to.equal("20");
  expect(endHandle.getAttribute("aria-valuemax")).to.equal("100");
});

it('does not mark the keyboard gesture changed when End is pressed while already at the reachable maximum', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="50" end="50"></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const events: string[] = [];
  for (const type of ["lr-input", "lr-change"]) {
    el.addEventListener(type, () => events.push(type));
  }
  // reachableBounds('start').max is the sibling's own value (50), and start is already there --
  // setValue() returns false, so the `|| this.keyboardChanged` fallback on the End branch must
  // leave keyboardChanged exactly as it already was instead of forcing it true.
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true })
  );
  startHandle.dispatchEvent(
    new KeyboardEvent("keyup", { key: "End", bubbles: true })
  );
  expect(el.start).to.equal(50);
  expect(events, "no value changed, so nothing was emitted").to.deep.equal([]);
});

it('renders no [part="presets"] row at all when presets is empty (the default)', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  expect(el.presets).to.deep.equal([]);
  expect(el.shadowRoot!.querySelector('[part="presets"]') === null).to.equal(
    true
  );
  expect(
    el.shadowRoot!.querySelectorAll('[part="preset-button"]').length
  ).to.equal(0);
});

it('renders a [part="presets"] row of [part="preset-button"] buttons when presets is non-empty', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="presets"]');
  expect(row !== null).to.equal(true);
  const buttons = el.shadowRoot!.querySelectorAll('[part="preset-button"]');
  expect(buttons.length).to.equal(3);
  const lastThirtyDays = buttons[1];
  if (!lastThirtyDays) throw new Error('The Last 30 days preset was not rendered.');
  expect(lastThirtyDays.textContent).to.include("Last 30 days");
  // the brush itself must be completely unaffected: same track/handles.
  expect(el.shadowRoot!.querySelector('[part="base"]')).to.not.equal(null);
  expect(el.shadowRoot!.querySelector('[part="handle-start"]')).to.not.equal(
    null
  );
  expect(el.shadowRoot!.querySelector('[part="handle-end"]')).to.not.equal(
    null
  );
});

it("still refuses to apply a preset when the button's disabled attribute has not re-rendered yet (sync disable / async render gap)", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="preset-button"]'
  )!;
  expect(button.disabled, "not yet disabled").to.be.false;

  // Disabling flips `_disabled` synchronously (see the `disabled` setter's own doc comment), but
  // the button's `?disabled=${effectiveDisabled}` binding only re-renders on the next (async) Lit
  // update -- a click delivered in exactly this window still reaches the native, still-enabled
  // button's click handler, so applyPreset() has to refuse it on its own rather than relying on
  // the button already being disabled in the DOM.
  el.disabled = true;
  expect(button.disabled, "the DOM has not re-rendered yet").to.be.false;

  button.click();
  await el.updateComplete;
  expect(el.start, "the preset must not have applied").to.equal(20);
  expect(el.end).to.equal(80);
});

it("is accessible with presets set", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="0" end="30"></lr-time-range>`
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

describe("active-preset cssprops", () => {

  const overrides =
    "--lr-time-range-preset-active-bg: rgb(0, 51, 102);" +
    "--lr-time-range-preset-active-border-color: rgb(0, 102, 51);" +
    "--lr-time-range-preset-active-color: rgb(255, 255, 0);";

  async function themed(style: string): Promise<LyraTimeRange> {
    const wrapper = (await fixture(html`
      <div style=${style}>
        <lr-time-range min="0" max="100" start="0" end="30"></lr-time-range>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector("lr-time-range") as LyraTimeRange;
    el.presets = PRESETS;
    await el.updateComplete;
    el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="preset-button"]')[1]!.click();
    await el.updateComplete;
    return el;
  }

  it("recolors the active preset from an ancestor, not a :host-declared prop", async () => {
    const el = await themed(overrides);
    const active = el.shadowRoot!.querySelector(
      '[part="preset-button"][data-active]'
    ) as HTMLElement;
    expect(active != null).to.equal(true);
    expect(active.textContent).to.include("Last 30 days");
    const rendered = getComputedStyle(active);
    expect(rendered.backgroundColor).to.equal("rgb(0, 51, 102)");
    expect(rendered.borderTopColor).to.equal("rgb(0, 102, 51)");
    expect(rendered.color).to.equal("rgb(255, 255, 0)");
    // A non-active preset keeps its resting surface treatment -- the props are scoped to
    // [data-active] only.
    const inactive = el.shadowRoot!.querySelector(
      '[part="preset-button"]:not([data-active])'
    ) as HTMLElement;
    expect(getComputedStyle(inactive).backgroundColor).to.equal(
      resolvedInShadow(
        el,
        "background: var(--lr-color-surface)",
        "background-color"
      )
    );
  });

  it("renders byte-identically to the pre-cssprop output when the props are unset", async () => {
    const el = await themed("");
    const active = el.shadowRoot!.querySelector(
      '[part="preset-button"][data-active]'
    ) as HTMLElement;
    const rendered = getComputedStyle(active);
    expect(rendered.backgroundColor).to.equal(
      resolvedInShadow(
        el,
        "background: var(--lr-color-brand)",
        "background-color"
      )
    );
    expect(rendered.borderTopColor).to.equal(
      resolvedInShadow(
        el,
        "border-color: var(--lr-color-brand)",
        "border-top-color"
      )
    );
    expect(rendered.color).to.equal(
      resolvedInShadow(el, "color: var(--lr-color-on-brand)", "color")
    );
  });

  it("accepts the shared preset-selected names, which win over the active-preset names", async () => {
    const el = await themed(
      overrides +
        "--lr-time-range-preset-selected-bg: rgb(1, 2, 3);" +
        "--lr-time-range-preset-selected-border-color: rgb(4, 5, 6);" +
        "--lr-time-range-preset-selected-color: rgb(7, 8, 9);"
    );
    const active = el.shadowRoot!.querySelector(
      '[part="preset-button"][data-active]'
    ) as HTMLElement;
    const rendered = getComputedStyle(active);
    expect([rendered.backgroundColor, rendered.borderTopColor, rendered.color]).to.deep.equal([
      "rgb(1, 2, 3)",
      "rgb(4, 5, 6)",
      "rgb(7, 8, 9)",
    ]);
  });

  it("is accessible with the active-preset props themed", async () => {
    const el = await themed(overrides);
    await expect(el).to.be.accessible();
  });
});

it("scales the drag-handle hit-area proportionally, floored at 24px", async () => {
  // The 2xs/xs/s/m tiers land on exact integer pixels (the 24px floor, and
  // the unscaled 28px base), so they compare against an exact string.
  const exact: Record<string, string> = {
    "2xs": "24px",
    xs: "24px",
    s: "24px",
    m: "28px",
  };
  for (const [size, px] of Object.entries(exact)) {
    const el = await fixture(
      html`<lr-time-range size=${size}></lr-time-range>`
    );
    const handle = el.shadowRoot!.querySelector(
      '[part="handle-start"]'
    ) as HTMLElement;
    const before = getComputedStyle(handle, "::before");
    expect(before.inlineSize, `size=${size}`).to.equal(px);
  }

  // The l/xl tiers multiply 28px by a non-integer scale (1.2/1.4), so the
  // exact result (33.6px/39.2px) isn't representable in IEEE754 binary
  // floating point; combined with each engine's own subpixel layout
  // rounding, the rendered value can come out a few thousandths of a pixel
  // off the mathematical target (e.g. Chromium renders `l` as 33.5938px, not
  // 33.6px). This suite runs across Chromium/Firefox/WebKit
  // (`test:platform` in ci.yml), so a hardcoded exact px string here would
  // be fragile per-engine -- compare numerically with a tolerance instead,
  // which still proves the proportional-scaling math is correct.
  const approximate: Record<string, number> = {
    l: 33.6,
    xl: 39.2,
  };
  for (const [size, px] of Object.entries(approximate)) {
    const el = await fixture(
      html`<lr-time-range size=${size}></lr-time-range>`
    );
    const handle = el.shadowRoot!.querySelector(
      '[part="handle-start"]'
    ) as HTMLElement;
    const before = getComputedStyle(handle, "::before");
    expect(parseFloat(before.inlineSize), `size=${size}`).to.be.closeTo(
      px,
      0.1
    );
  }
});

it("accepts the Web Awesome size spellings, rendering small/medium/large as s/m/l", async () => {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ["small", "s"],
    ["medium", "m"],
    ["large", "l"],
  ];
  const hit = async (size: string): Promise<string> => {
    const el = await fixture(
      html`<lr-time-range size=${size}></lr-time-range>`
    );
    const handle = el.shadowRoot!.querySelector(
      '[part="handle-start"]'
    ) as HTMLElement;
    return getComputedStyle(handle, "::before").inlineSize;
  };
  for (const [alias, step] of pairs) {
    expect(await hit(alias), `handle hit-area for ${alias}`).to.equal(
      await hit(step)
    );
  }
});

it("exposes independent handle, hit-area, track, and base size hooks", async () => {
  const el = (await fixture(html`
    <lr-time-range
      style="
        --lr-time-range-handle-size: 20px;
        --lr-time-range-hit-size: 30px;
        --lr-time-range-track-size: 6px;
        --lr-time-range-base-size: 36px;
      "
    ></lr-time-range>
  `)) as LyraTimeRange;
  const handle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(handle).inlineSize).to.equal("20px");
  expect(getComputedStyle(handle, "::before").inlineSize).to.equal("30px");
  expect(getComputedStyle(track).blockSize).to.equal("6px");
  expect(getComputedStyle(base).blockSize).to.equal("36px");
});

it('defaults to size "m" and reflects a size attribute', async () => {
  const defaultEl = (await fixture(
    html`<lr-time-range></lr-time-range>`
  )) as LyraTimeRange;
  expect(defaultEl.size).to.equal("m");
  const el = (await fixture(
    html`<lr-time-range size="s"></lr-time-range>`
  )) as LyraTimeRange;
  expect(el.getAttribute("size")).to.equal("s");
  expect(el.size).to.equal("s");
});

it("floors the preset-button hit-area at 24px at the 2xs tier, without disturbing its natural (already-compliant) size at m", async () => {
  // [part="preset-button"] is a real interactive <button>, not a decorative label. Before the
  // size-scaling `min-block-size`/`min-inline-size` floor was added, the unfloored
  // `calc(var(--lr-space-xs) * var(--lr-time-range-size-scale))`/font-size math shrank this
  // button to ~15px tall at the 2xs tier -- well under the WCAG 2.5.8 24px minimum hit-area,
  // even though the m/l/xl tiers already cleared it unaided (28px/33.6px/37.2px).
  const el2xs = (await fixture(
    html`<lr-time-range size="2xs"></lr-time-range>`
  )) as LyraTimeRange;
  el2xs.presets = PRESETS;
  await el2xs.updateComplete;
  const button2xs = el2xs.shadowRoot!.querySelector(
    '[part="preset-button"]'
  ) as HTMLElement;
  const rendered2xs = getComputedStyle(button2xs);
  expect(parseFloat(rendered2xs.blockSize)).to.be.at.least(24);
  expect(parseFloat(rendered2xs.inlineSize)).to.be.at.least(24);

  const elM = (await fixture(
    html`<lr-time-range size="m"></lr-time-range>`
  )) as LyraTimeRange;
  elM.presets = PRESETS;
  await elM.updateComplete;
  const buttonM = elM.shadowRoot!.querySelector(
    '[part="preset-button"]'
  ) as HTMLElement;
  // The default `m` tier was never part of the regression (already above the floor, unaided) --
  // the added min-block-size must not change its rendered size. The exact px value depends on the
  // platform's font metrics (line-height from `font: inherit`), so instead of hardcoding a literal
  // that only holds for one font stack, compare against the same element with the floor disabled:
  // if the floor were engaging at `m`, removing it would shrink the button; it must not.
  const flooredHeight = parseFloat(getComputedStyle(buttonM).blockSize);
  buttonM.style.setProperty("min-block-size", "0");
  const unflooredHeight = parseFloat(getComputedStyle(buttonM).blockSize);
  expect(flooredHeight).to.equal(unflooredHeight);
  expect(flooredHeight).to.be.at.least(24);
});

it("exposes the native label and validation surface of its form association", async () => {
  const form = (await fixture(html`
    <form>
      <label id="window-label" for="window">Window</label>
      <lr-time-range
        id="window"
        min="0"
        max="100"
        start="10"
        end="60"
      ></lr-time-range>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-time-range") as LyraTimeRange;
  expect(el.form === form).to.equal(true);
  expect(el.getForm() === form).to.equal(true);
  expect(el.willValidate).to.equal(true);
  expect([...el.labels].map((node) => (node as Element).id)).to.deep.equal([
    "window-label",
  ]);
  expect(el.validationMessage).to.equal("");
  expect(el.validity.valid).to.equal(true);
});

describe("active-preset pointer feedback", () => {

  async function themed(): Promise<LyraTimeRange> {
    const wrapper = (await fixture(html`
      <div data-lr-theme-scope
        style="
          --lr-transition-fast: 0s;
          --lr-time-range-preset-active-bg: rgb(0, 51, 102);
          --lr-time-range-preset-active-border-color: rgb(0, 102, 51);
        "
      >
        <lr-time-range min="0" max="100" start="0" end="30"></lr-time-range>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector("lr-time-range") as LyraTimeRange;
    el.presets = PRESETS;
    await el.updateComplete;
    el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="preset-button"]')[1]!.click();
    await el.updateComplete;
    return el;
  }

  // The three tests below press a preset and read the fill that press paints, so the pointer has
  // to be PROVEN to be on the button first: `sendMouse` resolves when the synthesized command
  // completes, not when the browser processed the native pointer event, and a preset row whose
  // layout settles after its rect was read moves out from under an already-dispatched position.
  // hoverUntilMatched() re-reads the rect and re-dispatches until `:hover` really matches, which
  // is why it replaced the single-shot move helper this block used to carry.

  it("deepens the ACTIVE preset while it is held", async function () {
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches)
      this.skip();
    const el = await themed();
    const active = el.shadowRoot!.querySelector(
      '[part="preset-button"][data-active]'
    ) as HTMLElement;
    expect(active != null, "expected an active preset").to.equal(true);
    expect(getComputedStyle(active).backgroundColor).to.equal("rgb(0, 51, 102)");
    const held = resolvedInShadow(
      el,
      "background: color-mix(in oklab, rgb(0, 51, 102), var(--lr-color-mix-partner) var(--lr-color-mix-active))",
      "background-color"
    );
    expect(held).to.not.equal("rgb(0, 51, 102)");

    try {
      await resetMouse();
      await hoverUntilMatched(
        active,
        "the active preset never took the pointer"
      );
      // The active preset deliberately keeps its own fill while merely hovered -- the selected
      // treatment is the point, and hover already reads on every other preset. A paint that must
      // NOT change cannot be polled for, so settle two frames first: otherwise "hover left the
      // fill alone" is indistinguishable from "the hover has not been processed yet".
      await settlePointer();
      expect(getComputedStyle(active).backgroundColor).to.equal(
        "rgb(0, 51, 102)"
      );
      await sendMouse({ type: "down" });
      await waitUntil(
        () => getComputedStyle(active).backgroundColor === held,
        "the held active preset kept its resting fill"
      );
    } finally {
      await sendMouse({ type: "up" });
      await resetMouse();
    }
  });

  it("deepens an INACTIVE preset while it is held -- the contrast case", async function () {
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches)
      this.skip();
    const el = await themed();
    const inactive = el.shadowRoot!.querySelector(
      '[part="preset-button"]:not([data-active])'
    ) as HTMLElement;
    const held = resolvedInShadow(
      el,
      "background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))",
      "background-color"
    );

    try {
      await resetMouse();
      await hoverUntilMatched(
        inactive,
        "the inactive preset never took the pointer"
      );
      await sendMouse({ type: "down" });
      await waitUntil(
        () => getComputedStyle(inactive).backgroundColor === held,
        "the held inactive preset kept its resting fill"
      );
    } finally {
      await sendMouse({ type: "up" });
      await resetMouse();
    }
  });

  it("restores the active preset's resting fill once the pointer is released", async function () {
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches)
      this.skip();
    const el = await themed();
    const active = el.shadowRoot!.querySelector(
      '[part="preset-button"][data-active]'
    ) as HTMLElement;
    try {
      await resetMouse();
      await hoverUntilMatched(
        active,
        "the active preset never took the pointer"
      );
      await sendMouse({ type: "down" });
      await waitUntil(
        () => getComputedStyle(active).backgroundColor !== "rgb(0, 51, 102)",
        "the held active preset kept its resting fill"
      );
    } finally {
      await sendMouse({ type: "up" });
      await resetMouse();
    }
    await waitUntil(
      () => getComputedStyle(active).backgroundColor === "rgb(0, 51, 102)",
      "the released active preset never returned to its selected fill"
    );
  });
});

it('forwards an explicit empty aria-label="" override to the internal group, distinct from leaving it unset (regression)', async () => {
  const explicitEmpty = (await fixture(
    html`<lr-time-range aria-label=""></lr-time-range>`
  )) as LyraTimeRange;
  const base = explicitEmpty.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('');

  const unset = (await fixture(html`<lr-time-range></lr-time-range>`)) as LyraTimeRange;
  const unsetBase = unset.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(unsetBase.hasAttribute('aria-label')).to.equal(false);
});
