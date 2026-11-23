import { expect, fixture, html } from '@open-wc/testing';
import { fetchedModule } from '../../test/resource-entries.js';
import { expectDevWarning } from '../../test/expected-dev-warnings.js';
import { toRgba } from '../../test/color-contrast.js';
import { tag } from './prefix.js';

// A page that links tokens-root.css in <head> before any Lyra module evaluates. This file must not
// import a Lyra module statically: every one of them is loaded after the stylesheet, in `before`.
// Mode-attribute fixtures without theme.css exercise the missing-resolver diagnostic on purpose.
expectDevWarning('lyra-style:resolver');

const LAYER_TEXT = /\/document-token-css\.generated\.[jt]s$/;
const CONTROL = /\/document-tokens\.generated\.[jt]s$/;
const read = (element: Element, name: string) => getComputedStyle(element).getPropertyValue(name).trim();
const surfaceOf = (element: Element) => toRgba(read(element, '--lr-color-surface'));

let tokens: typeof import('./document-tokens.js');
let SENTINEL: string;

function ownLayerSheets(root: Document | ShadowRoot): CSSStyleSheet[] {
  return root.adoptedStyleSheets.filter((sheet) => Array.from(sheet.cssRules).some((rule) => rule.cssText.includes(SENTINEL)));
}

describe('document token layer: beside a linked stylesheet', () => {
  before(async () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../styles/tokens-root.css', import.meta.url).href;
    await new Promise<unknown>((resolve, reject) => {
      link.onload = resolve;
      link.onerror = reject;
      document.head.append(link);
    });
    tokens = await import('./document-tokens.js');
    ({ DOCUMENT_TOKEN_SENTINEL: SENTINEL } = await import('./document-tokens.generated.js'));
    await import('../components/lr-switch.js');
    await import('../components/lr-card.js');
  });

  it('registers and renders without importing the layer text or adopting a copy', async () => {
    const element = await fixture(html`<lr-switch>Wi-Fi</lr-switch>`);
    await fixture(html`<lr-card>Card</lr-card>`);
    expect(tokens.lyraTokenLayerPending()).to.equal(undefined);
    expect(tokens.hasLyraTokens(document)).to.equal(true);
    expect(ownLayerSheets(document).length).to.equal(0);
    expect(read(element, '--lr-space-m')).to.equal('0.75rem');
    expect(fetchedModule(LAYER_TEXT, { control: CONTROL })).to.equal(false);
  });

  it('switches mode through the linked layer', async () => {
    const wrapper = await fixture(html`<div><lr-switch>Dark</lr-switch></div>`);
    const element = wrapper.querySelector(tag('switch'))!;
    expect(surfaceOf(element)).to.deep.equal([255, 255, 255, 255]);
    wrapper.setAttribute('data-lr-mode', 'dark');
    expect(surfaceOf(element)).to.deep.equal([10, 10, 10, 255]);
    expect(fetchedModule(LAYER_TEXT, { control: CONTROL })).to.equal(false);
  });

  it('derives the Chromium root key from the linked sheet, without the layer text', async function () {
    const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands;
    if (!brands?.some((entry) => entry.brand === 'Chromium')) this.skip();
    await fixture(html`<lr-switch>Key</lr-switch>`);
    const root = document.documentElement;
    root.setAttribute('data-token-key-probe', '');
    try {
      // The observer delivers before the next rendering.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const key = document.adoptedStyleSheets.find((sheet) => Array.from(sheet.cssRules).some((rule) => rule.cssText.includes('--_lr-root-inputs')));
      expect(key, 'the key is adopted at the first root change').to.not.equal(undefined);
      expect(key!.cssRules[0]!.cssText).to.contain('var(--lr-theme-');
      expect(fetchedModule(LAYER_TEXT, { control: CONTROL })).to.equal(false);
    } finally {
      root.removeAttribute('data-token-key-probe');
    }
  });

  // Last: it is the one path that needs the text beside a document provider.
  it('loads the text once for an application shadow root scope that has no provider of its own', async () => {
    const host = await fixture(html`<div></div>`);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<div class="lr-dark"><${tag('switch')}>A</${tag('switch')}><${tag('switch')}>B</${tag('switch')}></div>`;
    const pending = tokens.lyraTokenLayerPending();
    expect(pending, 'the root copy waits for the text').to.be.instanceOf(Promise);
    await pending;
    const [first, second] = Array.from(root.querySelectorAll(tag('switch'))) as (HTMLElement & { updateComplete: Promise<boolean> })[];
    await Promise.all([first!.updateComplete, second!.updateComplete]);
    expect(ownLayerSheets(root).length).to.equal(1);
    expect(ownLayerSheets(document).length, 'the document keeps its linked provider').to.equal(0);
    expect(surfaceOf(first!)).to.deep.equal([10, 10, 10, 255]);
    expect(performance.getEntriesByType('resource').filter((entry) => LAYER_TEXT.test(new URL(entry.name).pathname)).length).to.equal(1);
  });
});
