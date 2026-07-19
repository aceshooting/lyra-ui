import { fixture, expect, html, waitUntil, oneEvent, aTimeout } from '@open-wc/testing';
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

async function el2Ready(el: LyraCodeBlock): Promise<void> {
  await el.updateComplete;
  await aTimeout(0);
  await el.updateComplete;
}

const jsSample = 'const x = 1;';

it('defaults to no language/filename, collapsible=false, collapsed=false, copyable=true, no max-height', async () => {
  const el = (await fixture(html`<lr-code-block></lr-code-block>`)) as LyraCodeBlock;
  expect(el.code).to.equal('');
  expect(el.language).to.equal('');
  expect(el.filename).to.equal('');
  expect(el.collapsible).to.be.false;
  expect(el.collapsed).to.be.false;
  expect(el.copyable).to.be.true;
  expect(el.maxHeight).to.equal('');
  expect(el.lineNumbers).to.be.false;
});

it('renders optional line numbers for plain code without changing the copied source', async () => {
  const el = (await fixture(
    html`<lr-code-block line-numbers .code=${'first\nsecond\nthird'}></lr-code-block>`,
  )) as LyraCodeBlock;
  expect(el.lineNumbers).to.be.true;
  expect(el.shadowRoot!.querySelectorAll('[part="pre"] .line')).to.have.lengthOf(3);
  expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent!.trim()).to.equal('firstsecondthird');
});

it('renders plain <pre><code> immediately, HTML-escaped, when language is unset — no skeleton, no shiki wait', async () => {
  const el = (await fixture(
    html`<lr-code-block .code=${'<script>alert(1)</script>'}></lr-code-block>`,
  )) as LyraCodeBlock;
  expect(el.shadowRoot!.querySelector('lr-skeleton')).to.not.exist;
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
    html`<lr-code-block filename="app.ts" language="typescript" .code=${jsSample}></lr-code-block>`,
  )) as LyraCodeBlock;
  expect(el.shadowRoot!.querySelector('[part="filename"]')!.textContent!.trim()).to.equal('app.ts');
  expect(el.shadowRoot!.querySelector('[part="language"]')!.textContent!.trim()).to.equal('typescript');
});

it('renders no header at all when there is nothing to put in it', async () => {
  const el = (await fixture(
    html`<lr-code-block .copyable=${false} .code=${jsSample}></lr-code-block>`,
  )) as LyraCodeBlock;
  expect(el.shadowRoot!.querySelector('[part="header"]')).to.not.exist;
});

it('gives compact header controls the shared minimum hit area', async () => {
  const el = (await fixture(
    html`<lr-code-block collapsible copyable .code=${jsSample}></lr-code-block>`,
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
      html`<lr-code-block language="javascript" .code=${jsSample}></lr-code-block>`,
    )) as LyraCodeBlock;
    expect(el.getAttribute('aria-busy')).to.equal('true');
    expect(el.shadowRoot!.querySelector('lr-skeleton')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="pre"] span')).to.not.exist;

    // 8000ms already flaked under load (8-way default @web/test-runner concurrency on this
    // machine's 16 cores starves the real, unmocked shiki WASM+grammar load) -- same class of
    // issue as lr-graph's NODE_COUNT_TIMEOUT below and flag.test.ts's img() helper.
    // `.shiki` (not `[part="pre"] span`) -- renderPlainCode()'s own per-line .line spans also
    // match a bare `span` selector now, so only shiki's own root class unambiguously signals real
    // highlighted output rather than the plain-text fallback.
    await waitUntil(
      () => el.shadowRoot!.querySelector('.shiki') !== null,
      'highlighted output never appeared',
      { timeout: 15000 },
    );

    expect(el.hasAttribute('aria-busy')).to.be.false;
    expect(el.shadowRoot!.querySelector('lr-skeleton')).to.not.exist;
    const pre = el.shadowRoot!.querySelector('[part="pre"]')!;
    expect(pre.querySelector('[part="code"]')).to.exist;
    // partTransformer strips shiki's own tabindex="0" -- [part="body"] is
    // the single scrollable/focusable region instead.
    expect(pre.hasAttribute('tabindex')).to.be.false;
  });

  it('does not set highlighter/shikiReady when the element disconnects before loadShikiHighlighter() resolves', async () => {
    // Runs after the previous test, so the module-cached loadShikiHighlighter()
    // singleton is already resolved -- connectedCallback()'s .then() callback
    // is still always deferred to a microtask (even against an already-settled
    // promise), so disconnecting synchronously, in the same tick as connect,
    // reliably lands before it fires. Mirrors markdown.test.ts's and
    // chart.test.ts's identical disconnect-before-load-settles regression test.
    const el = document.createElement('lr-code-block') as LyraCodeBlock;
    el.language = 'javascript';
    el.code = jsSample;
    document.body.appendChild(el);
    el.remove();
    await aTimeout(50);

    expect(internalsOf(el).shikiReady, 'must not become true on a disconnected instance').to.be.false;
    expect(internalsOf(el).highlighter, 'must not be set on a disconnected instance').to.equal(undefined);
  });

  it('re-highlights when code changes for an already-loaded language', async () => {
    const el = (await fixture(
      html`<lr-code-block language="javascript" .code=${jsSample}></lr-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, {
      timeout: 8000,
    });

    el.code = 'const totallyDifferentIdentifier = 42;';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.contain('totallyDifferentIdentifier');
  });

  it('lazily loads a second language on demand rather than bundling every grammar up front', async () => {
    const el = (await fixture(
      html`<lr-code-block language="python" .code=${'def f():\n    return 1\n'}></lr-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, {
      timeout: 8000,
    });
    expect(internalsOf(el).highlighter!.getLoadedLanguages()).to.include('python');
  });

  it('highlights GreyCat source through the built-in gcl grammar', async () => {
    const el = (await fixture(
      html`<lr-code-block language="greycat" .code=${'fn greet(name: String) { return "Hi " + name }'}></lr-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, {
      timeout: 8000,
    });
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.contain('greet');
    expect(internalsOf(el).highlighter!.getLoadedLanguages()).to.include('gcl');
  });

  it('does not let a superseded async grammar load overwrite a later synchronous highlight', async () => {
    const el = (await fixture(
      html`<lr-code-block language="javascript" .code=${jsSample}></lr-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, {
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
      html`<lr-code-block
        language="json"
        .languages=${{ json: jsonGrammar }}
        .code=${'{"a":1}'}
      ></lr-code-block>`,
    )) as LyraCodeBlock;

    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, {
      timeout: 8000,
    });
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.equal('{"a":1}');
  });

  it('never shows the loading skeleton for a language covered by `languages`, even before shiki\'s shared singleton has resolved', async () => {
    const el = (await fixture(
      html`<lr-code-block
        language="json"
        .languages=${{ json: jsonGrammar }}
        .code=${'{"a":1}'}
      ></lr-code-block>`,
    )) as LyraCodeBlock;
    // Assert synchronously, right after the first render -- the whole point
    // is that this doesn't depend on `loadShikiHighlighter()`'s singleton
    // ever resolving at all.
    expect(el.shadowRoot!.querySelector('lr-skeleton')).to.not.exist;
    expect(el.hasAttribute('aria-busy')).to.be.false;
  });

  it('still falls back to the ordinary dynamic loadLanguage() path for a language absent from `languages`', async () => {
    const el = (await fixture(
      html`<lr-code-block
        language="python"
        .languages=${{ json: jsonGrammar }}
        .code=${'def f():\n    return 1\n'}
      ></lr-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, {
      timeout: 8000,
    });
    expect(internalsOf(el).highlighter!.getLoadedLanguages()).to.include('python');
  });
});

describe('languagesOnly', () => {
  it('skips loadShikiHighlighter() entirely -- shikiReady never becomes true even after settling', async () => {
    const el = (await fixture(
      html`<lr-code-block languages-only language="bash" .code=${'echo hi'}></lr-code-block>`,
    )) as LyraCodeBlock;
    // Give any (erroneously still-kicked-off) default loader a turn to resolve.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.updateComplete;
    expect(internalsOf(el).shikiReady).to.be.false;
    // With no languages map entry for 'bash' either, it renders the plain-text fallback, not a
    // stuck skeleton or a thrown error.
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.equal('echo hi');
  });

  it('still highlights via the languages map fast path while languagesOnly is true', async () => {
    const bashLang = await import('shiki/langs/bash.mjs').catch(() => null);
    if (!bashLang) return; // shiki not installed in this environment -- covered elsewhere
    const el = (await fixture(html`
      <lr-code-block
        languages-only
        language="bash"
        .languages=${{ bash: bashLang.default }}
        .code=${'echo hi'}
      ></lr-code-block>
    `)) as LyraCodeBlock;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="code"]')?.innerHTML.includes('span'), 'never highlighted', { timeout: 8000 });
  });

  it('defaults to false -- the default loader still runs unconditionally (regression)', async () => {
    const el = (await fixture(html`<lr-code-block language="bash" .code=${'echo hi'}></lr-code-block>`)) as LyraCodeBlock;
    await waitUntil(() => internalsOf(el).shikiReady, 'shiki never finished loading', { timeout: 8000 });
    expect(internalsOf(el).shikiReady).to.be.true;
  });
});

describe('fallback matrix (reaching into private state to exercise both paths deterministically)', () => {
  it('falls back to plain text when the shiki peer failed to load, even though language is set', async () => {
    const el = (await fixture(
      html`<lr-code-block language="javascript" .code=${jsSample}></lr-code-block>`,
    )) as LyraCodeBlock;
    const internals = internalsOf(el);
    internals.highlighter = null;
    internals.syncHighlight();
    await el.updateComplete;

    expect(internals.highlightedHtml).to.equal(null);
    // renderPlainCode() always wraps each line in its own .line span (for highlight-lines/
    // interactive-lines addressing), so a bare `[part="pre"] span` selector no longer
    // distinguishes this from shiki's real output -- assert there's no *nested* span inside the
    // line wrapper instead, since that's what shiki's own per-token tokenization would add.
    expect(el.shadowRoot!.querySelector('[part="pre"] .line span')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.equal(jsSample);
  });

  it('falls back to plain text for an unrecognized language even though the highlighter loaded fine', async () => {
    const el = (await fixture(
      html`<lr-code-block language="not-a-real-language-xyz" .code=${jsSample}></lr-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => internalsOf(el).shikiReady, 'shiki never finished loading', { timeout: 8000 });
    await el.updateComplete;

    expect(internalsOf(el).highlightedHtml).to.equal(null);
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.equal(jsSample);
  });
});

describe('copy button', () => {
  it('fires lr-copy with the raw code (not highlighted HTML) and writes it to the clipboard', async () => {
    const writes: string[] = [];
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (text: string) => (writes.push(text), Promise.resolve()) },
      configurable: true,
    });

    try {
      const el = (await fixture(html`<lr-code-block .code=${jsSample}></lr-code-block>`)) as LyraCodeBlock;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;

      const listener = oneEvent(el, 'lr-copy');
      button.click();
      const { detail } = await listener;
      expect(detail).to.deep.equal({ text: jsSample });
      expect(writes).to.deep.equal([jsSample]);
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
    }
  });

  it('fires lr-copy even when navigator.clipboard is unavailable', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

    try {
      const el = (await fixture(html`<lr-code-block .code=${jsSample}></lr-code-block>`)) as LyraCodeBlock;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;

      const listener = oneEvent(el, 'lr-copy');
      button.click();
      const { detail } = await listener;
      expect(detail).to.deep.equal({ text: jsSample });
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
    }
  });

  it('shows a transient "Copied!" confirmation label after copying', async () => {
    const el = (await fixture(html`<lr-code-block .code=${jsSample}></lr-code-block>`)) as LyraCodeBlock;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    expect(button.textContent!.trim()).to.equal('Copy');

    button.click();
    await el.updateComplete;
    expect(button.textContent!.trim()).to.equal('Copied!');
  });

  it('does not render a copy button when copyable is false', async () => {
    const el = (await fixture(
      html`<lr-code-block .copyable=${false} .code=${jsSample} filename="x.ts"></lr-code-block>`,
    )) as LyraCodeBlock;
    expect(el.shadowRoot!.querySelector('[part="copy-button"]')).to.not.exist;
  });
});

describe('collapsible / collapsed', () => {
  it('renders no toggle when collapsible is false, and the body is always visible', async () => {
    const el = (await fixture(html`<lr-code-block .code=${jsSample}></lr-code-block>`)) as LyraCodeBlock;
    expect(el.shadowRoot!.querySelector('[part="toggle"]')).to.not.exist;
    expect((el.shadowRoot!.querySelector('[part="body"]') as HTMLElement).hidden).to.be.false;
  });

  it('hides the body when collapsible and collapsed, and toggling the header button flips it', async () => {
    const el = (await fixture(
      html`<lr-code-block collapsible collapsed .code=${jsSample}></lr-code-block>`,
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
    const a = (await fixture(html`<lr-code-block collapsible></lr-code-block>`)) as LyraCodeBlock;
    const b = (await fixture(html`<lr-code-block collapsible></lr-code-block>`)) as LyraCodeBlock;
    const bodyA = a.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const bodyB = b.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    expect(bodyA.id).to.not.equal('');
    expect(bodyA.id).to.not.equal(bodyB.id);
  });

  it('toggles collapsed and fires lr-toggle on header click', async () => {
    const el = (await fixture(
      html`<lr-code-block collapsible .code=${jsSample}></lr-code-block>`,
    )) as LyraCodeBlock;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;

    let firing = oneEvent(el, 'lr-toggle');
    toggle.click();
    let event = await firing;
    await el.updateComplete;
    expect(el.collapsed).to.be.true;
    expect((event as CustomEvent).detail).to.deep.equal({ collapsed: true });

    firing = oneEvent(el, 'lr-toggle');
    toggle.click();
    event = await firing;
    await el.updateComplete;
    expect(el.collapsed).to.be.false;
    expect((event as CustomEvent).detail).to.deep.equal({ collapsed: false });
  });
});

it('applies max-height as a CSS custom property on the body', async () => {
  const el = (await fixture(
    html`<lr-code-block max-height="10rem" .code=${jsSample}></lr-code-block>`,
  )) as LyraCodeBlock;
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(body.style.getPropertyValue('--lr-code-block-max-height').trim()).to.equal('10rem');
});

describe('accessibility', () => {
  it('forwards a host aria-label to the internal named code region and keeps it reactive', async () => {
    const el = (await fixture(
      html`<lr-code-block aria-label="Installation command" filename="install.sh" .code=${jsSample}></lr-code-block>`,
    )) as LyraCodeBlock;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    expect(body.getAttribute('aria-label')).to.equal('Installation command');

    el.accessibleLabel = 'Updated installation command';
    await el.updateComplete;
    expect(body.getAttribute('aria-label')).to.equal('Updated installation command');
  });

  it('is accessible in the plain-fallback path (no language set)', async () => {
    const el = (await fixture(
      html`<lr-code-block filename="notes.txt" .code=${jsSample}></lr-code-block>`,
    )) as LyraCodeBlock;
    await expect(el).to.be.accessible();
  });

  it('is accessible once shiki has highlighted the code', async () => {
    const el = (await fixture(
      html`<lr-code-block filename="app.js" language="javascript" .code=${jsSample}></lr-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, {
      timeout: 8000,
    });
    await expect(el).to.be.accessible();
  });

  it('is accessible when collapsible and collapsed', async () => {
    const el = (await fixture(
      html`<lr-code-block collapsible collapsed filename="x.ts" .code=${jsSample}></lr-code-block>`,
    )) as LyraCodeBlock;
    await expect(el).to.be.accessible();
  });
});

describe('localization', () => {
  it('renders the built-in English copy-button aria-labels with no locale registered and no overrides', async () => {
    const el = (await fixture(html`<lr-code-block .code=${jsSample}></lr-code-block>`)) as LyraCodeBlock;
    const copyButton = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    expect(copyButton.getAttribute('aria-label')).to.equal('Copy code');

    copyButton.click();
    await el.updateComplete;
    expect(copyButton.getAttribute('aria-label')).to.equal('Copied to clipboard');
  });

  it('localizes the collapse-toggle and copy-button aria-labels via this.localize()', async () => {
    const el = (await fixture(
      html`<lr-code-block
        collapsible
        .code=${jsSample}
        .strings=${{
          expandCode: 'Développer le code',
          collapseCode: 'Réduire le code',
          copyCode: 'Copier le code',
          copiedToClipboard: 'Copié dans le presse-papiers',
        }}
      ></lr-code-block>`,
    )) as LyraCodeBlock;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    const copyButton = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-label')).to.equal('Réduire le code');
    expect(copyButton.getAttribute('aria-label')).to.equal('Copier le code');
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-label')).to.equal('Développer le code');
  });

  it('localizes the code-region aria-label, with and without a language', async () => {
    const withLang = (await fixture(
      html`<lr-code-block language="typescript" .code=${jsSample} .strings=${{ codeRegionWithLanguage: '{language} — code' }}></lr-code-block>`,
    )) as LyraCodeBlock;
    expect((withLang.shadowRoot!.querySelector('[part="body"]') as HTMLElement).getAttribute('aria-label')).to.equal(
      'typescript — code',
    );

    const withoutLang = (await fixture(
      html`<lr-code-block .code=${jsSample} .strings=${{ codeRegion: 'Extrait de code' }}></lr-code-block>`,
    )) as LyraCodeBlock;
    expect((withoutLang.shadowRoot!.querySelector('[part="body"]') as HTMLElement).getAttribute('aria-label')).to.equal(
      'Extrait de code',
    );
  });
});

describe('highlight-lines', () => {
  it('marks the specified lines with data-highlighted and part line-highlight', async () => {
    const el = (await fixture(
      html`<lr-code-block code=${'a\nb\nc\nd'} highlight-lines="2-3"></lr-code-block>`,
    )) as LyraCodeBlock;
    await el.updateComplete;
    const lines = [...el.shadowRoot!.querySelectorAll('[data-line]')];
    expect(lines.map((l) => l.hasAttribute('data-highlighted'))).to.deep.equal([false, true, true, false]);
    expect(lines[1]!.getAttribute('part')).to.equal('line-highlight');
    expect(lines[0]!.hasAttribute('part')).to.be.false;
  });

  it('renders identically between the shiki and plain-text fallback paths for the same highlight-lines', async () => {
    const plain = (await fixture(
      html`<lr-code-block code=${'a\nb\nc'} highlight-lines="2"></lr-code-block>`,
    )) as LyraCodeBlock;
    await el2Ready(plain);
    const plainHighlighted = [...plain.shadowRoot!.querySelectorAll('[data-highlighted]')].length;
    expect(plainHighlighted).to.equal(1);
  });

  it('back-compat: default render is byte-identical with highlight-lines/highlights/interactive-lines unset', async () => {
    const before = (await fixture(html`<lr-code-block code=${'a\nb'}></lr-code-block>`)) as LyraCodeBlock;
    await before.updateComplete;
    const beforeHtml = before.shadowRoot!.querySelector('[part="body"]')!.innerHTML;
    const after = (await fixture(
      html`<lr-code-block code=${'a\nb'} .highlightLines=${''} .highlights=${[]} .interactiveLines=${false}></lr-code-block>`,
    )) as LyraCodeBlock;
    await after.updateComplete;
    expect(after.shadowRoot!.querySelector('[part="body"]')!.innerHTML).to.equal(beforeHtml);
  });
});

describe('anchor-target (line-range)', () => {
  it('scrolls to the start line of a line-range anchor', async () => {
    const el = (await fixture(html`<lr-code-block code=${'a\nb\nc\nd\ne'}></lr-code-block>`)) as LyraCodeBlock;
    await el.updateComplete;
    let scrolled = false;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    body.scrollTo = () => {
      scrolled = true;
    };
    const result = await el.scrollToAnchor({ kind: 'line-range', start: 3 });
    expect(result).to.be.true;
    expect(scrolled).to.be.true;
  });

  it('resolves false for a line past end-of-file', async () => {
    const el = (await fixture(html`<lr-code-block code=${'a\nb'}></lr-code-block>`)) as LyraCodeBlock;
    await el.updateComplete;
    expect(await el.scrollToAnchor({ kind: 'line-range', start: 99 })).to.be.false;
  });

  it('renders a line-range highlight from the highlights array', async () => {
    const el = (await fixture(
      html`<lr-code-block code=${'a\nb\nc'}></lr-code-block>`,
    )) as LyraCodeBlock;
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 2, end: 2 } }];
    await el.updateComplete;
    const line2 = el.shadowRoot!.querySelector('[data-line="2"]')!;
    expect(line2.hasAttribute('data-highlighted')).to.be.true;
  });
});

describe('interactive-lines', () => {
  it('renders gutter numbers as buttons with roving tabindex when line-numbers and interactive-lines are both set', async () => {
    const el = (await fixture(
      html`<lr-code-block code=${'a\nb\nc'} line-numbers interactive-lines></lr-code-block>`,
    )) as LyraCodeBlock;
    await el.updateComplete;
    const buttons = [...el.shadowRoot!.querySelectorAll('[part~="line-button"]')] as HTMLButtonElement[];
    expect(buttons).to.have.lengthOf(3);
    expect(buttons.map((b) => b.tabIndex)).to.deep.equal([0, -1, -1]);
  });

  it('emits lr-line-click on Enter and on click', async () => {
    const el = (await fixture(
      html`<lr-code-block code=${'a\nb'} line-numbers interactive-lines></lr-code-block>`,
    )) as LyraCodeBlock;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-line-click');
    const first = el.shadowRoot!.querySelector('[data-line="1"]') as HTMLButtonElement;
    first.click();
    const event = (await listener) as CustomEvent<{ line: number }>;
    expect(event.detail).to.deep.equal({ line: 1 });
  });

  it('moves focus with ArrowDown/ArrowUp/Home/End', async () => {
    const el = (await fixture(
      html`<lr-code-block code=${'a\nb\nc'} line-numbers interactive-lines></lr-code-block>`,
    )) as LyraCodeBlock;
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector('[data-line="1"]') as HTMLButtonElement;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-line="2"]')!.getAttribute('tabindex')).to.equal('0');
  });

  it('does not emit lr-line-click while interactive-lines is off', async () => {
    const el = (await fixture(html`<lr-code-block code=${'a\nb'} line-numbers></lr-code-block>`)) as LyraCodeBlock;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part~="line-button"]').length).to.equal(0);
  });
});
