/** Load matching Lyra UI locale catalogs in the application before mounting translated chrome. */
import { css, html, render } from 'lit';
import '@aceshooting/lyra-ui/components/lr-button.js';
import '@aceshooting/lyra-ui/components/lr-input.js';
import '@aceshooting/lyra-ui/components/lr-select.js';
import '@aceshooting/lyra-ui/components/lr-option.js';
import { LyraMessageParts } from '@aceshooting/lyra-ui/components/lr-message-parts.js';
import type { LyraSelect } from '@aceshooting/lyra-ui/components/lr-select.js';
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { LyraGenViewElement } from '@aceshooting/lyra-gen/gen-view.js';
import { createGuidedDemo, guidedDemoScenarios, type GuidedDemoLocale } from './guided-demo.js';

const styles = css`
  [data-guided-demo] {
    display: grid; gap: var(--lr-space-l); min-inline-size: 0; max-inline-size: 100%;
    color: var(--lr-color-text); background: var(--lr-color-surface);
    font-family: var(--lr-font); line-height: var(--lr-line-height-normal);
  }
  [data-guided-demo] :where(h2, h3, p, ol) { margin-block: 0; overflow-wrap: anywhere; }
  [data-guided-demo] h2 { font-size: var(--lr-font-size-2xl); }
  [data-guided-demo] h3 { font-size: var(--lr-font-size-lg); }
  [data-guided-demo] :where(header, section, form) { display: grid; gap: var(--lr-space-m); min-inline-size: 0; }
  [data-guided-demo] :where([data-actions], [data-provenance], ol) { display: flex; flex-wrap: wrap; gap: var(--lr-space-s); align-items: center; }
  [data-guided-demo] ol { padding-inline-start: var(--lr-space-l); gap: var(--lr-space-l); }
  [data-guided-demo] [aria-current='step'] { font-weight: var(--lr-font-weight-bold); color: var(--lr-color-brand); }
  [data-guided-demo] [data-provenance] { font-size: var(--lr-font-size-sm); color: var(--lr-color-text-quiet); }
  [data-guided-demo] [data-travel-fields] {
    display: grid; gap: var(--lr-space-m);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--lr-size-12rem)), 1fr));
  }
  [data-guided-demo] :where(lr-input, lr-select, lr-button, lr-message-parts, lr-gen-view) { min-inline-size: 0; max-inline-size: 100%; }
  [data-guided-demo] lr-button { justify-self: start; }
  [data-guided-demo] [data-guided-island] { padding-block: var(--lr-space-s); }
  [data-guided-demo] details { min-inline-size: 0; }
  [data-guided-demo] summary { cursor: pointer; min-block-size: var(--lr-icon-button-size); align-content: center; }
  [data-guided-demo] summary:hover { color: var(--lr-color-brand); }
  [data-guided-demo] summary:focus-visible { outline: var(--lr-focus-ring); outline-offset: var(--lr-focus-ring-offset); }
  [data-guided-demo] pre { white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--lr-font-mono); font-size: var(--lr-font-size-sm); }
`;
type UpdatingElement = HTMLElement & { readonly updateComplete: Promise<unknown> };
type Action = 'next' | 'back' | 'replay' | 'follow-up' | 'send' | 'apply';

export function mountGuidedDemo(root: HTMLElement, options: { readonly locale?: GuidedDemoLocale; readonly packageVersion: string }) {
  const element = root.ownerDocument.createElement('section');
  element.dataset['guidedDemo'] = '';
  const transcript = new LyraMessageParts();
  transcript.contentMode = 'plain';
  const shells = new Map<string, { readonly shell: HTMLElement; view?: LyraGenViewElement }>();
  let disposed = false;
  let actionGeneration = 0;
  let busyAction: Action | undefined;
  let hostFailure = false;
  const controller = createGuidedDemo({ ...options, onChange: paint });
  transcript.renderPart = part => part.type === 'data' && part.name === 'lyra-gen-island' ? shells.get(part.id)?.shell : undefined;

  async function run(action: Action, work: () => Promise<boolean>) {
    if (disposed) return;
    const generation = ++actionGeneration;
    busyAction = action; hostFailure = false;
    try { await work(); }
    catch { if (!disposed && generation === actionGeneration) hostFailure = true; }
    finally { if (!disposed && generation === actionGeneration) { busyAction = undefined; paint(); } }
  }
  function select(event: Event) {
    const value = (event.currentTarget as LyraSelect).value;
    if (typeof value !== 'string') return;
    actionGeneration++; busyAction = undefined; hostFailure = false;
    controller.selectScenario(value);
  }
  function submitFollowUp(event: Event) {
    event.preventDefault();
    if (controller.snapshot.phase === 'playing') return;
    const question = new FormData(event.currentTarget as HTMLFormElement).get('question');
    if (typeof question === 'string') void run('send', () => controller.submitFollowUp(question));
  }
  function submitTravel(event: Event) {
    event.preventDefault();
    if (controller.snapshot.phase === 'playing') return;
    const values = new FormData(event.currentTarget as HTMLFormElement);
    void run('apply', () => controller.editTravel({ nights: Number(values.get('nights')), travelers: Number(values.get('travelers')), budget: Number(values.get('budget')) }));
  }
  function paint() {
    if (disposed) return;
    const snapshot = controller.snapshot;
    const labels = snapshot.labels;
    const playing = snapshot.phase === 'playing';
    const loading = (action: Action) => playing && busyAction === action;
    const blocked = (action: Action) => playing && busyAction !== action;
    const focused = root.ownerDocument.activeElement;
    const focusedAction = focused && element.contains(focused) ? focused.getAttribute('data-action') : null;
    const focusPrompt = !playing && (snapshot.step === 2 && ['next', 'follow-up', 'send'].includes(focusedAction ?? '') || snapshot.step === 0 && focusedAction === 'back');
    const focusReplay = focusedAction === 'cancel' && snapshot.phase === 'cancelled' || focusedAction === 'failure' && snapshot.phase === 'error';
    element.lang = snapshot.locale; element.dir = snapshot.direction;
    element.dataset['scenario'] = snapshot.scenario;
    element.dataset['step'] = String(snapshot.step);
    element.dataset['phase'] = snapshot.phase;
    transcript.locale = snapshot.locale;
    transcript.setAttribute('aria-label', labels.answer);
    const scenarioLabel = (id: typeof guidedDemoScenarios[number]) => id === 'markets' ? labels.markets : id === 'weather' ? labels.weather : labels.travel;
    const live = new Set(snapshot.chat.islands.map(island => island.partId));
    for (const [id, record] of shells) if (!live.has(id)) { record.shell.remove(); shells.delete(id); }
    for (const [index, island] of snapshot.chat.islands.entries()) {
      let record = shells.get(island.partId);
      if (!record) {
        const shell = root.ownerDocument.createElement('div');
        shell.dataset['guidedIsland'] = ''; shell.setAttribute('role', 'group');
        record = { shell }; shells.set(island.partId, record);
      }
      record.shell.setAttribute('aria-label', index === 0 ? labels.authoredReply : index === 1 ? scenarioLabel(snapshot.scenario) : labels.invalid);
      if (island.document && !record.view) {
        const view = new LyraGenViewElement();
        view.catalog = initialCatalog; view.locale = snapshot.locale;
        record.view = view;
        const current = record;
        const settle = () => {
          const accepted = controller.snapshot.chat.islands.find(candidate => candidate.partId === island.partId);
          if (!disposed && shells.get(island.partId) === current && accepted?.document === view.document) current.shell.setAttribute('aria-busy', 'false');
        };
        view.addEventListener('lr-gen-ready', settle);
        view.addEventListener('lr-gen-error', settle);
      }
      const view = record.view;
      if (view && island.document) {
        view.toggleAttribute('data-dashboard', island.document.root.id === 'dashboard');
        view.document = island.document;
      }
      record.shell.setAttribute('aria-busy', island.status === 'loading' || island.status === 'ready' && view?.status !== 'ready' ? 'true' : 'false');
      render(island.status === 'ready' && view ? html`${view}` : html`<p>${island.fallback}</p>`, record.shell);
    }
    transcript.parts = snapshot.chat.parts;
    render(html`<style>${styles.cssText}</style>
      <header>
        <h2>${labels.title}</h2>
        <div data-provenance><span data-simulation>${labels.simulatedData}</span><span data-scripted>${labels.authoredReply}</span></div>
        <lr-select .label=${labels.scenario} .value=${snapshot.scenario} @lr-change=${select}>
          ${guidedDemoScenarios.map(id => html`<lr-option .value=${id}>${scenarioLabel(id)}</lr-option>`)}
        </lr-select>
        <ol aria-label=${labels.title}>${[labels.prompt, labels.answer, labels.followUp].map((label, index) => html`<li aria-current=${snapshot.step === index ? 'step' : 'false'}>${label}</li>`)}</ol>
        <div data-actions>
          <lr-button data-action="back" type="button" appearance="outlined" wrap .disabled=${snapshot.step === 0 || blocked('back')} .loading=${loading('back')} @click=${() => { void run('back', () => controller.back()); }}>${labels.back}</lr-button>
          <lr-button data-action="next" type="button" variant="brand" wrap .disabled=${snapshot.step === 2 || blocked('next')} .loading=${loading('next')} @click=${() => { void run('next', () => controller.next()); }}>${labels.next}</lr-button>
          <lr-button data-action="replay" type="button" appearance="outlined" wrap .disabled=${blocked('replay')} .loading=${loading('replay')} @click=${() => { void run('replay', () => controller.replay()); }}>${labels.replay}</lr-button>
          <lr-button data-action="cancel" type="button" appearance="outlined" wrap .disabled=${!playing} @click=${() => controller.cancel()}>${labels.cancel}</lr-button>
        </div>
      </header>
      <p role="status" aria-atomic="true">${hostFailure ? labels.invalid : snapshot.status}</p>
      <section><h3 data-prompt-title tabindex="-1">${labels.prompt}</h3><p>${snapshot.step === 2 ? snapshot.followUp.question : snapshot.prompt}</p></section>
      ${snapshot.scenario === 'travel-budget' ? html`<form data-travel aria-label=${labels.travel} @submit=${submitTravel}>
        <div data-travel-fields>
          <lr-input name="nights" type="number" .label=${labels.nights} .value=${String(snapshot.travel.inputs.nights)} .min=${1} .max=${30} .step=${1} .readonly=${playing} required></lr-input>
          <lr-input name="travelers" type="number" .label=${labels.travelers} .value=${String(snapshot.travel.inputs.travelers)} .min=${1} .max=${8} .step=${1} .readonly=${playing} required></lr-input>
          <lr-input name="budget" type="number" .label=${labels.budget} .value=${String(snapshot.travel.inputs.budget)} .min=${0} .max=${100000} .step=${0.01} .readonly=${playing} required></lr-input>
        </div>
        <lr-button data-action="apply" type="submit" appearance="outlined" wrap .disabled=${blocked('apply')} .loading=${loading('apply')}>${labels.apply}</lr-button>
      </form>` : ''}
      <section><h3>${labels.answer}</h3>${transcript}</section>
      ${snapshot.step !== 0 ? html`<section>
        <h3>${labels.followUp}</h3>
        <lr-button data-action="follow-up" type="button" appearance="outlined" wrap .disabled=${snapshot.step !== 1 || blocked('follow-up')} .loading=${loading('follow-up')} @click=${() => { void run('follow-up', () => controller.followUp(snapshot.followUp.id)); }}>${snapshot.followUp.question}</lr-button>
        <form aria-label=${labels.followUp} @submit=${submitFollowUp}>
          <lr-input name="question" .label=${labels.followUp} .value=${snapshot.followUp.question} .readonly=${playing || snapshot.step !== 1} .maxlength=${4096} required></lr-input>
          <lr-button data-action="send" type="submit" appearance="outlined" wrap .disabled=${snapshot.step !== 1 || blocked('send')} .loading=${loading('send')}>${labels.send}</lr-button>
        </form>
      </section>` : ''}
      <lr-button data-action="failure" type="button" appearance="plain" wrap .disabled=${snapshot.phase !== 'complete'} @click=${() => controller.fail()}>${labels.failure}</lr-button>
      <details><summary>${labels.source}</summary><pre data-source-text dir="ltr">${snapshot.source}</pre></details>`, element);
    if (focusPrompt) element.querySelector<HTMLElement>('[data-prompt-title]')?.focus({ preventScroll: true });
    if (focusReplay) {
      const replay = element.querySelector<UpdatingElement>('[data-action="replay"]');
      if (replay) void replay.updateComplete.then(() => {
        const active = root.ownerDocument.activeElement;
        if (!disposed && controller.snapshot === snapshot && (active === focused || active === root.ownerDocument.body)) replay.focus({ preventScroll: true });
      });
    }
  }
  root.append(element); paint();
  const ready = Promise.all([transcript.updateComplete, ...[...element.querySelectorAll<UpdatingElement>('lr-button, lr-select, lr-input')].map(control => control.updateComplete)]).then(() => undefined);
  return { controller, transcript, element, ready,
    dispose() {
      if (disposed) return;
      disposed = true; actionGeneration++; controller.dispose(); transcript.renderPart = undefined;
      render(null, element); shells.clear(); element.remove();
    },
  };
}
