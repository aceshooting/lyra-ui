import { expect, fixture } from '@open-wc/testing';
import { unsafeStatic, html as staticHtml } from 'lit/static-html.js';
import '../../lr-input.js';
import '../../lr-time-input.js';
import '../../lr-textarea.js';
import '../../lr-date-input.js';
import '../../lr-phone-input.js';
import '../../lr-otp-input.js';
import '../../lr-token-input.js';
import '../../lr-code-editor.js';
import '../../lr-signature-pad.js';

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
  it('repaints token-input, code-editor and signature-pad from the appearance property', async () => {
    const surfaces = [
      { tag: 'lr-token-input', surface: '[part~="input-wrapper"]' },
      { tag: 'lr-code-editor', surface: '[part="editor"]' },
      { tag: 'lr-signature-pad', surface: '[part="surface"]' },
    ] as const;
    const fill = (el: HTMLElement, selector: string) => {
      const cs = getComputedStyle(el.shadowRoot!.querySelector(selector)!);
      return `${cs.backgroundColor} | ${cs.borderTopColor}`;
    };
    for (const appearance of ['filled', 'plain', 'accent'] as const) {
      const reference = fill(await mount('lr-input', appearance), '[part~="input-wrapper"]');
      const paints: string[] = [];
      for (const { tag, surface } of surfaces) {
        const el = await mount(tag, 'outlined');
        (el as Updating & { appearance: string }).appearance = appearance;
        await el.updateComplete;
        paints.push(`${tag}: ${el.getAttribute('appearance')} ${fill(el, surface)}`);
      }
      expect(paints, appearance).to.deep.equal(surfaces.map(({ tag }) => `${tag}: ${appearance} ${reference}`));
    }
  });
});
