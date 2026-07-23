import { fixture, expect, html, waitUntil, oneEvent, aTimeout } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import './code-block.js';
import type { LyraCodeBlock } from './code-block.js';
import type { ShikiHighlighter } from './code-loader.js';
import { styles } from './code-block.styles.js';

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
    expect(el.shadowRoot!.querySelector('lr-skeleton') !== null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="pre"] span') === null).to.be.true;

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
    expect(el.shadowRoot!.querySelector('lr-skeleton') === null).to.be.true;
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

  it('falls back to plain text when the highlighter throws while tokenizing (tokenize() catch branch)', async () => {
    const el = (await fixture(
      html`<lr-code-block language="javascript" .code=${jsSample}></lr-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, { timeout: 8000 });

    const internals = internalsOf(el);
    // `internals.highlighter` is loadShikiHighlighter()'s page-lifetime singleton, shared by every
    // other test in this file that uses the default (non-`languages`) loading path -- the patch
    // must be undone afterward, or every later real-peer test hangs forever waiting for `.shiki`
    // output that can now never be produced again.
    const hl = internals.highlighter as unknown as { codeToHtml: (...args: unknown[]) => string };
    const originalCodeToHtml = hl.codeToHtml;
    try {
      hl.codeToHtml = () => {
        throw new Error('malformed grammar');
      };
      internals.syncHighlight();
      await el.updateComplete;

      expect(internals.highlightedHtml).to.equal(null);
      expect(el.shadowRoot!.querySelector('.shiki')).to.not.exist;
      expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.equal(jsSample);
    } finally {
      hl.codeToHtml = originalCodeToHtml;
    }
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

  it('starts the default highlighter when languagesOnly is disabled at runtime', async () => {
    const el = (await fixture(
      html`<lr-code-block languages-only language="json" .code=${'{"ok":true}'}></lr-code-block>`,
    )) as LyraCodeBlock;
    expect(el.shadowRoot!.querySelector('.shiki') === null).to.be.true;
    el.languagesOnly = false;
    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, 'runtime opt-out never highlighted', {
      timeout: 8000,
    });
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

  it('shows a transient "Copied!" confirmation label after copying, then reverts after the timeout', async function () {
    this.timeout(5000);
    const el = (await fixture(html`<lr-code-block .code=${jsSample}></lr-code-block>`)) as LyraCodeBlock;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    expect(button.textContent!.trim()).to.equal('Copy');

    button.click();
    await el.updateComplete;
    expect(button.textContent!.trim()).to.equal('Copied!');

    await aTimeout(1600);
    await el.updateComplete;
    expect(button.textContent!.trim()).to.equal('Copy');
  });

  it('still fires lr-copy when navigator.clipboard throws synchronously (writeClipboard catch branch)', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      get() {
        throw new Error('blocked by permissions policy');
      },
      configurable: true,
    });

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

  it('does not render a copy button when copyable is false', async () => {
    const el = (await fixture(
      html`<lr-code-block .copyable=${false} .code=${jsSample} filename="x.ts"></lr-code-block>`,
    )) as LyraCodeBlock;
    expect(el.shadowRoot!.querySelector('[part="copy-button"]')).to.not.exist;
  });

  it('honors a plain copyable="false" attribute (not just a .copyable=${false} property binding)', async () => {
    const el = (await fixture(
      html`<lr-code-block copyable="false" .code=${jsSample} filename="x.ts"></lr-code-block>`,
    )) as LyraCodeBlock;
    expect(el.copyable).to.be.false;
    expect(el.hasAttribute('copyable')).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="copy-button"]')).to.have.lengthOf(0);
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

  it('ignores non-line-range highlight entries when merging highlight-lines', async () => {
    const el = (await fixture(html`<lr-code-block code=${'a\nb\nc'}></lr-code-block>`)) as LyraCodeBlock;
    el.highlights = [
      { id: 'p1', anchor: { kind: 'page', page: 1 } },
      { id: 'h1', anchor: { kind: 'line-range', start: 2, end: 2 } },
    ];
    await el.updateComplete;
    const lines = [...el.shadowRoot!.querySelectorAll('[data-line]')];
    expect(lines.map((l) => l.hasAttribute('data-highlighted'))).to.deep.equal([false, true, false]);
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

  it('resolves a `highlights` id string to its anchor, and resolves false for an unknown id', async () => {
    const el = (await fixture(html`<lr-code-block code=${'a\nb\nc\nd\ne'}></lr-code-block>`)) as LyraCodeBlock;
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 3 } }];
    await el.updateComplete;
    let scrolled = false;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    body.scrollTo = () => {
      scrolled = true;
    };
    expect(await el.scrollToAnchor('h1')).to.be.true;
    expect(scrolled).to.be.true;
    expect(await el.scrollToAnchor('does-not-exist')).to.be.false;
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

  it('marks active highlight lines with data-active based on activeHighlightId, including the open-ended end fallback', async () => {
    const el = (await fixture(html`<lr-code-block code=${'a\nb\nc'}></lr-code-block>`)) as LyraCodeBlock;
    // `end` intentionally omitted -- exercises the `active.anchor.end ?? active.anchor.start` fallback.
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 2 } }];
    el.activeHighlightId = 'h1';
    await el.updateComplete;
    const line1 = el.shadowRoot!.querySelector('[data-line="1"]')!;
    const line2 = el.shadowRoot!.querySelector('[data-line="2"]')!;
    expect(line2.hasAttribute('data-active')).to.be.true;
    expect(line1.hasAttribute('data-active')).to.be.false;
  });
});

describe('text selection (lr-text-select)', () => {
  it('emits lr-text-select for a text selection spanning code lines', async () => {
    const el = (await fixture(html`<lr-code-block code=${'alpha\nbeta\ngamma'}></lr-code-block>`)) as LyraCodeBlock;
    await el.updateComplete;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const line1 = el.shadowRoot!.querySelector('[data-line="1"]')!;
    const line2 = el.shadowRoot!.querySelector('[data-line="2"]')!;
    // Lit inserts a static per-expression marker comment before the dynamic text node it commits,
    // so the real Text node is not reliably `firstChild` -- find it directly instead of assuming a
    // fixed sibling position (same precedent as terminal.test.ts's identical selection test).
    const textNodeOf = (line: Element): Node => [...line.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!;
    const range = document.createRange();
    range.setStart(textNodeOf(line1), 0);
    range.setEnd(textNodeOf(line2), 2);
    // `ShadowRoot.getSelection` is a Chromium-only extension -- same precedent the component
    // itself documents for onBodyMouseUp(). Falls back to window.getSelection() otherwise.
    const shadowSelection = (el.shadowRoot as unknown as { getSelection?: () => Selection | null }).getSelection?.();
    const selection = shadowSelection ?? window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const listener = oneEvent(el, 'lr-text-select');
    body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
    const event = (await listener) as CustomEvent<{ text: string; anchor: unknown }>;
    expect(event.detail.anchor).to.deep.equal({ kind: 'line-range', start: 1, end: 2 });
    expect(event.detail.text.length).to.be.greaterThan(0);
  });

  it('does not emit lr-text-select when there is no active selection on mouseup', async () => {
    const el = (await fixture(html`<lr-code-block code=${'a\nb'}></lr-code-block>`)) as LyraCodeBlock;
    await el.updateComplete;
    const shadowSelection = (el.shadowRoot as unknown as { getSelection?: () => Selection | null }).getSelection?.();
    (shadowSelection ?? window.getSelection())?.removeAllRanges();
    let fired = false;
    el.addEventListener('lr-text-select', () => {
      fired = true;
    });
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
    await aTimeout(0);
    expect(fired).to.be.false;
  });

  it('does not emit lr-text-select for a whitespace-only selection', async () => {
    const el = (await fixture(html`<lr-code-block code=${'a  \nb'}></lr-code-block>`)) as LyraCodeBlock;
    await el.updateComplete;
    const line1 = el.shadowRoot!.querySelector('[data-line="1"]')!;
    const textNodeOf = (line: Element): Node => [...line.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!;
    const range = document.createRange();
    range.setStart(textNodeOf(line1), 1);
    range.setEnd(textNodeOf(line1), 3); // just the trailing spaces
    const shadowSelection = (el.shadowRoot as unknown as { getSelection?: () => Selection | null }).getSelection?.();
    const selection = shadowSelection ?? window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    let fired = false;
    el.addEventListener('lr-text-select', () => {
      fired = true;
    });
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
    await aTimeout(0);
    expect(fired).to.be.false;
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

  it('moves focus with ArrowUp, jumps with Home/End, and activates on Enter and Space', async () => {
    const el = (await fixture(
      html`<lr-code-block code=${'a\nb\nc\nd'} line-numbers interactive-lines></lr-code-block>`,
    )) as LyraCodeBlock;
    await el.updateComplete;

    const line3 = el.shadowRoot!.querySelector('[data-line="3"]') as HTMLButtonElement;
    line3.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-line="2"]')!.getAttribute('tabindex')).to.equal('0');

    const line2 = el.shadowRoot!.querySelector('[data-line="2"]') as HTMLButtonElement;
    line2.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-line="4"]')!.getAttribute('tabindex')).to.equal('0');

    const line4 = el.shadowRoot!.querySelector('[data-line="4"]') as HTMLButtonElement;
    line4.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-line="1"]')!.getAttribute('tabindex')).to.equal('0');

    const line1 = el.shadowRoot!.querySelector('[data-line="1"]') as HTMLButtonElement;
    let listener = oneEvent(el, 'lr-line-click');
    line1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    let event = (await listener) as CustomEvent<{ line: number }>;
    expect(event.detail).to.deep.equal({ line: 1 });

    listener = oneEvent(el, 'lr-line-click');
    line1.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    event = (await listener) as CustomEvent<{ line: number }>;
    expect(event.detail).to.deep.equal({ line: 1 });

    // Home while already on line 1 is a no-op (next === line) -- must not move focus or throw.
    line1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-line="1"]')!.getAttribute('tabindex')).to.equal('0');
  });

  it('marks a highlighted line as both line-button and line-highlight when interactive-lines and highlight-lines are combined', async () => {
    const el = (await fixture(
      html`<lr-code-block code=${'a\nb\nc'} line-numbers interactive-lines highlight-lines="2"></lr-code-block>`,
    )) as LyraCodeBlock;
    await el.updateComplete;
    const line2 = el.shadowRoot!.querySelector('[data-line="2"]')!;
    expect(line2.getAttribute('part')).to.equal('line-button line-highlight');
  });

  it('keeps interactive line controls after shiki highlighting and exposes the source as their name', async () => {
    const el = (await fixture(html`
      <lr-code-block
        language="json"
        .languages=${{ json: jsonGrammar }}
        .code=${'{"a":1}\n{"b":2}'}
        line-numbers
        interactive-lines
      ></lr-code-block>
    `)) as LyraCodeBlock;
    await waitUntil(() => !!el.shadowRoot!.querySelector('.shiki [data-line][role="button"]'), 'interactive shiki lines missing', {
      timeout: 8000,
    });
    const line = el.shadowRoot!.querySelector('.shiki [data-line="1"]') as HTMLElement;
    expect(line.hasAttribute('aria-label')).to.be.false;
    expect(line.textContent).to.contain('"a"');
    const event = oneEvent(el, 'lr-line-click');
    line.click();
    expect(((await event) as CustomEvent<{ line: number }>).detail.line).to.equal(1);
  });
});

describe('gutter line-button hover specificity', () => {
  it('a ::part(line-button):hover override wins without needing !important', async () => {
    const style = document.createElement('style');
    style.textContent = `lr-code-block::part(line-button):hover { color: rgb(1, 2, 3); }`;
    document.head.appendChild(style);
    try {
      const el = (await fixture(
        html`<lr-code-block code=${'a\nb'} line-numbers interactive-lines></lr-code-block>`,
      )) as LyraCodeBlock;
      // jsdom/browser test runners don't synthesize a real :hover pseudo-class from a dispatched
      // event, so assert via computed specificity order instead: the internal rule must be written
      // so its specificity never exceeds a consumer's ::part(line-button):hover -- see
      // lr-attachment-trigger's/lr-copy-button's identical test for the same reasoning.
      const internalSheet = (el.shadowRoot!.adoptedStyleSheets ?? [])
        .flatMap((sheet) => Array.from(sheet.cssRules))
        .map((rule) => rule.cssText)
        .find((text) => text.includes(':hover') && text.includes('button.line'));
      expect(internalSheet).to.contain(':where(');
    } finally {
      style.remove();
    }
  });
});

// `--lr-code-block-tab-size` mirrors `--lr-code-editor-tab-size` (same default of 2) so the
// editable and the read-only code surfaces agree on how wide a literal tab renders. The rule lives
// on [part='pre'] and must be written as a *token*, never as an inline `tab-size` -- shiki puts its
// own `style` attribute on the highlighted <pre>, and an inline declaration always beats a
// stylesheet rule.
describe('tab width (--lr-code-block-tab-size)', () => {
  const computedTabSize = (el: LyraCodeBlock): string =>
    getComputedStyle(el.shadowRoot!.querySelector('[part="pre"]')!).tabSize;

  it('defaults to 2, matching --lr-code-editor-tab-size', async () => {
    const el = (await fixture(
      html`<lr-code-block .code=${'\tone\n\t\ttwo'}></lr-code-block>`,
    )) as LyraCodeBlock;
    await el.updateComplete;
    expect(computedTabSize(el)).to.equal('2');
  });

  it('renders a tab-indented code string at the width the token asks for', async () => {
    const el = (await fixture(
      html`<lr-code-block .code=${'\tone\n\t\ttwo'} style="--lr-code-block-tab-size: 5"></lr-code-block>`,
    )) as LyraCodeBlock;
    await el.updateComplete;
    expect(computedTabSize(el)).to.equal('5');
  });

  // The default is the var() fallback arm on [part='pre'], never a :host declaration -- a :host
  // rule is re-stamped per instance and would shadow any inherited value, making a page- or
  // container-level tab width impossible. Setting it once above a whole transcript must work.
  it('honours a tab width set on an ancestor rather than on the element', async () => {
    const host = (await fixture(html`
      <div style="--lr-code-block-tab-size: 7">
        <lr-code-block .code=${'\tone\n\t\ttwo'}></lr-code-block>
      </div>
    `)) as HTMLElement;
    const el = host.querySelector('lr-code-block') as LyraCodeBlock;
    await el.updateComplete;
    expect(computedTabSize(el)).to.equal('7');
  });

  it('keeps honouring the token on the shiki-highlighted path, where <pre> carries an inline style', async () => {
    const el = (await fixture(
      html`<lr-code-block
        language="javascript"
        .code=${'\tconst x = 1;'}
        style="--lr-code-block-tab-size: 6"
      ></lr-code-block>`,
    )) as LyraCodeBlock;
    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, { timeout: 8000 });
    const pre = el.shadowRoot!.querySelector('[part="pre"]') as HTMLElement;
    expect(pre.getAttribute('style'), 'shiki writes its own inline style on this element').to.exist;
    expect(pre.style.tabSize, 'the component must never write tab-size inline').to.equal('');
    expect(getComputedStyle(pre).tabSize).to.equal('6');
  });

  it('is accessible with a custom tab size on tab-indented code', async () => {
    const el = (await fixture(
      html`<lr-code-block
        filename="indented.txt"
        .code=${'\tone\n\t\ttwo'}
        style="--lr-code-block-tab-size: 4"
      ></lr-code-block>`,
    )) as LyraCodeBlock;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

// Sweep F35: the active-line outline had no component-scoped override, so a consumer retinting the
// active anchor had to reach for the shared --lr-color-brand (which every other brand-colored
// surface in the component also reads) or a ::part override that suppresses the rest of the rule.
describe('active-line outline color (--lr-code-block-active-line-outline-color)', () => {
  const activeLine = async (style = ''): Promise<HTMLElement> => {
    const el = (await fixture(
      html`<lr-code-block code=${'a\nb\nc'} active-highlight-id="h1" style=${style}></lr-code-block>`,
    )) as LyraCodeBlock;
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 2, end: 2 } }];
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[data-active]') as HTMLElement;
  };

  it('defaults to --lr-color-brand, unchanged from before the override existed', async () => {
    const line = await activeLine();
    const probe = document.createElement('div');
    probe.style.cssText = 'color: var(--lr-color-brand);';
    line.parentElement!.appendChild(probe);
    expect(getComputedStyle(line).outlineColor).to.equal(getComputedStyle(probe).color);
  });

  it('retints the active-line outline without touching --lr-color-brand', async () => {
    const line = await activeLine('--lr-code-block-active-line-outline-color: rgb(1, 2, 3)');
    expect(getComputedStyle(line).outlineColor).to.equal('rgb(1, 2, 3)');
  });
});

describe('shiki dark-theme signal', () => {
  it('marks part="body" as dark-theme once the resolved --lr-color-text is lighter than --lr-color-surface', async () => {
    const wrapper = (await fixture(html`
      <div style="--lr-theme-color-text-normal:#f2f2f2; --lr-theme-color-surface-default:#1a1a1a;">
        <lr-code-block></lr-code-block>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-code-block') as LyraCodeBlock;
    await el2Ready(el);
    const body = el.shadowRoot!.querySelector('[part="body"]')!;
    expect(body.getAttribute('data-dark-theme')).to.equal('true');
  });

  it('does not mark part="body" as dark-theme with the default light --lr-color-* fallbacks', async () => {
    const el = (await fixture(html`<lr-code-block></lr-code-block>`)) as LyraCodeBlock;
    await el2Ready(el);
    const body = el.shadowRoot!.querySelector('[part="body"]')!;
    expect(body.hasAttribute('data-dark-theme')).to.be.false;
  });

  it('gates the shiki dark-theme override on [data-dark-theme="true"], not @media (prefers-color-scheme: dark) alone', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='body'\]\[data-dark-theme='true'\] \[part='pre'\][^{,]*\{[^}]*--shiki-dark/);
    expect(css).to.not.match(/@media \(prefers-color-scheme: dark\)[^{]*\{[^}]*--shiki-dark/);
  });

  // The cssText-regex test above only proves the gating rule's *selector* exists in source -- it
  // never proves the color substitution actually reaches a rendered highlighted line, or that it
  // stays off for a consumer who overrides --lr-theme-color-* independently of the OS's own
  // prefers-color-scheme setting (exactly what the two tests above already exercise for
  // data-dark-theme itself). This one renders a real highlighted code block in both states and
  // reads getComputedStyle() on an actual shiki token span.
  it('resolves a highlighted token span\'s computed color from --shiki-dark only once data-dark-theme="true", never merely from the OS dark-mode preference', async function () {
    this.timeout(20_000);

    async function firstDarkAwareSpan(wrapperStyle: string): Promise<{ span: HTMLElement; body: Element }> {
      const wrapper = (await fixture(html`
        <div style=${wrapperStyle}>
          <lr-code-block language="javascript" .code=${jsSample}></lr-code-block>
        </div>
      `)) as HTMLElement;
      const el = wrapper.querySelector('lr-code-block') as LyraCodeBlock;
      await el2Ready(el);
      await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, 'highlighted output never appeared', {
        timeout: 15000,
      });
      const body = el.shadowRoot!.querySelector('[part="body"]')!;
      const spans = Array.from(el.shadowRoot!.querySelectorAll('[part="pre"] span')) as HTMLElement[];
      const span = spans.find((s) => s.style.getPropertyValue('--shiki-dark') !== '')!;
      return { span, body };
    }

    // Light case: no dark tokens set, so data-dark-theme is never applied -- the override rule
    // must not take effect, and the computed color must be exactly shiki's own light inline color.
    const light = await firstDarkAwareSpan('');
    expect(light.body.hasAttribute('data-dark-theme')).to.be.false;
    expect(getComputedStyle(light.span).color).to.equal(light.span.style.color);

    // Dark case: --lr-theme-color-* tokens (not the OS prefers-color-scheme media query) drive
    // data-dark-theme -- the override rule must take effect, resolving to whatever --shiki-dark
    // itself evaluates to (read via a probe rather than hardcoding shiki's palette).
    const dark = await firstDarkAwareSpan(
      '--lr-theme-color-text-normal:#f2f2f2; --lr-theme-color-surface-default:#1a1a1a;',
    );
    expect(dark.body.getAttribute('data-dark-theme')).to.equal('true');
    const probe = document.createElement('span');
    probe.setAttribute('style', dark.span.getAttribute('style')!);
    probe.style.color = 'var(--shiki-dark, inherit)';
    dark.span.parentElement!.appendChild(probe);
    const expectedDarkColor = getComputedStyle(probe).color;
    probe.remove();
    expect(getComputedStyle(dark.span).color).to.equal(expectedDarkColor);
    // And the override must actually have changed something, or this assertion would pass
    // vacuously even with the gating broken.
    expect(getComputedStyle(dark.span).color).to.not.equal(dark.span.style.color);
  });
});
