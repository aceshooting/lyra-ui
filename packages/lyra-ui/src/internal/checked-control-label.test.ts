import { expect, fixture, html as fixtureHtml, waitUntil } from '@open-wc/testing';
import { LitElement, html } from 'lit';
import { state } from 'lit/decorators.js';
import { CheckedControlLabelController } from './checked-control-label.js';
import { LyraElement } from './lyra-element.js';

class LabelHost extends LyraElement {
  @state() hasLabel = false;
  samples = 0;
  firstRenderLabel?: boolean;
  readonly label = new CheckedControlLabelController(this, {
    changed: (present) => { this.samples += 1; this.hasLabel = present; },
  });

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.label.adopted();
  }

  protected override render() {
    this.firstRenderLabel ??= this.hasLabel;
    return html`<span part="label" ?hidden=${!this.hasLabel}><slot @slotchange=${this.label.onSlotChange}></slot></span
      ><slot name="hint" @slotchange=${this.label.onSlotChange}></slot>`;
  }
}
customElements.define('h3c-label-host', LabelHost);

/** Keeps a parser-attached server shadow root as its render root, as Lit's hydration support does,
 *  so the server's default slot is assigned (and signals `slotchange`) before the first update. */
class ServerShadowLabelHost extends LabelHost {
  protected override createRenderRoot() {
    return this.shadowRoot ?? super.createRenderRoot();
  }
}
customElements.define('h3c-server-shadow-label-host', ServerShadowLabelHost);

class AllSlotsHost extends LitElement {
  samples = 0;
  readonly label = new CheckedControlLabelController(this, {
    changed: () => { this.samples += 1; },
    slot: () => this.renderRoot.querySelector<HTMLSlotElement>('slot[data-label]'),
    observedSlots: [],
  });

  protected override render() {
    return html`<slot name="start"></slot><slot data-label></slot>`;
  }
}
customElements.define('h3c-all-slots-host', AllSlotsHost);

class ForwardingHost extends LitElement {
  protected override render() {
    return html`<h3c-label-host><slot></slot></h3c-label-host>`;
  }
}
customElements.define('h3c-forwarding-label-host', ForwardingHost);

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

describe('CheckedControlLabelController', () => {
  it('seeds presence before the first render and ignores whitespace and named-slot content', async () => {
    const el = await fixture<LabelHost>(fixtureHtml`<h3c-label-host>Accept terms</h3c-label-host>`);
    expect([el.firstRenderLabel, el.label.present]).to.deep.equal([true, true]);
    const blank = await fixture<LabelHost>(fixtureHtml`<h3c-label-host>   <span slot="hint">Hint</span></h3c-label-host>`);
    expect([blank.firstRenderLabel, blank.label.present, blank.hasLabel]).to.deep.equal([false, false, false]);
  });

  it('defers every sample past a server-rendered first render, then reveals the label', async () => {
    const container = await fixture<HTMLDivElement & { setHTMLUnsafe(value: string): void }>(fixtureHtml`<div></div>`);
    container.setHTMLUnsafe('<h3c-server-shadow-label-host><template shadowrootmode="open">' +
      '<span part="label" hidden><slot></slot></span></template>Accept terms</h3c-server-shadow-label-host>');
    const el = container.firstElementChild as ServerShadowLabelHost;
    await el.updateComplete;
    expect(el.firstRenderLabel, 'the hydrating render matches the label-less server markup').to.equal(false);
    await waitUntil(() => el.hasLabel, 'label revealed after hydration');
    expect(el.label.present).to.equal(true);
  });

  it('follows slot assignment and projected text mutations, not hint content', async () => {
    const el = await fixture<LabelHost>(fixtureHtml`<h3c-label-host><b></b></h3c-label-host>`);
    expect(el.label.present, 'an element child counts').to.equal(true);
    el.replaceChildren(document.createTextNode(' '));
    await waitUntil(() => !el.label.present, 'emptied label');
    const text = document.createTextNode('');
    el.replaceChildren(text);
    await el.updateComplete;
    text.data = 'Later';
    await waitUntil(() => el.label.present, 'text mutation');
    await settle();
    const before = el.samples;
    const hint = document.createElement('span');
    hint.slot = 'hint';
    el.append(hint);
    hint.textContent = 'changed';
    await settle();
    expect(el.samples, 'hint content does not resample').to.equal(before);
  });

  it('tracks a forwarding slot below the host and resamples on reconnect', async () => {
    const outer = await fixture<ForwardingHost>(fixtureHtml`<h3c-forwarding-label-host></h3c-forwarding-label-host>`);
    const inner = outer.renderRoot.querySelector<LabelHost>('h3c-label-host')!;
    await inner.updateComplete;
    expect(inner.label.present, 'forwarded nothing').to.equal(false);
    outer.append('Forwarded');
    await waitUntil(() => inner.label.present, 'forwarded text');
    const seededOuter = await fixture<ForwardingHost>(fixtureHtml`<h3c-forwarding-label-host>Seeded</h3c-forwarding-label-host>`);
    const seeded = seededOuter.renderRoot.querySelector<LabelHost>('h3c-label-host')!;
    await seeded.updateComplete;
    expect(seeded.firstRenderLabel, 'forwarded content seeds the first render').to.equal(true);
    const el = await fixture<LabelHost>(fixtureHtml`<h3c-label-host></h3c-label-host>`);
    const parent = el.parentElement!;
    el.remove();
    el.append('Added while detached');
    parent.append(el);
    expect(el.label.present, 'reconnect samples at once').to.equal(true);
  });

  it('ignores slotchange from unrelated targets and samples nothing before a render root exists', async () => {
    const el = await fixture<LabelHost>(fixtureHtml`<h3c-label-host><b></b><span slot="hint">Hint</span></h3c-label-host>`);
    await settle();
    const samples = el.samples;
    el.label.onSlotChange(new Event('slotchange'));
    el.querySelector('span')!.dispatchEvent(new Event('slotchange', { bubbles: true }));
    const foreignSlot = document.createElement('slot');
    foreignSlot.slot = 'hint';
    el.append(foreignSlot);
    foreignSlot.dispatchEvent(new Event('slotchange', { bubbles: true }));
    await settle();
    expect(el.samples).to.equal(samples);
    const detached = document.createElement('h3c-label-host') as LabelHost;
    detached.append('Text');
    detached.label.refresh();
    expect([detached.label.present, detached.samples]).to.deep.equal([false, 0]);
  });

  it('observes every slot when asked, with a custom label slot', async () => {
    const el = await fixture<AllSlotsHost>(fixtureHtml`<h3c-all-slots-host><i slot="start"></i></h3c-all-slots-host>`);
    expect(el.label.present, 'only the custom label slot counts').to.equal(false);
    await settle();
    const before = el.samples;
    el.querySelector('i')!.textContent = 'icon';
    await waitUntil(() => el.samples > before, 'start mutation resampled');
    expect(el.label.present).to.equal(false);
  });

  it('keeps observing text after adoption into another document', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    try {
      await new Promise<void>(resolve => {
        if (iframe.contentDocument?.readyState === 'complete') resolve();
        else iframe.addEventListener('load', () => resolve(), { once: true });
      });
      const el = await fixture<LabelHost>(fixtureHtml`<h3c-label-host><b></b></h3c-label-host>`);
      const text = document.createTextNode('');
      el.replaceChildren(text);
      await waitUntil(() => !el.label.present, 'emptied');
      const foreign = iframe.contentDocument!;
      foreign.body.append(foreign.adoptNode(el));
      await el.updateComplete;
      text.data = 'Moved';
      await waitUntil(() => el.label.present, 'text mutation in the new realm');
    } finally {
      iframe.remove();
    }
  });
});
