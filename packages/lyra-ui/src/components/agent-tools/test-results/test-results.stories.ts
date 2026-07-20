import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './test-results.js';
import type { TestSuiteResult } from './test-results.class.js';

const meta: Meta = {
  title: 'Test Results',
  component: 'lr-test-results',
};
export default meta;
type Story = StoryObj;

const mixedSuites: TestSuiteResult[] = [
  {
    id: 's1',
    name: 'math.test.ts',
    tests: [
      { id: 't1', name: 'adds numbers', status: 'passed', durationMs: 4 },
      { id: 't2', name: 'subtracts numbers', status: 'failed', durationMs: 9, message: 'expected 2 got 3' },
      { id: 't3', name: 'divides by zero', status: 'skipped' },
    ],
  },
  {
    id: 's2',
    name: 'network.test.ts',
    tests: [{ id: 't4', name: 'retries on 500', status: 'running' }],
  },
];

export const Default: Story = {
  render: () => html`<lr-test-results style="max-width:32rem" .suites=${mixedSuites}></lr-test-results>`,
};

export const MixedStatuses: Story = {
  name: 'Passed / Failed / Skipped / Running',
  render: () => html`<lr-test-results style="max-width:32rem" .suites=${mixedSuites}></lr-test-results>`,
};

export const Empty: Story = {
  render: () => html`<lr-test-results></lr-test-results>`,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () =>
    html`<div style="max-width:320px"><lr-test-results .suites=${mixedSuites}></lr-test-results></div>`,
};

export const RetintedActiveFilter: Story = {
  name: 'Retinted active filter toggle',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-test-results-filter-active-bg`, `-border`, and `-color` retint the pressed (active) status filter toggle. `::part(filter-toggle)[aria-pressed]` is invalid CSS, so without these props the active toggle could only be restyled by overriding the library-wide brand tokens. Unset, it renders exactly as before.',
      },
    },
  },
  render: () => html`
    <lr-test-results
      style="max-width:32rem;--lr-test-results-filter-active-bg: var(--lr-color-success-quiet);--lr-test-results-filter-active-border: var(--lr-color-success);--lr-test-results-filter-active-color: var(--lr-color-success)"
      .suites=${mixedSuites}
      .statusFilter=${['passed']}
    ></lr-test-results>
  `,
};
