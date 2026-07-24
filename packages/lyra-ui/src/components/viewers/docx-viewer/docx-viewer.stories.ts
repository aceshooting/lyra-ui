import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './docx-viewer.js';
import { MINIMAL_DOCX_BASE64 } from './fixtures/minimal-docx-fixture.js';

const meta: Meta = {
  title: 'DocxViewer',
  component: 'lr-docx-viewer',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

const source = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${MINIMAL_DOCX_BASE64}`;

export const Default: Story = {
  render: () => html`<lr-docx-viewer style="max-inline-size: 32rem;" src=${source} name="fixture.docx"></lr-docx-viewer>`,
};

export const NoSourceSet: Story = {
  name: 'src unset — empty state',
  render: () => html`<lr-docx-viewer style="max-inline-size: 32rem;"></lr-docx-viewer>`,
};

export const MaxHeight: Story = {
  render: () => html`<lr-docx-viewer style="max-inline-size: 32rem;" max-height="8rem" src=${source} name="fixture.docx"></lr-docx-viewer>`,
};

export const FailedFetch: Story = {
  render: () => html`<lr-docx-viewer style="max-inline-size: 32rem;" src="https://example.invalid/missing.docx" name="missing.docx"></lr-docx-viewer>`,
};

/** Baseline narrow-allocation coverage with a long document name. */
export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lr-docx-viewer src=${source} name="International quarterly analytical-engine research report.docx"></lr-docx-viewer></div>`,
};
