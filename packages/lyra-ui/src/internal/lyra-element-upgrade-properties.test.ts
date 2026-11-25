import { expect, fixture, html } from '@open-wc/testing';
import { html as litHtml, LitElement, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { blankNumberConverter } from './converters.js';
import { LyraElement } from './lyra-element.js';

// Every case defines its own tag so the element is still undefined when the case first sees it.
let sequence = 0;
const nextTag = (): string => `lr-upgrade-probe-${++sequence}`;

function defineProbe(name: string, seen: number[] = [], ceiling = Infinity) {
  class Probe extends LyraElement {
    @property({ converter: blankNumberConverter(0) }) total = 0;
    @property() label = 'default';
    @property({ type: Boolean }) open = false;
    protected override willUpdate(changed: PropertyValues): void {
      super.willUpdate(changed);
      // A first-update normalization is an ordinary write, never mistaken for the replay.
      if (this.total > ceiling) this.total = ceiling;
      if (changed.has('total')) seen.push(this.total);
    }
    override render() {
      return litHtml`<output>${this.total}</output>`;
    }
  }
  customElements.define(name, Probe);
  return Probe;
}

type Probe = HTMLElement & { total: number; label: string; open: boolean; updateComplete: Promise<boolean> };

describe('LyraElement properties set before upgrade', () => {
  it('keeps values a not-yet-defined element received, over its own field initializers', async () => {
    const name = nextTag();
    const element = document.createElement(name) as Probe;
    element.total = 100;
    element.label = 'assigned';
    document.body.append(element);
    try {
      defineProbe(name);
      await element.updateComplete;
      expect(element.total).to.equal(100);
      expect(element.label).to.equal('assigned');
      expect(element.shadowRoot!.querySelector('output')!.textContent).to.equal('100');
      expect(Object.hasOwn(element, 'total')).to.equal(false);
    } finally {
      element.remove();
    }
  });

  it('lets an assignment made after the upgrade win over the stale pre-upgrade value', async () => {
    const name = nextTag();
    const element = document.createElement(name) as Probe;
    element.total = 0;
    element.label = 'stale';
    document.body.append(element);
    try {
      defineProbe(name);
      // Upgraded, first update still pending: these writes go through the reactive accessors.
      element.total = 100;
      element.label = 'fresh';
      await element.updateComplete;
      expect(element.total).to.equal(100);
      expect(element.label).to.equal('fresh');
      expect(element.shadowRoot!.querySelector('output')!.textContent).to.equal('100');
    } finally {
      element.remove();
    }
  });

  it('keeps a host binding that changed between the upgrade and the child first update', async () => {
    const name = nextTag();
    const seen: number[] = [];
    class Host extends LitElement {
      @property({ type: Number }) total = 0;
      override render() {
        return staticHtml`<${unsafeStatic(name)} .total=${this.total}></${unsafeStatic(name)}>`;
      }
    }
    const hostName = `${name}-host`;
    customElements.define(hostName, Host);
    const host = (await fixture(html`<div></div>`)).appendChild(document.createElement(hostName)) as Host;
    await host.updateComplete;
    const child = host.shadowRoot!.querySelector(name) as Probe;
    expect(Object.hasOwn(child, 'total')).to.equal(true);
    defineProbe(name, seen);
    // The host re-renders synchronously before the child has run its first update.
    host.total = 100;
    (host as unknown as { performUpdate(): void }).performUpdate();
    await child.updateComplete;
    expect(child.total).to.equal(100);
    expect(seen.at(-1)).to.equal(100);
  });

  it('keeps first-update writes of the component itself after guarding a newer assignment', async () => {
    const name = nextTag();
    const element = document.createElement(name) as Probe;
    element.total = 5;
    document.body.append(element);
    try {
      defineProbe(name, [], 50);
      element.total = 100;
      element.label = 'only after upgrade';
      await element.updateComplete;
      expect(element.total).to.equal(50);
      expect(element.label).to.equal('only after upgrade');
      element.total = 7;
      await element.updateComplete;
      expect(element.total).to.equal(7);
    } finally {
      element.remove();
    }
  });

  it('leaves an element whose properties were never assigned before upgrade on its defaults', async () => {
    const name = nextTag();
    const element = document.createElement(name) as Probe;
    document.body.append(element);
    try {
      defineProbe(name);
      await element.updateComplete;
      expect(element.total).to.equal(0);
      expect(element.label).to.equal('default');
      expect(element.open).to.equal(false);
    } finally {
      element.remove();
    }
  });
});
