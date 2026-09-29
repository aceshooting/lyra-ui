import { html } from 'lit';
import { AsyncDirective } from 'lit/async-directive.js';
import { directive } from 'lit/directive.js';
import { ref } from 'lit/directives/ref.js';
import { builderMessages } from './theme-builder/messages.js';

class BuilderDirective extends AsyncDirective {
  render(options = {}) {
    this.options = options;
    return html`<div data-theme-builder ${ref(element => {
      if (element && element !== this.host) { this.release(); this.host = element; this.start(); }
    })}></div>`;
  }
  async start() {
    const revision = this.revision = (this.revision ?? 0) + 1;
    const host = this.host;
    const current = () => this.isConnected && host.isConnected && host === this.host && revision === this.revision;
    const t = builderMessages(this.options.messages);
    host.textContent = t('loading');
    try {
      const { mountThemeBuilder } = await import('./theme-builder/view.js');
      if (!current()) return;
      host.textContent = '';
      this.controller = mountThemeBuilder(host, this.options);
      host.themeBuilder = this.controller;
      this.own(host, this.controller);
    } catch {
      if (!current()) return;
      const message = document.createElement('p'); message.setAttribute('role', 'alert'); message.textContent = t('loadError');
      const retry = document.createElement('button'); retry.textContent = t('retry'); // A failed module fetch can remain cached for this document; a fresh frame retries it.
      retry.addEventListener('click', () => window.location.reload(), { once: true });
      host.replaceChildren(message, retry);
    }
  }
  own(host, controller) {
    let released = false;
    const observer = new MutationObserver(() => {
      if (this.cleanup === cleanup && (!host.isConnected || host !== this.host)) this.release();
    });
    const cleanup = () => {
      if (released) return;
      released = true;
      observer.disconnect();
      controller.dispose();
      if (host.themeBuilder === controller) delete host.themeBuilder;
      if (this.controller === controller) this.controller = undefined;
    };
    this.cleanup = cleanup;
    observer.observe(host.ownerDocument, { childList: true, subtree: true });
  }
  release() {
    this.revision = (this.revision ?? 0) + 1;
    const cleanup = this.cleanup;
    this.cleanup = undefined;
    cleanup?.();
  }
  disconnected() { this.release(); }
  reconnected() { if (this.host) this.start(); }
}
const builder = directive(BuilderDirective);
export default { title: 'Theming/Theme builder', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const Editor = { render: () => html`${builder()}` };
export const Rtl = { render: () => html`${builder({ direction: 'rtl' })}` };
export const LongLabels = { render: () => html`${builder({ messages: { title: 'Theme builder — expanded labels for a shared multilingual workspace', look: 'Choose the visual look for the preview workspace', contrast: 'Select the accessibility contrast preference', reset: 'Restore every preview choice to its initial default' } })}` };
