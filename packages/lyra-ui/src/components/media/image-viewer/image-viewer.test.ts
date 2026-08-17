import { fixture, expect, html, oneEvent, waitUntil } from "@open-wc/testing";
import "./image-viewer.js";
import type { LyraImageViewer, LyraImageRotation } from "./image-viewer.js";
import type { LyraHighlight } from "../../viewers/document-viewer/anchors.js";
import type { LyraPanZoom } from "../pan-zoom/pan-zoom.class.js";
import { styles } from "./image-viewer.styles.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from "../../../internal/announcer.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { setForcedColors } from "../../../../test/wtr-media.js";

const PNG_SRC = "https://example.test/photo.png";

function assertiveAnnouncements(): string[] {
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`
  );
  return sink
    ? Array.from(sink.children, (child) => child.textContent ?? "")
    : [];
}

/** A real 1x1 PNG, for the tests that must keep the loaded frame's DOM alive across an `await`.
 *
 *  `PNG_SRC` never resolves, so its `<img>` eventually fires `error`, `loadState` flips to
 *  `'error'`, and `renderBody()` swaps the whole `lr-pan-zoom` subtree -- highlight layer
 *  included -- for `[part='error']`. That teardown is correct behaviour, but it lands at an
 *  unpredictable point (a DNS failure, so its timing tracks the runner's network, not the test),
 *  and once a highlight box is detached `getComputedStyle(box).backgroundColor` reads `''` rather
 *  than throwing. A data URI actually loads, so the frame is never torn down mid-test. */
const LOADABLE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function primaryPointerEvent(
  type: string,
  init: PointerEventInit
): PointerEvent {
  return new PointerEvent(type, { button: 0, isPrimary: true, ...init });
}

/** Waits for the viewer's `<img>` to be committed before faking its intrinsic size.
 *
 *  The wait is the point: callers that fixture a *wrapper* element only get `elementUpdated()` on
 *  that wrapper, which for a plain `<div>` resolves on a bare `nextFrame()` and never awaits the
 *  nested viewer's own first Lit update. Reading `querySelector('img')` straight out of the shadow
 *  root therefore assumed a render that had not been awaited, and on CI's contended runner it came
 *  back `null` -- surfacing as a bare "TypeError: Object.defineProperty called on non-object"
 *  attributed to whichever test was running, rather than anything about that test's subject.
 *  Polling here removes the assumption for every call site instead of per-test ordering fixes. */
async function stubImageLoad(
  el: LyraImageViewer,
  width = 800,
  height = 600
): Promise<void> {
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelector("img") !== null,
    "the image viewer never committed an <img> to stub"
  );
  const img = el.shadowRoot!.querySelector("img") as HTMLImageElement;
  Object.defineProperty(img, "naturalWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(img, "naturalHeight", {
    value: height,
    configurable: true,
  });
  img.dispatchEvent(new Event("load"));
}

it("omits invalid public highlight rectangles and renders finite ones", async () => {
  const el = await fixture<LyraImageViewer>(
    html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
  );
  await stubImageLoad(el);
  el.highlights = [
    {
      id: "unsafe",
      anchor: {
        kind: "region",
        rect: { x: "0;position:fixed", y: 0, width: 10, height: 10 },
      },
    } as unknown as LyraHighlight,
    {
      id: "safe",
      anchor: { kind: "region", rect: { x: 10, y: 20, width: 30, height: 40 } },
    },
  ];
  await el.updateComplete;
  const highlights = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="highlight"]'),
  ];
  expect(highlights.length).to.equal(1);
  expect(highlights[0]!.dataset["tone"]).to.equal("accent");
  expect(highlights[0]!.style.left).to.equal("10%");
  expect(highlights[0]!.style.position).to.equal("");
});

describe("defaults", () => {
  it("defaults to empty src/name/alt, fit contain, zoom 1, rotation 0, not annotatable", async () => {
    const el = (await fixture(
      html`<lr-image-viewer></lr-image-viewer>`
    )) as LyraImageViewer;
    expect(el.src).to.equal("");
    expect(el.name).to.equal("");
    expect(el.alt).to.be.undefined;
    expect(el.fit).to.equal("contain");
    expect(el.zoom).to.equal(1);
    expect(el.rotation).to.equal(0);
    expect(el.annotatable).to.be.false;
    expect(el.highlights).to.deep.equal([]);
    expect(el.activeHighlightId).to.be.null;
    expect(el.anchor).to.be.null;
  });

  it("renders an empty-state message when there is no src", async () => {
    const el = (await fixture(
      html`<lr-image-viewer></lr-image-viewer>`
    )) as LyraImageViewer;
    expect(el.shadowRoot!.querySelector(".empty-note")!.textContent).to.equal(
      "No image to display."
    );
  });
});

describe("image loading", () => {
  it("renders the img with a safe src and emits lr-load with natural dimensions", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} name="Chart"></lr-image-viewer>`
    )) as LyraImageViewer;
    const img = el.shadowRoot!.querySelector("img") as HTMLImageElement;
    expect(img.src).to.equal(PNG_SRC);
    const eventPromise = oneEvent(el, "lr-load");
    await stubImageLoad(el, 800, 600);
    const event = await eventPromise;
    expect(event.detail).to.deep.equal({
      naturalWidth: 800,
      naturalHeight: 600,
    });
  });

  it("renders a neutral error and appends repeated image failures to the light-DOM sink", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
    )) as LyraImageViewer;
    const img = el.shadowRoot!.querySelector("img") as HTMLImageElement;
    const eventPromise = oneEvent(el, "lr-render-error");
    img.dispatchEvent(new Event("error"));
    await eventPromise;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
    expect(
      el.shadowRoot!.querySelector('[part="error"]')!.getAttribute("role")
    ).to.equal(null);
    expect(assertiveAnnouncements()).to.deep.equal([
      "The image failed to load.",
    ]);

    el.src = "https://example.test/photo-2.png";
    await el.updateComplete;
    const second = el.shadowRoot!.querySelector("img") as HTMLImageElement;
    const repeatedEvent = oneEvent(el, "lr-render-error");
    second.dispatchEvent(new Event("error"));
    await repeatedEvent;
    expect(assertiveAnnouncements()).to.deep.equal([
      "The image failed to load.",
      "The image failed to load.",
    ]);
  });

  it("renders the empty state and never sets an img src for an unsafe src", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src="javascript:alert(1)"></lr-image-viewer>`
    )) as LyraImageViewer;
    expect(el.shadowRoot!.querySelector("img") == null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
    expect(
      assertiveAnnouncements(),
      "an already-invalid mount is not a live transition"
    ).to.deep.equal([]);
  });

  it("falls back alt to name, and lets an explicit empty alt mark the image decorative", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} name="Chart"></lr-image-viewer>`
    )) as LyraImageViewer;
    expect(
      (el.shadowRoot!.querySelector("img") as HTMLImageElement).alt
    ).to.equal("Chart");
    el.alt = "";
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector("img") as HTMLImageElement).alt
    ).to.equal("");
  });

  it("uses an explicitly provided non-empty alt instead of the name fallback", async () => {
    const el = (await fixture(
      html`<lr-image-viewer
        src=${PNG_SRC}
        name="Chart"
        alt="Custom alt text"
      ></lr-image-viewer>`
    )) as LyraImageViewer;
    expect(
      (el.shadowRoot!.querySelector("img") as HTMLImageElement).alt
    ).to.equal("Custom alt text");
  });
});

describe("zoom, rotation, and fit", () => {
  it("delegates zoomIn/zoomOut/resetZoom to the embedded pan-zoom surface and stays in sync", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
    )) as LyraImageViewer;
    el.zoomIn();
    await el.updateComplete;
    expect(el.zoom).to.equal(1.25);
    el.zoomOut();
    await el.updateComplete;
    expect(el.zoom).to.equal(1);
    el.resetZoom();
    await el.updateComplete;
    expect(el.zoom).to.equal(1);
  });

  it("emits lr-zoom-change when zoom changes via the embedded frame", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
    )) as LyraImageViewer;
    const eventPromise = oneEvent(el, "lr-zoom-change");
    el.zoomIn();
    const event = await eventPromise;
    expect(event.detail).to.deep.equal({ zoom: 1.25 });
  });

  it("passes min-zoom/max-zoom/zoom-step through to the embedded lr-pan-zoom, mirroring lr-lightbox", async () => {
    const el = (await fixture(html`
      <lr-image-viewer
        src=${PNG_SRC}
        min-zoom="0.25"
        max-zoom="8"
        zoom-step="0.5"
      ></lr-image-viewer>
    `)) as LyraImageViewer;
    await el.updateComplete;
    expect(el.minZoom).to.equal(0.25);
    expect(el.maxZoom).to.equal(8);
    expect(el.zoomStep).to.equal(0.5);
    const frame = el.shadowRoot!.querySelector("lr-pan-zoom") as LyraPanZoom;
    expect(frame.minZoom).to.equal(0.25);
    expect(frame.maxZoom).to.equal(8);
    expect(frame.zoomStep).to.equal(0.5);
  });

  it("rotate() advances 90deg clockwise and wraps at 360, emitting lr-rotation-change", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
    )) as LyraImageViewer;
    const first = oneEvent(el, "lr-rotation-change");
    el.rotate();
    expect((await first).detail).to.deep.equal({ rotation: 90 });
    el.rotate();
    el.rotate();
    el.rotate();
    await el.updateComplete;
    expect(el.rotation).to.equal(0);
  });

  // Regression coverage for the shared finite-number normalization layer (`src/internal/numbers.ts`)
  // -- a non-finite/negative/non-multiple-of-90 `rotation` used to reach the CSS
  // `rotate(${rotation}deg)` transform and the pointer-to-image coordinate math unnormalized.
  it("normalizes a non-finite/non-right-angle rotation to the nearest supported 90-degree step", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
    )) as LyraImageViewer;

    el.rotation = Number.NaN as LyraImageRotation;
    await el.updateComplete;
    let wrapper = el.shadowRoot!.querySelector(
      '[part="image-wrapper"]'
    ) as HTMLElement;
    expect(wrapper.style.transform).to.equal("rotate(0deg)");

    el.rotation = 45 as LyraImageRotation;
    await el.updateComplete;
    wrapper = el.shadowRoot!.querySelector(
      '[part="image-wrapper"]'
    ) as HTMLElement;
    expect(wrapper.style.transform).to.equal("rotate(90deg)");

    el.rotation = -90 as LyraImageRotation;
    await el.updateComplete;
    wrapper = el.shadowRoot!.querySelector(
      '[part="image-wrapper"]'
    ) as HTMLElement;
    expect(wrapper.style.transform).to.equal("rotate(270deg)");
  });

  it("rotate() normalizes an already-invalid rotation before stepping instead of propagating NaN", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
    )) as LyraImageViewer;
    el.rotation = Number.NaN as LyraImageRotation;
    await el.updateComplete;
    const event = oneEvent(el, "lr-rotation-change");
    el.rotate();
    expect((await event).detail).to.deep.equal({ rotation: 90 });
  });

  it("emits lr-fit-change when fit is reassigned after first render", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
    )) as LyraImageViewer;
    const eventPromise = oneEvent(el, "lr-fit-change");
    el.fit = "actual";
    const event = await eventPromise;
    expect(event.detail).to.deep.equal({ fit: "actual" });
  });

  it("updates fit from the toolbar select and emits lr-fit-change", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
    )) as LyraImageViewer;
    const select = el.shadowRoot!.querySelector(
      '[part="fit-control"]'
    ) as HTMLSelectElement;
    select.value = "width";
    const eventPromise = oneEvent(el, "lr-fit-change");
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect((await eventPromise).detail).to.deep.equal({ fit: "width" });
    expect(el.fit).to.equal("width");
  });
});

describe("region highlights", () => {
  const highlights: LyraHighlight[] = [
    {
      id: "h1",
      anchor: { kind: "region", rect: { x: 10, y: 10, width: 20, height: 15 } },
      label: "Zone A",
    },
    {
      id: "h2",
      anchor: { kind: "region", rect: { x: 50, y: 50, width: 10, height: 10 } },
    },
  ];

  it("renders one focusable button per region highlight, named by label or an indexed fallback", async () => {
    const el = (await fixture(
      html`<lr-image-viewer
        src=${PNG_SRC}
        .highlights=${highlights}
      ></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const boxes = [
      ...el.shadowRoot!.querySelectorAll('[part="highlight"]'),
    ] as HTMLButtonElement[];
    expect(boxes.length).to.equal(2);
    expect(boxes[0].getAttribute("aria-label")).to.equal("Zone A");
    expect(boxes[1].getAttribute("aria-label")).to.include("2");
  });

  it("marks the active highlight with data-active and emits lr-highlight-activate on click", async () => {
    const el = (await fixture(
      html`<lr-image-viewer
        src=${PNG_SRC}
        .highlights=${highlights}
        active-highlight-id="h1"
      ></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const boxes = [
      ...el.shadowRoot!.querySelectorAll('[part="highlight"]'),
    ] as HTMLButtonElement[];
    expect(boxes[0].hasAttribute("data-active")).to.be.true;
    expect(boxes[1].hasAttribute("data-active")).to.be.false;
    const eventPromise = oneEvent(el, "lr-highlight-activate");
    boxes[1].click();
    expect((await eventPromise).detail).to.deep.equal({ highlightId: "h2" });
    await el.updateComplete;
    expect(el.activeHighlightId).to.equal("h2");
  });

  it("mixes a highlight hover and pressed fill from its own tone, and makes pressed the stronger step", async () => {
    // The interaction state used to be a brightness filter, which needed no knowledge of the fill
    // and so could not be got wrong per tone -- but it also dragged [part="highlight-label"]'s text
    // with it, and did nothing at all to a white fill. A colour mix fixes both and introduces the
    // one risk worth a test: mixing from the untoned default would flatten every toned box to brand
    // the moment the pointer arrived.
    //
    // LOADABLE_PNG, not PNG_SRC: this is the one highlight test that samples computed style across
    // an `await`, so it is the one that PNG_SRC's eventual load failure could tear the frame out
    // from under (see the constant's own comment).
    const el = (await fixture(
      html`<lr-image-viewer
        src=${LOADABLE_PNG}
        .highlights=${[
          {
            id: "plain",
            anchor: {
              kind: "region",
              rect: { x: 10, y: 10, width: 20, height: 15 },
            },
          },
          {
            id: "danger",
            anchor: {
              kind: "region",
              rect: { x: 50, y: 50, width: 20, height: 15 },
            },
            tone: "danger",
          },
        ]}
      ></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const boxes = [
      ...el.shadowRoot!.querySelectorAll('[part="highlight"]'),
    ] as HTMLElement[];
    expect(boxes.length).to.equal(2);

    const plainFill = getComputedStyle(boxes[0]).backgroundColor;
    const dangerFill = getComputedStyle(boxes[1]).backgroundColor;
    expect(plainFill, "the untoned fill is not empty").to.not.equal("");
    expect(
      dangerFill,
      "the danger tone supplies its own fill for the mixes to read"
    ).to.not.equal(plainFill);

    // Re-query rather than close over `boxes[1]`, and assert the sample is a real resolved colour:
    // getComputedStyle() on a *detached* element resolves every property to '', so a stale
    // reference does not throw -- it silently turns "hover differs from resting" into
    // "'' differs from a colour" (a pass for the wrong reason) and the next comparison into
    // "'' equals ''" (a failure that names the wrong defect). Both guards below keep any future
    // mid-test teardown loud and correctly attributed instead.
    const readDangerFill = (label: string): string => {
      const live = [
        ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="highlight"]'),
      ];
      expect(
        live.length,
        `the highlight layer is still rendered (${label})`
      ).to.equal(2);
      const value = getComputedStyle(live[1]!).backgroundColor;
      expect(value, `the ${label} fill resolves to a real colour`).to.not.equal(
        ""
      );
      return value;
    };
    const rect = boxes[1]!.getBoundingClientRect();
    expect(
      rect.width,
      "the highlight has real geometry to point at"
    ).to.be.greaterThan(0);
    const resting = readDangerFill("resting");
    try {
      await sendMouse({
        type: "move",
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
      const hovered = readDangerFill("hover");
      expect(
        hovered,
        "hover moves the highlight off its resting fill"
      ).to.not.equal(resting);

      await sendMouse({ type: "down" });
      const pressed = readDangerFill("pressed");
      expect(
        pressed,
        "pressed is a further step, not a repeat of hover"
      ).to.not.equal(hovered);
      await sendMouse({ type: "up" });
    } finally {
      await resetMouse();
    }
    expect(
      el.shadowRoot!.querySelectorAll('[part="error"]').length,
      "the loadable src kept the frame out of the error state for the whole test"
    ).to.equal(0);
  });

  it('positions highlight boxes with physical left/top under dir="rtl" so they stay over the non-mirroring image', async () => {
    const el = (await fixture(
      html`<lr-image-viewer
        dir="rtl"
        src=${PNG_SRC}
        .highlights=${highlights}
      ></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const box = el.shadowRoot!.querySelector(
      '[part="highlight"]'
    ) as HTMLElement;
    expect(box.style.left).to.equal("10%");
    expect(box.style.top).to.equal("10%");
    expect(box.style.getPropertyValue("inset-inline-start")).to.equal("");
  });

  it("anchors a highlight label to its parent box's physical left edge in both ltr and rtl", async () => {
    // The parent [part="highlight"] box is deliberately physically positioned (left/top, never
    // inset-inline-start) because the underlying raster never mirrors under RTL. The label used
    // to use inset-inline-start:0, which under dir="rtl" resolves to the box's physical *right*
    // edge -- detaching the label from its non-mirroring parent's left edge while the parent
    // itself stayed put. Widen the box (via an outer ::part() override in the light DOM, which
    // always wins over the component's own internal rule) well past the label's own content
    // width, so a left-vs-right flush produces an unmistakable geometry difference instead of the
    // ~2px border/padding noise the default icon-button-size floor leaves between box and label.
    //
    // The override lives on document.head, not inside the fixture, and each `lr-image-viewer` is
    // fixtured directly (not through a wrapper <div>) -- fixturing a plain wrapper only awaits its
    // own nextFrame(), not the nested custom element's first Lit update (see stubImageLoad's own
    // comment above for the same trap), which left `[part="highlight-label"]` unrendered yet.
    const styleOverride = document.createElement("style");
    styleOverride.textContent =
      "lr-image-viewer::part(highlight) { min-inline-size: 200px !important; }";
    document.head.appendChild(styleOverride);
    try {
      for (const dir of ["ltr", "rtl"] as const) {
        const el = (await fixture(
          html`<lr-image-viewer
            dir=${dir}
            src=${PNG_SRC}
            .highlights=${highlights}
          ></lr-image-viewer>`
        )) as LyraImageViewer;
        await stubImageLoad(el);
        const box = el.shadowRoot!.querySelector(
          '[part="highlight"]'
        ) as HTMLElement;
        const label = el.shadowRoot!.querySelector(
          '[part="highlight-label"]'
        ) as HTMLElement;
        expect(
          el.shadowRoot!.querySelectorAll('[part="highlight-label"]').length,
          `dir="${dir}" still renders the labeled highlight's label span`
        ).to.equal(1);
        const boxRect = box.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        expect(
          boxRect.width,
          `dir="${dir}" widened the box well past the label's own width`
        ).to.be.greaterThan(100);
        expect(
          labelRect.left - boxRect.left,
          `dir="${dir}" keeps the label flush with the box's physical left edge, not its right`
        ).to.be.closeTo(2, 3);
      }
    } finally {
      styleOverride.remove();
    }
  });

  it("scrollToAnchor resolves true for a region anchor and false for an unsupported kind", async () => {
    // Uses LOADABLE_PNG, not PNG_SRC (see PNG_SRC's own doc comment above): this test awaits
    // scrollToAnchor("h1"), which retries applyAnchor() in a loop -- exactly the "must keep the
    // loaded frame's DOM alive across an await" case that comment warns about. With PNG_SRC, the
    // real background fetch's eventual (DNS-failure-timed) `error` event can land mid-retry-loop,
    // flip loadState back to 'error', and make hasOperableContent -- and therefore every
    // subsequent applyAnchor() attempt -- false for the rest of the test, no matter how long or
    // how many times the loop retries. That looked like a CI-load timing flake (intermittent,
    // WebKit-shard-only, resistant to widening the deadline) but was actually this race; widening
    // the deadline only gave the real error event more time to land mid-test and made it worse.
    const el = (await fixture(
      html`<lr-image-viewer
        src=${LOADABLE_PNG}
        .highlights=${highlights}
      ></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    await el.updateComplete;
    expect(await el.scrollToAnchor("h1")).to.be.true;
    // Shrink the retry loop's real-timer thresholds so the unsupported-kind case (which never
    // succeeds and only resolves once the retry loop times out) doesn't take the mixin's default
    // 5s before settling to false.
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (
      el as unknown as { anchorRetryIntervalMs: number }
    ).anchorRetryIntervalMs = 5;
    expect(await el.scrollToAnchor({ kind: "page", page: 1 })).to.be.false;
  });

  it("setting the anchor property declaratively resolves via scrollToAnchor", async () => {
    // LOADABLE_PNG, not PNG_SRC, for exactly the reason the sibling scrollToAnchor test above
    // documents: this test awaits an anchor resolution that retries applyAnchor(), so PNG_SRC's
    // real background fetch can land its DNS-failure `error` event mid-resolution, flip loadState
    // to 'error', and make hasOperableContent false -- which resolves lr-anchor-result as
    // { found: false }. That is the intermittent WebKit-shard-only failure this test showed.
    const el = (await fixture(
      html`<lr-image-viewer src=${LOADABLE_PNG}></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    await el.updateComplete;
    const eventPromise = oneEvent(el, "lr-anchor-result");
    el.anchor = { kind: "region", rect: { x: 0, y: 0, width: 10, height: 10 } };
    expect((await eventPromise).detail).to.deep.equal({ found: true });
  });
});

describe("annotation", () => {
  it("is off by default and toggles via the toolbar button", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
    )) as LyraImageViewer;
    const toggle = el.shadowRoot!.querySelector(
      '[part="annotate-toggle"]'
    ) as HTMLButtonElement;
    expect(toggle.getAttribute("aria-pressed")).to.equal("false");
    expect(toggle.disabled).to.be.true;
    await stubImageLoad(el);
    expect(toggle.disabled).to.be.false;
    toggle.click();
    await el.updateComplete;
    expect(el.annotatable).to.be.true;
    expect(toggle.getAttribute("aria-pressed")).to.equal("true");
  });

  it("places a centered starter box on Enter, moves it with arrow keys, and commits on Enter", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const viewport = el.shadowRoot!.querySelector(
      '[part="image-wrapper"]'
    ) as HTMLElement;
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    await el.updateComplete;
    let box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box != null).to.equal(true);
    expect(box.style.left).to.equal("37.5%");
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    await el.updateComplete;
    box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box.style.left).to.equal("39.5%");
    const eventPromise = oneEvent(el, "lr-annotation-create");
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    const event = await eventPromise;
    expect(event.detail.anchor.kind).to.equal("region");
    expect(event.detail.anchor.rect.x).to.be.closeTo(39.5, 0.01);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]') == null).to
      .be.true;
  });

  it("keeps annotation ArrowLeft/ArrowRight physical under RTL", async () => {
    const el = (await fixture(
      html`<lr-image-viewer
        dir="rtl"
        src=${PNG_SRC}
        annotatable
      ></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const viewport = el.shadowRoot!.querySelector(
      '[part="image-wrapper"]'
    ) as HTMLElement;
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    await el.updateComplete;

    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
    );
    await el.updateComplete;
    let box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box.style.left).to.equal("35.5%");

    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    await el.updateComplete;
    box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box.style.left).to.equal("37.5%");

    viewport.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        shiftKey: true,
        bubbles: true,
      })
    );
    await el.updateComplete;
    box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box.style.width).to.equal("23%");

    viewport.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        shiftKey: true,
        bubbles: true,
      })
    );
    await el.updateComplete;
    box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box.style.width).to.equal("25%");
  });

  it("resizes with Shift+arrow keys and cancels on Escape without emitting", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const viewport = el.shadowRoot!.querySelector(
      '[part="image-wrapper"]'
    ) as HTMLElement;
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        shiftKey: true,
        bubbles: true,
      })
    );
    await el.updateComplete;
    const box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box.style.width).to.equal("27%");
    let fired = false;
    el.addEventListener("lr-annotation-create", () => (fired = true));
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]') == null).to
      .be.true;
  });

  it("moves the draft box with ArrowLeft/ArrowUp/ArrowDown and ignores unrecognized keys", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const viewport = el.shadowRoot!.querySelector(
      '[part="image-wrapper"]'
    ) as HTMLElement;
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    await el.updateComplete;
    // Starter box: { x: 37.5, y: 37.5, width: 25, height: 25 }.
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
    );
    await el.updateComplete;
    let box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box.style.left).to.equal("35.5%");

    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
    );
    await el.updateComplete;
    box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box.style.top).to.equal("35.5%");

    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );
    await el.updateComplete;
    box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box.style.top).to.equal("37.5%");

    // An unhandled key falls through the switch's default branch and is a no-op.
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "PageDown", bubbles: true })
    );
    await el.updateComplete;
    box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box.style.left).to.equal("35.5%");
    expect(box.style.top).to.equal("37.5%");
  });

  it("resizes with Shift+ArrowLeft/ArrowUp/ArrowDown", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const viewport = el.shadowRoot!.querySelector(
      '[part="image-wrapper"]'
    ) as HTMLElement;
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    await el.updateComplete;
    // Starter box: { x: 37.5, y: 37.5, width: 25, height: 25 }.
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        shiftKey: true,
        bubbles: true,
      })
    );
    await el.updateComplete;
    let box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box.style.width).to.equal("23%");

    viewport.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        shiftKey: true,
        bubbles: true,
      })
    );
    await el.updateComplete;
    box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box.style.height).to.equal("23%");

    viewport.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        shiftKey: true,
        bubbles: true,
      })
    );
    await el.updateComplete;
    box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box.style.height).to.equal("25%");
  });

  it("ignores keydown on the wrapper while annotation mode is off", async () => {
    // The keydown listener is always bound (unconditionally in the template), regardless of
    // `annotatable` -- this exercises its own early-return guard, distinct from the toolbar
    // toggle that normally keeps annotation-mode off.
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
    )) as LyraImageViewer;
    const viewport = el.shadowRoot!.querySelector(
      '[part="image-wrapper"]'
    ) as HTMLElement;
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]') == null).to
      .be.true;
  });

  it("clears a keyboard-created draft on source change, annotation disable, and reconnect", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`
    )) as LyraImageViewer;
    const startKeyboardDraft = async (): Promise<void> => {
      await stubImageLoad(el);
      const wrapper = el.shadowRoot!.querySelector(
        '[part="image-wrapper"]'
      ) as HTMLElement;
      wrapper.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="annotation-box"]')).to.exist;
    };

    await startKeyboardDraft();
    el.src = `${PNG_SRC}?replacement`;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]') == null).to
      .be.true;

    await startKeyboardDraft();
    el.annotatable = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]') == null).to
      .be.true;

    el.annotatable = true;
    await el.updateComplete;
    await startKeyboardDraft();
    el.remove();
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]') == null).to
      .be.true;
  });
});

// Positions the wrapper's bounding box deterministically -- a real image never actually loads in
// this test environment (see stubImageLoad above), so layout-derived dimensions can't be relied on.
function stubWrapperRect(
  el: LyraImageViewer,
  width = 200,
  height = 100
): HTMLElement {
  const wrapper = el.shadowRoot!.querySelector(
    '[part="image-wrapper"]'
  ) as HTMLElement;
  wrapper.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    } as DOMRect);
  wrapper.setPointerCapture = () => {}; // real setPointerCapture throws for a synthetic pointerId in tests
  return wrapper;
}

describe("pointer-driven annotation", () => {
  it("cancels and releases an interrupted pointer draft on pointercancel", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const wrapper = stubWrapperRect(el);
    const released: number[] = [];
    wrapper.releasePointerCapture = (pointerId) => released.push(pointerId);
    wrapper.dispatchEvent(
      primaryPointerEvent("pointerdown", {
        pointerId: 12,
        clientX: 20,
        clientY: 10,
        bubbles: true,
      })
    );
    wrapper.dispatchEvent(
      primaryPointerEvent("pointermove", {
        pointerId: 12,
        clientX: 100,
        clientY: 50,
        bubbles: true,
      })
    );
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelectorAll('[part="annotation-box"]').length
    ).to.equal(1);

    wrapper.dispatchEvent(
      primaryPointerEvent("pointercancel", { pointerId: 12, bubbles: true })
    );
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelectorAll('[part="annotation-box"]').length
    ).to.equal(0);
    expect(released).to.deep.equal([12]);
  });

  it("cancels an active pointer draft when annotation is disabled or the source changes", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const wrapper = stubWrapperRect(el);
    wrapper.releasePointerCapture = () => {};
    wrapper.dispatchEvent(
      primaryPointerEvent("pointerdown", {
        pointerId: 13,
        clientX: 20,
        clientY: 10,
        bubbles: true,
      })
    );
    await el.updateComplete;
    el.annotatable = false;
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelectorAll('[part="annotation-box"]').length
    ).to.equal(0);

    el.annotatable = true;
    await el.updateComplete;
    wrapper.dispatchEvent(
      primaryPointerEvent("pointerdown", {
        pointerId: 14,
        clientX: 20,
        clientY: 10,
        bubbles: true,
      })
    );
    el.src = `${PNG_SRC}?replacement`;
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelectorAll('[part="annotation-box"]').length
    ).to.equal(0);
  });

  it("draws a region by dragging the pointer and commits it once large enough", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const wrapper = stubWrapperRect(el);
    wrapper.dispatchEvent(
      primaryPointerEvent("pointerdown", {
        pointerId: 1,
        clientX: 20,
        clientY: 10,
        bubbles: true,
      })
    );
    await el.updateComplete;
    let box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box != null).to.equal(true);
    expect(box.style.left).to.equal("10%"); // 20 / 200 * 100
    expect(box.style.top).to.equal("10%"); // 10 / 100 * 100

    wrapper.dispatchEvent(
      primaryPointerEvent("pointermove", {
        pointerId: 1,
        clientX: 100,
        clientY: 50,
        bubbles: true,
      })
    );
    await el.updateComplete;
    box = el.shadowRoot!.querySelector(
      '[part="annotation-box"]'
    ) as HTMLElement;
    expect(box.style.left).to.equal("10%");
    expect(box.style.top).to.equal("10%");
    expect(box.style.width).to.equal("40%"); // |50 - 10|
    expect(box.style.height).to.equal("40%"); // |50 - 10|

    const eventPromise = oneEvent(el, "lr-annotation-create");
    wrapper.dispatchEvent(
      primaryPointerEvent("pointerup", { pointerId: 1, bubbles: true })
    );
    const event = await eventPromise;
    expect(event.detail.anchor.kind).to.equal("region");
    expect(event.detail.anchor.rect.width).to.be.closeTo(40, 0.01);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]') == null).to
      .be.true;
  });

  it("cancels the pointer-drawn draft on release if the dragged region stays too small", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const wrapper = stubWrapperRect(el);
    wrapper.dispatchEvent(
      primaryPointerEvent("pointerdown", {
        pointerId: 2,
        clientX: 20,
        clientY: 10,
        bubbles: true,
      })
    );
    await el.updateComplete;
    wrapper.dispatchEvent(
      primaryPointerEvent("pointermove", {
        pointerId: 2,
        clientX: 21,
        clientY: 11,
        bubbles: true,
      })
    );
    await el.updateComplete;
    let fired = false;
    el.addEventListener("lr-annotation-create", () => (fired = true));
    wrapper.dispatchEvent(
      primaryPointerEvent("pointerup", { pointerId: 2, bubbles: true })
    );
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]') == null).to
      .be.true;
  });

  it("maps the pointer position through the rotated coordinate space for 90/180/270 rotations", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const wrapper = stubWrapperRect(el, 100, 100);
    const cases: Array<[LyraImageRotation, string, string]> = [
      [90, "20%", "90%"], // { x: py, y: 100 - px }
      [180, "90%", "80%"], // { x: 100 - px, y: 100 - py }
      [270, "80%", "10%"], // { x: 100 - py, y: px }
    ];
    for (const [rotation, expectedLeft, expectedTop] of cases) {
      el.rotation = rotation;
      await el.updateComplete;
      wrapper.dispatchEvent(
        primaryPointerEvent("pointerdown", {
          pointerId: 9,
          clientX: 10,
          clientY: 20,
          bubbles: true,
        })
      );
      await el.updateComplete;
      const box = el.shadowRoot!.querySelector(
        '[part="annotation-box"]'
      ) as HTMLElement;
      expect(box.style.left).to.equal(expectedLeft);
      expect(box.style.top).to.equal(expectedTop);
      // Release with no movement -- the zero-size draft is discarded, resetting state for the next case.
      wrapper.dispatchEvent(
        primaryPointerEvent("pointerup", { pointerId: 9, bubbles: true })
      );
      await el.updateComplete;
    }
  });

  it("ignores secondary buttons and nonprimary pen/touch pointers but admits one primary pointer", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const wrapper = stubWrapperRect(el);
    // button: 2 is the secondary (right) mouse button per the PointerEvent/MouseEvent spec.
    // A right-click while annotatable must not begin an annotation drag -- it should be free for
    // a context menu, and must never mutate internal draft state as a side effect.
    wrapper.dispatchEvent(
      primaryPointerEvent("pointerdown", {
        pointerId: 20,
        button: 2,
        clientX: 20,
        clientY: 10,
        bubbles: true,
      })
    );
    wrapper.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 19,
        pointerType: "pen",
        isPrimary: false,
        button: 0,
        clientX: 20,
        clientY: 10,
        bubbles: true,
      })
    );
    wrapper.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 18,
        pointerType: "touch",
        isPrimary: false,
        button: 0,
        clientX: 20,
        clientY: 10,
        bubbles: true,
      })
    );
    await el.updateComplete;
    // Compare a count/primitive, never the queried node itself: a failing `expect(domNode).to.not
    // .exist` hands chai a live DOM node as the failure's `actual` value, and chai's own
    // diff/inspection of a node's circular parentNode/ownerDocument graph is what actually hangs
    // the whole file at a red result, not merely a wrong outcome.
    expect(
      el.shadowRoot!.querySelectorAll('[part="annotation-box"]').length,
      "a right-click renders no draft box"
    ).to.equal(0);
    expect(
      (el as unknown as { draft: unknown }).draft,
      "a right-click never sets a draft"
    ).to.equal(null);
    expect(
      (el as unknown as { pointerDraftId: unknown }).pointerDraftId,
      "a right-click never claims a pointer draft id"
    ).to.equal(null);

    // The primary (left) button still starts a draft as before -- the fix must not touch that path.
    wrapper.dispatchEvent(
      primaryPointerEvent("pointerdown", {
        pointerId: 21,
        button: 0,
        clientX: 20,
        clientY: 10,
        bubbles: true,
      })
    );
    await el.updateComplete;
    const boxes = [
      ...el.shadowRoot!.querySelectorAll<HTMLElement>(
        '[part="annotation-box"]'
      ),
    ];
    expect(boxes.length, "a left-click still starts a draft").to.equal(1);
    expect(boxes[0]!.style.left).to.equal("10%");
    expect(boxes[0]!.style.top).to.equal("10%");
  });

  it("ignores pointerdown on the wrapper while annotation mode is off", async () => {
    // pointerdown/pointermove/pointerup are always bound in the template regardless of
    // `annotatable`; each handler has its own early-return guard for that case.
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
    )) as LyraImageViewer;
    const wrapper = stubWrapperRect(el);
    wrapper.dispatchEvent(
      primaryPointerEvent("pointerdown", {
        pointerId: 3,
        clientX: 20,
        clientY: 10,
        bubbles: true,
      })
    );
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]') == null).to
      .be.true;
  });

  it("ignores a pointermove/pointerup that never had a matching pointerdown", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const wrapper = stubWrapperRect(el);
    // No prior pointerdown -- pointerDraftId stays null, so both handlers should bail out via
    // their `pointerDraftId !== event.pointerId` guard instead of touching `draft`.
    wrapper.dispatchEvent(
      primaryPointerEvent("pointermove", {
        pointerId: 4,
        clientX: 50,
        clientY: 50,
        bubbles: true,
      })
    );
    await el.updateComplete;
    let fired = false;
    el.addEventListener("lr-annotation-create", () => (fired = true));
    wrapper.dispatchEvent(
      primaryPointerEvent("pointerup", { pointerId: 4, bubbles: true })
    );
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]') == null).to
      .be.true;
  });
});

describe("accessibility", () => {
  it("puts the advertised accessible name on a region role owner", async () => {
    const el = (await fixture(
      html`<lr-image-viewer aria-label="Annotated chart"></lr-image-viewer>`
    )) as LyraImageViewer;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute("role")).to.equal("region");
    expect(base.getAttribute("aria-label")).to.equal("Annotated chart");
  });

  it("preserves a present empty host aria-label on the region and restores the name fallback on removal", async () => {
    const el = (await fixture(
      html`<lr-image-viewer
        aria-label=""
        name="Fallback image"
      ></lr-image-viewer>`
    )) as LyraImageViewer;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;

    expect(base.getAttribute("role")).to.equal("region");
    expect(base.getAttribute("aria-label")).to.equal("");

    el.setAttribute("aria-label", "Updated image");
    await el.updateComplete;
    expect(base.getAttribute("aria-label")).to.equal("Updated image");

    el.setAttribute("aria-label", "");
    await el.updateComplete;
    expect(base.getAttribute("aria-label")).to.equal("");

    el.removeAttribute("aria-label");
    await el.updateComplete;
    expect(base.getAttribute("aria-label")).to.equal("Fallback image");
  });

  it("gives tiny percentage highlights a hit-area floor independent of their data geometry", async () => {
    const el = (await fixture(
      html`<lr-image-viewer
        src=${PNG_SRC}
        .highlights=${[
          {
            id: "tiny",
            anchor: {
              kind: "region",
              rect: { x: 10, y: 10, width: 0.1, height: 0.1 },
            },
          },
        ]}
      ></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const box = el.shadowRoot!.querySelector(
      '[part="highlight"]'
    ) as HTMLElement;
    const style = getComputedStyle(box);
    expect(parseFloat(style.minInlineSize)).to.be.at.least(40);
    expect(parseFloat(style.minBlockSize)).to.be.at.least(40);
  });

  it("gives the toolbar fit/rotate/annotate controls the shared minimum hit-area on both axes", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
    )) as LyraImageViewer;
    for (const part of ["fit-control", "rotate-button", "annotate-toggle"]) {
      const control = el.shadowRoot!.querySelector(
        `[part="${part}"]`
      ) as HTMLElement;
      const style = getComputedStyle(control);
      expect(
        parseFloat(style.minInlineSize),
        `${part} minInlineSize`
      ).to.be.at.least(40);
      expect(
        parseFloat(style.minBlockSize),
        `${part} minBlockSize`
      ).to.be.at.least(40);
    }
  });

  it("keeps toolbar hover and pressed-toggle states visible without color", async function () {
    // The wait below can run up to 15000ms under a loaded CI runner; mocha's own suite-wide
    // 6000ms default (see web-test-runner.config.js) would otherwise cut the test off first.
    this.timeout(20000);
    await setForcedColors("active");
    try {
      // LOADABLE_PNG, not PNG_SRC: root-caused via WebKit instrumentation (rotate.disabled logged
      // alongside the failing outline check) after two prior widenings of the wait below
      // (5000ms -> 15000ms, then a since-reverted bounded-retry-with-resend of sendMouse) both
      // failed to fix this on real CI. Every failed attempt showed `disabled= true` from the very
      // first check -- never `false`, never a hover/paint race -- which pointed straight at
      // `hasOperableContent`/`?disabled=${!operable}` rather than :hover or timing. PNG_SRC is a
      // real `https://` URL (an unregistered RFC 2606 `.test` host, so it never resolves), and this
      // component sets a real `<img src=${safeSrc}>` (see image-viewer.class.ts's `@load`/`@error`
      // wiring) whose fetch keeps running in the browser after `stubImageLoad()` below fakes a
      // synchronous success. PNG_SRC's own module-level doc comment already documents that eventual
      // real failure "replaces the frame mid-test" at network-timing-dependent points, which is
      // exactly why `LOADABLE_PNG` exists and why every OTHER fixture in this file needing sustained
      // state across an `await` already uses it instead (see the `withAnnotateActive()` block
      // comment) -- this test was the one straggler still on PNG_SRC. Once the real fetch's error
      // event lands, `onImgError()` flips `loadState` to `'error'`, `hasOperableContent` goes
      // false, and the rotate button's `?disabled=${!operable}` binding disables it -- which also
      // fails the forced-colors rule below at `[part="rotate-button"]:hover:not(:disabled)`
      // (image-viewer.styles.ts) permanently for the rest of the test, no matter how long or how
      // many times hover is retried: a disabled control simply never matches that selector again.
      const el = (await fixture(
        html`<lr-image-viewer src=${LOADABLE_PNG}></lr-image-viewer>`
      )) as LyraImageViewer;
      await stubImageLoad(el);
      const rotate = el.shadowRoot!.querySelector(
        '[part="rotate-button"]'
      ) as HTMLButtonElement;
      const annotate = el.shadowRoot!.querySelector(
        '[part="annotate-toggle"]'
      ) as HTMLButtonElement;
      annotate.click();
      await el.updateComplete;

      expect(getComputedStyle(annotate).borderStyle).to.equal("double");
      const box = rotate.getBoundingClientRect();
      // sendMouse requires integer coordinates; an unrounded midpoint throws under some engines
      // and silently misses the hit area under others when the rect's width/height is odd (same
      // fix already applied to av-player.test.ts's equivalent hover-position call).
      await sendMouse({
        type: "move",
        position: [
          Math.round(box.left + box.width / 2),
          Math.round(box.top + box.height / 2),
        ],
      });
      // This rule has no CSS transition to wait out (see image-viewer.styles.ts's forced-colors
      // block) -- the whole wait is the browser processing the mousemove and recomputing :hover.
      // 15000ms keeps real headroom for that on a loaded CI runner now that the fixture itself
      // (LOADABLE_PNG above) can no longer flip the button `disabled` out from under this wait.
      await waitUntil(
        () => getComputedStyle(rotate).outlineStyle === "dashed",
        "the rotate button's hover outline did not settle",
        { timeout: 15000 },
      );
      expect(getComputedStyle(rotate).outlineStyle).to.equal("dashed");
      expect(rotate.disabled, "the rotate button must stay enabled for the hover rule to apply").to.equal(false);
    } finally {
      await resetMouse();
      await setForcedColors("none");
    }
  });

  it("is accessible with highlights and annotation on", async () => {
    const el = await fixture(
      html`<lr-image-viewer
        src=${PNG_SRC}
        name="Chart"
        annotatable
        .highlights=${[
          {
            id: "h1",
            anchor: {
              kind: "region",
              rect: { x: 10, y: 10, width: 20, height: 15 },
            },
            label: "Zone A",
          },
        ]}
      ></lr-image-viewer>`
    );
    await expect(el).to.be.accessible();
  });

  it("is accessible in the empty state", async () => {
    const el = await fixture(html`<lr-image-viewer></lr-image-viewer>`);
    await expect(el).to.be.accessible();
  });
});

describe("localization", () => {
  it("renders a localized rotate button label from strings overrides", async () => {
    const el = (await fixture(
      html`<lr-image-viewer
        src=${PNG_SRC}
        .strings=${{ imageViewerRotate: "Pivoter" }}
      ></lr-image-viewer>`
    )) as LyraImageViewer;
    expect(
      el
        .shadowRoot!.querySelector('[part="rotate-button"]')!
        .getAttribute("aria-label")
    ).to.equal("Pivoter");
  });

  it("formats generated highlight indices and annotation coordinates with the effective locale", async () => {
    const el = (await fixture(
      html`<lr-image-viewer
        lang="ar-EG"
        src=${PNG_SRC}
        .highlights=${[
          {
            id: "h1",
            anchor: {
              kind: "region",
              rect: { x: 10, y: 10, width: 20, height: 20 },
            },
          },
        ]}
      ></lr-image-viewer>`
    )) as LyraImageViewer;
    await stubImageLoad(el);
    const highlight = el.shadowRoot!.querySelector('[part="highlight"]')!;
    expect(highlight.getAttribute("aria-label")).to.contain("١");
  });
});

describe("active-state cssprop escape hatches", () => {
  function resolvedInShadow(
    el: LyraImageViewer,
    declaration: string,
    property: string
  ): string {
    const probe = document.createElement("span");
    probe.setAttribute("style", declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  // These fixtures use the module-level LOADABLE_PNG rather than the https PNG_SRC placeholder for
  // the reason documented there: PNG_SRC's eventual load failure replaces the frame mid-test.

  async function withAnnotateActive(
    style = ""
  ): Promise<{ el: LyraImageViewer; toggle: HTMLElement }> {
    const wrapper = (await fixture(
      html`<div style=${style}>
        <lr-image-viewer annotatable src=${LOADABLE_PNG}></lr-image-viewer>
      </div>`
    )) as HTMLElement;
    const el = wrapper.querySelector("lr-image-viewer") as LyraImageViewer;
    await stubImageLoad(el);
    const toggle = el.shadowRoot!.querySelector(
      '[part="annotate-toggle"][aria-pressed="true"]'
    ) as HTMLElement;
    expect(toggle != null, "the annotate toggle renders pressed").to.equal(
      true
    );
    return { el, toggle };
  }

  async function withActiveHighlight(
    style = ""
  ): Promise<{ el: LyraImageViewer; box: HTMLElement }> {
    const regions: LyraHighlight[] = [
      {
        id: "h1",
        anchor: {
          kind: "region",
          rect: { x: 10, y: 10, width: 20, height: 15 },
        },
      },
    ];
    const wrapper = (await fixture(html`<div style=${style}>
      <lr-image-viewer
        src=${LOADABLE_PNG}
        .highlights=${regions}
        active-highlight-id="h1"
      ></lr-image-viewer>
    </div>`)) as HTMLElement;
    const el = wrapper.querySelector("lr-image-viewer") as LyraImageViewer;
    await stubImageLoad(el);
    const box = el.shadowRoot!.querySelector(
      '[part="highlight"][data-active]'
    ) as HTMLElement;
    expect(box != null, "the active highlight box renders").to.equal(true);
    return { el, box };
  }

  it("--lr-image-viewer-annotate-active-bg recolors the pressed annotate-toggle background", async () => {
    const { toggle } = await withAnnotateActive(
      "--lr-image-viewer-annotate-active-bg: rgb(0, 51, 102)"
    );
    expect(getComputedStyle(toggle).backgroundColor).to.equal(
      "rgb(0, 51, 102)"
    );
  });

  it("--lr-image-viewer-annotate-active-border recolors the pressed annotate-toggle border", async () => {
    const { toggle } = await withAnnotateActive(
      "--lr-image-viewer-annotate-active-border: rgb(0, 51, 102)"
    );
    expect(getComputedStyle(toggle).borderTopColor).to.equal("rgb(0, 51, 102)");
  });

  it("--lr-image-viewer-highlight-active-color recolors the active highlight outline", async () => {
    const { box } = await withActiveHighlight(
      "--lr-image-viewer-highlight-active-color: rgb(0, 51, 102)"
    );
    expect(getComputedStyle(box).outlineColor).to.equal("rgb(0, 51, 102)");
  });

  it("inherits the active-highlight border and outline dimensions from an ancestor", async () => {
    const { box } = await withActiveHighlight(
      "--lr-image-viewer-highlight-active-border-width: 7px; --lr-image-viewer-highlight-active-outline-width: 5px; --lr-image-viewer-highlight-active-outline-offset: 9px"
    );
    const chrome = getComputedStyle(box);
    expect(chrome.borderTopWidth).to.equal("7px");
    expect(chrome.outlineWidth).to.equal("5px");
    expect(chrome.outlineOffset).to.equal("9px");
  });

  it("--lr-image-viewer-highlight-success-border retints one highlight tone without changing global tokens", async () => {
    const regions: LyraHighlight[] = [
      {
        id: "success",
        tone: "success",
        anchor: {
          kind: "region",
          rect: { x: 10, y: 10, width: 20, height: 15 },
        },
      },
    ];
    const wrapper = (await fixture(html`<div
      style="--lr-image-viewer-highlight-success-border: rgb(0, 51, 102)"
    >
      <lr-image-viewer
        src=${LOADABLE_PNG}
        .highlights=${regions}
      ></lr-image-viewer>
    </div>`)) as HTMLElement;
    const el = wrapper.querySelector("lr-image-viewer") as LyraImageViewer;
    // Highlights only paint once the viewer has committed and measured its <img>, so stub the load
    // rather than racing it -- Edge lost that race while every other engine won it, leaving a
    // getComputedStyle(null) TypeError instead of a readable assertion failure.
    await stubImageLoad(el);
    const box = el.shadowRoot!.querySelector(
      '[part="highlight"]'
    ) as HTMLElement;
    expect(box != null, "the success-tone highlight box renders").to.equal(
      true
    );
    expect(getComputedStyle(box).borderTopColor).to.equal("rgb(0, 51, 102)");
  });

  it("renders byte-identical to the pre-hatch tokens when unset", async () => {
    const { el: elA, toggle } = await withAnnotateActive();
    expect(getComputedStyle(toggle).backgroundColor).to.equal(
      resolvedInShadow(
        elA,
        "background: var(--lr-color-brand-quiet)",
        "background-color"
      )
    );
    expect(getComputedStyle(toggle).borderTopColor).to.equal(
      resolvedInShadow(
        elA,
        "border-top-color: var(--lr-color-brand)",
        "border-top-color"
      )
    );
    const { el: elH, box } = await withActiveHighlight();
    expect(getComputedStyle(box).outlineColor).to.equal(
      resolvedInShadow(
        elH,
        "outline: 1px solid var(--lr-color-brand)",
        "outline-color"
      )
    );
    expect(getComputedStyle(box).borderTopWidth).to.equal(
      resolvedInShadow(
        elH,
        "border-top: var(--lr-border-width-thick) solid transparent",
        "border-top-width"
      )
    );
    expect(getComputedStyle(box).outlineWidth).to.equal(
      resolvedInShadow(
        elH,
        "outline: var(--lr-focus-ring-width) solid transparent",
        "outline-width"
      )
    );
    expect(getComputedStyle(box).outlineOffset).to.equal(
      resolvedInShadow(
        elH,
        "outline-offset: var(--lr-focus-ring-offset)",
        "outline-offset"
      )
    );
  });

  it("is accessible with every active-state prop themed", async () => {
    const { el } = await withActiveHighlight(
      "--lr-image-viewer-annotate-active-bg: rgb(0, 51, 102); --lr-image-viewer-annotate-active-border: rgb(0, 34, 68); --lr-image-viewer-highlight-active-color: rgb(0, 51, 102)"
    );
    await expect(el).to.be.accessible();
  });
});

describe("native control theming", () => {
  it("resets native appearance on the fit-control, themes its option list, adds a chevron, and gives all three toolbar controls hover/focus", async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
    )) as LyraImageViewer;
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector(
      '[part="fit-control"]'
    ) as HTMLSelectElement;
    expect(getComputedStyle(select).appearance).to.equal("none");
    const wrapper = select.closest(".fit-control-wrapper");
    expect(wrapper != null).to.equal(true);
    expect(wrapper!.querySelector(".fit-control-chevron svg")).to.exist;
    const css = styles.cssText.replace(/"/g, "'").replace(/\s+/g, " ");
    expect(css).to.match(
      /\[part='fit-control'\] option[^{]*\{[^}]*background:/
    );
    for (const part of ["fit-control", "rotate-button", "annotate-toggle"]) {
      expect(css, `${part} must get a hover rule`).to.match(
        new RegExp(`\\[part='${part}'\\]:hover`)
      );
      expect(css, `${part} must get a focus-visible rule`).to.match(
        new RegExp(`\\[part='${part}'\\]:focus-visible[^{]*\\{[^}]*outline:`)
      );
    }
  });

  it("gives the clickable highlight boxes a hover state matching their focus-visible affordance", () => {
    const css = styles.cssText.replace(/"/g, "'").replace(/\s+/g, " ");
    expect(css).to.match(/\[part='highlight'\]:hover/);
  });
});

it("names and describes the keyboard annotation focus surface on the initial annotatable render", async () => {
  const el = (await fixture(html`
    <lr-image-viewer
      src=${PNG_SRC}
      annotatable
      .strings=${{
        imageViewerAnnotate: "Dessiner une zone",
        imageViewerAnnotationHint:
          "Entrée place une zone; les flèches la déplacent.",
      }}
    ></lr-image-viewer>
  `)) as LyraImageViewer;
  await stubImageLoad(el);
  const wrapper = el.shadowRoot!.querySelector(
    '[part="image-wrapper"]'
  ) as HTMLElement;
  expect(wrapper.getAttribute("tabindex")).to.equal("0");
  expect(wrapper.getAttribute("aria-label")).to.equal("Dessiner une zone");
  expect(wrapper.getAttribute("aria-description")).to.equal(
    "Entrée place une zone; les flèches la déplacent."
  );
});

it("contains an unbroken highlight label inside a 320px allocation", async () => {
  const highlights: LyraHighlight[] = [
    {
      id: "long",
      label: "Region".repeat(250),
      anchor: { kind: "region", rect: { x: 0, y: 20, width: 20, height: 20 } },
    },
  ];
  const wrapper = (await fixture(html`
    <div style="inline-size: 320px">
      <lr-image-viewer
        src=${LOADABLE_PNG}
        .highlights=${highlights}
      ></lr-image-viewer>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector("lr-image-viewer") as LyraImageViewer;
  await stubImageLoad(el);
  await el.updateComplete;
  expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
});

it("contains unbroken localized fit labels inside 320px LTR and RTL allocations", async () => {
  const longFitLabel = "Fit".repeat(120);
  for (const direction of ["ltr", "rtl"]) {
    const wrapper = (await fixture(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%">
        <lr-image-viewer
          .strings=${{
            imageViewerFitContain: longFitLabel,
            imageViewerFitWidth: longFitLabel,
            imageViewerFitActual: longFitLabel,
          }}
        ></lr-image-viewer>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector("lr-image-viewer") as LyraImageViewer;
    await el.updateComplete;
    const toolbar = el.shadowRoot!.querySelector(
      '[part="toolbar"]'
    ) as HTMLElement;
    const fitControl = el.shadowRoot!.querySelector(
      '[part="fit-control"]'
    ) as HTMLSelectElement;
    const allocation = wrapper.getBoundingClientRect();
    const control = fitControl.getBoundingClientRect();
    const controlStyle = getComputedStyle(fitControl);

    expect(
      wrapper.scrollWidth,
      `${direction} wrapper scroll width`
    ).to.be.at.most(wrapper.clientWidth);
    expect(
      toolbar.scrollWidth,
      `${direction} toolbar scroll width`
    ).to.be.at.most(toolbar.clientWidth);
    expect(control.width, `${direction} fit control width`).to.be.at.most(
      allocation.width
    );
    expect(control.left, `${direction} fit control start`).to.be.at.least(
      allocation.left
    );
    expect(control.right, `${direction} fit control end`).to.be.at.most(
      allocation.right
    );
    expect(
      controlStyle.textOverflow,
      `${direction} fit label truncation`
    ).to.equal("ellipsis");
    expect(fitControl.value).to.equal("contain");
    wrapper.remove();
  }
});

it("normalizes and reflects the closed fit and rotation vocabularies once", async () => {
  const el = await fixture<LyraImageViewer>(html`
    <lr-image-viewer
      src=${PNG_SRC}
      fit="diagonal"
      rotation="44"
    ></lr-image-viewer>
  `);
  await el.updateComplete;
  expect(el.fit).to.equal("contain");
  expect(el.getAttribute("fit")).to.equal("contain");
  expect(el.rotation).to.equal(0);
  expect(el.getAttribute("rotation")).to.equal("0");

  el.fit = "actual";
  el.rotation = 226 as LyraImageRotation;
  await el.updateComplete;
  expect(el.fit).to.equal("actual");
  expect(el.rotation).to.equal(270);
  expect(el.getAttribute("rotation")).to.equal("270");
});

it("keeps every content-dependent control inert until the current image is loaded", async () => {
  const el = await fixture<LyraImageViewer>(
    html`<lr-image-viewer annotatable></lr-image-viewer>`
  );
  const controls = () => [
    el.shadowRoot!.querySelector<HTMLSelectElement>('[part="fit-control"]')!,
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="rotate-button"]')!,
    el.shadowRoot!.querySelector<HTMLButtonElement>(
      '[part="annotate-toggle"]'
    )!,
  ];
  expect(controls().every((control) => control.disabled)).to.be.true;
  expect(controls()[2]!.getAttribute("aria-pressed")).to.equal("false");

  el.src = PNG_SRC;
  await el.updateComplete;
  expect(controls().every((control) => control.disabled)).to.be.true;
  await stubImageLoad(el);
  await el.updateComplete;
  expect(controls().every((control) => !control.disabled)).to.be.true;
  expect(controls()[2]!.getAttribute("aria-pressed")).to.equal("true");

  const img = el.shadowRoot!.querySelector(
    '[part="image"]'
  ) as HTMLImageElement;
  img.dispatchEvent(new Event("error"));
  await el.updateComplete;
  expect(controls().every((control) => control.disabled)).to.be.true;
  expect(controls()[2]!.getAttribute("aria-pressed")).to.equal("false");
  expect(
    el.shadowRoot!.querySelectorAll('[part="annotation-box"]').length
  ).to.equal(0);
});

it("ignores stale native image terminals after a source replacement", async () => {
  const el = await fixture<LyraImageViewer>(
    html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
  );
  const first = el.shadowRoot!.querySelector(
    '[part="image"]'
  ) as HTMLImageElement;
  let loads = 0;
  let errors = 0;
  el.addEventListener("lr-load", () => loads++);
  el.addEventListener("lr-render-error", () => errors++);

  el.src = `${PNG_SRC}?current`;
  await el.updateComplete;
  const current = el.shadowRoot!.querySelector(
    '[part="image"]'
  ) as HTMLImageElement;
  expect(current === first).to.be.false;
  first.dispatchEvent(new Event("load"));
  first.dispatchEvent(new Event("error"));
  await el.updateComplete;
  expect([loads, errors]).to.deep.equal([0, 0]);
  expect(
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="rotate-button"]')!
      .disabled
  ).to.be.true;

  Object.defineProperty(current, "naturalWidth", {
    value: 80,
    configurable: true,
  });
  Object.defineProperty(current, "naturalHeight", {
    value: 60,
    configurable: true,
  });
  current.dispatchEvent(new Event("load"));
  await el.updateComplete;
  expect([loads, errors]).to.deep.equal([1, 0]);
});

it("uses first-wins unique highlight ids and a bounded roving projection", async () => {
  const many: LyraHighlight[] = Array.from({ length: 10_000 }, (_, index) => ({
    id: `region-${index}`,
    anchor: {
      kind: "region",
      rect: { x: index % 90, y: index % 90, width: 1, height: 1 },
    },
  }));
  many.splice(1, 0, {
    id: "region-0",
    label: "duplicate must be ignored",
    anchor: { kind: "region", rect: { x: 80, y: 80, width: 10, height: 10 } },
  });
  const el = await fixture<LyraImageViewer>(html`
    <lr-image-viewer
      src=${PNG_SRC}
      .highlights=${many}
      active-highlight-id="region-9999"
    ></lr-image-viewer>
  `);
  await stubImageLoad(el);
  await el.updateComplete;
  const layer = el.shadowRoot!.querySelector(
    '[part="highlight-layer"]'
  ) as HTMLElement;
  const buttons = [
    ...layer.querySelectorAll<HTMLButtonElement>('[part="highlight"]'),
  ];
  expect(layer.hasAttribute("data-truncated")).to.be.true;
  expect(layer.dataset["total"]).to.equal("10000");
  expect(buttons.length).to.equal(200);
  expect(buttons.filter((button) => button.tabIndex === 0).length).to.equal(1);
  expect(
    buttons.some((button) => button.dataset["highlightId"] === "region-9999")
  ).to.be.true;
  expect(
    buttons.filter((button) => button.dataset["highlightId"] === "region-0")
      .length
  ).to.equal(1);

  const active = buttons.find(
    (button) => button.dataset["highlightId"] === "region-9999"
  )!;
  active.focus();
  active.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Home",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(
    (el.shadowRoot!.activeElement as HTMLElement).dataset["highlightId"]
  ).to.equal("region-0");
  expect(
    [...layer.querySelectorAll('[part="highlight"]')].filter(
      (button) => (button as HTMLElement).tabIndex === 0
    ).length
  ).to.equal(1);
});

it('omits malformed and blank region highlight identities before focus and activation', async () => {
  const el = await fixture<LyraImageViewer>(html`
    <lr-image-viewer
      src=${PNG_SRC}
      .highlights=${[
        null,
        { id: '   ', anchor: { kind: 'region', rect: { x: 1, y: 1, width: 10, height: 10 } } },
        { id: 'valid', anchor: { kind: 'region', rect: { x: 2, y: 2, width: 10, height: 10 } } },
      ] as unknown as LyraHighlight[]}
    ></lr-image-viewer>
  `);
  await stubImageLoad(el);
  await el.updateComplete;

  const buttons = el.shadowRoot!.querySelectorAll('[part="highlight"]');
  expect(buttons).to.have.lengthOf(1);
  expect((buttons[0] as HTMLElement).dataset['highlightId']).to.equal('valid');
});

it("rejects malformed region anchors and visibly reveals a valid far-corner region", async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="inline-size: 240px">
      <lr-image-viewer fit="actual" src=${LOADABLE_PNG}></lr-image-viewer>
    </div>
  `);
  const el = wrapper.querySelector("lr-image-viewer") as LyraImageViewer;
  await el.updateComplete;
  const img = el.shadowRoot!.querySelector(
    '[part="image"]'
  ) as HTMLImageElement;
  img.width = 1200;
  img.height = 800;
  await stubImageLoad(el, 1200, 800);
  await waitUntil(
    () =>
      el
        .shadowRoot!.querySelector('[part="rotation-frame"]')!
        .hasAttribute("data-measured"),
    "rotation footprint was not measured"
  );
  (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 20;
  (
    el as unknown as { anchorRetryIntervalMs: number }
  ).anchorRetryIntervalMs = 2;
  expect(
    await el.scrollToAnchor({
      kind: "region",
      rect: { x: Number.NaN, y: 0, width: 10, height: 10 },
    })
  ).to.be.false;
  expect(
    await el.scrollToAnchor({
      kind: "region",
      rect: { x: -1, y: 0, width: 10, height: 10 },
    })
  ).to.be.false;
  expect(
    await el.scrollToAnchor({
      kind: "region",
      rect: { x: 95, y: 95, width: 10, height: 10 },
    })
  ).to.be.false;

  expect(
    await el.scrollToAnchor({
      kind: "region",
      rect: { x: 90, y: 90, width: 10, height: 10 },
    })
  ).to.be.true;
  const viewport = (
    el.shadowRoot!.querySelector("lr-pan-zoom") as LyraPanZoom
  ).shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
  expect(viewport.scrollLeft + viewport.scrollTop).to.be.greaterThan(0);
  const targetRect = el
    .shadowRoot!.querySelector<HTMLElement>("[data-reveal-target]")!
    .getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  expect(
    targetRect.right > viewportRect.left && targetRect.left < viewportRect.right
  ).to.be.true;
  expect(
    targetRect.bottom > viewportRect.top && targetRect.top < viewportRect.bottom
  ).to.be.true;
});

it("gives 90/270-degree media an axis-swapped scroll footprint in every fit and direction", async () => {
  for (const direction of ["ltr", "rtl"] as const) {
    for (const fit of ["contain", "width", "actual"] as const) {
      for (const rotation of [90, 270] as const) {
        const host = await fixture<LyraImageViewer>(html`
          <lr-image-viewer
            dir=${direction}
            .fit=${fit}
            .rotation=${rotation}
            src=${LOADABLE_PNG}
            style="inline-size: 240px"
          ></lr-image-viewer>
        `);
        const img = host.shadowRoot!.querySelector(
          '[part="image"]'
        ) as HTMLImageElement;
        img.width = 640;
        img.height = 120;
        await stubImageLoad(host, 640, 120);
        await waitUntil(
          () =>
            host
              .shadowRoot!.querySelector('[part="rotation-frame"]')!
              .hasAttribute("data-measured"),
          `${direction}/${fit}/${rotation} rotation footprint was not measured`
        );
        const frame = host.shadowRoot!.querySelector(
          '[part="rotation-frame"]'
        ) as HTMLElement;
        const imageWrapper = host.shadowRoot!.querySelector(
          '[part="image-wrapper"]'
        ) as HTMLElement;
        await waitUntil(
          () =>
            Math.abs(
              frame.getBoundingClientRect().width - imageWrapper.offsetHeight
            ) <= 1 &&
            Math.abs(
              frame.getBoundingClientRect().height - imageWrapper.offsetWidth
            ) <= 1,
          `${direction}/${fit}/${rotation} rotation footprint did not settle`
        );
        const frameRect = frame.getBoundingClientRect();
        const paintedRect = imageWrapper.getBoundingClientRect();
        expect(
          frameRect.width,
          `${direction}/${fit}/${rotation} swapped inline size`
        ).to.be.closeTo(imageWrapper.offsetHeight, 1);
        expect(
          frameRect.height,
          `${direction}/${fit}/${rotation} swapped block size`
        ).to.be.closeTo(imageWrapper.offsetWidth, 1);
        expect(
          paintedRect.width,
          `${direction}/${fit}/${rotation} painted width is reachable`
        ).to.be.closeTo(frameRect.width, 1);
        expect(
          paintedRect.height,
          `${direction}/${fit}/${rotation} painted height is reachable`
        ).to.be.closeTo(frameRect.height, 1);
        host.remove();
      }
    }
  }
});

it("contains pan-zoom focus aliases and forwards collision-resistant frame parts", async () => {
  const style = document.createElement("style");
  style.textContent =
    "lr-image-viewer::part(frame-viewport) { border-top-width: 7px; }";
  document.head.append(style);
  try {
    const el = await fixture<LyraImageViewer>(
      html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`
    );
    const frame = el.shadowRoot!.querySelector("lr-pan-zoom") as LyraPanZoom;
    expect(frame.getAttribute("exportparts")).to.equal(
      "viewport:frame-viewport,content:frame-content,controls:frame-controls"
    );
    let focusEvents = 0;
    let aliases = 0;
    el.addEventListener("focus", () => focusEvents++);
    el.addEventListener("lr-focus", () => aliases++);
    frame.dispatchEvent(
      new FocusEvent("focus", { bubbles: true, composed: true })
    );
    frame.dispatchEvent(
      new CustomEvent("lr-focus", { bubbles: true, composed: true })
    );
    expect([focusEvents, aliases]).to.deep.equal([0, 0]);
    const viewport = frame.shadowRoot!.querySelector(
      '[part="viewport"]'
    ) as HTMLElement;
    expect(getComputedStyle(viewport).borderTopWidth).to.equal("7px");
  } finally {
    style.remove();
  }
});

it("keeps highlight categories distinct without relying on color", async () => {
  const highlights: LyraHighlight[] = [
    "accent",
    "success",
    "warning",
    "danger",
    "neutral",
  ].map((tone, index) => ({
    id: tone,
    tone: tone as LyraHighlight["tone"],
    anchor: {
      kind: "region",
      rect: { x: index * 15, y: 10, width: 10, height: 10 },
    },
  }));
  const el = await fixture<LyraImageViewer>(
    html`<lr-image-viewer
      src=${PNG_SRC}
      .highlights=${highlights}
    ></lr-image-viewer>`
  );
  await stubImageLoad(el);
  const styles = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="highlight"]'),
  ].map((highlight) => getComputedStyle(highlight).borderTopStyle);
  expect(new Set(styles).size).to.equal(5);
});

it("calls super.adoptedCallback before reconnecting owner-realm resources", async () => {
  const proto = LyraElement.prototype;
  const original = proto.adoptedCallback;
  let calledOnSelf = false;
  proto.adoptedCallback = function (this: LyraElement): void {
    if (this.tagName === "LR-IMAGE-VIEWER") calledOnSelf = true;
    original.call(this);
  };
  try {
    const el = await fixture<LyraImageViewer>(
      html`<lr-image-viewer></lr-image-viewer>`
    );
    el.adoptedCallback();
    expect(calledOnSelf).to.be.true;
  } finally {
    proto.adoptedCallback = original;
  }
});

// -- Document-renderer registry entry ---------------------------------------

it("registers one shared image renderer across every raster MIME type", async () => {
  const { getDefaultDocumentRendererRegistry } = await import(
    "../../viewers/document-viewer/registry.js"
  );
  const registry = getDefaultDocumentRendererRegistry();
  const mimes = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/bmp",
  ];
  const def = registry.get("image/png");
  expect(def, "importing image-viewer.js registers the renderer").to.exist;
  for (const mime of mimes) {
    expect(registry.get(mime), `${mime} shares one definition`).to.equal(def);
  }

  expect(
    def!.matches!({ name: "photo.PNG", mimeType: "image/png", src: PNG_SRC })
  ).to.be.true;
  expect(
    def!.matches!({
      name: "no-extension",
      mimeType: "image/tiff",
      src: PNG_SRC,
    })
  ).to.be.true;
  expect(
    def!.matches!({
      name: "diagram.svg",
      mimeType: "image/svg+xml",
      src: PNG_SRC,
    }),
    "SVG belongs to lr-svg-viewer, not the raster viewer"
  ).to.be.false;
  expect(
    def!.matches!({ name: "notes.txt", mimeType: "text/plain", src: PNG_SRC })
  ).to.be.false;
  expect(def!.capabilities).to.deep.equal({ anchors: ["region"] });

  const host = (await fixture(
    html`<div>
      ${def!.render!({
        name: "photo.png",
        mimeType: "image/png",
        src: PNG_SRC,
        alt: "A photo",
      })}
    </div>`
  )) as HTMLElement;
  const viewer = host.querySelector("lr-image-viewer") as LyraImageViewer;
  expect(viewer).to.exist;
  expect(viewer.name).to.equal("photo.png");
});
