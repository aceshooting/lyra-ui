import { fileURLToPath } from 'node:url';

/** Build the pinned official SDK only when its browser interoperability test requests it. */
export function mcpAppSdkFixturePlugin() {
  let fixture;
  const navigations = new Map();
  return {
    name: 'lyra-mcp-app-sdk-fixture',
    async serve(context) {
      if (context.path.startsWith('/__lyra-mcp-navigation-')) {
        const query = new URL(context.url, 'http://localhost').searchParams;
        const token = query.get('token');
        if (!token || !/^[a-f0-9-]{36}$/.test(token)) return { body: 'Invalid probe token', type: 'text' };
        const counts = navigations.get(token) ?? { target: 0, redirect: 0 };
        if (context.path === '/__lyra-mcp-navigation-count') return { body: JSON.stringify(counts), type: 'json' };
        navigations.set(token, counts);
        if (context.path === '/__lyra-mcp-navigation-target') {
          counts.target++;
          return { body: '<p>Navigation probe destination</p>', type: 'html' };
        }
        if (context.path === '/__lyra-mcp-navigation-redirect') {
          const target = new URL(query.get('target') ?? 'about:blank');
          if (target.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
            target.pathname !== '/__lyra-mcp-navigation-target') return { body: 'Invalid redirect target', type: 'text' };
          counts.redirect++;
          context.status = 302;
          context.set('Location', target.href);
          context.body = '';
          return;
        }
      }
      if (context.path === '/__lyra-mcp-app-sdk-fixture.css') {
        return { body: ':root { --mcp-sdk-fixture: permitted; }', type: 'css' };
      }
      if (context.path === '/__lyra-mcp-app-csp-probe.js') {
        return { body: 'window.mcpExternalAssetExecuted = true;', type: 'js' };
      }
      if (context.path !== '/__lyra-mcp-app-sdk-fixture.js') return;
      fixture ??= (async () => {
        const { build } = await import('vite');
        const result = await build({
          configFile: false,
          root: fileURLToPath(new URL('..', import.meta.url)),
          logLevel: 'error',
          build: {
            write: false,
            minify: true,
            lib: {
              entry: fileURLToPath(new URL('../test/fixtures/mcp-app-sdk.ts', import.meta.url)),
              formats: ['iife'],
              name: 'McpAppFixture',
            },
          },
        });
        const builds = Array.isArray(result) ? result : [result];
        const chunks = builds.flatMap(output => output.output).filter(output => output.type === 'chunk');
        if (chunks.length !== 1) throw new Error('Expected one self-contained MCP Apps SDK fixture');
        return chunks[0].code;
      })();
      return { body: await fixture, type: 'js', headers: { 'Cache-Control': 'no-store' } };
    },
  };
}
