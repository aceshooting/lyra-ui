import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './grounding-summary.js';
import type { Citation, GroundingAssessment } from '../../ai/types.js';

const meta: Meta = {
  title: 'Grounding Summary',
  component: 'lr-grounding-summary',
};
export default meta;
type Story = StoryObj;

const assessment: GroundingAssessment = {
  supportedClaims: 8,
  unsupportedClaims: 1,
  coverage: 0.89,
};

const assessmentWithConfidenceAndWarnings: GroundingAssessment = {
  supportedClaims: 6,
  unsupportedClaims: 3,
  coverage: 0.61,
  confidence: 0.42,
  warnings: [
    'One claim could not be matched to a source.',
    'Two claims cite the same source but different pages.',
  ],
};

const citations: Citation[] = [
  { id: 'cite-1', sourceId: 'doc-1', label: 'annual_report.pdf', span: { start: 128, end: 214 } },
  { id: 'cite-2', sourceId: 'doc-2', label: 'q3_transcript.pdf', span: { start: 0, end: 96 } },
  { id: 'cite-3', sourceId: 'doc-1' },
];

export const Default: Story = {
  render: () => html`<lr-grounding-summary .assessment=${assessment}></lr-grounding-summary>`,
};

export const Empty: Story = {
  render: () => html`<lr-grounding-summary></lr-grounding-summary>`,
};

export const WithConfidenceAndWarnings: Story = {
  render: () => html`<lr-grounding-summary .assessment=${assessmentWithConfidenceAndWarnings}></lr-grounding-summary>`,
};

export const WithEvidence: Story = {
  render: () => html`
    <lr-grounding-summary
      label="Answer grounding"
      .assessment=${assessmentWithConfidenceAndWarnings}
      .citations=${citations}
      @lr-citation-select=${(e: CustomEvent<{ citation: Citation }>) => console.log('lr-citation-select', e.detail)}
    ></lr-grounding-summary>
  `,
};

export const Narrow: Story = {
  render: () => html`
    <div style="max-width: 320px;">
      <lr-grounding-summary .assessment=${assessmentWithConfidenceAndWarnings} .citations=${citations}></lr-grounding-summary>
    </div>
  `,
};
