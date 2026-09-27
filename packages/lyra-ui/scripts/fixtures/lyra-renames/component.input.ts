import { LitElement, css, html } from 'lit';
import { HostListener } from '@angular/core';
import '@aceshooting/lyra-ui/components/layout/sample-panel/sample-panel.js';

export class SettingsView extends LitElement {
  static styles = css`
    lr-sample-panel::part(close__button) { color: red; }
    .panel::part(close__button) { outline: none; }
    :host { --lr-panel-bg: white; }
  `;

  render() {
    return html`
      <!-- lr-sample-panel heading-text="x" @lr-panel-open-change: a comment inside a template never changes. -->
      <!-- lyra-migrate-reviewed: RENAME_TARGET_SHARED_REVIEW:lr-panel-close -->
      <lr-sample-panel
        .headingText=${this.title}
        ?arrow=${this.showArrow}
        @lr-panel-close=${this.onClose}
        @lr-panel-open-change=${this.onOpen}
        @lr-item-click=${this.onItem}
        @lr-item-activate=${this.onActivate}
        size="m"
      >
        <span slot="title">${this.title}</span>
      </lr-sample-panel>
      <lr-sample-panel arrow="false" size="m"></lr-sample-panel>
      <lr-sample-other @lr-item-click=${this.onOther} @lr-close=${this.onOtherClose}></lr-sample-other>
      <section @lr-close=${this.onAnyClose}></section>
    `;
  }

  firstUpdated() {
    this.renderRoot.querySelector('lr-sample-panel')?.addEventListener('lr-item-click', this.onItem);
    this.renderRoot.querySelector('lr-sample-panel')!.headingText = 'Ready';
    this.renderRoot.querySelector('lr-sample-other')?.addEventListener('lr-item-click', this.onOther);
    window.addEventListener('lr-panel-open-change', this.onOpen);
    document.addEventListener('lr-item-click', this.onAny);
    this.handlers.get('lr-panel-close');
    const panel = this.panel;
    panel.compact = true;
    panel.refresh();
    panel.setAttribute('heading-text', 'Later');
  }

  @HostListener('document:lr-panel-close')
  onDocumentClose() {}
}
