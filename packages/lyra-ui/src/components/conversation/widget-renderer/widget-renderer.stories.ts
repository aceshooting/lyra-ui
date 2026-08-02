import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import '../../forms/input/input.js';
import { tag } from '../../../internal/prefix.js';
import './widget-renderer.js';
import type { LyraWidgetDocument, WidgetNode } from './resolve.js';
import type { WidgetTypeRegistry } from './registry.js';
import type { LyraWidgetRenderer } from './widget-renderer.js';

const meta: Meta = {
  title: 'Widget Renderer',
  component: 'lr-widget-renderer',
};
export default meta;
type Story = StoryObj;

const dashboard: WidgetNode = {
  type: 'col',
  props: { gap: 'm' },
  children: [
    {
      type: 'row',
      props: { gap: 'm' },
      children: [
        { type: 'stat', props: { label: 'Users', value: '1,204' } },
        { type: 'stat', props: { label: 'Errors', value: '3', variant: 'danger' } },
      ],
    },
    { type: 'button', props: { variant: 'brand' }, actionId: 'refresh', children: ['Refresh'] },
  ],
};

const unsafeTree: WidgetNode = {
  type: 'row',
  children: [
    { type: 'evil-widget', props: { onclick: 'alert(1)' } },
    { type: 'stat', props: { label: 'Still renders', value: 'safely' } },
  ],
};

export const Default: Story = {
  render: () =>
    html`<lr-widget-renderer style="display:block;max-width:32rem" .tree=${dashboard}></lr-widget-renderer>`,
};

export const SecurityAllowlistDemo: Story = {
  render: () =>
    html`<lr-widget-renderer style="display:block;max-width:32rem" .tree=${unsafeTree}></lr-widget-renderer>`,
};

export const ControlledDocumentBinding: Story = {
  render: () => {
    const registry: WidgetTypeRegistry = new Map([
      [
        'bound-input',
        {
          tag: tag('input'),
          props: { label: 'string', value: 'string' },
          bindings: { value: { event: 'lr-input' } },
        },
      ],
    ]);
    const widgetDocument: LyraWidgetDocument = {
      version: '1',
      state: { name: 'Ada' },
      root: {
        type: 'bound-input',
        id: 'name',
        props: { label: 'Name', value: { $bind: '/name', fallback: '' } },
      },
    };
    const handleStateChange = (
      event: CustomEvent<{ path: string; value: unknown; nodeId: string; prop: string }>,
    ): void => {
      const renderer = event.currentTarget as LyraWidgetRenderer;
      renderer.state = { name: event.detail.value };
      const output = renderer.nextElementSibling;
      if (output instanceof HTMLOutputElement) {
        output.textContent = JSON.stringify(event.detail);
      }
    };

    return html`
      <div style="display:grid;gap:var(--lr-space-s);max-width:32rem">
        <lr-widget-renderer
          .document=${widgetDocument}
          .registry=${registry}
          @lr-widget-state-change=${handleStateChange}
        ></lr-widget-renderer>
        <output aria-live="polite">Edit the field to request a controlled state update.</output>
      </div>
    `;
  },
};

export const Narrow320: Story = {
  render: () =>
    html`<div style="max-width:320px">
      <lr-widget-renderer style="display:block" .tree=${dashboard}></lr-widget-renderer>
    </div>`,
};
