import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { adaptA2UiSurface } from '../../../ai/adapters/a2ui.js';
import type { MessagePart } from '../../../ai/types.js';
import { createWidgetTypeRegistry } from '../widget-renderer/registry.js';
import type { LyraWidgetRenderer } from '../widget-renderer/widget-renderer.class.js';
import type { LyraMessageParts } from './message-parts.class.js';
import '../../forms/input/input.js';
import '../../forms/button/button.js';
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

for (const removal of ['removed', 'windowed'] as const) {
  it(`creates a fresh widget document after its part is ${removal} and then restored`, async () => {
    const part: MessagePart = { id: 'form', type: 'data', widget };
    const el = await fixture<LyraMessageParts>(html`<lr-message-parts content-mode="plain"
      .parts=${[part]} .widgetRegistry=${registry} .widgetBindingState=${{ name: 'Ada' }}
    ></lr-message-parts>`);
    const first = await renderedWidget(el);
    const original = first.document;
    const text: MessagePart = { id: 'answer', type: 'text', text: 'Next answer' };
    if (removal === 'windowed') el.maxRenderedParts = 1;
    el.parts = removal === 'windowed' ? [part, text] : [text];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-widget-renderer') === null).to.equal(true);
    expect(first.isConnected).to.equal(false);
    el.widgetBindingState = { name: 'Grace' };
    el.maxRenderedParts = 0;
    el.parts = [part, text];
    await el.updateComplete;
    const restored = await renderedWidget(el);
    expect(restored.document === original).to.equal(false);
    expect(restored.shadowRoot!.querySelector<LyraInput>('lr-input')?.value).to.equal('Grace');
  });
}

for (const change of ['added', 'removed', 'renamed'] as const) {
  it(`refreshes a widget when an allowed property is ${change}`, async () => {
    const fields = createWidgetTypeRegistry([['field', {
      tag: 'lr-input', interaction: 'control',
      props: { value: 'string', label: 'string', placeholder: 'string' },
    }]]);
    const originalProps = change === 'removed' ? { value: 'Ada', label: 'Name' } : { value: 'Ada' };
    const nextProps = change === 'added' ? { value: 'Ada', label: 'Name' }
      : change === 'removed' ? { value: 'Ada' } : { placeholder: 'Name' };
    const el = await fixture<LyraMessageParts>(html`<lr-message-parts
      .parts=${[{ id: 'form', type: 'data', widget: { id: 'control', type: 'field', props: originalProps } }]}
      .widgetRegistry=${fields}
    ></lr-message-parts>`);
    const renderer = await renderedWidget(el);
    const original = renderer.document;
    el.parts = [{ id: 'form', type: 'data', widget: { id: 'control', type: 'field', props: nextProps } }];
    await el.updateComplete;
    await renderer.updateComplete;
    const input = renderer.shadowRoot!.querySelector<LyraInput>('lr-input')!;
    await input.updateComplete;
    expect(renderer.document === original).to.equal(false);
    expect(input.value).to.equal(change === 'renamed' ? '' : 'Ada');
    expect(input.label).to.equal(change === 'added' ? 'Name' : '');
    expect(input.placeholder).to.equal(change === 'renamed' ? 'Name' : '');
  });
}

it('keeps a widget with shared child properties stable across an unrelated text delta', async () => {
  const props = { value: { $bind: '/name' } };
  const root = { type: 'row', children: [
    { id: 'first', type: 'field', props }, { id: 'second', type: 'field', props },
  ] };
  const part: MessagePart = { id: 'form', type: 'data', widget: root };
  const el = await fixture<LyraMessageParts>(html`<lr-message-parts content-mode="plain"
    .parts=${[part]} .widgetRegistry=${registry} .widgetBindingState=${{ name: 'Ada' }}
  ></lr-message-parts>`);
  const renderer = await renderedWidget(el);
  const original = renderer.document;
  const controls = [...renderer.shadowRoot!.querySelectorAll<LyraInput>('lr-input')];
  el.parts = [{ id: 'answer', type: 'text', text: 'More detail' }, part];
  await el.updateComplete;
  await renderer.updateComplete;
  expect(renderer.document === original).to.equal(true);
  const updated = [...renderer.shadowRoot!.querySelectorAll<LyraInput>('lr-input')];
  expect(updated.length).to.equal(2);
  expect(updated.every((control, index) => control === controls[index])).to.equal(true);
  expect(updated.map(control => control.value)).to.deep.equal(['Ada', 'Ada']);
});

const actions = createWidgetTypeRegistry([['action', {
  tag: 'lr-button', interaction: 'control', action: { event: 'click' },
}]]);

for (const change of ['split aliases', 'join aliases', 'array to record', 'date'] as const) {
  it(`updates emitted widget payloads after ${change}`, async () => {
    const shared = { value: 'Ada' };
    const oldPayload = change === 'split aliases' ? { left: shared, right: shared }
      : change === 'join aliases' ? { left: { value: 'Ada' }, right: { value: 'Ada' } }
      : change === 'date' ? new Date(0) : ['Ada'];
    const nextPayload = change === 'split aliases' ? { left: { value: 'Ada' }, right: { value: 'Ada' } }
      : change === 'join aliases' ? { left: shared, right: shared }
      : change === 'date' ? new Date(1000) : { 0: 'Ada' };
    const root = { id: 'run', type: 'action', actionId: 'run', children: ['Run'], payload: oldPayload };
    const el = await fixture<LyraMessageParts>(html`<lr-message-parts
      .parts=${[{ id: 'tool', type: 'data', widget: root }]} .widgetRegistry=${actions}
    ></lr-message-parts>`);
    const renderer = await renderedWidget(el);
    el.parts = [{ id: 'tool', type: 'data', widget: { ...root, payload: nextPayload } }];
    await el.updateComplete;
    await renderer.updateComplete;
    const action = oneEvent(el, 'lr-widget-action');
    renderer.shadowRoot!.querySelector<HTMLElement>('lr-button')!.click();
    const event = await action;
    expect(event.detail.actionId).to.equal('run');
    expect(event.detail.payload).to.deep.equal(nextPayload);
    if (change === 'split aliases' || change === 'join aliases') {
      expect(event.detail.payload.left === event.detail.payload.right).to.equal(change === 'join aliases');
    } else if (change === 'date') expect(event.detail.payload.getTime()).to.equal(1000);
    else expect(Array.isArray(event.detail.payload)).to.equal(false);
  });
}

it('retains an equivalent cyclic action payload across a text delta', async () => {
  const payload: { value: string; self?: unknown } = { value: 'Ada' };
  payload.self = payload;
  const part: MessagePart = { id: 'tool', type: 'data', widget: {
    id: 'run', type: 'action', actionId: 'run', children: ['Run'], payload,
  } };
  const el = await fixture<LyraMessageParts>(html`<lr-message-parts content-mode="plain"
    .parts=${[part]} .widgetRegistry=${actions}
  ></lr-message-parts>`);
  const renderer = await renderedWidget(el);
  const original = renderer.document;
  el.parts = [{ id: 'answer', type: 'text', text: 'More detail' }, part];
  await el.updateComplete;
  await renderer.updateComplete;
  expect(renderer.document === original).to.equal(true);
  const action = oneEvent(el, 'lr-widget-action');
  renderer.shadowRoot!.querySelector<HTMLElement>('lr-button')!.click();
  const event = await action;
  expect(event.detail.payload.value).to.equal('Ada');
  expect(event.detail.payload.self === event.detail.payload).to.equal(true);
});
