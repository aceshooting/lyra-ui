import { expect, fixture } from '@open-wc/testing';
import { unsafeStatic, html as staticHtml } from 'lit/static-html.js';
import '../lr-agent-eval-dashboard.js';
import '../lr-change-review.js';
import '../lr-agent-run.js';
import '../lr-eval-run.js';
import '../lr-artifact-panel.js';
import '../lr-activity-feed.js';
import '../lr-permission-rules.js';
import '../lr-browser-frame.js';
import '../lr-eval-dataset.js';
import '../lr-eval-result.js';
import '../lr-subagent-panel.js';

/** Element structure and text, ignoring per-instance generated ids. */
function shape(root: ShadowRoot): string {
  const parts = [...root.querySelectorAll('[part]')].map((node) => `${node.localName}[${node.getAttribute('part')}]`);
  return `${parts.join(',')}|${root.textContent?.replace(/\s+/g, ' ').trim()}`;
}

async function mount(tag: string, values: Record<string, unknown>): Promise<HTMLElement> {
  const el = await fixture<HTMLElement & { updateComplete: Promise<unknown> }>(staticHtml`<${unsafeStatic(`lr-${tag}`)}></${unsafeStatic(`lr-${tag}`)}>`);
  Object.assign(el, values);
  await el.updateComplete;
  return el;
}

const cases: [string, string[]][] = [
  ['agent-eval-dashboard', ['metrics', 'runs']],
  ['change-review', ['files']],
  ['agent-run', ['metrics']],
  ['eval-run', ['examples']],
  ['artifact-panel', ['versions']],
  ['activity-feed', ['entries']],
  ['permission-rules', ['rules']],
  ['browser-frame', ['pings']],
  ['eval-dataset', ['examples']],
  ['eval-result', ['runs', 'columns', 'rubricKeys']],
  ['subagent-panel', ['runs']],
];

for (const [tag, properties] of cases) {
  it(`renders not-yet-loaded null ${properties.join('/')} on lr-${tag} exactly like empty collections`, async () => {
    const empty = await mount(tag, Object.fromEntries(properties.map((name) => [name, []])));
    const unloaded = await mount(tag, Object.fromEntries(properties.map((name) => [name, null])));
    expect(shape(unloaded.shadowRoot!)).to.equal(shape(empty.shadowRoot!));
  });
}

for (const [tag, fallback] of [['agent-eval-dashboard', '2'], ['change-review', '2']] as const) {
  it(`restores the default heading level ${fallback} on lr-${tag} when heading-level is removed`, async () => {
    const el = await mount(tag, { label: 'Overview' });
    const level = () => el.shadowRoot!.querySelector('[role="heading"]')?.getAttribute('aria-level');
    expect(level()).to.equal(fallback);
    el.setAttribute('heading-level', '5');
    await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    expect(level()).to.equal('5');
    el.removeAttribute('heading-level');
    await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    expect(level()).to.equal(fallback);
  });
}
