import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tool-param-form.js';
import type { LyraToolParamForm, ToolParamFormSchema } from './tool-param-form.js';

const meta: Meta = {
  title: 'ToolParamForm',
  component: 'lr-tool-param-form',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const weatherSchema: ToolParamFormSchema = {
  type: 'object',
  properties: {
    city: {
      type: 'string',
      title: 'City',
      description: 'Where to look up the forecast.',
    },
    units: {
      type: 'string',
      title: 'Units',
      enum: ['celsius', 'fahrenheit'],
      default: 'celsius',
    },
    days: {
      type: 'integer',
      title: 'Forecast days',
      description: 'How many days ahead to include.',
      default: 3,
    },
    includeHourly: {
      type: 'boolean',
      title: 'Include hourly breakdown',
    },
  },
  required: ['city'],
};

/**
 * A tool-invocation form for a `get_weather(city, units, days, includeHourly)`
 * call — one control per parameter, in schema order. `city` is required and
 * empty, so its inline error only appears once the field is visited or
 * `reportValidity()` is called (see the "ReportValidity" story below).
 */
export const Default: Story = {
  render: () => html`
    <lr-tool-param-form style="max-width: 24rem" .schema=${weatherSchema}></lr-tool-param-form>
  `,
};

/** A field with no entry in `value` still displays (and gets emitted with) its schema `default`. */
export const PrefilledValue: Story = {
  render: () => html`
    <lr-tool-param-form
      style="max-width: 24rem"
      .schema=${weatherSchema}
      .value=${{ city: 'Lisbon', units: 'fahrenheit', includeHourly: true }}
    ></lr-tool-param-form>
  `,
};

/**
 * Calling `reportValidity()` (the hook a consumer's own Approve/Run button
 * should call right before acting) reveals inline errors immediately,
 * without requiring the user to first blur the field.
 */
export const ReportValidity: Story = {
  render: () => {
    const onRun = (e: Event) => {
      const form = (e.target as HTMLElement).closest('.demo')!.querySelector('lr-tool-param-form') as LyraToolParamForm;
      const status = (e.target as HTMLElement).closest('.demo')!.querySelector('.status') as HTMLElement;
      const valid = form.reportValidity();
      status.textContent = valid ? `Valid — would call with ${JSON.stringify(form.effectiveValue)}` : 'Invalid — see errors above';
    };
    return html`
      <div class="demo" style="max-width: 24rem; display: flex; flex-direction: column; gap: 1rem">
        <lr-tool-param-form .schema=${weatherSchema}></lr-tool-param-form>
        <button type="button" @click=${onRun}>Run tool</button>
        <p class="status" style="font-size: 0.875rem"></p>
      </div>
    `;
  },
};

/** Live `lr-input`/`lr-validity-change` events, mirroring what a consumer's dialog would listen for. */
export const LiveEvents: Story = {
  render: () => {
    const onEvent = (e: Event) => {
      const log = (e.target as HTMLElement).closest('.demo')!.querySelector('.log') as HTMLElement;
      const detail = (e as CustomEvent).detail;
      log.textContent = `${e.type}: ${JSON.stringify(detail)}`;
    };
    return html`
      <div class="demo" style="max-width: 26rem; display: flex; flex-direction: column; gap: 1rem">
        <lr-tool-param-form
          .schema=${weatherSchema}
          @lr-input=${onEvent}
          @lr-validity-change=${onEvent}
        ></lr-tool-param-form>
        <pre class="log" style="font-size: 0.75rem; white-space: pre-wrap; word-break: break-all"></pre>
      </div>
    `;
  },
};

/** A schema with no properties renders an empty (but still valid) form. */
export const EmptySchema: Story = {
  render: () => html`
    <lr-tool-param-form style="max-width: 24rem" .schema=${{ type: 'object', properties: {} }}></lr-tool-param-form>
  `,
};

const enumHeavySchema: ToolParamFormSchema = {
  type: 'object',
  properties: {
    priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    assignee: { type: 'string', title: 'Assignee', description: 'Team member to notify.' },
    dueInDays: { type: 'number', title: 'Due in (days)' },
    private: { type: 'boolean', title: 'Mark as private' },
  },
  required: ['assignee', 'private'],
};

/** All four supported field kinds together, including a `number` (non-integer) field and a required boolean. */
export const AllFieldKinds: Story = {
  render: () => html`
    <lr-tool-param-form style="max-width: 24rem" .schema=${enumHeavySchema}></lr-tool-param-form>
  `,
};
