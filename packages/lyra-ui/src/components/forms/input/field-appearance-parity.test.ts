import { expect, fixture } from '@open-wc/testing';
import { unsafeStatic, html as staticHtml } from 'lit/static-html.js';
import './input.js';
import './time-input.js';
import '../textarea/textarea.js';
import '../date-picker/date-input.js';
import '../phone-input/phone-input.js';
import '../otp-input/otp-input.js';

type Updating = HTMLElement & { updateComplete: Promise<unknown> };

/** Fields that share a form row: the part painting the surface and the focus target. */
const FIELDS = [
  { tag: 'lr-input', surface: '[part~="input-wrapper"]', focus: '[part="input"]' },
  { tag: 'lr-textarea', surface: '[part~="textarea"]', focus: '[part="textarea"]' },
  { tag: 'lr-date-input', surface: '[part~="input-wrapper"]', focus: '[part="input"]' },
  { tag: 'lr-time-input', surface: '[part~="time-input"]', focus: '[part="segment"]' },
  { tag: 'lr-phone-input', surface: '[part~="input-wrapper"]', focus: '[part="input"]' },
] as const;

async function mount(tag: string, appearance: string): Promise<Updating> {
  const el = await fixture<Updating>(
    staticHtml`<${unsafeStatic(tag)} label="Field" appearance=${appearance} style="--lr-transition-fast: 0s"></${unsafeStatic(tag)}>`
  );
  await el.updateComplete;
  return el;
}

function paint(el: HTMLElement, selector: string): string {
  const cs = getComputedStyle(el.shadowRoot!.querySelector(selector)!);
  return `${cs.backgroundColor} | ${cs.borderTopColor} | ${cs.color}`;
}

describe('text and date field appearance parity', () => {
  for (const appearance of ['outlined', 'filled-outlined', 'filled', 'plain', 'accent']) {
    it(`paints appearance="${appearance}" the same on every field`, async () => {
      const paints: string[] = [];
      for (const field of FIELDS) {
        paints.push(`${field.tag}: ${paint(await mount(field.tag, appearance), field.surface)}`);
      }
      const reference = paints[0]!.split(': ')[1];
      expect(paints).to.deep.equal(FIELDS.map((field) => `${field.tag}: ${reference}`));
    });
  }

  it('gives lr-otp-input segments the same fill and border as the other fields', async () => {
    for (const appearance of ['outlined', 'filled-outlined', 'filled']) {
      const input = await mount('lr-input', appearance);
      const otp = await mount('lr-otp-input', appearance);
      const fill = (el: HTMLElement, selector: string) => {
        const cs = getComputedStyle(el.shadowRoot!.querySelector(selector)!);
        return `${cs.backgroundColor} | ${cs.borderTopColor}`;
      };
      expect(fill(otp, '[part~="segment"]'), appearance).to.equal(fill(input, '[part~="input-wrapper"]'));
    }
  });

  it('shows focus the same way on every field: a brand edge and no extra outline ring', async () => {
    const cues: string[] = [];
    for (const field of FIELDS) {
      const el = await mount(field.tag, 'outlined');
      (el.shadowRoot!.querySelector(field.focus) as HTMLElement).focus();
      await el.updateComplete;
      const cs = getComputedStyle(el.shadowRoot!.querySelector(field.surface)!);
      cues.push(`${field.tag}: ${cs.borderTopColor} ${cs.outlineStyle}`);
    }
    const reference = cues[0]!.split(': ')[1];
    expect(cues).to.deep.equal(FIELDS.map((field) => `${field.tag}: ${reference}`));
    expect(reference!.endsWith(' none')).to.equal(true);
  });
});
