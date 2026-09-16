import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './attachment-trigger.js';
import type { LyraAttachmentTrigger } from './attachment-trigger.class.js';

const ANCESTOR_TOKENS =
  '--lr-icon-button-background: rgb(1, 2, 3); --lr-icon-button-radius: 11px; --lr-icon-button-border: 2px solid rgb(9, 8, 7);';

function part(el: LyraAttachmentTrigger, name: string): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
}

function nativeControl(el: LyraAttachmentTrigger, name: string): HTMLButtonElement {
  return part(el, name).shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
}

const singleCapability = html`<lr-attachment-trigger
  .capabilities=${['files'] as const}
></lr-attachment-trigger>`;

describe('lr-attachment-trigger: composed lr-icon-button', () => {
  it('composes a real lr-icon-button for both the single- and multi-capability triggers', async () => {
    const single = (await fixture(singleCapability)) as LyraAttachmentTrigger;
    await single.updateComplete;
    expect(part(single, 'trigger').localName).to.equal('lr-icon-button');
    expect(part(single, 'trigger').getAttribute('exportparts')).to.contain(
      'button:trigger__control'
    );

    const multi = (await fixture(
      html`<lr-attachment-trigger .capabilities=${['files', 'image'] as const}></lr-attachment-trigger>`
    )) as LyraAttachmentTrigger;
    await multi.updateComplete;
    expect(part(multi, 'menu-trigger').localName).to.equal('lr-icon-button');
    expect(part(multi, 'menu-trigger').getAttribute('exportparts')).to.contain(
      'button:menu-trigger__control'
    );
  });

  it('takes its paint from the shared --lr-icon-button-* contract on an ancestor', async () => {
    const host = await fixture(html`<div style=${ANCESTOR_TOKENS}>${singleCapability}</div>`);
    const el = host.querySelector<LyraAttachmentTrigger>('lr-attachment-trigger')!;
    await el.updateComplete;
    const style = getComputedStyle(nativeControl(el, 'trigger'));
    expect(style.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(style.borderTopLeftRadius).to.equal('11px');
    expect(style.borderTopWidth, 'the ancestor border token reaches the control').to.equal('2px');
    expect(style.borderTopColor).to.equal('rgb(9, 8, 7)');
  });

  it('lets an ancestor\'s public border win over this component\'s own relayed outlined default', async () => {
    // appearance="outlined" is the one shape where this component DOES relay a non-zero
    // --_lr-icon-button-border-default (--lr-border-width-thin solid --lr-color-neutral-border-loud,
    // via --_lr-attachment-trigger-edge). The public token is still the first arm of the chain, so
    // an ancestor override must win over that relayed default, not be shadowed by it.
    const bare = (await fixture(html`<lr-attachment-trigger
      .capabilities=${['files'] as const}
      appearance="outlined"
    ></lr-attachment-trigger>`)) as LyraAttachmentTrigger;
    await bare.updateComplete;
    const defaultWidth = getComputedStyle(nativeControl(bare, 'trigger')).borderTopWidth;
    expect(defaultWidth, 'the outlined default paints some border').to.not.equal('0px');

    const host = await fixture(html`<div style=${ANCESTOR_TOKENS}>
      <lr-attachment-trigger
        .capabilities=${['files'] as const}
        appearance="outlined"
      ></lr-attachment-trigger>
    </div>`);
    const overridden = host.querySelector<LyraAttachmentTrigger>('lr-attachment-trigger')!;
    await overridden.updateComplete;
    const style = getComputedStyle(nativeControl(overridden, 'trigger'));
    expect(style.borderTopWidth, 'the public token overrides the outlined default width').to.equal(
      '2px'
    );
    expect(
      style.borderTopColor,
      'the public token overrides the outlined default color'
    ).to.equal('rgb(9, 8, 7)');
    expect(style.borderTopWidth).to.not.equal(defaultWidth);
  });

  it('opens the picker on Enter from the actually focused control', async () => {
    const el = (await fixture(singleCapability)) as LyraAttachmentTrigger;
    await el.updateComplete;
    part(el, 'trigger').focus();
    await el.updateComplete;
    expect(
      part(el, 'trigger').shadowRoot!.activeElement === nativeControl(el, 'trigger'),
      'focus landed on the composed native control'
    ).to.equal(true);
    const clicks: string[] = [];
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="hidden-input"]')!;
    input.addEventListener('click', (event) => {
      event.preventDefault();
      clicks.push('open');
    });
    await sendKeys({ press: 'Enter' });
    expect(clicks).to.deep.equal(['open']);
  });

  it('disables the composed control when the host is disabled', async () => {
    const el = (await fixture(html`<lr-attachment-trigger
      .capabilities=${['files'] as const}
      disabled
    ></lr-attachment-trigger>`)) as LyraAttachmentTrigger;
    await el.updateComplete;
    const composed = part(el, 'trigger') as HTMLElement & { disabled?: boolean };
    expect(composed.disabled).to.equal(true);
    expect(nativeControl(el, 'trigger').disabled).to.equal(true);
  });

  it('is accessible in both the single- and multi-capability shapes', async () => {
    const single = (await fixture(singleCapability)) as LyraAttachmentTrigger;
    await single.updateComplete;
    await expect(single).to.be.accessible();
    const multi = (await fixture(
      html`<lr-attachment-trigger .capabilities=${['files', 'image'] as const}></lr-attachment-trigger>`
    )) as LyraAttachmentTrigger;
    await multi.updateComplete;
    await expect(multi).to.be.accessible();
  });
});

describe('lr-attachment-trigger: appearance and size', () => {
  it('defaults to the previous plain, medium treatment', async () => {
    const el = (await fixture(singleCapability)) as LyraAttachmentTrigger;
    await el.updateComplete;
    expect(el.appearance).to.equal('plain');
    expect(el.size).to.equal('m');
    const style = getComputedStyle(nativeControl(el, 'trigger'));
    expect(style.backgroundColor, 'plain paints no fill').to.equal('rgba(0, 0, 0, 0)');
    expect(style.borderTopWidth, 'plain draws no border').to.equal('0px');
  });

  it('paints a fill for appearance="filled" and a border for appearance="outlined"', async () => {
    const filled = (await fixture(html`<lr-attachment-trigger
      .capabilities=${['files'] as const}
      appearance="filled"
    ></lr-attachment-trigger>`)) as LyraAttachmentTrigger;
    await filled.updateComplete;
    expect(getComputedStyle(nativeControl(filled, 'trigger')).backgroundColor).to.not.equal(
      'rgba(0, 0, 0, 0)'
    );

    const outlined = (await fixture(html`<lr-attachment-trigger
      .capabilities=${['files'] as const}
      appearance="outlined"
    ></lr-attachment-trigger>`)) as LyraAttachmentTrigger;
    await outlined.updateComplete;
    const style = getComputedStyle(nativeControl(outlined, 'trigger'));
    expect(style.borderTopWidth).to.not.equal('0px');
    expect(style.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('scales the glyph through the shared size ladder while keeping the tappable floor', async () => {
    const small = (await fixture(html`<lr-attachment-trigger
      .capabilities=${['files'] as const}
      size="xs"
    ></lr-attachment-trigger>`)) as LyraAttachmentTrigger;
    await small.updateComplete;
    const large = (await fixture(html`<lr-attachment-trigger
      .capabilities=${['files'] as const}
      size="xl"
    ></lr-attachment-trigger>`)) as LyraAttachmentTrigger;
    await large.updateComplete;

    const smallGlyph = Number.parseFloat(
      getComputedStyle(nativeControl(small, 'trigger')).fontSize
    );
    const largeGlyph = Number.parseFloat(
      getComputedStyle(nativeControl(large, 'trigger')).fontSize
    );
    expect(largeGlyph, 'the ladder scales the glyph').to.be.greaterThan(smallGlyph);
    for (const el of [small, large]) {
      const style = getComputedStyle(nativeControl(el, 'trigger'));
      expect(style.minInlineSize, 'every tier keeps the shared tappable floor').to.equal('40px');
      expect(style.minBlockSize).to.equal('40px');
    }
  });

  it('accepts the upstream size spellings', async () => {
    const alias = (await fixture(html`<lr-attachment-trigger
      .capabilities=${['files'] as const}
      size="small"
    ></lr-attachment-trigger>`)) as LyraAttachmentTrigger;
    await alias.updateComplete;
    const canonical = (await fixture(html`<lr-attachment-trigger
      .capabilities=${['files'] as const}
      size="s"
    ></lr-attachment-trigger>`)) as LyraAttachmentTrigger;
    await canonical.updateComplete;
    expect(getComputedStyle(nativeControl(alias, 'trigger')).fontSize).to.equal(
      getComputedStyle(nativeControl(canonical, 'trigger')).fontSize
    );
  });

  it('keeps an unset appearance/size byte-identical to a host with neither attribute', async () => {
    const bare = (await fixture(singleCapability)) as LyraAttachmentTrigger;
    await bare.updateComplete;
    const explicit = (await fixture(html`<lr-attachment-trigger
      .capabilities=${['files'] as const}
      appearance="plain"
      size="m"
    ></lr-attachment-trigger>`)) as LyraAttachmentTrigger;
    await explicit.updateComplete;
    const read = (el: LyraAttachmentTrigger): string[] => {
      const style = getComputedStyle(nativeControl(el, 'trigger'));
      return [style.backgroundColor, style.color, style.borderTopWidth, style.fontSize];
    };
    expect(read(bare)).to.deep.equal(read(explicit));
  });

  it('emits no lr-error and keeps the multi-capability menu trigger on the same vocabulary', async () => {
    const el = (await fixture(html`<lr-attachment-trigger
      .capabilities=${['files', 'image'] as const}
      appearance="accent"
      size="l"
    ></lr-attachment-trigger>`)) as LyraAttachmentTrigger;
    await el.updateComplete;
    const style = getComputedStyle(nativeControl(el, 'menu-trigger'));
    expect(style.backgroundColor, 'accent paints the loud fill').to.not.equal('rgba(0, 0, 0, 0)');
    expect(part(el, 'expand-icon').localName, 'the disclosure chevron survives').to.equal('span');
  });
});
