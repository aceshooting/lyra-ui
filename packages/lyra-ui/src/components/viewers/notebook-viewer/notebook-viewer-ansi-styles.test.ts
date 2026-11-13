import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraNotebookViewer } from './notebook-viewer.class.js';
import './notebook-viewer.js';

type Notebook = Exclude<LyraNotebookViewer['notebook'], string | undefined>;
type Output = NonNullable<Notebook['cells'][number]['outputs']>[number];
const outputKinds = ['stdout', 'stderr', 'error', 'plain'] as const;
function output(kind: typeof outputKinds[number], text: string): Output {
  if (kind === 'error') return { output_type: 'error', ename: 'Example', evalue: 'message', traceback: [text] };
  if (kind === 'plain') return { output_type: 'execute_result', data: { 'text/plain': text } };
  return { output_type: 'stream', name: kind, text };
}
async function renderOutputs(outputs: Output[]): Promise<ShadowRoot> {
  const notebook: Notebook = { nbformat: 4, nbformat_minor: 5, cells: [{
    cell_type: 'code', id: 'styled', source: '', outputs,
  }] };
  const viewer = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`);
  await waitUntil(() => Boolean(viewer.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('[part~="output"] span')));
  return viewer.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!;
}
function textSpan(root: ShadowRoot, text: string): HTMLSpanElement {
  const span = [...root.querySelectorAll<HTMLSpanElement>('[part~="output"] span')].find(node => node.textContent === text);
  if (!span) throw new Error(`Missing output span: ${text}`);
  return span;
}

for (const kind of outputKinds) {
  it(`renders and resets emphasis in ${kind} output`, async () => {
    const root = await renderOutputs([output(kind, '\u001b[1;2;3;4mstyled\u001b[22;23;24mreset')]);
    const styled = getComputedStyle(textSpan(root, 'styled'));
    const reset = getComputedStyle(textSpan(root, 'reset'));
    expect(styled.fontWeight).to.equal('700');
    expect(styled.opacity).to.equal('0.7');
    expect(styled.fontStyle).to.equal('italic');
    expect(styled.textDecorationLine).to.contain('underline');
    expect(reset.fontWeight).to.equal('400');
    expect(reset.opacity).to.equal('1');
    expect(reset.fontStyle).to.equal('normal');
    expect(reset.textDecorationLine).to.equal('none');
    expect(root.textContent).not.to.contain('\u001b[');
  });

  it(`swaps explicit foreground and background colors for inverse ${kind} output`, async () => {
    const colors = '\u001b[38;2;12;34;56;48;2;210;220;230m';
    const root = await renderOutputs([output(kind, `${colors}normal\u001b[7minverse\u001b[27mrestored`)]);
    const normal = getComputedStyle(textSpan(root, 'normal'));
    const inverse = getComputedStyle(textSpan(root, 'inverse'));
    const restored = getComputedStyle(textSpan(root, 'restored'));
    expect(normal.color).to.equal('rgb(12, 34, 56)');
    expect(normal.backgroundColor).to.equal('rgb(210, 220, 230)');
    expect(inverse.color).to.equal(normal.backgroundColor);
    expect(inverse.backgroundColor).to.equal(normal.color);
    expect(restored.color).to.equal(normal.color);
    expect(restored.backgroundColor).to.equal(normal.backgroundColor);
  });

  it(`contains an unterminated ${kind} style within its own output`, async () => {
    const root = await renderOutputs([output(kind, '\u001b[1;2;3;4;7mfirst'), output(kind, 'second')]);
    const first = getComputedStyle(textSpan(root, 'first'));
    const second = getComputedStyle(textSpan(root, kind === 'error' ? 'Example: message\nsecond' : 'second'));
    expect(first.fontStyle).to.equal('italic');
    expect(first.opacity).to.equal('0.7');
    expect(second.fontWeight).to.equal('400');
    expect(second.fontStyle).to.equal('normal');
    expect(second.opacity).to.equal('1');
    expect(second.textDecorationLine).to.equal('none');
    expect(second.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  });
}
