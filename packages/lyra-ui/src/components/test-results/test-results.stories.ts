import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './test-results.js';
import type { TestSuiteResult } from './test-results.class.js';

const meta: Meta = {
  title: 'Test Results',
  component: 'lyra-test-results',
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
  render: () => html`<lyra-test-results style="max-width:32rem" .suites=${mixedSuites}></lyra-test-results>`,
};

export const MixedStatuses: Story = {
  name: 'Passed / Failed / Skipped / Running',
  render: () => html`<lyra-test-results style="max-width:32rem" .suites=${mixedSuites}></lyra-test-results>`,
};

export const Empty: Story = {
  render: () => html`<lyra-test-results></lyra-test-results>`,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () =>
    html`<div style="max-width:320px"><lyra-test-results .suites=${mixedSuites}></lyra-test-results></div>`,
};
