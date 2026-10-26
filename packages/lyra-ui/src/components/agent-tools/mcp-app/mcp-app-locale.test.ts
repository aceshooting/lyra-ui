import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraMcpApp } from './mcp-app.class.js';
import '../../../translations/fr/agent-tools.js';
import '../../../translations/ar/agent-tools.js';

class LocaleContextApp extends LyraMcpApp {
  readonly contexts: unknown[] = [];
  override postHostContext(context: unknown): void {
    this.contexts.push(context);
    super.postHostContext(context);
  }
}
customElements.define('test-mcp-locale-context', LocaleContextApp);

for (const protocol of ['legacy', 'mcp-apps'] as const) {
  it(`updates ${protocol} app locale context after inherited language changes without replacing its frame`, async () => {
    const wrapper = await fixture<HTMLElement>(html`<section lang="fr"><test-mcp-locale-context
      .protocol=${protocol} .resource=${{ uri: 'ui://locale-test', html: '<p>Application content</p>' }}></test-mcp-locale-context></section>`);
    const host = wrapper.querySelector<LocaleContextApp>('test-mcp-locale-context')!;
    await waitUntil(() => host.contexts.length > 0, 'Initial app context is delivered');
    const frame = host.shadowRoot!.querySelector('iframe')!;
    expect(frame.title).to.equal('Application interactive');
    expect((host.contexts.at(-1) as { locale: string }).locale).to.equal('fr');
    const initialCount = host.contexts.length;
    wrapper.lang = 'ar'; wrapper.dir = 'rtl';
    await waitUntil(() => (host.contexts.at(-1) as { locale: string }).locale === 'ar', 'Loaded app receives the changed language');
    expect((host.contexts.at(-1) as { direction: string }).direction).to.equal('rtl');
    expect(host.shadowRoot!.querySelector('iframe') === frame).to.equal(true);
    expect(frame.title).to.equal('تطبيق تفاعلي');
    expect(host.contexts.length).to.equal(initialCount + 1);
    host.strings = { mcpAppLabel: 'Application title override' };
    await host.updateComplete;
    expect(frame.title).to.equal('Application title override');
    expect(host.contexts.length).to.equal(initialCount + 1);
    wrapper.dir = 'ltr';
    await waitUntil(() => (host.contexts.at(-1) as { direction: string }).direction === 'ltr', 'Direction-only change reaches the app context');
  });
}
