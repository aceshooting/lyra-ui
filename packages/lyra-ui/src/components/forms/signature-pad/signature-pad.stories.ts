import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { SignatureStroke } from './signature-pad.class.js';
import './signature-pad.js';

const meta: Meta = {
  title: 'Forms & Inputs/Signature Pad',
  component: 'lr-signature-pad',
  tags: ['autodocs'],
};

export default meta;

const SIGNATURE: SignatureStroke[] = [
  [[0.08, 0.66], [0.13, 0.3], [0.18, 0.7], [0.24, 0.34], [0.3, 0.68], [0.36, 0.5]],
  [[0.42, 0.62], [0.5, 0.42], [0.58, 0.64], [0.68, 0.4], [0.78, 0.62], [0.9, 0.48]],
];

export const Default: StoryObj = {
  render: () => html`
    <lr-signature-pad
      name="signature"
      label="Signature"
      hint="Sign with a mouse, a finger, a stylus or the keyboard."
      required
    ></lr-signature-pad>
  `,
};

export const Signed: StoryObj = {
  render: () => html`<lr-signature-pad label="Signature" .strokes=${SIGNATURE}></lr-signature-pad>`,
};

export const Disabled: StoryObj = {
  render: () => html`<lr-signature-pad label="Signature" disabled .strokes=${SIGNATURE}></lr-signature-pad>`,
};

export const NarrowPanel: StoryObj = {
  render: () => html`
    <div style="inline-size: 320px">
      <lr-signature-pad
        label="Signature of the account holder"
        hint="The signature is submitted as a PNG image."
        .strokes=${SIGNATURE}
      ></lr-signature-pad>
    </div>
  `,
};
