import { expect, fixture, waitUntil } from '@open-wc/testing';
import { html, type TemplateResult } from 'lit';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse, settlePointer } from '../../test/wtr-mouse.js';
import '../components/forms/combobox/option.js';
import '../components/forms/select/select.js';
import '../components/forms/combobox/combobox.js';
import '../components/forms/locale-picker/locale-picker.js';
import '../components/forms/input/input.js';
import '../components/forms/textarea/textarea.js';
import '../components/forms/date-picker/date-input.js';
import '../components/media/file-input/file-input.js';
import '../components/forms/phone-input/phone-input.js';
import '../components/forms/token-input/token-input.js';
import '../components/forms/input/time-input.js';

/**
 * The form-field paint contract: every field-shaped control publishes the same quartet — resting fill,
 * resting border, hover border, focus halo — and each name reaches exactly one control.
 *
 * Ten controls, not the five the contract originally enumerated: the sweep for the same shape turned up
 * `lr-date-input`, `lr-file-input`, `lr-phone-input` and `lr-token-input` painting a resting
 * fill/border with no hook at all, and `lr-time-input` already publishing the resting pair but
 * missing the halo. Each one is covered here rather than on the strength of `lr-select`'s row.
 *
 * Every assertion reads a RENDERED result through `getComputedStyle`. A `var()` chain that never
 * resolves is silently inert, so a stylesheet-text assertion stays green for a hook nobody can use.
 * The controls are also asserted together rather than one per component test, because "each name
 * repaints only its own control" is the claim, and seven isolated tests could each pass while every
 * hook leaked into its neighbours.
 */

const OVERRIDE_FILL = 'rgb(2, 4, 6)';
const OVERRIDE_BORDER = 'rgb(8, 10, 12)';
const OVERRIDE_HOVER_BORDER = 'rgb(14, 16, 18)';
const HALO_COLOR = 'rgb(20, 22, 24)';
const HALO = `0 0 0 3px ${HALO_COLOR}`;
const TRANSPARENT = 'transparent';
/**
 * A legible retint, for the axe row only.
 *
 * The OVERRIDE_* colours above are deliberately absurd so a computed-style read cannot mistake one
 * for a real token, and a near-black fill behind --lr-color-text-quiet fails axe's contrast rule on
 * the fixture's own palette rather than on anything these hooks do. This pair keeps dark text on a
 * light field, so an axe failure there is a real one.
 */
const RETINT_FILL = 'rgb(250, 250, 252)';
const RETINT_BORDER = 'rgb(48, 52, 64)';

type UpdatingElement = HTMLElement & { updateComplete: Promise<unknown> };

interface Field {
  /** Human-readable name, used only in assertion messages — never a DOM node. */
  readonly name: string;
  readonly tag: string;
  /** Shadow selector of the element that actually paints the field surface. */
  readonly surface: string;
  readonly fillHook: string;
  readonly borderHook: string;
  /** `null` where the control has no pointer-hover border state of its own. */
  readonly hoverBorderHook: string | null;
  /** The token the resting fill falls back to, or `transparent` for the bare text surfaces. */
  readonly restingFill: string;
  readonly render: () => TemplateResult;
  /** Drives the control into the focused/open state its own stylesheet paints the halo on. */
  readonly enterFocusState: (host: HTMLElement) => Promise<void>;
}

function required<T>(value: T | null | undefined, description: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${description}.`);
  return value;
}

function settle(el: HTMLElement): Promise<unknown> {
  return (el as UpdatingElement).updateComplete;
}

function shadowPart(host: HTMLElement, selector: string, description: string): HTMLElement {
  return required(
    required(host.shadowRoot, `${description} shadow root`).querySelector<HTMLElement>(selector),
    `${description} ${selector}`,
  );
}

/**
 * A colour token's value as the engine will paint it.
 *
 * `getPropertyValue('--lr-color-surface')` hands back the authored token text, while
 * `backgroundColor` hands back the resolved `rgb(...)` form; comparing the two directly fails on
 * formatting alone, on every engine, for a perfectly correct implementation.
 */
function resolveColor(value: string): string {
  const probe = document.createElement('div');
  probe.style.color = value.trim();
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

function tokenOn(host: HTMLElement, name: string): string {
  return getComputedStyle(host).getPropertyValue(name).trim();
}

/** The resolved colour of a field's documented resting fill: a token, or the literal transparent. */
function expectedRestingFill(host: HTMLElement, field: Field): string {
  if (field.restingFill === TRANSPARENT) return resolveColor(TRANSPARENT);
  return resolveColor(tokenOn(host, field.restingFill));
}

async function focusPart(host: HTMLElement, selector: string, description: string): Promise<void> {
  shadowPart(host, selector, description).focus();
  await settle(host);
}

async function openHost(host: HTMLElement): Promise<void> {
  (host as HTMLElement & { open: boolean }).open = true;
  await settle(host);
}

const SELECT_FIELD: Field = {
  name: 'lr-select trigger',
  tag: 'lr-select',
  surface: '[part~="trigger"]',
  fillHook: '--lr-select-trigger-fill',
  borderHook: '--lr-select-trigger-border-color',
  hoverBorderHook: '--lr-select-trigger-hover-border-color',
  restingFill: '--lr-color-surface',
  render: () => html`<lr-select label="Fruit"><lr-option value="a">Apple</lr-option></lr-select>`,
  enterFocusState: openHost,
};

const COMBOBOX_FIELD: Field = {
  name: 'lr-combobox row',
  tag: 'lr-combobox',
  surface: '[part~="combobox"]',
  fillHook: '--lr-combobox-fill',
  borderHook: '--lr-combobox-border-color',
  hoverBorderHook: null,
  restingFill: '--lr-color-surface',
  render: () =>
    html`<lr-combobox label="Fruit"><lr-option value="a">Apple</lr-option></lr-combobox>`,
  enterFocusState: (host) => focusPart(host, '[part="combobox-input"]', 'lr-combobox'),
};

const FIELDS: readonly Field[] = [
  SELECT_FIELD,
  COMBOBOX_FIELD,
  {
    name: 'lr-locale-picker trigger',
    tag: 'lr-locale-picker',
    surface: '[part~="trigger"]',
    fillHook: '--lr-locale-picker-trigger-fill',
    borderHook: '--lr-locale-picker-trigger-border-color',
    hoverBorderHook: '--lr-locale-picker-trigger-hover-border-color',
    restingFill: '--lr-color-surface',
    render: () => html`<lr-locale-picker label="Language"></lr-locale-picker>`,
    enterFocusState: openHost,
  },
  {
    name: 'lr-date-input row',
    tag: 'lr-date-input',
    surface: '[part~="input-wrapper"]',
    fillHook: '--lr-date-input-fill',
    borderHook: '--lr-date-input-border-color',
    hoverBorderHook: null,
    restingFill: '--lr-color-surface',
    render: () => html`<lr-date-input label="Starts"></lr-date-input>`,
    enterFocusState: (host) => focusPart(host, '[part="input"]', 'lr-date-input'),
  },
  {
    name: 'lr-file-input dropzone',
    tag: 'lr-file-input',
    surface: '[part~="base"]',
    fillHook: '--lr-file-input-dropzone-fill',
    borderHook: '--lr-file-input-dropzone-border-color',
    hoverBorderHook: '--lr-file-input-dropzone-hover-border-color',
    restingFill: '--lr-color-surface',
    render: () => html`<lr-file-input label="Docs"></lr-file-input>`,
    enterFocusState: (host) => focusPart(host, '[part~="base"]', 'lr-file-input'),
  },
  {
    name: 'lr-phone-input row',
    tag: 'lr-phone-input',
    surface: '[part~="input-wrapper"]',
    fillHook: '--lr-phone-input-fill',
    borderHook: '--lr-phone-input-border-color',
    hoverBorderHook: null,
    restingFill: '--lr-color-surface',
    render: () => html`<lr-phone-input label="Phone"></lr-phone-input>`,
    enterFocusState: (host) => focusPart(host, '[part="input"]', 'lr-phone-input'),
  },
  {
    name: 'lr-token-input row',
    tag: 'lr-token-input',
    surface: '[part~="input-wrapper"]',
    fillHook: '--lr-token-input-fill',
    borderHook: '--lr-token-input-border-color',
    hoverBorderHook: null,
    restingFill: '--lr-color-surface',
    render: () => html`<lr-token-input label="Tags"></lr-token-input>`,
    enterFocusState: (host) => focusPart(host, '[part="input"]', 'lr-token-input'),
  },
  {
    name: 'lr-input row',
    tag: 'lr-input',
    surface: '[part~="input-wrapper"]',
    fillHook: '--lr-input-fill',
    borderHook: '--lr-input-border-color',
    hoverBorderHook: null,
    restingFill: TRANSPARENT,
    render: () => html`<lr-input label="Name"></lr-input>`,
    enterFocusState: (host) => focusPart(host, '[part="input"]', 'lr-input'),
  },
  {
    name: 'lr-time-input row',
    tag: 'lr-time-input',
    surface: '[part~="time-input"]',
    fillHook: '--lr-time-input-fill',
    borderHook: '--lr-time-input-border-color',
    hoverBorderHook: null,
    restingFill: TRANSPARENT,
    render: () => html`<lr-time-input label="Starts"></lr-time-input>`,
    // The row's own `[part='input']` is a role="group" div with no tabindex, so it refuses
    // `focus()`; the segments are the real focus targets and drive the same `:focus-within`.
    enterFocusState: (host) => focusPart(host, '[part="segment"]', 'lr-time-input'),
  },
  {
    name: 'lr-textarea field',
    tag: 'lr-textarea',
    surface: '[part~="textarea"]',
    fillHook: '--lr-textarea-fill',
    borderHook: '--lr-textarea-border-color',
    hoverBorderHook: '--lr-textarea-hover-border-color',
    restingFill: TRANSPARENT,
    render: () => html`<lr-textarea label="Notes"></lr-textarea>`,
    enterFocusState: (host) => focusPart(host, '[part="textarea"]', 'lr-textarea'),
  },
];

const FOCUS_SHADOW = '--lr-form-control-focus-shadow';

function setRoot(name: string, value: string): void {
  document.documentElement.style.setProperty(name, value);
}

function clearRoot(...names: string[]): void {
  for (const name of names) document.documentElement.style.removeProperty(name);
}

function clearEveryHook(): void {
  clearRoot(FOCUS_SHADOW);
  for (const field of FIELDS) {
    clearRoot(field.fillHook, field.borderHook);
    if (field.hoverBorderHook !== null) clearRoot(field.hoverBorderHook);
  }
}

/** One fixture holding every field, so cross-control leakage is observable in a single read. */
async function mountEveryField(): Promise<Map<string, HTMLElement>> {
  const wrapper = await fixture<HTMLElement>(html`<div>
    ${FIELDS.map((field) => field.render())}
  </div>`);
  const hosts = new Map<string, HTMLElement>();
  for (const field of FIELDS) {
    const host = required(wrapper.querySelector<HTMLElement>(field.tag), field.tag);
    await settle(host);
    hosts.set(field.name, host);
  }
  return hosts;
}

function surfaceOf(hosts: Map<string, HTMLElement>, field: Field): HTMLElement {
  return shadowPart(required(hosts.get(field.name), field.name), field.surface, field.name);
}

interface SurfacePaint {
  readonly fill: string;
  readonly border: string;
}

/**
 * Every field's own documented resting paint, resolved off the live fixture.
 *
 * Read once, before any hook is set, so the routing poll below has an exact expected colour for
 * each of the controls the hook under test must NOT reach — a leak check that names the colour it
 * wanted beats one that only knows the single value it refused to see.
 */
function restingPaintOf(hosts: Map<string, HTMLElement>): Map<string, SurfacePaint> {
  const resting = new Map<string, SurfacePaint>();
  for (const field of FIELDS) {
    const host = required(hosts.get(field.name), field.name);
    resting.set(field.name, {
      fill: expectedRestingFill(host, field),
      border: resolveColor(tokenOn(host, '--lr-color-border')),
    });
  }
  return resting;
}

async function mountOne(field: Field): Promise<HTMLElement> {
  const wrapper = await fixture<HTMLElement>(html`<div>${field.render()}</div>`);
  const host = required(wrapper.querySelector<HTMLElement>(field.tag), field.tag);
  await settle(host);
  return host;
}

afterEach(() => {
  clearEveryHook();
});

it('renders every field surface unchanged while the new hooks are unset', async () => {
  // The unset-regression row. Each control's resting paint is compared against the token its
  // documented default names, resolved off its own host — a literal colour here would go stale the
  // first time the palette is retuned, and "looks the same" is not an assertion.
  const hosts = await mountEveryField();
  const wrong: string[] = [];
  for (const field of FIELDS) {
    const host = required(hosts.get(field.name), field.name);
    const paint = getComputedStyle(surfaceOf(hosts, field));
    const expectedFill = expectedRestingFill(host, field);
    const expectedBorder = resolveColor(tokenOn(host, '--lr-color-border'));
    if (paint.backgroundColor !== expectedFill) {
      wrong.push(`${field.name} fill is ${paint.backgroundColor}, expected ${expectedFill}`);
    }
    // Every one of the seven rests on the shared border token in its default appearance —
    // lr-file-input included, which paints that same token dashed rather than solid, so the
    // resolved border-color is identical.
    if (paint.borderTopColor !== expectedBorder) {
      wrong.push(`${field.name} edge is ${paint.borderTopColor}, expected ${expectedBorder}`);
    }
    if (paint.boxShadow !== 'none') {
      wrong.push(`${field.name} rests with a box-shadow (${paint.boxShadow})`);
    }
  }
  expect(wrong.join('\n'), 'fields that changed with every hook unset').to.equal('');
});

it('routes each resting hook to exactly one control', async () => {
  // The discriminating half: a hook that repainted every field would satisfy "my control changed"
  // while being useless. Each name is set alone, on :root, and every other control is re-read.
  //
  // The read is POLLED, never taken in the same task as the :root write. Three of these surfaces
  // ease the two properties under test — lr-locale-picker's trigger transitions background-color
  // and border-color, lr-file-input's dropzone both, lr-textarea's field border-color — so a
  // synchronous read hands back the pre-transition value and fails a correct implementation on
  // every engine. Zeroing --lr-transition-fast on the fixture wrapper would not have helped:
  // internal/tokens.styles.ts declares that token inside each component's own :host block, which
  // out-ranks any ancestor value (only the --lr-theme-transition-fast input reaches it).
  //
  // The predicate is the EXACT settled colour of every field — the target on its two overrides,
  // every other control on its own resting paint. A looser "changed from resting" poll would
  // resolve on the first eased frame, and for the three surfaces resting on transparent that frame
  // is a partly transparent blend of the override: precisely the value this must not accept.
  const hosts = await mountEveryField();
  const resting = restingPaintOf(hosts);
  for (const target of FIELDS) {
    const expected = new Map(resting);
    expected.set(target.name, { fill: OVERRIDE_FILL, border: OVERRIDE_BORDER });
    const settled = (): boolean =>
      FIELDS.every((field) => {
        const want = required(expected.get(field.name), field.name);
        const paint = getComputedStyle(surfaceOf(hosts, field));
        return paint.backgroundColor === want.fill && paint.borderTopColor === want.border;
      });
    setRoot(target.fillHook, OVERRIDE_FILL);
    setRoot(target.borderHook, OVERRIDE_BORDER);
    try {
      await waitUntil(settled, `${target.name}'s resting hooks never settled`, { timeout: 2000 });
    } catch {
      // Swallowed deliberately. The poll decides WHEN to read, not WHETHER the contract holds:
      // letting its timeout propagate would replace the per-field report below with a bare
      // "condition not met", naming neither the control that misrouted nor the colour it painted.
      // The assertion that follows still fails, with the diagnosis attached.
    }
    const wrong: string[] = [];
    for (const field of FIELDS) {
      const paint = getComputedStyle(surfaceOf(hosts, field));
      const want = required(expected.get(field.name), field.name);
      const isTarget = field.name === target.name;
      if (isTarget && paint.backgroundColor !== OVERRIDE_FILL) {
        wrong.push(`${field.name} ignored ${target.fillHook} (${paint.backgroundColor})`);
      }
      if (isTarget && paint.borderTopColor !== OVERRIDE_BORDER) {
        wrong.push(`${field.name} ignored ${target.borderHook} (${paint.borderTopColor})`);
      }
      // Stricter than "did not take the override": any movement at all off its own resting colour
      // is a leak, including a partial one from a hook that resolves through an unintended chain.
      if (!isTarget && paint.backgroundColor !== want.fill) {
        wrong.push(
          `${field.name} fill moved to ${paint.backgroundColor} under ${target.fillHook}, expected ${want.fill}`,
        );
      }
      if (!isTarget && paint.borderTopColor !== want.border) {
        wrong.push(
          `${field.name} edge moved to ${paint.borderTopColor} under ${target.borderHook}, expected ${want.border}`,
        );
      }
    }
    clearRoot(target.fillHook, target.borderHook);
    expect(wrong.join('\n'), `fields misrouting ${target.name}'s resting hooks`).to.equal('');
  }
});

it('keeps a select trigger on its own hooks through every appearance', async () => {
  // lr-select repaints fill and border from five `:host([appearance='…'])` rules, each of which
  // out-ranks the resting `[part='trigger']` rule, so a hook wired only into that resting rule is
  // dead for five of the six treatments — and silently, since the control still renders.
  setRoot('--lr-select-trigger-fill', OVERRIDE_FILL);
  setRoot('--lr-select-trigger-border-color', OVERRIDE_BORDER);
  const wrong: string[] = [];
  for (const appearance of ['outlined', 'filled', 'filled-outlined', 'plain', 'accent']) {
    const host = await mountOne(SELECT_FIELD);
    host.setAttribute('appearance', appearance);
    await settle(host);
    const paint = getComputedStyle(shadowPart(host, '[part~="trigger"]', 'lr-select'));
    if (paint.backgroundColor !== OVERRIDE_FILL) {
      wrong.push(`appearance="${appearance}" fill is ${paint.backgroundColor}`);
    }
    if (paint.borderTopColor !== OVERRIDE_BORDER) {
      wrong.push(`appearance="${appearance}" edge is ${paint.borderTopColor}`);
    }
  }
  expect(wrong.join('\n'), 'select appearances that ignored the trigger hooks').to.equal('');
});

it('adds a focus halo on every field without disturbing its existing focus paint', async () => {
  // The halo is additive by contract: the outline and brand-border cues are the accessibility
  // answer to focus (WCAG 2.4.7), the halo is decoration a consumer opted into. Reading the focused
  // paint twice — once without the token, once with — is what proves "added", where a single read
  // with the token set could not tell an added layer from a replaced outline.
  const wrong: string[] = [];
  for (const field of FIELDS) {
    const host = await mountOne(field);
    const box = shadowPart(host, field.surface, field.name);
    await field.enterFocusState(host);

    const before = getComputedStyle(box);
    const baseline = {
      outlineStyle: before.outlineStyle,
      outlineWidth: before.outlineWidth,
      outlineColor: before.outlineColor,
      border: before.borderTopColor,
      fill: before.backgroundColor,
      shadow: before.boxShadow,
    };
    if (baseline.shadow !== 'none') {
      wrong.push(`${field.name} already painted a halo with the token unset (${baseline.shadow})`);
    }

    setRoot(FOCUS_SHADOW, HALO);
    // Poll for the exact post-change value: the halo grows out of `none`, and several of these
    // surfaces are mid-transition on an adjacent property when focus lands, so "changed from
    // resting" would pass on a half-applied frame.
    await waitUntil(
      () => getComputedStyle(box).boxShadow.includes(HALO_COLOR),
      `${field.name} never painted the focus halo`,
      { timeout: 2000 },
    );

    const after = getComputedStyle(box);
    if (after.outlineStyle !== baseline.outlineStyle) {
      wrong.push(`${field.name} outline-style moved to ${after.outlineStyle}`);
    }
    if (after.outlineWidth !== baseline.outlineWidth) {
      wrong.push(`${field.name} outline-width moved to ${after.outlineWidth}`);
    }
    if (after.outlineColor !== baseline.outlineColor) {
      wrong.push(`${field.name} outline-color moved to ${after.outlineColor}`);
    }
    if (after.borderTopColor !== baseline.border) {
      wrong.push(`${field.name} focus border moved to ${after.borderTopColor}`);
    }
    if (after.backgroundColor !== baseline.fill) {
      wrong.push(`${field.name} focus fill moved to ${after.backgroundColor}`);
    }
    clearRoot(FOCUS_SHADOW);
  }
  expect(wrong.join('\n'), 'fields whose focus paint the halo disturbed').to.equal('');
});

it('paints no halo on a field that is merely resting', async () => {
  const hosts = await mountEveryField();
  setRoot(FOCUS_SHADOW, HALO);
  const wrong: string[] = [];
  for (const field of FIELDS) {
    const shadow = getComputedStyle(surfaceOf(hosts, field)).boxShadow;
    if (shadow !== 'none') wrong.push(`${field.name} painted ${shadow} at rest`);
  }
  expect(wrong.join('\n'), 'fields that haloed without focus').to.equal('');
});

it('keeps the keyboard focus ring alongside the halo on a tabbed-to select', async () => {
  // The keyboard row: read from the element the browser actually focused, never from a synthetic
  // `.focus()` that cannot produce `:focus-visible` on every engine.
  setRoot(FOCUS_SHADOW, HALO);
  const wrapper = await fixture<HTMLElement>(html`<div>
    <button id="before">before</button>
    <lr-select label="Fruit"><lr-option value="a">Apple</lr-option></lr-select>
  </div>`);
  const host = required(wrapper.querySelector<HTMLElement>('lr-select'), 'lr-select');
  await settle(host);
  required(wrapper.querySelector<HTMLButtonElement>('#before'), 'preceding button').focus();
  await sendKeys({ press: 'Tab' });
  const trigger = shadowPart(host, '[part~="trigger"]', 'lr-select');
  await waitUntil(
    () => trigger.matches(':focus'),
    'Tab never reached the select trigger',
    { timeout: 2000 },
  );
  await waitUntil(
    () => getComputedStyle(trigger).boxShadow.includes(HALO_COLOR),
    'the tabbed-to trigger never painted the halo',
    { timeout: 2000 },
  );
  const focused = getComputedStyle(trigger);
  expect(focused.outlineStyle, 'keyboard focus outline style').to.not.equal('none');
  expect(focused.outlineWidth, 'keyboard focus outline width').to.not.equal('0px');
});

it('recolours a hovered field edge from its own hover hook', async () => {
  // Cross-engine row: `sendMouse` resolves when the command is delivered, not when the engine has
  // processed the pointer event, so the pointer is landed with `hoverUntilMatched` and the result
  // is polled. lr-file-input's dropzone also eases its border, so only an exact post-transition
  // value is a real assertion here.
  const hoverable = FIELDS.filter((field) => field.hoverBorderHook !== null);
  for (const field of hoverable) {
    const hook = required(field.hoverBorderHook, `${field.name} hover hook`);
    setRoot(hook, OVERRIDE_HOVER_BORDER);
    const host = await mountOne(field);
    const box = shadowPart(host, field.surface, field.name);
    try {
      await hoverUntilMatched(box, `${field.name} never took the pointer`);
      await waitUntil(
        () => getComputedStyle(box).borderTopColor === OVERRIDE_HOVER_BORDER,
        `${field.name} never reached its hover border colour`,
        { timeout: 2000 },
      );
    } finally {
      await resetMouse();
      clearRoot(hook);
    }
  }
});

it('drops a disabled field back to its resting edge with the pointer still on it', async () => {
  // The disabled row. Every hover rule is gated on `:not(:disabled)`, so the hook must go inert the
  // moment the control is disabled. Landing the pointer BEFORE disabling is deliberate: a disabled
  // button does not reliably accept `:hover` on every engine, so hovering it first would make the
  // assertion vacuous where it did not simply time out. Hovering while enabled proves the pointer
  // really arrived; the enabled reading is asserted too, so the second half cannot pass by accident.
  const field = SELECT_FIELD;
  setRoot(field.borderHook, OVERRIDE_BORDER);
  setRoot(required(field.hoverBorderHook, 'select hover hook'), OVERRIDE_HOVER_BORDER);
  const host = await mountOne(field);
  const box = shadowPart(host, field.surface, field.name);
  try {
    await hoverUntilMatched(box, 'select trigger never took the pointer');
    await waitUntil(
      () => getComputedStyle(box).borderTopColor === OVERRIDE_HOVER_BORDER,
      'the enabled trigger never reached its hover border colour',
      { timeout: 2000 },
    );
    (host as HTMLElement & { disabled: boolean }).disabled = true;
    await settle(host);
    await settlePointer();
    expect(getComputedStyle(box).borderTopColor, 'disabled trigger edge under the pointer').to.equal(
      OVERRIDE_BORDER,
    );
  } finally {
    await resetMouse();
  }
});

it('paints the field hooks identically under dir="rtl"', async () => {
  const field = SELECT_FIELD;
  setRoot(field.fillHook, OVERRIDE_FILL);
  setRoot(field.borderHook, OVERRIDE_BORDER);
  const host = await mountOne(field);
  host.setAttribute('dir', 'rtl');
  await settle(host);
  const paint = getComputedStyle(shadowPart(host, field.surface, field.name));
  expect(paint.backgroundColor, 'RTL trigger fill').to.equal(OVERRIDE_FILL);
  expect(paint.borderTopColor, 'RTL trigger edge').to.equal(OVERRIDE_BORDER);
});

it('keeps reading the field hooks after a disconnect and reconnect', async () => {
  const field = SELECT_FIELD;
  setRoot(field.fillHook, OVERRIDE_FILL);
  setRoot(FOCUS_SHADOW, HALO);
  const host = await mountOne(field);
  const parent = required(host.parentNode, 'select parent');
  const marker = document.createComment('form-field-paint-reconnect');
  parent.insertBefore(marker, host);
  host.remove();
  parent.insertBefore(host, marker);
  marker.remove();
  await settle(host);
  await field.enterFocusState(host);

  const box = shadowPart(host, field.surface, field.name);
  expect(getComputedStyle(box).backgroundColor, 'reconnected trigger fill').to.equal(OVERRIDE_FILL);
  await waitUntil(
    () => getComputedStyle(box).boxShadow.includes(HALO_COLOR),
    'the reconnected trigger never painted the halo',
    { timeout: 2000 },
  );
});

it('is accessible with the field hooks set and the listbox open', async () => {
  // Axe in the open/populated state with all three surface hooks live, not just the halo: a
  // retinted trigger against a retinted edge is exactly the contrast regression that only shows
  // once the surface is actually rendered open, and a resting axe run cannot see it.
  setRoot(FOCUS_SHADOW, HALO);
  for (const field of [SELECT_FIELD, COMBOBOX_FIELD]) {
    setRoot(field.fillHook, RETINT_FILL);
    setRoot(field.borderHook, RETINT_BORDER);
    const host = await mountOne(field);
    const box = shadowPart(host, field.surface, field.name);
    await field.enterFocusState(host);
    await openHost(host);
    // Proves the retint actually reached the rendered surface before axe grades it. Without this
    // the pass below could be grading an untouched control — the exact way a scenario test
    // silently stops testing its scenario.
    await waitUntil(
      () => getComputedStyle(box).backgroundColor === RETINT_FILL,
      `${field.name} never took the retint`,
      { timeout: 2000 },
    );
    for (const animation of box.getAnimations()) {
      animation.finish();
    }
    await expect(host).to.be.accessible();
    clearRoot(field.fillHook, field.borderHook);
  }
});
