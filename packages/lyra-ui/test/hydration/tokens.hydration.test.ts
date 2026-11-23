import { html, ssrFixture } from '../wtr-ssr-fixture.js';
import { expect } from '@open-wc/testing';
import { fetchedModule } from '../resource-entries.js';

// The token layer on server-rendered pages: linked in <head> before any Lyra module evaluates, the
// layer text is never imported; once the link is gone, the fallback loads it and hydration still
// adopts the server DOM. One page, in this order, because the module state is per page.

interface DocumentTokens {
  lyraTokenLayerPending(): Promise<void> | undefined;
  hasLyraTokens(root: Document | ShadowRoot): boolean;
}

const LAYER_TEXT = '/dist/internal/document-token-css.generated.js';
const CONTROL = '/dist/internal/document-tokens.generated.js';
// The built stylesheets are minified (`.75rem`); the constructed copy keeps the source text.
const space = (element: Element) => parseFloat(getComputedStyle(element).getPropertyValue('--lr-space-m'));
const tokensModule = '/dist/internal/document-tokens.js';

describe('document token layer on hydrated pages', () => {
  const link = document.createElement('link');
  let tokens: DocumentTokens;

  before(async () => {
    link.rel = 'stylesheet';
    link.href = '/dist/styles/tokens-root.css';
    await new Promise<unknown>((resolve, reject) => {
      link.onload = resolve;
      link.onerror = reject;
      document.head.append(link);
    });
  });

  after(() => link.remove());

  it('hydrates beside a linked tokens-root.css without importing the layer text', async () => {
    const element = await ssrFixture(html`<lr-switch checked>Wi-Fi</lr-switch>`);
    tokens = (await import(tokensModule)) as DocumentTokens;
    expect(tokens.lyraTokenLayerPending()).to.equal(undefined);
    expect(tokens.hasLyraTokens(document)).to.equal(true);
    expect(space(element)).to.equal(0.75);
    expect(fetchedModule(LAYER_TEXT, { control: CONTROL })).to.equal(false);
  });

  it('hydrates through the fallback once no stylesheet provides the layer', async () => {
    link.remove();
    const element = await ssrFixture(html`<lr-checkbox checked>Accept</lr-checkbox>`);
    expect(tokens.lyraTokenLayerPending()).to.equal(undefined);
    expect(tokens.hasLyraTokens(document)).to.equal(true);
    expect(space(element)).to.equal(0.75);
    expect(fetchedModule(LAYER_TEXT)).to.equal(true);
  });
});
