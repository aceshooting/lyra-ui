import { expect } from '@open-wc/testing';
import { html, render } from 'lit';
import { streamingTailText } from './markdown-streaming-tail.js';

describe('streamingTailText', () => {
  it('refuses to bind outside a child position', () => {
    const host = document.createElement('div');

    expect(() => render(html`<p title=${streamingTailText('tail')}></p>`, host)).to.throw(
      'Streaming text requires a child part.',
    );
  });

  it('grows one text node in place and replaces it when the text diverges', () => {
    const host = document.createElement('div');
    const show = (text: string): Text => {
      render(html`<p>${streamingTailText(text)}</p>`, host);
      return [...host.querySelector('p')!.childNodes].find((node): node is Text => node.nodeType === Node.TEXT_NODE)!;
    };

    const first = show('Hel');
    const grown = show('Hello');
    expect(grown === first).to.equal(true);
    expect(grown.data).to.equal('Hello');

    const diverged = show('Goodbye');
    expect(diverged === first).to.equal(true);
    expect(diverged.data).to.equal('Goodbye');
  });
});
