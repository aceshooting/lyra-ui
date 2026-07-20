import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './conversation-item.js';
import type { LyraConversationItem, LyraConversationItemEventMap } from './conversation-item.js';

type RenameEvent = LyraConversationItemEventMap['lr-rename'];
const renameTitle = (event: RenameEvent): string => event.detail.title;
void renameTitle;

// The selectable region -- `role="button"`, click/keydown handlers, and
// (while not renaming) aria-current/aria-label -- lives on `[part="option"]`,
// not `[part="base"]` (a plain layout wrapper). See the class doc's
// nested-interactive note for why the rename button and `actions` slot are
// siblings of this element rather than descendants of it.
function optionEl(el: LyraConversationItem): HTMLElement {
  return el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
}

async function fixtureItem(item: import('lit').TemplateResult): Promise<LyraConversationItem> {
  return (await fixture(item)) as LyraConversationItem;
}

it('defaults to title="", excerpt="", active=false, editable=true', async () => {
  const el = (await fixture(html`<lr-conversation-item></lr-conversation-item>`)) as LyraConversationItem;
  expect(el.title).to.equal('');
  expect(el.excerpt).to.equal('');
  expect(el.active).to.be.false;
  expect(el.editable).to.be.true;
  expect(el.hasAttribute('active')).to.be.false;
  expect(el.hasAttribute('editable')).to.be.true;
});

it('renders a standalone role="button" and a tabindex of 0', async () => {
  const el = (await fixture(html`<lr-conversation-item title="A"></lr-conversation-item>`)) as LyraConversationItem;
  const b = optionEl(el);
  expect(b.getAttribute('role')).to.equal('button');
  expect(b.getAttribute('tabindex')).to.equal('0');
});

it('falls back to "Untitled conversation" when title is empty', async () => {
  const el = (await fixture(html`<lr-conversation-item></lr-conversation-item>`)) as LyraConversationItem;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.equal('Untitled conversation');
  expect(optionEl(el).getAttribute('aria-label')).to.equal('Untitled conversation');
});

it('localizes the untitled-conversation fallback via this.localize() when .strings overrides untitledConversation', async () => {
  const el = (await fixture(html`
    <lr-conversation-item .strings=${{ untitledConversation: 'Conversation sans titre' }}></lr-conversation-item>
  `)) as LyraConversationItem;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.equal('Conversation sans titre');
  expect(optionEl(el).getAttribute('aria-label')).to.equal('Conversation sans titre');
});

it('renders the given title, with a title tooltip attribute for the full text', async () => {
  const el = (await fixture(
    html`<lr-conversation-item title="Migrating the table component"></lr-conversation-item>`,
  )) as LyraConversationItem;
  const titlePart = el.shadowRoot!.querySelector('[part="title"]') as HTMLElement;
  expect(titlePart.textContent).to.equal('Migrating the table component');
  expect(titlePart.getAttribute('title')).to.equal('Migrating the table component');
});

it('forwards a host aria-label onto the inner role="button" element instead of the derived title', async () => {
  const el = (await fixture(
    html`<lr-conversation-item title="Internal name" aria-label="Custom label"></lr-conversation-item>`,
  )) as LyraConversationItem;
  expect(optionEl(el).getAttribute('aria-label')).to.equal('Custom label');
});

describe('excerpt', () => {
  it('is hidden when unset', async () => {
    const el = (await fixture(html`<lr-conversation-item title="A"></lr-conversation-item>`)) as LyraConversationItem;
    expect((el.shadowRoot!.querySelector('[part="excerpt"]') as HTMLElement).hidden).to.be.true;
  });

  it('is rendered when set', async () => {
    const el = (await fixture(
      html`<lr-conversation-item title="A" excerpt="Sure — I can open a PR for that."></lr-conversation-item>`,
    )) as LyraConversationItem;
    expect(el.shadowRoot!.querySelector('[part="excerpt"]')!.textContent!.trim()).to.equal(
      'Sure — I can open a PR for that.',
    );
  });
});

describe('meta slot', () => {
  it('hides the meta wrapper until something is slotted', async () => {
    const el = (await fixture(html`<lr-conversation-item></lr-conversation-item>`)) as LyraConversationItem;
    expect((el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
  });

  it('shows the meta wrapper once content is slotted', async () => {
    const el = (await fixture(
      html`<lr-conversation-item><span slot="meta">3 requests</span></lr-conversation-item>`,
    )) as LyraConversationItem;
    expect((el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="meta"] slot')!.assignedElements()[0].textContent).to.equal(
      '3 requests',
    );
  });
});

describe('excerpt slot (wins over the excerpt property)', () => {
  it('renders the excerpt property in [part="excerpt"] when no slot content is present (unchanged default)', async () => {
    const el = (await fixture(
      html`<lr-conversation-item excerpt="plain preview text"></lr-conversation-item>`,
    )) as LyraConversationItem;
    const excerptPart = el.shadowRoot!.querySelector('[part="excerpt"]') as HTMLElement;
    expect(excerptPart.hasAttribute('hidden')).to.be.false;
    expect(excerptPart.textContent!.trim()).to.equal('plain preview text');
  });

  it('renders slotted content instead of the excerpt property when both are set', async () => {
    const el = (await fixture(
      html`<lr-conversation-item excerpt="plain preview text"
        ><mark slot="excerpt">highlighted</mark> hit</lr-conversation-item
      >`,
    )) as LyraConversationItem;
    const excerptPart = el.shadowRoot!.querySelector('[part="excerpt"]') as HTMLElement;
    expect(excerptPart.hasAttribute('hidden')).to.be.false;
    expect(excerptPart.textContent!.trim()).to.not.include('plain preview text');
    // The slotted <mark> is light DOM (a child of the host element), not a descendant of the
    // shadow-tree excerptPart -- slot assignment doesn't reparent it, so it must be queried from
    // `el`, not from `excerptPart`, mirroring the assignedElements()-based query the meta-slot test
    // above uses for the same reason.
    expect(el.querySelector('mark')!.textContent).to.equal('highlighted');
  });

  it('hides [part="excerpt"] entirely when neither the property nor the slot has content', async () => {
    const el = (await fixture(html`<lr-conversation-item></lr-conversation-item>`)) as LyraConversationItem;
    expect((el.shadowRoot!.querySelector('[part="excerpt"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
  });
});

describe('timestamp', () => {
  it('renders no [part="timestamp"] when unset', async () => {
    const el = (await fixture(html`<lr-conversation-item title="A"></lr-conversation-item>`)) as LyraConversationItem;
    expect(el.shadowRoot!.querySelector('[part="timestamp"]')).to.not.exist;
  });

  it('normalizes a Date and an ISO string to the same rendered datetime attribute', async () => {
    const el = (await fixture(html`<lr-conversation-item title="A"></lr-conversation-item>`)) as LyraConversationItem;
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
      html`<lr-conversation-item title="A" .timestamp=${'not a date'}></lr-conversation-item>`,
    )) as LyraConversationItem;
    expect(el.shadowRoot!.querySelector('[part="timestamp"]')).to.not.exist;
  });

  it('uses the default absolute-time formatter, overridable via formatTimestamp', async () => {
    const date = new Date('2024-03-01T10:30:00Z');
    const el = (await fixture(
      html`<lr-conversation-item title="A" .timestamp=${date}></lr-conversation-item>`,
    )) as LyraConversationItem;
    const time = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
    expect(time.textContent!.trim().length).to.be.greaterThan(0);

    el.formatTimestamp = (d) => `custom:${d.getUTCFullYear()}`;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement).textContent).to.equal('custom:2024');
  });
});

describe('active', () => {
  it('reflects to the active attribute and to aria-current', async () => {
    const el = (await fixture(html`<lr-conversation-item title="A"></lr-conversation-item>`)) as LyraConversationItem;
    expect(optionEl(el).hasAttribute('aria-current')).to.be.false;

    el.active = true;
    await el.updateComplete;
    expect(el.hasAttribute('active')).to.be.true;
    expect(optionEl(el).getAttribute('aria-current')).to.equal('true');
  });
});

describe('selection', () => {
  it('fires a bubbling, composed lr-select on click', async () => {
    const el = (await fixture(html`<lr-conversation-item title="A"></lr-conversation-item>`)) as LyraConversationItem;
    setTimeout(() => optionEl(el).click());
    const ev = await oneEvent(el, 'lr-select');
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('fires lr-select on Enter and on Space keydown, preventing default on Space', async () => {
    const el = (await fixture(html`<lr-conversation-item title="A"></lr-conversation-item>`)) as LyraConversationItem;

    setTimeout(() =>
      optionEl(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
    );
    await oneEvent(el, 'lr-select');

    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    setTimeout(() => optionEl(el).dispatchEvent(spaceEvent));
    await oneEvent(el, 'lr-select');
    expect(spaceEvent.defaultPrevented).to.be.true;
  });

  it('does not fire lr-select for an unrelated key', async () => {
    const el = (await fixture(html`<lr-conversation-item title="A"></lr-conversation-item>`)) as LyraConversationItem;
    let fired = false;
    el.addEventListener('lr-select', () => (fired = true));
    optionEl(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    expect(fired).to.be.false;
  });

  it('does not fire lr-select when the click originated in the actions slot', async () => {
    const el = (await fixture(html`
      <lr-conversation-item title="A">
        <button slot="actions" id="del">Delete</button>
      </lr-conversation-item>
    `)) as LyraConversationItem;
    let fired = false;
    el.addEventListener('lr-select', () => (fired = true));
    (el.querySelector('#del') as HTMLButtonElement).click();
    expect(fired).to.be.false;
  });
});

describe('inline rename', () => {
  it('renders the rename button only while editable and not already renaming', async () => {
    const editable = (await fixture(html`<lr-conversation-item title="A"></lr-conversation-item>`)) as LyraConversationItem;
    expect(editable.shadowRoot!.querySelector('[part="rename-button"]')).to.exist;

    const notEditable = (await fixture(
      html`<lr-conversation-item title="A" .editable=${false}></lr-conversation-item>`,
    )) as LyraConversationItem;
    expect(notEditable.shadowRoot!.querySelector('[part="rename-button"]')).to.not.exist;
  });

  it('honors a plain editable="false" attribute (not just a .editable=${false} property binding)', async () => {
    const el = (await fixture(html`<lr-conversation-item title="A" editable="false"></lr-conversation-item>`)) as LyraConversationItem;
    expect(el.editable).to.be.false;
    expect(el.hasAttribute('editable')).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="rename-button"]')).to.have.lengthOf(0);
  });

  it('gives the rename button the shared minimum hit area', async () => {
    const el = (await fixture(html`<lr-conversation-item title="A"></lr-conversation-item>`)) as LyraConversationItem;
    const btn = el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLElement;
    expect(getComputedStyle(btn).minInlineSize).to.equal('40px');
    expect(getComputedStyle(btn).minBlockSize).to.equal('40px');
  });

  it('swaps the title for a focused, pre-filled input when the rename button is activated', async () => {
    const el = (await fixture(html`<lr-conversation-item title="Old name"></lr-conversation-item>`)) as LyraConversationItem;
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
      html`<lr-conversation-item title="Migrating the table component"></lr-conversation-item>`,
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
      html`<lr-conversation-item title="A" .editable=${false}></lr-conversation-item>`,
    )) as LyraConversationItem;
    expect(el.shadowRoot!.querySelector('[part="title-input"]')).to.not.exist;
  });

  it('cancels an in-progress rename (discarding the draft) when editable flips to false', async () => {
    const el = (await fixture(html`<lr-conversation-item title="Old name"></lr-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    input.value = 'Should be discarded';
    input.dispatchEvent(new Event('input'));

    let renameFired = false;
    el.addEventListener('lr-rename', () => (renameFired = true));

    el.editable = false;
    await el.updateComplete;

    expect(renameFired, 'flipping editable false must not commit the draft').to.be.false;
    expect(el.shadowRoot!.querySelector('[part="title-input"]'), 'input must be unmounted').to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.equal('Old name');
    // The now-editable=false row must also not silently expose a rename
    // button that could reopen a fresh edit.
    expect(el.shadowRoot!.querySelector('[part="rename-button"]')).to.not.exist;
  });

  it('does not fire lr-select when the rename button is clicked', async () => {
    const el = (await fixture(html`<lr-conversation-item title="A"></lr-conversation-item>`)) as LyraConversationItem;
    let fired = false;
    el.addEventListener('lr-select', () => (fired = true));
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    expect(fired).to.be.false;
  });

  it('Enter commits: fires lr-rename with the trimmed title and leaves title unmutated', async () => {
    const el = (await fixture(html`<lr-conversation-item title="Old name"></lr-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    input.value = '  New name  ';
    input.dispatchEvent(new Event('input'));

    setTimeout(() =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
    );
    const ev = await oneEvent(el, 'lr-rename');
    expect(ev.detail).to.deep.equal({ title: 'New name' });
    expect(el.title, 'controlled component -- the title prop itself is never mutated').to.equal('Old name');
    expect(el.shadowRoot!.querySelector('[part="title-input"]'), 'editing ends on commit').to.not.exist;
  });

  it('blur while editing commits, same as Enter', async () => {
    const el = (await fixture(html`<lr-conversation-item title="Old name"></lr-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    input.value = 'Blurred name';
    input.dispatchEvent(new Event('input'));

    setTimeout(() => input.dispatchEvent(new FocusEvent('blur')));
    const ev = await oneEvent(el, 'lr-rename');
    expect(ev.detail).to.deep.equal({ title: 'Blurred name' });
  });

  it('Escape cancels: reverts to the original title and fires nothing', async () => {
    const el = (await fixture(html`<lr-conversation-item title="Old name"></lr-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    input.value = 'Should be discarded';
    input.dispatchEvent(new Event('input'));

    let renameFired = false;
    el.addEventListener('lr-rename', () => (renameFired = true));
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

  it('does not fire lr-rename for an empty or whitespace-only commit (treated as cancel)', async () => {
    const el = (await fixture(html`<lr-conversation-item title="Old name"></lr-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    input.value = '   ';
    input.dispatchEvent(new Event('input'));

    let fired = false;
    el.addEventListener('lr-rename', () => (fired = true));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="title-input"]'), 'still ends the edit').to.not.exist;
  });

  it('does not fire lr-rename when the committed title is unchanged', async () => {
    const el = (await fixture(html`<lr-conversation-item title="Same name"></lr-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;

    let fired = false;
    el.addEventListener('lr-rename', () => (fired = true));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it('does not let Escape also trigger a blur-driven commit', async () => {
    const el = (await fixture(html`<lr-conversation-item title="Old name"></lr-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    input.value = 'Should not commit';
    input.dispatchEvent(new Event('input'));

    let fired = false;
    el.addEventListener('lr-rename', () => (fired = true));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    input.dispatchEvent(new FocusEvent('blur'));
    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it('keystrokes inside the input do not also fire lr-select', async () => {
    const el = (await fixture(html`<lr-conversation-item title="Old name"></lr-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    input.value = 'New name';
    input.dispatchEvent(new Event('input'));

    let selectFired = false;
    el.addEventListener('lr-select', () => (selectFired = true));
    setTimeout(() =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
    );
    await oneEvent(el, 'lr-rename');
    expect(selectFired).to.be.false;
  });

  it('clicking inside the row while renaming does not fire lr-select', async () => {
    const el = (await fixture(html`<lr-conversation-item title="Old name"></lr-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;

    let fired = false;
    el.addEventListener('lr-select', () => (fired = true));
    optionEl(el).click();
    expect(fired).to.be.false;
  });
});

describe('spellcheck/autocapitalize/autocorrect passthrough', () => {
  it('spellcheck defaults to true on the rename input', async () => {
    const el = (await fixture(html`<lr-conversation-item title="A"></lr-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    expect(input.spellcheck).to.be.true;
  });

  it('forwards spellcheck=false, autocapitalize, and autocorrect onto the rename input', async () => {
    const el = (await fixture(html`
      <lr-conversation-item
        title="A"
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
      ></lr-conversation-item>
    `)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;
    expect(input.spellcheck).to.be.false;
    expect(input.getAttribute('autocapitalize')).to.equal('off');
    expect(input.getAttribute('autocorrect')).to.equal('off');
  });
});

describe('rename input blur/focus bubbling', () => {
  it('re-dispatches a bubbling, composed blur event when the rename input blurs', async () => {
    const el = (await fixture(html`<lr-conversation-item title="Old name"></lr-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;

    setTimeout(() => input.dispatchEvent(new FocusEvent('blur')));
    const ev = await oneEvent(el, 'blur');
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('re-dispatches a bubbling, composed focus event when the rename input focuses', async () => {
    const el = (await fixture(html`<lr-conversation-item title="Old name"></lr-conversation-item>`)) as LyraConversationItem;
    (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="title-input"]') as HTMLInputElement;

    setTimeout(() => input.dispatchEvent(new FocusEvent('focus')));
    const ev = await oneEvent(el, 'focus');
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});

describe('actions slot', () => {
  it('hides the actions part when nothing is slotted', async () => {
    const el = (await fixture(html`<lr-conversation-item title="A"></lr-conversation-item>`)) as LyraConversationItem;
    expect((el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement).hidden).to.be.true;
  });

  it('shows the actions part once content is slotted', async () => {
    const el = (await fixture(html`
      <lr-conversation-item title="A"><button slot="actions">Pin</button></lr-conversation-item>
    `)) as LyraConversationItem;
    expect((el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement).hidden).to.be.false;
  });
});

it('is accessible in the default (empty) state', async () => {
  const el = await fixtureItem(html`<lr-conversation-item></lr-conversation-item>`);
  await expect(el).to.be.accessible();
});

it('is accessible in a populated, active state with an excerpt, timestamp, and actions slot', async () => {
  const el = await fixtureItem(html`
    <lr-conversation-item
      title="Migrating the table component"
      excerpt="Sure — I can open a PR for that."
      .timestamp=${new Date()}
      active
    >
      <button slot="actions" aria-label="Delete conversation">✕</button>
    </lr-conversation-item>
  `);
  await expect(el).to.be.accessible();
});

it('is accessible while renaming', async () => {
  const el = await fixtureItem(html`<lr-conversation-item title="Old name"></lr-conversation-item>`);
  (el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

describe('nested-interactive slot contract (meta/excerpt render inside role="button")', () => {
  // The class doc's @slot meta/@slot excerpt warnings exist specifically because [part="option"]
  // carries role="button" (while not renaming) and wraps both slots -- axe-core's nested-interactive
  // rule forbids a focusable descendant of a role="button" ancestor. A consumer who ignores that
  // prose and slots a real focusable control must actually trip the violation, or the documented
  // contract is untested and could silently stop being true.
  it('a focusable element slotted into meta trips axe nested-interactive', async () => {
    const el = await fixtureItem(
      html`<lr-conversation-item title="A"><a slot="meta" href="/session/1">Open</a></lr-conversation-item>`,
    );
    await expect(el).to.not.be.accessible();
  });

  it('a focusable element slotted into excerpt trips axe nested-interactive', async () => {
    const el = await fixtureItem(
      html`<lr-conversation-item title="A"><button slot="excerpt">Retry</button></lr-conversation-item>`,
    );
    await expect(el).to.not.be.accessible();
  });
});

describe('active-state cssprop escape hatch', () => {
  // Resolves what `declaration` computes to *inside this component's shadow root*, where the
  // `--lr-*` design tokens are declared (a light-DOM probe would see none of them) -- used to
  // assert the unset defaults byte-for-byte against the tokens they fall back to.
  function resolvedInShadow(el: LyraConversationItem, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function activeItem(style = ''): Promise<LyraConversationItem> {
    const wrapper = (await fixture(html`
      <div style=${style}>
        <lr-conversation-item title="Session" excerpt="Last message" .timestamp=${new Date()} active></lr-conversation-item>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-conversation-item') as LyraConversationItem;
    await el.updateComplete;
    return el;
  }

  it('recolors the active row background from an ancestor via --lr-conversation-item-active-bg', async () => {
    const el = await activeItem('--lr-conversation-item-active-bg: rgb(0, 51, 102)');
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).backgroundColor).to.equal('rgb(0, 51, 102)');
  });

  it('restores the active excerpt/timestamp text color from an ancestor via --lr-conversation-item-active-color', async () => {
    const el = await activeItem('--lr-conversation-item-active-color: rgb(255, 255, 255)');
    const excerpt = el.shadowRoot!.querySelector('[part="excerpt"]') as HTMLElement;
    const timestamp = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
    expect(getComputedStyle(excerpt).color).to.equal('rgb(255, 255, 255)');
    expect(getComputedStyle(timestamp).color).to.equal('rgb(255, 255, 255)');
  });

  it('renders both props byte-identical to the pre-hatch tokens when unset', async () => {
    const el = await activeItem();
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const excerpt = el.shadowRoot!.querySelector('[part="excerpt"]') as HTMLElement;
    expect(getComputedStyle(base).backgroundColor).to.equal(
      resolvedInShadow(el, 'background: var(--lr-color-brand-quiet)', 'background-color'),
    );
    expect(getComputedStyle(excerpt).color).to.equal(resolvedInShadow(el, 'color: var(--lr-color-text)', 'color'));
  });

  // Themed with a LIGHT active background on purpose: `[part='title']` keeps `--lr-color-text`
  // unconditionally (only excerpt/timestamp are restored by --lr-conversation-item-active-color), so
  // the documented WCAG-AA dependency covers the title too -- a consumer darkening the background
  // has to darken nothing and lighten nothing, or supply its own title color. See the styles file.
  it('is accessible with the active-state props themed', async () => {
    const el = await activeItem(
      '--lr-conversation-item-active-bg: rgb(255, 243, 205); --lr-conversation-item-active-color: rgb(51, 25, 0)',
    );
    await expect(el).to.be.accessible();
  });
});

describe('compact', () => {
  const rowChrome = (el: LyraConversationItem) => {
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
    const b = getComputedStyle(base);
    const c = getComputedStyle(content);
    return {
      paddingTop: b.paddingTop,
      paddingBottom: b.paddingBottom,
      paddingLeft: b.paddingLeft,
      paddingRight: b.paddingRight,
      rowGap: b.rowGap,
      columnGap: b.columnGap,
      contentRowGap: c.rowGap,
    };
  };

  const partStyle = (el: LyraConversationItem, part: string): CSSStyleDeclaration =>
    getComputedStyle(el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement);

  it('defaults to compact=false with no compact attribute, rendering identically to .compact=${false} restated', async () => {
    const implicit = await fixtureItem(
      html`<lr-conversation-item title="Session" excerpt="Last message" .timestamp=${new Date()}></lr-conversation-item>`,
    );
    const explicit = await fixtureItem(
      html`<lr-conversation-item
        title="Session"
        excerpt="Last message"
        .timestamp=${new Date()}
        .compact=${false}
      ></lr-conversation-item>`,
    );

    expect(implicit.compact).to.be.false;
    expect(implicit.hasAttribute('compact')).to.be.false;
    expect(rowChrome(explicit)).to.deep.equal(rowChrome(implicit));

    const chrome = rowChrome(implicit);
    expect(chrome.paddingTop).to.equal('8px'); // --lr-space-s
    expect(chrome.paddingLeft).to.equal('12px'); // --lr-space-m
    expect(chrome.columnGap).to.equal('4px'); // --lr-space-xs
    expect(chrome.contentRowGap).to.equal('2px'); // --lr-size-0-125rem
  });

  it('reflects compact and tightens the base padding/gap and the content gap', async () => {
    const el = await fixtureItem(
      html`<lr-conversation-item
        compact
        title="Session"
        excerpt="Last message"
        .timestamp=${new Date()}
      ></lr-conversation-item>`,
    );
    expect(el.hasAttribute('compact')).to.be.true;
    const chrome = rowChrome(el);
    expect(chrome.paddingTop).to.equal('4px'); // --lr-space-xs
    expect(chrome.paddingBottom).to.equal('4px');
    expect(chrome.paddingLeft).to.equal('8px'); // --lr-space-s
    expect(chrome.paddingRight).to.equal('8px');
    expect(chrome.columnGap).to.equal('2px'); // --lr-space-2xs
    expect(chrome.rowGap).to.equal('2px');
    expect(chrome.contentRowGap).to.equal('0px');
  });

  it('lets a consumer retune the compact values through --lr-conversation-item-compact-*', async () => {
    const el = await fixtureItem(
      html`<lr-conversation-item compact title="Session" excerpt="Last message"></lr-conversation-item>`,
    );
    el.style.setProperty('--lr-conversation-item-compact-padding', '3px 9px');
    el.style.setProperty('--lr-conversation-item-compact-gap', '5px');
    await el.updateComplete;
    const chrome = rowChrome(el);
    expect(chrome.paddingTop).to.equal('3px');
    expect(chrome.paddingLeft).to.equal('9px');
    expect(chrome.columnGap).to.equal('5px');
  });

  it('keeps the rename button at the shared --lr-icon-button-size floor under compact', async () => {
    const comfortable = await fixtureItem(html`<lr-conversation-item title="Session"></lr-conversation-item>`);
    const el = await fixtureItem(html`<lr-conversation-item compact title="Session"></lr-conversation-item>`);
    const floor = getComputedStyle(el).getPropertyValue('--lr-icon-button-size').trim();
    expect(floor).to.equal('2.5rem');

    const compactButton = partStyle(el, 'rename-button');
    const comfortableButton = partStyle(comfortable, 'rename-button');
    expect(compactButton.minInlineSize).to.equal('40px');
    expect(compactButton.minBlockSize).to.equal('40px');
    // Density must never silently opt a row out of the shared icon target-size floor.
    expect(compactButton.minInlineSize).to.equal(comfortableButton.minInlineSize);
    expect(compactButton.minBlockSize).to.equal(comfortableButton.minBlockSize);
  });

  it('keeps the active background and the promoted excerpt/timestamp color when compact and active are combined', async () => {
    const ts = new Date();
    const activeOnly = await fixtureItem(
      html`<lr-conversation-item title="Session" excerpt="Last message" .timestamp=${ts} active></lr-conversation-item>`,
    );
    const compactOnly = await fixtureItem(
      html`<lr-conversation-item title="Session" excerpt="Last message" .timestamp=${ts} compact></lr-conversation-item>`,
    );
    const both = await fixtureItem(
      html`<lr-conversation-item
        title="Session"
        excerpt="Last message"
        .timestamp=${ts}
        compact
        active
      ></lr-conversation-item>`,
    );

    // `:host([compact]) [part='base']` and `:host([active]) [part='base']` have equal specificity,
    // so this asserts the source order that lets `active` keep its statement-of-appearance.
    const bothBg = partStyle(both, 'base').backgroundColor;
    expect(bothBg).to.equal(partStyle(activeOnly, 'base').backgroundColor);
    expect(bothBg).to.not.equal(partStyle(compactOnly, 'base').backgroundColor);

    // The active contrast fix (excerpt/timestamp promoted to full-strength text) still applies.
    const titleColor = partStyle(both, 'title').color;
    expect(partStyle(both, 'excerpt').color).to.equal(titleColor);
    expect(partStyle(both, 'timestamp').color).to.equal(titleColor);
    expect(partStyle(compactOnly, 'excerpt').color).to.not.equal(titleColor);

    // ...and compact still tightened the box.
    expect(rowChrome(both).paddingTop).to.equal('4px');
  });

  it('is accessible in a populated compact state', async () => {
    const el = await fixtureItem(html`
      <lr-conversation-item compact title="Session" excerpt="Last message" .timestamp=${new Date()} active>
        <button slot="actions" type="button" aria-label="Delete conversation">x</button>
      </lr-conversation-item>
    `);
    expect(el.shadowRoot!.querySelectorAll('[part="excerpt"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="timestamp"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="rename-button"]').length).to.equal(1);
    await expect(el).to.be.accessible();
  });
});
