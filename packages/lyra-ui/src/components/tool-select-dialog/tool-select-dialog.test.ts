import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './tool-select-dialog.js';
import type { LyraToolSelectDialog, ToolSelectDialogTool } from './tool-select-dialog.js';
import type { LyraCheckbox } from '../checkbox/checkbox.js';

// A stand-in for a slotted component whose real focusable target lives
// inside its own shadow root rather than the host tag's light-DOM subtree.
// Mirrors lyra-dialog's/lyra-tool-result-dialog's identical test fixture,
// under a distinct tag name so every test file can register its own copy in
// the same browser context.
class ToolSelectDialogTestShadowInput extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    input.type = 'text';
    root.appendChild(input);
  }
}
customElements.define('tool-select-dialog-test-shadow-input', ToolSelectDialogTestShadowInput);

const TOOLS: ToolSelectDialogTool[] = [
  { id: 'web_search', name: 'Web search', description: 'Search the public web.', category: 'Research' },
  { id: 'fetch_url', name: 'Fetch URL', description: 'Download a specific page.', category: 'Research' },
  { id: 'run_python', name: 'Run Python', description: 'Execute sandboxed code.', category: 'Code execution' },
  {
    id: 'run_shell',
    name: 'Run shell command',
    category: 'Code execution',
    disabled: true,
    disabledReason: 'Requires admin approval.',
  },
  { id: 'send_email', name: 'Send email' },
];

function checkboxFor(el: LyraToolSelectDialog, id: string): LyraCheckbox {
  return el.shadowRoot!.querySelector(`lyra-checkbox[value="${id}"]`) as LyraCheckbox;
}

function clickCheckbox(checkbox: LyraCheckbox): void {
  (checkbox.shadowRoot!.querySelector('[part="base"]') as HTMLElement).click();
}

// The heading's textContent also carries the aria-hidden visual count and
// the sr-only full-sentence announcement (see "category-count" tests below)
// -- strip both so category-grouping tests only compare the category name.
function categoryHeadingName(heading: Element): string {
  const clone = heading.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[part="category-count"], .sr-only').forEach((n) => n.remove());
  return clone.textContent!.trim();
}

it('renders closed by default, with no role/aria-modal on the panel', async () => {
  const el = (await fixture(html`<lyra-tool-select-dialog></lyra-tool-select-dialog>`)) as LyraToolSelectDialog;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
  expect(panel.hasAttribute('role')).to.be.false;
  expect(panel.hasAttribute('aria-modal')).to.be.false;
});

it('reflects open as an attribute and sets dialog semantics once open', async () => {
  const el = (await fixture(html`<lyra-tool-select-dialog></lyra-tool-select-dialog>`)) as LyraToolSelectDialog;
  el.open = true;
  await el.updateComplete;

  expect(el.hasAttribute('open')).to.be.true;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('role')).to.equal('dialog');
  expect(panel.getAttribute('aria-modal')).to.equal('true');
  expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('[part="title"]')!.id);
});

it('renders the default label and a live "N of M tools enabled" subtitle', async () => {
  const el = (await fixture(
    html`<lyra-tool-select-dialog .tools=${TOOLS} .selected=${['web_search', 'run_python']}></lyra-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.equal('Select tools');
  expect(el.shadowRoot!.querySelector('[part="subtitle"]')!.textContent).to.equal('2 of 5 tools enabled');
});

it('hides the subtitle entirely when no tools are supplied', async () => {
  const el = (await fixture(
    html`<lyra-tool-select-dialog .tools=${[]}></lyra-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  expect(el.shadowRoot!.querySelector('[part="subtitle"]')!.hasAttribute('hidden')).to.be.true;
});

it('groups tools by category in first-seen order, with an uncategorized "Other" bucket last', async () => {
  const el = (await fixture(
    html`<lyra-tool-select-dialog .tools=${TOOLS}></lyra-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const headings = [...el.shadowRoot!.querySelectorAll('[part="category-heading"]')].map(categoryHeadingName);
  expect(headings).to.deep.equal(['Research', 'Code execution', 'Other']);
});

it('shows the tool count next to each category heading', async () => {
  const el = (await fixture(
    html`<lyra-tool-select-dialog .tools=${TOOLS}></lyra-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const count = el.shadowRoot!.querySelector('[part="category-heading"] [part="category-count"]');
  expect(count!.textContent).to.equal('2');
});

it('hides the visual category count from assistive tech and pairs it with a full-sentence sr-only announcement', async () => {
  const el = (await fixture(
    html`<lyra-tool-select-dialog .tools=${TOOLS}></lyra-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const heading = [...el.shadowRoot!.querySelectorAll('[part="category-heading"]')].find((h) =>
    categoryHeadingName(h) === 'Research',
  )!;
  const count = heading.querySelector('[part="category-count"]')!;
  expect(count.getAttribute('aria-hidden')).to.equal('true');
  expect(heading.querySelector('.sr-only')!.textContent).to.equal('2 tools');
});

it('uses the singular "tool" in the sr-only announcement for a single-tool category', async () => {
  const el = (await fixture(
    html`<lyra-tool-select-dialog
      .tools=${[{ id: 'solo', name: 'Solo tool', category: 'Solo' }]}
    ></lyra-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const heading = el.shadowRoot!.querySelector('[part="category-heading"]')!;
  expect(heading.querySelector('.sr-only')!.textContent).to.equal('1 tool');
});

it('shows a disabled row with its disabledReason as supporting text, and a disabled checkbox', async () => {
  const el = (await fixture(
    html`<lyra-tool-select-dialog .tools=${TOOLS}></lyra-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const checkbox = checkboxFor(el, 'run_shell');
  expect(checkbox.disabled).to.be.true;
  const row = checkbox.closest('[part="tool-row"]') as HTMLElement;
  expect(row.hasAttribute('data-disabled')).to.be.true;
  expect(row.querySelector('[part="tool-disabled-reason"]')!.textContent).to.equal('Requires admin approval.');
});

it('does not render a disabled-reason paragraph for an enabled row', async () => {
  const el = (await fixture(
    html`<lyra-tool-select-dialog .tools=${TOOLS}></lyra-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const row = checkboxFor(el, 'web_search').closest('[part="tool-row"]') as HTMLElement;
  expect(row.querySelector('[part="tool-disabled-reason"]')).to.not.exist;
});

it('folds the disabled reason into the checkbox itself, so it contributes to its accessible name/content instead of going unannounced', async () => {
  const el = (await fixture(
    html`<lyra-tool-select-dialog .tools=${TOOLS}></lyra-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const checkbox = checkboxFor(el, 'run_shell');
  expect(checkbox.querySelector('[part="tool-disabled-reason"]')).to.exist;
  expect(checkbox.textContent).to.include('Requires admin approval.');
});

describe('search filtering', () => {
  it('filters case-insensitively against name and description', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog .tools=${TOOLS}></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;

    input.value = 'PYTHON';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]').length).to.equal(1);
    expect(checkboxFor(el, 'run_python')).to.exist;

    input.value = 'sandboxed';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]').length).to.equal(1);
    expect(checkboxFor(el, 'run_python')).to.exist;
  });

  it('hides a category entirely once it has zero matching tools, rather than an empty heading', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog .tools=${TOOLS}></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;

    input.value = 'python';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;

    const headings = [...el.shadowRoot!.querySelectorAll('[part="category-heading"]')].map(categoryHeadingName);
    expect(headings).to.deep.equal(['Code execution']);
  });

  it('shows an empty-state message with the query when nothing matches', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog .tools=${TOOLS}></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;

    input.value = 'nonexistent-tool';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('nonexistent-tool');
  });

  it('shows a generic empty message (not a query-specific one) when no tools were supplied at all', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog .tools=${[]}></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent!.trim()).to.equal('No tools available.');
  });

  it('localizes the no-tools-available message via .strings', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog
        .tools=${[]}
        .strings=${{ toolSelectNoneAvailable: 'Aucun outil disponible.' }}
      ></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent!.trim()).to.equal('Aucun outil disponible.');
  });

  it('honors a custom filter override in place of the default name/description match', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog .tools=${TOOLS}></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    el.filter = (tool) => tool.id === 'send_email';
    const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
    input.value = 'anything';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]').length).to.equal(1);
    expect(checkboxFor(el, 'send_email')).to.exist;
  });

  it('resets the search query (and the resulting grouping/empty-state) once the dialog closes, so reopening the same instance starts unfiltered', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog open .tools=${TOOLS}></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;

    input.value = 'nonexistent-tool';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]').length).to.equal(0);

    el.close('api');
    await el.updateComplete;
    expect((el as unknown as { query: string }).query).to.equal('');

    el.open = true;
    await el.updateComplete;

    const reopenedInput = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
    expect(reopenedInput.value).to.equal('');
    expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]').length).to.equal(TOOLS.length);
    const headings = [...el.shadowRoot!.querySelectorAll('[part="category-heading"]')].map(categoryHeadingName);
    expect(headings).to.deep.equal(['Research', 'Code execution', 'Other']);
  });
});

describe('selection', () => {
  it('emits lyra-change with the tool added to selected when its checkbox is checked', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog .tools=${TOOLS} .selected=${['web_search']}></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const listener = oneEvent(el, 'lyra-change');
    clickCheckbox(checkboxFor(el, 'run_python'));
    const { detail } = await listener;

    expect(detail.useDefaults).to.be.false;
    expect(detail.selected).to.have.members(['web_search', 'run_python']);
    expect(el.selected).to.have.members(['web_search', 'run_python']);
  });

  it('emits lyra-change with the tool removed from selected when its checkbox is unchecked', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog
        .tools=${TOOLS}
        .selected=${['web_search', 'run_python']}
      ></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const listener = oneEvent(el, 'lyra-change');
    clickCheckbox(checkboxFor(el, 'web_search'));
    const { detail } = await listener;

    expect(detail.selected).to.deep.equal(['run_python']);
    expect(el.selected).to.deep.equal(['run_python']);
  });

  it('ignores clicks on a data-disabled tool row', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog .tools=${TOOLS} .selected=${[]}></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    let fired = false;
    el.addEventListener('lyra-change', () => (fired = true));
    clickCheckbox(checkboxFor(el, 'run_shell'));
    await el.updateComplete;

    expect(fired).to.be.false;
    expect(el.selected).to.deep.equal([]);
  });
});

describe('useDefaults', () => {
  it('defaults to false and leaves rows enabled', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog .tools=${TOOLS}></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    expect(el.useDefaults).to.be.false;
    expect(checkboxFor(el, 'web_search').disabled).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="defaults-hint"]')).to.not.exist;
  });

  it('disables every non-individually-disabled row and shows a hint while true', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog use-defaults .tools=${TOOLS} .selected=${['web_search']}></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    expect(checkboxFor(el, 'web_search').disabled).to.be.true;
    expect(checkboxFor(el, 'web_search').checked).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="defaults-hint"]')).to.exist;
  });

  it('flips useDefaults false and emits lyra-change when the switch is turned off', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog use-defaults .tools=${TOOLS} .selected=${['web_search']}></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const toggle = el.shadowRoot!.querySelector('[part="defaults-toggle"]') as HTMLElement;
    const base = toggle.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    const listener = oneEvent(el, 'lyra-change');
    base.click();
    const { detail } = await listener;

    expect(el.useDefaults).to.be.false;
    expect(el.hasAttribute('use-defaults')).to.be.false;
    expect(detail.useDefaults).to.be.false;
    expect(detail.selected).to.deep.equal(['web_search']);
    expect(checkboxFor(el, 'web_search').disabled).to.be.false;
  });
});

describe('dismissal', () => {
  it('closes on backdrop click and emits lyra-close with reason "backdrop"', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog open></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const listener = oneEvent(el, 'lyra-close');
    (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
    const { detail } = await listener;

    expect(el.open).to.be.false;
    expect(detail).to.equal('backdrop');
  });

  it('closes on Escape and emits lyra-close with reason "escape"', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog open></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const listener = oneEvent(el, 'lyra-close');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const { detail } = await listener;

    expect(el.open).to.be.false;
    expect(detail).to.equal('escape');
  });

  it('does not respond to Escape while closed', async () => {
    const el = (await fixture(html`<lyra-tool-select-dialog></lyra-tool-select-dialog>`)) as LyraToolSelectDialog;
    let fired = false;
    el.addEventListener('lyra-close', () => (fired = true));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await el.updateComplete;

    expect(fired).to.be.false;
  });

  it('close() is a no-op when already closed (no duplicate event, no error)', async () => {
    const el = (await fixture(html`<lyra-tool-select-dialog></lyra-tool-select-dialog>`)) as LyraToolSelectDialog;
    let count = 0;
    el.addEventListener('lyra-close', () => count++);

    el.close('api');
    el.close('api');
    await el.updateComplete;

    expect(count).to.equal(0);
  });

  it('close() sets open false, emits with the given reason, and is idempotent once closed', async () => {
    const el = (await fixture(html`<lyra-tool-select-dialog open></lyra-tool-select-dialog>`)) as LyraToolSelectDialog;
    let count = 0;
    let detail: unknown;
    el.addEventListener('lyra-close', (e) => {
      count++;
      detail = (e as CustomEvent).detail;
    });

    el.close('done');
    el.close('done');
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect(count).to.equal(1);
    expect(detail).to.equal('done');
  });
});

describe('focus management', () => {
  it('moves focus to the search input when opened (the first focusable element, with no special-casing)', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog .tools=${TOOLS}></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    el.open = true;
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="search-input"]'));
  });

  it('returns focus to the element that was focused before the dialog opened', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'open';
    document.body.appendChild(trigger);
    trigger.focus();

    const el = (await fixture(
      html`<lyra-tool-select-dialog .tools=${TOOLS}></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    el.open = true;
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="search-input"]'));

    el.close('api');
    await el.updateComplete;
    expect(document.activeElement).to.equal(trigger);

    trigger.remove();
  });

  it('traps Tab focus inside the panel, wrapping last->first and first->last', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog open .tools=${TOOLS}
        ><div slot="footer"><button>last</button></div></lyra-tool-select-dialog
      >`,
    )) as LyraToolSelectDialog;
    await el.updateComplete;
    const last = el.querySelector('[slot="footer"] button') as HTMLButtonElement;
    const searchInput = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;

    last.focus();
    const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabForward);
    expect(tabForward.defaultPrevented).to.be.true;
    expect(el.shadowRoot!.activeElement).to.equal(searchInput);

    const tabBackward = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(tabBackward);
    expect(tabBackward.defaultPrevented).to.be.true;
    expect(document.activeElement).to.equal(last);
  });

  it('traps Tab/Shift+Tab at a slotted element whose focusable target lives in its own shadow root', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog open
        ><tool-select-dialog-test-shadow-input slot="footer"></tool-select-dialog-test-shadow-input
      ></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    await el.updateComplete;
    const shadowHost = el.querySelector(
      'tool-select-dialog-test-shadow-input',
    ) as ToolSelectDialogTestShadowInput;
    const input = shadowHost.shadowRoot!.querySelector('input') as HTMLInputElement;
    const searchInput = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;

    input.focus();
    const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabForward);
    expect(tabForward.defaultPrevented).to.be.true;
    expect(el.shadowRoot!.activeElement).to.equal(searchInput);

    const tabBackward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(tabBackward);
    expect(tabBackward.defaultPrevented).to.be.true;
    expect(shadowHost.shadowRoot!.activeElement).to.equal(input);
  });
});

describe('scroll lock', () => {
  it('locks document scroll while open and releases it on close', async () => {
    const el = (await fixture(html`<lyra-tool-select-dialog></lyra-tool-select-dialog>`)) as LyraToolSelectDialog;
    el.open = true;
    await el.updateComplete;
    expect(document.documentElement.style.overflow).to.equal('hidden');

    el.close('api');
    await el.updateComplete;
    expect(document.documentElement.style.overflow).to.equal('');
  });

  it('releases the scroll lock on disconnect while open', async () => {
    const el = (await fixture(html`<lyra-tool-select-dialog open></lyra-tool-select-dialog>`)) as LyraToolSelectDialog;
    await el.updateComplete;
    expect(document.documentElement.style.overflow).to.equal('hidden');

    el.remove();

    expect(document.documentElement.style.overflow).to.equal('');
  });
});

describe('footer slot', () => {
  it('hides the footer wrapper when nothing is slotted into it, shows it once slotted', async () => {
    const el = (await fixture(html`<lyra-tool-select-dialog></lyra-tool-select-dialog>`)) as LyraToolSelectDialog;
    const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
    expect(footer.hasAttribute('hidden')).to.be.true;

    const button = document.createElement('button');
    button.slot = 'footer';
    el.appendChild(button);
    el.shadowRoot!.querySelector('slot[name="footer"]')!.dispatchEvent(new Event('slotchange'));
    await el.updateComplete;

    expect(footer.hasAttribute('hidden')).to.be.false;
  });

  it('renders the footer wrapper visible on first paint when footer content is present before upgrade', async () => {
    const el = (await fixture(
      html`<lyra-tool-select-dialog><button slot="footer">Done</button></lyra-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
    expect(footer.hasAttribute('hidden')).to.be.false;
  });
});

it('is accessible while closed', async () => {
  const el = (await fixture(html`<lyra-tool-select-dialog .tools=${TOOLS}></lyra-tool-select-dialog>`)) as LyraToolSelectDialog;
  await expect(el).to.be.accessible();
});

it('is accessible while open with grouped, disabled, and use-defaults-locked tools', async () => {
  const el = (await fixture(
    html`<lyra-tool-select-dialog
      open
      .tools=${TOOLS}
      .selected=${['web_search', 'run_python']}
    ></lyra-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  await el.updateComplete;
  await expect(el).to.be.accessible();

  el.useDefaults = true;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
