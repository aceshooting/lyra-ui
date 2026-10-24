import { expect, waitUntil } from '@open-wc/testing';
import { LyraElement } from './internal/lyra-element.js';
import { LYRA_DEFAULT_STRINGS } from './internal/localization.js';
import { registerLyraLocale } from './internal/localization-runtime.js';
import { ROOT_BARREL_TAGS } from './internal/root-registration-allowlist.js';
import { tag } from './internal/prefix.js';
import './components/lr-agent-workspace.js';
import './components/lr-branch-picker.js';
import './components/lr-combobox.js';
import './components/lr-copy-button.js';
import './components/lr-emoji-picker.js';
import './components/lr-export-button.js';
import './components/lr-generation-metrics.js';
import './components/lr-ingestion-queue.js';
import './components/lr-json-schema-viewer.js';
import './components/lr-json-viewer.js';
import './components/lr-known-date.js';
import './components/lr-locale-picker.js';
import './components/lr-markdown-core.js';
import './components/lr-mention-popover.js';
import './components/lr-model-settings-panel.js';
import './components/lr-model-viewer.js';
import './components/lr-option.js';
import './components/lr-rag-eval-dashboard.js';
import './components/lr-selection-toolbar.js';
import './components/lr-stream-status.js';
import './components/lr-test-results.js';

const DESTINATION_LOCALE = 'fr';
registerLyraLocale(DESTINATION_LOCALE, {
  ...LYRA_DEFAULT_STRINGS,
  copy: 'Destination copy',
  branchNext: 'Destination next',
  streamResume: 'Destination resume',
  selectionAsk: 'Destination ask',
});

interface AdoptionCase {
  readonly tag: (typeof ROOT_BARREL_TAGS)[number];
  readonly properties: Readonly<Record<string, unknown>>;
  readonly text?: string;
  readonly label?: readonly [selector: string, expected: string];
  prepare?(element: LyraElement, scope: HTMLElement): void;
  verify?(element: LyraElement, locale: string): void | Promise<void>;
}

function shadowText(root: Element | ShadowRoot): string {
  let result = root.textContent ?? '';
  for (const child of root.querySelectorAll('*')) {
    if (child.shadowRoot) result += shadowText(child.shadowRoot);
  }
  return result;
}

async function settleTree(element: LyraElement): Promise<void> {
  for (let pass = 0; pass < 4; pass += 1) {
    const pending: Promise<unknown>[] = [element.updateComplete];
    const visit = (root: Element | ShadowRoot): void => {
      for (const child of root.querySelectorAll('*')) {
        if (child instanceof LyraElement) pending.push(child.updateComplete);
        if (child.shadowRoot) visit(child.shadowRoot);
      }
    };
    if (element.shadowRoot) visit(element.shadowRoot);
    await Promise.all(pending);
  }
}

const CASES: readonly AdoptionCase[] = [
  { tag: 'lr-json-schema-viewer', properties: { schema: { type: 'object', properties: { adoptionField: { type: 'string' } } } }, text: 'adoptionField' },
  { tag: 'lr-test-results', properties: { suites: [{ id: 'suite', name: 'Adoption suite', tests: [{ id: 'test', name: 'Adoption test', status: 'passed' }] }] }, text: 'Adoption suite' },
  { tag: 'lr-agent-workspace', properties: { label: 'Adoption workspace', messages: [{ id: 'message', role: 'user', text: 'Adoption conversation' }] }, text: 'Adoption conversation' },
  { tag: 'lr-branch-picker', properties: { count: 3, index: 1, label: 'Adoption branches' }, label: ['[role="group"]', 'Adoption branches'], verify: (element, locale) => {
    const next = element.shadowRoot!.querySelector('[part="next-button"]');
    expect(next?.getAttribute('aria-label')).to.equal(locale === DESTINATION_LOCALE ? 'Destination next' : LYRA_DEFAULT_STRINGS.branchNext);
    expect(element.shadowRoot!.querySelector('[part="position"]')?.textContent).to.include('3');
  } },
  { tag: 'lr-generation-metrics', properties: { status: 'running', startedAt: Date.now(), tokenCount: 12 }, verify: element => {
    expect(element.shadowRoot!.querySelector('[part="tokens"]')?.textContent).to.include('12');
    expect(element.shadowRoot!.querySelector('[part="stop-button"]')?.getAttribute('aria-label')).to.equal(LYRA_DEFAULT_STRINGS.stopGenerating);
  } },
  { tag: 'lr-markdown-core', properties: { content: 'Adoption **markdown**' }, text: 'Adoption markdown' },
  { tag: 'lr-model-settings-panel', properties: { model: 'adoption-model', catalog: ['adoption-model'], temperature: 1.5 }, verify: (element, locale) => {
    expect(element.shadowRoot!.querySelector('[part="temperature-value"]')?.textContent).to.include(new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(1.5));
    expect(Reflect.get(element.shadowRoot!.querySelector('[part="model-select"]')!, 'value')).to.equal('adoption-model');
  } },
  { tag: 'lr-selection-toolbar', properties: { text: 'Adoption selection', label: 'Adoption selection actions', actions: ['ask'], rect: new DOMRectReadOnly(10, 10, 20, 20) }, verify: async (element, locale) => {
    Reflect.set(element, 'open', true);
    await settleTree(element);
    expect(element.shadowRoot!.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).to.equal('Adoption selection actions');
    const actions = element.shadowRoot!.querySelectorAll<HTMLElement>('[part~="action"]');
    expect(actions.length).to.equal(1);
    expect(actions[0]!.textContent?.trim()).to.equal(locale === DESTINATION_LOCALE ? 'Destination ask' : LYRA_DEFAULT_STRINGS.selectionAsk);
    let detail: unknown;
    const listener = (event: Event) => { detail = (event as CustomEvent<unknown>).detail; };
    element.addEventListener('lr-selection-action', listener);
    try { actions[0]!.click(); } finally { element.removeEventListener('lr-selection-action', listener); }
    expect(detail).to.deep.equal({ action: 'ask', text: 'Adoption selection', anchor: null });
  } },
  { tag: 'lr-stream-status', properties: { connectionState: 'interrupted', resumable: true }, verify: (element, locale) => {
    const button = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="resume"]');
    expect(button?.textContent).to.equal(locale === DESTINATION_LOCALE ? 'Destination resume' : LYRA_DEFAULT_STRINGS.streamResume);
    let resumed = 0;
    const listener = () => { resumed += 1; };
    element.addEventListener('lr-resume', listener);
    try { button!.click(); } finally { element.removeEventListener('lr-resume', listener); }
    expect(resumed).to.equal(1);
  } },
  { tag: 'lr-combobox', properties: { label: 'Adoption choices', value: 'adoption' }, prepare: element => {
    const option = document.createElement(tag('option'));
    option.setAttribute('value', 'adoption'); option.textContent = 'Adoption choice'; element.append(option);
  }, verify: element => {
    expect(element.shadowRoot!.querySelector<HTMLInputElement>('input[role="combobox"]')?.value).to.equal('Adoption choice');
    expect(Reflect.get(element, 'value')).to.equal('adoption');
  } },
  { tag: 'lr-emoji-picker', properties: { label: 'Adoption emoji', groups: [{ key: 'adoption', label: 'Adoption group', emojis: [{ emoji: '😀', name: 'Adoption smile' }] }] }, text: 'Adoption group' },
  { tag: 'lr-locale-picker', properties: { label: 'Adoption locale', withoutFlags: true, locales: [{ tag: 'en', label: 'Adoption English' }], value: 'en' }, text: 'Adoption English' },
  { tag: 'lr-ingestion-queue', properties: { items: [{ id: 'document', document: { id: 'document', name: 'Adoption document' }, stage: 'done' }] }, text: 'Adoption document' },
  { tag: 'lr-rag-eval-dashboard', properties: { withoutChart: true, label: 'Adoption evaluations' }, label: ['[part="base"]', 'Adoption evaluations'] },
  { tag: 'lr-copy-button', properties: { value: 'Adoption clipboard value', tooltip: 'none' }, verify: (element, locale) => {
    expect(element.shadowRoot!.querySelector('[part~="base"]')?.getAttribute('aria-label')).to.equal(locale === DESTINATION_LOCALE ? 'Destination copy' : LYRA_DEFAULT_STRINGS.copy);
  } },
  { tag: 'lr-export-button', properties: { label: 'Adoption export', rows: [{ value: 'adoption' }] }, text: 'Adoption export' },
  { tag: 'lr-json-viewer', properties: { data: { adoption: 'Adoption JSON' } }, text: 'Adoption JSON' },
  { tag: 'lr-known-date', properties: { value: '2026-10-24', label: 'Adoption date' }, verify: element => {
    expect(element.shadowRoot!.querySelector<HTMLInputElement>('input[data-field="year"]')?.value).to.equal('2026');
    expect(element.shadowRoot!.querySelector<HTMLInputElement>('input[data-field="day"]')?.value).to.equal('24');
  } },
  { tag: 'lr-mention-popover', properties: { items: [{ suggestionId: 'adoption', label: 'Adoption mention' }] }, prepare: (element, scope) => {
    const anchor = document.createElement('input');
    scope.prepend(anchor); Reflect.set(element, 'anchor', anchor);
  }, verify: async element => {
    Reflect.set(element, 'open', true); await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[role="option"]')?.textContent).to.include('Adoption mention');
  } },
  { tag: 'lr-model-viewer', properties: { alt: 'Adoption model alternative', name: 'adoption.glb' }, text: 'Adoption model alternative' },
];

describe('document adoption contracts', () => {
  for (const scenario of CASES) {
    it(`${scenario.tag} retains its rendered public state and rebinds document locale and theme`, async () => {
      expect(ROOT_BARREL_TAGS.includes(scenario.tag)).to.equal(true);
      const frame = document.createElement('iframe');
      document.body.append(frame);
      const destination = frame.contentDocument!;
      destination.documentElement.lang = DESTINATION_LOCALE;
      destination.documentElement.dir = 'rtl';
      destination.documentElement.style.setProperty('--lr-theme-font-family-body', 'monospace');
      destination.documentElement.style.setProperty('--lr-theme-font-family-mono', 'monospace');
      const home = document.createElement('div');
      home.lang = 'en-US'; home.dir = 'ltr';
      const scope = document.createElement('div');
      const element = document.createElement(scenario.tag) as LyraElement;
      const theme = document.documentElement.style;
      const fontInputs = ['--lr-theme-font-family-body', '--lr-theme-font-family-mono'];
      const previousFonts = fontInputs.map(name => ({ name, value: theme.getPropertyValue(name), priority: theme.getPropertyPriority(name) }));
      for (const name of fontInputs) theme.setProperty(name, 'serif');
      for (const [name, value] of Object.entries(scenario.properties)) Reflect.set(element, name, value);
      scope.append(element); scenario.prepare?.(element, scope); home.append(scope); document.body.append(home);
      const verify = async (owner: Document, locale: string, direction: string, font: string): Promise<void> => {
        await settleTree(element);
        expect(element.ownerDocument === owner).to.equal(true);
        expect(owner.defaultView!.getComputedStyle(element).direction).to.equal(direction);
        expect(owner.defaultView!.getComputedStyle(element).fontFamily).to.equal(font);
        if (scenario.text) await waitUntil(() => shadowText(element.shadowRoot!).includes(scenario.text!));
        if (scenario.label) expect(element.shadowRoot!.querySelector(scenario.label[0])?.getAttribute('aria-label')).to.equal(scenario.label[1]);
        await scenario.verify?.(element, locale);
      };
      try {
        await verify(document, 'en-US', 'ltr', 'serif');
        destination.body.append(destination.adoptNode(scope));
        await verify(destination, DESTINATION_LOCALE, 'rtl', 'monospace');
        home.append(document.adoptNode(scope));
        await verify(document, 'en-US', 'ltr', 'serif');
      } finally {
        element.remove(); scope.remove(); home.remove(); frame.remove();
        for (const { name, value, priority } of previousFonts) {
          if (value) theme.setProperty(name, value, priority);
          else theme.removeProperty(name);
        }
      }
    });
  }
});
