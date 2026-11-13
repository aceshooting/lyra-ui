import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import type { LyraNotebookViewer } from './notebook-viewer.js';
import './notebook-viewer.js';

it('matches native visible text across raw-text names, closing prefixes and quoted tag attributes', async () => {
  const element = document.createElement('lr-notebook-viewer') as LyraNotebookViewer;
  const suffix = fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'), { minLength: 1, maxLength: 16 })
    .map(characters => characters.join(''));
  await fc.assert(fc.asyncProperty(
    fc.constantFrom('script', 'style'), suffix, fc.boolean(), fc.boolean(),
    fc.constantFrom(' ', '\t', '\n', '\f', '\r', '/'), fc.constantFrom('"', '\''), fc.boolean(),
    async (rawName, extra, rawText, uppercase, boundary, quote, unquoted) => {
      const name = uppercase ? rawName.toUpperCase() : rawName;
      const attributes = unquoted ? ` title=can${quote}t data-note=attribute-needle `
        : ` title=${quote}> attribute-needle${quote}`;
      const markup = rawText
        ? `<${name}${boundary}${attributes}>hidden-needle</${name}${extra}>hidden-needle</${name}${boundary}${attributes}><p>visible-needle</p>`
        : `<${name}${extra}${attributes}>visible-needle</${name}${extra}>`;
      // The native HTML parser supplies an independent text oracle; template content stays inert.
      const template = document.createElement('template');
      template.innerHTML = markup;
      template.content.querySelectorAll('script, style').forEach(node => node.remove());
      const visible = template.content.textContent ?? '';
      element.notebook = {
        nbformat: 4, nbformat_minor: 5,
        cells: [{ cell_type: 'code', source: '', outputs: [{
          output_type: 'display_data', data: { 'text/html': markup },
        }] }],
      };
      for (const needle of ['visible-needle', 'hidden-needle', 'attribute-needle']) {
        expect(await element.search(needle), `${needle} in ${markup}`).to.equal(visible.includes(needle) ? 1 : 0);
      }
    },
  ), propertyRuns());
});
