import { fixture, expect, html } from '@open-wc/testing';
import '../components/data/flow-node/flow-node.js';
import '../components/data/flow-run-status/flow-run-status.js';
import '../components/data/stat/stat.js';

/**
 * A `var(--lr-…)` naming a token that is never declared, with no fallback, is not a style that
 * "falls back" — the whole declaration is dropped at parse time and the property silently keeps
 * whatever it inherited. Nothing in the toolchain sees it: the CSS parses, the manifest is happy,
 * and the component just renders wrong. `scripts/check-token-references.mjs` gates the whole
 * library; these are the rendered-result assertions for the cases that were shipping broken.
 *
 * Asserting "not the inherited colour" is not enough here — these hosts set their own `color`, so a
 * dropped declaration inherits *that* and the assertion passes while the bug is live. Each test
 * therefore resolves the token it is supposed to be using and demands an exact match.
 */

const computedOf = (root: Element, part: string): CSSStyleDeclaration =>
  getComputedStyle(root.shadowRoot!.querySelector(`[part~="${part}"]`)!);

/**
 * The colour a `--lr-*` token resolves to *for this element* — the tokens are declared on each
 * component's own `:host`, not on the document, so a probe appended to `<body>` would resolve them
 * to nothing. Read the custom property off the host, then normalise it through a probe so the
 * comparison is rgb-vs-rgb rather than string-vs-string.
 */
function resolvedColorFor(host: Element, token: string): string {
  const raw = getComputedStyle(host).getPropertyValue(token).trim();
  expect(raw, `${token} resolves to nothing on ${host.localName}`).to.not.equal('');
  const probe = document.createElement('span');
  probe.style.color = raw;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

it('paints the flow-node status row with the quiet-text token', async () => {
  const el = (await fixture(
    html`<lr-flow-node heading="Fetch" status="running"></lr-flow-node>`,
  )) as HTMLElement & { updateComplete: Promise<unknown> };
  await el.updateComplete;
  expect(computedOf(el, 'status').color).to.equal(resolvedColorFor(el, '--lr-color-text-quiet'));
});

it('paints the flow-run-status counts with the quiet-text token', async () => {
  const el = (await fixture(html`
    <lr-flow-run-status
      .decorations=${{ a: { status: 'done' }, b: { status: 'running' } }}
    ></lr-flow-run-status>
  `)) as HTMLElement & { updateComplete: Promise<unknown> };
  await el.updateComplete;
  expect(computedOf(el, 'count').color).to.equal(resolvedColorFor(el, '--lr-color-text-quiet'));
});

it('resolves the elevation token lr-stat reaches for on hover', async () => {
  // The shadow only paints on a linked card's `:hover`, which script cannot enter — so the
  // rendered-result assertion is that the token itself resolves to a real value on the host. An
  // undeclared token computes to the empty string, which is exactly the dropped-declaration state.
  const el = (await fixture(
    html`<lr-stat label="Runs" value="42" href="#runs"></lr-stat>`,
  )) as HTMLElement & { updateComplete: Promise<unknown> };
  await el.updateComplete;
  expect(getComputedStyle(el).getPropertyValue('--lr-shadow').trim()).to.not.equal('');
});
