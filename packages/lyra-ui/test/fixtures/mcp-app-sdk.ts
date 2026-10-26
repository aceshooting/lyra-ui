import { App } from '@modelcontextprotocol/ext-apps';

/** Bundled in memory by the test server; this uses the actual pinned SDK and default transport. */
const app = new App({ name: 'Lyra interoperability fixture', version: '1' }, {
  availableDisplayModes: ['inline', 'fullscreen'],
}, { autoResize: false });

async function report(stage: string, value: unknown = null): Promise<void> {
  await app.sendLog({ level: 'info', data: { stage, value } });
}

for (const event of ['toolinput', 'toolinputpartial', 'toolresult', 'toolcancelled', 'hostcontextchanged'] as const) {
  app.addEventListener(event, value => { void report(event, value); });
}
app.onteardown = () => ({ cleanedUp: true });

async function run(): Promise<void> {
  await app.connect();
  await report('initialize', { capabilities: app.getHostCapabilities(), context: app.getHostContext() });
  await report('asset-style', getComputedStyle(document.documentElement).getPropertyValue('--mcp-sdk-fixture').trim());
  if (!app.getHostCapabilities()?.serverResources) {
    try {
      await app.readServerResource({ uri: 'test://denied' });
      await report('unexpected-resource-success');
    } catch {
      await report('resource-denied');
    }
    try {
      await app.createSamplingMessage({ messages: [{ role: 'user', content: { type: 'text', text: 'Fixture' } }], maxTokens: 1 });
      await report('unexpected-sampling-success');
    } catch {
      await report('sampling-denied');
    }
    try {
      await app.downloadFile({ contents: [{ type: 'resource', resource: { uri: 'test://download', mimeType: 'text/plain', text: 'Fixture' } }] });
      await report('unexpected-download-success');
    } catch {
      await report('download-denied');
    }
    await report('done');
    return;
  }
  await report('tool', await app.callServerTool({ name: 'weather', arguments: { city: 'Luxembourg' } }));
  await report('tools', await app.request({ method: 'tools/list' }));
  await report('resources', await app.listServerResources());
  await report('templates', await app.request({ method: 'resources/templates/list' }));
  await report('resource', await app.readServerResource({ uri: 'test://weather' }));
  await report('context', await app.updateModelContext({ content: [{ type: 'text', text: 'Weather context' }], structuredContent: { city: 'Luxembourg' } }));
  await report('message', await app.sendMessage({ role: 'user', content: [{ type: 'text', text: 'Show the weather' }] }));
  await report('link', await app.openLink({ url: 'https://example.com/weather' }));
  await report('display', await app.requestDisplayMode({ mode: 'fullscreen' }));
  const cancelled = new AbortController();
  const call = app.callServerTool({ name: 'cancel-me' }, { signal: cancelled.signal });
  // The host acknowledges receipt through tool-input before the fixture aborts its real SDK call.
  const cancelOnInput = () => { cancelled.abort('Fixture cancellation'); };
  app.addEventListener('toolinput', cancelOnInput);
  try {
    await call;
    await report('unexpected-cancel-success');
  } catch {
    await report('cancelled');
  } finally {
    app.removeEventListener('toolinput', cancelOnInput);
  }
  try {
    await app.callServerTool({ name: 'host-error' });
    await report('unexpected-error-success');
  } catch (error) {
    await report('error', error instanceof Error ? error.message : String(error));
  }
  await report('done');
}

void run().catch(error => report('fixture-error', error instanceof Error ? error.message : String(error)));
