import { fixture, expect, html } from '@open-wc/testing';
import '../components/forms/input/input.js';
import '../components/forms/checkbox-group/checkbox-group.js';
import '../components/forms/token-input/token-input.js';
import '../components/media/file-input/file-input.js';
import '../components/agent-tools/tool-param-form/tool-param-form.js';
import '../components/utility/known-date/known-date.js';

// The required marker is one shared sheet (form-control.styles.ts) consumed by every labelled
// control, so it is asserted once, here, against the rendered ::after box -- never against
// stylesheet text, which stays green for a rule that silently matches nothing.
const markerFor = (host: Element, selector: string) =>
  getComputedStyle(host.shadowRoot!.querySelector(selector) as Element, '::after');

describe('the shared required marker', () => {
  it('renders on a standard labelled control', async () => {
    const el = await fixture(html`<lr-input label="Name" required></lr-input>`);
    expect(markerFor(el, '[part="form-control-label"]').content).to.contain('*');
  });

  it('renders nothing at all without `required`', async () => {
    const el = await fixture(html`<lr-input label="Name"></lr-input>`);
    expect(markerFor(el, '[part="form-control-label"]').content).to.not.contain('*');
  });

  it('renders on lr-file-input, which shipped no marker of any kind before', async () => {
    const el = await fixture(html`<lr-file-input label="Docs" required></lr-file-input>`);
    expect(markerFor(el, '[part="form-control-label"]').content).to.contain('*');
  });

  it('renders on lr-known-date, which attaches it to the legend box', async () => {
    const el = await fixture(html`<lr-known-date label="Birth date" required></lr-known-date>`);
    expect(markerFor(el, '[part="legend"]').content).to.contain('*');
  });

  it('renders per required FIELD in lr-tool-param-form, which has no host-level `required`', async () => {
    const el = (await fixture(html`<lr-tool-param-form></lr-tool-param-form>`)) as HTMLElement & {
      schema: unknown;
      updateComplete: Promise<unknown>;
    };
    el.schema = { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] };
    await el.updateComplete;
    const label = el.shadowRoot!.querySelector('[part="field"][data-required] [part="label"]');
    expect(label, 'the required field renders').to.exist;
    expect(getComputedStyle(label as Element, '::after').content).to.contain('*');
  });

  // lr-checkbox-group and lr-token-input still render an older hand-rolled glyph as a literal
  // <span> in their label template. Their stylesheets suppress it alongside adopting this sheet, so
  // the field must show exactly one marker, not two.
  for (const [tag, render] of [
    ['lr-checkbox-group', () => html`<lr-checkbox-group label="Pick" required></lr-checkbox-group>`],
    ['lr-token-input', () => html`<lr-token-input label="Tags" required></lr-token-input>`],
  ] as const) {
    it(`renders exactly one marker on ${tag}`, async () => {
      const el = await fixture(render());
      const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
      expect(getComputedStyle(label, '::after').content).to.contain('*');
      const legacyGlyph = label.querySelector('span[aria-hidden="true"]');
      const legacyVisible =
        legacyGlyph !== null && getComputedStyle(legacyGlyph).display !== 'none';
      expect(legacyVisible, 'the older template glyph must not double up').to.be.false;
    });
  }

  it('lets a consumer replace the glyph and retune its colour independently of --lr-color-danger', async () => {
    const el = await fixture(html`
      <lr-input
        label="Name"
        required
        style="--lr-form-control-required-content:' (required)';--lr-form-control-required-color:rgb(0, 128, 0)"
      ></lr-input>
    `);
    const marker = markerFor(el, '[part="form-control-label"]');
    expect(marker.content).to.contain('required');
    expect(marker.color).to.equal('rgb(0, 128, 0)');
  });

  it('lets a consumer suppress the marker entirely', async () => {
    const el = await fixture(html`
      <lr-input label="Name" required style="--lr-form-control-required-content:''"></lr-input>
    `);
    expect(markerFor(el, '[part="form-control-label"]').content).to.not.contain('*');
  });

  it('offsets the marker when asked, without moving it by default', async () => {
    const plain = await fixture(html`<lr-input label="Name" required></lr-input>`);
    const offset = await fixture(html`
      <lr-input label="Name" required style="--lr-form-control-required-offset:1rem"></lr-input>
    `);
    // `rem` resolves against the root font size, which the harness does not pin -- read it live
    // rather than assuming the 16px default.
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(markerFor(plain, '[part="form-control-label"]').marginInlineStart).to.equal('0px');
    expect(
      parseFloat(markerFor(offset, '[part="form-control-label"]').marginInlineStart),
    ).to.be.closeTo(rootFontSize, 0.5);
  });
});
