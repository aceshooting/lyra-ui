import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Citation, GroundedClaim } from '../../../ai/types.js';
import './claim-evidence.js';

const meta: Meta = {
  title: 'Claim Evidence',
  component: 'lr-claim-evidence',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const claims: GroundedClaim[] = [
  {
    id: 'claim-1',
    text: 'Enterprise revenue increased by 18% year over year.',
    status: 'supported',
    citationIds: ['cite-1'],
    confidence: 0.96,
  },
  {
    id: 'claim-2',
    text: 'All regional segments exceeded their annual targets.',
    status: 'partially-supported',
    citationIds: [],
    explanation: 'The source reports targets for only two of the four regions.',
  },
];

const citations: Citation[] = [
  {
    id: 'cite-1',
    sourceId: 'annual-report',
    label: 'Annual report, page 12',
    quote: 'Enterprise revenue increased by 18% compared with the prior year.',
  },
];

const renderClaimEvidence = () => html`
  <lr-claim-evidence
    selected-claim-id="claim-1"
    .claims=${claims}
    .citations=${citations}
  ></lr-claim-evidence>
`;

export const Default: Story = {
  render: renderClaimEvidence,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;">${renderClaimEvidence()}</div>`,
};
