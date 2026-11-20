import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { contrastRatio, resolvedColorToken, toRgba } from '../../test/color-contrast.js';
import '../components/lr-dialog.js';
import '../components/lr-drawer.js';
import '../components/lr-lightbox.js';
import '../components/lr-tool-approval-dialog.js';
import '../components/lr-tool-result-dialog.js';
import '../components/lr-tool-select-dialog.js';
import type { LyraLightboxImage } from '../components/media/lightbox/lightbox.class.js';

interface ModalHost extends HTMLElement {
  open: boolean;
  updateComplete: Promise<unknown>;
  label?: string;
  toolName?: string;
  images?: LyraLightboxImage[];
}

const image: LyraLightboxImage = {
  src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="%230969da"/%3E%3C/svg%3E',
  alt: 'Blue square',
};

const hosts: ReadonlyArray<readonly [string, (host: ModalHost) => void]> = [
  ['lr-dialog', host => { host.label = 'Record details'; }],
  ['lr-drawer', host => { host.label = 'Record details'; }],
  ['lr-lightbox', host => { host.images = [image]; }],
  ['lr-tool-approval-dialog', host => { host.toolName = 'run'; }],
  ['lr-tool-result-dialog', host => { host.toolName = 'run'; }],
  ['lr-tool-select-dialog', () => undefined],
];

for (const [tag, setup] of hosts) {
  it(`${tag} paints its open panel text from the enclosing dark theme scope`, async () => {
    const scope = await fixture<HTMLElement>(html`<div data-lr-mode="dark"></div>`);
    const host = document.createElement(tag) as ModalHost;
    setup(host);
    scope.append(host);
    try {
      await host.updateComplete;
      host.open = true;
      await host.updateComplete;
      const panel = host.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]');
      await waitUntil(() => (panel?.getBoundingClientRect().width ?? 0) > 0, `${tag} panel to render`);
      const text = toRgba(resolvedColorToken(scope, '--lr-color-text'));
      expect(toRgba(getComputedStyle(scope).color), 'scope keeps the page colour').to.not.deep.equal(text);
      expect(toRgba(getComputedStyle(host).color), 'host').to.deep.equal(text);
      expect(toRgba(getComputedStyle(panel!).color), 'panel').to.deep.equal(text);
      const fill = getComputedStyle(panel!).backgroundColor;
      if (toRgba(fill)[3] > 0) expect(contrastRatio(getComputedStyle(panel!).color, fill), 'panel contrast').to.be.at.least(4.5);
    } finally {
      host.open = false;
      await host.updateComplete;
      host.remove();
    }
  });
}
