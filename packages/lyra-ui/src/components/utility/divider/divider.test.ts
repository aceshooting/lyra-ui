import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { toRgba } from '../../../../test/color-contrast.js';
import '../../lr-divider.js';
import type { LyraDivider } from '../../lr-divider.js';

// Note on the `LyraDividerOrientation` rename (was `DividerOrientation`): a wtr/esbuild-run
// `it()` block cannot verify a type-only rename -- `import type` and type annotations are erased
// before the test ever executes (esbuild strips an unresolvable `import type` silently, with no
// build error), so an in-file "compile-time regression" test would pass identically whether or
// not the export exists. Real protection is `tsc --noEmit -p tsconfig.json` (part of `pnpm
// lint`): `orientation`'s own `@property` declaration in divider.class.ts is typed
// `LyraDividerOrientation`, so reverting just the export name (leaving that usage as-is) fails
// the build there directly -- verified by hand by temporarily reverting the export and re-running
// tsc, which failed with "Cannot find name 'LyraDividerOrientation'" at both usage sites.

it('supports the vertical boolean alias and reflects it', async () => {
  const el = (await fixture(html`<lr-divider vertical></lr-divider>`)) as LyraDivider;
  expect(el.vertical).to.be.true;
  expect(el.hasAttribute('vertical')).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-orientation')).to.equal('vertical');
});

it('accepts the mapped width, color, and spacing CSS hooks', async () => {
  const el = (await fixture(html`
    <lr-divider style="--width: 7px; --color: rgb(1, 2, 3); --spacing: 11px"></lr-divider>
  `)) as LyraDivider;
  const divider = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const computed = getComputedStyle(divider);
  expect(computed.borderTopWidth).to.equal('7px');
  expect(computed.borderTopColor).to.equal('rgb(1, 2, 3)');
  expect(computed.marginTop).to.equal('11px');
  expect(computed.marginBottom).to.equal('11px');
});

/** Resolved separator colour of each divider in `wrapper`: block-start edge when horizontal,
 *  inline-start edge when vertical. */
function separatorColors(wrapper: HTMLElement): string[] {
  return [...wrapper.querySelectorAll<LyraDivider>('lr-divider')].map((divider) => {
    const base = divider.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const edge =
      divider.getAttribute('orientation') === 'vertical'
        ? 'border-inline-start-color'
        : 'border-block-start-color';
    return getComputedStyle(base).getPropertyValue(edge);
  });
}

it('defaults to the Shadcn subtle border independently of the control border', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div data-lr-theme-scope style="--lr-theme-color-surface-border: rgb(10, 20, 30)">
      <lr-divider></lr-divider>
      <lr-divider orientation="vertical"></lr-divider>
    </div>
  `);
  expect(separatorColors(wrapper).map(toRgba)).to.deep.equal([[229, 229, 229, 255], [229, 229, 229, 255]]);
});

it('follows a theme-level subtle border, and --color still wins over it', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div data-lr-theme-scope
      style="--lr-theme-color-surface-border: rgb(10, 20, 30); --lr-theme-color-surface-border-subtle: rgb(40, 50, 60)"
    >
      <lr-divider></lr-divider>
      <lr-divider orientation="vertical"></lr-divider>
      <lr-divider style="--color: rgb(1, 2, 3)"></lr-divider>
    </div>
  `);
  expect(separatorColors(wrapper)).to.deep.equal([
    'rgb(40, 50, 60)',
    'rgb(40, 50, 60)',
    'rgb(1, 2, 3)',
  ]);
});

it('renders a semantic horizontal divider and supports vertical orientation', async () => {
  const el = await fixture(html`<lr-divider orientation="vertical"></lr-divider>`);
  const divider = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(divider.getAttribute('role')).to.equal('separator');
  expect(divider.getAttribute('aria-orientation')).to.equal('vertical');
  await expect(el).to.be.accessible();
});

it('normalizes an invalid orientation to horizontal ARIA semantics', async () => {
  const el = await fixture(html`<lr-divider></lr-divider>`);
  (el as unknown as { orientation: string }).orientation = 'diagonal';
  await (el as LyraDivider).updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-orientation'),
  ).to.equal('horizontal');
});

it('forwards a host aria-label to the inner separator owner', async () => {
  const el = await fixture(html`<lr-divider aria-label="Section break"></lr-divider>`);
  const divider = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(divider.getAttribute('aria-label')).to.equal('Section break');
});

it('keeps a vertical divider visible in an auto-height flex row', async () => {
  const row = (await fixture(html`<div style="display:flex"><lr-divider vertical></lr-divider></div>`)) as HTMLElement;
  const divider = row.querySelector('lr-divider') as LyraDivider;
  expect(divider.offsetHeight).to.be.greaterThan(0);
});

it('normalizes the reflected orientation while the vertical shorthand takes precedence', async () => {
  const el = await fixture<LyraDivider>(html`<lr-divider orientation="diagonal" vertical></lr-divider>`);
  expect(el.orientation).to.equal('horizontal');
  expect(el.getAttribute('orientation')).to.equal('horizontal');
  expect(el.shadowRoot!.querySelector('hr')!.getAttribute('aria-orientation')).to.equal('vertical');
  el.vertical = false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('hr')!.getAttribute('aria-orientation')).to.equal('horizontal');
});

describe('label', () => {
  it('stays an unlabeled hr without slotted content', async () => {
    const el = await fixture<LyraDivider>(html`<lr-divider>  </lr-divider>`);
    expect(el.withLabel).to.be.false;
    expect(el.hasAttribute('with-label')).to.be.false;
    expect(el.shadowRoot!.querySelector('hr')).to.exist;
  });

  it('renders the label between two lines, reflects with-label and names the separator', async () => {
    const el = await fixture<LyraDivider>(html`<lr-divider>Or</lr-divider>`);
    expect(el.withLabel).to.be.true;
    expect(el.hasAttribute('with-label')).to.be.true;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('separator');
    expect(base.getAttribute('aria-label')).to.equal('Or');
    const [start, end] = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="line"]')] as [HTMLElement, HTMLElement];
    const label = el.shadowRoot!.querySelector<HTMLElement>('[part="label"]')!;
    expect(label.querySelector('slot')).to.exist;
    expect(Math.abs(start.getBoundingClientRect().width - end.getBoundingClientRect().width)).to.be.lessThan(1.5);
    expect(getComputedStyle(start).borderTopWidth).to.not.equal('0px');
  });

  it('lets the host aria-label win and reacts to label removal', async () => {
    const el = await fixture<LyraDivider>(html`<lr-divider aria-label="Section">Or</lr-divider>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Section');
    el.textContent = '';
    await waitUntil(() => !el.withLabel);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('hr')).to.exist;
  });

  it('places the label at the start or end with a --label-offset line, and applies --label-spacing', async () => {
    const el = await fixture<LyraDivider>(
      html`<lr-divider label-placement="start" style="--label-offset: 40px; --label-spacing: 9px">Or</lr-divider>`,
    );
    const [start, end] = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="line"]')] as [HTMLElement, HTMLElement];
    expect(start.getBoundingClientRect().width).to.be.closeTo(40, 1);
    expect(end.getBoundingClientRect().width).to.be.greaterThan(40);
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="label"]')!).paddingLeft).to.equal('9px');
    el.labelPlacement = 'end';
    await el.updateComplete;
    expect(end.getBoundingClientRect().width).to.be.closeTo(40, 1);
    expect(start.getBoundingClientRect().width).to.be.greaterThan(40);
  });

  it('normalizes an unsupported label-placement to center', async () => {
    const el = await fixture<LyraDivider>(html`<lr-divider label-placement="nope">Or</lr-divider>`);
    expect(el.labelPlacement).to.equal('center');
  });

  it('lays a vertical labeled divider out as a column', async () => {
    const el = await fixture<LyraDivider>(
      html`<div style="block-size:200px;display:flex"><lr-divider vertical>Or</lr-divider></div>`,
    );
    const divider = el.querySelector('lr-divider')!;
    const base = divider.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(getComputedStyle(base).flexDirection).to.equal('column');
    const line = divider.shadowRoot!.querySelector<HTMLElement>('[part~="line"]')!;
    expect(getComputedStyle(line).borderLeftWidth).to.not.equal('0px');
  });
});
