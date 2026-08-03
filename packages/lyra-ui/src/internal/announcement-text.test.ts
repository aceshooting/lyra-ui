import { expect, fixture, html } from '@open-wc/testing';
import { composedAccessibilityText } from './announcement-text.js';

function normalizedText(node: Node): string {
  return composedAccessibilityText(node).replace(/\s+/g, ' ').trim();
}

it('walks an open shadow tree and flattened slots without leaking unassigned light DOM', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <span>Rendered shadow text</span>
    <slot><span>Unrendered fallback</span></slot>
    <script>Script leak</script>
    <style>Style leak</style>
    <template>Template leak</template>
  `;
  const assigned = document.createElement('span');
  assigned.textContent = 'Rendered assigned text';
  const unassigned = document.createElement('span');
  unassigned.slot = 'missing';
  unassigned.textContent = 'Unassigned named-slot leak';
  host.append(assigned, unassigned);
  container.append(host);

  expect(normalizedText(host)).to.equal('Rendered shadow text Rendered assigned text');

  assigned.hidden = true;
  expect(
    normalizedText(host),
    'a hidden direct assignment suppresses the slot fallback instead of revealing it',
  ).to.equal('Rendered shadow text');
});

it('uses only a closed details summary and includes image alternative text', async () => {
  const root = await fixture(html`
    <div>
      <details>
        <summary>Collapsed summary <img alt="summary diagram" /></summary>
        <p>Collapsed body leak</p>
      </details>
      <img alt="standalone diagram" />
      <details open>
        <summary>Open summary</summary>
        <p>Open body</p>
      </details>
    </div>
  `);

  expect(normalizedText(root)).to.equal(
    'Collapsed summary summary diagram standalone diagram Open summary Open body',
  );

  root.querySelector('details')!.open = true;
  expect(normalizedText(root)).to.equal(
    'Collapsed summary summary diagram Collapsed body leak standalone diagram Open summary Open body',
  );
});

it('uses owner-realm styles and lets visibility-visible descendants re-enter hidden text', async () => {
  const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const ownerDocument = iframe.contentDocument!;
  const root = ownerDocument.createElement('div');
  root.innerHTML = `
    <span style="visibility: hidden">
      Hidden wrapper text
      <span style="visibility: visible">Visible override</span>
    </span>
    <span aria-hidden=" TRUE ">ARIA-hidden leak</span>
    <span style="display: none">Display-hidden leak</span>
  `;
  ownerDocument.body.append(root);

  expect(normalizedText(root)).to.equal('Visible override');
});
