import { fixture, expect, html } from '@open-wc/testing';
import './rating.js';
import type { LyraRating } from './rating.js';
import { styles } from './rating.styles.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

it('emits one cancelable lr-invalid alias whose cancellation cancels the native invalid event', async () => {
  const el = await fixture<LyraRating>(html`<lr-rating required aria-label="Score"></lr-rating>`);
  const aliases: CustomEvent[] = [];
  const nativePrevented: boolean[] = [];
  el.addEventListener('lr-invalid', (event) => aliases.push(event as CustomEvent));
  // Registered after the alias relay's own constructor-installed `invalid` listener, so it reads
  // the native event exactly as the relay left it.
  el.addEventListener('invalid', (event) => nativePrevented.push(event.defaultPrevented));

  expect(el.checkValidity()).to.be.false;
  expect(aliases).to.have.lengthOf(1);
  // Compared as a boolean, never as two DOM nodes: a failing chai assertion carrying an element
  // hangs the whole file.
  expect(aliases[0].target === el, 'lr-invalid is retargeted to the host').to.be.true;
  expect(aliases[0].bubbles && aliases[0].composed).to.be.true;
  expect(aliases[0].cancelable, 'lr-invalid is a real veto point').to.be.true;
  expect(nativePrevented, 'native invalid left alone while nobody cancels').to.deep.equal([false]);

  // Cancelling the alias must reach the platform event behind it, so an app presenting its own
  // error banner can suppress the browser's validation bubble.
  el.addEventListener('lr-invalid', (event) => event.preventDefault(), { once: true });

  expect(el.checkValidity()).to.be.false;
  expect(aliases).to.have.lengthOf(2);
  expect(
    nativePrevented,
    'preventDefault() on lr-invalid suppresses the native validation bubble',
  ).to.deep.equal([false, true]);
});

it('gives the star row hover feedback matching the keyboard focus-visible cue', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part~='base'\]:hover \[part='star'\]\s*\{[^}]*color:/);
});

it('keeps --lr-rating-empty-color reachable while the editable rating is hovered', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(
    /\[part~='base'\]:hover \[part='star'\]\s*\{[^}]*color:\s*var\(--lr-rating-empty-color,/,
  );
});

it('applies the mapped symbol color and spacing custom properties to rendered symbols', async () => {
  const el = await fixture<LyraRating>(html`
    <lr-rating
      value="2"
      style="--symbol-color: rgb(1, 2, 3); --symbol-color-active: rgb(4, 5, 6); --symbol-spacing: 11px;"
    ></lr-rating>
  `);
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const star = el.shadowRoot!.querySelector('[part="star"]') as HTMLElement;
  const fill = star.querySelector('[part="star-fill"]') as HTMLElement;

  expect(getComputedStyle(star).color).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(fill).color).to.equal('rgb(4, 5, 6)');
  expect(getComputedStyle(base).columnGap).to.equal('11px');
});

it('applies --symbol-size while preserving --lr-rating-size precedence', async () => {
  const mapped = await fixture<LyraRating>(html`
    <lr-rating style="--symbol-size: 37px;"></lr-rating>
  `);
  const lyraOverride = await fixture<LyraRating>(html`
    <lr-rating style="--symbol-size: 37px; --lr-rating-size: 29px;"></lr-rating>
  `);

  expect(getComputedStyle(mapped.shadowRoot!.querySelector('[part="star"]')!).fontSize).to.equal('37px');
  expect(getComputedStyle(lyraOverride.shadowRoot!.querySelector('[part="star"]')!).fontSize).to.equal('29px');
});

it('gates the pointer cursor and hover highlight behind readonly/disabled, not just disabled (regression)', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/:host\(:not\(:disabled\):not\(\[readonly\]\)\) \[part~='base'\]\s*\{[^}]*cursor:\s*pointer/);
  expect(css).to.match(
    /:host\(:not\(:disabled\):not\(\[readonly\]\)\) \[part~='base'\]:hover \[part='star'\]\s*\{[^}]*color:/,
  );
  // The old disabled-only gate must be gone, not merely joined by the new readonly+disabled one.
  expect(css).to.not.include(":host(:not([disabled])) [part~='base']:hover [part='star']");
  // `:disabled` (not `[disabled]`) is what tracks fieldset-cascaded disablement.
  expect(css).to.not.include(':host([disabled])');
});

it('does not show a pointer cursor on a readonly rating (it is still focusable but not settable)', async () => {
  const interactive = (await fixture(html`<lr-rating></lr-rating>`)) as LyraRating;
  const readonly = (await fixture(html`<lr-rating readonly></lr-rating>`)) as LyraRating;
  const interactiveBase = interactive.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const readonlyBase = readonly.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(getComputedStyle(interactiveBase).cursor).to.equal('pointer');
  expect(getComputedStyle(readonlyBase).cursor).to.not.equal('pointer');
});

it('exposes a keyboard-accessible rating slider', async () => {
  const el = (await fixture(html`<lr-rating value="2"></lr-rating>`)) as LyraRating;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('slider');
  expect(base.getAttribute('aria-valuenow')).to.equal('2');
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  expect(el.value).to.equal(3);
  await expect(el).to.be.accessible();
});

it('emits one native change Event before lr-change for a keyboard commit', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><lr-rating value="2"></lr-rating></div>`);
  const el = wrapper.querySelector('lr-rating') as LyraRating;
  const events: Event[] = [];
  wrapper.addEventListener('change', (event) => events.push(event));
  wrapper.addEventListener('lr-change', (event) => events.push(event));

  baseOf(el).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
  );

  expect(events.map((event) => event.type)).to.deep.equal(['change', 'lr-change']);
  const native = events[0]!;
  expect(native.constructor === Event).to.be.true;
  expect(native.target === el).to.be.true;
  expect(native.bubbles && native.composed).to.be.true;
  expect(native.cancelable).to.be.false;
  expect('detail' in native).to.be.false;
  expect((events[1] as CustomEvent<{ value: number }>).detail).to.deep.equal({ value: 3 });
});

it('emits the same native change contract for a pointer commit', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div><lr-rating value="0" precision="0.5" max="5"></lr-rating></div>
  `);
  const el = wrapper.querySelector('lr-rating') as LyraRating;
  const events: Event[] = [];
  wrapper.addEventListener('change', (event) => events.push(event));
  wrapper.addEventListener('lr-change', (event) => events.push(event));
  const thirdStar = starsOf(el)[2]!;
  pinStar(thirdStar);

  thirdStar.dispatchEvent(new MouseEvent('click', { clientX: 110, clientY: 20, bubbles: true }));

  expect(el.value).to.equal(2.5);
  expect(events.map((event) => event.type)).to.deep.equal(['change', 'lr-change']);
  expect(events[0]!.constructor === Event && events[0]!.target === el).to.be.true;
});

it('keeps native and prefixed change events silent for programmatic/default/reset writes', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-rating name="score" value="2"></lr-rating></form>
  `);
  const el = form.querySelector('lr-rating') as LyraRating;
  const events: string[] = [];
  el.addEventListener('change', () => events.push('change'));
  el.addEventListener('lr-change', () => events.push('lr-change'));

  el.value = 4;
  el.defaultValue = 1;
  form.reset();
  el.formStateRestoreCallback('3', 'restore');

  expect(events).to.deep.equal([]);
});

it('locale-formats the spoken slider value and forwards host focus/blur/click to the control', async () => {
  const el = (await fixture(html`<lr-rating lang="ar" value="2.5" precision="0.5"></lr-rating>`)) as LyraRating;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('aria-valuetext')).to.equal(new Intl.NumberFormat('ar').format(2.5));

  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base rating');
  el.blur();
  expect((el.shadowRoot!.activeElement) === (null)).to.equal(true);
  let clicked = 0;
  base.addEventListener('click', () => clicked++);
  el.click();
  expect(clicked).to.equal(1);
});

it('relays one native focus/blur pair and one prefixed alias pair from the slider control', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><lr-rating value="2"></lr-rating></div>`);
  const el = wrapper.querySelector('lr-rating') as LyraRating;
  const nativeEvents: FocusEvent[] = [];
  const aliases: string[] = [];
  wrapper.addEventListener('focus', (event) => nativeEvents.push(event as FocusEvent));
  wrapper.addEventListener('blur', (event) => nativeEvents.push(event as FocusEvent));
  wrapper.addEventListener('lr-focus', () => aliases.push('lr-focus'));
  wrapper.addEventListener('lr-blur', () => aliases.push('lr-blur'));

  el.focus();
  el.blur();

  expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
  expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
  expect(aliases).to.deep.equal(['lr-focus', 'lr-blur']);
});

it('reverses horizontal value movement under RTL', async () => {
  const el = (await fixture(html`<div dir="rtl"><lr-rating value="2"></lr-rating></div>`)).querySelector('lr-rating') as LyraRating;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  expect(el.value).to.equal(3);
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  expect(el.value).to.equal(2);
});

it('does not emit lr-change when the clamped value is unchanged', async () => {
  const el = (await fixture(html`<lr-rating value="5" max="5"></lr-rating>`)) as LyraRating;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  let changeCount = 0;
  let nativeChangeCount = 0;
  el.addEventListener('lr-change', () => { changeCount++; });
  el.addEventListener('change', () => { nativeChangeCount++; });
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  expect(el.value).to.equal(5);
  expect(changeCount).to.equal(0);
  expect(nativeChangeCount).to.equal(0);

  el.value = 0;
  changeCount = 0;
  nativeChangeCount = 0;
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
  expect(changeCount).to.equal(0);
  expect(nativeChangeCount).to.equal(0);
});

it('clamps a non-finite or oversized max to a safe, bounded star count', async () => {
  const nan = (await fixture(html`<lr-rating max="abc"></lr-rating>`)) as LyraRating;
  const nanBase = nan.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(nanBase.getAttribute('aria-valuemax')).to.equal('5');
  expect(nan.shadowRoot!.querySelectorAll('[part="star"]').length).to.equal(5);

  const huge = (await fixture(html`<lr-rating max="1000000"></lr-rating>`)) as LyraRating;
  expect(huge.shadowRoot!.querySelectorAll('[part="star"]').length).to.equal(100);
});

it('clamps an out-of-range or non-finite value to [0, max]', async () => {
  const negative = (await fixture(html`<lr-rating value="-10" max="5"></lr-rating>`)) as LyraRating;
  expect(negative.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-valuenow')).to.equal('0');

  const over = (await fixture(html`<lr-rating value="999" max="5"></lr-rating>`)) as LyraRating;
  expect(over.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-valuenow')).to.equal('5');

  const nan = (await fixture(html`<lr-rating max="5"></lr-rating>`)) as LyraRating;
  nan.value = NaN;
  await nan.updateComplete;
  expect(nan.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-valuenow')).to.equal('0');
});

it('falls back to a safe positive precision instead of throwing when precision is non-finite', async () => {
  const el = (await fixture(html`<lr-rating value="2" precision="abc"></lr-rating>`)) as LyraRating;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(() =>
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })),
  ).to.not.throw();
  expect(el.value).to.equal(3);
});

it('renders a distinct partial fill for a fractional value under a fractional precision', async () => {
  const el = (await fixture(html`<lr-rating value="3.5" precision="0.5" max="5"></lr-rating>`)) as LyraRating;
  const stars = el.shadowRoot!.querySelectorAll('[part="star"]');
  const thirdFill = stars[2].querySelector('[part="star-fill"]') as HTMLElement;
  const fourthFill = stars[3].querySelector('[part="star-fill"]') as HTMLElement;
  const fifthFill = stars[4].querySelector('[part="star-fill"]') as HTMLElement;
  expect(thirdFill.style.inlineSize, 'fully filled star').to.equal('100%');
  expect(fourthFill.style.inlineSize, 'half-filled star').to.equal('50%');
  expect(fifthFill.style.inlineSize, 'empty star').to.equal('0%');
  expect(stars[2].hasAttribute('data-filled')).to.be.true;
  expect(stars[3].hasAttribute('data-filled')).to.be.false;
});

it('selects the pointer segment within a star using fractional precision', async () => {
  const el = (await fixture(
    html`<lr-rating value="0" precision="0.5" max="5"></lr-rating>`,
  )) as LyraRating;
  const thirdStar = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="star"]')[2]!;
  thirdStar.getBoundingClientRect = () =>
    ({ left: 100, right: 140, top: 0, bottom: 40, width: 40, height: 40, x: 100, y: 0, toJSON() {} }) as DOMRect;

  thirdStar.dispatchEvent(
    new MouseEvent('click', { clientX: 110, clientY: 20, bubbles: true }),
  );

  expect(el.value).to.equal(2.5);
});

it('keeps the slider base at least 40px in both axes when max is zero or one', async () => {
  for (const max of [0, 1]) {
    const el = (await fixture(html`<lr-rating max=${max}></lr-rating>`)) as LyraRating;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const rect = base.getBoundingClientRect();
    expect(rect.width, `max=${max}`).to.be.at.least(40);
    expect(rect.height, `max=${max}`).to.be.at.least(40);
  }
});

// -- helpers --------------------------------------------------------------

const baseOf = (el: LyraRating): HTMLElement =>
  el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
const starsOf = (el: LyraRating): NodeListOf<HTMLElement> =>
  el.shadowRoot!.querySelectorAll<HTMLElement>('[part="star"]');

/** Pins one star's box so pointer math is geometry-independent: 40px wide, starting at x=100. */
function pinStar(star: HTMLElement): void {
  star.getBoundingClientRect = () =>
    ({ left: 100, right: 140, top: 0, bottom: 40, width: 40, height: 40, x: 100, y: 0, toJSON() {} }) as DOMRect;
}

function pointer(type: string, target: HTMLElement, clientX: number): void {
  target.dispatchEvent(
    new PointerEvent(type, { clientX, clientY: 20, bubbles: type !== 'pointerenter' && type !== 'pointerleave', composed: true, pointerId: 1 }),
  );
}

// -- Form association -----------------------------------------------------

it('participates in form submission under `name` and resets to the declarative value attribute', async () => {
  const form = (await fixture(html`
    <form><lr-rating name="score" value="2" max="5"></lr-rating></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-rating') as LyraRating;
  expect(new FormData(form).get('score')).to.equal('2');

  el.value = 5;
  expect(new FormData(form).get('score'), 'form value updates synchronously').to.equal('5');
  expect(el.form?.tagName).to.equal('FORM');
  expect(el.willValidate).to.be.true;

  form.reset();
  await el.updateComplete;
  expect(el.value, 'form.reset() restores the value attribute, not 0').to.equal(2);
});

it('keeps the reset default unclamped when the value attribute is parsed before max', async () => {
  const form = (await fixture(html`
    <form><lr-rating name="score" value="8" max="10"></lr-rating></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-rating') as LyraRating;
  expect(new FormData(form).get('score')).to.equal('8');
  el.value = 1;
  form.reset();
  expect(el.value, 'the default must not have been frozen at the pre-max ceiling').to.equal(8);
});

it('blocks submission while `required` and unrated, and clears the flag once rated', async () => {
  const form = (await fixture(html`
    <form><lr-rating name="score" required></lr-rating></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-rating') as LyraRating;
  expect(el.checkValidity()).to.be.false;
  expect(el.validity.valueMissing).to.be.true;
  expect(el.validationMessage.length).to.be.greaterThan(0);
  expect(form.checkValidity()).to.be.false;
  expect(baseOf(el).getAttribute('aria-required')).to.equal('true');

  el.value = 3;
  expect(el.checkValidity()).to.be.true;
  expect(el.validity.valueMissing).to.be.false;
  expect(form.checkValidity()).to.be.true;

  const optional = (await fixture(html`<lr-rating></lr-rating>`)) as LyraRating;
  expect(baseOf(optional).getAttribute('aria-required'), 'stateful ARIA renders "false" too').to.equal('false');
});

// -- validity custom states -----------------------------------------------
//
// `internals.states` (CustomStateSet) reached Chromium 125 / Safari 17.4 / Firefox 126, and the
// `:state()` selector shipped with it. The shared helper no-ops where either is missing, so these
// assertions skip rather than fail on an engine that predates them -- the same guards
// internal/form-associated.test.ts uses. `internals` is private on the class, so the states are
// probed the way a consumer reaches them: through a selector match on the host.
const supportsCustomStates = (() => {
  try {
    return typeof CustomStateSet === 'function';
  } catch {
    return false;
  }
})();
const supportsStateSelector = (() => {
  try {
    document.createElement('div').matches(':state(probe)');
    return true;
  } catch {
    return false;
  }
})();

it('publishes required/optional and valid/invalid as :state() selectors', async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const el = (await fixture(html`<lr-rating name="score"></lr-rating>`)) as LyraRating;
  const host = el as unknown as HTMLElement;
  expect(host.matches(':state(optional)'), 'optional on a control with no constraint').to.be.true;
  expect(host.matches(':state(required)'), 'required').to.be.false;
  expect(host.matches(':state(valid)'), 'valid').to.be.true;
  expect(host.matches(':state(invalid)'), 'invalid').to.be.false;

  el.required = true;
  expect(host.matches(':state(required)'), 'required after the property is set').to.be.true;
  expect(host.matches(':state(optional)'), 'optional after the property is set').to.be.false;
  expect(host.matches(':state(invalid)'), 'a required unrated control is invalid').to.be.true;
  expect(host.matches(':state(valid)'), 'valid while unrated').to.be.false;

  el.value = 4;
  expect(host.matches(':state(valid)'), 'valid once rated').to.be.true;
  expect(host.matches(':state(invalid)'), 'invalid once rated').to.be.false;
});

it('withholds user-valid/user-invalid until the user has rated or blurred the control', async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const el = (await fixture(html`<lr-rating name="score" required></lr-rating>`)) as LyraRating;
  const host = el as unknown as HTMLElement;
  expect(host.matches(':state(invalid)'), 'pristine required control is invalid').to.be.true;
  expect(host.matches(':state(user-invalid)'), 'but not user-invalid before any interaction').to.be.false;
  expect(host.matches(':state(user-valid)'), 'nor user-valid').to.be.false;

  // `focusout` is the blur signal that survives the shadow boundary.
  host.dispatchEvent(new Event('focusout', { bubbles: true, composed: true }));
  expect(host.matches(':state(user-invalid)'), 'user-invalid once blurred while unrated').to.be.true;
  expect(host.matches(':state(user-valid)'), 'user-valid while unrated').to.be.false;

  el.value = 3;
  expect(host.matches(':state(user-valid)'), 'user-valid once rated').to.be.true;
  expect(host.matches(':state(user-invalid)'), 'user-invalid once rated').to.be.false;
});

it('counts a click on the stars as interaction, without waiting for a blur', async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const el = (await fixture(html`<lr-rating name="score" required max="5"></lr-rating>`)) as LyraRating;
  const host = el as unknown as HTMLElement;
  expect(host.matches(':state(user-invalid)'), 'pristine').to.be.false;

  baseOf(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  expect(el.value, 'the key press rated the control').to.equal(1);
  expect(host.matches(':state(user-valid)'), 'user-valid after a keyboard rating').to.be.true;
});

it('counts a reportValidity() call -- what a submit attempt runs -- as interaction', async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const el = (await fixture(html`<lr-rating name="score" required></lr-rating>`)) as LyraRating;
  const host = el as unknown as HTMLElement;
  expect(host.matches(':state(user-invalid)'), 'pristine').to.be.false;
  el.reportValidity();
  expect(host.matches(':state(user-invalid)'), 'user-invalid after a reported validation').to.be.true;
});

it('goes pristine again after a form reset', async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const form = (await fixture(html`
    <form><lr-rating name="score" required></lr-rating></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-rating') as LyraRating;
  const host = el as unknown as HTMLElement;
  host.dispatchEvent(new Event('focusout', { bubbles: true, composed: true }));
  expect(host.matches(':state(user-invalid)'), 'user-invalid after the blur').to.be.true;

  form.reset();
  expect(host.matches(':state(user-invalid)'), 'a reset form is pristine again').to.be.false;
  expect(host.matches(':state(invalid)'), 'still intrinsically invalid, just not user-invalid').to.be.true;
});

// -- setCustomValidity() --------------------------------------------------

it('blocks form submission with a consumer-supplied custom error, and reports it as validationMessage', async () => {
  const form = (await fixture(html`
    <form><lr-rating name="score" value="3"></lr-rating></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-rating') as LyraRating;
  let submits = 0;
  // Registered before any requestSubmit() below, so a successful submission can never navigate
  // the test page.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });
  expect(el.checkValidity(), 'valid before the custom error').to.be.true;

  el.setCustomValidity('That score is disputed.');
  expect(el.validity.customError).to.be.true;
  expect(el.checkValidity()).to.be.false;
  expect(el.validationMessage).to.equal('That score is disputed.');
  expect(form.checkValidity()).to.be.false;
  form.requestSubmit();
  expect(submits, 'a custom error blocks submission').to.equal(0);

  el.resetValidity();
  expect(el.validity.customError).to.be.false;
  expect(el.validationMessage).to.equal('');
  form.requestSubmit();
  expect(submits, 'submission is unblocked once the custom error is cleared').to.equal(1);
});

it('keeps a custom error through an intrinsic revalidation', async () => {
  const el = (await fixture(html`<lr-rating name="score" required></lr-rating>`)) as LyraRating;
  el.setCustomValidity('Rejected by the server.');
  expect(el.validity.customError).to.be.true;

  // Rating the control re-runs updateValidity(), which is the traffic that used to wipe a custom
  // error out on every keystroke/click.
  el.value = 4;
  expect(el.validity.valueMissing, 'the intrinsic error cleared').to.be.false;
  expect(el.validity.customError, 'the custom error survived the recomputation').to.be.true;
  expect(el.validationMessage).to.equal('Rejected by the server.');
  expect(el.checkValidity()).to.be.false;
});

it('keeps a custom error across a form reset, matching native setCustomValidity semantics', async () => {
  // Native `form.reset()` restores a control's value and pristine-ness, but never clears a
  // consumer-set custom error -- only another `setCustomValidity('')` does. This control matches.
  const form = (await fixture(html`
    <form><lr-rating name="score" value="2"></lr-rating></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-rating') as LyraRating;
  el.value = 5;
  el.setCustomValidity('Already scored by this reviewer.');

  form.reset();
  await el.updateComplete;
  expect(el.value, 'the reset restored the declarative default').to.equal(2);
  expect(el.validity.customError, 'the custom error outlives the reset').to.be.true;
  expect(el.validationMessage).to.equal('Already scored by this reviewer.');
  expect(el.checkValidity()).to.be.false;
});

it('restores the computed validity when a custom error is cleared, rather than forcing the control valid', async () => {
  const el = (await fixture(html`<lr-rating name="score" required></lr-rating>`)) as LyraRating;
  expect(el.validity.valueMissing, 'required and unrated to begin with').to.be.true;

  el.setCustomValidity('Rejected by the server.');
  expect(el.validity.customError).to.be.true;

  el.setCustomValidity('');
  expect(el.validity.customError).to.be.false;
  expect(el.validity.valueMissing, 'an unrated required control is still missing a value').to.be.true;
  expect(el.checkValidity(), 'clearing the custom error must not force the control valid').to.be.false;
  expect(el.validationMessage.length, 'the intrinsic message is republished').to.be.greaterThan(0);
});

it('publishes a custom error through the validity custom states', async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const el = (await fixture(html`<lr-rating name="score" value="3"></lr-rating>`)) as LyraRating;
  const host = el as unknown as HTMLElement;
  expect(host.matches(':state(valid)'), 'valid before the custom error').to.be.true;

  el.setCustomValidity('Rejected by the server.');
  expect(host.matches(':state(invalid)'), 'invalid synchronously, not on the next Lit update').to.be.true;
  expect(host.matches(':state(valid)')).to.be.false;
  expect(host.matches(':state(user-invalid)'), 'still pristine until the user has a turn').to.be.false;

  el.reportValidity();
  expect(host.matches(':state(user-invalid)'), 'a reported validation counts as interaction').to.be.true;

  el.setCustomValidity('');
  expect(host.matches(':state(valid)')).to.be.true;
  expect(host.matches(':state(user-valid)')).to.be.true;
  expect(host.matches(':state(user-invalid)')).to.be.false;
});

it('inherits an ancestor fieldset disablement without mutating its own `disabled` property', async () => {
  const form = (await fixture(html`
    <form><fieldset><lr-rating name="score" value="2"></lr-rating></fieldset></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-rating') as LyraRating;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  await el.updateComplete;

  fieldset.disabled = true;
  await el.updateComplete;
  expect(el.disabled, 'fieldset state must not mutate the public property').to.be.false;
  expect(el.effectiveDisabled).to.be.true;
  expect(baseOf(el).getAttribute('aria-disabled')).to.equal('true');
  expect(baseOf(el).getAttribute('tabindex')).to.equal('-1');
  expect(getComputedStyle(baseOf(el)).cursor, ':host(:disabled) tracks the fieldset').to.equal('not-allowed');

  let delegatedCalls = 0;
  baseOf(el).click = () => { delegatedCalls += 1; };
  baseOf(el).focus = () => { delegatedCalls += 1; };
  el.click();
  el.focus();
  expect(delegatedCalls, 'fieldset disablement gates host click/focus delegation').to.equal(0);

  baseOf(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  expect(el.value, 'a fieldset-disabled rating is not settable').to.equal(2);

  fieldset.disabled = false;
  await el.updateComplete;
  expect(el.effectiveDisabled).to.be.false;
  expect(getComputedStyle(baseOf(el)).cursor).to.equal('pointer');
});

it('restores a numeric value through formStateRestoreCallback', async () => {
  const el = (await fixture(html`<lr-rating name="score" max="5"></lr-rating>`)) as LyraRating;
  el.formStateRestoreCallback('4', 'restore');
  expect(el.value).to.equal(4);
  el.formStateRestoreCallback(null, 'restore');
  expect(el.value).to.equal(0);
});

it('separates the live numeric value from the reflected current default', async () => {
  const form = (await fixture(html`
    <form><lr-rating name="score" value="2"></lr-rating></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-rating') as LyraRating;
  expect(el.value).to.equal(2);
  expect(el.defaultValue).to.equal(2);

  el.value = 4;
  expect(el.getAttribute('value')).to.equal('2');
  el.setAttribute('value', '3');
  expect(el.defaultValue).to.equal(3);
  expect(el.value, 'attribute mutation cannot overwrite dirty live state').to.equal(4);

  form.reset();
  expect(el.value).to.equal(3);
  el.defaultValue = 1;
  expect(el.getAttribute('value')).to.equal('1');
  expect(el.value, 'after reset the live value is pristine again').to.equal(1);
});

it('accepts default-value as a reset-default alias without overwriting a dirty live score', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-rating name="score" default-value="2"></lr-rating></form>
  `);
  const el = form.querySelector('lr-rating') as LyraRating;
  expect(el.defaultValue).to.equal(2);
  expect(el.value).to.equal(2);
  expect(new FormData(form).get('score')).to.equal('2');

  el.value = 4;
  el.setAttribute('default-value', '3');
  await el.updateComplete;
  expect(el.defaultValue).to.equal(3);
  expect(el.value, 'an alias mutation updates only the reset target after the value is dirty').to.equal(4);

  form.reset();
  expect(el.value).to.equal(3);
});

// -- label ----------------------------------------------------------------

it('names the slider from `label`, letting a host aria-label win over it', async () => {
  const labelled = (await fixture(html`<lr-rating label="Satisfaction"></lr-rating>`)) as LyraRating;
  expect(baseOf(labelled).getAttribute('aria-label')).to.equal('Satisfaction');

  const both = (await fixture(
    html`<lr-rating label="Satisfaction" aria-label="Overall score"></lr-rating>`,
  )) as LyraRating;
  expect(baseOf(both).getAttribute('aria-label')).to.equal('Overall score');

  const bare = (await fixture(html`<lr-rating></lr-rating>`)) as LyraRating;
  expect(baseOf(bare).getAttribute('aria-label'), 'localized default survives').to.equal('Rating');
});

it('preserves an explicitly empty host aria-label and restores live fallbacks when it is removed', async () => {
  const el = (await fixture(
    html`<lr-rating aria-label="" label="Satisfaction"></lr-rating>`,
  )) as LyraRating;
  const base = baseOf(el);

  expect(base.hasAttribute('aria-label')).to.be.true;
  expect(base.getAttribute('aria-label')).to.equal('');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Satisfaction');

  el.label = '';
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Rating');
});

// -- getSymbol ------------------------------------------------------------

it('renders a consumer glyph per index through getSymbol, for both the empty and filled layer', async () => {
  const el = (await fixture(html`<lr-rating max="3" value="2"></lr-rating>`)) as LyraRating;
  el.getSymbol = (value, selected) =>
    html`<i data-glyph=${`${value}:${selected ? 'on' : 'off'}`}>${selected ? '★' : '☆'}</i>`;
  await el.updateComplete;

  const glyphs = Array.from(el.shadowRoot!.querySelectorAll('i[data-glyph]')).map((node) =>
    node.getAttribute('data-glyph'),
  );
  expect(glyphs).to.deep.equal(['1:off', '1:on', '2:off', '2:on', '3:off', '3:on']);
  expect(el.shadowRoot!.querySelectorAll('svg').length, 'the built-in stars are replaced').to.equal(0);
});

it('leaves the default star rendering untouched while getSymbol is unset (unset regression)', async () => {
  const el = (await fixture(html`<lr-rating max="3" value="2"></lr-rating>`)) as LyraRating;
  expect(el.getSymbol).to.equal(undefined);
  expect(starsOf(el).length).to.equal(3);
  expect(el.shadowRoot!.querySelectorAll('svg polygon').length, 'outline + fill per star').to.equal(6);
});

it('renders dynamically supplied getSymbol output as inert presentation while retaining star pointer selection', async () => {
  let hostileActivations = 0;
  const el = (await fixture(html`<lr-rating max="1" value="0" label="Satisfaction"></lr-rating>`)) as LyraRating;
  el.getSymbol = (_value, selected) => html`
    <button type="button" data-hostile-symbol @click=${() => { hostileActivations += 1; }}>
      ${selected ? 'Selected symbol' : 'Empty symbol'}
    </button>
  `;
  await el.updateComplete;

  const hostileSymbols = Array.from(
    el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-hostile-symbol]'),
  );
  expect(hostileSymbols.length, 'one backdrop and one clipped fill renderer are present').to.equal(2);
  const hostileSymbol = hostileSymbols[0]!;
  const presentation = hostileSymbol.parentElement as HTMLElement;
  expect(presentation.inert, 'renderer output is not independently focusable').to.be.true;
  expect(presentation.getAttribute('aria-hidden')).to.equal('true');
  expect(getComputedStyle(presentation).pointerEvents).to.equal('none');

  const base = baseOf(el);
  base.focus();
  hostileSymbol.focus();
  expect(
    el.shadowRoot!.activeElement === base,
    'a focusable renderer cannot take focus from the rating slider',
  ).to.be.true;

  const bounds = hostileSymbol.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(bounds.left + bounds.width / 2), Math.round(bounds.top + bounds.height / 2)],
    });
    await sendMouse({ type: 'down' });
    await sendMouse({ type: 'up' });
    await el.updateComplete;
  } finally {
    await resetMouse();
  }

  expect(hostileActivations, 'the renderer button cannot activate').to.equal(0);
  expect(el.value, 'the containing star remains the pointer target').to.equal(1);
  await expect(el).to.be.accessible();
});

// -- size -----------------------------------------------------------------

it('scales the stars through `size` while the unset default reproduces the m treatment', async () => {
  // The full shared six-step ladder, including the `2xs` step the local union used to omit.
  const sizes = ['2xs', 'xs', 's', 'm', 'l', 'xl'] as const;
  const unset = (await fixture(html`<lr-rating></lr-rating>`)) as LyraRating;
  expect(unset.size).to.equal('m');
  const measured: number[] = [];
  for (const size of sizes) {
    const el = (await fixture(html`<lr-rating size=${size}></lr-rating>`)) as LyraRating;
    measured.push(parseFloat(getComputedStyle(starsOf(el)[0]!).fontSize));
  }
  const unsetSize = parseFloat(getComputedStyle(starsOf(unset)[0]!).fontSize);
  expect(unsetSize, 'unset === m').to.equal(measured[3]);
  for (let i = 1; i < measured.length; i += 1) {
    expect(measured[i], `${sizes[i]} > ${sizes[i - 1]}`).to.be.greaterThan(measured[i - 1]!);
  }
});

// -- hover ----------------------------------------------------------------

it('emits lr-hover start/move/end and previews the hovered value without committing it', async () => {
  const el = (await fixture(html`<lr-rating max="5" value="1"></lr-rating>`)) as LyraRating;
  const phases: string[] = [];
  const values: number[] = [];
  el.addEventListener('lr-hover', (event) => {
    phases.push((event as CustomEvent<{ phase: string; value: number }>).detail.phase);
    values.push((event as CustomEvent<{ phase: string; value: number }>).detail.value);
  });

  const stars = starsOf(el);
  pinStar(stars[3]!);
  pointer('pointerenter', baseOf(el), 120);
  pointer('pointermove', stars[3]!, 120);
  await el.updateComplete;

  expect(values[values.length - 1], 'half-way into star 4 rounds up to 4').to.equal(4);
  expect(el.value, 'hovering never commits').to.equal(1);
  const fills = Array.from(starsOf(el)).map(
    (star) => (star.querySelector('[part="star-fill"]') as HTMLElement).style.inlineSize,
  );
  expect(fills).to.deep.equal(['100%', '100%', '100%', '100%', '0%']);

  pointer('pointerleave', baseOf(el), 120);
  await el.updateComplete;
  expect(phases[0]).to.equal('start');
  expect(phases[phases.length - 1]).to.equal('end');
  expect(phases).to.include('move');
  const restored = Array.from(starsOf(el)).map(
    (star) => (star.querySelector('[part="star-fill"]') as HTMLElement).style.inlineSize,
  );
  expect(restored, 'the preview reverts to the committed value').to.deep.equal(['100%', '0%', '0%', '0%', '0%']);
});

it('ends an interrupted hover on pointercancel and on disconnect', async () => {
  const el = (await fixture(html`<lr-rating max="5" value="0"></lr-rating>`)) as LyraRating;
  const phases: string[] = [];
  el.addEventListener('lr-hover', (event) => {
    phases.push((event as CustomEvent<{ phase: string }>).detail.phase);
  });
  const stars = starsOf(el);
  pinStar(stars[2]!);
  pointer('pointerenter', baseOf(el), 120);
  pointer('pointermove', stars[2]!, 120);
  await el.updateComplete;
  pointer('pointercancel', stars[2]!, 120);
  await el.updateComplete;
  expect(phases[phases.length - 1], 'pointercancel ends the hover').to.equal('end');
  expect(
    (starsOf(el)[0]!.querySelector('[part="star-fill"]') as HTMLElement).style.inlineSize,
  ).to.equal('0%');

  pointer('pointerenter', baseOf(el), 120);
  pointer('pointermove', stars[2]!, 120);
  await el.updateComplete;
  const parent = el.parentElement!;
  parent.removeChild(el);
  parent.appendChild(el);
  await el.updateComplete;
  expect(
    (starsOf(el)[0]!.querySelector('[part="star-fill"]') as HTMLElement).style.inlineSize,
    'reconnect must not resume a stale hover preview',
  ).to.equal('0%');
});

it('stays silent and unpreviewed while readonly or disabled', async () => {
  for (const markup of [
    html`<lr-rating max="5" value="1" readonly></lr-rating>`,
    html`<lr-rating max="5" value="1" disabled></lr-rating>`,
  ]) {
    const el = (await fixture(markup)) as LyraRating;
    let hovers = 0;
    el.addEventListener('lr-hover', () => { hovers += 1; });
    const stars = starsOf(el);
    pinStar(stars[3]!);
    pointer('pointerenter', baseOf(el), 120);
    pointer('pointermove', stars[3]!, 120);
    await el.updateComplete;
    expect(hovers, 'a non-settable rating emits no hover').to.equal(0);
    expect(
      (starsOf(el)[1]!.querySelector('[part="star-fill"]') as HTMLElement).style.inlineSize,
    ).to.equal('0%');
  }
});

it('mirrors the hovered segment under RTL', async () => {
  const el = (
    await fixture(html`<div dir="rtl"><lr-rating max="5" value="0"></lr-rating></div>`)
  ).querySelector('lr-rating') as LyraRating;
  const values: number[] = [];
  el.addEventListener('lr-hover', (event) => {
    values.push((event as CustomEvent<{ value: number }>).detail.value);
  });
  const stars = starsOf(el);
  pinStar(stars[3]!);
  pointer('pointerenter', baseOf(el), 110);
  pointer('pointermove', stars[3]!, 110);
  await el.updateComplete;
  // 25% from the physical left edge is 75% along star 4 in logical order under RTL.
  expect(values[values.length - 1]).to.equal(4);
});

it('clamps a hover preview left behind when max shrinks below it', async () => {
  const el = (await fixture(html`<lr-rating max="5" value="0"></lr-rating>`)) as LyraRating;
  const stars = starsOf(el);
  pinStar(stars[4]!);
  pointer('pointerenter', baseOf(el), 120);
  pointer('pointermove', stars[4]!, 120);
  await el.updateComplete;
  el.max = 2;
  await el.updateComplete;
  expect(starsOf(el).length).to.equal(2);
  const fills = Array.from(starsOf(el)).map(
    (star) => (star.querySelector('[part="star-fill"]') as HTMLElement).style.inlineSize,
  );
  expect(fills).to.deep.equal(['100%', '100%']);
});

// -- i18n -----------------------------------------------------------------

it('routes the built-in accessible name through the .strings override', async () => {
  const el = (await fixture(html`<lr-rating></lr-rating>`)) as LyraRating;
  expect(baseOf(el).getAttribute('aria-label'), 'English fallback with no locale registered').to.equal('Rating');
  el.strings = { rating: 'Évaluation' };
  await el.updateComplete;
  expect(baseOf(el).getAttribute('aria-label')).to.equal('Évaluation');
});

// -- accessibility --------------------------------------------------------

it('is accessible while required, labelled, rated, and rendering a custom symbol', async () => {
  const el = (await fixture(
    html`<lr-rating name="score" label="Satisfaction" required value="3" max="5"></lr-rating>`,
  )) as LyraRating;
  expect(starsOf(el).length).to.equal(5);
  await expect(el).to.be.accessible();

  // A shape, not text: a consumer's own text glyph carries its own contrast obligations, which
  // are not this component's contract to assert.
  el.getSymbol = (value, selected) => html`<i data-value=${value} data-mode=${selected ? 'on' : 'off'}></i>`;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('i').length).to.equal(10);
  await expect(el).to.be.accessible();
});

it('exposes its native label association', async () => {
  const form = (await fixture(html`
    <form>
      <label id="score-label" for="score">Score</label>
      <lr-rating id="score" name="score" label="Score"></lr-rating>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-rating') as LyraRating;
  expect((el.form) === (form)).to.equal(true);
  expect((el.getForm()) === (form)).to.equal(true);
  expect([...el.labels].map((node) => (node as Element).id)).to.deep.equal(['score-label']);
  expect(el.validity.valid).to.equal(true);
  expect(el.validationMessage).to.equal('');
});
