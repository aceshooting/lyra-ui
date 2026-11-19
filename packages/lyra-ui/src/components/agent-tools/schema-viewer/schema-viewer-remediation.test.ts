import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './schema-viewer.js';
import type { JsonSchemaNode, LyraJsonSchemaViewer } from './schema-viewer.js';

describe('lr-json-schema-viewer remediation', () => {
  it('paints the selected trigger and keeps its hover and press distinct', async () => {
    const el = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer data-lr-theme-scope
      style="--lr-json-schema-viewer-selected-bg: rgb(20, 60, 100); --lr-transition-fast: 0s"
      selected-path="" .schema=${{ properties: { child: { type: 'string' } } }}></lr-json-schema-viewer>`);
    const selected = el.shadowRoot!.querySelector<HTMLElement>('[aria-pressed="true"]')!;
    const child = el.shadowRoot!.querySelector<HTMLElement>('[aria-pressed="false"]')!;
    const resting = getComputedStyle(selected).backgroundColor;
    expect(resting).to.equal('rgb(20, 60, 100)');
    expect(getComputedStyle(child).backgroundColor).not.to.equal(resting);
    try {
      await hoverUntilMatched(selected, 'selected node did not receive hover');
      await waitUntil(() => getComputedStyle(selected).backgroundColor !== resting, 'selected hover did not paint');
      const hovered = getComputedStyle(selected).backgroundColor;
      await sendMouse({ type: 'down' });
      await waitUntil(() => getComputedStyle(selected).backgroundColor !== hovered, 'selected press did not paint');
      expect(getComputedStyle(selected).backgroundColor).not.to.equal(resting);
    } finally {
      await resetMouse();
    }
  });

  it('outlines the selected trigger in forced colors', async () => {
    try {
      await setForcedColors('active');
      const el = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer selected-path=""
        .schema=${{ properties: { child: { type: 'string' } } }}></lr-json-schema-viewer>`);
      if (matchMedia('(forced-colors: active)').matches) {
        expect(getComputedStyle(el.shadowRoot!.querySelector('[aria-pressed="true"]')!).outlineStyle).to.equal('solid');
        expect(getComputedStyle(el.shadowRoot!.querySelector('[aria-pressed="false"]')!).outlineStyle).to.equal('none');
      }
    } finally {
      await setForcedColors('none');
    }
  });

  it('renders malformed non-structural keywords without throwing', async () => {
    const schema = {
      title: { not: 'text' },
      properties: {
        odd: { type: [7, 'string', {}], enum: 5, examples: { a: 1 }, $ref: 12, description: { text: 'x' } },
        bare: { type: { kind: 'object' } },
      },
    } as unknown as JsonSchemaNode;
    const el = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer .schema=${schema}></lr-json-schema-viewer>`);
    const odd = el.shadowRoot!.querySelector('[data-path="/properties/odd"]')!;
    expect(odd.querySelector('[part="type"]')!.textContent).to.equal('Type: ⁦string⁩');
    expect(el.shadowRoot!.querySelector('[data-path="/properties/bare"] [part="type"]') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[data-path=""] [part="name"]')!.textContent).to.equal('$');
    const text = el.shadowRoot!.textContent!;
    expect(text).to.not.include('enum:');
    expect(text).to.not.include('$ref:');
    expect(text).to.not.include('[object Object]');
  });

  it('never resolves a selected path through inherited property names', async () => {
    const schema: JsonSchemaNode = {
      properties: Object.fromEntries(Array.from({ length: 600 }, (_, i) => [`p${i}`, { type: 'number' }])),
    };
    const el = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer .schema=${schema} selected-path="/properties/constructor"></lr-json-schema-viewer>`);
    const limit = el.shadowRoot!.querySelector('[part="limit"]');
    expect(limit !== null).to.equal(true);
    expect(limit!.getAttribute('role')).to.equal('note');
    expect(el.shadowRoot!.querySelectorAll('[part~="node-trigger"]').length).to.be.lessThan(601);
  });

  it('walks node triggers with the shared list policy and leaves modified arrows alone', async () => {
    const schema: JsonSchemaNode = { properties: { a: { type: 'string' }, b: { type: 'string' } } };
    const el = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer .schema=${schema}></lr-json-schema-viewer>`);
    const triggers = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="node-trigger"]')];
    await focusByKeyboard(triggers[0]!);
    const down = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true });
    triggers[0]!.dispatchEvent(down);
    expect(down.defaultPrevented).to.equal(true);
    expect(el.shadowRoot!.activeElement === triggers[1]).to.equal(true);
    const composing = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true, isComposing: true });
    triggers[1]!.dispatchEvent(composing);
    expect(composing.defaultPrevented).to.equal(false);
    const end = new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true, cancelable: true });
    triggers[1]!.dispatchEvent(end);
    expect(el.shadowRoot!.activeElement === triggers[triggers.length - 1]).to.equal(true);
    const pastEnd = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true });
    triggers[triggers.length - 1]!.dispatchEvent(pastEnd);
    expect(el.shadowRoot!.activeElement === triggers[triggers.length - 1]).to.equal(true);
  });

  it('marks the issue render-limit notice as a note', async () => {
    const schema: JsonSchemaNode = { type: 'object' };
    const issues = Array.from({ length: 600 }, (_, i) => ({ path: '', message: `issue ${i}`, severity: 'error' as const }));
    const el = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer .schema=${schema} .issues=${issues}></lr-json-schema-viewer>`);
    const notice = el.shadowRoot!.querySelector('[part="issue-limit"]');
    expect(notice !== null && notice.getAttribute('role') === 'note').to.equal(true);
  });
});
