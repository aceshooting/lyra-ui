import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { css } from 'lit';
import { LyraElement } from './lyra-element.js';
import { tag } from './prefix.js';
import { hasLyraTokens } from './document-tokens.js';
import {
  DOCUMENT_TOKEN_CSS,
  DOCUMENT_TOKEN_LAYER_ID,
  DOCUMENT_TOKEN_SENTINEL,
  HOST_TOKEN_CSS,
} from './document-tokens.generated.js';
import { specialistTokens } from './specialist-host-tokens.styles.js';
import { THEME_ATTRIBUTES } from './theme-observation.js';
import { adoptLyraTokens } from '../utilities/tokens.js';
import { findUnscopedThemeInputs } from '../utilities/theme-scopes.js';
import { applyLyraStyleScope } from '../theme/theme.js';
import { setColorScheme, setForcedColors, setReducedMotion } from '../../test/wtr-media.js';
import { captureDevWarnings, expectDevWarning } from '../../test/expected-dev-warnings.js';
import { toRgba } from '../../test/color-contrast.js';
import '../components/layout/card/card.js';
// Mode-attribute fixtures without theme.css exercise the missing-resolver diagnostic on purpose.
expectDevWarning('lyra-style:resolver');

// A library-shaped probe: registered through customElements.define, so like a consumer subclass of
// the public LyraElement it is NOT a registered library component, and its shadow root is an
// application root. `lr-card` (imported above) is the real library component.
class LayerProbe extends LyraElement {
  static override styles = [LyraElement.styles, specialistTokens, css`:host { display: block; }`];
  override render() {
    return html`<slot></slot>`;
  }
}
customElements.define(tag('layer-probe'), LayerProbe);

/** An application component (Lit/Stencil style) whose shadow root holds Lyra elements. */
class AppShell extends HTMLElement {
  set markup(value: string) {
    (this.shadowRoot ?? this.attachShadow({ mode: 'open' })).innerHTML = value;
  }
}
customElements.define('app-token-shell', AppShell);

const read = (element: Element, name: string) => getComputedStyle(element).getPropertyValue(name).trim();
const surfaceOf = (element: Element) => toRgba(read(element, '--lr-color-surface'));
const LIGHT_SURFACE = [255, 255, 255, 255];
const DARK_SURFACE = [10, 10, 10, 255];

function layerSheet(root: Document | ShadowRoot = document): CSSStyleSheet | undefined {
  return root.adoptedStyleSheets.find((sheet) =>
    Array.from(sheet.cssRules).some((rule) => rule.cssText.includes(DOCUMENT_TOKEN_SENTINEL)));
}

async function probeIn(container: ParentNode, selector = tag('layer-probe')): Promise<LayerProbe> {
  const probe = container.querySelector(selector) as LayerProbe;
  await probe.updateComplete;
  return probe;
}

async function shell(markup: string): Promise<{ host: AppShell; root: ShadowRoot }> {
  const host = (await fixture(html`<app-token-shell></app-token-shell>`)) as AppShell;
  host.markup = markup;
  const root = host.shadowRoot!;
  await Promise.all(Array.from(root.querySelectorAll(tag('layer-probe')), (probe) => (probe as LayerProbe).updateComplete));
  return { host, root };
}

describe('document token layer: adoption', () => {
  it('adopts one constructed layer per document on the first connect, before the first update', async () => {
    const before = document.adoptedStyleSheets.length;
    const first = document.createElement(tag('layer-probe')) as LayerProbe;
    document.body.append(first);
    // Synchronously, inside connectedCallback: no update has run yet.
    expect(hasLyraTokens(document)).to.equal(true);
    expect(read(first, '--lr-space-m')).to.equal('0.75rem');
    const second = (await fixture(html`<lr-layer-probe></lr-layer-probe>`)) as LayerProbe;
    await Promise.all([first.updateComplete, second.updateComplete]);
    const sheets = document.adoptedStyleSheets.filter((sheet) => sheet === layerSheet());
    expect(sheets.length).to.equal(1);
    expect(document.adoptedStyleSheets.length - before).to.be.at.most(1);
    first.remove();
  });

  it('declares the layer once at :root and nothing shared on the component host', async () => {
    const probe = (await fixture(html`<lr-layer-probe></lr-layer-probe>`)) as LayerProbe;
    expect(read(document.documentElement, '--lr-color-brand')).to.not.equal('');
    expect(read(document.documentElement, DOCUMENT_TOKEN_SENTINEL)).to.equal(DOCUMENT_TOKEN_LAYER_ID);
    // The host carries only the host-local remainder; the shared names are inherited.
    // (Only the base block: the forced-colors arm deliberately restates system colors per host.)
    expect(HOST_TOKEN_CSS.split('@media')[0]).to.not.match(/:host\{[^}]*--lr-color-surface:/);
    expect(read(probe, '--lr-color-brand')).to.equal(read(document.documentElement, '--lr-color-brand'));
  });

  it('re-adopts the layer after an application replaces adoptedStyleSheets wholesale', async () => {
    await fixture(html`<lr-layer-probe></lr-layer-probe>`);
    const previous = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [];
    try {
      expect(hasLyraTokens(document)).to.equal(false);
      // The next connect anywhere in the document restores it.
      await fixture(html`<lr-card>Again</lr-card>`);
      expect(hasLyraTokens(document)).to.equal(true);
    } finally {
      document.adoptedStyleSheets = [...new Set([...previous, ...document.adoptedStyleSheets])];
    }
  });

  it('constructs a separate layer in the realm of a document an element moves into', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const frameDocument = frame.contentDocument!;
      const probe = document.createElement(tag('layer-probe')) as LayerProbe;
      frameDocument.body.append(frameDocument.adoptNode(probe));
      await probe.updateComplete;
      const sheet = layerSheet(frameDocument);
      expect(sheet !== undefined, 'the iframe document adopts its own copy').to.equal(true);
      expect(sheet === layerSheet(document)).to.equal(false);
      expect(sheet instanceof (frame.contentWindow as unknown as { CSSStyleSheet: typeof CSSStyleSheet }).CSSStyleSheet).to.equal(true);
      expect(frame.contentWindow!.getComputedStyle(probe).getPropertyValue('--lr-space-m').trim()).to.equal('0.75rem');
    } finally {
      frame.remove();
    }
  });

  it('skips a document without a browsing context until the element connects to a real one', async () => {
    const detached = document.implementation.createHTMLDocument('detached');
    const probe = detached.createElement(tag('layer-probe'));
    expect(() => detached.body.append(probe)).to.not.throw();
    expect(detached.adoptedStyleSheets.length).to.equal(0);
    document.body.append(document.adoptNode(probe));
    try {
      expect(hasLyraTokens(document)).to.equal(true);
    } finally {
      probe.remove();
    }
  });

  it('keeps the static copy when tokens-root.css is linked, and adopts no constructed one', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const frameDocument = frame.contentDocument!;
      const link = frameDocument.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL('../styles/tokens-root.css', import.meta.url).href;
      const loaded = new Promise((resolve, reject) => {
        link.addEventListener('load', resolve, { once: true });
        link.addEventListener('error', reject, { once: true });
      });
      frameDocument.head.append(link);
      await loaded;
      const probe = document.createElement(tag('layer-probe')) as LayerProbe;
      frameDocument.body.append(frameDocument.adoptNode(probe));
      await probe.updateComplete;
      expect(layerSheet(frameDocument) === undefined, 'no constructed copy beside the linked file').to.equal(true);
      expect(hasLyraTokens(frameDocument)).to.equal(true);
      expect(frame.contentWindow!.getComputedStyle(probe).getPropertyValue('--lr-space-m').trim()).to.equal('0.75rem');
    } finally {
      frame.remove();
    }
  });

  it('adopts its own layer, and reports it in development, when a different layer is already present', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const frameDocument = frame.contentDocument!;
      const style = frameDocument.createElement('style');
      style.textContent = `:root { ${DOCUMENT_TOKEN_SENTINEL}: lr000000000000; }`;
      frameDocument.head.append(style);
      const probe = document.createElement(tag('layer-probe')) as LayerProbe;
      const warnings = await captureDevWarnings(async () => {
        frameDocument.body.append(frameDocument.adoptNode(probe));
        await probe.updateComplete;
      });
      expect(layerSheet(frameDocument) !== undefined, 'the later copy appends its own layer').to.equal(true);
      expect(warnings.some((message) => message.includes('A different Lyra token layer'))).to.equal(true);
    } finally {
      frame.remove();
    }
  });

  it('adopts the layer text that tokens-root.css publishes, byte for byte', async () => {
    const response = await fetch(new URL('../styles/tokens-root.css', import.meta.url));
    const text = await response.text();
    expect(text.endsWith(DOCUMENT_TOKEN_CSS)).to.equal(true);
  });
});

describe('document token layer: application shadow roots', () => {
  it('does not adopt into an application root without a theme scope', async () => {
    const { root } = await shell(`<lr-layer-probe></lr-layer-probe>`);
    expect(layerSheet(root) === undefined).to.equal(true);
  });

  it('adopts on demand into an application root where a scope needs it', async () => {
    const { root } = await shell(`<div class="lr-dark"><lr-layer-probe></lr-layer-probe></div>`);
    expect(layerSheet(root) !== undefined).to.equal(true);
    expect(surfaceOf(await probeIn(root))).to.deep.equal(DARK_SURFACE);
  });

  it('adopts when a Lyra host inside an application root becomes a scope itself', async () => {
    const { root } = await shell(`<lr-layer-probe></lr-layer-probe>`);
    const probe = await probeIn(root);
    expect(layerSheet(root) === undefined).to.equal(true);
    probe.setAttribute('data-lr-theme', 'dark');
    expect(layerSheet(root) !== undefined).to.equal(true);
    expect(surfaceOf(probe)).to.deep.equal(DARK_SURFACE);
  });

  it('adopts into the shadow root of a consumer LyraElement subclass, never into a library root', async () => {
    const outer = (await fixture(html`<lr-layer-probe></lr-layer-probe>`)) as LayerProbe;
    outer.shadowRoot!.innerHTML = '<div data-lr-theme-scope><lr-card>Inside</lr-card></div>';
    const card = outer.shadowRoot!.querySelector('lr-card') as HTMLElement & { updateComplete: Promise<unknown> };
    await card.updateComplete;
    expect(layerSheet(outer.shadowRoot!) !== undefined, 'a consumer subclass is an application component').to.equal(true);
    expect(layerSheet(card.shadowRoot!) === undefined, 'library roots never receive the layer').to.equal(true);
  });

  it('needs adoptLyraTokens() for a scope added after the root\'s Lyra elements connected', async () => {
    const { root } = await shell(`<div id="region"><lr-layer-probe></lr-layer-probe></div>`);
    const region = root.querySelector('#region')!;
    region.classList.add('lr-dark');
    expect(layerSheet(root) === undefined, 'documented: no observer watches application roots').to.equal(true);
    adoptLyraTokens(root);
    adoptLyraTokens(root);
    expect(root.adoptedStyleSheets.filter((sheet) => sheet === layerSheet(root)).length, 'idempotent').to.equal(1);
    expect(surfaceOf(await probeIn(root))).to.deep.equal(DARK_SURFACE);
  });

  it('lets applyLyraStyleScope() turn an element inside an application root into a working scope', async () => {
    await fixture(html`<lr-layer-probe></lr-layer-probe>`);
    const { root } = await shell(`<section id="region"><lr-layer-probe></lr-layer-probe></section>`);
    applyLyraStyleScope(root.querySelector('#region')!, { overrides: { '--lr-theme-font-family-body': 'serif' } });
    expect(root.querySelector('#region')!.hasAttribute('data-lr-theme-scope')).to.equal(true);
    expect(layerSheet(root) !== undefined).to.equal(true);
    expect(read(await probeIn(root), '--lr-font')).to.equal('serif');
  });
});

describe('document token layer: theme scopes and mode', () => {
  it('re-derives an input set on a marked scope, and not one set on a plain wrapper', async () => {
    expectDevWarning('lyra-theme-scope:unscoped-input');
    const plain = await fixture<HTMLElement>(html`<div data-lr-not-a-scope style="--lr-theme-space-m: 2rem"><lr-layer-probe></lr-layer-probe></div>`);
    expect(read(await probeIn(plain), '--lr-space-m')).to.equal('0.75rem');
    const marked = await fixture<HTMLElement>(html`<div data-lr-theme-scope style="--lr-theme-space-m: 2rem"><lr-layer-probe></lr-layer-probe></div>`);
    expect(read(await probeIn(marked), '--lr-space-m')).to.equal('2rem');
    const markedHost = await fixture<HTMLElement>(html`<lr-layer-probe data-lr-theme-scope style="--lr-theme-space-m: 2rem"></lr-layer-probe>`);
    expect(read(markedHost, '--lr-space-m')).to.equal('2rem');
  });

  it('treats data-lr-theme-scope="false" as a scope (HTML presence semantics) and warns in development', async () => {
    let probe!: LayerProbe;
    const warnings = await captureDevWarnings(async () => {
      probe = (await fixture(html`<lr-layer-probe data-lr-theme-scope="false" style="--lr-theme-space-m: 2rem"></lr-layer-probe>`)) as LayerProbe;
    });
    expect(read(probe, '--lr-space-m')).to.equal('2rem');
    expect(warnings.some((message) => message.includes('data-lr-theme-scope="false"'))).to.equal(true);
  });

  it('warns once in development about an inline layer input on an element that is not a scope', async () => {
    const warnings = await captureDevWarnings(async () => {
      await fixture(html`<div data-lr-not-a-scope style="--lr-theme-color-brand-fill-loud: red"><lr-layer-probe></lr-layer-probe></div>`);
      await fixture(html`<div data-lr-theme-scope style="--lr-theme-color-brand-fill-loud: red"><lr-layer-probe></lr-layer-probe></div>`);
      // Host-read inputs (the specialist palettes) work on any element and are not reported.
      await fixture(html`<div style="--lr-theme-color-chart-1: red"><lr-layer-probe></lr-layer-probe></div>`);
    });
    expect(warnings.filter((message) => message.includes('is not a theme scope')).length).to.equal(1);
  });

  it('keeps a mode-neutral scope in its ancestor mode, and a light island light, without theme.css', async () => {
    const tree = await fixture<HTMLElement>(html`
      <div>
        <section class="lr-dark"><div data-lr-theme-scope id="neutral"><lr-layer-probe></lr-layer-probe></div></section>
        <section class="lr-dark"><section class="lr-light" id="island"><lr-layer-probe></lr-layer-probe></section></section>
        <section data-lr-theme="dark" id="attr"><lr-layer-probe></lr-layer-probe></section>
      </div>
    `);
    expect(surfaceOf(await probeIn(tree.querySelector('#neutral')!))).to.deep.equal(DARK_SURFACE);
    expect(surfaceOf(await probeIn(tree.querySelector('#island')!))).to.deep.equal(LIGHT_SURFACE);
    expect(surfaceOf(await probeIn(tree.querySelector('#attr')!))).to.deep.equal(DARK_SURFACE);
  });

  it('follows the OS preference at the root, and an explicit .lr-light scope under it', async () => {
    const tree = await fixture<HTMLElement>(html`
      <div><div id="free"><lr-layer-probe></lr-layer-probe></div><div class="lr-light" id="pinned"><lr-layer-probe></lr-layer-probe></div></div>
    `);
    await setColorScheme('dark');
    try {
      expect(surfaceOf(await probeIn(tree.querySelector('#free')!))).to.deep.equal(DARK_SURFACE);
      expect(surfaceOf(await probeIn(tree.querySelector('#pinned')!))).to.deep.equal(LIGHT_SURFACE);
    } finally {
      await setColorScheme('no-preference');
    }
  });

  it('moves the specialist palettes with the nearest mode scope', async () => {
    const tree = await fixture<HTMLElement>(html`
      <div><div id="light"><lr-layer-probe></lr-layer-probe></div><div class="lr-dark" id="dark"><lr-layer-probe></lr-layer-probe></div></div>
    `);
    const light = read(await probeIn(tree.querySelector('#light')!), '--lr-color-chart-1');
    const dark = read(await probeIn(tree.querySelector('#dark')!), '--lr-color-chart-1');
    expect(light).to.not.equal('');
    expect(dark).to.not.equal(light);
  });

  it('keeps the same nearest-scope mode with theme.css installed', async () => {
    const response = await fetch(new URL('../theme.css', import.meta.url));
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(await response.text());
    const previous = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...previous, sheet];
    try {
      const tree = await fixture<HTMLElement>(html`
        <div>
          <section class="lr-dark"><div data-lr-theme-scope id="neutral"><lr-layer-probe></lr-layer-probe></div></section>
          <section class="lr-dark"><section class="lr-light" id="island"><lr-layer-probe></lr-layer-probe></section></section>
        </div>
      `);
      expect(surfaceOf(await probeIn(tree.querySelector('#neutral')!))).to.deep.equal(DARK_SURFACE);
      expect(surfaceOf(await probeIn(tree.querySelector('#island')!))).to.deep.equal(LIGHT_SURFACE);
    } finally {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((adopted) => adopted !== sheet);
    }
  });

  it('lets an ancestor output reach components until the next scope (a v27 widening)', async () => {
    const tree = await fixture<HTMLElement>(html`
      <div style="--lr-space-m: 9px">
        <lr-layer-probe id="reached"></lr-layer-probe>
        <div data-lr-theme-scope><lr-layer-probe id="stopped"></lr-layer-probe></div>
      </div>
    `);
    expect(read(await probeIn(tree, '#reached'), '--lr-space-m')).to.equal('9px');
    expect(read(await probeIn(tree, '#stopped'), '--lr-space-m')).to.equal('0.75rem');
  });
});

describe('document token layer: preference arms on every host', () => {
  it('keeps reduced motion inside a component against an unlayered application override', async () => {
    const override = document.createElement('style');
    override.textContent = ':root { --lr-transition-fast: 400ms ease; --lr-duration-fast: 400ms; }';
    document.head.append(override);
    const probe = (await fixture(html`<lr-layer-probe></lr-layer-probe>`)) as LayerProbe;
    try {
      await setReducedMotion('reduce');
      await waitUntil(() => matchMedia('(prefers-reduced-motion: reduce)').matches, 'reduced motion never matched');
      expect(read(probe, '--lr-duration-fast')).to.equal('0.001ms');
      expect(read(probe, '--lr-transition-fast').replace(/\s+/g, ' ')).to.equal('0.001ms linear');
      expect(read(probe, '--lr-transition-interactive')).to.contain('0.001ms');
      // Application elements see the application's override: the host arm is per component.
      expect(read(document.documentElement, '--lr-duration-fast')).to.equal('400ms');
    } finally {
      await setReducedMotion('no-preference');
      override.remove();
    }
  });

  it('keeps forced colours inside a component against an unlayered application override', async function () {
    const override = document.createElement('style');
    override.textContent = ':root { --lr-color-surface: #fafafa; --lr-color-text: #333333; }';
    document.head.append(override);
    const probe = (await fixture(html`<lr-layer-probe data-lr-theme="dark"></lr-layer-probe>`)) as LayerProbe;
    try {
      try {
        await setForcedColors('active');
      } catch {
        this.skip();
      }
      if (!matchMedia('(forced-colors: active)').matches) this.skip();
      expect(read(probe, '--lr-color-surface')).to.equal('Canvas');
      expect(read(probe, '--lr-color-text')).to.equal('CanvasText');
      expect(read(probe, '--lr-focus-ring-color')).to.equal('Highlight');
      expect(read(probe, '--lr-focus-ring')).to.contain('Highlight');
    } finally {
      await setForcedColors('none').catch(() => undefined);
      override.remove();
    }
  });
});

describe('document token layer: inventory and observation', () => {
  it('finds inline layer inputs on elements that are not scopes, through open shadow roots', async () => {
    expectDevWarning('lyra-theme-scope:unscoped-input');
    const tree = await fixture<HTMLElement>(html`
      <div>
        <div data-lr-not-a-scope id="unscoped" style="--lr-theme-space-m: 1px"></div>
        <div id="scoped" data-lr-theme-scope style="--lr-theme-space-m: 1px"></div>
        <div id="host-read" style="--lr-theme-color-chart-1: red"></div>
        <app-token-shell id="app"></app-token-shell>
      </div>
    `);
    (tree.querySelector('#app') as AppShell).markup = '<p data-lr-not-a-scope id="inside" style="--lr-theme-color-surface-default: red"></p>';
    const found = findUnscopedThemeInputs(tree).map((element) => element.id);
    expect(found).to.deep.equal(['unscoped', 'inside']);
  });

  it('observes every attribute that can make an element a scope', () => {
    for (const attribute of ['data-lr-theme', 'data-lr-theme-scope', 'data-lr-design-token-mode', 'data-lr-mode', 'class']) {
      expect(THEME_ATTRIBUTES).to.include(attribute);
    }
  });
});
