import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './widget-renderer.js';
import { registerWidgetType, clearWidgetTypes, getDefaultWidgetTypeRegistry } from './registry.js';
import { registerDefaultWidgetTypes } from './default-registry.js';
import type { LyraWidgetRenderer } from './widget-renderer.js';
import type { WidgetNode } from './resolve.js';

async function captureWarnings(work: () => Promise<void>): Promise<string[]> {
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '));
  try {
    await work();
  } finally {
    console.warn = originalWarn;
  }
  return warnings;
}

describe('lr-widget-renderer', () => {
  beforeEach(() => {
    clearWidgetTypes();
    registerDefaultWidgetTypes();
  });

  it('defaults to tree=null and renders an empty base with no lr-render-error', async () => {
    const el = (await fixture(html`<lr-widget-renderer></lr-widget-renderer>`)) as LyraWidgetRenderer;
    expect(el.tree).to.be.null;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.children.length).to.equal(0);
  });

  it('renders a built-in row of two mapped stat widgets', async () => {
    const el = (await fixture(html`<lr-widget-renderer></lr-widget-renderer>`)) as LyraWidgetRenderer;
    el.tree = {
      type: 'row',
      props: { gap: 'm' },
      children: [
        { type: 'stat', props: { label: 'Users', value: '1,204' } },
        { type: 'stat', props: { label: 'Errors', value: '3' } },
      ],
    };
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="row"]')!;
    const stats = row.querySelectorAll('lr-stat');
    expect(stats.length).to.equal(2);
    expect((stats[0] as HTMLElement & { label: string }).label).to.equal('Users');
  });

  it('SECURITY: an unknown/disallowed type is silently skipped -- never rendered, never in the DOM', async () => {
    const el = (await fixture(html`<lr-widget-renderer></lr-widget-renderer>`)) as LyraWidgetRenderer;
    const warnings = await captureWarnings(async () => {
      el.tree = {
        type: 'row',
        children: [
          { type: 'evil-widget', props: { onclick: 'alert(1)' } },
          { type: 'stat', props: { label: 'ok', value: '1' } },
        ],
      };
      await el.updateComplete;
    });
    expect(warnings.join('\n')).to.include('evil-widget');
    expect(el.shadowRoot!.innerHTML).to.not.include('evil-widget');
    expect(el.shadowRoot!.querySelectorAll('lr-stat').length).to.equal(1);
  });

  it('SECURITY: a disallowed prop is never assigned to the underlying element', async () => {
    const el = (await fixture(html`<lr-widget-renderer></lr-widget-renderer>`)) as LyraWidgetRenderer;
    const warnings = await captureWarnings(async () => {
      el.tree = { type: 'card', props: { appearance: 'outlined', href: 'https://evil.example/' } };
      await el.updateComplete;
    });
    expect(warnings.join('\n')).to.include('href');
    const card = el.shadowRoot!.querySelector('lr-card') as HTMLElement & { href?: string; appearance: string };
    expect(card.appearance).to.equal('outlined');
    expect(card.href).to.be.undefined; // 'href' is not in card's allowlist -- never assigned
  });

  it("emits lr-widget-action with actionId/payload when a mapped button's action event fires", async () => {
    const el = (await fixture(html`<lr-widget-renderer></lr-widget-renderer>`)) as LyraWidgetRenderer;
    el.tree = { type: 'button', props: { variant: 'brand' }, actionId: 'submit', payload: { formId: 'f1' } };
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('lr-button')!;
    const listener = oneEvent(el, 'lr-widget-action');
    button.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
    const event = (await listener) as CustomEvent<{ actionId: string; payload: unknown }>;
    expect(event.detail).to.deep.equal({ actionId: 'submit', payload: { formId: 'f1' } });
  });

  it('emits lr-render-error for a structurally unusable non-null tree', async () => {
    const el = (await fixture(html`<lr-widget-renderer></lr-widget-renderer>`)) as LyraWidgetRenderer;
    const warnings = await captureWarnings(async () => {
      const listener = oneEvent(el, 'lr-render-error');
      el.tree = { type: 'totally-unknown-root-type' };
      await el.updateComplete;
      await listener;
    });
    expect(warnings.join('\n')).to.include('totally-unknown-root-type');
  });

  it('reconciles a streamed update in place: the same mapped element instance survives a re-resolve', async () => {
    const el = (await fixture(html`<lr-widget-renderer></lr-widget-renderer>`)) as LyraWidgetRenderer;
    el.tree = { type: 'stat', id: 's1', props: { label: 'Users', value: '100' } };
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector('lr-stat');
    el.tree = { type: 'stat', id: 's1', props: { label: 'Users', value: '101' } };
    await el.updateComplete;
    const second = el.shadowRoot!.querySelector('lr-stat');
    expect(second).to.equal(first); // same DOM element instance, not recreated
    expect((second as HTMLElement & { value: string }).value).to.equal('101');
  });

  it('renders raw string children as text, and card children default-slotted unless allowlisted', async () => {
    const el = (await fixture(html`<lr-widget-renderer></lr-widget-renderer>`)) as LyraWidgetRenderer;
    el.tree = { type: 'text', children: ['hello world'] };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="text"]')!.textContent).to.include('hello world');
  });

  it('a custom per-instance registry overrides the default one', async () => {
    const custom = new Map();
    custom.set('custom-badge', { tag: 'lr-badge', props: { variant: 'string' } });
    const el = (await fixture(html`<lr-widget-renderer></lr-widget-renderer>`)) as LyraWidgetRenderer;
    el.registry = custom;
    el.tree = { type: 'custom-badge', props: { variant: 'success' } };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-badge')).to.exist;
  });

  it('registerWidgetType() extends the default registry app-side', async () => {
    registerWidgetType('my-badge', { tag: 'lr-badge', props: { variant: 'string' } });
    expect(getDefaultWidgetTypeRegistry().has('my-badge')).to.be.true;
    const el = (await fixture(html`<lr-widget-renderer></lr-widget-renderer>`)) as LyraWidgetRenderer;
    el.tree = { type: 'my-badge', props: { variant: 'success' } };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-badge')).to.exist;
  });

  it('the image built-in maps to lr-media-card with kind forced to "image"', async () => {
    const el = (await fixture(html`<lr-widget-renderer></lr-widget-renderer>`)) as LyraWidgetRenderer;
    el.tree = { type: 'image', props: { src: 'https://example.com/a.png', alt: 'a', filename: 'a.png' } };
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector('lr-media-card') as HTMLElement & { kind: string };
    expect(card.kind).to.equal('image');
  });

  it('is accessible with a mixed row/col/mapped tree', async () => {
    const el = (await fixture(html`<lr-widget-renderer></lr-widget-renderer>`)) as LyraWidgetRenderer;
    const tree: WidgetNode = {
      type: 'row',
      children: [
        { type: 'stat', props: { label: 'Users', value: '1,204' } },
        { type: 'button', props: { variant: 'brand' }, actionId: 'go', children: ['Go'] },
      ],
    };
    el.tree = tree;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
