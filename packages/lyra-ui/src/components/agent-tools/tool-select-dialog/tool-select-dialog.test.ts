import { fixture, expect, oneEvent, html, waitUntil } from '@open-wc/testing';
import './tool-select-dialog.js';
import type {
  LyraToolSelectDialog,
  ToolSelectDialogTool,
  ToolSelectionChangeDetail,
} from './tool-select-dialog.js';
import type { LyraCheckbox } from '../../forms/checkbox/checkbox.js';
import type { LyraSwitch } from '../../forms/switch/switch.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

it('provides rendered hover feedback for the native search input', async () => {
  const el = await fixture<LyraToolSelectDialog>(html`
    <lr-tool-select-dialog open style="--lr-color-brand: rgb(1, 2, 3)"></lr-tool-select-dialog>
  `);
  const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
  const rect = input.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await waitUntil(() => getComputedStyle(input).borderTopColor === 'rgb(1, 2, 3)');
    expect(getComputedStyle(input).borderTopColor).to.equal('rgb(1, 2, 3)');
  } finally {
    await resetMouse();
  }
});

// A stand-in for a slotted component whose real focusable target lives
// inside its own shadow root rather than the host tag's light-DOM subtree.
// Mirrors lr-dialog's/lr-tool-result-dialog's identical test fixture,
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
  return el.shadowRoot!.querySelector(`lr-checkbox[value="${id}"]`) as LyraCheckbox;
}

function clickCheckbox(checkbox: LyraCheckbox): void {
  (checkbox.shadowRoot!.querySelector('[part~="base"]') as HTMLElement).click();
}

// The heading's textContent also carries the aria-hidden visual count and
// the sr-only full-sentence announcement (see "category-count" tests below)
// -- strip both so category-grouping tests only compare the category name.
function categoryHeadingName(heading: Element): string {
  const clone = heading.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[part="category-count"], .sr-only').forEach((n) => n.remove());
  return clone.textContent!.trim();
}

it('formats visible and announced category counts with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-tool-select-dialog lang="ar-EG" .tools=${TOOLS} open></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const heading = el.shadowRoot!.querySelector('[part="category-heading"]')!;
  const formatted = new Intl.NumberFormat('ar-EG').format(2);
  expect(heading.querySelector('[part="category-count"]')!.textContent).to.equal(formatted);
  expect(heading.querySelector('.sr-only')!.textContent).to.include(formatted);
});

it('renders closed by default, with no role/aria-modal on the panel', async () => {
  const el = (await fixture(html`<lr-tool-select-dialog></lr-tool-select-dialog>`)) as LyraToolSelectDialog;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
  expect(panel.hasAttribute('role')).to.be.false;
  expect(panel.hasAttribute('aria-modal')).to.be.false;
});

it('forwards native editing properties to the search input', async () => {
  const el = (await fixture(
    html`<lr-tool-select-dialog
      autocomplete="off"
      .spellcheck=${false}
      autocapitalize="none"
      autocorrect="off"
      inputmode="search"
      enterkeyhint="search"
    ></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const search = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
  expect(search.getAttribute('autocomplete')).to.equal('off');
  expect(search.spellcheck).to.be.false;
  expect(search.getAttribute('autocapitalize')).to.equal('none');
  expect(search.getAttribute('autocorrect')).to.equal('off');
  expect(search.getAttribute('inputmode')).to.equal('search');
  expect(search.getAttribute('enterkeyhint')).to.equal('search');
});

it('parses a literal spellcheck="false" HTML attribute as false, not the presence-based Boolean default', async () => {
  // Deliberately a plain attribute string (not a `.spellcheck=${false}` property binding) --
  // Lit's default `type: Boolean` converter is presence-based, so without a dedicated converter
  // any non-empty attribute string (including the literal "false") would coerce to `true`.
  const el = (await fixture(
    html`<lr-tool-select-dialog spellcheck="false"></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  expect(el.spellcheck).to.be.false;
  const search = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
  expect(search.spellcheck).to.be.false;
});

it('reflects open as an attribute and sets dialog semantics once open', async () => {
  const el = (await fixture(html`<lr-tool-select-dialog></lr-tool-select-dialog>`)) as LyraToolSelectDialog;
  el.open = true;
  await el.updateComplete;

  expect(el.hasAttribute('open')).to.be.true;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('role')).to.equal('dialog');
  expect(panel.getAttribute('aria-modal')).to.equal('true');
  expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('[part="title"]')!.id);
});

it('keeps authored host aria-label changes on the host while the dialog panel remains title-labelled', async () => {
  const el = (await fixture(
    html`<lr-tool-select-dialog open></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const panel = el.shadowRoot!.querySelector('[part="panel"]')!;

  el.setAttribute('aria-label', 'Custom tool picker name');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Custom tool picker name');
  expect(panel.hasAttribute('aria-label')).to.equal(false);
  expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('[part="title"]')!.id);

  el.setAttribute('aria-label', 'Changed tool picker name');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Changed tool picker name');
  expect(panel.hasAttribute('aria-label')).to.equal(false);
  expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('[part="title"]')!.id);

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('');
  expect(panel.hasAttribute('aria-label')).to.equal(false);
  expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('[part="title"]')!.id);

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(el.hasAttribute('aria-label')).to.equal(false);
  expect(panel.hasAttribute('aria-label')).to.equal(false);
  expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('[part="title"]')!.id);
});

it('uses a direct accessibleLabel to name the dialog panel without reflecting a host aria-label', async () => {
  const el = document.createElement('lr-tool-select-dialog') as LyraToolSelectDialog;
  el.open = true;
  el.accessibleLabel = 'Choose the active agent tools';
  document.body.append(el);
  try {
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!;

    expect(el.hasAttribute('aria-label')).to.equal(false);
    expect(panel.getAttribute('aria-label')).to.equal('Choose the active agent tools');
    expect(panel.hasAttribute('aria-labelledby')).to.equal(false);
    await expect(el).to.be.accessible();

    el.accessibleLabel = null;
    await el.updateComplete;
    expect(panel.hasAttribute('aria-label')).to.equal(false);
    expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('[part="title"]')!.id);

    el.accessibleLabel = 'Changed after connection';
    await el.updateComplete;
    expect(el.hasAttribute('aria-label')).to.equal(false);
    expect(panel.getAttribute('aria-label')).to.equal('Changed after connection');
    expect(panel.hasAttribute('aria-labelledby')).to.equal(false);
  } finally {
    el.open = false;
    await el.updateComplete;
    el.remove();
  }
});

it('renders the default label and a live "N of M tools enabled" subtitle', async () => {
  const el = (await fixture(
    html`<lr-tool-select-dialog .tools=${TOOLS} .selectedToolIds=${['web_search', 'run_python']}></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.equal('Select tools');
  expect(el.shadowRoot!.querySelector('[part="subtitle"]')!.textContent).to.equal('2 of 5 tools enabled');
});

it('treats supplied heading and search labels literally, including former English defaults and empty strings', async () => {
  const el = (await fixture(html`
    <lr-tool-select-dialog
      label="Select tools"
      search-placeholder="Search tools…"
      .strings=${{
        selectTools: 'Werkzeuge auswählen',
        searchToolsPlaceholder: 'Werkzeuge suchen…',
      }}
    ></lr-tool-select-dialog>
  `)) as LyraToolSelectDialog;
  const title = (): string => el.shadowRoot!.querySelector('[part="title"]')!.textContent ?? '';
  const search = (): HTMLInputElement => el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;

  expect(title()).to.equal('Select tools');
  expect(search().placeholder).to.equal('Search tools…');

  el.label = '';
  el.searchPlaceholder = '';
  await el.updateComplete;
  expect(title()).to.equal('');
  expect(search().placeholder).to.equal('');

  el.label = undefined;
  el.searchPlaceholder = undefined;
  await el.updateComplete;
  expect(title()).to.equal('Werkzeuge auswählen');
  expect(search().placeholder).to.equal('Werkzeuge suchen…');
});

it('keeps an empty search placeholder visually empty while retaining a localized accessible name', async () => {
  const el = await fixture<LyraToolSelectDialog>(html`
    <lr-tool-select-dialog
      open
      search-placeholder=""
      .strings=${{ searchToolsPlaceholder: 'Filter available tools' }}
      .tools=${TOOLS}
    ></lr-tool-select-dialog>
  `);
  const search = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;

  expect(search.placeholder).to.equal('');
  expect(search.getAttribute('aria-label')).to.equal('Filter available tools');
  await expect(el).to.be.accessible();
});

it('hides the subtitle entirely when no tools are supplied', async () => {
  const el = (await fixture(
    html`<lr-tool-select-dialog .tools=${[]}></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  expect(el.shadowRoot!.querySelector('[part="subtitle"]')!.hasAttribute('hidden')).to.be.true;
});

it('groups tools by category in first-seen order, with an uncategorized "Other" bucket last', async () => {
  const el = (await fixture(
    html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const headings = [...el.shadowRoot!.querySelectorAll('[part="category-heading"]')].map(categoryHeadingName);
  expect(headings).to.deep.equal(['Research', 'Code execution', 'Other']);
});

it('keeps a caller category literally named "Other" separate from the uncategorized bucket', async () => {
  const el = (await fixture(html`
    <lr-tool-select-dialog
      .strings=${{ otherCategory: 'Uncategorized' }}
      .tools=${[
        { id: 'explicit-other', name: 'Explicit other', category: 'Other' },
        { id: 'research', name: 'Research tool', category: 'Research' },
        { id: 'uncategorized', name: 'No category' },
      ]}
    ></lr-tool-select-dialog>
  `)) as LyraToolSelectDialog;
  const headings = [...el.shadowRoot!.querySelectorAll('[part="category-heading"]')].map(categoryHeadingName);
  const groups = [...el.shadowRoot!.querySelectorAll('[part="category"]')];

  expect(headings).to.deep.equal(['Other', 'Research', 'Uncategorized']);
  expect(groups).to.have.length(3);
  expect(groups[0]!.querySelector('[value="explicit-other"]')).to.exist;
  expect(groups[2]!.querySelector('[value="uncategorized"]')).to.exist;
});

it('shows the tool count next to each category heading', async () => {
  const el = (await fixture(
    html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const count = el.shadowRoot!.querySelector('[part="category-heading"] [part="category-count"]');
  expect(count!.textContent).to.equal('2');
});

it('hides the visual category count from assistive tech and pairs it with a full-sentence sr-only announcement', async () => {
  const el = (await fixture(
    html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`,
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
    html`<lr-tool-select-dialog
      .tools=${[{ id: 'solo', name: 'Solo tool', category: 'Solo' }]}
    ></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const heading = el.shadowRoot!.querySelector('[part="category-heading"]')!;
  expect(heading.querySelector('.sr-only')!.textContent).to.equal('1 tool');
});

it('contains unbroken public label, category, and tool content inside a 320px dialog', async () => {
  const long = `ToolIdentifier${'WithoutNaturalBreaks'.repeat(40)}`;
  const el = (await fixture(html`
    <lr-tool-select-dialog
      open
      style="inset-inline-end: auto; inline-size: 320px; block-size: 480px;"
      .label=${long}
      .tools=${[
        {
          id: 'long-tool',
          name: long,
          description: long,
          category: long,
          disabled: true,
          disabledReason: long,
        },
      ]}
    ></lr-tool-select-dialog>
  `)) as LyraToolSelectDialog;

  const assertContained = () => {
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    const title = el.shadowRoot!.querySelector('[part="title"]') as HTMLElement;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const category = el.shadowRoot!.querySelector('[part="category"]') as HTMLElement;
    const heading = el.shadowRoot!.querySelector('[part="category-heading"]') as HTMLElement;
    const checkbox = checkboxFor(el, 'long-tool');
    const row = checkbox.closest('[part="tool-row"]') as HTMLElement;
    const disabledReason = row.querySelector('[part="tool-disabled-reason"]') as HTMLElement;
    const count = heading.querySelector('[part="category-count"]') as HTMLElement;
    const base = checkbox.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

    expect(Math.ceil(el.getBoundingClientRect().width)).to.be.at.most(320);
    for (const part of [panel, title, body, category, heading, row, checkbox, disabledReason]) {
      expect(
        part.scrollWidth,
        `${part.getAttribute('part') ?? part.localName} must not create horizontal overflow`,
      ).to.be.at.most(Math.ceil(part.clientWidth) + 1);
    }
    const panelRect = panel.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    const countRect = count.getBoundingClientRect();
    expect(count.textContent).to.equal('1');
    expect(countRect.width).to.be.greaterThan(0);
    expect(countRect.left).to.be.at.least(headingRect.left - 1);
    expect(countRect.right).to.be.at.most(headingRect.right + 1);
    for (const rect of [checkbox.getBoundingClientRect(), base.getBoundingClientRect()]) {
      expect(rect.left).to.be.at.least(panelRect.left - 1);
      expect(rect.right).to.be.at.most(panelRect.right + 1);
      expect(rect.left).to.be.at.least(bodyRect.left - 1);
      expect(rect.right).to.be.at.most(bodyRect.right + 1);
    }
  };

  assertContained();
  el.dir = 'rtl';
  await el.updateComplete;
  assertContained();
});

it('shows a disabled row with its disabledReason as supporting text, and a disabled checkbox', async () => {
  const el = (await fixture(
    html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const checkbox = checkboxFor(el, 'run_shell');
  expect(checkbox.disabled).to.be.true;
  const row = checkbox.closest('[part="tool-row"]') as HTMLElement;
  expect(row.hasAttribute('data-disabled')).to.be.true;
  expect(row.querySelector('[part="tool-disabled-reason"]')!.textContent).to.equal('Requires admin approval.');
});

it('does not render a disabled-reason paragraph for an enabled row', async () => {
  const el = (await fixture(
    html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const row = checkboxFor(el, 'web_search').closest('[part="tool-row"]') as HTMLElement;
  expect((row.querySelector('[part="tool-disabled-reason"]')) == null).to.be.true;
});

it('keeps the tool name as the checkbox name and bridges description/reason as supporting text', async () => {
  const el = (await fixture(
    html`<lr-tool-select-dialog .tools=${[{
      id: 'run_shell',
      name: 'Run shell command',
      description: 'Execute a shell command.',
      disabled: true,
      disabledReason: 'Requires admin approval.',
    }]}></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  const checkbox = checkboxFor(el, 'run_shell');
  await checkbox.updateComplete;
  const owner = checkbox.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  const label = checkbox.shadowRoot!.querySelector<HTMLElement>('[part="label"]')!;
  const hint = checkbox.shadowRoot!.querySelector<HTMLElement>('[part~="hint"]')!;
  const assignedText = (container: HTMLElement) => [...container.querySelectorAll('slot')]
    .flatMap((slot) => slot.assignedNodes({ flatten: true }))
    .map((node) => node.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  expect(owner.getAttribute('aria-labelledby')).to.equal(label.id);
  const describedByElements = Reflect.get(owner, 'ariaDescribedByElements') as unknown;
  if (Array.isArray(describedByElements)) {
    expect(describedByElements).to.include(hint);
  } else {
    expect(owner.getAttribute('aria-describedby')).to.equal(hint.id);
  }
  expect(assignedText(label)).to.equal('Run shell command');
  expect(assignedText(hint)).to.equal(
    'Execute a shell command. Requires admin approval.',
  );
});

describe('search filtering', () => {
  it('filters case-insensitively against name and description', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`,
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

  it('contains native search input after committing query state without preventing the native event', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div><lr-tool-select-dialog open .tools=${TOOLS}></lr-tool-select-dialog></div>
    `);
    const el = wrapper.querySelector('lr-tool-select-dialog') as LyraToolSelectDialog;
    const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
    let hostInputs = 0;
    let ancestorInputs = 0;
    let queryDuringInput = '';
    el.addEventListener('input', () => hostInputs += 1);
    wrapper.addEventListener('input', () => ancestorInputs += 1);
    input.addEventListener('input', () => {
      queryDuringInput = (el as unknown as { query: string }).query;
    });

    input.value = 'python';
    const nativeInput = new Event('input', { bubbles: true, cancelable: true, composed: true });
    input.dispatchEvent(nativeInput);

    expect(queryDuringInput).to.equal('python');
    expect(nativeInput.defaultPrevented).to.equal(false);
    expect(hostInputs).to.equal(0);
    expect(ancestorInputs).to.equal(0);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]').length).to.equal(1);
    expect(checkboxFor(el, 'run_python').value).to.equal('run_python');
  });

  it('hides a category entirely once it has zero matching tools, rather than an empty heading', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`,
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
      html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`,
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
      html`<lr-tool-select-dialog .tools=${[]}></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent!.trim()).to.equal('No tools available.');
  });

  it('localizes the no-tools-available message via .strings', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog
        .tools=${[]}
        .strings=${{ toolSelectNoneAvailable: 'Aucun outil disponible.' }}
      ></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent!.trim()).to.equal('Aucun outil disponible.');
  });

  it('honors a custom filter override in place of the default name/description match', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`,
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
      html`<lr-tool-select-dialog open .tools=${TOOLS}></lr-tool-select-dialog>`,
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
  it('emits lr-change with the tool added to selected when its checkbox is checked', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog .tools=${TOOLS} .selectedToolIds=${['web_search']}></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const listener = oneEvent(el, 'lr-change');
    clickCheckbox(checkboxFor(el, 'run_python'));
    const { detail } = await listener;

    expect(detail.useDefaults).to.be.false;
    expect(detail.selectedToolIds).to.have.members(['web_search', 'run_python']);
    expect(el.selectedToolIds).to.have.members(['web_search', 'run_python']);
  });

  it('emits lr-change with the tool removed from selected when its checkbox is unchecked', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog
        .tools=${TOOLS}
        .selectedToolIds=${['web_search', 'run_python']}
      ></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const listener = oneEvent(el, 'lr-change');
    clickCheckbox(checkboxFor(el, 'web_search'));
    const { detail } = await listener;

    expect(detail.selectedToolIds).to.deep.equal(['run_python']);
    expect(el.selectedToolIds).to.deep.equal(['run_python']);
  });

  it('proposes a checkbox change before committing and restores its checkbox when lr-change is canceled', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog .tools=${TOOLS} .selectedToolIds=${['web_search']}></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const checkbox = checkboxFor(el, 'web_search');
    let proposal: ToolSelectionChangeDetail | undefined;
    let selectedAtProposal: string[] | undefined;
    let useDefaultsAtProposal: boolean | undefined;
    let cancelable = false;
    el.addEventListener('lr-change', (event) => {
      const change = event as CustomEvent<ToolSelectionChangeDetail>;
      proposal = change.detail;
      selectedAtProposal = [...el.selectedToolIds];
      useDefaultsAtProposal = el.useDefaults;
      cancelable = change.cancelable;
      change.preventDefault();
    }, { once: true });

    clickCheckbox(checkbox);
    await checkbox.updateComplete;
    await el.updateComplete;

    expect(cancelable).to.be.true;
    expect(proposal).to.deep.equal({ selectedToolIds: [], useDefaults: false });
    expect(selectedAtProposal).to.deep.equal(['web_search']);
    expect(useDefaultsAtProposal).to.be.false;
    expect(el.selectedToolIds).to.deep.equal(['web_search']);
    expect(checkbox.checked).to.be.true;
  });

  it('emits one host lr-change for one bubbling tool-checkbox lr-change', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog .tools=${TOOLS} .selectedToolIds=${[]}></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    let count = 0;
    el.addEventListener('lr-change', () => count++);

    clickCheckbox(checkboxFor(el, 'web_search'));
    await el.updateComplete;

    expect(count).to.equal(1);
  });

  it('contains the tool checkbox native and prefixed input/change events at the dialog boundary', async () => {
    const el = await fixture<LyraToolSelectDialog>(html`
      <lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>
    `);
    const leaked = { input: 0, change: 0, lrInput: 0 };
    let aggregateChanges = 0;
    el.addEventListener('input', () => leaked.input++);
    el.addEventListener('change', () => leaked.change++);
    el.addEventListener('lr-input', () => leaked.lrInput++);
    el.addEventListener('lr-change', () => aggregateChanges++);

    clickCheckbox(checkboxFor(el, 'web_search'));
    await el.updateComplete;

    expect(leaked).to.deep.equal({ input: 0, change: 0, lrInput: 0 });
    expect(aggregateChanges).to.equal(1);
  });

  it('ignores clicks on a data-disabled tool row', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog .tools=${TOOLS} .selectedToolIds=${[]}></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    let fired = false;
    el.addEventListener('lr-change', () => (fired = true));
    clickCheckbox(checkboxFor(el, 'run_shell'));
    await el.updateComplete;

    expect(fired).to.be.false;
    expect(el.selectedToolIds).to.deep.equal([]);
  });
});

describe('useDefaults', () => {
  it('defaults to false and leaves rows enabled', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    expect(el.useDefaults).to.be.false;
    expect(checkboxFor(el, 'web_search').disabled).to.be.false;
    expect((el.shadowRoot!.querySelector('[part="defaults-hint"]')) == null).to.be.true;
  });

  it('disables every non-individually-disabled row and shows a hint while true', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog use-defaults .tools=${TOOLS} .selectedToolIds=${['web_search']}></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    expect(checkboxFor(el, 'web_search').disabled).to.be.true;
    expect(checkboxFor(el, 'web_search').checked).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="defaults-hint"]')).to.exist;
  });

  it('flips useDefaults false and emits lr-change when the switch is turned off', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog use-defaults .tools=${TOOLS} .selectedToolIds=${['web_search']}></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const toggle = el.shadowRoot!.querySelector('[part="defaults-toggle"]') as HTMLElement;
    const base = toggle.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

    const listener = oneEvent(el, 'lr-change');
    base.click();
    const { detail } = await listener;

    expect(el.useDefaults).to.be.false;
    expect(el.hasAttribute('use-defaults')).to.be.false;
    expect(detail.useDefaults).to.be.false;
    expect(detail.selectedToolIds).to.deep.equal(['web_search']);
    expect(checkboxFor(el, 'web_search').disabled).to.be.false;
  });

  it('proposes a defaults change before committing and restores its switch when lr-change is canceled', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog use-defaults .tools=${TOOLS} .selectedToolIds=${['web_search']}></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const toggle = el.shadowRoot!.querySelector('[part="defaults-toggle"]') as LyraSwitch;
    const base = toggle.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    let proposal: ToolSelectionChangeDetail | undefined;
    let selectedAtProposal: string[] | undefined;
    let useDefaultsAtProposal: boolean | undefined;
    let cancelable = false;
    el.addEventListener('lr-change', (event) => {
      const change = event as CustomEvent<ToolSelectionChangeDetail>;
      proposal = change.detail;
      selectedAtProposal = [...el.selectedToolIds];
      useDefaultsAtProposal = el.useDefaults;
      cancelable = change.cancelable;
      change.preventDefault();
    }, { once: true });

    base.click();
    await toggle.updateComplete;
    await el.updateComplete;

    expect(cancelable).to.be.true;
    expect(proposal).to.deep.equal({ selectedToolIds: ['web_search'], useDefaults: false });
    expect(selectedAtProposal).to.deep.equal(['web_search']);
    expect(useDefaultsAtProposal).to.be.true;
    expect(el.useDefaults).to.be.true;
    expect(el.hasAttribute('use-defaults')).to.be.true;
    expect(toggle.checked).to.be.true;
    expect(checkboxFor(el, 'web_search').disabled).to.be.true;
  });

  it('emits one host lr-change for one bubbling defaults-toggle lr-change', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog use-defaults .tools=${TOOLS}></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const toggle = el.shadowRoot!.querySelector('[part="defaults-toggle"]') as HTMLElement;
    const base = toggle.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    let count = 0;
    el.addEventListener('lr-change', () => count++);

    base.click();
    await el.updateComplete;

    expect(count).to.equal(1);
  });

  it('contains the defaults switch native and prefixed input/change events at the dialog boundary', async () => {
    const el = await fixture<LyraToolSelectDialog>(html`
      <lr-tool-select-dialog use-defaults .tools=${TOOLS}></lr-tool-select-dialog>
    `);
    const toggle = el.shadowRoot!.querySelector('[part="defaults-toggle"]') as LyraSwitch;
    const leaked = { input: 0, change: 0, lrInput: 0 };
    let aggregateChanges = 0;
    el.addEventListener('input', () => leaked.input++);
    el.addEventListener('change', () => leaked.change++);
    el.addEventListener('lr-input', () => leaked.lrInput++);
    el.addEventListener('lr-change', () => aggregateChanges++);

    (toggle.shadowRoot!.querySelector('[part~="base"]') as HTMLElement).click();
    await el.updateComplete;

    expect(leaked).to.deep.equal({ input: 0, change: 0, lrInput: 0 });
    expect(aggregateChanges).to.equal(1);
  });
});

describe('dismissal', () => {
  it('offers consistent show() and hide() lifecycle methods', async () => {
    const el = await fixture<LyraToolSelectDialog>(html`
      <lr-tool-select-dialog></lr-tool-select-dialog>
    `);
    el.show();
    await el.updateComplete;
    expect(el.open).to.be.true;
    const closed = oneEvent(el, 'lr-close');
    el.hide();
    expect((await closed).detail).to.equal('api');
    expect(el.open).to.be.false;
  });

  it('does not light-dismiss on a backdrop click unless explicitly enabled', async () => {
    const el = await fixture<LyraToolSelectDialog>(html`
      <lr-tool-select-dialog open></lr-tool-select-dialog>
    `);
    const reasons: string[] = [];
    el.addEventListener('lr-close', (event) => reasons.push(event.detail));
    (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
    await el.updateComplete;

    expect(el.lightDismiss).to.be.false;
    expect(el.open).to.be.true;
    expect(reasons).to.deep.equal([]);
  });

  it('closes on backdrop click with reason "backdrop" when light dismissal is enabled', async () => {
    const el = await fixture<LyraToolSelectDialog>(html`
      <lr-tool-select-dialog open light-dismiss></lr-tool-select-dialog>
    `);
    const listener = oneEvent(el, 'lr-close');
    (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
    const { detail } = await listener;

    expect(el.open).to.be.false;
    expect(detail).to.equal('backdrop');
  });

  it('closes on Escape and emits lr-close with reason "escape"', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog open></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const listener = oneEvent(el, 'lr-close');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const { detail } = await listener;

    expect(el.open).to.be.false;
    expect(detail).to.equal('escape');
  });

  it('does not respond to Escape while closed', async () => {
    const el = (await fixture(html`<lr-tool-select-dialog></lr-tool-select-dialog>`)) as LyraToolSelectDialog;
    let fired = false;
    el.addEventListener('lr-close', () => (fired = true));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await el.updateComplete;

    expect(fired).to.be.false;
  });

  it('close() is a no-op when already closed (no duplicate event, no error)', async () => {
    const el = (await fixture(html`<lr-tool-select-dialog></lr-tool-select-dialog>`)) as LyraToolSelectDialog;
    let count = 0;
    el.addEventListener('lr-close', () => count++);

    el.close('api');
    el.close('api');
    await el.updateComplete;

    expect(count).to.equal(0);
  });

  it('close() sets open false, emits with the given reason, and is idempotent once closed', async () => {
    const el = (await fixture(html`<lr-tool-select-dialog open></lr-tool-select-dialog>`)) as LyraToolSelectDialog;
    let count = 0;
    let detail: unknown;
    el.addEventListener('lr-close', (e) => {
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
      html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    el.open = true;
    await el.updateComplete;

    expect((el.shadowRoot!.activeElement) === (el.shadowRoot!.querySelector('[part="search-input"]'))).to.equal(true);
  });

  it('returns focus to the element that was focused before the dialog opened', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'open';
    document.body.appendChild(trigger);
    trigger.focus();

    const el = (await fixture(
      html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    el.open = true;
    await el.updateComplete;
    expect((el.shadowRoot!.activeElement) === (el.shadowRoot!.querySelector('[part="search-input"]'))).to.equal(true);

    el.close('api');
    await el.updateComplete;
    expect((document.activeElement) === (trigger)).to.equal(true);

    trigger.remove();
  });

  it('re-dispatches bubbling, composed focus/blur events from the search input on the host', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog open .tools=${TOOLS}></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    await el.updateComplete;
    const searchInput = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
    // Opening already moved focus to the search input (see the sibling test
    // above); blur it first so the subsequent .focus() actually fires a new
    // native focus event to bridge.
    searchInput.blur();
    await el.updateComplete;

    const focusPromise = oneEvent(el, 'focus');
    searchInput.focus();
    const focusEvent = await focusPromise;
    expect(focusEvent.bubbles).to.be.true;
    expect(focusEvent.composed).to.be.true;

    const blurPromise = oneEvent(el, 'blur');
    searchInput.blur();
    const blurEvent = await blurPromise;
    expect(blurEvent.bubbles).to.be.true;
    expect(blurEvent.composed).to.be.true;
  });

  it('traps Tab focus inside the panel, wrapping last->first and first->last', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog open .tools=${TOOLS}
        ><div slot="footer"><button>last</button></div></lr-tool-select-dialog
      >`,
    )) as LyraToolSelectDialog;
    await el.updateComplete;
    const last = el.querySelector('[slot="footer"] button') as HTMLButtonElement;
    const searchInput = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;

    last.focus();
    const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabForward);
    expect(tabForward.defaultPrevented).to.be.true;
    expect((el.shadowRoot!.activeElement) === (searchInput)).to.equal(true);

    const tabBackward = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(tabBackward);
    expect(tabBackward.defaultPrevented).to.be.true;
    expect((document.activeElement) === (last)).to.equal(true);
  });

  it('traps Tab/Shift+Tab at a slotted element whose focusable target lives in its own shadow root', async () => {
    const el = (await fixture(
      html`<lr-tool-select-dialog open
        ><tool-select-dialog-test-shadow-input slot="footer"></tool-select-dialog-test-shadow-input
      ></lr-tool-select-dialog>`,
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
    expect((el.shadowRoot!.activeElement) === (searchInput)).to.equal(true);

    const tabBackward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(tabBackward);
    expect(tabBackward.defaultPrevented).to.be.true;
    expect((shadowHost.shadowRoot!.activeElement) === (input)).to.equal(true);
  });
});

describe('scroll lock', () => {
  it('locks document scroll while open and releases it on close', async () => {
    const el = (await fixture(html`<lr-tool-select-dialog></lr-tool-select-dialog>`)) as LyraToolSelectDialog;
    el.open = true;
    await el.updateComplete;
    expect(document.documentElement.style.overflow).to.equal('hidden');

    el.close('api');
    await el.updateComplete;
    expect(document.documentElement.style.overflow).to.equal('');
  });

  it('releases the scroll lock on disconnect while open', async () => {
    const el = (await fixture(html`<lr-tool-select-dialog open></lr-tool-select-dialog>`)) as LyraToolSelectDialog;
    await el.updateComplete;
    expect(document.documentElement.style.overflow).to.equal('hidden');

    el.remove();

    expect(document.documentElement.style.overflow).to.equal('');
  });
});

describe('footer slot', () => {
  it('hides the footer wrapper when nothing is slotted into it, shows it once slotted', async () => {
    const el = (await fixture(html`<lr-tool-select-dialog></lr-tool-select-dialog>`)) as LyraToolSelectDialog;
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
      html`<lr-tool-select-dialog><button slot="footer">Done</button></lr-tool-select-dialog>`,
    )) as LyraToolSelectDialog;
    const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
    expect(footer.hasAttribute('hidden')).to.be.false;
  });

  it('keeps an unbroken slotted footer action reachable inside a 320px allocation', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div style="inline-size:320px;block-size:480px">
        <lr-tool-select-dialog
          open
          style="position:relative;inset:auto;display:flex;inline-size:320px;block-size:480px;box-sizing:border-box"
          .tools=${TOOLS}
        >
          <button slot="footer">${'FinishSelectionWithoutNaturalBreaks'.repeat(10)}</button>
        </lr-tool-select-dialog>
      </div>
    `);
    const el = wrapper.querySelector('lr-tool-select-dialog') as LyraToolSelectDialog;
    const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!;
    const footer = el.shadowRoot!.querySelector<HTMLElement>('[part="footer"]')!;
    const action = el.querySelector<HTMLButtonElement>('[slot="footer"]')!;

    expect(Math.ceil(el.getBoundingClientRect().width)).to.be.at.most(320);
    expect(footer.scrollWidth).to.be.at.most(footer.clientWidth + 1);
    expect(action.getBoundingClientRect().left).to.be.at.least(panel.getBoundingClientRect().left - 1);
    expect(action.getBoundingClientRect().right).to.be.at.most(panel.getBoundingClientRect().right + 1);
  });
});

it('is accessible while closed', async () => {
  const el = (await fixture(html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`)) as LyraToolSelectDialog;
  await expect(el).to.be.accessible();
});

it('is accessible while open with grouped, disabled, and use-defaults-locked tools', async () => {
  const el = (await fixture(
    html`<lr-tool-select-dialog
      open
      .tools=${TOOLS}
      .selectedToolIds=${['web_search', 'run_python']}
    ></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  await el.updateComplete;
  await expect(el).to.be.accessible();

  el.useDefaults = true;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it("renders the search-input's placeholder with the live quiet color at full opacity", async () => {
  const el = (await fixture(html`
    <lr-tool-select-dialog
      style="--lr-color-text-quiet: rgb(1, 2, 3)"
      .tools=${TOOLS}
    ></lr-tool-select-dialog>
  `)) as LyraToolSelectDialog;
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
  const placeholder = getComputedStyle(input, '::placeholder');
  expect(placeholder.color).to.equal('rgb(1, 2, 3)');
  expect(placeholder.opacity).to.equal('1');
});

it('renders the native search field without cancel or decoration chrome', async () => {
  const el = (await fixture(html`<lr-tool-select-dialog open .tools=${TOOLS}></lr-tool-select-dialog>`)) as LyraToolSelectDialog;
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
  expect(input.type).to.equal('search');
  expect(getComputedStyle(input).appearance).to.equal('textfield');
  input.value = 'python';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const bounds = input.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'click',
      position: [Math.floor(bounds.right - 8), Math.floor(bounds.top + bounds.height / 2)],
    });
    expect(input.value).to.equal('python');
    expect((el as unknown as { query: string }).query).to.equal('python');
  } finally {
    await resetMouse();
  }
});

it('uses locale-aware case folding for the built-in search', async () => {
  const el = (await fixture(html`
    <lr-tool-select-dialog
      lang="tr"
      open
      .tools=${[{ id: 'one', name: 'İstanbul' }]}
    ></lr-tool-select-dialog>
  `)) as LyraToolSelectDialog;
  const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
  input.value = 'istanbul';
  input.dispatchEvent(new Event('input'));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]')).to.have.lengthOf(1);
});

it('ignores programmatic child toggles while a tool is logically disabled', async () => {
  const tool: ToolSelectDialogTool = { id: 'locked', name: 'Locked', disabled: true };
  const el = (await fixture(
    html`<lr-tool-select-dialog open .tools=${[tool]}></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  el.shadowRoot!.querySelector('lr-checkbox')!.dispatchEvent(
    new CustomEvent('lr-change', { detail: { checked: true }, bubbles: true, composed: true }),
  );
  expect(el.selectedToolIds).to.deep.equal([]);
});

it('counts only unique known selected ids in the summary', async () => {
  const el = (await fixture(html`
    <lr-tool-select-dialog
      open
      .tools=${[
        { id: 'one', name: 'One' },
        { id: 'two', name: 'Two' },
      ]}
      .selectedToolIds=${['one', 'one', 'missing']}
    ></lr-tool-select-dialog>
  `)) as LyraToolSelectDialog;
  expect(el.shadowRoot!.querySelector('[part="subtitle"]')!.textContent!.trim()).to.equal('1 of 2 tools enabled');
});

it('uses the first tool for a duplicate id across grouping, rendering, counting, and selection events', async () => {
  const el = await fixture<LyraToolSelectDialog>(html`
    <lr-tool-select-dialog
      open
      .tools=${[
        { id: 'same', name: 'First definition', category: 'First category' },
        { id: 'same', name: 'Second definition', category: 'Second category' },
      ]}
      .selectedToolIds=${['same', 'same']}
    ></lr-tool-select-dialog>
  `);

  expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]')).to.have.length(1);
  expect(el.shadowRoot!.querySelector('[part="tool-name"]')!.textContent!.trim()).to.equal('First definition');
  expect(el.shadowRoot!.querySelectorAll('[part="category"]')).to.have.length(1);
  expect(el.shadowRoot!.querySelector('[part="subtitle"]')!.textContent!.trim()).to.equal('1 of 1 tools enabled');

  const pending = oneEvent(el, 'lr-change');
  const defaults = el.shadowRoot!.querySelector('lr-switch')!;
  defaults.dispatchEvent(new CustomEvent('lr-change', {
    detail: { checked: true },
    bubbles: true,
    composed: true,
  }));
  expect((await pending).detail.selectedToolIds).to.deep.equal(['same']);
});

it('omits blank tool and selected identities before grouping, counting, and events', async () => {
  const el = await fixture<LyraToolSelectDialog>(html`
    <lr-tool-select-dialog
      open
      .tools=${[
        { id: '', name: 'Empty' },
        { id: '   ', name: 'Blank' },
        { id: 'kept', name: 'Kept' },
      ]}
      .selectedToolIds=${['', '   ', 'kept']}
    ></lr-tool-select-dialog>
  `);

  expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]')).to.have.length(1);
  expect(el.shadowRoot!.querySelector('[part="tool-name"]')!.textContent!.trim()).to.equal('Kept');
  expect(el.shadowRoot!.querySelector('[part="subtitle"]')!.textContent!.trim()).to.equal('1 of 1 tools enabled');

  const pending = oneEvent(el, 'lr-change');
  el.shadowRoot!.querySelector('lr-switch')!.dispatchEvent(new CustomEvent('lr-change', {
    detail: { checked: true },
    bubbles: true,
    composed: true,
  }));
  expect((await pending).detail.selectedToolIds).to.deep.equal(['kept']);
});

it('drops malformed tool identities while retaining a valid neighboring tool', async () => {
  const el = await fixture<LyraToolSelectDialog>(html`
    <lr-tool-select-dialog
      open
      .tools=${[
        null,
        { name: 'Missing id' },
        { id: 42, name: 'Numeric id' },
        { id: 'kept', name: 'Kept' },
      ] as unknown as ToolSelectDialogTool[]}
    ></lr-tool-select-dialog>
  `);

  expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]')).to.have.length(1);
  expect(el.shadowRoot!.querySelector('[part="tool-name"]')!.textContent!.trim()).to.equal('Kept');
});

it('admits only descriptor-safe fully valid tool rows and lets a later valid duplicate win', async () => {
  let accessorReads = 0;
  const accessorTool = { id: 'accessor' } as Record<string, unknown>;
  Object.defineProperty(accessorTool, 'name', {
    configurable: true,
    enumerable: true,
    get() {
      accessorReads += 1;
      return 'Must not be read';
    },
  });
  const revoked = Proxy.revocable({ id: 'revoked', name: 'Revoked' }, {});
  revoked.revoke();
  const nullPrototypeTool = Object.assign(Object.create(null) as Record<string, unknown>, {
    id: 'null-prototype',
    name: 'Null prototype tool',
  });
  const inheritedTool = Object.create({ id: 'inherited', name: 'Inherited tool' });
  class CustomTool {
    id = 'custom-prototype';
    name = 'Custom prototype tool';
  }

  const el = await fixture<LyraToolSelectDialog>(html`
    <lr-tool-select-dialog
      open
      .tools=${[
        null,
        17,
        { id: 42, name: 'Numeric identity' },
        { name: 'Missing identity' },
        { id: 'same' },
        { id: 'same', name: 'Later valid duplicate' },
        { id: 'invalid-disabled', name: 'Invalid disabled', disabled: 'true' },
        { id: 'invalid-description', name: 'Invalid description', description: 42 },
        accessorTool,
        revoked.proxy,
        inheritedTool,
        new CustomTool(),
        nullPrototypeTool,
        { id: 'later', name: 'Later selectable sibling' },
      ] as unknown as ToolSelectDialogTool[]}
    ></lr-tool-select-dialog>
  `);

  const names = Array.from(
    el.shadowRoot!.querySelectorAll<HTMLElement>('[part="tool-name"]'),
    (node) => node.textContent?.trim() ?? '',
  );
  expect(names).to.deep.equal([
    'Later valid duplicate',
    'Null prototype tool',
    'Later selectable sibling',
  ]);
  expect(accessorReads).to.equal(0);
});

it('rejects a custom prototype that spoofs the Object constructor', async () => {
  const spoofedPrototype = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(spoofedPrototype, 'constructor', {
    configurable: true,
    enumerable: true,
    value: Object,
  });
  const spoofedTool = Object.create(spoofedPrototype) as Record<string, unknown>;
  Object.defineProperties(spoofedTool, {
    id: { configurable: true, enumerable: true, value: 'spoofed' },
    name: { configurable: true, enumerable: true, value: 'Spoofed tool' },
  });

  const el = await fixture<LyraToolSelectDialog>(html`<lr-tool-select-dialog open></lr-tool-select-dialog>`);
  // The public collection boundary correctly snapshots custom-prototype rows into ordinary data
  // records. Exercise this schema validator directly as a defense-in-depth boundary too: a
  // subclass or internal producer can still provide a pre-owned collection without that outer
  // snapshot step.
  Object.defineProperty(el, 'tools', {
    configurable: true,
    value: [spoofedTool, { id: 'kept', name: 'Kept neighboring tool' }],
  });
  el.requestUpdate('tools');
  await el.updateComplete;

  const names = Array.from(
    el.shadowRoot!.querySelectorAll<HTMLElement>('[part="tool-name"]'),
    (node) => node.textContent?.trim() ?? '',
  );
  expect(names).to.deep.equal(['Kept neighboring tool']);
});

it('rejects a forged custom constructor that mimics Object', async () => {
  function CustomRecord(): void {}
  Object.setPrototypeOf(CustomRecord.prototype, null);
  Object.defineProperty(CustomRecord, 'name', {
    configurable: true,
    value: 'Object',
  });
  const forgedTool = Object.create(CustomRecord.prototype) as Record<string, unknown>;
  Object.defineProperties(forgedTool, {
    id: { configurable: true, enumerable: true, value: 'forged' },
    name: { configurable: true, enumerable: true, value: 'Forged tool' },
  });

  const el = await fixture<LyraToolSelectDialog>(html`<lr-tool-select-dialog open></lr-tool-select-dialog>`);
  // As above, exercise the component's inner schema boundary without the public collection
  // snapshot normalizing this hostile prototype into an ordinary record first.
  Object.defineProperty(el, 'tools', {
    configurable: true,
    value: [forgedTool, { id: 'kept', name: 'Kept neighboring tool' }],
  });
  el.requestUpdate('tools');
  await el.updateComplete;

  const names = Array.from(
    el.shadowRoot!.querySelectorAll<HTMLElement>('[part="tool-name"]'),
    (node) => node.textContent?.trim() ?? '',
  );
  expect(names).to.deep.equal(['Kept neighboring tool']);
});

it('admits a cross-realm plain tool record through the descriptor-safe schema guard', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const foreignWindow = frame.contentWindow as Window & typeof globalThis;
  const foreignTool = foreignWindow.JSON.parse('{"id":"foreign","name":"Foreign tool"}') as ToolSelectDialogTool;
  const nullPrototypeTool = Object.assign(Object.create(null) as Record<string, unknown>, {
    id: 'null-prototype',
    name: 'Null prototype tool',
  });
  const el = await fixture<LyraToolSelectDialog>(html`<lr-tool-select-dialog open></lr-tool-select-dialog>`);

  // Bypass the outer owned snapshot so the foreign realm's actual Object constructor reaches
  // this component-private guard. Normal public assignment intentionally normalizes it first.
  Object.defineProperty(el, 'tools', {
    configurable: true,
    value: [foreignTool, nullPrototypeTool],
  });
  el.requestUpdate('tools');
  await el.updateComplete;

  const names = Array.from(
    el.shadowRoot!.querySelectorAll<HTMLElement>('[part="tool-name"]'),
    (node) => node.textContent?.trim() ?? '',
  );
  expect(names).to.deep.equal(['Foreign tool', 'Null prototype tool']);
});

it('requires runtime arrays and retains independently valid selected identities absent from tools', async () => {
  const el = await fixture<LyraToolSelectDialog>(html`
    <lr-tool-select-dialog
      open
      .tools=${{ id: 'not-an-array', name: 'Not an array' } as unknown as ToolSelectDialogTool[]}
      .selectedToolIds=${'not-an-array' as unknown as readonly string[]}
    ></lr-tool-select-dialog>
  `);
  expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]')).to.have.length(0);

  el.tools = [{ id: 'known', name: 'Known tool' }];
  el.selectedToolIds = ['outside', 'known', 'outside', '', '   '];
  await el.updateComplete;
  expect(checkboxFor(el, 'known').checked).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="subtitle"]')!.textContent!.trim()).to.equal('1 of 1 tools enabled');

  const proposed = oneEvent(el, 'lr-change');
  el.shadowRoot!.querySelector('lr-switch')!.dispatchEvent(new CustomEvent('lr-change', {
    detail: { checked: true },
    bubbles: true,
    composed: true,
  }));
  expect((await proposed).detail.selectedToolIds).to.deep.equal(['outside', 'known']);
});

it('bounds a newly checked tool selection before its immutable change detail is emitted', async () => {
  const independentlyRetainedIds = Array.from(
    { length: 9_999 },
    (_, index) => `outside-${index}`,
  );
  const el = await fixture<LyraToolSelectDialog>(html`
    <lr-tool-select-dialog
      open
      .tools=${[
        { id: 'already-known', name: 'Already known tool' },
        { id: 'new-known', name: 'New known tool' },
      ]}
      .selectedToolIds=${[...independentlyRetainedIds, 'already-known']}
    ></lr-tool-select-dialog>
  `);

  const proposed = oneEvent(el, 'lr-change');
  checkboxFor(el, 'new-known').dispatchEvent(new CustomEvent('lr-change', {
    detail: { checked: true },
    bubbles: true,
    composed: true,
  }));
  const event = await proposed;

  expect(event.detail).not.to.equal(null);
  expect(event.detail.selectedToolIds).to.have.length(10_000);
  expect(event.detail.selectedToolIds.slice(0, -1)).to.deep.equal(independentlyRetainedIds);
  expect(event.detail.selectedToolIds.at(-1)).to.equal('new-known');
  expect(event.detail.selectedToolIds).not.to.include('already-known');

  await el.updateComplete;
  expect(el.selectedToolIds).to.deep.equal(event.detail.selectedToolIds);
});

it('preserves sequential accepted tool toggles in the same update turn', async () => {
  const el = await fixture<LyraToolSelectDialog>(html`
    <lr-tool-select-dialog
      open
      .tools=${[
        { id: 'first', name: 'First tool' },
        { id: 'second', name: 'Second tool' },
      ]}
    ></lr-tool-select-dialog>
  `);

  for (const id of ['first', 'second']) {
    checkboxFor(el, id).dispatchEvent(new CustomEvent('lr-change', {
      detail: { checked: true },
      bubbles: true,
      composed: true,
    }));
  }

  await el.updateComplete;
  expect(el.selectedToolIds).to.deep.equal(['first', 'second']);
});

it('merges an external selection write with a synchronous later tool toggle', async () => {
  const el = await fixture<LyraToolSelectDialog>(html`
    <lr-tool-select-dialog
      open
      .tools=${[
        { id: 'first', name: 'First tool' },
        { id: 'second', name: 'Second tool' },
      ]}
    ></lr-tool-select-dialog>
  `);

  // The external controlled write queues Lit's update. A user toggle can arrive before that
  // queue flushes, so it must derive from the newly written selection rather than the prior
  // render's cache.
  el.selectedToolIds = ['first'];
  checkboxFor(el, 'second').dispatchEvent(new CustomEvent('lr-change', {
    detail: { checked: true },
    bubbles: true,
    composed: true,
  }));

  await el.updateComplete;
  expect(el.selectedToolIds).to.deep.equal(['first', 'second']);
});

it('contains per-row custom-filter failures while retaining a later selectable sibling', async () => {
  const calls: string[] = [];
  const el = await fixture<LyraToolSelectDialog>(html`
    <lr-tool-select-dialog
      open
      .tools=${[
        { id: 'throws', name: 'Throwing row' },
        { id: 'later', name: 'Later selectable sibling' },
      ]}
    ></lr-tool-select-dialog>
  `);
  el.filter = (tool) => {
    calls.push(tool.id);
    if (tool.id === 'throws') throw new Error('filter failure');
    return true;
  };
  const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
  input.value = 'any query';
  input.dispatchEvent(new Event('input'));
  await el.updateComplete;

  expect(calls).to.deep.equal(['throws', 'later']);
  expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]')).to.have.length(1);
  expect(checkboxFor(el, 'later').checked).to.equal(false);
  const proposed = oneEvent(el, 'lr-change');
  clickCheckbox(checkboxFor(el, 'later'));
  expect((await proposed).detail.selectedToolIds).to.deep.equal(['later']);
});

it('bounds a large catalog while reserving selected identities and a keyboard-reachable continuation', async () => {
  const tools: ToolSelectDialogTool[] = Array.from({ length: 201 }, (_, index) => ({
    id: `tool-${index}`,
    name: `Tool ${index}`,
  }));
  const el = (await fixture(
    html`<lr-tool-select-dialog
      open
      .tools=${tools}
      .selectedToolIds=${['tool-200']}
      .strings=${{
        toolSelectLimit: 'Only {count} tools are currently mounted.',
        loadMore: 'Show the next tools',
      }}
    ></lr-tool-select-dialog>`,
  )) as LyraToolSelectDialog;
  expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]').length).to.equal(200);
  expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.include(
    'Only 200 tools are currently mounted.',
  );
  expect(el.shadowRoot!.querySelectorAll('lr-checkbox[value="tool-200"]')).to.have.length(1);
  expect(checkboxFor(el, 'tool-200').checked).to.be.true;
  expect(el.shadowRoot!.querySelectorAll('lr-checkbox[value="tool-199"]')).to.have.length(0);
  const loadMore = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="load-more"]')!;
  expect(loadMore.textContent!.trim()).to.equal('Show the next tools');

  loadMore.focus();
  loadMore.click();
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]').length).to.equal(201);
  expect(el.shadowRoot!.querySelectorAll('[part="load-more"]').length).to.equal(0);
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('body');
  expect(checkboxFor(el, 'tool-200').checked).to.be.true;
});

it('lets search reach a matching tool beyond the initial projection without mounting the full catalog', async () => {
  const tools: ToolSelectDialogTool[] = Array.from({ length: 1_000 }, (_, index) => ({
    id: `tool-${index}`,
    name: `Tool ${index}`,
  }));
  const el = (await fixture(html`
    <lr-tool-select-dialog
      open
      .tools=${tools}
      .strings=${{ toolSelectLimit: 'Only {count} tools are currently mounted.', loadMore: 'Load more' }}
    ></lr-tool-select-dialog>
  `)) as LyraToolSelectDialog;
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;

  input.value = 'Tool 999';
  input.dispatchEvent(new Event('input'));
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]').length).to.equal(1);
  expect(checkboxFor(el, 'tool-999').value).to.equal('tool-999');
  expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
});
