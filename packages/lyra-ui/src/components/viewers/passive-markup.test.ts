import { expect } from '@open-wc/testing';
import DOMPurify from 'dompurify';
import { sanitizePassiveMarkup } from './passive-markup.js';

describe('sanitizePassiveMarkup', () => {
  it('makes a passive document network-silent and non-interactive after the real sanitizer', () => {
    const clean = sanitizePassiveMarkup(DOMPurify, `
      <style>@import url(https://example.test/a.css)</style>
      <img src="https://example.test/pixel.png" srcset="https://example.test/2x.png 2x">
      <a href="https://example.test/nav" target="_blank">link</a>
      <form action="https://example.test/post"><input autofocus><button>send</button></form>
      <div style="background:url(https://example.test/bg.png)" tabindex="0">body</div>
      <x-active>custom text</x-active>
    `, document);
    const template = document.createElement('template');
    template.innerHTML = clean;
    expect(template.content.querySelectorAll('style,a,form,input,button,x-active')).to.have.lengthOf(0);
    expect(template.content.querySelector('img')).to.exist;
    expect(template.content.querySelectorAll('[src],[srcset],[href],[action],[style],[tabindex]')).to.have.lengthOf(0);
    expect(template.content.textContent).to.contain('link');
    expect(template.content.textContent).to.contain('send');
    expect(template.content.textContent).to.contain('custom text');
  });

  it('retains only unescaped local SVG fragment references', () => {
    const clean = sanitizePassiveMarkup(DOMPurify, `
      <svg>
        <defs><linearGradient id="paint"></linearGradient></defs>
        <use id="local" href="#paint"></use>
        <use id="remote" href="https://example.test/a.svg#paint"></use>
        <image id="inline-raster" href="data:image/png;base64,AA=="></image>
        <image id="script-raster" href="data:image/svg+xml;base64,AA=="></image>
        <rect id="fill" fill="URL( '#paint' )"></rect>
        <rect id="escaped" fill="u\\72l(#paint)"></rect>
        <rect id="external" filter="url(https://example.test/filter.svg#x)"></rect>
      </svg>
    `, document, 'passive-svg');
    const template = document.createElement('template');
    template.innerHTML = clean;
    const [local, remote] = template.content.querySelectorAll('use');
    const inlineRaster = template.content.querySelector('#inline-raster');
    const scriptRaster = template.content.querySelector('#script-raster');
    const [fill, escaped, external] = template.content.querySelectorAll('rect');
    expect(local?.getAttribute('href')).to.equal('#paint');
    expect(remote?.hasAttribute('href')).to.equal(false);
    expect(inlineRaster?.getAttribute('href')).to.equal('data:image/png;base64,AA==');
    expect(scriptRaster?.hasAttribute('href')).to.equal(false);
    expect(fill?.getAttribute('fill')).to.match(/paint/i);
    expect(escaped?.hasAttribute('fill')).to.equal(false);
    expect(external?.hasAttribute('filter')).to.equal(false);
  });

  it('removes SVG animation elements while preserving passive shape siblings', () => {
    const clean = sanitizePassiveMarkup(DOMPurify, `
      <svg xmlns="http://www.w3.org/2000/svg">
        <circle id="shape"><animate attributeName="r" values="1;10"></animate></circle>
        <set attributeName="display" to="none"></set>
      </svg>
    `, document, 'passive-svg');
    const template = document.createElement('template');
    template.innerHTML = clean;
    expect(template.content.querySelector('#shape') !== null).to.equal(true);
    expect(template.content.querySelector('animate, set') === null).to.equal(true);
  });

  it('keeps only resolvable-by-caller local anchors in the transclusion profile', () => {
    const clean = sanitizePassiveMarkup(DOMPurify, `
      <a id="local" href="#section" target="_blank">local</a>
      <a id="remote" href="https://example.test/a">remote</a>
      <form><button>submit</button></form>
    `, document, 'transclusion');
    const template = document.createElement('template');
    template.innerHTML = clean;
    const local = template.content.querySelector('#local')!;
    const remote = template.content.querySelector('#remote')!;
    expect(local.getAttribute('href')).to.equal('#section');
    expect(local.hasAttribute('target')).to.equal(false);
    expect(remote.hasAttribute('href')).to.equal(false);
    expect(template.content.querySelectorAll('form,button')).to.have.lengthOf(0);
    expect(template.content.textContent).to.contain('submit');
  });

  it('remains fail-closed when a sanitizer leaves custom and foreign SVG markup intact', () => {
    const clean = sanitizePassiveMarkup(
      { sanitize: (value: string) => value },
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs><path id="shape" /></defs>
        <use id="local-use" xlink:href="#shape"></use>
        <image id="inline-image" src="data:image/png;base64,AA=="></image>
        <foreignObject>
          <div xmlns="http://www.w3.org/1999/xhtml"><x-active>preserved text</x-active></div>
        </foreignObject>
      </svg>`,
      document,
      'passive-svg',
    );
    const template = document.createElement('template');
    template.innerHTML = clean;

    expect(template.content.querySelectorAll('x-active, div')).to.have.lengthOf(0);
    expect(template.content.textContent).to.contain('preserved text');
    expect(template.content.querySelector('#local-use')?.getAttribute('xlink:href')).to.equal('#shape');
    expect(template.content.querySelector('#inline-image')?.getAttribute('src'))
      .to.equal('data:image/png;base64,AA==');
  });
});
