import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { expectResourceLimit } from '../../../../test/zip-fixtures.js';
import { assembleZip, zipEntry } from '../archive-viewer/fixtures/zip-builder.js';
import { assertOoxmlPartsWithinLimits, OFFICE_RELATIONSHIP } from './ooxml-part-guard.js';

it('enforces the same XML node budget through numeric entity encodings and package-root targets', async () => {
  await fc.assert(fc.asyncProperty(
    fc.array(fc.constantFrom('a', 'Z', '&', "'", '"', '<', '>', 'é', '😀'), { minLength: 1, maxLength: 16 }),
    fc.boolean(), fc.boolean(),
    async (characters, hexadecimal, absolute) => {
      const name = characters.join('') + '.bin';
      const encoded = characters.map(character => {
        const point = character.codePointAt(0)!;
        return hexadecimal ? `&#x${point.toString(16)};` : `&#${point};`;
      }).join('') + '.bin';
      const relationships = `<Relationships><Relationship Type="${OFFICE_RELATIONSHIP}styles" Target="${absolute ? '/word/' : ''}${encoded}"/></Relationships>`;
      const parsed = new DOMParser().parseFromString(relationships, 'application/xml');
      expect(parsed.querySelectorAll('parsererror').length).to.equal(0);
      expect(parsed.querySelector('Relationship')!.getAttribute('Target')).to.equal(`${absolute ? '/word/' : ''}${name}`);
      const source = assembleZip([
        await zipEntry('word/_rels/document.xml.rels', relationships),
        await zipEntry(`word/${name}`, '<part><item/><item/><item/></part>'),
      ]);
      const config = {
        guardOptions: { description: 'Office document', maxEntries: 2, maxUncompressedBytes: 10_000, verifyCrc: true },
        partName: /\.rels$/i, isPartType: (type: string) => type === OFFICE_RELATIONSHIP + 'styles',
      };
      await assertOoxmlPartsWithinLimits(source, { ...config, maxNodes: 6 });
      await expectResourceLimit(() => assertOoxmlPartsWithinLimits(source, { ...config, maxNodes: 5 }));
    },
  ), propertyRuns());
});
