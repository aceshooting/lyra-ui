import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './tool-result-dialog.js';
import '../tool-approval-dialog/tool-approval-dialog.js';
import '../tool-select-dialog/tool-select-dialog.js';
import type { LyraToolResultDialog } from './tool-result-dialog.js';
import type { LyraToolApprovalDialog } from '../tool-approval-dialog/tool-approval-dialog.js';
import type { LyraToolSelectDialog } from '../tool-select-dialog/tool-select-dialog.js';

const body = (el: HTMLElement): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
const overflows = (el: HTMLElement): boolean => el.scrollHeight - el.clientHeight > 1;

const manyTools = Array.from({ length: 120 }, (_, i) => ({ id: `tool-${i}`, name: `Tool ${i}` }));
const manyArgs = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`key${i}`, 'x'.repeat(40)]));

describe('capped tool dialog bodies are keyboard-scrollable only while they overflow', () => {
  it('result dialog: slotted prose taller than the cap gets a named tab stop', async () => {
    const el = await fixture<LyraToolResultDialog>(html`<lr-tool-result-dialog open tool-name="Search">
      <div slot="body" style="block-size: 4000px">tall</div>
    </lr-tool-result-dialog>`);
    await waitUntil(() => body(el).getAttribute('tabindex') === '0', 'overflowing body never became focusable');
    expect(overflows(body(el))).to.equal(true);
    expect(body(el).getAttribute('role')).to.equal('region');
    expect(body(el).getAttribute('aria-label')).to.equal('Search');
  });

  it('result dialog: short content adds no tab stop', async () => {
    const el = await fixture<LyraToolResultDialog>(html`<lr-tool-result-dialog open tool-name="Search">
      <div slot="body">short</div>
    </lr-tool-result-dialog>`);
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(body(el).hasAttribute('tabindex')).to.equal(false);
  });

  it('approval dialog: a long args body gets a named tab stop', async () => {
    const el = await fixture<LyraToolApprovalDialog>(html`<lr-tool-approval-dialog open tool-name="write" .args=${manyArgs}></lr-tool-approval-dialog>`);
    await waitUntil(() => overflows(body(el)), 'the args body never overflowed');
    await waitUntil(() => body(el).getAttribute('tabindex') === '0', 'overflowing body never became focusable');
    expect(body(el).getAttribute('aria-label') ?? '').to.contain('write');
  });

  it('select dialog: a few tools add no tab stop, a long catalog does', async () => {
    const el = await fixture<LyraToolSelectDialog>(html`<lr-tool-select-dialog open .tools=${manyTools.slice(0, 2)}></lr-tool-select-dialog>`);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(body(el).hasAttribute('tabindex'), 'short list').to.equal(false);
    el.tools = manyTools;
    await el.updateComplete;
    await waitUntil(() => body(el).getAttribute('tabindex') === '0', 'overflowing body never became focusable');
    expect(body(el).getAttribute('role')).to.equal('region');
    el.label = '';
    el.setAttribute('aria-label', 'Catalog');
    await el.updateComplete;
    expect(body(el).getAttribute('aria-label')).to.equal('Catalog');
  });
});

it('keeps focus on the dialog when loading more finishes with a short replacement catalog', async () => {
  const tools = Array.from({ length: 201 }, (_, i) => ({ id: String(i), name: String(i) }));
  const el = await fixture<LyraToolSelectDialog>(html`<lr-tool-select-dialog open .tools=${tools}></lr-tool-select-dialog>`);
  const more = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="load-more"]')!;
  more.addEventListener('click', () => { el.tools = tools.slice(0, 1); }, { once: true });
  more.click();
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('part') === 'panel');
  expect(body(el).hasAttribute('tabindex')).to.equal(false);
});
