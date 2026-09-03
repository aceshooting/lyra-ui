import { fixture, expect, html, oneEvent, aTimeout } from "@open-wc/testing";
import "./generation-metrics.js";
import type { LyraGenerationMetrics } from "./generation-metrics.js";

// The browser runner has no compatible fake-timer harness, so timer-driven behavior here uses
// real `setInterval` ticks with generous margins. Most assertions below sidestep
// waiting on the ~1s ticker entirely by seeding `started-at` with an
// already-elapsed epoch-ms timestamp before setting `status="running"` -- since the
// elapsed display is recomputed synchronously when the run begins (not just on the next tick),
// that alone deterministically produces
// a known elapsed reading with no real-time wait required.

function elapsedText(el: LyraGenerationMetrics): string {
  return el.shadowRoot!.querySelector('[part="elapsed"]')!.textContent!.trim();
}

function tokensText(el: LyraGenerationMetrics): string | null {
  return (
    el.shadowRoot!.querySelector('[part="tokens"]')?.textContent?.trim() ?? null
  );
}

function throughputText(el: LyraGenerationMetrics): string | null {
  return (
    el.shadowRoot!.querySelector('[part="throughput"]')?.textContent?.trim() ??
    null
  );
}

/** Parses this component's own `"12.3s"` / `"1m 23s"` format back into a
 *  plain seconds count, so tests can assert numeric closeness instead of
 *  hardcoding an exact string a few milliseconds of real-clock jitter could
 *  break. */
function parseElapsedSeconds(text: string): number {
  const minuteMatch = text.match(/^(\d+)m (\d+)s$/);
  if (minuteMatch) return Number(minuteMatch[1]) * 60 + Number(minuteMatch[2]);
  const secondMatch = text.match(/^(\d+(?:\.\d+)?)s$/);
  if (secondMatch) return Number(secondMatch[1]);
  throw new Error(`Unrecognized elapsed format: "${text}"`);
}

it("defaults to idle with no optional segments and no Stop action", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(el.status).to.equal("idle");
  expect(el.getAttribute("status")).to.equal("idle");
  expect(el.startedAt).to.be.undefined;
  expect(el.tokenCount).to.be.undefined;
  expect(el.tokensPerSecond).to.be.undefined;
  expect(el.showStop).to.be.true;

  expect(elapsedText(el)).to.equal("0.0s");
  expect(tokensText(el)).to.be.null;
  expect(throughputText(el)).to.be.null;

  expect(el.shadowRoot!.querySelector('[part="stop-button"]') === null).to.be
    .true;
});

it("gives the stop button the shared minimum hit area", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics status="running"></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  const stopButton = el.shadowRoot!.querySelector(
    '[part="stop-button"]'
  ) as HTMLElement;
  expect(getComputedStyle(stopButton).minInlineSize).to.equal("40px");
  expect(getComputedStyle(stopButton).minBlockSize).to.equal("40px");
});

it('inherits a 20px consumer font into the stop control and its glyph', async () => {
  const el = (await fixture(
    html`<lr-generation-metrics status="running" style="font-size:20px"></lr-generation-metrics>`,
  )) as LyraGenerationMetrics;
  const button = el.shadowRoot!.querySelector<HTMLElement>('[part="stop-button"]')!;
  const glyph = button.querySelector<SVGElement>('svg')!;

  expect(getComputedStyle(button).fontSize).to.equal('20px');
  expect(getComputedStyle(glyph).width).to.equal('20px');
  expect(getComputedStyle(glyph).height).to.equal('20px');
});

it("localizes the stop button aria-label via .strings (stopGenerating)", async () => {
  const el = (await fixture(html`
    <lr-generation-metrics
      status="running"
      .strings=${{ stopGenerating: "Arrêter" }}
    ></lr-generation-metrics>
  `)) as LyraGenerationMetrics;
  const stopButton = el.shadowRoot!.querySelector(
    '[part="stop-button"]'
  ) as HTMLButtonElement;
  expect(stopButton.getAttribute("aria-label")).to.equal("Arrêter");
});

it("status reflects and distinguishes idle, running, and complete", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  el.status = "running";
  await el.updateComplete;
  expect(el.getAttribute("status")).to.equal("running");
  expect(el.shadowRoot!.querySelector('[part="stop-button"]')).to.exist;

  el.status = "complete";
  await el.updateComplete;
  expect(el.getAttribute("status")).to.equal("complete");
  expect(el.shadowRoot!.querySelector('[part="stop-button"]') === null).to.be
    .true;
});

it("normalizes invalid status attributes and direct JavaScript writes to idle", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics status="unknown"></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(el.status).to.equal("idle");
  expect(el.getAttribute("status")).to.equal("idle");

  (el as unknown as { status: string }).status = "paused";
  await el.updateComplete;
  expect(el.status).to.equal("idle");
});

it("hides the stop button entirely when show-stop is false", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics
      status="running"
      .showStop=${false}
    ></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(el.shadowRoot!.querySelector('[part="stop-button"]') == null).to.be
    .true;
});

it('turns the stop button off via the plain show-stop="false" attribute string, not just a .showStop property binding', async () => {
  const el = (await fixture(
    html`<lr-generation-metrics
      status="running"
      show-stop="false"
    ></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(el.showStop).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="stop-button"]') == null).to.be
    .true;
});

it("defaults show-stop to true when the attribute is entirely absent, and leaves it true for any other attribute spelling", async () => {
  const absent = (await fixture(
    html`<lr-generation-metrics status="running"></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(absent.showStop).to.be.true;
  expect(absent.shadowRoot!.querySelector('[part="stop-button"]')).to.exist;

  const bare = (await fixture(
    html`<lr-generation-metrics
      status="running"
      show-stop
    ></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(bare.showStop).to.be.true;
  expect(bare.shadowRoot!.querySelector('[part="stop-button"]')).to.exist;

  const explicitTrue = (await fixture(
    html`<lr-generation-metrics
      status="running"
      show-stop="true"
    ></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(explicitTrue.showStop).to.be.true;
  expect(explicitTrue.shadowRoot!.querySelector('[part="stop-button"]')).to
    .exist;
});

it("emits lr-stop (no detail) when the built-in stop button is clicked", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics status="running"></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  const listener = oneEvent(el, "lr-stop");
  (
    el.shadowRoot!.querySelector('[part="stop-button"]') as HTMLButtonElement
  ).click();
  const event = await listener;
  // CustomEventInit's `detail` member defaults to `null` (not `undefined`)
  // per the WebIDL dictionary-conversion algorithm -- see
  // `<lr-chat-composer>`'s identical no-detail `lr-stop` test for the
  // same note.
  expect(event.detail).to.equal(null);
});

it("immediately re-baselines elapsed from started-at when status becomes running", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  el.startedAt = Date.now() - 2000;
  el.status = "running";
  await el.updateComplete;

  expect(parseElapsedSeconds(elapsedText(el))).to.be.closeTo(2.0, 0.3);
});

it("falls back to capturing the current time when status becomes running with no started-at", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  el.status = "running";
  await el.updateComplete;

  // Freshly activated with no started-at -- the fallback clock starts at
  // (approximately) this very instant, so elapsed should read ~0, not the
  // full mount-to-now span.
  expect(parseElapsedSeconds(elapsedText(el))).to.be.closeTo(0, 0.3);
});

it("starts the ticker immediately when the element mounts already running", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics
      .status=${"running"}
      .startedAt=${Date.now() - 1000}
    ></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(parseElapsedSeconds(elapsedText(el))).to.be.closeTo(1.0, 0.3);
});

it("formats sub-minute elapsed time with one decimal place of seconds", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  el.startedAt = Date.now() - 12300;
  el.status = "running";
  await el.updateComplete;
  expect(elapsedText(el)).to.match(/^12\.[0-4]s$/);
});

it('formats elapsed time at or beyond a minute as "Xm Ys"', async () => {
  const el = (await fixture(
    html`<lr-generation-metrics></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  el.startedAt = Date.now() - 65000;
  el.status = "running";
  await el.updateComplete;
  expect(elapsedText(el)).to.equal("1m 5s");
});

it('never displays "60.0s" -- a value that rounds up to a full minute at one-decimal precision rolls over to "1m 0s"', async () => {
  const el = (await fixture(
    html`<lr-generation-metrics></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  // 59.96s: Math.round(59.96 * 10) / 10 === 60.0 if formatted via the
  // sub-minute branch, which is exactly the bug this cutoff avoids.
  el.startedAt = Date.now() - 59960;
  el.status = "running";
  await el.updateComplete;
  expect(elapsedText(el)).to.equal("1m 0s");
});

it("the ticker keeps advancing the elapsed display roughly once per second while running", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics status="running"></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  const before = parseElapsedSeconds(elapsedText(el));
  await aTimeout(1150);
  const after = parseElapsedSeconds(elapsedText(el));
  expect(
    after,
    "the ticker should have advanced the display by roughly a second"
  ).to.be.greaterThan(before + 0.5);
});

it("freezes elapsed when status becomes complete, and stops ticking", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics status="running"></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  await aTimeout(1150);
  el.status = "complete";
  await el.updateComplete;
  const frozen = elapsedText(el);
  expect(parseElapsedSeconds(frozen)).to.be.greaterThan(0.5);

  await aTimeout(1150);
  expect(
    elapsedText(el),
    "the display must not keep advancing once complete"
  ).to.equal(frozen);
});

it("resets elapsed when status returns to idle instead of presenting a completed summary", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics
      status="running"
      .startedAt=${Date.now() - 2000}
    ></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(parseElapsedSeconds(elapsedText(el))).to.be.greaterThan(1);
  el.status = "idle";
  await el.updateComplete;
  expect(elapsedText(el)).to.equal("0.0s");
});

it("never renders a NaN-containing elapsed string when started-at is a malformed (non-numeric) value, falling back to its own clock instead", async () => {
  // `type: Number` conversion of a non-numeric attribute string (an ISO date,
  // here) fails and lands as `NaN`, exactly like a `Number("...")` parse
  // failure would -- this is the malformed input this guard exists for.
  const el = (await fixture(
    html`<lr-generation-metrics
      status="running"
      started-at="2024-01-01T00:00:00.000Z"
    ></lr-generation-metrics>`
  )) as LyraGenerationMetrics;

  expect(Number.isNaN(el.startedAt)).to.be.true;
  const text = elapsedText(el);
  expect(text).to.not.include("NaN");
  expect(parseElapsedSeconds(text)).to.be.closeTo(0, 0.3);

  await aTimeout(1150);
  const later = elapsedText(el);
  expect(
    later,
    "the ticker should still be advancing from the fallback clock, not stuck on a NaN reading"
  ).to.not.include("NaN");
  expect(parseElapsedSeconds(later)).to.be.greaterThan(0.5);
});

it('clamps a negative started-at to epoch 0 rather than treating it the same as "unset"', async () => {
  const el = (await fixture(
    html`<lr-generation-metrics></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  el.startedAt = -5000;

  // Clamped to 0, not `undefined` -- an `undefined` result here would mean this negative value
  // was (wrongly) treated the same as "unset", which instead falls back to capturing `Date.now()`
  // as the start instant (see `validStartedAt`'s own doc).
  expect(
    (el as unknown as { validStartedAt: number | undefined }).validStartedAt
  ).to.equal(0);
});

it("restarts the fallback clock from scratch on a fresh complete -> running transition", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics status="running"></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  await aTimeout(1150);
  el.status = "complete";
  await el.updateComplete;

  el.status = "running";
  await el.updateComplete;
  expect(
    parseElapsedSeconds(elapsedText(el)),
    "reactivating should re-baseline, not resume the old clock"
  ).to.be.closeTo(0, 0.3);
});

it("renders the tokens segment once token-count is set, using singular/plural wording", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics token-count="340"></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(tokensText(el)).to.equal("340 tokens");

  el.tokenCount = 1;
  await el.updateComplete;
  expect(tokensText(el)).to.equal("1 token");
});

it("clamps a negative token-count to 0 and omits the segment entirely for a non-numeric token-count", async () => {
  const negative = (await fixture(
    html`<lr-generation-metrics token-count="-5"></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(tokensText(negative)).to.equal("0 tokens");

  const nonFinite = (await fixture(
    html`<lr-generation-metrics
      token-count="not-a-number"
    ></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(Number.isNaN(nonFinite.tokenCount)).to.be.true;
  expect(
    tokensText(nonFinite),
    "a non-numeric token-count must omit the segment, the same as unset"
  ).to.be.null;
});

it("rounds fractional token counts and treats non-finite rates as omitted before deriving", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics
      status="running"
      .startedAt=${Date.now() - 2000}
    ></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  el.tokenCount = 3.6;
  el.tokensPerSecond = Number.POSITIVE_INFINITY;
  await el.updateComplete;
  expect(tokensText(el)).to.equal("4 tokens");
  const derived = throughputText(el);
  expect(derived).to.match(/^2(?:\.\d)? tok\/s$/);

  el.tokenCount = undefined;
  await el.updateComplete;
  expect(throughputText(el)).to.be.null;
});

it("clamps a negative host-supplied tokens-per-second to 0 rather than rendering a negative rate", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics
      tokens-per-second="-12"
    ></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(throughputText(el)).to.equal("0 tok/s");
});

it("localizes the complete tokens segment via .strings so translations can reorder the count", async () => {
  const el = (await fixture(html`
    <lr-generation-metrics
      token-count="340"
      .strings=${{
        generationStatusTokenCount: "Jeton : {count}",
        generationStatusTokensCount: "Jetons : {count}",
      }}
    ></lr-generation-metrics>
  `)) as LyraGenerationMetrics;
  expect(tokensText(el)).to.equal("Jetons : 340");

  el.tokenCount = 1;
  await el.updateComplete;
  expect(tokensText(el)).to.equal("Jeton : 1");
});

it("localizes complete elapsed and throughput messages via .strings", async () => {
  const el = (await fixture(html`
    <lr-generation-metrics
      tokens-per-second="3.2"
      .strings=${{
        generationStatusElapsedSeconds: "Secondes : {seconds}",
        generationStatusThroughput: "Par seconde : {rate}",
      }}
    ></lr-generation-metrics>
  `)) as LyraGenerationMetrics;
  el.startedAt = Date.now() - 12_300;
  el.status = "running";
  await el.updateComplete;

  expect(elapsedText(el)).to.match(/^Secondes : 12\.[3-4]$/);
  expect(throughputText(el)).to.equal("Par seconde : 3.2");
});

it("formats elapsed time, token counts, and throughput with the effective locale", async () => {
  const el = (await fixture(html`
    <lr-generation-metrics
      lang="de-DE"
      token-count="1234"
      tokens-per-second="3.2"
    ></lr-generation-metrics>
  `)) as LyraGenerationMetrics;
  el.startedAt = Date.now() - 12_300;
  el.status = "running";
  await el.updateComplete;

  expect(elapsedText(el)).to.match(/^12,[3-4]s$/);
  expect(tokensText(el)).to.equal("1.234 tokens");
  expect(throughputText(el)).to.equal("3,2 tok/s");
});

it("uses a normalized host-supplied tokens-per-second even while idle with zero elapsed time", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics tokens-per-second="27"></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(throughputText(el)).to.equal("27 tok/s");
});

it("omits the throughput segment when only token-count is available and under a second has elapsed", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  el.tokenCount = 10;
  el.startedAt = Date.now() - 500;
  el.status = "running";
  await el.updateComplete;
  expect(
    throughputText(el),
    "a sub-second elapsed window should not yet produce a derived rate"
  ).to.be.null;
});

it("derives a live tokens/sec figure from token-count and elapsed time once a full second has passed", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  el.tokenCount = 100;
  el.startedAt = Date.now() - 2000;
  el.status = "running";
  await el.updateComplete;

  const text = throughputText(el);
  expect(text).to.match(/^\d+(\.\d+)? tok\/s$/);
  const value = Number(text!.replace(" tok/s", ""));
  // ~100 tokens / ~2s == ~50 tok/s, generous tolerance for real-clock jitter.
  expect(value).to.be.closeTo(50, 10);
});

it("omits both optional segments when neither token-count nor tokens-per-second is set", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics status="running"></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(tokensText(el)).to.be.null;
  expect(throughputText(el)).to.be.null;
});

it("clears the ticker on disconnect so it cannot keep updating a detached element", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics status="running"></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  el.remove();
  // Purely a "must not throw" / no-leaked-timer-crash check -- there is
  // nothing externally observable left on a detached, un-rendered element.
  await aTimeout(1150);
  expect(el.isConnected).to.be.false;
});

it("resumes the ticker after being disconnected and reconnected while still running", async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement(
    "lr-generation-metrics"
  ) as LyraGenerationMetrics;
  el.status = "running";
  container.append(el);
  await el.updateComplete;

  // Re-parent: a virtualized/reordering list would do exactly this --
  // remove then immediately re-append the same element, with `status`
  // never changing in between.
  el.remove();
  expect(el.isConnected).to.be.false;
  container.append(el);
  expect(el.isConnected).to.be.true;
  await el.updateComplete;

  const before = parseElapsedSeconds(elapsedText(el));
  await aTimeout(1150);
  const after = parseElapsedSeconds(elapsedText(el));
  expect(
    after,
    "the ticker must keep advancing after a reconnect, not stay frozen at its pre-disconnect reading"
  ).to.be.greaterThan(before + 0.5);
});

it("schedules and clears its ticker through the exact owner window across adoption", async () => {
  type GenerationMetricsInternals = {
    elapsedMs: number;
    fallbackStartMs?: number;
  };
  const el = (await fixture(
    html`<lr-generation-metrics></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  await el.updateComplete;
  el.remove();
  const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = iframe.contentDocument!;
  const frameWindow = iframe.contentWindow!;
  const originalMainSet = window.setInterval;
  const originalMainClear = window.clearInterval;
  const originalFrameSet = frameWindow.setInterval;
  const originalFrameClear = frameWindow.clearInterval;
  const mainCallbacks = new Map<number, VoidFunction>();
  const frameCallbacks = new Map<number, VoidFunction>();
  const frameCancellations: number[] = [];
  let mainHandle = 6300;
  let frameHandle = 7300;

  window.setInterval = ((handler: TimerHandler) => {
    if (typeof handler !== "function")
      throw new TypeError("Expected an interval callback.");
    const handle = ++mainHandle;
    mainCallbacks.set(handle, handler as VoidFunction);
    return handle;
  }) as typeof window.setInterval;
  window.clearInterval = ((handle?: number) => {
    if (handle !== undefined) mainCallbacks.delete(handle);
  }) as typeof window.clearInterval;
  frameWindow.setInterval = ((handler: TimerHandler) => {
    if (typeof handler !== "function")
      throw new TypeError("Expected an interval callback.");
    const handle = ++frameHandle;
    frameCallbacks.set(handle, handler as VoidFunction);
    return handle;
  }) as typeof frameWindow.setInterval;
  frameWindow.clearInterval = ((handle?: number) => {
    if (handle !== undefined) {
      frameCancellations.push(handle);
      frameCallbacks.delete(handle);
    }
  }) as typeof frameWindow.clearInterval;

  try {
    frameDocument.adoptNode(el);
    expect(
      frameCallbacks.size,
      "detached adoption must not start a ticker"
    ).to.equal(0);

    frameDocument.body.append(el);
    el.status = "running";
    await el.updateComplete;
    expect(
      mainCallbacks.size,
      "the parent window must not own an iframe ticker"
    ).to.equal(0);
    expect(
      frameCallbacks.size,
      "only the current iframe interval stays armed"
    ).to.equal(1);
    const [oldHandle, staleTick] = Array.from(frameCallbacks.entries())[0]!;

    document.adoptNode(el);
    expect(
      frameCancellations,
      "adoption clears through the retained iframe owner"
    ).to.include(oldHandle);
    expect(
      mainCallbacks.size,
      "detached adoption must not arm the destination ticker"
    ).to.equal(0);
    const internals = el as unknown as GenerationMetricsInternals;
    internals.elapsedMs = 321;
    internals.fallbackStartMs = Date.now() - 5000;
    staleTick();
    expect(
      internals.elapsedMs,
      "a canceled source-realm tick cannot update adopted state"
    ).to.equal(321);

    document.body.append(el);
    expect(
      mainCallbacks.size,
      "reconnect resumes the ticker in the destination window"
    ).to.equal(1);
    const currentTick = Array.from(mainCallbacks.values())[0]!;
    internals.elapsedMs = 123;
    internals.fallbackStartMs = Date.now() - 5000;
    currentTick();
    expect(internals.elapsedMs).to.be.greaterThan(4000);
  } finally {
    el.remove();
    window.setInterval = originalMainSet;
    window.clearInterval = originalMainClear;
    frameWindow.setInterval = originalFrameSet;
    frameWindow.clearInterval = originalFrameClear;
    iframe.remove();
  }
});

it('carries no role="status"/aria-live of its own -- see the class doc for why a per-second tick must not be announced', async () => {
  const el = (await fixture(
    html`<lr-generation-metrics status="running"></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  expect(el.getAttribute("role")).to.be.null;
  expect(el.getAttribute("aria-live")).to.be.null;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute("role")).to.be.null;
  expect(base.getAttribute("aria-live")).to.be.null;
});

it("is accessible in the default idle state", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  await expect(el).to.be.accessible();
});

it("is accessible while running with tokens, throughput, and the stop button all showing", async () => {
  const el = (await fixture(html`
    <lr-generation-metrics
      .status=${"running"}
      token-count="340"
      tokens-per-second="27"
      .startedAt=${Date.now() - 12300}
    ></lr-generation-metrics>
  `)) as LyraGenerationMetrics;
  expect(tokensText(el)).to.equal("340 tokens");
  expect(throughputText(el)).to.equal("27 tok/s");
  await expect(el).to.be.accessible();
});

it("preserves elapsed time and keeps ticking when a running valid startedAt becomes invalid", async () => {
  const el = (await fixture(
    html`<lr-generation-metrics
      .status=${"running"}
      .startedAt=${Date.now() - 2000}
    ></lr-generation-metrics>`
  )) as LyraGenerationMetrics;
  const before = parseElapsedSeconds(elapsedText(el));

  el.startedAt = undefined;
  await el.updateComplete;
  const afterClear = parseElapsedSeconds(elapsedText(el));
  expect(afterClear).to.be.closeTo(before, 0.3);

  await aTimeout(1150);
  expect(parseElapsedSeconds(elapsedText(el))).to.be.greaterThan(
    afterClear + 0.5
  );
});

it("wraps long localized metrics inside a 320px allocation while keeping Stop reachable", async () => {
  const container = document.createElement("div");
  container.style.inlineSize = "320px";
  const el = (await fixture(
    html`<lr-generation-metrics
      style="inline-size:100%"
      .status=${"running"}
      .startedAt=${Date.now() - 65000}
      token-count="999999999999"
      tokens-per-second="999999.9"
      .strings=${{
        generationStatusTokensCount:
          "AnExtremelyLongLocalizedTokenDescriptionWithoutNaturalBreaks {count}",
        generationStatusThroughput:
          "AnExtremelyLongLocalizedThroughputDescriptionWithoutNaturalBreaks {rate}",
      }}
    ></lr-generation-metrics>`,
    { parentNode: container }
  )) as LyraGenerationMetrics;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const stop = el.shadowRoot!.querySelector(
    '[part="stop-button"]'
  ) as HTMLElement;
  expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
  expect(stop.getBoundingClientRect().right).to.be.at.most(
    container.getBoundingClientRect().right + 1
  );
});
