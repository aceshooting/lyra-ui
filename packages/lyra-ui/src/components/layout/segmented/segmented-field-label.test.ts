import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { accessibleName } from '../../../../test/accessible-name.js';
import { twoFrames } from '../../../../test/frames.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './segmented.js';
import type { LyraSegmented, LyraSegmentedItem } from './segmented.js';
import '../../forms/input/input.js';
import type { LyraInput } from '../../forms/input/input.js';
import '../../forms/select/select.js';
import type { LyraSelect } from '../../forms/select/select.js';
import '../../forms/combobox/option.js';

type FieldSegmented = LyraSegmented & { labelDisplay: 'visible' | 'hidden'; hint: string };
const choices: LyraSegmentedItem[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week', disabled: true },
  { value: 'month', label: 'Month' },
];

function part(el: HTMLElement, name: string): HTMLElement {
  const node = el.shadowRoot?.querySelector<HTMLElement>(`[part~="${name}"]`);
  if (!node) throw new Error(`Missing ${name} part`);
  return node;
}

function reference(el: FieldSegmented, attribute: string): HTMLElement {
  const id = part(el, 'base').getAttribute(attribute);
  if (!id || id.trim().split(/\s+/).length !== 1) throw new Error(`Missing singular ${attribute}`);
  const target = el.shadowRoot?.getElementById(id);
  if (!target) throw new Error(`Unresolved own-shadow ${attribute}`);
  return target;
}

function describedText(el: FieldSegmented): string {
  const axe = (window as Window & { axe?: typeof import('axe-core') }).axe;
  if (!axe) throw new Error('Run an accessibility scan before reading supporting text');
  axe.setup(el.ownerDocument);
  try {
    return axe.commons.text.accessibleText(reference(el, 'aria-describedby'), { inLabelledByContext: true });
  } finally { axe.teardown(); }
}

function captionIsHidden(el: FieldSegmented): boolean {
  const caption = part(el, 'form-control-label');
  const style = getComputedStyle(caption);
  return style.position === 'absolute' && caption.getBoundingClientRect().height <= 1.1 &&
    style.clipPath !== 'none';
}

describe('lr-segmented field caption and hint', () => {
  it('keeps the unset label visually hidden, the old property name bytes and the track footprint', async () => {
    const el = await fixture<FieldSegmented>(html`<lr-segmented label="View" .items=${choices} value="day"></lr-segmented>`);
    const bare = await fixture<LyraSegmented>(html`<lr-segmented .items=${choices} value="day"></lr-segmented>`);
    await twoFrames();
    expect(el.labelDisplay).to.equal('hidden');
    expect(captionIsHidden(el)).to.equal(true);
    expect(part(el, 'base').getAttribute('aria-label')).to.equal('View');
    expect(part(el, 'base').hasAttribute('aria-labelledby')).to.equal(false);
    expect(part(el, 'base').hasAttribute('aria-describedby')).to.equal(false);
    expect(el.getBoundingClientRect().height).to.be.closeTo(bare.getBoundingClientRect().height, 0.5);
    expect(el.getBoundingClientRect().height).to.be.closeTo(part(el, 'base').getBoundingClientRect().height, 0.5);
    expect(el.getBoundingClientRect().width).to.be.closeTo(part(el, 'base').getBoundingClientRect().width, 0.5);
    expect(part(el, 'base').getBoundingClientRect().width).to.be.closeTo(part(bare, 'base').getBoundingClientRect().width, 0.5);
    expect(getComputedStyle(part(el, 'base')).overflowX).to.equal('auto');
    await expect(el).to.be.accessible();
    expect(accessibleName(part(el, 'base'))).to.equal('View');
  });

  it('opts a property caption into the shared field typography without changing control height', async () => {
    const el = await fixture<FieldSegmented>(html`<lr-segmented size="s" label="View" label-display="visible" .items=${choices} value="day"></lr-segmented>`);
    const input = await fixture<LyraInput>(html`<lr-input size="s" label="View" value="Day"></lr-input>`);
    const select = await fixture<LyraSelect>(html`<lr-select size="s" label="View" value="day"><lr-option value="day">Day</lr-option></lr-select>`);
    await Promise.all([el.updateComplete, input.updateComplete, select.updateComplete]);
    const caption = part(el, 'form-control-label');
    expect(captionIsHidden(el)).to.equal(false);
    expect(caption.textContent?.trim()).to.equal('View');
    expect(caption.getBoundingClientRect().bottom).to.be.at.most(part(el, 'base').getBoundingClientRect().top);
    for (const field of [input, select]) {
      for (const property of ['font-size', 'font-weight']) {
        expect(getComputedStyle(caption).getPropertyValue(property), property).to.equal(
          getComputedStyle(part(field, 'form-control-label')).getPropertyValue(property),
        );
      }
    }
    const trackHeight = part(el, 'base').getBoundingClientRect().height;
    expect(trackHeight).to.be.closeTo(part(input, 'input-wrapper').getBoundingClientRect().height, 0.5);
    expect(trackHeight).to.be.closeTo(part(select, 'trigger').getBoundingClientRect().height, 0.5);
    await expect(el).to.be.accessible();
    expect(accessibleName(part(el, 'base'))).to.equal('View');
  });

  it('names the group from assigned label content in both modes and restores the property fallback', async () => {
    const el = await fixture<FieldSegmented>(html`<lr-segmented label="Property fallback" .items=${choices}>
      <span slot="label"><strong>Calendar</strong> view</span>
    </lr-segmented>`);
    await waitUntil(() => !!part(el, 'base').getAttribute('aria-labelledby'));
    const label = el.querySelector<HTMLElement>('[slot="label"]')!;
    await expect(el).to.be.accessible();
    for (const mode of ['hidden', 'visible'] as const) {
      el.labelDisplay = mode;
      await el.updateComplete;
      expect(part(el, 'base').hasAttribute('aria-label')).to.equal(false);
      expect(reference(el, 'aria-labelledby').getRootNode() === el.shadowRoot).to.equal(true);
      expect(accessibleName(part(el, 'base'))).to.equal('Calendar view');
      expect(captionIsHidden(el)).to.equal(mode === 'hidden');
    }
    label.textContent = 'Updated calendar';
    await twoFrames();
    expect(accessibleName(part(el, 'base'))).to.equal('Updated calendar');
    label.textContent = '';
    await twoFrames();
    expect(part(el, 'base').hasAttribute('aria-label')).to.equal(false);
    expect(accessibleName(part(el, 'base'))).to.equal('');
    label.remove();
    await waitUntil(() => part(el, 'base').getAttribute('aria-label') === 'Property fallback');
    expect(part(el, 'base').hasAttribute('aria-labelledby')).to.equal(false);
    expect(accessibleName(part(el, 'base'))).to.equal('Property fallback');
    label.textContent = 'Updated calendar';
    el.append(label);
    await waitUntil(() => !!part(el, 'base').getAttribute('aria-labelledby'));
    expect(accessibleName(part(el, 'base'))).to.equal('Updated calendar');
    label.slot = 'hint';
    await waitUntil(() => part(el, 'base').getAttribute('aria-label') === 'Property fallback' &&
      !!part(el, 'base').getAttribute('aria-describedby'));
    expect(describedText(el)).to.equal('Updated calendar');
    label.slot = 'label';
    await waitUntil(() => !!part(el, 'base').getAttribute('aria-labelledby') &&
      !part(el, 'base').hasAttribute('aria-describedby'));
    expect(accessibleName(part(el, 'base'))).to.equal('Updated calendar');
  });

  it('keeps present host aria-label authoritative, including empty, while a caption stays visible', async () => {
    const el = await fixture<FieldSegmented>(html`<lr-segmented label="Fallback" label-display="visible" .items=${choices}>
      <span slot="label">Visible caption</span>
    </lr-segmented>`);
    await waitUntil(() => !!part(el, 'base').getAttribute('aria-labelledby'));
    await expect(el).to.be.accessible();
    for (const name of ['Override', '']) {
      el.setAttribute('aria-label', name);
      await waitUntil(() => part(el, 'base').getAttribute('aria-label') === name);
      expect(part(el, 'base').hasAttribute('aria-labelledby')).to.equal(false);
      expect(captionIsHidden(el)).to.equal(false);
      expect(accessibleName(part(el, 'base'))).to.equal(name);
    }
    el.removeAttribute('aria-label');
    await waitUntil(() => !!part(el, 'base').getAttribute('aria-labelledby'));
    expect(part(el, 'base').hasAttribute('aria-label')).to.equal(false);
    expect(accessibleName(part(el, 'base'))).to.equal('Visible caption');
  });

  it('uses same-shadow hint references and slot fallback through live assignment and removal', async () => {
    const el = await fixture<FieldSegmented>(html`<lr-segmented label="View" hint="Property guidance" .items=${choices}></lr-segmented>`);
    const other = await fixture<FieldSegmented>(html`<lr-segmented label="Other view" hint="Other guidance" .items=${choices}></lr-segmented>`);
    await expect(el).to.be.accessible();
    expect(describedText(el)).to.equal('Property guidance');
    expect(reference(other, 'aria-describedby').textContent?.trim()).to.equal('Other guidance');
    expect(reference(el, 'aria-describedby').getRootNode() === el.shadowRoot).to.equal(true);
    const hint = document.createElement('span');
    hint.slot = 'hint'; hint.textContent = 'Slotted guidance';
    el.append(hint);
    await waitUntil(() => (part(el, 'hint').querySelector('slot')?.assignedElements().length ?? 0) === 1);
    expect(reference(el, 'aria-describedby').id).to.equal(part(el, 'hint').id);
    expect(getComputedStyle(part(el, 'hint')).display).not.to.equal('none');
    // Assignment replaces the fallback rather than concatenating two guidance strings.
    expect(describedText(el)).to.equal('Slotted guidance');
    hint.textContent = 'Updated guidance';
    await twoFrames();
    expect(describedText(el)).to.equal('Updated guidance');
    hint.remove();
    await twoFrames();
    await el.updateComplete;
    expect(describedText(el)).to.equal('Property guidance');
    el.hint = '';
    await el.updateComplete;
    await waitUntil(() => !part(el, 'base').hasAttribute('aria-describedby'));
    expect(part(el, 'hint').hidden).to.equal(true);
    el.append(hint);
    await waitUntil(() => !!part(el, 'base').getAttribute('aria-describedby'));
    expect(part(el, 'hint').hidden).to.equal(false);
    expect(describedText(el)).to.equal('Updated guidance');
    await expect(el).to.be.accessible();
  });

  it('requires exact visible opt-in and does not reserve caption space after hiding or removing it', async () => {
    const el = await fixture<FieldSegmented>(html`<lr-segmented label="View" .items=${choices}></lr-segmented>`);
    const base = part(el, 'base');
    const hiddenHeight = el.getBoundingClientRect().height;
    el.setAttribute('label-display', 'invalid');
    await el.updateComplete;
    expect(captionIsHidden(el)).to.equal(true);
    el.labelDisplay = 'visible';
    await el.updateComplete;
    expect(el.getBoundingClientRect().height).to.be.greaterThan(hiddenHeight);
    el.labelDisplay = 'hidden';
    await el.updateComplete;
    expect(el.getBoundingClientRect().height).to.be.closeTo(hiddenHeight, 0.5);
    expect(part(el, 'base') === base).to.equal(true);
    el.label = '';
    await el.updateComplete;
    expect(part(el, 'form-control-label').hidden).to.equal(true);
    expect(base.hasAttribute('aria-label')).to.equal(false);
    expect(base.hasAttribute('aria-labelledby')).to.equal(false);
  });

  it('wraps long RTL captions at 320px while preserving the scroll owner, focus and selection events', async () => {
    const container = document.createElement('div');
    container.style.inlineSize = '320px';
    const text = 'اختيارطريقةالعرض'.repeat(16);
    const el = await fixture<FieldSegmented>(html`<lr-segmented dir="rtl" label=${text} hint=${text}
      label-display="visible" value="day" .items=${choices}></lr-segmented>`, { parentNode: container });
    await twoFrames();
    const base = part(el, 'base');
    for (const node of [el, part(el, 'form-control-label'), part(el, 'hint'), base]) {
      expect(node.getBoundingClientRect().width).to.be.at.most(321);
    }
    expect(container.scrollWidth).to.be.at.most(321);
    expect(getComputedStyle(base).overflowX).to.equal('auto');
    const first = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="segment"][data-value="day"]')!;
    const checkedPaint = {
      color: getComputedStyle(first).color,
      backgroundColor: getComputedStyle(first).backgroundColor,
    };
    const events: string[] = [];
    el.addEventListener('lr-change', event => events.push(`change:${event.detail.value}`));
    el.addEventListener('lr-activate', event => events.push(`activate:${event.detail.value}`));
    await focusByKeyboard(first);
    await sendKeys({ press: 'ArrowLeft' });
    await el.updateComplete;
    expect(el.value).to.equal('month');
    expect(events).to.deep.equal(['change:month', 'activate:month']);
    expect(el.shadowRoot?.activeElement?.getAttribute('data-value')).to.equal('month');
    el.labelDisplay = 'hidden';
    await el.updateComplete;
    expect(part(el, 'base') === base).to.equal(true);
    expect(el.shadowRoot?.activeElement?.getAttribute('data-value')).to.equal('month');
    expect(el.value).to.equal('month');
    expect(events).to.deep.equal(['change:month', 'activate:month']);
    const selected = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="segment"][data-value="month"]')!;
    await waitUntil(() => {
      const paint = getComputedStyle(selected);
      return paint.color === checkedPaint.color && paint.backgroundColor === checkedPaint.backgroundColor;
    }, 'Keyboard selection reaches the checked paint before the accessibility scan');
    await expect(el).to.be.accessible();
  });
  for (const withProperties of [true, false]) {
    it(`retains native forwarding-slot fallback and restores assignments ${withProperties ? 'with' : 'without'} property fallbacks`, async () => {
      const frame = await fixture<HTMLElement>(html`<div></div>`);
      const outer = frame.attachShadow({ mode: 'open' });
      const el = document.createElement('lr-segmented') as FieldSegmented;
      el.labelDisplay = 'visible';
      el.label = withProperties ? 'Property caption' : '';
      el.hint = withProperties ? 'Property guidance' : '';
      el.items = choices;
      const caption = document.createElement('slot');
      caption.name = 'caption'; caption.slot = 'label'; caption.textContent = 'Outer fallback caption';
      const hint = document.createElement('slot');
      hint.name = 'guidance'; hint.slot = 'hint'; hint.textContent = 'Outer fallback guidance';
      el.append(caption, hint);
      outer.append(el);
      await el.updateComplete;
      await twoFrames();
      await el.updateComplete;
      expect(caption.assignedNodes().length).to.equal(0);
      expect(el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="label"]')!.assignedNodes().length).to.equal(1);
      expect(part(el, 'base').hasAttribute('aria-label')).to.equal(false);
      expect(part(el, 'base').hasAttribute('aria-labelledby')).to.equal(true);
      expect(part(el, 'form-control-label').hidden).to.equal(false);
      expect(part(el, 'hint').hidden).to.equal(false);
      expect(reference(el, 'aria-labelledby').id).to.equal(part(el, 'form-control-label').id);
      await expect(el).to.be.accessible();
      expect(accessibleName(part(el, 'base'))).to.equal('Outer fallback caption');
      expect(describedText(el)).to.equal('Outer fallback guidance');
      expect(part(el, 'form-control-label').getBoundingClientRect().height).to.be.greaterThan(1);

      const assignedCaption = document.createElement('span');
      assignedCaption.slot = 'caption'; assignedCaption.textContent = 'Projected caption';
      const assignedHint = document.createElement('span');
      assignedHint.slot = 'guidance'; assignedHint.textContent = 'Projected guidance';
      frame.append(assignedCaption, assignedHint);
      await waitUntil(() => caption.assignedNodes().length === 1 && hint.assignedNodes().length === 1);
      await twoFrames();
      expect(accessibleName(part(el, 'base'))).to.equal('Projected caption');
      expect(describedText(el)).to.equal('Projected guidance');
      assignedCaption.remove(); assignedHint.remove();
      await waitUntil(() => caption.assignedNodes().length === 0 && hint.assignedNodes().length === 0);
      await twoFrames();
      expect(accessibleName(part(el, 'base'))).to.equal('Outer fallback caption');
      expect(describedText(el)).to.equal('Outer fallback guidance');

      // An empty assigned forwarding element still replaces both inner property fallbacks.
      caption.replaceChildren(); hint.replaceChildren();
      await twoFrames();
      expect(part(el, 'base').hasAttribute('aria-label')).to.equal(false);
      expect(part(el, 'base').hasAttribute('aria-labelledby')).to.equal(true);
      expect(part(el, 'base').hasAttribute('aria-describedby')).to.equal(true);
      expect(accessibleName(part(el, 'base'))).to.equal('');
      expect(describedText(el)).to.equal('');

      // Removing the empty forwarders must restore native fallback without a host update call.
      caption.remove(); hint.remove();
      await waitUntil(() => !part(el, 'base').hasAttribute('aria-labelledby'));
      expect(part(el, 'base').getAttribute('aria-label')).to.equal(withProperties ? 'Property caption' : null);
      expect(part(el, 'form-control-label').hidden).to.equal(!withProperties);
      expect(part(el, 'hint').hidden).to.equal(!withProperties);
      expect(part(el, 'base').hasAttribute('aria-describedby')).to.equal(withProperties);
      if (withProperties) {
        expect(accessibleName(part(el, 'base'))).to.equal('Property caption');
        expect(describedText(el)).to.equal('Property guidance');
      }
      caption.textContent = 'Restored caption'; hint.textContent = 'Restored guidance';
      el.append(caption, hint);
      await waitUntil(() => !!part(el, 'base').getAttribute('aria-labelledby') &&
        !!part(el, 'base').getAttribute('aria-describedby'));
      expect(part(el, 'base').hasAttribute('aria-label')).to.equal(false);
      expect(part(el, 'form-control-label').hidden).to.equal(false);
      expect(part(el, 'hint').hidden).to.equal(false);
      expect(accessibleName(part(el, 'base'))).to.equal('Restored caption');
      expect(describedText(el)).to.equal('Restored guidance');
      await expect(el).to.be.accessible();
    });
  }

});
