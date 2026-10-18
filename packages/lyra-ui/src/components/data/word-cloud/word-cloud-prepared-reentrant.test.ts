import { expect, fixture, html } from '@open-wc/testing';
import './word-cloud.js';
import type { LyraWordCloud } from './word-cloud.class.js';
import type { LyraPreparedWordCloud } from '../../../utilities/data-preparation.js';

function summary(revision: string, id: string, text: string): LyraPreparedWordCloud {
  return { revision, counts: { sourceCount: 1, validCount: 1, invalidCount: 0 },
    totalWeight: 1, retainedWeight: 1, words: [{ id, text, weight: 1 }] };
}

for (const sameIdentity of [false, true]) {
  for (const throws of [false, true]) {
    it(`commits current word identities and revision after a descriptor trap ${sameIdentity ? 'explicitly refreshes the same input' : 'assigns a newer input'}${throws ? ' then throws' : ''}`, async () => {
      const element = await fixture<LyraWordCloud>(html`<lr-word-cloud .preparedWords=${summary('initial', 'initial', 'Initial')}></lr-word-cloud>`);
      const target = { ...summary('obsolete', 'obsolete', 'Obsolete') };
      const replacement = summary('latest', 'latest-id', 'Latest');
      let reentered = false;
      const input = new Proxy(target, { getOwnPropertyDescriptor(value, key) {
        if (!reentered && key === 'words') {
          reentered = true;
          if (sameIdentity) {
            target.revision = replacement.revision;
            target.words = replacement.words;
            element.requestUpdate();
          } else element.preparedWords = replacement;
          if (throws) throw new Error('Obsolete descriptor failed');
        }
        return Reflect.getOwnPropertyDescriptor(value, key);
      } });
      element.preparedWords = input;
      await element.updateComplete;
      await element.updateComplete;
      expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
      const word = element.shadowRoot!.querySelector<SVGTextElement>('[part="word"]')!;
      expect(word !== null).to.equal(true);
      const svg = element.shadowRoot!.querySelector<SVGSVGElement>('[part="svg"]')!;
      const point = new DOMPoint(Number(word.getAttribute('x')), Number(word.getAttribute('y'))).matrixTransform(svg.getScreenCTM()!);
      const activations: unknown[] = [];
      element.addEventListener('lr-word-activate', event => {
        const { id, text, revision } = event.detail;
        activations.push({ id, text, revision });
      });
      svg.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, clientX: point.x, clientY: point.y }));
      expect({ text: word.textContent, activations }).to.deep.equal({ text: 'Latest', activations: [{ id: 'latest-id', text: 'Latest', revision: 'latest' }] });
    });
  }
}
