// <lr-toggle> renders no library-owned copy: every accessible name comes from the consumer (host
// aria-label, aria-labelledby or content), so there is no DEFAULT_STRINGS key and no `.strings`
// override to prove. The localization convention is therefore not applicable to this file.
import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './toggle.js';
import '../toggle-group/toggle-group.js';
import '../icon-button/icon-button.js';
import '../../utility/icon/icon.js';
import '../../conversation/message-actions/message-actions.js';
import type { LyraToggle, LyraToggleChangeDetail } from './toggle.class.js';
import type { LyraToggleGroup } from '../toggle-group/toggle-group.class.js';
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import { setForcedColors, setReducedMotion } from '../../../../test/wtr-media.js';
import { forceCoarsePointer } from '../../../../test/coarse-pointer-media.js';

const control = (el: LyraToggle): HTMLButtonElement =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;

const part = (el: LyraToggle, name: string): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;

const focusedPart = (el: LyraToggle): string | null =>
  el.shadowRoot!.activeElement?.getAttribute('part') ?? null;

/** Parses any CSS colour the engine can paint into sRGB channels through a 1x1 canvas. */
function rgb(color: string): [number, number, number, number] {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = '#000';
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r!, g!, b!, a!];
}

function luminance(color: string): number {
  const channel = (value: number): number => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(color);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

/** Enters real forced-colours emulation, reporting whether the engine honoured it. */
async function enterForcedColors(): Promise<boolean> {
  try {
    await setForcedColors('active');
  } catch {
    return false;
  }
  if (matchMedia('(forced-colors: active)').matches) return true;
  await setForcedColors('none');
  return false;
}

describe('<lr-toggle>', () => {
  afterEach(async () => {
    await resetMouse();
  });

  it('renders a native type=button with base/button parts and an explicit aria-pressed state', async () => {
    const el = await fixture<LyraToggle>(html`<lr-toggle>Bold</lr-toggle>`);
    const button = control(el);
    expect(button.localName).to.equal('button');
    expect(button.getAttribute('type')).to.equal('button');
    expect(button.getAttribute('part')!.split(/\s+/)).to.include.members(['base', 'button']);
    expect(button.getAttribute('aria-pressed')).to.equal('false');
    expect(button.hasAttribute('tabindex'), 'standalone internal button has no tabindex').to.equal(false);
    expect(el.hasAttribute('tabindex'), 'the host never takes a tabindex').to.equal(false);
    expect(el.hasAttribute('role')).to.equal(false);
    // The runtime side of the manifest's projected accessor defaults.
    expect([el.pressed, el.variant, el.appearance, el.size, el.disabled, el.value]).to.deep.equal([
      false,
      'neutral',
      'plain',
      'm',
      false,
      '',
    ]);

    el.setAttribute('pressed', '');
    await el.updateComplete;
    expect(el.pressed).to.equal(true);
    expect(button.getAttribute('aria-pressed')).to.equal('true');
  });

  it('emits the cancelable request before committing a click, then lr-change', async () => {
    const el = await fixture<LyraToggle>(html`<lr-toggle value="bold">Bold</lr-toggle>`);
    const order: string[] = [];
    let request: CustomEvent<LyraToggleChangeDetail> | undefined;
    let pressedDuringRequest: boolean | undefined;
    let change: CustomEvent<LyraToggleChangeDetail> | undefined;
    el.addEventListener('lr-toggle-toggle-request', (event) => {
      order.push('request');
      request = event;
      pressedDuringRequest = el.pressed;
    });
    el.addEventListener('lr-change', (event) => {
      order.push('change');
      change = event;
    });
    // The tag shares its name with the library's disclosure events, which it must never emit.
    for (const name of ['lr-toggle', 'lr-toggle-request']) {
      el.addEventListener(name, () => order.push(name));
    }

    control(el).click();
    await el.updateComplete;

    expect(order).to.deep.equal(['request', 'change']);
    expect(request!.cancelable).to.equal(true);
    expect(request!.bubbles && request!.composed).to.equal(true);
    expect(request!.detail.pressed).to.equal(true);
    expect(request!.detail.value).to.equal('bold');
    expect(pressedDuringRequest, 'pressed still holds the old value during the request').to.equal(false);
    expect(change!.cancelable).to.equal(false);
    expect(change!.bubbles && change!.composed).to.equal(true);
    expect(change!.detail.pressed).to.equal(true);
    expect(change!.detail.value).to.equal('bold');
    expect(el.pressed).to.equal(true);
    expect(el.hasAttribute('pressed')).to.equal(true);
    expect(control(el).getAttribute('aria-pressed')).to.equal('true');
  });

  it('keeps its state when the request is vetoed', async () => {
    const el = await fixture<LyraToggle>(html`<lr-toggle>Bold</lr-toggle>`);
    let changes = 0;
    el.addEventListener('lr-toggle-toggle-request', (event) => event.preventDefault());
    el.addEventListener('lr-change', () => {
      changes += 1;
    });
    control(el).click();
    await el.updateComplete;
    expect(el.pressed).to.equal(false);
    expect(changes).to.equal(0);
    expect(control(el).getAttribute('aria-pressed')).to.equal('false');
  });

  it('suppresses the commit when a listener writes pressed back to the value it already held', async () => {
    const el = await fixture<LyraToggle>(html`<lr-toggle>Bold</lr-toggle>`);
    let changes = 0;
    el.addEventListener('lr-toggle-toggle-request', () => {
      el.pressed = false;
    });
    el.addEventListener('lr-change', () => {
      changes += 1;
    });
    control(el).click();
    await el.updateComplete;
    expect(el.pressed, 'the listener resolved the request itself').to.equal(false);
    expect(changes).to.equal(0);
  });

  it('toggles from the keyboard: Space activates on keyup and Enter on keydown', async () => {
    const el = await fixture<LyraToggle>(html`<lr-toggle>Bold</lr-toggle>`);
    let changes = 0;
    el.addEventListener('lr-change', () => {
      changes += 1;
    });
    el.focus();
    expect(focusedPart(el)).to.equal('base button');
    await sendKeys({ press: 'Space' });
    await el.updateComplete;
    expect(el.pressed).to.equal(true);
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(el.pressed).to.equal(false);
    expect(changes).to.equal(2);
  });

  it('keeps programmatic pressed and value writes silent', async () => {
    const el = await fixture<LyraToggle>(html`<lr-toggle>Bold</lr-toggle>`);
    let events = 0;
    for (const name of ['lr-toggle-toggle-request', 'lr-change'] as const) {
      el.addEventListener(name, () => {
        events += 1;
      });
    }
    el.pressed = true;
    el.value = 'bold';
    await el.updateComplete;
    expect(el.hasAttribute('pressed')).to.equal(true);
    el.pressed = false;
    await el.updateComplete;
    expect(events).to.equal(0);
    expect(el.hasAttribute('pressed')).to.equal(false);
  });

  it('forwards host click(), focus() and blur(), relaying focus/blur exactly once', async () => {
    const el = await fixture<LyraToggle>(html`<lr-toggle value="pin">Pin</lr-toggle>`);
    const changed = oneEvent(el, 'lr-change');
    el.click();
    const change = await changed;
    expect(change.detail.pressed).to.equal(true);
    expect(el.pressed).to.equal(true);

    const relayed: string[] = [];
    const relays: Event[] = [];
    for (const name of ['focus', 'blur'] as const) {
      el.addEventListener(name, (event) => {
        relayed.push(event.type);
        relays.push(event);
      });
    }
    el.focus();
    expect(focusedPart(el)).to.equal('base button');
    el.blur();
    expect(el.shadowRoot!.activeElement === null).to.equal(true);
    expect(relayed).to.deep.equal(['focus', 'blur']);
    expect(relays.every((event) => event.bubbles && event.composed)).to.equal(true);
  });

  it('is inert while disabled: no toggle, no events, no focus, no hover tint', async () => {
    const el = await fixture<LyraToggle>(
      html`<lr-toggle disabled style="--lr-transition-fast: 0s">Bold</lr-toggle>`,
    );
    const button = control(el);
    let events = 0;
    for (const name of ['lr-toggle-toggle-request', 'lr-change'] as const) {
      el.addEventListener(name, () => {
        events += 1;
      });
    }
    expect(button.disabled).to.equal(true);
    expect(el.effectiveDisabled).to.equal(true);
    const resting = getComputedStyle(button).backgroundColor;
    button.click();
    el.click();
    el.focus();
    expect(el.shadowRoot!.activeElement === null).to.equal(true);
    await sendKeys({ press: 'Space' });
    const rect = button.getBoundingClientRect();
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2)],
    });
    await settlePointer();
    expect(getComputedStyle(button).backgroundColor).to.equal(resting);
    expect(el.pressed).to.equal(false);
    expect(events).to.equal(0);
  });

  it('forwards host aria-label by presence and projects aria-labelledby onto the button', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <span id="toggle-name">Mute microphone</span>
      <lr-toggle aria-label="Bold">B</lr-toggle>
    </div>`);
    const el = wrapper.querySelector<LyraToggle>('lr-toggle')!;
    const button = control(el);
    expect(button.getAttribute('aria-label')).to.equal('Bold');
    el.setAttribute('aria-label', '');
    await el.updateComplete;
    expect(button.getAttribute('aria-label'), 'an explicit empty value is forwarded').to.equal('');
    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(button.hasAttribute('aria-label'), 'removal falls back to content').to.equal(false);

    const source = wrapper.querySelector('#toggle-name')!;
    el.setAttribute('aria-label', 'Ignored');
    el.setAttribute('aria-labelledby', 'toggle-name');
    const labels = (): readonly Element[] => control(el).ariaLabelledByElements ?? [];
    await waitUntil(() => labels()[0] === source, 'aria-labelledby did not resolve');
    expect(labels().map((node) => node.id)).to.deep.equal(['toggle-name']);

    const replacement = document.createElement('span');
    replacement.id = 'toggle-name';
    replacement.textContent = 'Replacement';
    source.replaceWith(replacement);
    await waitUntil(() => labels()[0] === replacement, 'same-ID replacement was not followed');

    el.remove();
    await waitUntil(() => (button.ariaLabelledByElements ?? []).length === 0, 'the lease survived disconnect');
    wrapper.append(el);
    await waitUntil(() => labels()[0] === replacement, 'the lease was not re-acquired on reconnect');
  });

  it('names an icon-only toggle from a labelled icon and passes axe', async () => {
    const el = await fixture<LyraToggle>(
      html`<lr-toggle pressed><lr-icon name="check" label="Bold"></lr-icon></lr-toggle>`,
    );
    expect(control(el).getAttribute('aria-pressed')).to.equal('true');
    await expect(el).to.be.accessible();
  });

  it('projects aria-describedby independently of aria-labelledby, across replacement and reconnect', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <span id="toggle-help">Applies bold weight</span>
      <span id="toggle-label">Bold</span>
      <lr-toggle aria-describedby="toggle-help" aria-labelledby="toggle-label">B</lr-toggle>
    </div>`);
    const el = wrapper.querySelector<LyraToggle>('lr-toggle')!;
    const descriptions = (): string[] =>
      (control(el).ariaDescribedByElements ?? []).map((node) => node.id);
    const labels = (): string[] => (control(el).ariaLabelledByElements ?? []).map((node) => node.id);
    await waitUntil(() => descriptions()[0] === 'toggle-help' && labels()[0] === 'toggle-label');

    const help = wrapper.querySelector('#toggle-help')!;
    const replacement = document.createElement('span');
    replacement.id = 'toggle-help';
    replacement.textContent = 'Replacement';
    help.replaceWith(replacement);
    await waitUntil(() => control(el).ariaDescribedByElements?.[0] === replacement);
    expect(labels()).to.deep.equal(['toggle-label']);

    el.removeAttribute('aria-describedby');
    await waitUntil(() => descriptions().length === 0);
    expect(labels(), 'removing the description left the label alone').to.deep.equal(['toggle-label']);

    el.remove();
    el.setAttribute('aria-describedby', 'toggle-help');
    wrapper.append(el);
    await waitUntil(() => descriptions()[0] === 'toggle-help' && labels()[0] === 'toggle-label');
  });

  it('draws a transparent plain border and a visible outlined border, repairing an invalid appearance', async () => {
    const plain = await fixture<LyraToggle>(html`<lr-toggle>Plain</lr-toggle>`);
    const outlined = await fixture<LyraToggle>(html`<lr-toggle appearance="outlined">Outlined</lr-toggle>`);
    const reference = await fixture<LyraToggle>(
      html`<lr-toggle style="--lr-toggle-border-color: var(--lr-color-border)">Reference</lr-toggle>`,
    );
    expect(rgb(getComputedStyle(control(plain)).borderTopColor)[3], 'plain border is transparent').to.equal(0);
    expect(getComputedStyle(control(outlined)).borderTopColor).to.equal(
      getComputedStyle(control(reference)).borderTopColor,
    );
    expect(rgb(getComputedStyle(control(outlined)).borderTopColor)[3]).to.equal(255);
    expect(getComputedStyle(control(outlined)).borderTopStyle).to.equal('solid');
    expect(control(plain).getBoundingClientRect().height).to.equal(
      control(outlined).getBoundingClientRect().height,
    );

    const invalid = await fixture<LyraToggle>(html`<lr-toggle appearance="loud">Invalid</lr-toggle>`);
    expect(invalid.appearance).to.equal('plain');
    expect(invalid.getAttribute('appearance')).to.equal('plain');
  });

  it('tints the pressed fill from the variant row', async () => {
    const neutral = await fixture<LyraToggle>(html`<lr-toggle pressed>Neutral</lr-toggle>`);
    const brand = await fixture<LyraToggle>(html`<lr-toggle pressed variant="brand">Brand</lr-toggle>`);
    const probe = await fixture<LyraToggle>(
      html`<lr-toggle style="--lr-toggle-background: var(--lr-color-brand-fill-quiet)">Probe</lr-toggle>`,
    );
    const neutralFill = getComputedStyle(control(neutral)).backgroundColor;
    const brandFill = getComputedStyle(control(brand)).backgroundColor;
    expect(brandFill).to.not.equal(neutralFill);
    expect(brandFill).to.equal(getComputedStyle(control(probe)).backgroundColor);
    const invalid = await fixture<LyraToggle>(html`<lr-toggle variant="loud">Invalid</lr-toggle>`);
    expect(invalid.variant).to.equal('neutral');
    expect(invalid.getAttribute('variant')).to.equal('neutral');
  });

  it('follows the shared size ladder, accepting both spellings and repairing invalid values', async () => {
    const s = await fixture<LyraToggle>(html`<lr-toggle size="s">S</lr-toggle>`);
    const small = await fixture<LyraToggle>(html`<lr-toggle size="small">S</lr-toggle>`);
    const invalid = await fixture<LyraToggle>(html`<lr-toggle size="huge">M</lr-toggle>`);
    const m = await fixture<LyraToggle>(html`<lr-toggle>M</lr-toggle>`);
    const height = (el: LyraToggle): number => control(el).getBoundingClientRect().height;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const tier = parseFloat(getComputedStyle(s).getPropertyValue('--lr-form-control-height-s')) * rem;
    expect(height(s)).to.be.closeTo(tier, 0.5);
    expect(height(small)).to.equal(height(s));
    expect(invalid.size).to.equal('m');
    expect(invalid.getAttribute('size')).to.equal('m');
    expect(height(invalid)).to.equal(height(m));
    expect(height(m)).to.be.greaterThan(height(s));
  });

  it('keeps a WCAG 2.5.8 target at every tier and floors coarse pointers at 44px', async () => {
    const m = await fixture<LyraToggle>(html`<lr-toggle>Bold</lr-toggle>`);
    const icon = await fixture<LyraToggle>(
      html`<lr-toggle aria-label="Bold"><lr-icon name="check"></lr-icon></lr-toggle>`,
    );
    const tiny = await fixture<LyraToggle>(
      html`<lr-toggle size="2xs" aria-label="Bold"><lr-icon name="check"></lr-icon></lr-toggle>`,
    );
    const box = (el: LyraToggle): DOMRect => control(el).getBoundingClientRect();
    expect(box(m).height).to.be.at.least(40);
    expect(box(m).width).to.be.at.least(40);
    expect(box(icon).width).to.be.closeTo(box(icon).height, 0.5);
    expect(box(tiny).height).to.be.at.least(24);
    expect(box(tiny).width).to.be.at.least(24);
    const restore = forceCoarsePointer(tiny);
    try {
      expect(box(tiny).height).to.be.at.least(44);
      expect(box(tiny).width).to.be.at.least(44);
    } finally {
      restore();
    }
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`gives the pressed state a 3:1 indicator against the surface (${theme})`, async () => {
      for (const variant of ['neutral', 'brand'] as const) {
        const el = await fixture<LyraToggle>(
          html`<lr-toggle pressed variant=${variant} data-lr-theme=${theme}>Bold</lr-toggle>`,
        );
        const surface = await fixture<LyraToggle>(
          html`<lr-toggle data-lr-theme=${theme} style="--lr-toggle-background: var(--lr-color-surface)">S</lr-toggle>`,
        );
        const border = getComputedStyle(control(el)).borderTopColor;
        const background = getComputedStyle(control(surface)).backgroundColor;
        expect(contrast(border, background), `${variant} ${theme}: ${border} on ${background}`).to.be.at.least(3);
      }
    });
  }

  it('repaints on hover, press and keyboard focus', async () => {
    const before = await fixture<HTMLButtonElement>(html`<button>Before</button>`);
    const el = await fixture<LyraToggle>(html`<lr-toggle style="--lr-transition-fast: 0s">Bold</lr-toggle>`);
    const button = control(el);
    const resting = getComputedStyle(button).backgroundColor;
    await hoverUntilMatched(button, 'the pointer never hovered the toggle');
    await waitUntil(() => getComputedStyle(button).backgroundColor !== resting, 'hover did not repaint');
    const hovered = getComputedStyle(button).backgroundColor;
    await sendMouse({ type: 'down' });
    try {
      await waitUntil(() => getComputedStyle(button).backgroundColor !== hovered, 'press did not repaint');
    } finally {
      await resetMouse();
    }
    expect(getComputedStyle(button).outlineStyle).to.equal('none');
    before.focus();
    await sendKeys({ press: 'Tab' });
    await waitUntil(() => el.shadowRoot!.activeElement === button, 'Tab did not reach the toggle');
    expect(button.matches(':focus-visible')).to.equal(true);
    expect(getComputedStyle(button).outlineStyle).to.equal('solid');
  });

  it('collapses its transition under reduced motion', async () => {
    const el = await fixture<LyraToggle>(html`<lr-toggle>Bold</lr-toggle>`);
    const duration = (): number =>
      parseFloat(getComputedStyle(control(el)).transitionDuration.split(',')[0]!);
    expect(duration()).to.be.greaterThan(0.01);
    await setReducedMotion('reduce');
    try {
      await waitUntil(() => duration() < 0.01, 'reduced motion did not collapse the transition');
    } finally {
      await setReducedMotion('no-preference');
    }
  });

  it('keeps pressed, hover and disabled states perceivable under forced colours', async function () {
    const pressed = await fixture<LyraToggle>(
      html`<lr-toggle pressed style="--lr-transition-fast: 0s">P</lr-toggle>`,
    );
    const resting = await fixture<LyraToggle>(html`<lr-toggle style="--lr-transition-fast: 0s">R</lr-toggle>`);
    const disabled = await fixture<LyraToggle>(
      html`<lr-toggle disabled style="--lr-transition-fast: 0s">D</lr-toggle>`,
    );
    const pressedDisabled = await fixture<LyraToggle>(
      html`<lr-toggle pressed disabled style="--lr-transition-fast: 0s">PD</lr-toggle>`,
    );
    const probe = await fixture<HTMLSpanElement>(html`<span style="color: GrayText">probe</span>`);
    if (!(await enterForcedColors())) this.skip();
    try {
      const pressedFill = getComputedStyle(control(pressed)).backgroundColor;
      expect(pressedFill).to.not.equal(getComputedStyle(control(resting)).backgroundColor);
      await hoverUntilMatched(control(pressed), 'the pointer never hovered the pressed toggle');
      await settlePointer();
      expect(getComputedStyle(control(pressed)).backgroundColor).to.equal(pressedFill);
      await hoverUntilMatched(control(resting), 'the pointer never hovered the resting toggle');
      await waitUntil(
        () => getComputedStyle(control(resting)).outlineStyle !== 'none',
        'no forced-colours hover outline',
      );
      const grayText = getComputedStyle(probe).color;
      for (const el of [disabled, pressedDisabled]) {
        await waitUntil(
          () => getComputedStyle(control(el)).color === grayText,
          `disabled text is ${getComputedStyle(control(el)).color}, not GrayText ${grayText}`,
        );
        expect(getComputedStyle(control(el)).opacity).to.equal('1');
      }
      expect(getComputedStyle(control(pressedDisabled)).outlineStyle).to.equal('solid');
    } finally {
      await resetMouse();
      await setForcedColors('none');
    }
  });

  it('places the start adornment at the inline start under RTL without setting its own dir', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      html`<div dir="rtl"><lr-toggle><span slot="start">S</span>Label</lr-toggle></div>`,
    );
    const toggle = wrapper.querySelector<LyraToggle>('lr-toggle')!;
    await toggle.updateComplete;
    await waitUntil(() => !part(toggle, 'start').hidden, 'the start wrapper never showed');
    const start = part(toggle, 'start').getBoundingClientRect();
    const label = part(toggle, 'label').getBoundingClientRect();
    expect(start.left).to.be.greaterThan(label.left);
    expect(toggle.hasAttribute('dir')).to.equal(false);
  });

  it('hides empty start/end wrappers and shows them once content is assigned', async () => {
    const el = await fixture<LyraToggle>(html`<lr-toggle>Label</lr-toggle>`);
    expect(part(el, 'start').hidden).to.equal(true);
    expect(part(el, 'end').hidden).to.equal(true);
    const start = document.createElement('span');
    start.slot = 'start';
    start.textContent = 'S';
    const end = document.createElement('span');
    end.slot = 'end';
    end.textContent = 'E';
    el.append(start, end);
    await waitUntil(() => !part(el, 'start').hidden && !part(el, 'end').hidden, 'wrappers stayed hidden');
    const startSlot = part(el, 'start').querySelector<HTMLSlotElement>('slot')!;
    const endSlot = part(el, 'end').querySelector<HTMLSlotElement>('slot')!;
    expect(startSlot.assignedElements().map((node) => node.textContent)).to.deep.equal(['S']);
    expect(endSlot.assignedElements().map((node) => node.textContent)).to.deep.equal(['E']);
    start.remove();
    await waitUntil(() => part(el, 'start').hidden, 'the start wrapper did not hide again');
  });

  it('ellipsizes a long label inside a 320px allocation without overflowing', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="inline-size: 320px">
      <lr-toggle>${'A very long toggle label that cannot possibly fit '.repeat(4)}</lr-toggle>
    </div>`);
    const el = wrapper.querySelector<LyraToggle>('lr-toggle')!;
    await el.updateComplete;
    const label = part(el, 'label');
    expect(label.scrollWidth).to.be.greaterThan(label.clientWidth);
    expect(el.getBoundingClientRect().right).to.be.at.most(wrapper.getBoundingClientRect().right + 0.5);
    expect(control(el).getBoundingClientRect().right).to.be.at.most(
      wrapper.getBoundingClientRect().right + 0.5,
    );
  });

  it('keeps pressed state and relationships across a reconnect', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <span id="reconnect-help">Help</span>
      <lr-toggle pressed aria-describedby="reconnect-help">Bold</lr-toggle>
    </div>`);
    const el = wrapper.querySelector<LyraToggle>('lr-toggle')!;
    el.remove();
    wrapper.append(el);
    await el.updateComplete;
    expect(el.pressed).to.equal(true);
    await waitUntil(() => control(el).ariaDescribedByElements?.[0]?.id === 'reconnect-help');
    const changed = oneEvent(el, 'lr-change');
    control(el).click();
    expect((await changed).detail.pressed).to.equal(false);
  });

  it('is accessible in populated unpressed, pressed and icon-only states', async () => {
    const el = await fixture<LyraToggle>(
      html`<lr-toggle><lr-icon slot="start" name="check"></lr-icon>Bold</lr-toggle>`,
    );
    await waitUntil(() => !part(el, 'start').hidden, 'the start icon never rendered');
    await expect(el).to.be.accessible();
    el.pressed = true;
    await el.updateComplete;
    expect(control(el).getAttribute('aria-pressed')).to.equal('true');
    await expect(el).to.be.accessible();
    const icon = await fixture<LyraToggle>(
      html`<lr-toggle pressed aria-label="Pin"><lr-icon name="check"></lr-icon></lr-toggle>`,
    );
    expect(control(icon).getAttribute('aria-label')).to.equal('Pin');
    await expect(icon).to.be.accessible();
  });

  it('joins lr-message-actions roving through its internal button', async () => {
    const actions = await fixture<HTMLElement>(html`<lr-message-actions>
      <lr-toggle id="pin" aria-label="Pin">P</lr-toggle>
      <lr-toggle id="read" aria-label="Read aloud">R</lr-toggle>
      <lr-icon-button id="more" name="menu" label="More"></lr-icon-button>
    </lr-message-actions>`);
    const pin = actions.querySelector<LyraToggle>('#pin')!;
    const read = actions.querySelector<LyraToggle>('#read')!;
    const more = actions.querySelector<HTMLElement>('#more')!;
    await Promise.all([pin.updateComplete, read.updateComplete]);
    const moreControl = (): HTMLElement => more.shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!;
    const stops = (): (string | null)[] =>
      [control(pin), control(read), moreControl()].map((node) => node.getAttribute('tabindex'));
    await waitUntil(() => stops().filter((value) => value === '0').length === 1, 'no single roving stop');
    expect(stops().every((value) => value === '0' || value === '-1')).to.equal(true);
    pin.focus();
    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(
      () => read.shadowRoot!.activeElement === control(read),
      'ArrowRight did not reach the next toggle',
    );
    await waitUntil(() => control(read).getAttribute('tabindex') === '0', 'the stop did not follow focus');
    expect([pin, read].some((toggle) => toggle.hasAttribute('tabindex'))).to.equal(false);
  });

  it('leases the internal tabindex through getToolbarActions() and restores it on release', async () => {
    const el = await fixture<LyraToggle>(html`<lr-toggle>Bold</lr-toggle>`);
    const [action] = el.getToolbarActions();
    expect(action!.id).to.equal('toggle');
    expect(action!.disabled).to.equal(false);
    action!.setTabIndex(-1);
    expect(control(el).getAttribute('tabindex')).to.equal('-1');
    el.pressed = true;
    await el.updateComplete;
    expect(control(el).getAttribute('tabindex'), 'a re-render keeps the lease').to.equal('-1');
    action!.releaseTabIndex!();
    expect(control(el).hasAttribute('tabindex')).to.equal(false);
    expect(action!.matchesEventPath([control(el)])).to.equal(true);
    expect(action!.matchesEventPath([el])).to.equal(true);
    expect(action!.matchesEventPath([document.body])).to.equal(false);
    el.disabled = true;
    await el.updateComplete;
    expect(action!.disabled).to.equal(true);
  });

  it('contributes no toolbar action while grouped, announcing each join and leave once', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-toggle-group label="Formatting"></lr-toggle-group>
      <lr-toggle value="bold">Bold</lr-toggle>
    </div>`);
    const group = wrapper.querySelector<LyraToggleGroup>('lr-toggle-group')!;
    const el = wrapper.querySelector<LyraToggle>('lr-toggle')!;
    expect(el.getToolbarActions().length).to.equal(1);
    const notifications: Event[] = [];
    wrapper.addEventListener('lr-toolbar-actions-change', (event) => notifications.push(event));
    group.append(el);
    await waitUntil(() => el.getToolbarActions().length === 0, 'the toggle never joined the group');
    await el.updateComplete;
    expect(notifications.length).to.equal(1);
    expect(notifications.every((event) => event.bubbles && event.composed)).to.equal(true);
    wrapper.append(el);
    await waitUntil(() => el.getToolbarActions().length === 1, 'the toggle never left the group');
    await group.updateComplete;
    expect(notifications.length).to.equal(2);
  });
});
