import { fixture, expect, oneEvent, html, waitUntil, aTimeout } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './select.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';
import type { LyraOption } from '../combobox/option.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './select.styles.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const basic = () => html`
  <lr-select>
    <lr-option value="a">Apple</lr-option>
    <lr-option value="b">Banana</lr-option>
    <lr-option value="c">Cherry</lr-option>
  </lr-select>
`;

it('emits one cancelable lr-invalid alias when a validity check fails', async () => {
  const el = (await fixture(html`
    <lr-select required label="Fruit"><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  const aliases: CustomEvent[] = [];
  el.addEventListener('lr-invalid', (event) => aliases.push(event as CustomEvent));
  // Registered after the component's own constructor-time relay, so it observes the native event
  // once the alias has had its turn at it.
  const natives: Event[] = [];
  el.addEventListener('invalid', (event) => natives.push(event));

  expect(el.checkValidity()).to.be.false;
  expect(aliases).to.have.lengthOf(1);
  expect(aliases[0].target).to.equal(el);
  expect(aliases[0].bubbles && aliases[0].composed).to.be.true;
  expect(aliases[0].cancelable).to.be.true;
  // Nothing cancelled it, so the browser's own validation UI stays enabled.
  expect(natives).to.have.lengthOf(1);
  expect(natives[0].defaultPrevented).to.be.false;
});

it('cancels the native invalid event when the lr-invalid alias is cancelled', async () => {
  const el = (await fixture(html`
    <lr-select required label="Fruit"><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  el.addEventListener('lr-invalid', (event) => event.preventDefault());
  const natives: Event[] = [];
  el.addEventListener('invalid', (event) => natives.push(event));

  expect(el.checkValidity()).to.be.false;
  expect(natives).to.have.lengthOf(1);
  expect(natives[0].defaultPrevented).to.be.true;
});

it('emits a cancelable lr-show/lr-hide pair and non-cancelable after-events', async () => {
  const el = (await fixture(html`
    <lr-select style="--lr-transition-fast: 1ms linear">
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  const events: CustomEvent[] = [];
  for (const type of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
    el.addEventListener(type, (event) => events.push(event as CustomEvent));
  }

  el.open = true;
  await el.updateComplete;
  await aTimeout(80);
  el.open = false;
  await el.updateComplete;
  await aTimeout(80);

  expect(events.map((event) => event.type)).to.deep.equal([
    'lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide',
  ]);
  expect(events.every((event) => event.target === el)).to.be.true;
  // `lr-show`/`lr-hide` are veto points library-wide; the settled after-events are pure
  // notifications and stay non-cancelable.
  expect(events.filter((event) => event.type.startsWith('lr-after')).every((event) => !event.cancelable)).to.be.true;
  expect(events.filter((event) => !event.type.startsWith('lr-after')).every((event) => event.cancelable)).to.be.true;
});

it('honours preventDefault() on lr-show, leaving the property and attribute closed', async () => {
  const el = (await fixture(html`
    <lr-select><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  el.addEventListener('lr-show', (event) => event.preventDefault());
  let afterShows = 0;
  el.addEventListener('lr-after-show', () => { afterShows += 1; });

  await el.show();
  await el.updateComplete;
  await aTimeout(60);

  expect(el.open, 'a vetoed open never applies').to.be.false;
  expect(el.hasAttribute('open'), 'the reflected attribute agrees with the property').to.be.false;
  expect(afterShows, 'a transition that never happened has no after-event').to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="trigger"]')!.getAttribute('aria-expanded')).to.equal('false');
});

it('honours preventDefault() on lr-hide, including a direct `open` assignment', async () => {
  const el = (await fixture(html`
    <lr-select><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  await aTimeout(60);
  expect(el.open).to.be.true;

  el.addEventListener('lr-hide', (event) => event.preventDefault());
  el.open = false;
  await el.updateComplete;
  await aTimeout(60);

  expect(el.open, 'a vetoed close stays open').to.be.true;
  expect(el.hasAttribute('open')).to.be.true;
});

it('resolves show()/hide() promises even when the transition is vetoed', async () => {
  const el = (await fixture(html`
    <lr-select><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  el.addEventListener('lr-show', (event) => event.preventDefault());
  // A veto must not strand the caller: the promise settles, it just settles on "nothing changed".
  await el.show();
  expect(el.open).to.be.false;
});

it('drops a stale lr-after-show when closing interrupts the opening transition', async () => {
  const el = (await fixture(html`
    <lr-select style="--lr-transition-fast: 40ms linear">
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  const events: string[] = [];
  for (const type of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
    el.addEventListener(type, () => events.push(type));
  }

  el.open = true;
  await el.updateComplete;
  el.open = false;
  await el.updateComplete;
  await aTimeout(100);

  expect(events).to.deep.equal(['lr-show', 'lr-hide', 'lr-after-hide']);
});

it('drops a settleTransition() call that is already stale before its first await settles', async () => {
  const el = (await fixture(html`
    <lr-select><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  let afterShows = 0;
  el.addEventListener('lr-after-show', () => { afterShows += 1; });

  const settleTransition = (
    el as unknown as { settleTransition(event: 'lr-after-show' | 'lr-after-hide'): Promise<void> }
  ).settleTransition.bind(el);
  const pending = settleTransition('lr-after-show');
  // Bump the token synchronously, before settleTransition's own internal
  // `await this.updateComplete` has a chance to resolve -- guaranteeing it finds itself stale the
  // instant that first await settles, rather than racing a real transition to land the same
  // outcome.
  (el as unknown as { transitionToken: number }).transitionToken++;
  await pending;

  expect(afterShows, 'a call invalidated before its first await never reaches the emit').to.equal(0);
});

it('tolerates a listbox that reports no animations at all (defensive fallback)', async () => {
  const el = (await fixture(html`
    <lr-select><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  const events: string[] = [];
  el.addEventListener('lr-after-show', () => events.push('after-show'));
  const listbox = el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement;
  const original = listbox.getAnimations;
  listbox.getAnimations = (() => undefined) as unknown as typeof listbox.getAnimations;
  try {
    await el.show();
  } finally {
    listbox.getAnimations = original;
  }
  expect(events, 'a getAnimations() call that returns nothing falls back to no animations to await').to.deep.equal([
    'after-show',
  ]);
});

function trigger(el: LyraSelect): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}

function rows(el: LyraSelect): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[part="option"]');
}

it('renders lr-option children as listbox rows with the placeholder shown as the trigger label', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.placeholder = 'Pick a fruit…';
  await el.updateComplete;

  expect(rows(el).length).to.equal(3);
  expect(trigger(el).textContent).to.contain('Pick a fruit…');
  expect(el.value).to.equal('');
});

it('rejects unsafe option dot colors while preserving valid CSS colors', async () => {
  const el = await fixture<LyraSelect>(html`
    <lr-select>
      <lr-option value="a" dot-color="red;position:fixed">A</lr-option>
    </lr-select>
  `);
  const dot = el.shadowRoot!.querySelector('[part="option-dot"]') as HTMLElement;
  expect(dot.style.position).to.equal('');
  expect(dot.style.backgroundColor).to.equal('transparent');

  const safe = await fixture<LyraSelect>(html`
    <lr-select>
      <lr-option value="a" dot-color="color-mix(in srgb, red 50%, blue)">A</lr-option>
    </lr-select>
  `);
  expect((safe.shadowRoot!.querySelector('[part="option-dot"]') as HTMLElement).style.backgroundColor).to.not.equal('');
});

it('opens the listbox by clicking the trigger, and closes it by clicking again', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  expect(el.open).to.be.false;

  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('opens the listbox with ArrowDown when closed', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it('opens the listbox with ArrowUp when closed', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it('selects an option by clicking it and emits change + input', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  setTimeout(() => rows(el)[1].click());
  await oneEvent(el, 'change');
  expect(el.value).to.equal('b');
  expect(el.open).to.be.false;
});

it('emits input alongside change on selection, matching a native <select>', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  let inputFired = false;
  el.addEventListener('input', () => (inputFired = true));
  setTimeout(() => rows(el)[0].click());
  await oneEvent(el, 'change');
  expect(inputFired).to.be.true;
});

it('emits exactly one native event pair and typed aliases with the new value', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const seen: Array<{ type: string; detail: unknown; event: Event }> = [];
  for (const type of ['input', 'lr-input', 'change', 'lr-change']) {
    el.addEventListener(type, (event) => seen.push({
      type,
      detail: (event as CustomEvent).detail,
      event,
    }));
  }
  rows(el)[1].click();
  await el.updateComplete;

  expect(seen.map((s) => s.type)).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
  expect(seen[0].detail).to.equal(0);
  expect(seen[1].detail).to.deep.equal({ value: 'b' });
  expect(seen[2].detail).to.be.undefined;
  expect(seen[3].detail).to.deep.equal({ value: 'b' });
  expect(seen[0].event instanceof InputEvent).to.be.true;
  expect(seen[2].event.constructor === Event).to.be.true;
  expect([seen[0].event, seen[2].event].every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
  expect(seen[1].event instanceof CustomEvent).to.be.true;
  expect(seen[3].event instanceof CustomEvent).to.be.true;
});

it('stays silent on native and prefixed value events for a programmatic value assignment', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  await el.updateComplete;
  let count = 0;
  for (const type of ['input', 'lr-input', 'change', 'lr-change']) {
    el.addEventListener(type, () => count++);
  }
  el.value = 'b';
  await el.updateComplete;
  expect(el.value).to.equal('b');
  expect(count).to.equal(0);
});

it('does not refire change/input when reopening and re-clicking the already-selected row', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.value = 'b';
  await el.updateComplete;

  el.open = true;
  await el.updateComplete;

  let changeFired = false;
  let inputFired = false;
  el.addEventListener('change', () => (changeFired = true));
  el.addEventListener('input', () => (inputFired = true));
  rows(el)[1].click();
  await el.updateComplete;

  expect(el.value).to.equal('b');
  expect(el.open).to.be.false;
  expect(changeFired).to.be.false;
  expect(inputFired).to.be.false;
});

it('routes duplicate-valued rows by occurrence and exposes only the activated occurrence as selected', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="same">First occurrence</lr-option>
      <lr-option value="same">Second occurrence</lr-option>
      <lr-option value="other">Other</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  rows(el)[1]!.click();
  await el.updateComplete;

  expect(el.value).to.equal('same');
  expect(trigger(el).textContent).to.contain('Second occurrence');
  expect([...rows(el)].map((row) => row.getAttribute('aria-selected'))).to.deep.equal([
    'false',
    'true',
    'false',
  ]);
  expect(
    [...el.querySelectorAll('lr-option')].map((option) => option.selected),
  ).to.deep.equal([false, true, false]);
  expect(
    [...el.querySelectorAll('lr-option')].map((option) => option.hasAttribute('selected')),
    'live selection never changes declarative defaults',
  ).to.deep.equal([false, false, false]);
});

it('navigates with ArrowDown and selects the active option with Enter', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  // First ArrowDown (already open) moves to index 0, second to index 1.
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;

  setTimeout(() => btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('b');
});

it('rehomes an active final row to the nearest survivor when options shrink while open', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;
  for (let index = 0; index < 3; index += 1) {
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await el.updateComplete;
  }
  expect(el.shadowRoot!.querySelector('[part="option"][data-active]')?.textContent?.trim()).to.equal('Cherry');

  const slot = el.shadowRoot!.querySelector('slot:not([name])')!;
  const changed = oneEvent(slot, 'slotchange');
  el.querySelector<LyraOption>('lr-option[value="c"]')!.remove();
  await changed;
  await el.updateComplete;

  const active = el.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-active]');
  expect(active?.textContent?.trim()).to.equal('Banana');
  expect(btn.getAttribute('aria-activedescendant')).to.equal(active?.id);
  setTimeout(() => btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('b');
});

it('preserves active option identity when light-DOM options reorder while open', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;
  for (let index = 0; index < 2; index += 1) {
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await el.updateComplete;
  }
  const banana = el.querySelector<LyraOption>('lr-option[value="b"]')!;
  const slot = el.shadowRoot!.querySelector('slot:not([name])')!;
  const changed = oneEvent(slot, 'slotchange');
  el.append(banana);
  await changed;
  await el.updateComplete;

  const active = el.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-active]');
  expect(active?.textContent?.trim()).to.equal('Banana');
  expect(btn.getAttribute('aria-activedescendant')).to.equal(active?.id);
  setTimeout(() => btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('b');
});

it('rehomes an active option when it becomes disabled while open', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;
  for (let index = 0; index < 3; index += 1) {
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await el.updateComplete;
  }
  const cherry = el.querySelector<LyraOption>('lr-option[value="c"]')!;
  cherry.disabled = true;
  await cherry.updateComplete;
  await aTimeout(0);
  await el.updateComplete;

  const active = el.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-active]');
  expect(active?.textContent?.trim()).to.equal('Banana');
  expect(btn.getAttribute('aria-activedescendant')).to.equal(active?.id);
  setTimeout(() => btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('b');
});

it('selects the active option with Space, same as Enter', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;

  setTimeout(() => btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('a');
});

it('closes the listbox on Escape without changing the selection', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.value = 'a';
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(el.value).to.equal('a');
});

it('jumps to (and selects) the option whose label starts with a typed character while closed', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  expect(el.open).to.be.false;

  setTimeout(() =>
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true })),
  );
  await oneEvent(el, 'change');
  expect(el.value).to.equal('c');
  expect(el.open).to.be.false;
});

it('type-ahead only moves the active row (no commit) while the listbox is open', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.value).to.equal('');
  const active = el.shadowRoot!.querySelector('[part="option"][data-active]');
  expect(active?.textContent).to.contain('Banana');
});

it('resets the type-ahead buffer after ~500ms of inactivity', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);

  setTimeout(() =>
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true })),
  );
  await oneEvent(el, 'change');
  expect(el.value).to.equal('b');

  await aTimeout(600);

  // Buffer reset -> 'c' alone (not 'bc') should now match Cherry.
  setTimeout(() =>
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true })),
  );
  await oneEvent(el, 'change');
  expect(el.value).to.equal('c');
});

it('leaves the type-ahead buffer alone when its reset timer fires after being superseded', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect((el as unknown as { typeAheadBuffer: string }).typeAheadBuffer).to.equal('a');
  // Bump the generation counter directly, without going through `clearTypeAheadTimer()` (which
  // would also cancel the real, already-scheduled timeout) -- so that timeout still fires in
  // ~500ms, but now finds itself superseded and takes its own early-return guard instead of
  // clearing the buffer.
  (el as unknown as { typeAheadTimerGeneration: number }).typeAheadTimerGeneration++;
  await aTimeout(600);
  expect(
    (el as unknown as { typeAheadBuffer: string }).typeAheadBuffer,
    'a superseded timer must not clear a buffer it no longer owns',
  ).to.equal('a');
});

it('participates in a form: value reflects in FormData on submit', async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  el.value = 'b';
  await el.updateComplete;
  expect(new FormData(form).get('fruit')).to.equal('b');
});

it('submits an untouched empty value instead of omitting the named control', async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;

  const data = new FormData(form);
  expect(data.has('fruit')).to.be.true;
  expect(data.get('fruit')).to.equal('');
});

it('blocks a required, empty select from submitting the form', async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit" required>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;
});

it('allows a required select to submit once a value is selected', async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit" required>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  el.value = 'a';
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

it('focuses the inner trigger after direct and submit-driven validity reporting', async () => {
  const form = (await fixture(html`
    <form>
      <button type="button">Before select</button>
      <lr-select name="fruit" required>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector('button') as HTMLButtonElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  let submitCount = 0;
  form.addEventListener('submit', (event) => {
    submitCount += 1;
    event.preventDefault();
  });

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lr-select');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');

  sentinel.focus();
  form.requestSubmit();
  expect(submitCount).to.equal(0);
  expect(document.activeElement?.localName).to.equal('lr-select');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');
});

it('updates dynamic required validity synchronously without awaiting a Lit update', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;

  el.required = true;
  expect(el.hasAttribute('required')).to.be.true;
  expect(el.checkValidity()).to.be.false;

  el.required = false;
  expect(el.hasAttribute('required')).to.be.false;
  expect(el.checkValidity()).to.be.true;
});

it('updates disabled form participation synchronously without awaiting a Lit update', async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  el.value = 'a';
  expect(new FormData(form).get('fruit')).to.equal('a');

  el.disabled = true;
  expect(el.hasAttribute('disabled')).to.be.true;
  expect(new FormData(form).has('fruit')).to.be.false;

  el.disabled = false;
  expect(el.hasAttribute('disabled')).to.be.false;
  expect(new FormData(form).get('fruit')).to.equal('a');
});

it('seeds the initial selection from a declaratively-selected <lr-option>', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(el.value).to.equal('b');
});

it('restores the declared default selection on form.reset()', async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b" selected>Banana</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  await el.updateComplete;
  el.value = 'a';
  form.reset();
  expect(el.value).to.equal('b');
});

it('updates the reset baseline from defaultSelected without changing a dirty live selection', async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b" selected>Banana</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  const [apple, banana] = [...el.querySelectorAll('lr-option')] as LyraOption[];
  await el.updateComplete;

  el.value = 'b';
  apple.defaultSelected = true;
  banana.defaultSelected = false;
  await Promise.all([apple.updateComplete, banana.updateComplete, el.updateComplete]);
  expect(el.value, 'changing the reset default is event-silent and does not overwrite live state').to.equal('b');

  form.reset();
  expect(el.value).to.equal('a');
  expect(apple.selected).to.equal(true);
  expect(banana.selected).to.equal(false);
});

it('applies post-mount defaultSelected changes to a pristine live selection', async () => {
  const el = (await fixture(html`
    <lr-select><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  const option = el.querySelector('lr-option') as LyraOption;
  await el.updateComplete;
  expect(el.value).to.equal('');

  option.defaultSelected = true;
  await option.updateComplete;
  await el.updateComplete;
  expect(el.value).to.equal('a');
  expect(option.selected).to.equal(true);

  option.defaultSelected = false;
  await option.updateComplete;
  await el.updateComplete;
  expect(el.value).to.equal('');
  expect(option.selected).to.equal(false);
});

it('preserves an initial property-only selected write until reset reapplies a later default', async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit" multiple>
        <lr-option value="a" .selected=${true}>Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  const [, banana] = [...el.querySelectorAll('lr-option')] as LyraOption[];
  await el.updateComplete;
  expect(el.value).to.deep.equal(['a']);

  banana!.defaultSelected = true;
  await banana!.updateComplete;
  await el.updateComplete;
  expect(el.value, 'the later reset default must not overwrite dirty live selectedness').to.deep.equal(['a']);

  form.reset();
  expect(el.value).to.deep.equal(['b']);
});

it('retains a defaultSelected refresh when the parent detaches during option notification', async () => {
  const form = (await fixture(html`
    <form><lr-select name="fruit"><lr-option value="a">Apple</lr-option></lr-select></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  const option = el.querySelector('lr-option') as LyraOption;
  await el.updateComplete;

  option.addEventListener('lr-option-change', () => el.remove(), { once: true });
  option.defaultSelected = true;
  await option.updateComplete;
  await Promise.resolve();
  form.append(el);
  await el.updateComplete;

  expect(el.value).to.equal('a');
  el.value = '';
  form.reset();
  expect(el.value).to.equal('a');
});

it('adopts a property-only dirty .selected write in single mode too, not just multiple', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a" .selected=${true}>Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(el.value).to.equal('a');
});

it('leaves nothing selected when the only dirty option was written back to unselected before mount', async () => {
  const option = document.createElement('lr-option') as LyraOption;
  option.value = 'a';
  option.textContent = 'Apple';
  option.selected = true;
  option.selected = false;
  const el = document.createElement('lr-select') as LyraSelect;
  el.append(option);
  document.body.append(el);
  await el.updateComplete;
  try {
    expect(el.value, 'the dirty write is honoured even though it now says unselected').to.equal('');
  } finally {
    el.remove();
  }
});

it('commits a default-value with no matching option, mirroring a lazily-populated list', async () => {
  const el = (await fixture(html`
    <lr-select default-value="ghost">
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(el.value, 'the not-yet-existent default is still committed verbatim').to.equal('ghost');
});

it('does not let a late-arriving selected option override a value restored from form state', async () => {
  const el = (await fixture(html`<lr-select><lr-option value="a">Apple</lr-option></lr-select>`)) as LyraSelect;
  await el.updateComplete;
  el.formStateRestoreCallback('a', 'restore');
  await el.updateComplete;
  expect(el.value).to.equal('a');

  const banana = document.createElement('lr-option') as LyraOption;
  banana.value = 'b';
  banana.textContent = 'Banana';
  banana.selected = true;
  el.append(banana);
  await el.updateComplete;
  expect(el.value, 'a restored value outranks a newly-slotted selected option').to.equal('a');
});

it('merges a late-arriving live-selected option into an existing multi-select selection', async () => {
  const el = (await fixture(html`
    <lr-select multiple>
      <lr-option value="a" selected>Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(el.value).to.deep.equal(['a']);

  const banana = document.createElement('lr-option') as LyraOption;
  banana.value = 'b';
  banana.textContent = 'Banana';
  banana.selected = true;
  el.append(banana);
  await el.updateComplete;
  expect(el.value).to.deep.equal(['a', 'b']);
});

it('adopts a late-arriving declaratively-defaulted option into a pristine single selection', async () => {
  const el = (await fixture(html`<lr-select><lr-option value="a">Apple</lr-option></lr-select>`)) as LyraSelect;
  await el.updateComplete;
  expect(el.value).to.equal('');

  const banana = document.createElement('lr-option') as LyraOption;
  banana.value = 'b';
  banana.textContent = 'Banana';
  banana.defaultSelected = true;
  el.append(banana);
  await el.updateComplete;
  expect(el.value).to.equal('b');
});

describe('adoptedCallback', () => {
  it('tears down positioning cleanup and pending listeners when adopted into another document', async () => {
    const el = (await fixture(
      html`<lr-select open><lr-option value="a">Apple</lr-option></lr-select>`,
    )) as LyraSelect;
    await el.updateComplete;
    // Opening while connected sets a live positioning `cleanup` callback (see `updated()`).
    expect(
      (el as unknown as { cleanup?: () => void }).cleanup,
      'a live popup has a cleanup callback',
    ).to.not.equal(undefined);
    (el as unknown as { adoptedCallback(): void }).adoptedCallback();
    expect(
      (el as unknown as { cleanup?: () => void }).cleanup,
      'adoption tears the cleanup down',
    ).to.equal(undefined);
  });

  it('no-ops when adopted with no positioning cleanup pending', () => {
    const el = document.createElement('lr-select') as LyraSelect;
    expect(() => (el as unknown as { adoptedCallback(): void }).adoptedCallback()).to.not.throw();
  });
});

it('resets to empty via form.reset() when no option was declared selected', async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  await el.updateComplete;
  el.value = 'a';
  el.value = 'b';
  form.reset();
  expect(el.value).to.equal('');
});

it('does not open or select when disabled', async () => {
  const el = (await fixture(html`
    <lr-select disabled>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;

  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(trigger(el).disabled).to.be.true;
});

it('disables the select when its containing fieldset is disabled', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-select name="fruit">
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  await el.updateComplete;
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.false;

  fieldset.disabled = true;
  await el.updateComplete;
  // `el.disabled` (the consumer-facing IDL property/attribute) is never
  // mutated by fieldset cascading -- only the combined `effectiveDisabled`
  // reflects it (mirrors lr-combobox's identical `_fieldsetDisabled`/
  // `effectiveDisabled` pattern).
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.true;
  expect(el.disabled).to.be.false;
  const triggerEl = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(getComputedStyle(triggerEl).opacity).to.equal('0.5');
  expect(getComputedStyle(triggerEl).cursor).to.equal('not-allowed');
  let delegatedCalls = 0;
  triggerEl.click = () => { delegatedCalls += 1; };
  triggerEl.focus = () => { delegatedCalls += 1; };
  el.click();
  el.focus();
  expect(delegatedCalls, 'fieldset disablement gates host click/focus delegation').to.equal(0);
});

it('restores its own explicit `disabled` after an ancestor fieldset re-enables', async () => {
  const el = (await fixture(html`<lr-select disabled></lr-select>`)) as LyraSelect;
  (el as unknown as { formDisabledCallback(d: boolean): void }).formDisabledCallback(true);
  (el as unknown as { formDisabledCallback(d: boolean): void }).formDisabledCallback(false);
  await el.updateComplete;
  expect(el.disabled).to.be.true;
});

it('re-binds positioning after a disconnect+reconnect while open, ending up closed rather than half-open with no listeners', async () => {
  const el = (await fixture(html`<lr-select open><lr-option value="x"></lr-option></lr-select>`)) as LyraSelect;
  await el.updateComplete;
  const parent = el.parentElement!;
  let teardownHide: CustomEvent | undefined;
  el.addEventListener('lr-hide', (event) => (teardownHide = event as CustomEvent));
  el.remove();
  await el.updateComplete;
  expect(teardownHide !== undefined).to.be.true;
  expect(teardownHide!.cancelable, 'a disconnected control cannot honour a hide veto').to.be.false;
  parent.appendChild(el);
  await el.updateComplete;
  // `disconnectedCallback()` resets `open` to `false` — asserting that directly
  // (not an incidental side effect like a leftover inline `position` style,
  // which is set once at first open and never cleared either way) is what
  // actually distinguishes the fix from the pre-fix bug.
  expect(el.open).to.be.false;
});

describe('reconnectOpenPopup (connectedCallback re-arming)', () => {
  // `disconnectedCallback()` always resets `open` back to `false` (see the test above), so
  // `connectedCallback()`'s `hasUpdated && open` gate for `reconnectOpenPopup()` can only ever be
  // satisfied by flipping `open` back on again *while still detached*, before reconnecting --
  // mirroring a drag-drop reparent that wants the popup to reappear already open.

  it('re-arms positioning when open is restored before reconnecting', async () => {
    const el = (await fixture(
      html`<lr-select open hoist><lr-option value="x">X</lr-option></lr-select>`,
    )) as LyraSelect;
    await el.updateComplete;
    const parent = el.parentElement!;
    el.remove();
    await el.updateComplete;
    expect(el.open, 'disconnecting closed it').to.be.false;

    el.open = true;
    await el.updateComplete;
    parent.appendChild(el);
    await el.updateComplete;
    await aTimeout(20);

    expect(el.open).to.be.true;
    expect(
      (el as unknown as { cleanup?: () => void }).cleanup,
      'reconnectOpenPopup() re-armed the positioning cleanup',
    ).to.not.equal(undefined);
    el.remove();
  });

  it('tears down and replaces an already-live cleanup when called again while still open', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    await el.show();
    const before = (el as unknown as { cleanup?: () => void }).cleanup;
    expect(before, 'show() already set a live cleanup').to.not.equal(undefined);
    (el as unknown as { reconnectOpenPopup(): void }).reconnectOpenPopup();
    const after = (el as unknown as { cleanup?: () => void }).cleanup;
    expect(after, 'reconnectOpenPopup() replaced the live cleanup with a fresh one').to.not.equal(undefined);
  });

  it('no-ops if the element is disconnected again before its queued microtask runs', async () => {
    const el = (await fixture(html`<lr-select open><lr-option value="x">X</lr-option></lr-select>`)) as LyraSelect;
    await el.updateComplete;
    const parent = el.parentElement!;
    el.remove();
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;

    parent.appendChild(el);
    el.remove(); // synchronously, before the microtask connectedCallback() just queued can run
    await el.updateComplete;
    await aTimeout(20);

    expect(el.isConnected).to.be.false;
  });

  it('no-ops if open is toggled off again before its queued microtask runs', async () => {
    const el = (await fixture(html`<lr-select open><lr-option value="x">X</lr-option></lr-select>`)) as LyraSelect;
    await el.updateComplete;
    const parent = el.parentElement!;
    el.remove();
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;

    parent.appendChild(el);
    el.open = false; // synchronously, before the microtask connectedCallback() just queued can run
    await el.updateComplete;
    await aTimeout(20);

    expect(el.open).to.be.false;
    el.remove();
  });
});

it('does not override an explicit `label` slot with the fallback aria-label', async () => {
  const el = (await fixture(html`<lr-select><span slot="label">Region</span></lr-select>`)) as LyraSelect;
  await el.updateComplete;
  const triggerEl = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  expect(triggerEl.getAttribute('aria-label')).to.not.equal('Select');
});

it('re-renders when an already-slotted option mutates its own label', async () => {
  const el = (await fixture(html`<lr-select><lr-option value="x">Old label</lr-option></lr-select>`)) as LyraSelect;
  // Open BEFORE mutating, with no further `open` toggle afterward — this is
  // what makes the test discriminating: opening AFTER the mutation would
  // force an ordinary re-render that reads the option's live (already-new)
  // textContent regardless of whether the lr-option-change/MutationObserver
  // mechanism fired at all.
  el.open = true;
  await el.updateComplete;
  const option = el.querySelector('lr-option')!;
  option.textContent = 'New label';
  await new Promise((r) => setTimeout(r, 0)); // let the MutationObserver's microtask + onOptionChange's re-render land
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="option"]')!;
  expect(row.textContent).to.include('New label');
});

it('reflects a property-assigned `name` synchronously, with no await, so same-tick FormData submission sees it', async () => {
  const el = (await fixture(html`<lr-select></lr-select>`)) as LyraSelect;
  el.name = 'region';
  expect(el.getAttribute('name')).to.equal('region');
});

it('closes the listbox on a pointerdown outside the element', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

describe('bindDocumentPointer (internal, defensive guards)', () => {
  it('no-ops when called while disconnected', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    await el.updateComplete;
    el.remove();
    expect(() =>
      (el as unknown as { bindDocumentPointer(): void }).bindDocumentPointer(),
    ).to.not.throw();
  });

  it('is idempotent for an already-bound owner document', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    await el.show();
    const before = (el as unknown as { pointerListener?: unknown }).pointerListener;
    expect(before, 'show() already bound a listener').to.not.equal(undefined);
    (el as unknown as { bindDocumentPointer(): void }).bindDocumentPointer();
    const after = (el as unknown as { pointerListener?: unknown }).pointerListener;
    expect(after, 'rebinding for the same document is a no-op, not a fresh listener').to.equal(before);
  });
});

it('fires lr-show/lr-hide when `open` is set directly, bypassing click/keyboard', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  await el.updateComplete;

  setTimeout(() => {
    el.open = true;
  });
  await oneEvent(el, 'lr-show');
  await el.updateComplete;
  expect(el.open).to.be.true;

  setTimeout(() => {
    el.open = false;
  });
  await oneEvent(el, 'lr-hide');
  expect(el.open).to.be.false;
});

it('closes the listbox when the trigger blurs (e.g. tabbing away)', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  trigger(el).dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('forwards public focus and blur to the trigger', async () => {
  const el = (await fixture(basic())) as LyraSelect;

  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');
  el.blur();
  expect((el.shadowRoot!.activeElement) === (null)).to.equal(true);
});

it('bridges exactly one native trigger focus/blur pair plus typed aliases', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  const nativeEvents: FocusEvent[] = [];
  const aliases: string[] = [];
  el.addEventListener('focus', (event) => nativeEvents.push(event as FocusEvent));
  el.addEventListener('blur', (event) => nativeEvents.push(event as FocusEvent));
  el.addEventListener('lr-focus', () => aliases.push('lr-focus'));
  el.addEventListener('lr-blur', () => aliases.push('lr-blur'));

  btn.focus();
  btn.blur();

  expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
  expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
  expect(aliases).to.deep.equal(['lr-focus', 'lr-blur']);
});

it('marks touched from a real user blur of the trigger', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  trigger(el).focus();
  await el.updateComplete;
  expect((el as unknown as { touched: boolean }).touched, 'not yet blurred').to.be.false;

  trigger(el).blur();
  await el.updateComplete;
  expect((el as unknown as { touched: boolean }).touched, 'a real blur marks touched').to.be.true;
});

// See fr_asxOgk4UhNB07xevCWwFVQ: disabling a focused native form control (input/select/
// textarea/button) is plain platform behavior that forces a blur -- nothing to do with custom
// elements specifically. That forced blur is not a real user interaction and must not mark the
// field touched, since (depending on exact timing) it could reenter an in-flight Lit update and
// trip Lit's dev-mode "scheduled an update after an update completed" warning.
it('does not mark touched from a blur caused by the trigger itself becoming disabled', async () => {
  // Never chai-compare DOM nodes directly (hangs the whole file) -- compare identity as a plain
  // boolean instead.
  const el = (await fixture(basic())) as LyraSelect;
  trigger(el).focus();
  await el.updateComplete;
  expect(
    el.shadowRoot!.activeElement === trigger(el),
    'trigger holds focus before disabling',
  ).to.be.true;

  el.disabled = true;
  await el.updateComplete;
  // The platform's own force-blur can trail the render commit by an unpredictable amount on some
  // engines (observed on Firefox/WebKit; Chromium settles within updateComplete alone) -- poll
  // instead of guessing a fixed delay.
  await waitUntil(() => el.shadowRoot!.activeElement === null, 'the platform never force-blurred the disabled trigger', { timeout: 2000 });

  expect(
    el.shadowRoot!.activeElement === null,
    'the platform force-blurred the now-disabled trigger',
  ).to.be.true;
  expect(
    (el as unknown as { touched: boolean }).touched,
    'a disable-forced blur must not mark the field touched',
  ).to.be.false;
});

it('reflects an invalid state only after the field has been interacted with once', async () => {
  const el = (await fixture(html`
    <lr-select required>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.false;

  trigger(el).dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.true;
});

it('renders sub and dot-color from light-DOM options', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a" sub="Running" dot-color="green">Meter A</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="option-sub"]')!.textContent).to.equal('Running');
  expect((el.shadowRoot!.querySelector('[part="option-dot"]') as HTMLElement).style.background).to.equal(
    'green',
  );
});

it('lays out option status dots and labels in a vertically centered row', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a" sub="Running" dot-color="green">Meter A</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  const row = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
  const dot = el.shadowRoot!.querySelector('[part="option-dot"]') as HTMLElement;
  const label = el.shadowRoot!.querySelector('[part="option-label"]') as HTMLElement;
  row.style.minBlockSize = '80px';

  const rowStyle = getComputedStyle(row);
  expect(rowStyle.flexDirection).to.equal('row');
  expect(rowStyle.alignItems).to.equal('center');

  const dotRect = dot.getBoundingClientRect();
  const labelRect = label.getBoundingClientRect();
  expect(dotRect.right < labelRect.left, 'the shared option gap must separate the leading dot and label').to.be.true;
  expect(Math.abs((dotRect.top + dotRect.bottom) / 2 - (labelRect.top + labelRect.bottom) / 2)).to.be.lessThan(1);
});

it('renders a group-label header when option rows are grouped', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a" group="Fruits">Apple</lr-option>
      <lr-option value="b" group="Fruits">Banana</lr-option>
      <lr-option value="c" group="Vegetables">Carrot</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  const groups = Array.from(el.shadowRoot!.querySelectorAll('.group-label')).map((n) => n.textContent);
  expect(groups).to.deep.equal(['Fruits', 'Vegetables']);
});

it('skips a disabled option during click selection and keyboard navigation', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" disabled>Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
    </lr-select>
  `)) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  // ArrowDown twice from -1 should land on Cherry (index 1 of the 2
  // navigable options), skipping disabled Banana entirely.
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;

  setTimeout(() => btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('c');
});

it('pairs the form-control label with the trigger via for/id so clicking the label focuses it', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.label = 'Fruit';
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLLabelElement;
  const btn = trigger(el);
  expect(label.htmlFor, 'label should have a for attribute').to.not.equal('');
  expect(label.htmlFor).to.equal(btn.id);
});

it('hides the error and hint parts when empty, shows them once populated', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  await el.updateComplete;

  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
  expect(getComputedStyle(errorPart).display).to.equal('none');
  expect(getComputedStyle(hintPart).display).to.equal('none');

  el.errorText = 'Selection required';
  el.hint = 'Pick a fruit';
  await el.updateComplete;
  expect(getComputedStyle(errorPart).display).to.not.equal('none');
  expect(getComputedStyle(hintPart).display).to.not.equal('none');
});

it('associates the trigger with the hint/error text via aria-describedby, like lr-combobox', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  await el.updateComplete;
  const btn = trigger(el);
  expect(btn.hasAttribute('aria-describedby')).to.be.false;

  el.hint = 'Pick a fruit';
  await el.updateComplete;
  expect(btn.getAttribute('aria-describedby')).to.equal('select-hint');

  el.errorText = 'Selection required';
  await el.updateComplete;
  expect(btn.getAttribute('aria-describedby')).to.equal('select-error select-hint');
});

it('is accessible', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.label = 'Fruit';
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible while open', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.label = 'Fruit';
  el.open = true;
  await el.updateComplete;
  // `[part='listbox']`'s opacity transition (gated by :host([open])) is still running right after
  // `open` is set and the update settles. Left running, axe's color-contrast check factors in the
  // listbox's current (transitional) opacity, so sampling mid-fade blends its text and background
  // toward each other and reports a false "serious" violation. Finishing it outright matches the
  // idiom overlay.test.ts already uses for this same kind of reveal animation.
  el.shadowRoot!.querySelector('[part="listbox"]')?.getAnimations().forEach((animation) => animation.finish());
  await expect(el).to.be.accessible();
});

it('applies a size attribute that reflects to the host', async () => {
  const el = (await fixture(html`<lr-select size="s"></lr-select>`)) as LyraSelect;
  expect(el.getAttribute('size')).to.equal('s');
  expect(el.size).to.equal('s');
});

it('defaults to size "m"', async () => {
  const el = (await fixture(html`<lr-select></lr-select>`)) as LyraSelect;
  expect(el.size).to.equal('m');
});

it('prefers a host-level aria-label over label/placeholder for the trigger', async () => {
  const el = (await fixture(
    html`<lr-select aria-label="Sort order" placeholder="Choose…"></lr-select>`,
  )) as LyraSelect;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(trigger.getAttribute('aria-label')).to.equal('Sort order');
});

it('preserves an explicitly empty host aria-label on the trigger', async () => {
  const el = (await fixture(
    html`<lr-select aria-label="" label="Choice" placeholder="Choose…"></lr-select>`,
  )) as LyraSelect;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(trigger.hasAttribute('aria-label')).to.equal(true);
  expect(trigger.getAttribute('aria-label')).to.equal('');
});

it('falls back to placeholder when no host aria-label or label is set', async () => {
  const el = (await fixture(html`<lr-select placeholder="Choose…"></lr-select>`)) as LyraSelect;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(trigger.getAttribute('aria-label')).to.equal('Choose…');
});

describe('trigger aria-label localization', () => {
  it('falls back to the localized "Select" when no aria-label, label, or placeholder is set', async () => {
    const el = (await fixture(html`<lr-select></lr-select>`)) as LyraSelect;
    expect(trigger(el).getAttribute('aria-label')).to.equal('Select');
  });

  it('localizes the fallback trigger aria-label via this.localize() when .strings overrides select', async () => {
    const el = (await fixture(
      html`<lr-select .strings=${{ select: 'Sélectionner' }}></lr-select>`,
    )) as LyraSelect;
    expect(trigger(el).getAttribute('aria-label')).to.equal('Sélectionner');
  });
});

describe('validationMessage localization', () => {
  it('defaults to the built-in English validationMessage for a required, unselected control', async () => {
    const el = (await fixture(html`
      <lr-select required>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    expect(el.validationMessage).to.equal('Please select an option.');
  });

  it('localizes the validationMessage via this.localize() when .strings overrides selectValueMissing', async () => {
    const el = (await fixture(html`
      <lr-select required .strings=${{ selectValueMissing: 'Veuillez sélectionner une option.' }}>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    expect(el.validationMessage).to.equal('Veuillez sélectionner une option.');

    el.value = 'a';
    expect(el.validationMessage).to.equal('');
  });
});

describe('single-option combobox default (autoCommitSingleOption unset)', () => {
  const single = () => html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `;

  it('keeps the normal combobox/listbox/chevron trigger when only one option is enabled', async () => {
    const el = (await fixture(single())) as LyraSelect;
    expect(el.autoCommitSingleOption).to.be.false;
    const btn = trigger(el);
    expect(btn.getAttribute('role')).to.equal('combobox');
    expect(btn.getAttribute('aria-haspopup')).to.equal('listbox');
    expect(btn.hasAttribute('aria-expanded')).to.be.true;
    expect(btn.hasAttribute('aria-controls')).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]')).to.exist;
  });

  it('opens the listbox on click instead of committing the sole option directly', async () => {
    const el = (await fixture(single())) as LyraSelect;
    trigger(el).click();
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(el.value).to.equal('');
  });

  it('opens the listbox on ArrowDown instead of committing the sole option directly', async () => {
    const el = (await fixture(single())) as LyraSelect;
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(el.value).to.equal('');
  });
});

describe('single-option auto-commit (autoCommitSingleOption)', () => {
  const single = () => html`
    <lr-select auto-commit-single-option>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `;

  it('renders the trigger as a plain button with no chevron/combobox ARIA when only one option is enabled', async () => {
    const el = (await fixture(single())) as LyraSelect;
    const btn = trigger(el);
    expect(btn.getAttribute('role')).to.equal('button');
    expect(btn.hasAttribute('aria-haspopup')).to.be.false;
    expect(btn.hasAttribute('aria-expanded')).to.be.false;
    expect(btn.hasAttribute('aria-controls')).to.be.false;
    expect(btn.hasAttribute('aria-activedescendant')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]')).to.not.exist;
  });

  it('commits the sole option on click without ever opening the listbox', async () => {
    const el = (await fixture(single())) as LyraSelect;
    setTimeout(() => trigger(el).click());
    await oneEvent(el, 'change');
    expect(el.value).to.equal('a');
    expect(el.open).to.be.false;
  });

  it('commits the sole option on ArrowDown/ArrowUp', async () => {
    const el = (await fixture(single())) as LyraSelect;
    setTimeout(() =>
      trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })),
    );
    await oneEvent(el, 'change');
    expect(el.value).to.equal('a');
    expect(el.open).to.be.false;
  });

  it('does not refire change/input on a second click once the sole option is already selected', async () => {
    const el = (await fixture(single())) as LyraSelect;
    setTimeout(() => trigger(el).click());
    await oneEvent(el, 'change');
    expect(el.value).to.equal('a');

    let changeFired = false;
    let inputFired = false;
    el.addEventListener('change', () => (changeFired = true));
    el.addEventListener('input', () => (inputFired = true));
    trigger(el).click();
    await el.updateComplete;
    expect(el.value).to.equal('a');
    expect(changeFired).to.be.false;
    expect(inputFired).to.be.false;
  });

  it('still opens normally (three-row combobox chrome, no auto-commit) once a second option is enabled', async () => {
    const el = (await fixture(html`
      <lr-select>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect;
    const btn = trigger(el);
    expect(btn.getAttribute('role')).to.equal('combobox');
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]')).to.exist;

    btn.click();
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(el.value).to.equal('');
  });

  it('treats a single ENABLED option among several disabled ones as single-option too', async () => {
    const el = (await fixture(html`
      <lr-select auto-commit-single-option>
        <lr-option value="a" disabled>Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c" disabled>Cherry</lr-option>
      </lr-select>
    `)) as LyraSelect;
    const btn = trigger(el);
    expect(btn.getAttribute('role')).to.equal('button');

    setTimeout(() => btn.click());
    await oneEvent(el, 'change');
    expect(el.value).to.equal('b');
  });

  it('does not auto-select on mount -- a required, unselected single-option select stays invalid', async () => {
    const form = (await fixture(html`
      <form>
        <lr-select name="fruit" required>
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-select') as LyraSelect;
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(form.reportValidity()).to.be.false;
  });

  it('does not intercept click/keyboard when disabled, even with a single option', async () => {
    const el = (await fixture(html`
      <lr-select disabled auto-commit-single-option>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    trigger(el).click();
    await el.updateComplete;
    expect(el.value).to.equal('');
  });

  it('is accessible with a single enabled option', async () => {
    const el = (await fixture(single())) as LyraSelect;
    el.label = 'Fruit';
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('SingleOption / SingleEnabledAmongDisabled stories actually set auto-commit-single-option', () => {
  it('SingleOption renders the plain-button auto-commit trigger its doc comment describes', async () => {
    const { SingleOption } = await import('./select.stories.js');
    const el = (await fixture(SingleOption.render!({}, null as never))) as LyraSelect;
    const btn = trigger(el);
    expect(el.autoCommitSingleOption).to.be.true;
    expect(btn.getAttribute('role')).to.equal('button');
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]')).to.not.exist;
  });

  it('SingleEnabledAmongDisabled renders the plain-button auto-commit trigger its doc comment describes', async () => {
    const { SingleEnabledAmongDisabled } = await import('./select.stories.js');
    const el = (await fixture(SingleEnabledAmongDisabled.render!({}, null as never))) as LyraSelect;
    const btn = trigger(el);
    expect(el.autoCommitSingleOption).to.be.true;
    expect(btn.getAttribute('role')).to.equal('button');
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]')).to.not.exist;
  });
});

it('lets a consumer pin an exact trigger height via --lr-select-trigger-height, bypassing the min-height floor', async () => {
  const el = (await fixture(html`<lr-select label="Role"><lr-option value="a">A</lr-option></lr-select>`)) as LyraSelect;
  el.style.setProperty('--lr-select-trigger-height', '43px');
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(getComputedStyle(trigger).blockSize).to.equal('43px');
});

it('leaves today\'s min-height-floor-only behavior unchanged when the override is unset', async () => {
  const el = (await fixture(html`<lr-select label="Role"><lr-option value="a">A</lr-option></lr-select>`)) as LyraSelect;
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(getComputedStyle(trigger).blockSize).to.not.equal('0px');
  // No forced block-size -- the trigger's rendered height still comes from its own
  // padding/line-height/border, only floored by --lr-select-trigger-min-height as before.
});

describe('per-size min-height floor', () => {
  it('actually enforces --lr-select-trigger-min-height at each non-default size', async () => {
    // --lr-select-trigger-min-height is declared per size tier (xs=1.5rem, s=1.875rem,
    // l=3rem, xl=3.5rem) but was never wired to min-block-size for those tiers -- this is the
    // regression test for that fix.
    const expected: Record<string, string> = { xs: '24px', s: '30px', l: '48px', xl: '56px' };
    for (const [size, px] of Object.entries(expected)) {
      const el = (await fixture(
        html`<lr-select size=${size} label="Role"><lr-option value="a">A</lr-option></lr-select>`,
      )) as LyraSelect;
      const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
      expect(getComputedStyle(t).minBlockSize, `size=${size}`).to.equal(px);
    }
  });

  it('enforces the same floor on the default (m) tier, matching lr-input/lr-combobox at that tier', async () => {
    const el = (await fixture(html`<lr-select label="Role"><lr-option value="a">A</lr-option></lr-select>`)) as LyraSelect;
    const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(t).minBlockSize).to.equal('40px');
  });

  it('lets a consumer raise --lr-select-trigger-min-height at the default tier', async () => {
    const el = (await fixture(html`<lr-select label="Role"><lr-option value="a">A</lr-option></lr-select>`)) as LyraSelect;
    el.style.setProperty('--lr-select-trigger-min-height', '52px');
    await el.updateComplete;
    const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(t).minBlockSize).to.equal('52px');
  });

  it('keeps --lr-select-trigger-min-height live at size="s" with no specificity patch rule', async () => {
    const el = (await fixture(
      html`<lr-select size="s" label="Role"><lr-option value="a">A</lr-option></lr-select>`,
    )) as LyraSelect;
    const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(t).minBlockSize).to.equal('30px');
    el.style.setProperty('--lr-select-trigger-min-height', '33px');
    await el.updateComplete;
    expect(getComputedStyle(t).minBlockSize).to.equal('33px');
  });

  it('a consumer-pinned --lr-select-trigger-height still overrides the per-size floor', async () => {
    const el = (await fixture(
      html`<lr-select size="s" label="Role"><lr-option value="a">A</lr-option></lr-select>`,
    )) as LyraSelect;
    el.style.setProperty('--lr-select-trigger-height', '43px');
    await el.updateComplete;
    const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(t).blockSize).to.equal('43px');
    expect(getComputedStyle(t).minBlockSize).to.equal('43px');
  });
});

describe('trigger gap/radius cssprops', () => {
  it('exposes --lr-select-gap and --lr-select-radius, defaulting to the pre-existing literals', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const cs = getComputedStyle(trigger(el));
    expect(cs.gap).to.equal('4px');
    expect(cs.borderRadius).to.equal('6px');
  });

  it('retunes the trigger gap and corner radius with no ::part(trigger) rule', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.style.setProperty('--lr-select-gap', '12px');
    el.style.setProperty('--lr-select-radius', '3px');
    await el.updateComplete;
    const cs = getComputedStyle(trigger(el));
    expect(cs.gap).to.equal('12px');
    expect(cs.borderRadius).to.equal('3px');
  });

  it('keeps the trigger gap constant across tiers while the radius follows the shared ladder', async () => {
    const triggerOf = (host: LyraSelect) => host.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    const mEl = (await fixture(basic())) as LyraSelect;
    const xsEl = (await fixture(html`<lr-select size="xs"></lr-select>`)) as LyraSelect;
    // The trigger's adornment gap is deliberately outside the ladder -- it never varied by tier.
    expect(getComputedStyle(triggerOf(mEl)).gap).to.equal('4px');
    expect(getComputedStyle(triggerOf(xsEl)).gap).to.equal('4px');
    // The radius does vary: a 6px corner on a 24px-tall trigger reads as a lozenge.
    expect(getComputedStyle(triggerOf(mEl)).borderTopLeftRadius).to.equal('6px');
    expect(getComputedStyle(triggerOf(xsEl)).borderTopLeftRadius).to.equal('2px');
  });
});

/** Render the max-inline-size declared on `selector` (read off the element's own applied stylesheets)
 *  into the component's shadow scope with the viewport-clamp token pinned to a tiny value, returning
 *  its resolved computed value. Wired to --lr-popover-viewport-clamp the min() collapses to that
 *  pinned value; a leftover 92vw/90vw literal would resolve to something else. */
function renderedClamp(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = '';
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector) &&
        rule.style.maxInlineSize
      ) {
        declared = rule.style.maxInlineSize;
      }
    }
  }
  const probe = document.createElement('span');
  probe.style.display = 'block';
  probe.style.setProperty('--lr-popover-viewport-clamp', '10px');
  probe.style.maxInlineSize = declared;
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).maxInlineSize;
  probe.remove();
  return value;
}

it('clamps its floating surface width through the shared popover-viewport-clamp token', async () => {
  const el = (await fixture(html`<lr-select></lr-select>`)) as HTMLElement;
  await (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
  expect(renderedClamp(el, "[part='listbox']")).to.equal('10px');
});

it('renders a populated open listbox with vertical scrolling and horizontal overflow clipped', async () => {
  // Per the CSS overflow spec, pinning one axis to a non-'visible' value forces the other axis's
  // used value to 'auto' too -- an implicit overflow-x: auto here risks a phantom horizontal
  // scrollbar even though this listbox only ever scrolls vertically. Same class of bug already
  // fixed on lr-tab-group' tablist (overflow-x: auto; overflow-y: hidden;), just the opposite axis.
  const el = (await fixture(html`
    <lr-select open style="--lr-size-18rem: 40px;">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
  const computed = getComputedStyle(listbox);

  expect(computed.visibility).to.equal('visible');
  expect(listbox.scrollHeight).to.be.greaterThan(listbox.clientHeight);
  expect(computed.overflowY).to.equal('auto');
  expect(computed.overflowX).to.equal('hidden');
});

it('contains long form and option content at a 320px allocation', async () => {
  const long = `generated-${'identifier'.repeat(24)}`;
  const wrapper = await fixture(html`
    <div style="display:flex; inline-size:320px;">
      <lr-select style="min-inline-size:0; flex:1 1 auto;">
        <lr-option value="long" group=${long} sub=${long} dot-color="green">${long}</lr-option>
      </lr-select>
    </div>
  `);
  const el = wrapper.querySelector('lr-select') as LyraSelect;
  el.label = long;
  el.hint = long;
  el.errorText = long;
  el.open = true;
  await el.updateComplete;

  expect(el.getBoundingClientRect().width).to.be.at.most(321);
  for (const selector of [
    '[part="form-control"]',
    '[part="form-control-label"]',
    '[part~="hint"]',
    '[part="error"]',
    '[part="option"]',
    '[part="option-label"]',
    '[part="option-sub"]',
    '.group-label',
  ]) {
    const part = el.shadowRoot!.querySelector(selector) as HTMLElement;
    const rect = part.getBoundingClientRect();
    expect(getComputedStyle(part).display, `${selector} should be visible`).to.not.equal('none');
    expect(part.scrollWidth, `${selector} should contain its rendered text`).to.be.at.most(Math.ceil(rect.width) + 1);
  }
});

it('lets its trigger shrink below a long placeholder\'s min-content width', async () => {
  const placeholder = `SelecioneUmaOpcaoLocalizada${'MuitoLonga'.repeat(12)}`;
  const wrapper = (await fixture(html`
    <div style="display:flex; inline-size:228px; min-inline-size:0;">
      <lr-select
        style="min-inline-size:0; flex:1 1 auto;"
        placeholder=${placeholder}
      ></lr-select>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-select') as LyraSelect;
  await el.updateComplete;

  const trigger = el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
  const label = trigger.querySelector<HTMLElement>('.trigger-label')!;
  const wrapperRect = wrapper.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();

  expect(triggerRect.width).to.be.at.most(wrapperRect.width + 1);
  expect(triggerRect.right).to.be.at.most(wrapperRect.right + 1);
  expect(label.scrollWidth).to.be.greaterThan(label.clientWidth);
  expect(getComputedStyle(label).textOverflow).to.equal('ellipsis');
});

it('contains a long selected value and adornments at 320px in LTR and RTL', async () => {
  const label = `primary-${'production-region-identifier'.repeat(8)}`;
  for (const direction of ['ltr', 'rtl'] as const) {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 320px">
        <lr-select value="primary" label="Deployment region">
          <span slot="start" aria-hidden="true">◉</span>
          <kbd slot="end">R</kbd>
          <lr-option value="primary">${label}</lr-option>
          <lr-option value="backup">Backup</lr-option>
        </lr-select>
      </div>
    `);
    const el = wrapper.querySelector('lr-select') as LyraSelect;
    await el.updateComplete;
    const trigger = el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
    expect(wrapper.scrollWidth, `dir=${direction} wrapper`).to.be.at.most(wrapper.clientWidth);
    expect(trigger.getBoundingClientRect().width, `dir=${direction} trigger`).to.be.at.most(
      wrapper.getBoundingClientRect().width,
    );
  }
});

it('contains multiple long selected tags at 320px in LTR and RTL', async () => {
  const values = ['alpha', 'beta', 'gamma'];
  const labels = values.map(
    (value) => `${value}-${'generated-selection-identifier'.repeat(6)}`,
  );
  for (const direction of ['ltr', 'rtl'] as const) {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 320px">
        <lr-select multiple .value=${values} label="Regions">
          ${labels.map(
            (label, index) => html`<lr-option value=${values[index]}>${label}</lr-option>`,
          )}
        </lr-select>
      </div>
    `);
    const el = wrapper.querySelector('lr-select') as LyraSelect;
    await el.updateComplete;
    const tags = el.shadowRoot!.querySelector<HTMLElement>('[part="tags"]')!;
    expect(wrapper.scrollWidth, `dir=${direction} wrapper`).to.be.at.most(wrapper.clientWidth);
    expect(tags.getBoundingClientRect().width, `dir=${direction} tags`).to.be.at.most(
      wrapper.getBoundingClientRect().width,
    );
  }
});

it('gives the trigger a :hover rule alongside its :focus-visible ring', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(
    /:where\(\[part='trigger'\]\):hover:where\(:not\(:disabled\)\)\s*\{[^}]*background:\s*var\(--lr-select-trigger-hover-bg,\s*var\(--lr-color-brand-quiet\)\)/,
  );
});

describe('active-option row cssprop indirection', () => {
  it('recolors the active option row from --lr-select-option-active-bg on an ancestor, not a :host-declared prop', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.style.setProperty('--lr-select-option-active-bg', 'rgb(10, 20, 30)');
    el.open = true;
    await el.updateComplete;
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true }));
    await el.updateComplete;
    const active = el.shadowRoot!.querySelector('[part="option"][data-active]') as HTMLElement;
    expect(getComputedStyle(active).backgroundColor).to.equal('rgb(10, 20, 30)');
  });

  it('renders byte-identically to the pre-cssprop-indirection output when the prop is unset', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true }));
    await el.updateComplete;
    const active = el.shadowRoot!.querySelector('[part="option"][data-active]') as HTMLElement;
    // Resolve the brand-quiet token in the same shadow root for a like-for-like comparison,
    // rather than comparing a raw custom-property string against getComputedStyle's rgb(...) form.
    const probe = document.createElement('span');
    probe.setAttribute('style', 'background: var(--lr-color-brand-quiet)');
    el.shadowRoot!.appendChild(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    expect(getComputedStyle(active).backgroundColor).to.equal(expected);
  });
});

describe('host click() forwarding', () => {
  it('forwards host click() to the internal trigger button, opening the listbox', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    expect(el.open).to.be.false;
    el.click();
    await el.updateComplete;
    expect(el.open).to.be.true;
  });

  it('does not forward click() when the trigger is disabled, matching a native disabled <button>', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.disabled = true;
    await el.updateComplete;
    el.click();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });
});

describe('ElementInternals availability', () => {
  it('does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)', () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraSelect | undefined;
      expect(() => {
        el = document.createElement('lr-select') as LyraSelect;
      }).to.not.throw();
      // Confirm the fallback keeps the rest of the public surface usable rather than merely
      // swallowing the constructor error.
      expect(el!.checkValidity()).to.be.true;
      expect((el!.form) === (null)).to.equal(true);
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

describe('lifecycle super calls', () => {
  const LyraSelectCtor = customElements.get('lr-select')!;

  it('calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
    // Keyed on `this === el` (not a bare shared boolean) -- `basic()`'s slotted <lr-option>
    // children are themselves LyraElement subclasses that update through this exact same patched
    // prototype method, so a plain "was it called at all" flag would pass even if LyraSelect's
    // own willUpdate() never called super, as long as some sibling element happened to.
    const proto = LyraElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void };
    const original = proto.willUpdate;
    let calledOnSelect = false;
    proto.willUpdate = function (this: LyraElement, changed: PropertyValues): void {
      if (this instanceof LyraSelectCtor) calledOnSelect = true;
      original.call(this, changed);
    };
    try {
      const el = (await fixture(basic())) as LyraSelect;
      await el.updateComplete;
      expect(calledOnSelect).to.be.true;
    } finally {
      proto.willUpdate = original;
    }
  });

  it('calls super.updated so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
    const proto = LyraElement.prototype as unknown as { updated: (changed: PropertyValues) => void };
    const original = proto.updated;
    let calledOnSelect = false;
    proto.updated = function (this: LyraElement, changed: PropertyValues): void {
      if (this instanceof LyraSelectCtor) calledOnSelect = true;
      original.call(this, changed);
    };
    try {
      const el = (await fixture(basic())) as LyraSelect;
      await el.updateComplete;
      expect(calledOnSelect).to.be.true;
    } finally {
      proto.updated = original;
    }
  });
});

describe('start/end adornment slots', () => {
  const part = (el: LyraSelect, name: string) => el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;

  it('renders a slotted glyph inside the trigger, before the value label', async () => {
    const el = (await fixture(html`
      <lr-select>
        <svg slot="start" width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5"></circle></svg>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const start = part(el, 'start');
    expect(start.hasAttribute('hidden')).to.be.false;
    const startRect = start.getBoundingClientRect();
    const triggerRect = trigger(el).getBoundingClientRect();
    expect(startRect.width).to.be.greaterThan(0);
    expect(startRect.left).to.be.at.least(triggerRect.left);
  });

  it('places the end adornment before the expand icon', async () => {
    const el = (await fixture(html`
      <lr-select>
        <kbd slot="end">K</kbd>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const end = part(el, 'end');
    expect(end.hasAttribute('hidden')).to.be.false;
    expect(end.compareDocumentPosition(part(el, 'expand-icon')) & Node.DOCUMENT_POSITION_FOLLOWING).to.be.greaterThan(
      0,
    );
  });

  it('hides both wrappers when nothing is slotted', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    await el.updateComplete;
    expect(part(el, 'start').hasAttribute('hidden')).to.be.true;
    expect(part(el, 'end').hasAttribute('hidden')).to.be.true;
    expect(getComputedStyle(part(el, 'start')).display).to.equal('none');
    expect(getComputedStyle(part(el, 'end')).display).to.equal('none');
  });

  it('reveals the wrapper when an adornment is slotted in after first render', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const glyph = document.createElement('span');
    glyph.slot = 'start';
    glyph.textContent = '⌕';
    el.append(glyph);
    await el.updateComplete;
    await el.updateComplete;
    expect(part(el, 'start').hasAttribute('hidden')).to.be.false;
  });

  // Adversarial: the JSDoc above warns start/end should carry non-focusable content only, because
  // [part="trigger"] renders as a real <button> -- a slotted focusable element lands inside it in
  // the flattened tree (invalid interactive-content nesting) and is unreachable by keyboard/AT
  // regardless, since the outer button intercepts every click/Enter/Space first. axe-core does not
  // currently flag this shadow-DOM-composed pattern (verified empirically against axe-core 4.12.1
  // -- it reports zero violations here), so these lock in the real, provable hazard structurally:
  // the slotted focusable element is genuinely assigned into a slot that lives inside the outer
  // interactive button in the flattened tree, not a hypothetical.
  it('nests a slotted <button> inside the trigger button in the flattened tree when placed in start', async () => {
    const el = (await fixture(html`
      <lr-select aria-label="Choice">
        <button slot="start" aria-label="Icon action">i</button>
        <lr-option value="a">A</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const slottedButton = el.querySelector('button')!;
    const startSlot = trigger(el).querySelector('slot[name="start"]') as HTMLSlotElement;
    expect(startSlot.assignedElements()).to.include(slottedButton);
  });

  it('nests a slotted <a href> inside the trigger button in the flattened tree when placed in end', async () => {
    const el = (await fixture(html`
      <lr-select aria-label="Choice">
        <a slot="end" href="/details">Details</a>
        <lr-option value="a">A</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const slottedAnchor = el.querySelector('a')!;
    const endSlot = trigger(el).querySelector('slot[name="end"]') as HTMLSlotElement;
    expect(endSlot.assignedElements()).to.include(slottedAnchor);
  });
});

it('applies size="2xs" with a 20px trigger min-height', async () => {
  const el = await fixture(
    html`<lr-select size="2xs" label="Role"><lr-option value="a">A</lr-option></lr-select>`,
  );
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(getComputedStyle(trigger).minBlockSize).to.equal('20px');
});

it('reflects size="2xs" as a host attribute', async () => {
  const el = (await fixture(html`<lr-select size="2xs"></lr-select>`)) as LyraSelect;
  expect(el.size).to.equal('2xs');
  expect(el.getAttribute('size')).to.equal('2xs');
});

describe('ElementInternals unavailable at call time (attachInternals throws)', () => {
  it('falls back to no-op ElementInternals when attachInternals() exists but throws (e.g. already attached elsewhere)', () => {
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals = function (): ElementInternals {
      throw new Error('already attached');
    };
    try {
      let el: LyraSelect | undefined;
      expect(() => {
        el = document.createElement('lr-select') as LyraSelect;
      }).to.not.throw();
      expect(el!.checkValidity()).to.be.true;
      expect(el!.reportValidity()).to.be.true;
      expect((el!.form) === (null)).to.equal(true);
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

it('normalizes a nullish name assignment to the empty string and removes the name attribute', async () => {
  const el = (await fixture(html`<lr-select name="fruit"></lr-select>`)) as LyraSelect;
  expect(el.getAttribute('name')).to.equal('fruit');
  (el as unknown as { name: string }).name = null as unknown as string;
  expect(el.name).to.equal('');
  expect(el.hasAttribute('name')).to.be.false;
});

it('normalizes a nullish value assignment to the empty string', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.value = 'a';
  (el as unknown as { value: string }).value = null as unknown as string;
  expect(el.value).to.equal('');
});

describe('formStateRestoreCallback', () => {
  it('restores a string form state verbatim', () => {
    const el = document.createElement('lr-select') as LyraSelect;
    (
      el as unknown as {
        formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
      }
    ).formStateRestoreCallback('a', 'restore');
    expect(el.value).to.equal('a');
  });

  it('restores to empty when the browser hands it a non-string state (e.g. null)', () => {
    const el = document.createElement('lr-select') as LyraSelect;
    el.value = 'a';
    (
      el as unknown as {
        formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
      }
    ).formStateRestoreCallback(null, 'restore');
    expect(el.value).to.equal('');
  });
});

it('seeds a newly-selected option that is slotted in after the initial collection pass', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;

  const defaultSlot = el.shadowRoot!.querySelector('slot:not([name])') as HTMLSlotElement;
  const slotchangePromise = oneEvent(defaultSlot, 'slotchange');
  const opt = document.createElement('lr-option');
  opt.setAttribute('value', 'b');
  opt.textContent = 'Banana';
  opt.toggleAttribute('selected', true);
  el.append(opt);
  await slotchangePromise;
  await el.updateComplete;

  expect(el.value).to.equal('b');
});

it('does not auto-commit when auto-commit-single-option is set but more than one option is enabled', async () => {
  const el = (await fixture(html`
    <lr-select auto-commit-single-option>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>
  `)) as LyraSelect;
  const btn = trigger(el);
  expect(btn.getAttribute('role')).to.equal('combobox');

  btn.click();
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(el.value).to.equal('');
});

it('ignores a dispatched keydown-driven open attempt while disabled', async () => {
  const el = (await fixture(html`
    <lr-select disabled>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('ignores a dispatched click while disabled, even bypassing native click() gating', async () => {
  const el = (await fixture(html`
    <lr-select disabled>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  trigger(el).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('does not select a disabled option row via a direct click, even though the row itself has no native disabled semantics', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" disabled>Banana</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const disabledRow = [...rows(el)].find((r) => r.dataset.value === 'b')!;
  disabledRow.click();
  await el.updateComplete;
  expect(el.value).to.equal('');
  expect(el.open).to.be.true; // selection blocked, listbox stays open
});

describe('type-ahead edge cases', () => {
  it('does nothing when every option is disabled', async () => {
    const el = (await fixture(html`
      <lr-select>
        <lr-option value="a" disabled>Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(el.open).to.be.false;
  });

  it('does nothing when no option label starts with the typed character', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('');
  });
});

describe('ArrowUp keyboard handling', () => {
  it('commits the sole option on ArrowUp too, not just ArrowDown', async () => {
    const el = (await fixture(html`
      <lr-select auto-commit-single-option>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    setTimeout(() =>
      trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })),
    );
    await oneEvent(el, 'change');
    expect(el.value).to.equal('a');
    expect(el.open).to.be.false;
  });

  it('navigates upward with ArrowUp when already open, decrementing the active index', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const btn = trigger(el);
    el.open = true;
    await el.updateComplete;

    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await el.updateComplete;
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await el.updateComplete; // active index -> 1 (Banana)

    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    await el.updateComplete;

    const active = el.shadowRoot!.querySelector('[part="option"][data-active]');
    expect(active?.textContent).to.contain('Apple');
  });
});

it('closes the listbox on Enter without selecting anything when no option has been made active yet', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.value).to.equal('');
  expect(el.open).to.be.false;
});

describe('Home/End keyboard handling', () => {
  it('jumps to the first option with Home while open', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const btn = trigger(el);
    el.open = true;
    await el.updateComplete;
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await el.updateComplete;
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await el.updateComplete; // active index -> 1 (Banana)

    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    await el.updateComplete;

    const active = el.shadowRoot!.querySelector('[part="option"][data-active]');
    expect(active?.textContent).to.contain('Apple');
  });

  it('jumps to the last option with End while open', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const btn = trigger(el);
    el.open = true;
    await el.updateComplete;

    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await el.updateComplete;

    const active = el.shadowRoot!.querySelector('[part="option"][data-active]');
    expect(active?.textContent).to.contain('Cherry');
  });

  it('ignores Home/End while the listbox is closed', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const btn = trigger(el);
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.open).to.be.false;
  });
});

it('ignores a listbox click that lands outside any option row (e.g. a group-label or empty padding)', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a" group="Fruits">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const listbox = el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement;
  const groupLabel = listbox.querySelector('.group-label') as HTMLElement;
  groupLabel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await el.updateComplete;
  expect(el.value).to.equal('');
  expect(el.open).to.be.true;
});

describe('selected-state theming tokens', () => {
  it('honours --lr-select-option-selected-color on the selected row', async () => {
    const el = (await fixture(html`
      <lr-select value="a" style="--lr-select-option-selected-color: rgb(1, 2, 3);">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector('[part="option"][aria-selected="true"]') as HTMLElement;
    expect(getComputedStyle(selected).color).to.equal('rgb(1, 2, 3)');
  });

  it('honours --lr-select-option-selected-bg on the selected row', async () => {
    const el = (await fixture(html`
      <lr-select value="a" style="--lr-select-option-selected-bg: rgb(4, 5, 6);">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector('[part="option"][aria-selected="true"]') as HTMLElement;
    expect(getComputedStyle(selected).backgroundColor).to.equal('rgb(4, 5, 6)');
  });

  it('leaves the selected row at the brand color when the token is unset (regression)', async () => {
    const el = (await fixture(html`
      <lr-select value="a">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector('[part="option"][aria-selected="true"]') as HTMLElement;
    const brand = getComputedStyle(el).getPropertyValue('--lr-color-brand').trim();
    // Resolve the brand token through a probe element so we compare like-for-like rgb() values.
    const probe = document.createElement('span');
    probe.style.color = brand;
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    expect(getComputedStyle(selected).color).to.equal(expected);
  });
});

// -- Slotted supporting text and listbox pointer handling -------------------

it('preserves rendered error behavior while shared slot presence changes', async () => {
  const el = (await fixture(html`
    <lr-select label="Meter">
      <span slot="error">Pick one</span>
      <lr-option value="a">A</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(error.hidden).to.be.false;
  el.querySelector('[slot="error"]')!.remove();
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await el.updateComplete;
  expect(error.hidden).to.be.true;
});

it('prevents mousedown on an option so the trigger keeps focus, but not on listbox chrome', async () => {
  const el = (await fixture(html`
    <lr-select label="Meter"><lr-option value="a">A</lr-option></lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const onOption = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  el.shadowRoot!.querySelector('[part="option"]')!.dispatchEvent(onOption);
  expect(onOption.defaultPrevented).to.be.true;

  const onChrome = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  el.shadowRoot!.querySelector('[part="listbox"]')!.dispatchEvent(onChrome);
  expect(onChrome.defaultPrevented).to.be.false;
});


// -- Degraded-DOM form-association fallback ---------------------------------

describe('ElementInternals fallback (lr-select)', () => {
  /** Mirrors a DOM implementation without form-association support (a consumer's happy-dom/Vitest
   *  suite). `attachInternals()` is browser-only, so the component swaps in inert no-op internals
   *  rather than throwing at construction -- every member has to answer, and value changes must
   *  still work with form participation simply unavailable. */
  const withoutAttachInternals = async (
    impl: undefined | (() => never),
    assertion: (el: LyraSelect) => void | Promise<void>,
  ): Promise<void> => {
    const proto = HTMLElement.prototype as unknown as { attachInternals?: unknown };
    const original = proto.attachInternals;
    if (impl === undefined) delete proto.attachInternals;
    else proto.attachInternals = impl;
    try {
      const el = (await fixture(html`<lr-select label="Meter"><lr-option value="a">A</lr-option></lr-select>`)) as LyraSelect;
      await el.updateComplete;
      await assertion(el);
    } finally {
      proto.attachInternals = original;
    }
  };

  it('answers inertly when attachInternals is missing', async () => {
    await withoutAttachInternals(undefined, async (el) => {
      const internals = (el as unknown as { internals: ElementInternals }).internals;
      expect((internals.form) === null).to.equal(true);
      expect(internals.willValidate).to.be.false;
      expect(internals.validationMessage).to.equal('');
      expect(internals.checkValidity()).to.be.true;
      expect(internals.reportValidity()).to.be.true;
      expect(() => internals.setFormValue('x')).to.not.throw();
      expect(() => internals.setValidity({}, '')).to.not.throw();
      el.value = 'a';
      await el.updateComplete;
    });
  });

  it('answers inertly when attachInternals throws', async () => {
    await withoutAttachInternals(
      () => {
        throw new DOMException('unsupported');
      },
      (el) => {
        const internals = (el as unknown as { internals: ElementInternals }).internals;
        expect(internals.willValidate).to.be.false;
        expect(internals.reportValidity()).to.be.true;
        expect(internals.checkValidity()).to.be.true;
      },
    );
  });

  it('takes the direct no-op path when nothing in the prototype chain implements attachInternals', async () => {
    // `LyraElement` itself declares an `override attachInternals()` (to capture form internals for
    // shared infrastructure), which always shadows `HTMLElement.prototype.attachInternals` -- so
    // deleting only the native one (as the sibling "is missing" test above does) never reaches
    // `createInternalsSafely`'s own `typeof host.attachInternals !== 'function'` guard: the lookup
    // still finds LyraElement's own method (a real function), which then *calls* the missing
    // native one and throws, exercising the catch branch instead (same as "throws" above). Removing
    // LyraElement's override too is the only way to actually hit the guard's early-return branch.
    const htmlProto = HTMLElement.prototype as unknown as { attachInternals?: unknown };
    const lyraProto = LyraElement.prototype as unknown as { attachInternals?: unknown };
    const originalHtml = htmlProto.attachInternals;
    const hadOwnLyra = Object.prototype.hasOwnProperty.call(lyraProto, 'attachInternals');
    const originalLyra = lyraProto.attachInternals;
    delete htmlProto.attachInternals;
    delete lyraProto.attachInternals;
    try {
      const el = (await fixture(
        html`<lr-select label="Meter"><lr-option value="a">A</lr-option></lr-select>`,
      )) as LyraSelect;
      await el.updateComplete;
      const internals = (el as unknown as { internals: ElementInternals }).internals;
      expect(internals.willValidate).to.be.false;
      expect(internals.checkValidity()).to.be.true;
      expect(internals.reportValidity()).to.be.true;
      expect(() => internals.setFormValue('x')).to.not.throw();
    } finally {
      htmlProto.attachInternals = originalHtml;
      if (hadOwnLyra) lyraProto.attachInternals = originalLyra;
      else delete lyraProto.attachInternals;
    }
  });
});


// -- Multi-select, tags, clear, placement, appearance -----------------------

const multi = () => html`
  <lr-select multiple>
    <lr-option value="a">Apple</lr-option>
    <lr-option value="b">Banana</lr-option>
    <lr-option value="c">Cherry</lr-option>
  </lr-select>
`;

/** Every rendered tag, including the "+N" overflow chip (which carries both part names). */
function tags(el: LyraSelect): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll('[part~="tag"]')] as HTMLElement[];
}

function overflowTag(el: LyraSelect): HTMLElement | null {
  return el.shadowRoot!.querySelector('[part~="tag-overflow"]');
}

function clearButton(el: LyraSelect): HTMLButtonElement | null {
  return el.shadowRoot!.querySelector('[part="clear-button"]');
}

/** Resolve a token expression inside the component's own shadow scope, so a computed
 *  `rgb(...)` can be compared against a `var(--lr-*)` declaration like-for-like. */
function resolved(el: LyraSelect, property: string, declaration: string): string {
  const probe = document.createElement('span');
  probe.setAttribute('style', `${property}: ${declaration}`);
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}

describe('multiple', () => {
  it('exposes an array value and keeps the listbox open while picking several options', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    expect(el.multiple).to.be.true;
    expect(el.value).to.deep.equal([]);

    el.open = true;
    await el.updateComplete;
    rows(el)[0].click();
    await el.updateComplete;
    expect(el.open, 'the listbox stays open in multiple mode').to.be.true;
    rows(el)[2].click();
    await el.updateComplete;

    expect(el.value).to.deep.equal(['a', 'c']);
    expect([...rows(el)].map((row) => row.getAttribute('aria-selected'))).to.deep.equal([
      'true',
      'false',
      'true',
    ]);
  });

  it('toggles a already-selected row back off and emits the new array', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ['a', 'b'];
    el.open = true;
    await el.updateComplete;

    const detail: unknown[] = [];
    el.addEventListener('lr-change', (e) => detail.push((e as CustomEvent).detail));
    rows(el)[0].click();
    await el.updateComplete;

    expect(el.value).to.deep.equal(['b']);
    expect(detail).to.deep.equal([{ value: ['b'] }]);
  });

  it('renders one tag per selected option instead of a single label', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ['a', 'b'];
    await el.updateComplete;
    expect(tags(el).map((tag) => tag.textContent!.trim())).to.deep.equal(['Apple', 'Banana']);
  });

  it('marks the listbox as multi-selectable, rendering both ARIA states', async () => {
    const single = (await fixture(basic())) as LyraSelect;
    expect(single.shadowRoot!.querySelector('[part="listbox"]')!.getAttribute('aria-multiselectable')).to.equal('false');
    const el = (await fixture(multi())) as LyraSelect;
    expect(el.shadowRoot!.querySelector('[part="listbox"]')!.getAttribute('aria-multiselectable')).to.equal('true');
  });

  it('submits every selected value under the control name', async () => {
    const form = (await fixture(html`
      <form>
        <lr-select name="fruit" multiple>
          <lr-option value="a">Apple</lr-option>
          <lr-option value="b">Banana</lr-option>
        </lr-select>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-select') as LyraSelect;
    el.value = ['a', 'b'];
    await el.updateComplete;
    expect(new FormData(form).getAll('fruit')).to.deep.equal(['a', 'b']);
  });

  it('contributes no form entry at all while unnamed', async () => {
    const form = (await fixture(html`
      <form>
        <lr-select multiple>
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-select') as LyraSelect;
    el.value = ['a'];
    await el.updateComplete;
    expect([...new FormData(form).keys()]).to.deep.equal([]);
  });

  it('restores a multiple selection from persisted state, and a plain string in single mode', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.formStateRestoreCallback('["a","c"]', 'restore');
    expect(el.value).to.deep.equal(['a', 'c']);
    expect(() => el.formStateRestoreCallback('{"not":"an array"}', 'restore')).to.not.throw();
    expect(el.value).to.deep.equal([]);

    const single = (await fixture(basic())) as LyraSelect;
    single.formStateRestoreCallback('b', 'restore');
    expect(single.value).to.equal('b');
  });

  it('restores an empty selection from genuinely malformed (unparsable) persisted state', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ['a', 'b'];
    expect(el.value).to.deep.equal(['a', 'b']);
    // Unlike `{"not":"an array"}` above (valid JSON that simply isn't an array), this string fails
    // `JSON.parse()` itself, exercising the catch clause rather than the array-shape check.
    expect(() => el.formStateRestoreCallback('not valid json{', 'restore')).to.not.throw();
    expect(el.value).to.deep.equal([]);
  });

  it('collapses to the first selected value when `multiple` is turned off with several selected', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ['a', 'b', 'c'];
    await el.updateComplete;
    expect(el.value).to.deep.equal(['a', 'b', 'c']);

    el.multiple = false;
    await el.updateComplete;
    expect(el.value, 'only the first selection survives leaving multiple mode').to.equal('a');
    expect(el.selectedOptions.map((option) => option.value)).to.deep.equal(['a']);
  });

  it('stays invalid while required and empty, and validates once anything is selected', async () => {
    const el = (await fixture(html`
      <lr-select multiple required>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    expect(el.validity.valueMissing).to.be.true;
    el.value = ['a'];
    expect(el.validity.valueMissing).to.be.false;
  });

  it('seeds every declaratively-selected option and restores them all on form.reset()', async () => {
    const form = (await fixture(html`
      <form>
        <lr-select name="fruit" multiple>
          <lr-option value="a" selected>Apple</lr-option>
          <lr-option value="b">Banana</lr-option>
          <lr-option value="c" selected>Cherry</lr-option>
        </lr-select>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-select') as LyraSelect;
    await el.updateComplete;
    expect(el.value).to.deep.equal(['a', 'c']);

    el.value = ['b'];
    form.reset();
    expect(el.value).to.deep.equal(['a', 'c']);
  });

  it('removes the last selected value with Backspace on the trigger', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ['a', 'b'];
    await el.updateComplete;
    let changes = 0;
    el.addEventListener('change', () => changes++);
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.deep.equal(['a']);
    expect(changes).to.equal(1);
  });

  it('ignores removing a value that is not selected, or while disabled', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ['a', 'b'];
    await el.updateComplete;
    const removeValue = (value: string): void =>
      (el as unknown as { removeValue(v: string): void }).removeValue(value);

    el.disabled = true;
    removeValue('a');
    expect(el.value, 'disabled blocks removal even of a selected value').to.deep.equal(['a', 'b']);

    el.disabled = false;
    removeValue('not-selected');
    expect(el.value, 'removing an unselected value is a no-op').to.deep.equal(['a', 'b']);

    removeValue('a');
    expect(el.value).to.deep.equal(['b']);
  });

  it('focuses the trigger when removing the last remaining tag leaves no remove buttons behind', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ['a'];
    await el.updateComplete;
    const removeButton = el.shadowRoot!.querySelector(
      '[part~="tag__remove-button"]',
    ) as HTMLButtonElement;
    removeButton.click();
    await el.updateComplete;
    expect(el.value).to.deep.equal([]);
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.contain('trigger');
  });

  it('never removes an already-selected option through closed-state type-ahead', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ['a'];
    await el.updateComplete;
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.deep.equal(['a']);

    // Let the ~500ms type-ahead buffer lapse, so the next keystroke starts a fresh search
    // instead of extending this one into 'ab'.
    await aTimeout(600);
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'B', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.deep.equal(['a', 'b']);
  });

  it('is accessible with tags rendered and the listbox open', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.label = 'Fruit';
    el.value = ['a', 'b'];
    el.open = true;
    await el.updateComplete;
    // See the identical comment on the single-select "is accessible while open" test above --
    // `[part='listbox']`'s opacity transition is still running at this point.
    el.shadowRoot!.querySelector('[part="listbox"]')?.getAnimations().forEach((animation) => animation.finish());
    await expect(el).to.be.accessible();
  });
});

describe('max-options-visible', () => {
  const many = async (): Promise<LyraSelect> =>
    (await fixture(html`
      <lr-select multiple>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c">Cherry</lr-option>
        <lr-option value="d">Date</lr-option>
        <lr-option value="e">Elderberry</lr-option>
      </lr-select>
    `)) as LyraSelect;

  it('defaults to three tags and collapses the rest behind a "+N" indicator', async () => {
    const el = await many();
    expect(el.maxOptionsVisible).to.equal(3);
    el.strings = { selectSelectedOverflow: '+{n} more' };
    el.value = ['a', 'b', 'c', 'd', 'e'];
    await el.updateComplete;

    expect(tags(el).length).to.equal(4);
    expect(overflowTag(el)!.textContent!.trim()).to.equal('+2 more');
  });

  it('shows every tag with no indicator when set to 0', async () => {
    const el = await many();
    el.maxOptionsVisible = 0;
    el.value = ['a', 'b', 'c', 'd', 'e'];
    await el.updateComplete;
    expect(tags(el).length).to.equal(5);
    expect((overflowTag(el)) === (null)).to.equal(true);
  });

  it('falls back to three for a non-finite attribute value', async () => {
    const el = await many();
    el.setAttribute('max-options-visible', 'not-a-number');
    await el.updateComplete;
    expect(el.maxOptionsVisible).to.equal(3);
  });

  it('formats the hidden count with the effective locale', async () => {
    const el = await many();
    el.locale = 'ar-EG';
    el.strings = { selectSelectedOverflow: '+{n}' };
    el.value = ['a', 'b', 'c', 'd', 'e'];
    await el.updateComplete;
    expect(overflowTag(el)!.textContent!.trim()).to.equal(`+${new Intl.NumberFormat('ar-EG').format(2)}`);
  });
});

describe('with-clear', () => {
  it('renders no clear button until there is something to clear', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.withClear = true;
    await el.updateComplete;
    expect((clearButton(el)) === (null)).to.equal(true);

    el.value = 'b';
    await el.updateComplete;
    expect((clearButton(el)) !== (null)).to.equal(true);
  });

  it('stays absent while unset, even with a value', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.value = 'b';
    await el.updateComplete;
    expect((clearButton(el)) === (null)).to.equal(true);
  });

  it('clear() no-ops while disabled, or with nothing selected', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.withClear = true;
    await el.updateComplete;
    const clear = (): void => (el as unknown as { clear(): void }).clear();
    let clears = 0;
    el.addEventListener('lr-clear', () => clears++);

    clear();
    expect(clears, 'nothing selected to begin with').to.equal(0);

    el.value = 'a';
    el.disabled = true;
    clear();
    expect(clears, 'disabled blocks clearing even with something selected').to.equal(0);
    expect(el.value).to.equal('a');

    el.disabled = false;
    clear();
    expect(clears).to.equal(1);
    expect(el.value).to.equal('');
  });

  it('clears the selection and announces it once', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.withClear = true;
    el.value = 'b';
    await el.updateComplete;

    const seen: string[] = [];
    for (const type of ['input', 'change', 'lr-change', 'lr-clear']) {
      el.addEventListener(type, () => seen.push(type));
    }
    clearButton(el)!.click();
    await el.updateComplete;

    expect(el.value).to.equal('');
    expect(seen).to.deep.equal(['input', 'change', 'lr-change', 'lr-clear']);
    expect((clearButton(el)) === (null)).to.equal(true);
  });

  it('clears every value at once in multiple mode', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.withClear = true;
    el.value = ['a', 'b'];
    await el.updateComplete;
    clearButton(el)!.click();
    await el.updateComplete;
    expect(el.value).to.deep.equal([]);
  });

  it('does not open the listbox when the clear button is pressed', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.withClear = true;
    el.value = 'b';
    await el.updateComplete;
    clearButton(el)!.click();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });

  it('carries a localized accessible name and the shared icon-button hit-area floor', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.withClear = true;
    el.value = 'b';
    el.strings = { clear: 'Alles löschen' };
    await el.updateComplete;

    const button = clearButton(el)!;
    expect(button.getAttribute('aria-label')).to.equal('Alles löschen');
    const box = button.getBoundingClientRect();
    expect(box.width).to.be.at.least(40);
    expect(box.height).to.be.at.least(40);
  });

  it('disables the clear button alongside the rest of the control', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.withClear = true;
    el.value = 'b';
    el.disabled = true;
    await el.updateComplete;
    expect(clearButton(el)!.disabled).to.be.true;
  });

  it('reserves an inline-end band on the trigger so its content never runs under the button', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const base = getComputedStyle(trigger(el)).paddingInlineEnd;
    el.withClear = true;
    el.value = 'b';
    await el.updateComplete;
    expect(getComputedStyle(trigger(el)).paddingInlineEnd).to.equal('40px');
    expect(base).to.not.equal('40px');
  });

  it('moves the clear button to the trailing edge under RTL', async () => {
    const ltr = (await fixture(basic())) as LyraSelect;
    ltr.withClear = true;
    ltr.value = 'b';
    await ltr.updateComplete;
    const ltrTrigger = trigger(ltr).getBoundingClientRect();
    expect(clearButton(ltr)!.getBoundingClientRect().right).to.be.closeTo(ltrTrigger.right, 2);

    const wrapper = await fixture(html`
      <div dir="rtl">
        <lr-select with-clear>
          <lr-option value="a">Apple</lr-option>
          <lr-option value="b">Banana</lr-option>
        </lr-select>
      </div>
    `);
    const rtl = wrapper.querySelector('lr-select') as LyraSelect;
    rtl.value = 'b';
    await rtl.updateComplete;
    const rtlTrigger = trigger(rtl).getBoundingClientRect();
    expect(clearButton(rtl)!.getBoundingClientRect().left).to.be.closeTo(rtlTrigger.left, 2);
  });

  it('gives the clear button a :hover rule alongside its :focus-visible ring', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='clear-button'\]:hover\s*\{[^}]*color:/);
    expect(css).to.match(/\[part='clear-button'\]:focus-visible\s*\{[^}]*outline:/);
  });

  it('is accessible with the clear button rendered', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.label = 'Fruit';
    el.withClear = true;
    el.value = 'b';
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('getTag', () => {
  it('renders a consumer-supplied chip per selected option, with its index', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.getTag = (option, index) => html`<span class="custom" data-index=${index}>${option.label.toUpperCase()}</span>`;
    el.value = ['a', 'b'];
    await el.updateComplete;

    const custom = [...el.shadowRoot!.querySelectorAll('.custom')] as HTMLElement[];
    expect(custom.map((node) => node.textContent)).to.deep.equal(['APPLE', 'BANANA']);
    expect(custom.map((node) => node.dataset['index'])).to.deep.equal(['0', '1']);
    expect(el.shadowRoot!.querySelector('[part="tag-label"]')).to.equal(null);
  });

  it('renders a returned string as text, never as markup', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.getTag = () => '<b>bold</b>';
    el.value = ['a'];
    await el.updateComplete;
    const container = el.shadowRoot!.querySelector('[part="tags"]') as HTMLElement;
    expect((container.querySelector('b')) === (null)).to.equal(true);
    expect(container.textContent).to.contain('<b>bold</b>');
  });

  it('still collapses past max-options-visible', async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.getTag = (option) => option.value;
    el.maxOptionsVisible = 1;
    el.strings = { selectSelectedOverflow: '+{n}' };
    el.value = ['a', 'b', 'c'];
    await el.updateComplete;
    expect(overflowTag(el)!.textContent!.trim()).to.equal('+2');
  });
});

describe('placement', () => {
  it('defaults to mapped bottom and reflects', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    expect(el.placement).to.equal('bottom');
    await el.updateComplete;
    expect(el.getAttribute('placement')).to.equal('bottom');
  });

  it('positions the listbox above the trigger when asked to', async () => {
    const wrapper = await fixture(html`
      <div style="padding-block-start: 320px;">
        <lr-select placement="top-start">
          <lr-option value="a">Apple</lr-option>
          <lr-option value="b">Banana</lr-option>
        </lr-select>
      </div>
    `);
    const el = wrapper.querySelector('lr-select') as LyraSelect;
    el.open = true;
    await el.updateComplete;
    await aTimeout(60);

    const listbox = el.shadowRoot!.querySelector('[part="listbox"]')!.getBoundingClientRect();
    const anchor = trigger(el).getBoundingClientRect();
    expect(listbox.bottom).to.be.at.most(anchor.top + 1);
  });
});

describe('appearance and pill', () => {
  it('defaults to outlined and reflects the attribute', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    expect(el.appearance).to.equal('outlined');
    await el.updateComplete;
    expect(el.getAttribute('appearance')).to.equal('outlined');
  });

  it('fills the trigger for filled and filled-outlined, keeping the border only for the latter', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const raised = resolved(el, 'background-color', 'var(--lr-color-surface-raised)');
    const border = resolved(el, 'color', 'var(--lr-color-border)');

    el.appearance = 'filled';
    await el.updateComplete;
    expect(getComputedStyle(trigger(el)).backgroundColor).to.equal(raised);
    expect(getComputedStyle(trigger(el)).borderTopColor).to.equal('rgba(0, 0, 0, 0)');

    el.appearance = 'filled-outlined';
    await el.updateComplete;
    expect(getComputedStyle(trigger(el)).backgroundColor).to.equal(raised);
    expect(getComputedStyle(trigger(el)).borderTopColor).to.equal(border);
  });

  it('drops both the fill and the border for plain', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.appearance = 'plain';
    await el.updateComplete;
    const cs = getComputedStyle(trigger(el));
    expect(cs.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(cs.borderTopColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('paints accent with the loud brand fill and its on-brand text color', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const brand = resolved(el, 'background-color', 'var(--lr-color-brand)');
    const onBrand = resolved(el, 'color', 'var(--lr-color-on-brand)');
    el.appearance = 'accent';
    await el.updateComplete;
    const cs = getComputedStyle(trigger(el));
    expect(cs.backgroundColor).to.equal(brand);
    expect(cs.color).to.equal(onBrand);
  });

  it('rounds the trigger fully with pill, through the same radius property', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.pill = true;
    await el.updateComplete;
    expect(getComputedStyle(trigger(el)).borderRadius).to.equal('999px');
    expect(el.getAttribute('pill')).to.equal('');
  });

  it('is accessible in every appearance', async () => {
    for (const appearance of ['accent', 'filled', 'outlined', 'filled-outlined', 'plain'] as const) {
      const el = (await fixture(basic())) as LyraSelect;
      el.label = 'Fruit';
      el.appearance = appearance;
      await el.updateComplete;
      await expect(el).to.be.accessible();
    }
  });
});

describe('lr-select clear-button spelling parity', () => {
  // Mirror of the lr-input parity test: `with-clear` is Web Awesome's spelling and `clearable`
  // Shoelace's, so a select that honours only one silently loses the control for half the
  // migrations the README promises are mechanical.
  it('renders the clear button for either upstream spelling', async () => {
    for (const attribute of ['with-clear', 'clearable']) {
      const el = (await fixture(basic())) as LyraSelect;
      el.setAttribute(attribute, '');
      el.value = 'b';
      await el.updateComplete;
      expect((clearButton(el)) !== (null), attribute).to.equal(true);
    }
  });

  it('leaves the clear button absent when neither spelling is set', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.value = 'b';
    await el.updateComplete;
    expect((clearButton(el)) === (null)).to.equal(true);
  });
});

describe('lr-select — the shared size ladder', () => {
  const trigger = (el: LyraSelect) => el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  const height = (el: LyraSelect) => trigger(el).getBoundingClientRect().height;

  it('renders the Web Awesome size spellings at the same geometry as the canonical steps', async () => {
    for (const [alias, step] of [['small', 's'], ['medium', 'm'], ['large', 'l']] as const) {
      const aliasEl = (await fixture(html`<lr-select size=${alias}></lr-select>`)) as LyraSelect;
      const stepEl = (await fixture(html`<lr-select size=${step}></lr-select>`)) as LyraSelect;
      expect(height(aliasEl), `size=${alias} height`).to.equal(height(stepEl));
      expect(getComputedStyle(trigger(aliasEl)).fontSize, `size=${alias} font-size`).to.equal(
        getComputedStyle(trigger(stepEl)).fontSize,
      );
      expect(getComputedStyle(trigger(aliasEl)).paddingTop, `size=${alias} padding-block`).to.equal(
        getComputedStyle(trigger(stepEl)).paddingTop,
      );
    }
  });

  it('sits at the shared form-control height at every tier', async () => {
    const expected: Record<string, number> = { '2xs': 20, xs: 24, s: 30, m: 40, l: 48, xl: 56 };
    for (const [size, px] of Object.entries(expected)) {
      const el = (await fixture(html`<lr-select size=${size}></lr-select>`)) as LyraSelect;
      expect(height(el), `size=${size}`).to.equal(px);
    }
  });
});

// `internals.states` (CustomStateSet) reached Chromium 125 / Safari 17.4 / Firefox 126, and the
// `:state()` SELECTOR landed separately from the API. Both are guarded because the helper no-ops
// where either is missing -- an unguarded assertion fails on WebKit rather than skipping.
const supportsCustomStates = (() => {
  try {
    return typeof CustomStateSet === 'function';
  } catch {
    return false;
  }
})();
const supportsStateSelector = (() => {
  try {
    document.createElement('div').matches(':state(x)');
    return true;
  } catch {
    return false;
  }
})();

describe('lr-select validity custom states', () => {
  const required = () => html`
    <lr-select required>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>
  `;

  it('publishes required/optional and valid/invalid from the first render', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(required())) as LyraSelect;
    await el.updateComplete;
    expect(el.matches(':state(required)'), 'required').to.be.true;
    expect(el.matches(':state(optional)'), 'optional').to.be.false;
    expect(el.matches(':state(invalid)'), 'invalid').to.be.true;
    expect(el.matches(':state(valid)'), 'valid').to.be.false;

    const optional = (await fixture(basic())) as LyraSelect;
    await optional.updateComplete;
    expect(optional.matches(':state(optional)')).to.be.true;
    expect(optional.matches(':state(valid)')).to.be.true;
  });

  it('withholds user-valid/user-invalid until the user has actually interacted', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(required())) as LyraSelect;
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'pristine required must not read as an error').to.be
      .false;

    el.reportValidity();
    expect(el.matches(':state(user-invalid)'), 'a submit attempt counts as interaction').to.be.true;

    el.value = 'a';
    await el.updateComplete;
    expect(el.matches(':state(valid)')).to.be.true;
    expect(el.matches(':state(user-valid)')).to.be.true;
    expect(el.matches(':state(user-invalid)')).to.be.false;
  });

  it('goes pristine again after a form reset', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = await fixture<HTMLFormElement>(html`
      <form>
        <lr-select name="fruit" required>
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      </form>
    `);
    const el = form.querySelector('lr-select') as LyraSelect;
    await el.updateComplete;
    el.reportValidity();
    expect(el.matches(':state(user-invalid)')).to.be.true;
    form.reset();
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'reset returns the control to pristine').to.be.false;
    expect(el.matches(':state(invalid)')).to.be.true;
  });
});

describe('lr-select setCustomValidity()', () => {
  const inForm = () => html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    </form>
  `;

  it('blocks form submission with a consumer-supplied error, and reports it as validationMessage', async () => {
    const form = (await fixture(inForm())) as HTMLFormElement;
    const el = form.querySelector('lr-select') as LyraSelect;
    await el.updateComplete;
    let submits = 0;
    // Registered before any requestSubmit() below, so a successful submission can never navigate
    // the test page.
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits += 1;
    });
    expect(el.checkValidity(), 'valid before the custom error').to.be.true;

    el.setCustomValidity('That fruit is out of stock.');
    expect(el.validity.customError).to.be.true;
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.equal('That fruit is out of stock.');
    form.requestSubmit();
    expect(submits, 'a custom error blocks submission').to.equal(0);

    el.resetValidity();
    expect(el.validity.customError).to.be.false;
    expect(el.validationMessage).to.equal('');
    form.requestSubmit();
    expect(submits, 'submission is unblocked once the custom error is cleared').to.equal(1);
  });

  it('keeps a custom error through an intrinsic revalidation', async () => {
    const el = (await fixture(html`
      <lr-select required><lr-option value="a">Apple</lr-option></lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    el.setCustomValidity('Rejected by the server.');

    // Selecting a value re-runs updateValidity(), the traffic that would otherwise wipe the
    // custom error out on every interaction.
    el.value = 'a';
    await el.updateComplete;
    expect(el.validity.valueMissing, 'the intrinsic error cleared').to.be.false;
    expect(el.validity.customError, 'the custom error survived the recomputation').to.be.true;
    expect(el.validationMessage).to.equal('Rejected by the server.');
    expect(el.checkValidity()).to.be.false;
  });

  it('keeps a custom error across a form reset, matching native setCustomValidity semantics', async () => {
    // Native `form.reset()` restores value and pristine-ness but never clears a consumer-set
    // custom error -- only another `setCustomValidity('')` does. This control matches.
    const form = (await fixture(html`
      <form>
        <lr-select name="fruit">
          <lr-option value="a" selected>Apple</lr-option>
          <lr-option value="b">Banana</lr-option>
        </lr-select>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-select') as LyraSelect;
    await el.updateComplete;
    el.value = 'b';
    el.setCustomValidity('Already chosen by this order.');

    form.reset();
    await el.updateComplete;
    expect(el.value, 'the reset restored the declarative default').to.equal('a');
    expect(el.validity.customError, 'the custom error outlives the reset').to.be.true;
    expect(el.validationMessage).to.equal('Already chosen by this order.');
    expect(el.checkValidity()).to.be.false;
  });

  it('restores the computed validity when cleared, rather than forcing the control valid', async () => {
    const el = (await fixture(html`
      <lr-select required><lr-option value="a">Apple</lr-option></lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'required and unselected to begin with').to.be.true;

    el.setCustomValidity('Rejected by the server.');
    expect(el.validity.customError).to.be.true;

    el.setCustomValidity('');
    expect(el.validity.customError).to.be.false;
    expect(el.validity.valueMissing, 'an unselected required control is still missing a value').to.be.true;
    expect(el.checkValidity(), 'clearing must not force the control valid').to.be.false;
    expect(el.validationMessage.length, 'the intrinsic message is republished').to.be.greaterThan(0);
  });

  it('publishes the custom error through the validity custom states', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(basic())) as LyraSelect;
    await el.updateComplete;
    expect(el.matches(':state(valid)'), 'valid before the custom error').to.be.true;

    el.setCustomValidity('Rejected by the server.');
    expect(el.matches(':state(invalid)'), 'invalid synchronously, not on the next Lit update').to.be.true;
    expect(el.matches(':state(valid)')).to.be.false;
    expect(el.matches(':state(user-invalid)'), 'still pristine until the user has a turn').to.be.false;

    el.reportValidity();
    expect(el.matches(':state(user-invalid)'), 'a reported validation counts as interaction').to.be.true;

    el.setCustomValidity('');
    expect(el.matches(':state(valid)')).to.be.true;
    expect(el.matches(':state(user-valid)')).to.be.true;
    expect(el.matches(':state(user-invalid)')).to.be.false;
  });

  it('treats a nullish message the same as the empty string, for non-TS callers', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    await el.updateComplete;
    (el as unknown as { setCustomValidity(message?: string | null): void }).setCustomValidity(undefined);
    expect(el.validity.customError).to.be.false;
    expect(el.validationMessage).to.equal('');
  });
});

describe('lr-select hover and press feedback', () => {
  const centerOf = (node: Element): [number, number] => {
    const rect = node.getBoundingClientRect();
    return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
  };

  // --lr-transition-fast is zeroed on each fixture: the trigger transitions its background, so
  // reading getComputedStyle one frame after the pointer arrives would otherwise catch the
  // INTERPOLATED colour -- still the resting one at t=0 -- and report a working hover as broken.
  for (const appearance of ['outlined', 'filled', 'accent'] as const) {
    it(`presses an appearance="${appearance}" trigger deeper than it hovers it`, async () => {
      const el = (await fixture(html`
        <lr-select appearance=${appearance} style="--lr-transition-fast: 0s">
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      `)) as LyraSelect;
      await el.updateComplete;
      const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
      const resting = getComputedStyle(trigger).backgroundColor;
      try {
        await sendMouse({ type: 'move', position: centerOf(trigger) });
        const hovered = getComputedStyle(trigger).backgroundColor;
        expect(hovered, `${appearance} hover vs resting`).to.not.equal(resting);
        await sendMouse({ type: 'down' });
        expect(getComputedStyle(trigger).backgroundColor, `${appearance} pressed vs hovered`).to.not.equal(
          hovered,
        );
      } finally {
        await sendMouse({ type: 'up' });
        await resetMouse();
      }
    });
  }

  it('themes trigger hover, pressed, and open border paint through component hooks', async () => {
    const el = (await fixture(html`
      <lr-select
        open
        style="
          --lr-transition-fast: 0s;
          --lr-select-trigger-hover-bg: rgb(1, 2, 3);
          --lr-select-trigger-active-bg: rgb(4, 5, 6);
          --lr-select-open-border-color: rgb(7, 8, 9);
        "
      >
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const trigger = el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
    expect(getComputedStyle(trigger).borderTopColor).to.equal('rgb(7, 8, 9)');
    try {
      await sendMouse({ type: 'move', position: centerOf(trigger) });
      expect(getComputedStyle(trigger).backgroundColor).to.equal('rgb(1, 2, 3)');
      await sendMouse({ type: 'down' });
      expect(getComputedStyle(trigger).backgroundColor).to.equal('rgb(4, 5, 6)');
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });
});

describe('lr-select mapped Select parity surface', () => {
  it('exposes defaultValue and a writable selectedOptions snapshot', async () => {
    const el = (await fixture(html`
      <lr-select default-value="b">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect & { defaultValue: string | string[]; selectedOptions: LyraOption[] };
    await el.updateComplete;
    expect(el.defaultValue).to.equal('b');
    expect(el.value).to.equal('b');
    expect(el.selectedOptions.map((option) => option.value)).to.deep.equal(['b']);
    el.value = 'a';
    el.formResetCallback();
    expect(el.value).to.equal('b');
  });

  it('accepts a direct defaultValue property write in both single and multiple shapes', async () => {
    const el = (await fixture(html`
      <lr-select>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect & { defaultValue: string | string[] };
    await el.updateComplete;
    expect(el.defaultValue).to.equal('');

    // Array input in single mode keeps only the first entry.
    el.defaultValue = ['a', 'b'];
    await el.updateComplete;
    expect(el.defaultValue).to.equal('a');
    expect(el.value).to.equal('a');

    // Falsy input clears it back to the empty string.
    el.defaultValue = '';
    await el.updateComplete;
    expect(el.defaultValue).to.equal('');
    expect(el.value).to.equal('');

    el.multiple = true;
    await el.updateComplete;
    // A plain string in multiple mode becomes a one-element array.
    el.defaultValue = 'b';
    await el.updateComplete;
    expect(el.defaultValue).to.deep.equal(['b']);
    expect(el.value).to.deep.equal(['b']);
  });

  it('treats a non-array selectedOptions write as an empty selection', async () => {
    const el = (await fixture(html`<lr-select><lr-option value="a">Apple</lr-option></lr-select>`)) as LyraSelect;
    await el.updateComplete;
    el.value = 'a';
    await el.updateComplete;
    expect(el.value).to.equal('a');

    (el as unknown as { selectedOptions: unknown }).selectedOptions = null;
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(el.selectedOptions).to.deep.equal([]);
  });

  it('falls back to the raw value when a programmatic value has no matching option', async () => {
    const el = (await fixture(html`<lr-select><lr-option value="a">Apple</lr-option></lr-select>`)) as LyraSelect;
    await el.updateComplete;
    el.value = 'ghost';
    await el.updateComplete;
    const display = el.shadowRoot!.querySelector('[part="display-input"]') as HTMLElement;
    expect(display.textContent!.trim()).to.equal('ghost');
  });

  it('commits live selectedOptions occurrences silently and keeps returned arrays detached', async () => {
    const el = (await fixture(html`
      <lr-select multiple name="fruit">
        <lr-option value="same">First occurrence</lr-option>
        <lr-option value="same">Second occurrence</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const [first, second, banana] = [...el.querySelectorAll('lr-option')] as LyraOption[];
    const events: string[] = [];
    el.addEventListener('input', () => events.push('input'));
    el.addEventListener('change', () => events.push('change'));

    el.selectedOptions = [second, banana];
    await el.updateComplete;

    expect(el.value).to.deep.equal(['same', 'b']);
    expect(el.selectedOptions).to.deep.equal([second, banana]);
    expect([first.selected, second.selected, banana.selected]).to.deep.equal([false, true, true]);
    expect(events).to.deep.equal([]);

    const snapshot = el.selectedOptions;
    snapshot.length = 0;
    expect(el.selectedOptions).to.deep.equal([second, banana]);

    const foreign = document.createElement('lr-option') as LyraOption;
    foreign.value = 'foreign';
    first.remove();
    el.selectedOptions = [foreign, first];
    await el.updateComplete;
    expect(el.value).to.deep.equal([]);
    expect(el.selectedOptions).to.deep.equal([]);

    el.multiple = false;
    await el.updateComplete;
    el.selectedOptions = [banana, second];
    await el.updateComplete;
    expect(el.value).to.equal('b');
    expect(el.selectedOptions).to.deep.equal([banana]);
  });

  it('renders legal removable multi-value tags with every mapped subpart', async () => {
    const el = (await fixture(html`
      <lr-select multiple .value=${['a', 'b']}>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect & { selectedOptions: LyraOption[] };
    await el.updateComplete;
    const remove = el.shadowRoot!.querySelector('[part~="tag__remove-button"]') as HTMLButtonElement;
    expect((remove) != null).to.equal(true);
    expect(remove.closest('button[part~="trigger"]')).to.equal(null);
    expect(el.shadowRoot!.querySelector('[part~="tag__base"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part~="tag__content"]')).to.exist;
    remove.click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(['b']);
    expect(el.selectedOptions.map((option) => option.value)).to.deep.equal(['b']);
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('part')).to.contain(
      'tag__remove-button',
    );
  });

  it('accepts hoist/filled/help-text/prefix/suffix aliases and clear/expand icon slots', async () => {
    const el = (await fixture(html`
      <lr-select hoist filled help-text="Alias hint" with-clear value="a">
        <span slot="prefix">P</span><span slot="suffix">S</span>
        <span slot="clear-icon">clear</span><span slot="expand-icon">expand</span>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect & { hoist: boolean; filled: boolean; helpText: string };
    expect(el.hoist).to.be.true;
    expect(el.filled).to.be.true;
    const prefix = el.shadowRoot!.querySelector('slot[part="prefix"]') as HTMLSlotElement;
    const suffix = el.shadowRoot!.querySelector('slot[part="suffix"]') as HTMLSlotElement;
    expect(prefix.assignedElements()[0]?.textContent).to.equal('P');
    expect(suffix.assignedElements()[0]?.textContent).to.equal('S');
    expect(el.shadowRoot!.querySelector('[part~="form-control-help-text"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part~="hint"]')?.textContent).to.contain('Alias hint');
    const clear = el.shadowRoot!.querySelector('slot[name="clear-icon"]') as HTMLSlotElement;
    const expand = el.shadowRoot!.querySelector('slot[name="expand-icon"]') as HTMLSlotElement;
    expect(clear.assignedElements()[0]?.textContent).to.equal('clear');
    expect(expand.assignedElements()[0]?.textContent).to.equal('expand');
    await el.show();
    expect((el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement).style.position).to.equal('fixed');
  });

  it('forwards autofocus/title and reflects the blank custom state', async () => {
    const el = (await fixture(html`
      <lr-select autofocus title="Choose fruit"><lr-option value="a">Apple</lr-option></lr-select>
    `)) as LyraSelect;
    const button = trigger(el);
    expect(button.autofocus).to.be.true;
    expect(button.title).to.equal('Choose fruit');
    expect(el.matches(':state(blank)')).to.be.true;
    el.value = 'a';
    await el.updateComplete;
    expect(el.matches(':state(blank)')).to.be.false;
  });

  it('returns promises that settle after matching after-events', async () => {
    const el = (await fixture(basic())) as LyraSelect & {
      show(): Promise<void>;
      hide(): Promise<void>;
    };
    const seen: string[] = [];
    el.addEventListener('lr-show', () => seen.push('show'));
    el.addEventListener('lr-after-show', () => seen.push('after-show'));
    await el.show();
    expect(seen).to.deep.equal(['show', 'after-show']);
    el.addEventListener('lr-hide', () => seen.push('hide'));
    el.addEventListener('lr-after-hide', () => seen.push('after-hide'));
    await el.hide();
    expect(seen).to.deep.equal(['show', 'after-show', 'hide', 'after-hide']);
  });

  it('renders a large option set through the delegated listbox path', async () => {
    const el = document.createElement('lr-select') as LyraSelect;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 1000; index++) {
      const option = document.createElement('lr-option') as LyraOption;
      option.value = String(index);
      option.textContent = `Option ${index}`;
      fragment.append(option);
    }
    el.append(fragment);
    const started = performance.now();
    document.body.append(el);
    await el.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(el.shadowRoot!.querySelectorAll('[part="option"]')).to.have.lengthOf(1000);
    expect(performance.now() - started).to.be.below(3000);
    el.remove();
  });
});

it('bars constraint validation while disabled, like a native disabled required control', async () => {
  const el = (await fixture(html`
    <lr-select required disabled label="Fruit"><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(el.validity.valueMissing, 'a barred control raises no violation').to.be.false;
  expect(el.checkValidity()).to.be.true;

  el.disabled = false;
  await el.updateComplete;
  expect(el.validity.valueMissing, 'the violation returns once it is enforceable again').to.be.true;
});

it('renders the required marker from the shared themeable rule', async () => {
  const el = (await fixture(html`
    <lr-select required label="Fruit"><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part~="form-control-label"]') as HTMLElement;
  expect(getComputedStyle(label, '::after').content).to.contain('*');

  el.style.setProperty('--lr-form-control-required-content', "''");
  await el.updateComplete;
  expect(getComputedStyle(label, '::after').content).to.not.contain('*');
});

it('skips inert options when moving the active descendant', async () => {
  const el = (await fixture(html`
    <lr-select label="Fruit">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" inert>Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part~="trigger"]') as HTMLElement;
  const press = (key: string): void => {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  };
  // From the pristine -1 index the first ArrowDown lands on Apple; the second must skip the inert
  // Banana entirely rather than making it the active descendant.
  press('ArrowDown');
  await el.updateComplete;
  press('ArrowDown');
  await el.updateComplete;
  press('Enter');
  await el.updateComplete;
  expect(el.value, 'the inert option is never a navigation stop').to.equal('c');
});
