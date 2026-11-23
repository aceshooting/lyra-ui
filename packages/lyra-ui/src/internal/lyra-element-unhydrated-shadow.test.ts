// This file deliberately never imports `@aceshooting/lyra-ui/hydration.js` (or the Lit hydrate
// support it installs): it reproduces a page whose bundle evaluated Lit before the hydration
// entry, so LitElement was never patched while server-rendered declarative shadow roots exist.
import { expect } from '@open-wc/testing';
import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { captureDevWarnings } from '../../test/expected-dev-warnings.js';
import { LyraElement } from './lyra-element.js';
import { tag } from './prefix.js';

let definitions = 0;

/** A fresh tag per test, so its declarative markup is parsed before the definition exists and the
 *  upgrade sees the server-built shadow root. */
function nextName(): string {
  return tag(`demo-unhydrated-${++definitions}`);
}

function defineDemo(name: string): void {
  class DemoUnhydrated extends LyraElement {
    static override styles = [LyraElement.styles, css`button { color: rgb(1, 2, 3); }`];
    @property() label = 'Client';
    override render() {
      return html`<button part="base">${this.label}</button>`;
    }
  }
  customElements.define(name, DemoUnhydrated);
}

/** Parses server-like declarative shadow DOM, the way the HTML parser builds it for SSR output. */
function parseServerMarkup(name: string, attributes = ''): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  container.setHTMLUnsafe(
    `<${name} ${attributes}><template shadowrootmode="open">` +
      '<style>button { color: rgb(1, 2, 3); }</style><button part="base">Server</button>' +
      `</template></${name}>`,
  );
  return container;
}

describe('LyraElement without Lit hydrate support', () => {
  afterEach(() => {
    for (const node of [...document.body.children]) if (node.localName === 'div') node.remove();
  });

  it('runs this file on an unpatched LitElement', () => {
    expect(Object.prototype.hasOwnProperty.call(LitElement, 'observedAttributes')).to.equal(false);
  });

  it('re-renders a server shadow root in place instead of appending a duplicate template', async () => {
    const name = nextName();
    const container = parseServerMarkup(name);
    const host = container.querySelector(name) as LyraElement & { label: string };
    expect(host.shadowRoot?.childNodes.length, 'the parser built the server shadow root').to.equal(2);
    const warnings = await captureDevWarnings(async () => {
      defineDemo(name);
      await host.updateComplete;
    });

    const root = host.shadowRoot!;
    const children = [...root.children].map((node) => `${node.localName}${node.getAttribute('part') ? `[part=${node.getAttribute('part')}]` : ''}`);
    expect(children).to.deep.equal(['button[part=base]']);
    expect(root.querySelector('button')!.textContent).to.equal('Client');
    expect(getComputedStyle(root.querySelector('button')!).color, 'adopted component styles apply').to.equal('rgb(1, 2, 3)');

    host.label = 'Updated';
    await host.updateComplete;
    expect(root.querySelectorAll('button').length).to.equal(1);
    expect(root.querySelector('button')!.textContent).to.equal('Updated');

    expect(warnings.filter((message) => message.includes('hydration.js'))).to.have.length(1);
    expect(warnings[0]).to.contain(`<${name}>`);
  });

  it('keeps the server nodes readable until the first update, so server state can seed it', async () => {
    const name = nextName();
    const container = parseServerMarkup(name);
    const host = container.querySelector(name) as LyraElement & { label: string };
    class DemoSeeded extends LyraElement {
      @property() label = 'Client';
      override willUpdate(): void {
        if (!this.hasUpdated) this.label = this.renderRoot.querySelector('button')?.textContent ?? this.label;
      }
      override render() {
        return html`<button part="base">${this.label}</button>`;
      }
    }
    await captureDevWarnings(async () => {
      customElements.define(name, DemoSeeded);
      await host.updateComplete;
    });
    const buttons = [...host.shadowRoot!.querySelectorAll('button')].map((button) => button.textContent);
    expect(buttons).to.deep.equal(['Server']);
  });

  it('warns once per page however many unhydrated hosts upgrade', async () => {
    const name = nextName();
    const hosts = [parseServerMarkup(name), parseServerMarkup(name)].map((container) => container.querySelector(name) as LyraElement);
    const warnings = await captureDevWarnings(async () => {
      defineDemo(name);
      await Promise.all(hosts.map((host) => host.updateComplete));
      for (const host of hosts) expect(host.shadowRoot!.querySelectorAll('button').length).to.equal(1);
    });
    expect(warnings).to.have.length(1);
    expect(warnings[0]).to.contain('hydration.js');
  });

  it('drops the server-only internals attributes the hydrate support would have removed', async () => {
    const name = nextName();
    const container = parseServerMarkup(name, 'aria-label="Server" hydrate-internals-aria-label="Server" title="kept"');
    const host = container.querySelector(name) as LyraElement;
    await captureDevWarnings(async () => {
      defineDemo(name);
      await host.updateComplete;
    });
    expect(host.hasAttribute('aria-label')).to.equal(false);
    expect(host.hasAttribute('hydrate-internals-aria-label')).to.equal(false);
    expect(host.getAttribute('title')).to.equal('kept');
  });

  it('leaves an empty pre-attached shadow root and a browser-only mount untouched and silent', async () => {
    const name = nextName();
    defineDemo(name);
    const warnings = await captureDevWarnings(async () => {
      const attached = document.createElement(name) as LyraElement;
      attached.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      document.body.append(container);
      container.append(attached);
      const plain = document.createElement(name) as LyraElement;
      container.append(plain);
      await Promise.all([attached.updateComplete, plain.updateComplete]);
      for (const host of [attached, plain]) expect(host.shadowRoot!.querySelectorAll('button').length).to.equal(1);
    });
    expect(warnings).to.deep.equal([]);
  });
});
