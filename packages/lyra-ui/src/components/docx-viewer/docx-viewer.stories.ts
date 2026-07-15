import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './docx-viewer.js';
import { MINIMAL_DOCX_BASE64 } from './fixtures/minimal-docx-fixture.js';

const meta: Meta = {
  title: 'DocxViewer',
  component: 'lyra-docx-viewer',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

const source = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${MINIMAL_DOCX_BASE64}`;

export const Default: Story = {
  render: () => html`<lyra-docx-viewer style="max-inline-size: 32rem;" src=${source} name="fixture.docx"></lyra-docx-viewer>`,
};

export const NoSourceSet: Story = {
  name: 'src unset — empty state',
  render: () => html`<lyra-docx-viewer style="max-inline-size: 32rem;"></lyra-docx-viewer>`,
};

export const MaxHeight: Story = {
  render: () => html`<lyra-docx-viewer style="max-inline-size: 32rem;" max-height="8rem" src=${source} name="fixture.docx"></lyra-docx-viewer>`,
};

export const FailedFetch: Story = {
  render: () => html`<lyra-docx-viewer style="max-inline-size: 32rem;" src="https://example.invalid/missing.docx" name="missing.docx"></lyra-docx-viewer>`,
};
