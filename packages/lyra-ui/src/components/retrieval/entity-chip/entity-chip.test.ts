import { fixture, expect, html, oneEvent, aTimeout, waitUntil } from '@open-wc/testing';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './entity-chip.js';
import type { LyraEntityChip } from './entity-chip.js';

it('defaults to empty entityId/text/type and no typeLabel', async () => {
  const el = (await fixture(
    html`<lr-entity-chip></lr-entity-chip>`
  )) as LyraEntityChip;
  expect(el.entityId).to.equal('');
  expect(el.text).to.equal('');
  expect(el.type).to.equal('');
  expect(el.typeLabel).to.equal(undefined);
});

it('renders the text as its visible content, not entityId', async () => {
  const el = (await fixture(
    html`<lr-entity-chip entity-id="e17" text="Marie Curie"></lr-entity-chip>`
  )) as LyraEntityChip;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal(
    'Marie Curie'
  );
});

it('emits lr-entity-select on click with the entityId', async () => {
  const el = (await fixture(
    html`<lr-entity-chip entity-id="e17" text="Marie Curie"></lr-entity-chip>`
  )) as LyraEntityChip;
  const button = el.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLButtonElement;
  const listener = oneEvent(el, 'lr-entity-select');
  button.click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ entityId: 'e17' });
});

it('fires lr-entity-select exactly once from one click', async () => {
  const el = (await fixture(
    html`<lr-entity-chip entity-id="e17" text="Marie Curie"></lr-entity-chip>`
  )) as LyraEntityChip;
  const button = el.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLButtonElement;
  let selectCount = 0;
  el.addEventListener('lr-entity-select', () => {
    selectCount++;
  });
  button.click();
  await el.updateComplete;
  expect(selectCount).to.equal(1);
});

it('does not emit lr-entity-select on dblclick (only lr-entity-open)', async () => {
  const el = (await fixture(
    html`<lr-entity-chip entity-id="e17" text="Marie Curie"></lr-entity-chip>`
  )) as LyraEntityChip;
  const button = el.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLButtonElement;
  let selectCount = 0;
  el.addEventListener('lr-entity-select', () => selectCount++);
  const listener = oneEvent(el, 'lr-entity-open');
  button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  await listener;
  expect(selectCount).to.equal(0);
});

it('keeps the compact inline entity target at the live hit-area token override', async () => {
  const el = (await fixture(
    html`<lr-entity-chip
      text="X"
      style="--lr-icon-button-size:52px"
    ></lr-entity-chip>`
  )) as LyraEntityChip;
  const bounds = (
    el.shadowRoot!.querySelector('[part="base"]') as HTMLElement
  ).getBoundingClientRect();
  expect(bounds.width).to.be.at.least(52);
  expect(bounds.height).to.be.at.least(52);
});

it('emits lr-entity-open on dblclick, and on Space while focused', async () => {
  const el = (await fixture(
    html`<lr-entity-chip entity-id="e17" text="Marie Curie"></lr-entity-chip>`
  )) as LyraEntityChip;
  const button = el.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLButtonElement;
  const listener = oneEvent(el, 'lr-entity-open');
  button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const event = await listener;
  expect(event.detail).to.deep.equal({ entityId: 'e17' });

  const listener2 = oneEvent(el, 'lr-entity-open');
  button.dispatchEvent(
    new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true })
  );
  const event2 = await listener2;
  expect(event2.detail).to.deep.equal({ entityId: 'e17' });
});

it('computes an accessible name including the (typeLabel-preferred) type when set', async () => {
  const el = (await fixture(
    html`<lr-entity-chip
      text="Marie Curie"
      type="person"
      type-label="Person"
    ></lr-entity-chip>`
  )) as LyraEntityChip;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('Marie Curie, Person');

  el.typeLabel = undefined;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('Marie Curie, person');
});

it('keeps explicit-empty and dynamic host naming distinct from the entity button', async () => {
  const el = (await fixture(html`
    <lr-entity-chip
      aria-label="Author entity"
      text="Marie Curie"
      type="person"
    ></lr-entity-chip>
  `)) as LyraEntityChip;
  const button = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(el.getAttribute('aria-label')).to.equal('Author entity');
  expect(button.getAttribute('aria-label')).to.equal('Marie Curie, person');
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('');
  expect(button.getAttribute('aria-label')).to.equal('Marie Curie, person');
  el.setAttribute('aria-label', 'Revised entity');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Revised entity');
  expect(button.getAttribute('aria-label')).to.equal('Marie Curie, person');
});

it('falls back to the localized untitled-entity name when `text` is unset, so the button is never nameless', async () => {
  const el = (await fixture(
    html`<lr-entity-chip entity-id="e1"></lr-entity-chip>`
  )) as LyraEntityChip;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('Untitled entity');
});

it('uses the localized untitled fallback before composing a type instead of producing a leading comma', async () => {
  const el = (await fixture(html`
    <lr-entity-chip
      type='person'
      type-label='Personne'
      .strings=${{
        untitledEntity: 'Entité sans titre',
        entityChipWithType: '{label} ({type})',
      }}
    ></lr-entity-chip>
  `)) as LyraEntityChip;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('Entité sans titre (Personne)');
});

it('localizes the "{label}, {type}" accessible name via this.localize() when .strings overrides entityChipWithType', async () => {
  const el = (await fixture(html`
    <lr-entity-chip
      text="Marie Curie"
      type="person"
      type-label="Personne"
      .strings=${{ entityChipWithType: '{label} ({type})' }}
    ></lr-entity-chip>
  `)) as LyraEntityChip;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('Marie Curie (Personne)');
});

it('localizes the untitled-entity fallback via this.localize() when .strings overrides untitledEntity', async () => {
  const el = (await fixture(html`
    <lr-entity-chip
      entity-id="e1"
      .strings=${{ untitledEntity: 'Entité sans titre' }}
    ></lr-entity-chip>
  `)) as LyraEntityChip;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('Entité sans titre');
});

it('reflects type as a host attribute for CSS theming', async () => {
  const el = (await fixture(
    html`<lr-entity-chip type="person"></lr-entity-chip>`
  )) as LyraEntityChip;
  expect(el.getAttribute('type')).to.equal('person');
});

it('shows no popover/hover affordance when the default slot is empty', async () => {
  const el = (await fixture(
    html`<lr-entity-chip text="Marie Curie"></lr-entity-chip>`
  )) as LyraEntityChip;
  const button = el.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLButtonElement;
  expect(button.hasAttribute('aria-describedby')).to.be.false;
  el.dispatchEvent(
    new Event('pointerenter', { bubbles: true, composed: true })
  );
  await aTimeout(10);
  expect(
    (
      el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement
    ).hasAttribute('hidden')
  ).to.be.true;
});

it('shows the popover on hover when preview content is slotted, and hides it on Escape', async () => {
  const el = (await fixture(
    html`<lr-entity-chip text="Marie Curie"
      >Physicist, 1867-1934</lr-entity-chip
    >`
  )) as LyraEntityChip;
  await el.updateComplete;
  const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement;
  wrapper.dispatchEvent(new Event('pointerenter', { bubbles: true }));
  await el.updateComplete;
  expect(
    (
      el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement
    ).hasAttribute('hidden')
  ).to.be.false;
  wrapper.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  await el.updateComplete;
  expect(
    (
      el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement
    ).hasAttribute('hidden')
  ).to.be.true;
});

it('force-closes an already-open preview when its content is removed from the slot', async () => {
  const el = (await fixture(
    html`<lr-entity-chip text="Marie Curie"
      ><p>Physicist, 1867-1934</p></lr-entity-chip
    >`
  )) as LyraEntityChip;
  const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement;
  const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
  wrapper.dispatchEvent(new Event('pointerenter', { bubbles: true }));
  await el.updateComplete;
  expect(popover.hasAttribute('hidden'), 'precondition: popover is open').to.be
    .false;

  el.querySelector('p')!.remove();
  // slotchange fires asynchronously after the light-DOM mutation.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await el.updateComplete;

  expect(
    popover.hasAttribute('hidden'),
    'popover must close once its preview content is emptied out from under it'
  ).to.be.true;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.hasAttribute(
      'aria-describedby'
    ),
    'and the emptied popover must stop being advertised as the description'
  ).to.be.false;
});

it('gains the hover affordance when preview content arrives after the first render', async () => {
  const el = (await fixture(
    html`<lr-entity-chip text="Marie Curie"></lr-entity-chip>`
  )) as LyraEntityChip;
  const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  expect(button.hasAttribute('aria-describedby')).to.be.false;

  el.append(document.createTextNode('Physicist, 1867-1934'));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await el.updateComplete;

  expect(
    button.getAttribute('aria-describedby'),
    'bare slotted text added later still counts as real preview content'
  ).to.equal(
    (el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement).id
  );
});

it('is accessible with and without preview content', async () => {
  const el = (await fixture(
    html`<lr-entity-chip text="Marie Curie" type="person"></lr-entity-chip>`
  )) as LyraEntityChip;
  await expect(el).to.be.accessible();
  el.innerHTML = 'Physicist';
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('clamps its floating surface width through the shared popover-viewport-clamp token', async () => {
  const el = (await fixture(
    html`<lr-entity-chip
      entity-id="marie"
      text="Marie Curie"
      style="--lr-popover-viewport-clamp: 10px"
      >Physicist</lr-entity-chip
    >`
  )) as LyraEntityChip;
  const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  button.focus();
  await waitUntil(
    () => !(el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement).hidden
  );
  const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
  await waitUntil(() => getComputedStyle(popover).maxInlineSize === '10px');
  expect(getComputedStyle(popover).maxInlineSize).to.equal('10px');
});

it('resets the open preview popover on disconnect so a reparent reconnect never leaves it stuck open', async () => {
  const el = (await fixture(
    html`<lr-entity-chip text="Marie Curie"
      >Physicist, 1867-1934</lr-entity-chip
    >`
  )) as LyraEntityChip;
  const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement;
  wrapper.dispatchEvent(new Event('pointerenter', { bubbles: true }));
  await el.updateComplete;
  expect(
    (
      el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement
    ).hasAttribute('hidden')
  ).to.be.false;

  // Reparent: disconnect immediately followed by reconnect (e.g. drag-drop reparent,
  // virtualized list reordering).
  const parent = el.parentElement!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;

  const popoverAfterReconnect = el.shadowRoot!.querySelector(
    '[part="popover"]'
  ) as HTMLElement;
  expect(popoverAfterReconnect.hasAttribute('hidden')).to.be.true;
});

it('keeps rich tooltip content non-interactive', async () => {
  const el = (await fixture(
    html`<lr-entity-chip text="Marie"
      ><button>Unexpected action</button></lr-entity-chip
    >`
  )) as LyraEntityChip;
  expect(
    (el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement).inert
  ).to.be.true;
});

// -- Hover/focus preview lifecycle ------------------------------------------
// The preview is shared by pointer and keyboard: leaving only schedules the hide, so a chip that
// is still focused (or still hovered) keeps it open until both are released.

describe('preview show/hide across pointer and focus', () => {
  const chip = (): Promise<LyraEntityChip> =>
    fixture(
      html`<lr-entity-chip text="Marie Curie"
        >Physicist, 1867-1934</lr-entity-chip
      >`
    ) as Promise<LyraEntityChip>;
  const hidden = (el: LyraEntityChip): boolean =>
    (
      el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement
    ).hasAttribute('hidden');
  const wrapper = (el: LyraEntityChip): HTMLElement =>
    el.shadowRoot!.querySelector('.wrapper') as HTMLElement;

  it('pointerleave schedules the hide rather than closing immediately', async () => {
    const el = await chip();
    wrapper(el).dispatchEvent(new Event('pointerenter', { bubbles: true }));
    await el.updateComplete;
    expect(hidden(el)).to.be.false;

    wrapper(el).dispatchEvent(new Event('pointerleave', { bubbles: true }));
    await el.updateComplete;
    expect(hidden(el), 'still open during the grace delay').to.be.false;

    await aTimeout(320);
    await el.updateComplete;
    expect(hidden(el), 'closes once the delay elapses').to.be.true;
  });

  it('focusin opens the preview and focusout closes it when not hovered', async () => {
    const el = await chip();
    wrapper(el).dispatchEvent(new Event('focusin', { bubbles: true }));
    await el.updateComplete;
    expect(hidden(el)).to.be.false;

    wrapper(el).dispatchEvent(new Event('focusout', { bubbles: true }));
    await el.updateComplete;
    expect(hidden(el), 'focusout with no hover closes immediately').to.be.true;
  });

  it('keeps the preview open on focusout while the pointer is still over the chip', async () => {
    const el = await chip();
    wrapper(el).dispatchEvent(new Event('pointerenter', { bubbles: true }));
    wrapper(el).dispatchEvent(new Event('focusin', { bubbles: true }));
    await el.updateComplete;
    expect(hidden(el)).to.be.false;

    wrapper(el).dispatchEvent(new Event('focusout', { bubbles: true }));
    await el.updateComplete;
    expect(hidden(el), 'hover still holds it open').to.be.false;
  });

  it('keeps the preview open on pointerleave while the chip still has focus', async () => {
    const el = await chip();
    wrapper(el).dispatchEvent(new Event('focusin', { bubbles: true }));
    wrapper(el).dispatchEvent(new Event('pointerenter', { bubbles: true }));
    await el.updateComplete;
    wrapper(el).dispatchEvent(new Event('pointerleave', { bubbles: true }));
    await aTimeout(320);
    await el.updateComplete;
    expect(hidden(el), 'focus still holds it open past the hide delay').to.be
      .false;
  });

  it('does nothing on pointerleave when there is no preview content at all', async () => {
    const el = (await fixture(
      html`<lr-entity-chip text="Marie Curie"></lr-entity-chip>`
    )) as LyraEntityChip;
    await el.updateComplete;
    wrapper(el).dispatchEvent(new Event('pointerenter', { bubbles: true }));
    wrapper(el).dispatchEvent(new Event('pointerleave', { bubbles: true }));
    await el.updateComplete;
    expect(hidden(el)).to.be.true;
  });
});

describe('disabled affordance (an entity-less chip)', () => {
  const base = (el: LyraEntityChip): HTMLButtonElement =>
    el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;

  const center = (node: Element): [number, number] => {
    const rect = node.getBoundingClientRect();
    return [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
  };

  it('paints and feels disabled while an enabled sibling keeps its hover and press feedback', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <lr-entity-chip entity-id="e17" text="Marie Curie"></lr-entity-chip>
        <lr-entity-chip text="Marie Curie"></lr-entity-chip>
      </div>
    `);
    const chips = [...wrapper.querySelectorAll('lr-entity-chip')];
    const enabled = chips[0]!;
    const disabled = chips[1]!;
    await enabled.updateComplete;
    await disabled.updateComplete;
    const enabledBase = base(enabled);
    const disabledBase = base(disabled);
    // entity-id is public and omitting it IS the disabled state, so this is reachable by any
    // consumer -- and the button really is disabled. What follows asserts the rendered result,
    // because the IDL flag alone was true the whole time the chip looked and felt enabled.
    expect(enabledBase.disabled).to.be.false;
    expect(disabledBase.disabled).to.be.true;

    expect(getComputedStyle(enabledBase).cursor).to.equal('pointer');
    expect(getComputedStyle(disabledBase).cursor).to.equal('not-allowed');
    expect(Number(getComputedStyle(enabledBase).opacity)).to.equal(1);
    expect(Number(getComputedStyle(disabledBase).opacity)).to.be.lessThan(1);

    const enabledResting = getComputedStyle(enabledBase).backgroundColor;
    const disabledResting = getComputedStyle(disabledBase).backgroundColor;
    try {
      await resetMouse();
      await sendMouse({ type: 'move', position: center(enabledBase) });
      await waitUntil(
        () => getComputedStyle(enabledBase).backgroundColor !== enabledResting,
        'an enabled chip must still light up under the pointer',
      );
      const enabledHover = getComputedStyle(enabledBase).backgroundColor;
      await sendMouse({ type: 'down' });
      await waitUntil(
        () => getComputedStyle(enabledBase).backgroundColor !== enabledHover,
        'an enabled chip must still darken under a press',
      );
      await sendMouse({ type: 'up' });

      await sendMouse({ type: 'move', position: center(disabledBase) });
      await waitUntil(
        () => getComputedStyle(enabledBase).backgroundColor === enabledResting,
        'the pointer should have left the enabled chip',
      );
      expect(
        getComputedStyle(disabledBase).backgroundColor,
        'a disabled chip must not light up under the pointer',
      ).to.equal(disabledResting);
      await sendMouse({ type: 'down' });
      expect(
        getComputedStyle(disabledBase).backgroundColor,
        'a disabled chip must not react to a press either',
      ).to.equal(disabledResting);
      await sendMouse({ type: 'up' });
    } finally {
      await resetMouse();
    }
  });
});
