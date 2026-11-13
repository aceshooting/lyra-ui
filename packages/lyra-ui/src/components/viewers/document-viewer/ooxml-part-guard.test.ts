import { expect } from '@open-wc/testing';
import { expectResourceLimit } from '../../../../test/zip-fixtures.js';
import { assembleZip, zipEntry } from '../archive-viewer/fixtures/zip-builder.js';
import { assertOoxmlPartsWithinLimits, OFFICE_RELATIONSHIP } from './ooxml-part-guard.js';

const guardOptions = { description: 'Office document', maxEntries: 10, maxUncompressedBytes: 10_000, verifyCrc: true };

for (const [entity, decoded] of [
  ['&amp;', '&'], ['&apos;', "'"], ['&quot;', '"'], ['&lt;', '<'], ['&gt;', '>'],
  ['&#233;', 'é'], ['&#x1F600;', '😀'],
]) {
  for (const absolute of [false, true]) {
    it(`counts the ${absolute ? 'absolute' : 'relative'} relationship target decoded from ${entity}`, async () => {
      const target = `${absolute ? '/word/' : ''}part${entity}.bin`;
      const relationships = `<Relationships><r:Relationship xmlns:r="urn:relationships"
        Target \t=\n "${target}" Type = '${OFFICE_RELATIONSHIP}style&#115;'/></Relationships>`;
      const parsed = new DOMParser().parseFromString(relationships, 'application/xml');
      expect(parsed.querySelectorAll('parsererror').length).to.equal(0);
      expect(parsed.getElementsByTagNameNS('urn:relationships', 'Relationship')[0]!.getAttribute('Target'))
        .to.equal(`${absolute ? '/word/' : ''}part${decoded}.bin`);
      const source = assembleZip([
        await zipEntry('word/_rels/document.xml.rels', relationships),
        await zipEntry(`word/part${decoded}.bin`, '<part><item/><item/><item/></part>'),
        await zipEntry('word/media/image.bin', '<unparsed>'.repeat(30)),
      ]);
      const config = { guardOptions, partName: /\.rels$/i,
        isPartType: (type: string) => type === OFFICE_RELATIONSHIP + 'styles' };
      await assertOoxmlPartsWithinLimits(source, { ...config, maxNodes: 6 });
      await expectResourceLimit(() => assertOoxmlPartsWithinLimits(source, { ...config, maxNodes: 5 }));
    });
  }
}

it('counts linked XML when archive entry names use Windows path separators', async () => {
  const source = assembleZip([
    await zipEntry('word\\_rels\\document.xml.rels', `<Relationships><Relationship Type="${OFFICE_RELATIONSHIP}styles" Target="styles.bin"/></Relationships>`),
    await zipEntry('word\\styles.bin', '<part><item/><item/><item/></part>'),
  ]);
  const config = { guardOptions, partName: /\.rels$/i,
    isPartType: (type: string) => type === OFFICE_RELATIONSHIP + 'styles' };
  await assertOoxmlPartsWithinLimits(source, { ...config, maxNodes: 6 });
  await expectResourceLimit(() => assertOoxmlPartsWithinLimits(source, { ...config, maxNodes: 5 }));
});
