import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { html as litHtml } from 'lit';
import './segmented.js';
import type { LyraSegmented } from './segmented.js';
import { styles } from './segmented.styles.js';
import '../../forms/select/select.js';
import type { LyraSelect } from '../../forms/select/select.js';

const items = () => [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

function segmentButtons(el: LyraSegmented): HTMLButtonElement[] {
  return [...el.shadowRoot!.querySelectorAll('[part="segment"]')] as HTMLButtonElement[];
}

describe('lr-segmented', () => {
  it('renders role=radiogroup with one role=radio per item, aria-checked on the selected one', async () => {
    const el = (await fixture(html`<lr-segmented .items=${items()} value="week"></lr-segmented>`)) as LyraSegmented;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('radiogroup');
    const buttons = segmentButtons(el);
    expect(buttons.map((b) => b.getAttribute('role'))).to.deep.equal(['radio', 'radio', 'radio']);
    expect(buttons[1]!.getAttribute('aria-checked')).to.equal('true');
    expect(buttons[0]!.getAttribute('aria-checked')).to.equal('false');
  });

  it('uses roving tabindex -- only the selected item is tabbable', async () => {
    const el = (await fixture(html`<lr-segmented .items=${items()} value="week"></lr-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['-1', '0', '-1']);
  });

  it('makes the first item tabbable when no item is selected, so the radiogroup stays keyboard-reachable', async () => {
    const el = (await fixture(html`<lr-segmented .items=${items()}></lr-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    expect(el.value).to.equal('');
    expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['0', '-1', '-1']);
  });

  it('falls back to the first non-disabled item when nothing is selected', async () => {
    const withDisabled = [{ ...items()[0]!, disabled: true }, items()[1]!, items()[2]!];
    const el = (await fixture(html`<lr-segmented .items=${withDisabled}></lr-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['-1', '0', '-1']);
  });

  it('ArrowRight from the unselected, first-tabbable state selects the first item', async () => {
    const el = (await fixture(html`<lr-segmented .items=${items()}></lr-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('day');
  });

  it('selects on click and emits lr-change', async () => {
    const el = (await fixture(html`<lr-segmented .items=${items()} value="day"></lr-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    setTimeout(() => buttons[2]!.click());
    const ev = await oneEvent(el, 'lr-change');
    expect(ev.detail).to.deep.equal({ value: 'month' });
    expect(el.value).to.equal('month');
  });

  it('selects on ArrowRight (automatic activation) and wraps cyclically at the end', async () => {
    const el = (await fixture(html`<lr-segmented .items=${items()} value="month"></lr-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[2]!.focus();
    buttons[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('day'); // wrapped from the last item back to the first
  });

  it('skips disabled items during keyboard navigation', async () => {
    const withDisabled = [items()[0]!, { ...items()[1]!, disabled: true }, items()[2]!];
    const el = (await fixture(html`<lr-segmented .items=${withDisabled} value="day"></lr-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('month'); // 'week' is disabled, skipped
  });

  it('sets aria-label on the radiogroup from the label prop, falling back to a forwarded host aria-label', async () => {
    const labeled = (await fixture(
      html`<lr-segmented label="View" .items=${items()}></lr-segmented>`,
    )) as LyraSegmented;
    const base1 = labeled.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base1.getAttribute('aria-label')).to.equal('View');

    const forwarded = (await fixture(
      html`<lr-segmented aria-label="Forwarded label" .items=${items()}></lr-segmented>`,
    )) as LyraSegmented;
    const base2 = forwarded.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base2.getAttribute('aria-label')).to.equal('Forwarded label');
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lr-segmented .items=${items()} value="day"></lr-segmented>`)) as LyraSegmented;
    await expect(el).to.be.accessible();
  });

  it('is accessible when labeled via the label prop', async () => {
    const el = (await fixture(
      html`<lr-segmented label="View" .items=${items()} value="day"></lr-segmented>`,
    )) as LyraSegmented;
    await expect(el).to.be.accessible();
  });

  it('moves focus to the target item when its value contains a double-quote character', async () => {
    const withQuote = [{ value: 'a', label: 'A' }, { value: 'b"c', label: 'B' }, { value: 'd', label: 'D' }];
    const el = (await fixture(html`<lr-segmented .items=${withQuote} value="a"></lr-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('b"c');
    // Without escaping the value in the attribute-selector lookup, `focusItem()` throws before
    // reaching `.focus()`, so the target button never receives focus even though `value` updated.
    expect(el.shadowRoot!.activeElement).to.equal(buttons[1]);
  });
});

describe('item icon', () => {
  it('renders no [part=segment-icon] when items have no icon', async () => {
    const items = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ];
    const el = (await fixture(html`<lr-segmented .items=${items} value="a"></lr-segmented>`)) as LyraSegmented;
    expect(el.shadowRoot!.querySelector('[part="segment-icon"]')).to.not.exist;
  });

  it('renders item.icon before the label when set', async () => {
    const items = [
      { value: 'a', label: 'A', icon: litHtml`<span class="dot"></span>` },
      { value: 'b', label: 'B' },
    ];
    const el = (await fixture(html`<lr-segmented .items=${items} value="a"></lr-segmented>`)) as LyraSegmented;
    const button = el.shadowRoot!.querySelector('[part="segment"]')!;
    const icon = button.querySelector('[part="segment-icon"]');
    expect(icon).to.exist;
    expect(icon!.querySelector('.dot')).to.exist;
    const children = Array.from(button.children);
    const labelIndex = children.findIndex((c) => c.getAttribute('part') === 'segment-label');
    expect(children.indexOf(icon as Element)).to.be.lessThan(labelIndex);
  });

  it('gives a non-disabled, non-checked segment a :hover treatment', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    // :where()-wrapped (see the shadow-part-selector-specificity fix below) so a consumer's own
    // ::part(segment):hover override can win without !important -- mirrors lr-attachment-trigger.
    expect(css).to.match(
      /:where\(\[part='segment'\]\):hover:where\(:not\(\[aria-disabled='true'\]\):not\(\[aria-checked='true'\]\)\)\s*\{[^}]+\}/,
    );
  });

  it('adds a static, themeable edge fade to the scroll container', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('-webkit-mask-image: linear-gradient');
    expect(css).to.include('mask-image: linear-gradient');
    expect(css).to.include('var(--lr-scroll-fade-size)');
  });
});

describe('narrow allocation', () => {
  it('keeps a long button row horizontally scrollable inside a 320px container', async () => {
    // `parentNode` is an open-wc fixture option -- the fixture wrapper appends it under
    // `document.body` itself and the global afterEach fixtureCleanup removes it, so this
    // test must not append/remove it manually (that would double-remove the node).
    const container = document.createElement('div');
    container.style.inlineSize = '320px';
    const el = (await fixture(
      html`<lr-segmented
        .items=${[
          { value: 'all', label: 'Alle Elemente' },
          { value: 'active', label: 'Aktive Elemente' },
          { value: 'pending', label: 'Ausstehende Elemente' },
          { value: 'archived', label: 'Archivierte Elemente' },
          { value: 'deleted', label: 'Gelöschte Elemente' },
        ]}
        value="active"
      ></lr-segmented>`,
      { parentNode: container },
    )) as LyraSegmented;
    await el.updateComplete;

    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).flexWrap).to.equal('nowrap');
    expect(getComputedStyle(base).overflowX).to.equal('auto');
    // The host's own box must not overflow the 320px allocation; the row itself
    // owns horizontal scrolling for long translated labels.
    expect((el as HTMLElement).getBoundingClientRect().width).to.be.at.most(320);
  });
});

describe('segment hover specificity', () => {
  it('keeps the internal hover rule :where()-wrapped so a ::part(segment):hover override wins without !important', async () => {
    // Mirrors lr-attachment-trigger's identical "trigger-button hover specificity" test: jsdom/
    // browser test runners don't synthesize a real :hover pseudo-class from a dispatched event, so
    // this asserts the internal rule's own specificity-lowering shape (read off the real adopted
    // stylesheet, not the exported .cssText string) rather than a simulated hover paint.
    const el = (await fixture(html`<lr-segmented .items=${items()} value="week"></lr-segmented>`)) as LyraSegmented;
    const internalHoverRule = (el.shadowRoot!.adoptedStyleSheets ?? [])
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText)
      // CSSOM re-serializes attribute selectors with double quotes regardless of the source's own
      // quoting, so match quote-insensitively (mirrors the ruleFor() helper above).
      .find((text) => text.includes(':hover') && /part=['"]segment['"]/.test(text));
    expect(internalHoverRule).to.contain(':where(');
  });
});

/** Resolves what a `declaration` would compute to *inside this component's shadow root*, where the
 *  `--lr-*` design tokens actually live (they are declared on `:host`, so a light-DOM probe would
 *  see none of them). Used to assert the unset defaults byte-for-byte against the tokens they are
 *  documented to fall back to. */
function resolvedInShadow(el: LyraSegmented, declaration: string, property: string): string {
  const probe = document.createElement('span');
  probe.setAttribute('style', declaration);
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}

/** The single declaration block of the first rule whose selector matches `selector`, read off the
 *  component's own constructed stylesheet rather than its serialized text. */
function ruleFor(selector: string): CSSStyleDeclaration {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(styles.cssText);
  // CSSOM re-serializes attribute selectors with double quotes; compare quote-insensitively.
  const normalize = (text: string) => text.replace(/"/g, "'");
  const rule = [...sheet.cssRules].find(
    (candidate) => candidate instanceof CSSStyleRule && normalize(candidate.selectorText) === normalize(selector),
  ) as CSSStyleRule | undefined;
  expect(rule, `no rule for ${selector}`).to.exist;
  return rule!.style;
}

describe('selected-state cssprops', () => {
  const overrides =
    '--lr-segmented-selected-bg: rgb(0, 51, 102);' +
    '--lr-segmented-selected-color: rgb(255, 255, 255);' +
    '--lr-segmented-selected-font-weight: 900;' +
    '--lr-segmented-selected-shadow: none;';

  async function themed(style: string): Promise<LyraSegmented> {
    const wrapper = (await fixture(
      html`<div style=${style}><lr-segmented .items=${items()} value="week"></lr-segmented></div>`,
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-segmented') as LyraSegmented;
    await el.updateComplete;
    return el;
  }

  it('recolors only the checked segment, from an ancestor (not a :host-declared prop)', async () => {
    const el = await themed(overrides);
    const [unchecked, checked] = segmentButtons(el);
    const checkedStyle = getComputedStyle(checked!);
    expect(checked!.getAttribute('aria-checked')).to.equal('true');
    expect(checkedStyle.backgroundColor).to.equal('rgb(0, 51, 102)');
    expect(checkedStyle.color).to.equal('rgb(255, 255, 255)');
    expect(checkedStyle.fontWeight).to.equal('900');
    expect(checkedStyle.boxShadow).to.equal('none');

    // Every unchecked segment keeps the quiet resting treatment: transparent, quiet text, no
    // bolding, no shadow -- the props are scoped to [aria-checked='true'] only.
    const uncheckedStyle = getComputedStyle(unchecked!);
    expect(uncheckedStyle.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(uncheckedStyle.color).to.equal(resolvedInShadow(el, 'color: var(--lr-color-text-quiet)', 'color'));
    expect(uncheckedStyle.fontWeight).to.not.equal('900');
    expect(uncheckedStyle.boxShadow).to.equal('none');
  });

  it('leaves the hover treatment of an UNCHECKED segment untouched -- the coupling the props exist to break', async () => {
    const el = await themed(overrides);
    const unchecked = segmentButtons(el)[0]!;
    // The hover rule resolves through its own prop, never through any selected-state prop: before
    // this hook existed the only way to recolor the checked pill was to hijack library-wide
    // --lr-color-surface/--lr-color-text, which necessarily repainted hovered-unselected segments
    // too (they read the very same token).
    const hover = ruleFor(
      ":where([part='segment']):hover:where(:not([aria-disabled='true']):not([aria-checked='true']))",
    );
    expect(hover.getPropertyValue('color')).to.equal('var(--lr-segmented-hover-color, var(--lr-color-text))');
    expect(hover.cssText).to.not.include('selected');
    // ...and with the selected props set, that hover color still resolves to the untouched
    // --lr-color-text token on the segment that would receive it.
    expect(getComputedStyle(unchecked).getPropertyValue('--lr-segmented-hover-color')).to.equal('');
    expect(resolvedInShadow(el, 'color: var(--lr-color-text)', 'color')).to.equal(
      resolvedInShadow(el, 'color: var(--lr-segmented-hover-color, var(--lr-color-text))', 'color'),
    );
  });

  it('recolors the hover treatment on its own, without touching the checked segment', async () => {
    const el = await themed('--lr-segmented-hover-color: rgb(7, 8, 9);');
    const checked = segmentButtons(el)[1]!;
    expect(getComputedStyle(checked).color).to.equal(resolvedInShadow(el, 'color: var(--lr-color-text)', 'color'));
    expect(getComputedStyle(checked).backgroundColor).to.equal(
      resolvedInShadow(el, 'background: var(--lr-color-surface)', 'background-color'),
    );
    // The value the hover rule (asserted above) resolves for an unchecked segment.
    expect(resolvedInShadow(el, 'color: var(--lr-segmented-hover-color, var(--lr-color-text))', 'color')).to.equal(
      'rgb(7, 8, 9)',
    );
  });

  it('renders identically to the pre-cssprop output when every prop is unset', async () => {
    const el = (await fixture(html`<lr-segmented .items=${items()} value="week"></lr-segmented>`)) as LyraSegmented;
    const checked = getComputedStyle(segmentButtons(el)[1]!);
    expect(checked.backgroundColor).to.equal(resolvedInShadow(el, 'background: var(--lr-color-surface)', 'background-color'));
    expect(checked.color).to.equal(resolvedInShadow(el, 'color: var(--lr-color-text)', 'color'));
    expect(checked.fontWeight).to.equal(
      resolvedInShadow(el, 'font-weight: var(--lr-font-weight-semibold)', 'font-weight'),
    );
    expect(checked.boxShadow).to.equal(resolvedInShadow(el, 'box-shadow: var(--lr-shadow)', 'box-shadow'));
  });

  it('is accessible with the selected-state props themed', async () => {
    const el = await themed(overrides);
    await expect(el).to.be.accessible();
  });
});

describe('track height', () => {
  const sizes = ['2xs', 'xs', 's', 'm', 'l', 'xl'] as const;

  async function track(size: string, style = ''): Promise<HTMLElement> {
    const wrapper = (await fixture(
      html`<div style=${style}><lr-segmented size=${size} .items=${items()} value="week"></lr-segmented></div>`,
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-segmented') as LyraSegmented;
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  }

  it('pins the track to an exact height at every size tier', async () => {
    for (const size of sizes) {
      const base = await track(size, '--lr-segmented-track-height: 40px;');
      expect(getComputedStyle(base).minBlockSize, size).to.equal('40px');
      expect(base.getBoundingClientRect().height, size).to.be.closeTo(40, 0.5);
    }
  });

  it('keeps each tier\'s own min-height floor when the exact-height hatch is unset', async () => {
    // The hatch must stay *genuinely undeclared* -- a `:host { --lr-segmented-track-height: auto }`
    // declaration would be a valid value that always wins, making the per-tier
    // --lr-segmented-track-min-height fallback dead code (the trap lr-select fell into).
    const floors = new Map([
      ['2xs', '20px'],
      ['xs', '24px'],
      ['s', '30px'],
      ['m', '40px'],
      ['l', '48px'],
      ['xl', '56px'],
    ]);
    for (const size of sizes) {
      const base = await track(size);
      expect(getComputedStyle(base).minBlockSize, size).to.equal(floors.get(size));
    }
  });

  it('still honours a min-height override while the exact height is unset', async () => {
    // --lr-segmented-track-min-height is re-declared on :host per tier, so it is overridden on the
    // host element itself (inline styles win over the component's own :host rule), unlike the
    // exact-height hatch which is never declared and therefore inherits from any ancestor.
    const el = (await fixture(
      html`<lr-segmented size="s" style="--lr-segmented-track-min-height: 44px" .items=${items()}></lr-segmented>`,
    )) as LyraSegmented;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).minBlockSize).to.equal('44px');
  });
});

describe('size', () => {
  it('defaults to size="m", matching lr-input/lr-select/lr-combobox\'s shared 40px default-tier floor', async () => {
    const el = (await fixture(html`<lr-segmented .items=${items()} value="day"></lr-segmented>`)) as LyraSegmented;
    expect(el.size).to.equal('m');
    expect(el.getAttribute('size')).to.equal('m');
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).minBlockSize).to.equal('40px');
  });

  it('matches <lr-select size="s">\'s control height at size="s"', async () => {
    const segmented = (await fixture(
      html`<lr-segmented size="s" .items=${items()} value="day"></lr-segmented>`,
    )) as LyraSegmented;
    const select = (await fixture(html`<lr-select size="s"></lr-select>`)) as LyraSelect;
    const segmentedBase = segmented.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const selectTrigger = select.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(segmentedBase).minBlockSize).to.equal(getComputedStyle(selectTrigger).minBlockSize);
  });

  it('reflects size as a host attribute for every tier', async () => {
    const el = (await fixture(html`<lr-segmented size="xl" .items=${items()}></lr-segmented>`)) as LyraSegmented;
    expect(el.getAttribute('size')).to.equal('xl');
  });
});
