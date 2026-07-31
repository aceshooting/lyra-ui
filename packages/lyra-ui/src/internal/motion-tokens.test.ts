import { fixture, expect, html } from '@open-wc/testing';
import '../components/data/flow-node/flow-node.js';
import '../components/data/flow-canvas/flow-canvas.js';
import '../components/agent-tools/span-waterfall/span-waterfall.js';

/**
 * The motion tokens used to fuse a duration and an easing into one value
 * (`--lr-transition-ambient: 1.8s ease-in-out`). That reads fine in a `transition:` shorthand, but
 * an `animation:` shorthand that also names its own timing function expands to *two* timing
 * functions — invalid CSS, so the browser drops the entire shorthand and the animation never runs.
 * Four component stylesheets shipped that way.
 *
 * The fix is a separate `--lr-duration-*` and `--lr-easing-*` axis, with the compound tokens
 * derived from them so existing `transition:` usage is unaffected. These tests assert the rendered
 * result — a real, non-zero `animationName`/`animationDuration` — because the failure mode is
 * precisely a declaration that parses in the stylesheet and evaporates at computed-value time.
 */

const animationOf = (host: Element, selector: string): CSSStyleDeclaration | null => {
  const node = host.shadowRoot!.querySelector(selector);
  return node ? getComputedStyle(node) : null;
};

it('declares duration and easing as independent tokens', async () => {
  const el = (await fixture(html`<lr-flow-node heading="Fetch"></lr-flow-node>`)) as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await el.updateComplete;
  const style = getComputedStyle(el);
  for (const token of ['--lr-duration-fast', '--lr-duration-base', '--lr-duration-ambient']) {
    expect(style.getPropertyValue(token).trim(), token).to.not.equal('');
  }
  for (const token of ['--lr-easing-standard', '--lr-easing-emphasized', '--lr-easing-linear']) {
    expect(style.getPropertyValue(token).trim(), token).to.not.equal('');
  }
});

it('keeps the compound transition tokens working, derived from the split ones', async () => {
  const el = (await fixture(html`<lr-flow-node heading="Fetch"></lr-flow-node>`)) as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await el.updateComplete;
  const style = getComputedStyle(el);
  for (const token of ['--lr-transition-fast', '--lr-transition-base', '--lr-transition-ambient']) {
    const value = style.getPropertyValue(token).trim();
    expect(value, token).to.not.equal('');
    // Still a duration plus an easing, so every existing `transition:` shorthand is unaffected.
    expect(value.split(/\s+/).length, token).to.be.greaterThan(1);
  }
});

it('actually runs the flow-node running-state pulse', async () => {
  const el = (await fixture(
    html`<lr-flow-node heading="Fetch" status="running"></lr-flow-node>`,
  )) as HTMLElement & { updateComplete: Promise<unknown> };
  await el.updateComplete;
  const style = animationOf(el, '[part~="card"]');
  expect(style, 'flow-node card').to.not.equal(null);
  // An invalid shorthand leaves animationName at `none`.
  expect(style!.animationName).to.not.equal('none');
  expect(style!.animationDuration).to.not.equal('0s');
});
