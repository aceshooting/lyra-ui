import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './generation-status.js';
import type { LyraGenerationStatus } from './generation-status.js';

// `@sinonjs/fake-timers` doesn't work in this test environment (CJS-only,
// no shim configured -- see `<lyra-stream-status>`'s test file for the full
// explanation), so timer-driven behavior here uses real `setInterval` ticks
// with generous margins, same as that file. Most assertions below sidestep
// waiting on the ~1s ticker entirely by seeding `started-at` with an
// already-elapsed epoch-ms timestamp before flipping `active` -- since the
// elapsed display is recomputed synchronously the instant `active` becomes
// `true` (not just on the next tick), that alone deterministically produces
// a known elapsed reading with no real-time wait required.

function elapsedText(el: LyraGenerationStatus): string {
  return el.shadowRoot!.querySelector('[part="elapsed"]')!.textContent!.trim();
}

function tokensText(el: LyraGenerationStatus): string | null {
  return el.shadowRoot!.querySelector('[part="tokens"]')?.textContent?.trim() ?? null;
}

function throughputText(el: LyraGenerationStatus): string | null {
  return el.shadowRoot!.querySelector('[part="throughput"]')?.textContent?.trim() ?? null;
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

it('defaults to inactive with no optional segments, and a stop button with a clear aria-label', async () => {
  const el = (await fixture(html`<lyra-generation-status></lyra-generation-status>`)) as LyraGenerationStatus;
  expect(el.active).to.be.false;
  expect(el.hasAttribute('active')).to.be.false;
  expect(el.startedAt).to.be.undefined;
  expect(el.tokenCount).to.be.undefined;
  expect(el.tokensPerSecond).to.be.undefined;
  expect(el.showStop).to.be.true;

  expect(elapsedText(el)).to.equal('0.0s');
  expect(tokensText(el)).to.be.null;
  expect(throughputText(el)).to.be.null;

  const stopButton = el.shadowRoot!.querySelector('[part="stop-button"]') as HTMLButtonElement;
  expect(stopButton).to.exist;
  expect(stopButton.getAttribute('aria-label')).to.equal('Stop generating');
});

it('localizes the stop button aria-label via .strings (stopGenerating)', async () => {
  const el = (await fixture(html`
    <lyra-generation-status .strings=${{ stopGenerating: 'Arrêter' }}></lyra-generation-status>
  `)) as LyraGenerationStatus;
  const stopButton = el.shadowRoot!.querySelector('[part="stop-button"]') as HTMLButtonElement;
  expect(stopButton.getAttribute('aria-label')).to.equal('Arrêter');
});

it('active reflects to an attribute', async () => {
  const el = (await fixture(html`<lyra-generation-status></lyra-generation-status>`)) as LyraGenerationStatus;
  el.active = true;
  await el.updateComplete;
  expect(el.getAttribute('active')).to.equal('');

  el.active = false;
  await el.updateComplete;
  expect(el.hasAttribute('active')).to.be.false;
});

it('hides the stop button entirely when show-stop is false', async () => {
  const el = (await fixture(
    html`<lyra-generation-status .showStop=${false}></lyra-generation-status>`,
  )) as LyraGenerationStatus;
  expect(el.shadowRoot!.querySelector('[part="stop-button"]')).to.not.exist;
});

it('turns the stop button off via the plain show-stop="false" attribute string, not just a .showStop property binding', async () => {
  const el = (await fixture(
    html`<lyra-generation-status show-stop="false"></lyra-generation-status>`,
  )) as LyraGenerationStatus;
  expect(el.showStop).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="stop-button"]')).to.not.exist;
});

it('defaults show-stop to true when the attribute is entirely absent, and leaves it true for any other attribute spelling', async () => {
  const absent = (await fixture(html`<lyra-generation-status></lyra-generation-status>`)) as LyraGenerationStatus;
  expect(absent.showStop).to.be.true;
  expect(absent.shadowRoot!.querySelector('[part="stop-button"]')).to.exist;

  const bare = (await fixture(html`<lyra-generation-status show-stop></lyra-generation-status>`)) as LyraGenerationStatus;
  expect(bare.showStop).to.be.true;
  expect(bare.shadowRoot!.querySelector('[part="stop-button"]')).to.exist;

  const explicitTrue = (await fixture(
    html`<lyra-generation-status show-stop="true"></lyra-generation-status>`,
  )) as LyraGenerationStatus;
  expect(explicitTrue.showStop).to.be.true;
  expect(explicitTrue.shadowRoot!.querySelector('[part="stop-button"]')).to.exist;
});

it('emits lyra-stop (no detail) when the built-in stop button is clicked', async () => {
  const el = (await fixture(html`<lyra-generation-status></lyra-generation-status>`)) as LyraGenerationStatus;
  const listener = oneEvent(el, 'lyra-stop');
  (el.shadowRoot!.querySelector('[part="stop-button"]') as HTMLButtonElement).click();
  const event = await listener;
  // CustomEventInit's `detail` member defaults to `null` (not `undefined`)
  // per the WebIDL dictionary-conversion algorithm -- see
  // `<lyra-chat-composer>`'s identical no-detail `lyra-stop` test for the
  // same note.
  expect(event.detail).to.equal(null);
});

it('immediately re-baselines the elapsed display from started-at the instant active becomes true, with no wait for the ticker', async () => {
  const el = (await fixture(html`<lyra-generation-status></lyra-generation-status>`)) as LyraGenerationStatus;
  el.startedAt = Date.now() - 2000;
  el.active = true;
  await el.updateComplete;

  expect(parseElapsedSeconds(elapsedText(el))).to.be.closeTo(2.0, 0.3);
});

it('falls back to capturing the current time itself when active becomes true with no started-at set', async () => {
  const el = (await fixture(html`<lyra-generation-status></lyra-generation-status>`)) as LyraGenerationStatus;
  el.active = true;
  await el.updateComplete;

  // Freshly activated with no started-at -- the fallback clock starts at
  // (approximately) this very instant, so elapsed should read ~0, not the
  // full mount-to-now span.
  expect(parseElapsedSeconds(elapsedText(el))).to.be.closeTo(0, 0.3);
});

it('starts the ticker immediately when the element mounts already active', async () => {
  const el = (await fixture(
    html`<lyra-generation-status .active=${true} .startedAt=${Date.now() - 1000}></lyra-generation-status>`,
  )) as LyraGenerationStatus;
  expect(parseElapsedSeconds(elapsedText(el))).to.be.closeTo(1.0, 0.3);
});

it('formats sub-minute elapsed time with one decimal place of seconds', async () => {
  const el = (await fixture(html`<lyra-generation-status></lyra-generation-status>`)) as LyraGenerationStatus;
  el.startedAt = Date.now() - 12300;
  el.active = true;
  await el.updateComplete;
  expect(elapsedText(el)).to.match(/^12\.[0-4]s$/);
});

it('formats elapsed time at or beyond a minute as "Xm Ys"', async () => {
  const el = (await fixture(html`<lyra-generation-status></lyra-generation-status>`)) as LyraGenerationStatus;
  el.startedAt = Date.now() - 65000;
  el.active = true;
  await el.updateComplete;
  expect(elapsedText(el)).to.equal('1m 5s');
});

it('never displays "60.0s" -- a value that rounds up to a full minute at one-decimal precision rolls over to "1m 0s"', async () => {
  const el = (await fixture(html`<lyra-generation-status></lyra-generation-status>`)) as LyraGenerationStatus;
  // 59.96s: Math.round(59.96 * 10) / 10 === 60.0 if formatted via the
  // sub-minute branch, which is exactly the bug this cutoff avoids.
  el.startedAt = Date.now() - 59960;
  el.active = true;
  await el.updateComplete;
  expect(elapsedText(el)).to.equal('1m 0s');
});

it('the ticker keeps advancing the elapsed display roughly once per second while active', async () => {
  const el = (await fixture(html`<lyra-generation-status active></lyra-generation-status>`)) as LyraGenerationStatus;
  const before = parseElapsedSeconds(elapsedText(el));
  await aTimeout(1150);
  const after = parseElapsedSeconds(elapsedText(el));
  expect(after, 'the ticker should have advanced the display by roughly a second').to.be.greaterThan(before + 0.5);
});

it('freezes the elapsed display (does not reset to zero) once active becomes false, and stops ticking', async () => {
  const el = (await fixture(html`<lyra-generation-status active></lyra-generation-status>`)) as LyraGenerationStatus;
  await aTimeout(1150);
  el.active = false;
  await el.updateComplete;
  const frozen = elapsedText(el);
  expect(parseElapsedSeconds(frozen)).to.be.greaterThan(0.5);

  await aTimeout(1150);
  expect(elapsedText(el), 'the display must not keep advancing once inactive').to.equal(frozen);
});

it('never renders a NaN-containing elapsed string when started-at is a malformed (non-numeric) value, falling back to its own clock instead', async () => {
  // `type: Number` conversion of a non-numeric attribute string (an ISO date,
  // here) fails and lands as `NaN`, exactly like a `Number("...")` parse
  // failure would -- this is the malformed input this guard exists for.
  const el = (await fixture(
    html`<lyra-generation-status active started-at="2024-01-01T00:00:00.000Z"></lyra-generation-status>`,
  )) as LyraGenerationStatus;

  expect(Number.isNaN(el.startedAt)).to.be.true;
  const text = elapsedText(el);
  expect(text).to.not.include('NaN');
  expect(parseElapsedSeconds(text)).to.be.closeTo(0, 0.3);

  await aTimeout(1150);
  const later = elapsedText(el);
  expect(later, 'the ticker should still be advancing from the fallback clock, not stuck on a NaN reading').to.not
    .include('NaN');
  expect(parseElapsedSeconds(later)).to.be.greaterThan(0.5);
});

it('clamps a negative started-at to epoch 0 rather than treating it the same as "unset"', async () => {
  const el = (await fixture(html`<lyra-generation-status></lyra-generation-status>`)) as LyraGenerationStatus;
  el.startedAt = -5000;

  // Clamped to 0, not `undefined` -- an `undefined` result here would mean this negative value
  // was (wrongly) treated the same as "unset", which instead falls back to capturing `Date.now()`
  // as the start instant (see `validStartedAt`'s own doc).
  expect((el as unknown as { validStartedAt: number | undefined }).validStartedAt).to.equal(0);
});

it('restarts the fallback clock from scratch on a fresh false -> true transition with no started-at', async () => {
  const el = (await fixture(html`<lyra-generation-status active></lyra-generation-status>`)) as LyraGenerationStatus;
  await aTimeout(1150);
  el.active = false;
  await el.updateComplete;

  el.active = true;
  await el.updateComplete;
  expect(
    parseElapsedSeconds(elapsedText(el)),
    'reactivating should re-baseline, not resume the old clock',
  ).to.be.closeTo(0, 0.3);
});

it('renders the tokens segment once token-count is set, using singular/plural wording', async () => {
  const el = (await fixture(
    html`<lyra-generation-status token-count="340"></lyra-generation-status>`,
  )) as LyraGenerationStatus;
  expect(tokensText(el)).to.equal('340 tokens');

  el.tokenCount = 1;
  await el.updateComplete;
  expect(tokensText(el)).to.equal('1 token');
});

it('clamps a negative token-count to 0 and omits the segment entirely for a non-numeric token-count', async () => {
  const negative = (await fixture(
    html`<lyra-generation-status token-count="-5"></lyra-generation-status>`,
  )) as LyraGenerationStatus;
  expect(tokensText(negative)).to.equal('0 tokens');

  const nonFinite = (await fixture(
    html`<lyra-generation-status token-count="not-a-number"></lyra-generation-status>`,
  )) as LyraGenerationStatus;
  expect(Number.isNaN(nonFinite.tokenCount)).to.be.true;
  expect(tokensText(nonFinite), 'a non-numeric token-count must omit the segment, the same as unset').to.be.null;
});

it('clamps a negative host-supplied tokens-per-second to 0 rather than rendering a negative rate', async () => {
  const el = (await fixture(
    html`<lyra-generation-status tokens-per-second="-12"></lyra-generation-status>`,
  )) as LyraGenerationStatus;
  expect(throughputText(el)).to.equal('0 tok/s');
});

it('localizes the complete tokens segment via .strings so translations can reorder the count', async () => {
  const el = (await fixture(html`
    <lyra-generation-status
      token-count="340"
      .strings=${{
        generationStatusTokenCount: 'Jeton : {count}',
        generationStatusTokensCount: 'Jetons : {count}',
      }}
    ></lyra-generation-status>
  `)) as LyraGenerationStatus;
  expect(tokensText(el)).to.equal('Jetons : 340');

  el.tokenCount = 1;
  await el.updateComplete;
  expect(tokensText(el)).to.equal('Jeton : 1');
});

it('localizes complete elapsed and throughput messages via .strings', async () => {
  const el = (await fixture(html`
    <lyra-generation-status
      tokens-per-second="3.2"
      .strings=${{
        generationStatusElapsedSeconds: 'Secondes : {seconds}',
        generationStatusThroughput: 'Par seconde : {rate}',
      }}
    ></lyra-generation-status>
  `)) as LyraGenerationStatus;
  el.startedAt = Date.now() - 12_300;
  el.active = true;
  await el.updateComplete;

  expect(elapsedText(el)).to.match(/^Secondes : 12\.[3-4]$/);
  expect(throughputText(el)).to.equal('Par seconde : 3.2');
});

it('formats elapsed time, token counts, and throughput with the effective locale', async () => {
  const el = (await fixture(html`
    <lyra-generation-status
      lang="de-DE"
      token-count="1234"
      tokens-per-second="3.2"
    ></lyra-generation-status>
  `)) as LyraGenerationStatus;
  el.startedAt = Date.now() - 12_300;
  el.active = true;
  await el.updateComplete;

  expect(elapsedText(el)).to.match(/^12,[3-4]s$/);
  expect(tokensText(el)).to.equal('1.234 tokens');
  expect(throughputText(el)).to.equal('3,2 tok/s');
});

it('uses a host-supplied tokens-per-second as-is, even while inactive with zero elapsed time', async () => {
  const el = (await fixture(
    html`<lyra-generation-status tokens-per-second="27"></lyra-generation-status>`,
  )) as LyraGenerationStatus;
  expect(throughputText(el)).to.equal('27 tok/s');
});

it('omits the throughput segment when only token-count is available and under a second has elapsed', async () => {
  const el = (await fixture(html`<lyra-generation-status></lyra-generation-status>`)) as LyraGenerationStatus;
  el.tokenCount = 10;
  el.startedAt = Date.now() - 500;
  el.active = true;
  await el.updateComplete;
  expect(throughputText(el), 'a sub-second elapsed window should not yet produce a derived rate').to.be.null;
});

it('derives a live tokens/sec figure from token-count and elapsed time once a full second has passed', async () => {
  const el = (await fixture(html`<lyra-generation-status></lyra-generation-status>`)) as LyraGenerationStatus;
  el.tokenCount = 100;
  el.startedAt = Date.now() - 2000;
  el.active = true;
  await el.updateComplete;

  const text = throughputText(el);
  expect(text).to.match(/^\d+(\.\d+)? tok\/s$/);
  const value = Number(text!.replace(' tok/s', ''));
  // ~100 tokens / ~2s == ~50 tok/s, generous tolerance for real-clock jitter.
  expect(value).to.be.closeTo(50, 10);
});

it('omits both optional segments when neither token-count nor tokens-per-second is set', async () => {
  const el = (await fixture(html`<lyra-generation-status active></lyra-generation-status>`)) as LyraGenerationStatus;
  expect(tokensText(el)).to.be.null;
  expect(throughputText(el)).to.be.null;
});

it('clears the ticker on disconnect so it cannot keep updating a detached element', async () => {
  const el = (await fixture(html`<lyra-generation-status active></lyra-generation-status>`)) as LyraGenerationStatus;
  el.remove();
  // Purely a "must not throw" / no-leaked-timer-crash check -- there is
  // nothing externally observable left on a detached, un-rendered element.
  await aTimeout(1150);
  expect(el.isConnected).to.be.false;
});

it('resumes the ticker after being disconnected and reconnected while still active, instead of freezing forever', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement('lyra-generation-status') as LyraGenerationStatus;
  el.active = true;
  container.append(el);
  await el.updateComplete;

  // Re-parent: a virtualized/reordering list would do exactly this --
  // remove then immediately re-append the same element, with `active`
  // never toggling in between.
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
    'the ticker must keep advancing after a reconnect, not stay frozen at its pre-disconnect reading',
  ).to.be.greaterThan(before + 0.5);
});

it('carries no role="status"/aria-live of its own -- see the class doc for why a per-second tick must not be announced', async () => {
  const el = (await fixture(html`<lyra-generation-status active></lyra-generation-status>`)) as LyraGenerationStatus;
  expect(el.getAttribute('role')).to.be.null;
  expect(el.getAttribute('aria-live')).to.be.null;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('role')).to.be.null;
  expect(base.getAttribute('aria-live')).to.be.null;
});

it('is accessible in the default idle state', async () => {
  const el = (await fixture(html`<lyra-generation-status></lyra-generation-status>`)) as LyraGenerationStatus;
  await expect(el).to.be.accessible();
});

it('is accessible while active with tokens, throughput, and the stop button all showing', async () => {
  const el = (await fixture(html`
    <lyra-generation-status
      .active=${true}
      token-count="340"
      tokens-per-second="27"
      .startedAt=${Date.now() - 12300}
    ></lyra-generation-status>
  `)) as LyraGenerationStatus;
  expect(tokensText(el)).to.equal('340 tokens');
  expect(throughputText(el)).to.equal('27 tok/s');
  await expect(el).to.be.accessible();
});
