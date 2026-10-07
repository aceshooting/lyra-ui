import { expect } from '@open-wc/testing';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from './announcer.js';
import { sinkTexts } from '../../test/announcements.js';
import { glyphRect } from '../../test/geometry.js';
import { resolvedInShadow } from '../../test/shadow-style.js';

it('reads computed styles and text geometry inside the owning shadow root', () => {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const label = document.createElement('span');
  label.textContent = 'Shadow text';
  shadow.append(label);
  document.body.append(host);
  try {
    expect(resolvedInShadow(host, 'color: rgb(12, 34, 56)', 'color')).to.equal('rgb(12, 34, 56)');
    expect(glyphRect(shadow, 'Shadow').width).to.be.greaterThan(0);
  } finally {
    host.remove();
  }
});

it('reads only the selected announcement channel in its owner document', () => {
  const doc = document.implementation.createHTMLDocument();
  const polite = doc.createElement('div');
  polite.setAttribute(ANNOUNCEMENT_SINK_ATTRIBUTE, 'polite');
  polite.append(doc.createElement('div'));
  polite.firstElementChild!.textContent = 'Ready';
  doc.body.append(polite);
  expect(sinkTexts('polite', doc)).to.deep.equal(['Ready']);
  expect(sinkTexts('assertive', doc)).to.deep.equal([]);
});
