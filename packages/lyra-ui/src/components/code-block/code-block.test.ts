import { fixture, expect, html, waitUntil, oneEvent } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import './code-block.js';
import type { LyraCodeBlock } from './code-block.js';
import type { ShikiHighlighter } from './code-loader.js';

type Internals = {
  highlighter?: ShikiHighlighter | null;
  highlightedHtml: string | null;
  shikiReady: boolean;
  syncHighlight(): void;
};

function internalsOf(el: LyraCodeBlock): Internals {
  return el as unknown as Internals;
}

const jsSample = 'const x = 1;';

it('defaults to no language/filename, collapsible=false, collapsed=false, copyable=true, no max-height', async () => {
  const el = (await fixture(html`<lyra-code-block></lyra-code-block>`)) as LyraCodeBlock;
  expect(el.code).to.equal('');
  expect(el.language).to.equal('');
  expect(el.filename).to.equal('');
  expect(el.collapsible).to.be.false;
  expect(el.collapsed).to.be.false;
  expect(el.copyable).to.be.true;
  expect(el.maxHeight).to.equal('');
});

it('renders plain <pre><code> immediately, HTML-escaped, when language is unset — no skeleton, no shiki wait', async () => {
  const el = (await fixture(
    html`<lyra-code-block .code=${'<script>alert(1)</script>'}></lyra-code-block>`,
  )) as LyraCodeBlock;
  expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.not.exist;
  const pre = el.shadowRoot!.querySelector('[part="pre"]');
  const code = el.shadowRoot!.querySelector('[part="code"]');
  expect(pre).to.exist;
  expect(code).to.exist;
  // Lit's normal text binding escapes this -- no raw <script> tag should
  // ever land in the rendered DOM.
  expect(code!.querySelector('script')).to.not.exist;
  expect(code!.textContent).to.equal('<script>alert(1)</script>');
});

it('shows filename and language as visible header text when set', async () => {
  const el = (await fixture(
    html`<lyra-code-block filename="app.ts" language="typescript" .code=${jsSample}></lyra-code-block>`,
  )) as LyraCodeBlock;
  expect(el.shadowRoot!.querySelector('[part="filename"]')!.textContent!.trim()).to.equal('app.ts');
  expect(el.shadowRoot!.querySelector('[part="language"]')!.textContent!.trim()).to.equal('typescript');
});

it('renders no header at all when there is nothing to put in it', async () => {
  const el = (await fixture(
    html`<lyra-code-block .copyable=${false} .code=${jsSample}></lyra-code-block>`,
  )) as LyraCodeBlock;
  expect(el.shadowRoot!.querySelector('[part="header"]')).to.not.exist;
});

it('gives compact header controls the shared minimum hit area', async () => {
  const el = (await fixture(
    html`<lyra-code-block collapsible copyable .code=${jsSample}></lyra-code-block>`,
  )) as LyraCodeBlock;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  const copy = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLElement;

  expect(getComputedStyle(toggle).minInlineSize).to.equal('40px');
  expect(getComputedStyle(toggle).minBlockSize).to.equal('40px');
  expect(getComputedStyle(copy).minInlineSize).to.equal('40px');
  expect(getComputedStyle(copy).minBlockSize).to.equal('40px');
});

describe('shiki highlighting (real peer)', () => {
  it('shows a loading skeleton and aria-busy while shiki loads for a set language, then swaps to highlighted output', async function () {
    this.timeout(20_000);
    const el = (await fixture(
      html`<lyra-code-block language="javascript" .code=${jsSample}></lyra-code-block>`,
    )) as LyraCodeBlock;
    expect(el.getAttribute('aria-busy')).to.equal('true');
    expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="pre"] span')).to.not.exist;

    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="pre"] span') !== null,
      'highlighted output never appeared',
      { timeout: 8000 },
    );

    expect(el.hasAttribute('aria-busy')).to.be.false;
    expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.not.exist;
    const pre = el.shadowRoot!.querySelector('[part="pre"]')!;
    expect(pre.querySelector('[part="code"]')).to.exist;
    // partTransformer strips shiki's own tabindex="0" -- [part="body"] is
    // the single scrollable/focusable region instead.
    expect(pre.hasAttribute('tabindex')).to.be.false;
  });

  it('re-highlights when code changes for an already-loaded language', async () => {
    const el = (await fixture(
      html`<lyra-code-block language="javascript" .code=${jsSample}></lyra-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="pre"] span') !== null, undefined, {
      timeout: 8000,
    });

    el.code = 'const totallyDifferentIdentifier = 42;';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.contain('totallyDifferentIdentifier');
  });

  it('lazily loads a second language on demand rather than bundling every grammar up front', async () => {
    const el = (await fixture(
      html`<lyra-code-block language="python" .code=${'def f():\n    return 1\n'}></lyra-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="pre"] span') !== null, undefined, {
      timeout: 8000,
    });
    expect(internalsOf(el).highlighter!.getLoadedLanguages()).to.include('python');
  });

  it('does not let a superseded async grammar load overwrite a later synchronous highlight', async () => {
    const el = (await fixture(
      html`<lyra-code-block language="javascript" .code=${jsSample}></lyra-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="pre"] span') !== null, undefined, {
      timeout: 8000,
    });

    const internals = internalsOf(el);
    const hl = internals.highlighter!;

    // Switch to a language whose grammar isn't loaded yet -- kicks off an
    // async load in syncHighlight()'s async branch.
    el.language = 'rust';
    await el.updateComplete;

    // Immediately switch back to the already-loaded language before that
    // load resolves -- takes syncHighlight()'s synchronous branch and
    // renders correct output right away.
    el.language = 'javascript';
    await el.updateComplete;
    const correctHtml = internals.highlightedHtml;
    expect(correctHtml).to.not.equal(null);

    // Let the superseded rust load actually finish, then give its `.then`
    // callback a turn to run.
    await waitUntil(() => hl.getLoadedLanguages().includes('rust'), 'rust grammar never finished loading', {
      timeout: 8000,
    });
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The stale rust-tokenized result must never clobber the correct,
    // already-rendered javascript output.
    expect(internals.highlightedHtml).to.equal(correctHtml);
    expect(el.language).to.equal('javascript');
  });
});

describe('languages (fine-grained shiki opt-in)', () => {
  it('highlights a language using a pre-supplied grammar from `languages`', async () => {
    const el = (await fixture(
      html`<lyra-code-block
        language="json"
        .languages=${{ json: jsonGrammar }}
        .code=${'{"a":1}'}
      ></lyra-code-block>`,
    )) as LyraCodeBlock;

    await waitUntil(() => el.shadowRoot!.querySelector('[part="pre"] span') !== null, undefined, {
      timeout: 8000,
    });
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.equal('{"a":1}');
  });

  it('never shows the loading skeleton for a language covered by `languages`, even before shiki\'s shared singleton has resolved', async () => {
    const el = (await fixture(
      html`<lyra-code-block
        language="json"
        .languages=${{ json: jsonGrammar }}
        .code=${'{"a":1}'}
      ></lyra-code-block>`,
    )) as LyraCodeBlock;
    // Assert synchronously, right after the first render -- the whole point
    // is that this doesn't depend on `loadShikiHighlighter()`'s singleton
    // ever resolving at all.
    expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.not.exist;
    expect(el.hasAttribute('aria-busy')).to.be.false;
  });

  it('still falls back to the ordinary dynamic loadLanguage() path for a language absent from `languages`', async () => {
    const el = (await fixture(
      html`<lyra-code-block
        language="python"
        .languages=${{ json: jsonGrammar }}
        .code=${'def f():\n    return 1\n'}
      ></lyra-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="pre"] span') !== null, undefined, {
      timeout: 8000,
    });
    expect(internalsOf(el).highlighter!.getLoadedLanguages()).to.include('python');
  });
});

describe('fallback matrix (reaching into private state to exercise both paths deterministically)', () => {
  it('falls back to plain text when the shiki peer failed to load, even though language is set', async () => {
    const el = (await fixture(
      html`<lyra-code-block language="javascript" .code=${jsSample}></lyra-code-block>`,
    )) as LyraCodeBlock;
    const internals = internalsOf(el);
    internals.highlighter = null;
    internals.syncHighlight();
    await el.updateComplete;

    expect(internals.highlightedHtml).to.equal(null);
    expect(el.shadowRoot!.querySelector('[part="pre"] span')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.equal(jsSample);
  });

  it('falls back to plain text for an unrecognized language even though the highlighter loaded fine', async () => {
    const el = (await fixture(
      html`<lyra-code-block language="not-a-real-language-xyz" .code=${jsSample}></lyra-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => internalsOf(el).shikiReady, 'shiki never finished loading', { timeout: 8000 });
    await el.updateComplete;

    expect(internalsOf(el).highlightedHtml).to.equal(null);
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.equal(jsSample);
  });
});

describe('copy button', () => {
  it('fires lyra-copy with the raw code (not highlighted HTML) and writes it to the clipboard', async () => {
    const writes: string[] = [];
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (text: string) => (writes.push(text), Promise.resolve()) },
      configurable: true,
    });

    try {
      const el = (await fixture(html`<lyra-code-block .code=${jsSample}></lyra-code-block>`)) as LyraCodeBlock;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;

      const listener = oneEvent(el, 'lyra-copy');
      button.click();
      const { detail } = await listener;
      expect(detail).to.deep.equal({ text: jsSample });
      expect(writes).to.deep.equal([jsSample]);
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
    }
  });

  it('fires lyra-copy even when navigator.clipboard is unavailable', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

    try {
      const el = (await fixture(html`<lyra-code-block .code=${jsSample}></lyra-code-block>`)) as LyraCodeBlock;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;

      const listener = oneEvent(el, 'lyra-copy');
      button.click();
      const { detail } = await listener;
      expect(detail).to.deep.equal({ text: jsSample });
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
    }
  });

  it('shows a transient "Copied!" confirmation label after copying', async () => {
    const el = (await fixture(html`<lyra-code-block .code=${jsSample}></lyra-code-block>`)) as LyraCodeBlock;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    expect(button.textContent!.trim()).to.equal('Copy');

    button.click();
    await el.updateComplete;
    expect(button.textContent!.trim()).to.equal('Copied!');
  });

  it('does not render a copy button when copyable is false', async () => {
    const el = (await fixture(
      html`<lyra-code-block .copyable=${false} .code=${jsSample} filename="x.ts"></lyra-code-block>`,
    )) as LyraCodeBlock;
    expect(el.shadowRoot!.querySelector('[part="copy-button"]')).to.not.exist;
  });
});

describe('collapsible / collapsed', () => {
  it('renders no toggle when collapsible is false, and the body is always visible', async () => {
    const el = (await fixture(html`<lyra-code-block .code=${jsSample}></lyra-code-block>`)) as LyraCodeBlock;
    expect(el.shadowRoot!.querySelector('[part="toggle"]')).to.not.exist;
    expect((el.shadowRoot!.querySelector('[part="body"]') as HTMLElement).hidden).to.be.false;
  });

  it('hides the body when collapsible and collapsed, and toggling the header button flips it', async () => {
    const el = (await fixture(
      html`<lyra-code-block collapsible collapsed .code=${jsSample}></lyra-code-block>`,
    )) as LyraCodeBlock;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    expect(body.hidden).to.be.true;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(toggle.getAttribute('aria-controls')).to.equal(body.id);

    toggle.click();
    await el.updateComplete;
    expect(el.collapsed).to.be.false;
    expect(body.hidden).to.be.false;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');

    toggle.click();
    await el.updateComplete;
    expect(el.collapsed).to.be.true;
    expect(body.hidden).to.be.true;
  });

  it('gives every instance a collision-safe body id', async () => {
    const a = (await fixture(html`<lyra-code-block collapsible></lyra-code-block>`)) as LyraCodeBlock;
    const b = (await fixture(html`<lyra-code-block collapsible></lyra-code-block>`)) as LyraCodeBlock;
    const bodyA = a.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const bodyB = b.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    expect(bodyA.id).to.not.equal('');
    expect(bodyA.id).to.not.equal(bodyB.id);
  });

  it('toggles collapsed and fires lyra-toggle on header click', async () => {
    const el = (await fixture(
      html`<lyra-code-block collapsible .code=${jsSample}></lyra-code-block>`,
    )) as LyraCodeBlock;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;

    let firing = oneEvent(el, 'lyra-toggle');
    toggle.click();
    let event = await firing;
    await el.updateComplete;
    expect(el.collapsed).to.be.true;
    expect((event as CustomEvent).detail).to.deep.equal({ collapsed: true });

    firing = oneEvent(el, 'lyra-toggle');
    toggle.click();
    event = await firing;
    await el.updateComplete;
    expect(el.collapsed).to.be.false;
    expect((event as CustomEvent).detail).to.deep.equal({ collapsed: false });
  });
});

it('applies max-height as a CSS custom property on the body', async () => {
  const el = (await fixture(
    html`<lyra-code-block max-height="10rem" .code=${jsSample}></lyra-code-block>`,
  )) as LyraCodeBlock;
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(body.style.getPropertyValue('--lyra-code-block-max-height').trim()).to.equal('10rem');
});

describe('accessibility', () => {
  it('is accessible in the plain-fallback path (no language set)', async () => {
    const el = (await fixture(
      html`<lyra-code-block filename="notes.txt" .code=${jsSample}></lyra-code-block>`,
    )) as LyraCodeBlock;
    await expect(el).to.be.accessible();
  });

  it('is accessible once shiki has highlighted the code', async () => {
    const el = (await fixture(
      html`<lyra-code-block filename="app.js" language="javascript" .code=${jsSample}></lyra-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="pre"] span') !== null, undefined, {
      timeout: 8000,
    });
    await expect(el).to.be.accessible();
  });

  it('is accessible when collapsible and collapsed', async () => {
    const el = (await fixture(
      html`<lyra-code-block collapsible collapsed filename="x.ts" .code=${jsSample}></lyra-code-block>`,
    )) as LyraCodeBlock;
    await expect(el).to.be.accessible();
  });
});
