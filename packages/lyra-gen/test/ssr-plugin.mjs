import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';

/** Serve actual Node-rendered snapshot markup to the browser parity tests. */
export default function genSsrFixturePlugin() {
  return {
    name: 'lyra-gen-server-snapshot-fixture',
    async serve(context) {
      if (context.path !== '/__lyra_gen_ssr_fixture') return;
      const [{ renderGenSnapshot }, { fixtureCatalog, fixtureSnapshot }] = await Promise.all([
        import('../dist/ssr.js'), import('./ssr-fixtures.mjs'),
      ]);
      const result = renderGenSnapshot(fixtureSnapshot(), fixtureCatalog, { locale: 'en', direction: 'rtl' });
      if (!result.ok) throw new Error('Server snapshot fixture was rejected.');
      return { body: await collectResult(render(result.value.template)), type: 'html' };
    },
  };
}
