import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './conversation-item.js';
import type { LyraConversationItem } from './conversation-item.js';

// The selectable region -- `role="option"`, click/keydown handlers, and
// (while not renaming) aria-selected/aria-label -- lives on `[part="option"]`,
// not `[part="base"]` (a plain layout wrapper). See the class doc's
// nested-interactive note for why the rename button and `actions` slot are
// siblings of this element rather than descendants of it.
function optionEl(el: LyraConversationItem): HTMLElement {
  return el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
}

// `role="option"` requires a `listbox`/`group` ancestor (axe's
// aria-required-parent) -- exactly the context a real consuming list (this
// component's future `lyra-virtual-list` sibling, or a plain wrapper as
// here) supplies. See the class doc's "role='option' (not 'button')" note.
async function fixtureInListbox(item: import('lit').TemplateResult): Promise<LyraConversationItem> {
  const wrapper = (await fixture(html`<div role="listbox" aria-label="Conversations">${item}</div>`)) as HTMLElement;
  return wrapper.querySelector('lyra-conversation-item') as LyraConversationItem;
}

it('defaults to title="", excerpt="", active=false, editable=true', async () => {
  const el = (await fixture(html`<lyra-conversation-item></lyra-conversation-item>`)) as LyraConversationItem;
  expect(el.title).to.equal('');
  expect(el.excerpt).to.equal('');
  expect(el.active).to.be.false;
  expect(el.editable).to.be.true;
  expect(el.hasAttribute('active')).to.be.false;
  expect(el.hasAttribute('editable')).to.be.true;
});

it('renders role="option" and a tabindex of 0', async () => {
  const el = (await fixture(html`<lyra-conversation-item title="A"></lyra-conversation-item>`)) as LyraConversationItem;
  const b = optionEl(el);
  expect(b.getAttribute('role')).to.equal('option');
  expect(b.getAttribute('tabindex')).to.equal('0');
});

it('falls back to "Untitled conversation" when title is empty', async () => {
  const el = (await fixture(html`<lyra-conversation-item></lyra-conversation-item>`)) as LyraConversationItem;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.equal('Untitled conversation');
  expect(optionEl(el).getAttribute('aria-label')).to.equal('Untitled conversation');
});

it('renders the given title, with a title tooltip attribute for the full text', async () => {
  const el = (await fixture(
    html`<lyra-conversation-item title="Migrating the table component"></lyra-conversation-item>`,
  )) as LyraConversationItem;
  const titlePart = el.shadowRoot!.querySelector('[part="title"]') as HTMLElement;
  expect(titlePart.textContent).to.equal('Migrating the table component');
  expect(titlePart.getAttribute('title')).to.equal('Migrating the table component');
});

it('forwards a host aria-label onto the inner role="option" element instead of the derived title', async () => {
  const el = (await fixture(
    html`<lyra-conversation-item title="Internal name" aria-label="Custom label"></lyra-conversation-item>`,
  )) as LyraConversationItem;
  expect(optionEl(el).getAttribute('aria-label')).to.equal('Custom label');
});

describe('excerpt', () => {
  it('is not rendered when unset', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="A"></lyra-conversation-item>`)) as LyraConversationItem;
    expect(el.shadowRoot!.querySelector('[part="excerpt"]')).to.not.exist;
  });

  it('is rendered when set', async () => {
    const el = (await fixture(
      html`<lyra-conversation-item title="A" excerpt="Sure — I can open a PR for that."></lyra-conversation-item>`,
    )) as LyraConversationItem;
    expect(el.shadowRoot!.querySelector('[part="excerpt"]')!.textContent).to.equal('Sure — I can open a PR for that.');
  });
});

describe('timestamp', () => {
  it('renders no [part="timestamp"] when unset', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="A"></lyra-conversation-item>`)) as LyraConversationItem;
    expect(el.shadowRoot!.querySelector('[part="timestamp"]')).to.not.exist;
  });

  it('normalizes a Date and an ISO string to the same rendered datetime attribute', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="A"></lyra-conversation-item>`)) as LyraConversationItem;
    const date = new Date('2024-03-01T10:30:00Z');

    el.timestamp = date;
    await el.updateComplete;
    let time = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
    expect(time.getAttribute('datetime')).to.equal(date.toISOString());

    el.timestamp = '2024-03-01T10:30:00Z';
    await el.updateComplete;
    time = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
    expect(time.getAttribute('datetime')).to.equal(date.toISOString());
  });

  it('treats an invalid timestamp string the same as unset', async () => {
    const el = (await fixture(
      html`<lyra-conversation-item title="A" .timestamp=${'not a date'}></lyra-conversation-item>`,
    )) as LyraConversationItem;
    expect(el.shadowRoot!.querySelector('[part="timestamp"]')).to.not.exist;
  });

  it('uses the default absolute-time formatter, overridable via formatTimestamp', async () => {
    const date = new Date('2024-03-01T10:30:00Z');
    const el = (await fixture(
      html`<lyra-conversation-item title="A" .timestamp=${date}></lyra-conversation-item>`,
    )) as LyraConversationItem;
    const time = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
    expect(time.textContent!.trim().length).to.be.greaterThan(0);

    el.formatTimestamp = (d) => `custom:${d.getUTCFullYear()}`;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement).textContent).to.equal('custom:2024');
  });
});

describe('active', () => {
  it('reflects to the active attribute and to aria-selected', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="A"></lyra-conversation-item>`)) as LyraConversationItem;
    expect(optionEl(el).getAttribute('aria-selected')).to.equal('false');

    el.active = true;
    await el.updateComplete;
    expect(el.hasAttribute('active')).to.be.true;
    expect(optionEl(el).getAttribute('aria-selected')).to.equal('true');
  });
});

describe('selection', () => {
  it('fires a bubbling, composed lyra-select on click', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="A"></lyra-conversation-item>`)) as LyraConversationItem;
    setTimeout(() => optionEl(el).click());
    const ev = await oneEvent(el, 'lyra-select');
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('fires lyra-select on Enter and on Space keydown, preventing default on Space', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="A"></lyra-conversation-item>`)) as LyraConversationItem;

    setTimeout(() =>
      optionEl(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
    );
    await oneEvent(el, 'lyra-select');

    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    setTimeout(() => optionEl(el).dispatchEvent(spaceEvent));
    await oneEvent(el, 'lyra-select');
    expect(spaceEvent.defaultPrevented).to.be.true;
  });

  it('does not fire lyra-select for an unrelated key', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="A"></lyra-conversation-item>`)) as LyraConversationItem;
    let fired = false;
    el.addEventListener('lyra-select', () => (fired = true));
    optionEl(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    expect(fired).to.be.false;
  });

  it('does not fire lyra-select when the click originated in the actions slot', async () => {
    const el = (await fixture(html`
      <lyra-conversation-item title="A">
        <button slot="actions" id="del">Delete</button>
      </lyra-conversation-item>
    `)) as LyraConversationItem;
    let fired = false;
    el.addEventListener('lyra-select', () => (fired = true));
    (el.querySelector('#del') as HTMLButtonElement).click();
    expect(fired).to.be.false;
  });
});

describe('inline rename', () => {
  it('renders the rename button only while editable and not already renaming', async () => {
    const editable = (await fixture(html`<lyra-conversation-item title="A"></lyra-conversation-item>`)) as LyraConversationItem;
    expect(editable.shadowRoot!.querySelector('[part="rename-button"]')).to.exist;

    const notEditable = (await fixture(
      html`<lyra-conversation-item title="A" .editable=${false}></lyra-conversation-item>`,
    )) as LyraConversationItem;
    expect(notEditable.shadowRoot!.querySelector('[part="rename-button"]')).to.not.exist;
  });

  it('swaps the title for a focused, pre-filled input when the rename button is activated', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="Old name"></lyra-conversation-item>`)) as LyraConversationItem;
    const btn = el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement;
    btn.click();
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="title"]')).to.not.exist;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    expect(input).to.exist;
    expect(input.value).to.equal('Old name');
    expect(el.shadowRoot!.activeElement).to.equal(input);
  });

  it('gives the rename input the same row-specific accessible name as the rename button', async () => {
    const el = (await fixture(
      html`<lyra-conversation-item title="Migrating the table component"></lyra-conversation-item>`,
    )) as LyraConversationItem;
    const btn = el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement;
    expect(btn.getAttribute('aria-label')).to.equal('Rename Migrating the table component');
    btn.click();
    await el.updateComplete;

    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).to.equal('Rename Migrating the table component');
  });

  it('does not activate rename when editable is false', async () => {
    const el = (await fixture(
      html`<lyra-conversation-item title="A" .editable=${false}></lyra-conversation-item>`,
    )) as LyraConversationItem;
    expect(el.shadowRoot!.querySelector('[part="title-input"]')).to.not.exist;
  });

  it('cancels an in-progress rename (discarding the draft) when editable flips to false', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="Old name"></lyra-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    input.value = 'Should be discarded';
    input.dispatchEvent(new Event('input'));

    let renameFired = false;
    el.addEventListener('lyra-rename', () => (renameFired = true));

    el.editable = false;
    await el.updateComplete;

    expect(renameFired, 'flipping editable false must not commit the draft').to.be.false;
    expect(el.shadowRoot!.querySelector('[part="title-input"]'), 'input must be unmounted').to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.equal('Old name');
    // The now-editable=false row must also not silently expose a rename
    // button that could reopen a fresh edit.
    expect(el.shadowRoot!.querySelector('[part="rename-button"]')).to.not.exist;
  });

  it('does not fire lyra-select when the rename button is clicked', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="A"></lyra-conversation-item>`)) as LyraConversationItem;
    let fired = false;
    el.addEventListener('lyra-select', () => (fired = true));
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    expect(fired).to.be.false;
  });

  it('Enter commits: fires lyra-rename with the trimmed title and leaves title unmutated', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="Old name"></lyra-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    input.value = '  New name  ';
    input.dispatchEvent(new Event('input'));

    setTimeout(() =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
    );
    const ev = await oneEvent(el, 'lyra-rename');
    expect(ev.detail).to.deep.equal({ title: 'New name' });
    expect(el.title, 'controlled component -- the title prop itself is never mutated').to.equal('Old name');
    expect(el.shadowRoot!.querySelector('[part="title-input"]'), 'editing ends on commit').to.not.exist;
  });

  it('blur while editing commits, same as Enter', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="Old name"></lyra-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    input.value = 'Blurred name';
    input.dispatchEvent(new Event('input'));

    setTimeout(() => input.dispatchEvent(new FocusEvent('blur')));
    const ev = await oneEvent(el, 'lyra-rename');
    expect(ev.detail).to.deep.equal({ title: 'Blurred name' });
  });

  it('Escape cancels: reverts to the original title and fires nothing', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="Old name"></lyra-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    input.value = 'Should be discarded';
    input.dispatchEvent(new Event('input'));

    let renameFired = false;
    el.addEventListener('lyra-rename', () => (renameFired = true));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await el.updateComplete;

    expect(renameFired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="title-input"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.equal('Old name');

    // Re-opening the editor afterward must reseed from the (unchanged)
    // title prop, not from the discarded draft.
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement).value).to.equal('Old name');
  });

  it('does not fire lyra-rename for an empty or whitespace-only commit (treated as cancel)', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="Old name"></lyra-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    input.value = '   ';
    input.dispatchEvent(new Event('input'));

    let fired = false;
    el.addEventListener('lyra-rename', () => (fired = true));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="title-input"]'), 'still ends the edit').to.not.exist;
  });

  it('does not fire lyra-rename when the committed title is unchanged', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="Same name"></lyra-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;

    let fired = false;
    el.addEventListener('lyra-rename', () => (fired = true));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it('does not let Escape also trigger a blur-driven commit', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="Old name"></lyra-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    input.value = 'Should not commit';
    input.dispatchEvent(new Event('input'));

    let fired = false;
    el.addEventListener('lyra-rename', () => (fired = true));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    input.dispatchEvent(new FocusEvent('blur'));
    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it('keystrokes inside the input do not also fire lyra-select', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="Old name"></lyra-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    input.value = 'New name';
    input.dispatchEvent(new Event('input'));

    let selectFired = false;
    el.addEventListener('lyra-select', () => (selectFired = true));
    setTimeout(() =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
    );
    await oneEvent(el, 'lyra-rename');
    expect(selectFired).to.be.false;
  });

  it('clicking inside the row while renaming does not fire lyra-select', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="Old name"></lyra-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;

    let fired = false;
    el.addEventListener('lyra-select', () => (fired = true));
    optionEl(el).click();
    expect(fired).to.be.false;
  });
});

describe('actions slot', () => {
  it('hides the actions part when nothing is slotted', async () => {
    const el = (await fixture(html`<lyra-conversation-item title="A"></lyra-conversation-item>`)) as LyraConversationItem;
    expect((el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement).hidden).to.be.true;
  });

  it('shows the actions part once content is slotted', async () => {
    const el = (await fixture(html`
      <lyra-conversation-item title="A"><button slot="actions">Pin</button></lyra-conversation-item>
    `)) as LyraConversationItem;
    expect((el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement).hidden).to.be.false;
  });
});

it('is accessible in the default (empty) state', async () => {
  const el = await fixtureInListbox(html`<lyra-conversation-item></lyra-conversation-item>`);
  await expect(el).to.be.accessible();
});

it('is accessible in a populated, active state with an excerpt, timestamp, and actions slot', async () => {
  const el = await fixtureInListbox(html`
    <lyra-conversation-item
      title="Migrating the table component"
      excerpt="Sure — I can open a PR for that."
      .timestamp=${new Date()}
      active
    >
      <button slot="actions" aria-label="Delete conversation">✕</button>
    </lyra-conversation-item>
  `);
  await expect(el).to.be.accessible();
});

it('is accessible while renaming', async () => {
  const el = await fixtureInListbox(html`<lyra-conversation-item title="Old name"></lyra-conversation-item>`);
  (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
