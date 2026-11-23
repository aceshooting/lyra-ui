import { expect, fixture, html } from '@open-wc/testing';
import { expectDevWarning } from '../../test/expected-dev-warnings.js';
import { toRgba } from '../../test/color-contrast.js';

// A page without theme.css or tokens-root.css. This file must not import a Lyra module statically:
// the first registration, in `before`, is what starts loading the layer text.
// Mode-attribute fixtures without theme.css exercise the missing-resolver diagnostic on purpose.
expectDevWarning('lyra-style:resolver');

const LAYER_TEXT = /\/document-token-css\.generated\.[jt]s$/;
const read = (element: Element, name: string) => getComputedStyle(element).getPropertyValue(name).trim();
const surfaceOf = (element: Element) => toRgba(read(element, '--lr-color-surface'));
const layerFetches = () => performance.getEntriesByType('resource').filter((entry) => LAYER_TEXT.test(new URL(entry.name).pathname)).length;

type Updating = HTMLElement & { hasUpdated: boolean; updateComplete: Promise<boolean> };

let tokens: typeof import('./document-tokens.js');
let SENTINEL: string;
let pendingAtRegistration: Promise<void> | undefined;
/** No probe had updated a few microtasks after connecting, while the text was still on its way. */
let heldWhileLoading = false;
/** The resolved spacing token each probe saw in its first update. */
const firstPaintSpacing: string[] = [];

function ownLayerSheets(root: Document | ShadowRoot): CSSStyleSheet[] {
  return root.adoptedStyleSheets.filter((sheet) => Array.from(sheet.cssRules).some((rule) => rule.cssText.includes(SENTINEL)));
}

describe('document token layer: fallback without a stylesheet', () => {
  let probes: Updating[] = [];

  before(async () => {
    tokens = await import('./document-tokens.js');
    ({ DOCUMENT_TOKEN_SENTINEL: SENTINEL } = await import('./document-tokens.generated.js'));
    const { LyraElement } = await import('./lyra-element.js');
    const { tag } = await import('./prefix.js');
    class PaintProbe extends LyraElement {
      protected override firstUpdated(): void {
        firstPaintSpacing.push(read(document.documentElement, '--lr-space-m'));
      }
    }
    customElements.define(tag('fallback-paint-probe'), PaintProbe);
    // Registration primes the document: the text is requested now, and is still on its way.
    pendingAtRegistration = tokens.lyraTokenLayerPending();
    const name = tag('fallback-paint-probe');
    probes = [1, 2, 3].map(() => document.createElement(name) as Updating);
    document.body.append(...probes);
    let settled = false;
    void pendingAtRegistration?.then(() => { settled = true; });
    // Lit would have run each first update by now; the text needs a network round trip.
    for (let turn = 0; turn < 3; turn++) await Promise.resolve();
    heldWhileLoading = !settled && probes.every((probe) => !probe.hasUpdated);
  });

  after(() => {
    for (const probe of probes) probe.remove();
  });

  it('adopts one empty copy at registration and holds every first update until the text arrives', async () => {
    expect(pendingAtRegistration, 'registration requested the layer text').to.be.instanceOf(Promise);
    expect(heldWhileLoading).to.equal(true);
    expect(document.adoptedStyleSheets.length).to.be.at.least(1);
    await pendingAtRegistration;
    await Promise.all(probes.map((probe) => probe.updateComplete));
    expect(firstPaintSpacing).to.deep.equal(['0.75rem', '0.75rem', '0.75rem']);
    expect(ownLayerSheets(document).length).to.equal(1);
    expect(tokens.hasLyraTokens(document)).to.equal(true);
  });

  it('loads the text once for many components and fills later copies synchronously', async () => {
    await import('../components/lr-switch.js');
    await import('../components/lr-card.js');
    await fixture(html`<div><lr-switch>A</lr-switch><lr-switch>B</lr-switch><lr-card>C</lr-card></div>`);
    expect(tokens.lyraTokenLayerPending()).to.equal(undefined);
    expect(ownLayerSheets(document).length).to.equal(1);
    expect(layerFetches()).to.equal(1);
    // A document an element moves into (an iframe) gets its own copy, filled synchronously.
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const inner = document.createElement('lr-switch');
      frame.contentDocument!.body.append(inner);
      expect(tokens.lyraTokenLayerPending()).to.equal(undefined);
      expect(ownLayerSheets(frame.contentDocument!).length).to.equal(1);
      expect(read(frame.contentDocument!.documentElement, '--lr-space-m')).to.equal('0.75rem');
    } finally {
      frame.remove();
    }
    expect(layerFetches()).to.equal(1);
  });

  it('switches mode through the adopted copy', async () => {
    const wrapper = await fixture(html`<div><lr-switch>Dark</lr-switch></div>`);
    const element = wrapper.querySelector('lr-switch')!;
    expect(surfaceOf(element)).to.deep.equal([255, 255, 255, 255]);
    wrapper.setAttribute('data-lr-mode', 'dark');
    expect(surfaceOf(element)).to.deep.equal([10, 10, 10, 255]);
  });

  it('withdraws its copy when a stylesheet provides the layer later', async () => {
    const { DOCUMENT_TOKEN_CSS } = await import('./document-token-css.generated.js');
    const style = document.createElement('style');
    style.textContent = DOCUMENT_TOKEN_CSS;
    document.head.append(style);
    try {
      tokens.adoptLyraTokens(document);
      expect(ownLayerSheets(document).length).to.equal(0);
      expect(tokens.hasLyraTokens(document)).to.equal(true);
    } finally {
      style.remove();
      tokens.adoptLyraTokens(document);
    }
    expect(ownLayerSheets(document).length).to.equal(1);
  });
});
