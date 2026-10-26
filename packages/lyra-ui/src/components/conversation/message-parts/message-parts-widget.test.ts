import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { adaptA2UiSurface } from '../../../ai/adapters/a2ui.js';
import type { MessagePart } from '../../../ai/types.js';
import { createWidgetTypeRegistry } from '../widget-renderer/registry.js';
import type { LyraWidgetRenderer } from '../widget-renderer/widget-renderer.class.js';
import type { LyraMessageParts } from './message-parts.class.js';
import '../../forms/input/input.js';
import type { LyraInput } from '../../forms/input/input.class.js';
import './message-parts.js';

const widget = { id: 'control', type: 'field', props: { value: { $bind: '/name' } } };
const registry = createWidgetTypeRegistry([['field', {
  tag: 'lr-input', interaction: 'control', props: { value: 'string' },
  bindings: { value: { event: 'lr-input' } },
}]]);

async function renderedWidget(el: LyraMessageParts): Promise<LyraWidgetRenderer> {
  await waitUntil(() => Boolean(el.shadowRoot?.querySelector('lr-widget-renderer')), undefined, { timeout: 5000 });
  const renderer = el.shadowRoot!.querySelector('lr-widget-renderer') as LyraWidgetRenderer;
  await renderer.updateComplete;
  return renderer;
}

it('forwards the widget registry and explicit binding state into a bound part', async () => {
  const adapted = adaptA2UiSurface({ rootId: 'control', components: [
    { id: 'control', type: 'Field', props: { value: { $bind: '/name' } } },
  ], data: { name: 'Ada' } }, { Field: 'field' });
  const el = await fixture<LyraMessageParts>(html`<lr-message-parts
    .parts=${[{ id: 'form', type: 'data', widget: adapted!.root }]}
    .widgetRegistry=${registry} .widgetBindingState=${adapted!.bindingState}
  ></lr-message-parts>`);
  const renderer = await renderedWidget(el);
  expect(renderer.registry === registry).to.equal(true);
  expect(renderer.shadowRoot!.querySelector<LyraInput>('lr-input')?.value).to.equal('Ada');
  const requested = oneEvent(el, 'lr-widget-state-change');
  const input = renderer.shadowRoot!.querySelector<LyraInput>('lr-input')!;
  input.dispatchEvent(new CustomEvent('lr-input', { bubbles: true, composed: true, detail: { value: 'Grace' } }));
  const event = await requested;
  expect(event.detail.path).to.equal('/name');
  expect(event.detail.value).to.equal('Grace');
  expect((el.widgetBindingState as { name: string }).name).to.equal('Ada');
  el.widgetBindingState = { name: 'Grace' };
  await el.updateComplete;
  await renderer.updateComplete;
  expect(renderer.shadowRoot!.querySelector<LyraInput>('lr-input')?.value).to.equal('Grace');
});

it('keeps widget documents stable across unrelated text deltas and invalidates changed widgets', async () => {
  const parts: MessagePart[] = [
    { id: 'answer', type: 'text', text: 'First' },
    { id: 'form', type: 'data', widget },
  ];
  const el = await fixture<LyraMessageParts>(html`<lr-message-parts content-mode="plain"
    .parts=${parts} .widgetRegistry=${registry} .widgetBindingState=${{ name: 'Ada' }}
  ></lr-message-parts>`);
  const renderer = await renderedWidget(el);
  const original = renderer.document;
  el.parts = [{ id: 'answer', type: 'text', text: 'First delta' }, parts[1]!];
  await el.updateComplete;
  await renderer.updateComplete;
  expect(renderer.document === original).to.equal(true);
  el.parts = [{ id: 'form', type: 'data', widget: { ...widget, props: { value: 'New' } } }];
  await el.updateComplete;
  await renderer.updateComplete;
  expect(renderer.document === original).to.equal(false);
  expect(renderer.shadowRoot!.querySelector<LyraInput>('lr-input')?.value).to.equal('New');
});

it('lets the existing custom-part hook replace a widget without loading its built-in renderer', async () => {
  const el = await fixture<LyraMessageParts>(html`<lr-message-parts
    .parts=${[{ id: 'custom', type: 'data', widget }]}
    .renderPart=${(part: MessagePart) => part.id === 'custom' ? html`<strong>Host-owned control</strong>` : undefined}
  ></lr-message-parts>`);
  expect(el.shadowRoot!.querySelector('strong')?.textContent).to.equal('Host-owned control');
  expect(el.shadowRoot!.querySelector('lr-widget-renderer') === null).to.equal(true);
});
