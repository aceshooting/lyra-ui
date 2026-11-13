import { expect, fixture, html } from '@open-wc/testing';
import './file-icon.js';
import type { LyraFileIcon } from './file-icon.js';
import {
  createFileTypeMetadataRegistry,
  type LyraFileTypeMetadataRegistry,
  type LyraResolvedFileTypeMetadata,
} from './file-type-metadata.js';

const metadata = (): LyraResolvedFileTypeMetadata => ({
  label: 'Authored document', icon: 'code', category: 'code', provenance: 'consumer',
  description: 'Application format', abbreviation: 'APP',
});

describe('file icon custom registry result recovery', () => {
  for (const [name, registry] of [
    ['unset', undefined], ['null', null], ['missing resolver', {}], ['non-callable resolver', { resolve: true }],
  ] as const) {
    it(`retains the generic label when a JavaScript caller supplies a ${name} registry`, async () => {
      const element = await fixture<LyraFileIcon>(html`
        <lr-file-icon mode="label" .strings=${{ fileTypeFile: 'Generic document' }}></lr-file-icon>
      `);
      element.registry = registry as unknown as LyraFileTypeMetadataRegistry;
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')).to.equal('Generic document');
      expect(element.shadowRoot!.querySelector('[part="label"]')?.textContent).to.equal('Generic document');
      element.registry = { resolve: metadata };
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')).to.equal('Authored document');
    });
  }

  const invalid: readonly [string, () => unknown][] = [
    ['null', () => null],
    ['undefined', () => undefined],
    ['an empty record', () => ({})],
    ['an empty label', () => ({ ...metadata(), label: '' })],
    ['a whitespace-only label', () => ({ ...metadata(), label: ' \n\t' })],
    ['an oversized label', () => ({ ...metadata(), label: 'a'.repeat(513) })],
    ['a non-text label', () => ({ ...metadata(), label: {} })],
    ['an unknown builtin icon', () => ({ ...metadata(), provenance: 'builtin', icon: 'toString' })],
    ['an unknown provenance', () => ({ ...metadata(), provenance: 'application' })],
    ['a non-text description', () => ({ ...metadata(), description: {} })],
    ['an oversized description', () => ({ ...metadata(), description: 'a'.repeat(2049) })],
    ['a revoked record', () => {
      const record = Proxy.revocable(metadata(), {});
      record.revoke();
      return record.proxy;
    }],
    ...(['provenance', 'label', 'icon', 'description'] as const).map((field): [string, () => unknown] => [
      `a throwing ${field} getter`,
      () => Object.defineProperty(metadata(), field, {
        get() { throw new Error('Metadata unavailable'); },
      }),
    ]),
  ];

  for (const [name, create] of invalid) {
    it(`keeps a named generic badge for ${name} and recovers on registry replacement`, async () => {
      const element = await fixture<LyraFileIcon>(html`
        <lr-file-icon mode="label" mime-type="application/x-app"
          .strings=${{ fileTypeFile: 'Generic document' }}></lr-file-icon>
      `);
      const result = create();
      element.registry = { resolve: () => result as LyraResolvedFileTypeMetadata };
      const rejected = await element.updateComplete.then(() => false, () => true);
      expect(rejected, 'invalid metadata must not reject the render update').to.equal(false);
      const root = element.shadowRoot!;
      expect(root.querySelector('[part="base"]')?.getAttribute('aria-label')).to.equal('Generic document');
      expect(root.querySelector('[part="label"]')?.textContent).to.equal('Generic document');
      expect(root.querySelector('[part="base"]')?.hasAttribute('aria-describedby')).to.equal(false);
      expect(root.querySelectorAll('[part="description"], .token').length).to.equal(0);
      await expect(element).to.be.accessible();

      element.registry = createFileTypeMetadataRegistry([{
        mimeTypes: 'application/x-app', metadata: metadata(),
      }]);
      await element.updateComplete;
      expect(root.querySelector('[part="base"]')?.getAttribute('aria-label')).to.equal('Authored document');
      expect(root.querySelector('.token')?.textContent).to.equal('APP');
      expect(root.querySelector('[part="description"]')?.textContent).to.equal('Application format');
      expect(root.querySelector('[part="base"]')?.getAttribute('aria-describedby')).to.equal('metadata-description');
      await expect(element).to.be.accessible();
    });
  }

  for (const provenance of ['consumer', 'builtin'] as const) {
    it(`reads a ${provenance} result's presentation fields once and binds the resolver to its registry`, async () => {
      const reads = new Map<string, number>();
      const source = { ...metadata(), provenance, icon: 'pdf' as const };
      const result = new Proxy(source, {
        get(target, key, receiver) {
          if (typeof key === 'string') reads.set(key, (reads.get(key) ?? 0) + 1);
          return Reflect.get(target, key, receiver);
        },
      });
      let resolverReads = 0;
      let bound = false;
      const registry = {
        get resolve() {
          resolverReads++;
          return function (this: unknown) { bound = this === registry; return result; };
        },
      };
      const element = await fixture<LyraFileIcon>(html`
        <lr-file-icon mode="label" .strings=${{ fileTypePdf: 'Portable document' }}></lr-file-icon>
      `);
      element.registry = registry;
      await element.updateComplete;
      expect(bound).to.equal(true);
      expect(resolverReads).to.equal(1);
      for (const field of ['provenance', 'label', 'icon', 'description']) expect(reads.get(field), field).to.equal(1);
      expect(element.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label'))
        .to.equal(provenance === 'consumer' ? 'Authored document' : 'Portable document');
      expect(element.shadowRoot!.querySelector('[part="description"]')?.textContent)
        .to.equal(provenance === 'consumer' ? 'Application format' : undefined);
      expect(element.shadowRoot!.querySelector('.token')?.textContent).to.equal('APP');
    });
  }
});
