/** Count only synthetic threat-test probe requests at the development server. */
export default function genThreatFixturePlugin() {
  const counts = new Map();
  return {
    name: 'lyra-gen-threat-request-fixture',
    serve(context) {
      const match = /^\/__lyra_gen_threat\/([a-z0-9-]{1,80})\/(probe|count)$/u.exec(context.path);
      if (!match) return;
      const [, token, operation] = match;
      if (operation === 'count') return { body: JSON.stringify({ requests: counts.get(token) ?? 0 }), type: 'application/json', headers: { 'Cache-Control': 'no-store' } };
      if (counts.size >= 128 && !counts.has(token)) throw new Error('Threat fixture token limit exceeded.');
      counts.set(token, (counts.get(token) ?? 0) + 1);
      return { body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>', type: 'image/svg+xml', headers: { 'Cache-Control': 'no-store' } };
    },
  };
}
