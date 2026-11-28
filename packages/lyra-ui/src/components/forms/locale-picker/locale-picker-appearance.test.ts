import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-locale-picker.js';
import '../../lr-icon-button.js';
import type { LyraLocalePicker } from '../../lr-locale-picker.js';
import { setFlagUrlResolver } from '../../media/flag/flag.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const TEST_FLAG_SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';
setFlagUrlResolver(async () => TEST_FLAG_SRC);

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

interface Paint {
  background: string;
  borderColor: string;
}

function paint(node: Element): Paint {
  const style = getComputedStyle(node);
  return { background: style.backgroundColor, borderColor: style.borderTopColor };
}

async function launchers(appearance?: string): Promise<{ picker: LyraLocalePicker; trigger: HTMLElement; button: HTMLElement }> {
  const row = await fixture<HTMLDivElement>(html`
    <div data-lr-theme-scope style="display: flex; gap: 16px; padding: 16px; --lr-transition-fast: 0s">
      <lr-icon-button icon="sliders-horizontal" aria-label="Settings"></lr-icon-button>
      <lr-locale-picker trigger-display="flag" aria-label="Language"></lr-locale-picker>
    </div>
  `);
  const picker = row.querySelector<LyraLocalePicker>('lr-locale-picker')!;
  if (appearance !== undefined) picker.setAttribute('appearance', appearance);
  const iconButton = row.querySelector('lr-icon-button')!;
  await picker.updateComplete;
  await (iconButton as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  const trigger = picker.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
  const button = iconButton.shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!;
  return { picker, trigger, button };
}

describe('lr-locale-picker appearance', () => {
  afterEach(async () => {
    await resetMouse();
  });

  it('defaults to outlined and keeps the bordered surface trigger when unset', async () => {
    const { picker, trigger } = await launchers();
    expect(picker.appearance).to.equal('outlined');
    expect(picker.hasAttribute('appearance')).to.equal(false);
    const resting = paint(trigger);
    expect(resting.background).to.not.equal(TRANSPARENT);
    expect(resting.borderColor).to.not.equal(TRANSPARENT);
    const outlined = await launchers('outlined');
    expect(paint(outlined.trigger)).to.deep.equal(resting);
  });

  it('rests plain exactly like lr-icon-button: no fill and no visible edge', async () => {
    const { picker, trigger, button } = await launchers('plain');
    expect(picker.appearance).to.equal('plain');
    expect(paint(trigger).background).to.equal(TRANSPARENT);
    expect(paint(trigger).borderColor).to.equal(TRANSPARENT);
    expect(paint(trigger).background).to.equal(paint(button).background);
  });

  it('reflects a property-set appearance', async () => {
    const { picker, trigger } = await launchers();
    picker.appearance = 'plain';
    await picker.updateComplete;
    expect(picker.getAttribute('appearance')).to.equal('plain');
    expect(paint(trigger).background).to.equal(TRANSPARENT);
  });

  it('hovers plain with the same fill as lr-icon-button', async () => {
    const { trigger, button } = await launchers('plain');
    await hoverUntilMatched(button, 'icon button hovered');
    await waitUntil(() => paint(button).background !== TRANSPARENT, 'icon button hover painted');
    const expected = paint(button).background;
    await hoverUntilMatched(trigger, 'plain trigger hovered');
    await waitUntil(() => paint(trigger).background === expected, `plain hover fill ${paint(trigger).background} matches ${expected}`);
    expect(paint(trigger).borderColor).to.equal(TRANSPARENT);
  });

  it('presses plain with the same fill as lr-icon-button', async () => {
    const { trigger, button } = await launchers('plain');
    await hoverUntilMatched(button, 'icon button hovered');
    const hovered = paint(button).background;
    await sendMouse({ type: 'down' });
    await waitUntil(() => paint(button).background !== hovered, 'icon button press painted');
    const expected = paint(button).background;
    await sendMouse({ type: 'up' });
    await resetMouse();
    await hoverUntilMatched(trigger, 'plain trigger hovered');
    await sendMouse({ type: 'down' });
    try {
      await waitUntil(() => paint(trigger).background === expected, `plain press fill ${paint(trigger).background} matches ${expected}`);
    } finally {
      await sendMouse({ type: 'up' });
    }
  });

  it('lets the public hover token win over the plain hover default', async () => {
    const { picker, trigger } = await launchers('plain');
    picker.style.setProperty('--lr-locale-picker-trigger-hover-bg', 'rgb(1, 2, 3)');
    await hoverUntilMatched(trigger, 'plain trigger hovered');
    await waitUntil(() => paint(trigger).background === 'rgb(1, 2, 3)', 'public hover token reaches the plain trigger');
  });

  // The ring geometry is lr-icon-button's shared focus ring. Its colour is this glass-backed
  // component's own contrast-qualified ring, which appearance never changes, so it is compared
  // against the default trigger rather than the icon button.
  it('draws the shared keyboard focus ring on a plain trigger', async () => {
    const ringOf = (node: Element): { style: string; width: string; color: string } => {
      const style = getComputedStyle(node);
      return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
    };
    const outlined = await launchers();
    await focusByKeyboard(outlined.trigger);
    const outlinedRing = ringOf(outlined.trigger);
    const { trigger, button } = await launchers('plain');
    await focusByKeyboard(button);
    const buttonRing = ringOf(button);
    await focusByKeyboard(trigger);
    expect(trigger.matches(':focus-visible')).to.equal(true);
    const actual = ringOf(trigger);
    expect(actual.style).to.not.equal('none');
    expect({ style: actual.style, width: actual.width }).to.deep.equal({ style: buttonRing.style, width: buttonRing.width });
    expect(actual).to.deep.equal(outlinedRing);
  });

  for (const appearance of ['filled', 'filled-outlined', 'accent'] as const) {
    it(`paints a distinct ${appearance} resting fill`, async () => {
      const outlined = paint((await launchers('outlined')).trigger);
      const { trigger } = await launchers(appearance);
      const resting = paint(trigger);
      expect(resting.background).to.not.equal(TRANSPARENT);
      expect(resting.background).to.not.equal(outlined.background);
      if (appearance === 'filled-outlined') expect(resting.borderColor).to.equal(outlined.borderColor);
      else expect(resting.borderColor).to.equal(TRANSPARENT);
    });
  }

  it('passes axe with a plain flag-only trigger', async () => {
    const { picker } = await launchers('plain');
    await expect(picker).to.be.accessible();
  });
});
