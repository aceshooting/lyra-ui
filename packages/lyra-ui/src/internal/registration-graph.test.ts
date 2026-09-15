import { expect } from '@open-wc/testing';
import '../components/lr-table.js';

/**
 * Contract test for the published registration-graph artifact (`registrations.json`,
 * `scripts/generate-registration-graph.mjs`, fr_IZcp_YakOYwAQKvCSqpWUg): a consumer statically
 * reading that file needs proof it describes real runtime behavior, not an aspirational claim.
 * This fetches the real generated artifact the built package ships at its root (the same way
 * `cascade-layers.test.ts`/`tokens-root.test.ts` fetch `theme.css` from the dev server rather than
 * reimplementing it), then imports the real stable per-tag entry
 * (`src/components/lr-table.ts`, exported as `@aceshooting/lyra-ui/components/lr-table.js`) and
 * checks `customElements.get()` for every tag the artifact claims that import registers.
 */

interface RegistrationGraphEntry {
  tag: string;
  entry: string;
  registrationModule: string;
  registers: string[];
}

interface RegistrationGraph {
  schemaVersion: number;
  entries: RegistrationGraphEntry[];
}

async function loadRegistrationGraph(): Promise<RegistrationGraph> {
  // The dev server transforms every served `.json` file into an ES module (`esbuildPlugin({ json:
  // true })` in web-test-runner.config.js), the same way a real consumer's bundler or Node's own
  // `with { type: 'json' }` resolves `@aceshooting/lyra-ui/registrations.json` -- so `fetch(...)
  // .json()` gets JS source, not JSON text, and 404s look like a JSON parse error instead of a
  // clear "not published" failure. A non-literal specifier (`href`, not a string literal) keeps
  // this a runtime-only dynamic import: TypeScript types `import(nonLiteral)` as `Promise<any>`
  // and never tries to resolve it as a module, so no `resolveJsonModule` ambient declaration is
  // needed for a path this package does not otherwise import from source.
  const href = new URL('../../registrations.json', import.meta.url).href;
  const registrationsModule = (await import(href)) as { default: RegistrationGraph };
  return registrationsModule.default;
}

it("lists lr-table's known composed-child registrations", async () => {
  const graph = await loadRegistrationGraph();
  const table = graph.entries.find((entry) => entry.tag === 'lr-table');
  expect(table, 'registrations.json must have an entry for lr-table').to.not.equal(undefined);
  expect(table?.entry).to.equal('./components/lr-table.js');
  expect(table?.registrationModule).to.equal('src/components/data/table/table.ts');
  // table.ts imports empty.js/pagination.js/spinner.js/skeleton.js -- their full registration
  // entries, not the side-effect-free *.class.js -- before defining lr-table itself.
  expect(table?.registers).to.deep.equal([
    'lr-empty',
    'lr-pagination',
    'lr-skeleton',
    'lr-spinner',
    'lr-table',
  ]);
});

it('is not aspirational: importing the real lr-table.js entry registers every tag the artifact lists', async () => {
  const graph = await loadRegistrationGraph();
  const table = graph.entries.find((entry) => entry.tag === 'lr-table');
  const unregistered = (table?.registers ?? []).filter((tag) => !customElements.get(tag));
  // Comparing tag-name arrays, never a DOM node, per this repo's chai-hang trap.
  expect(unregistered).to.deep.equal([]);
});
