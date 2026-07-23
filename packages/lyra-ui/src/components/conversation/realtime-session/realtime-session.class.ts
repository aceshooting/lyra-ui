import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import type { LyraTranscriptEntry } from '../transcript-feed/transcript-feed.class.js';
import type { AudioVisualizerState } from '../audio-visualizer/audio-visualizer.class.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import '../audio-visualizer/audio-visualizer.class.js';
import '../push-to-talk/push-to-talk.class.js';
import '../transcript-feed/transcript-feed.class.js';
import '../../overlays/badge/badge.class.js';
import { styles } from './realtime-session.styles.js';

export type RealtimeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export interface LyraRealtimeSessionEventMap {
  'lr-connect': CustomEvent<undefined>;
  'lr-disconnect': CustomEvent<undefined>;
  'lr-mute-change': CustomEvent<{ muted: boolean }>;
  'lr-interrupt': CustomEvent<undefined>;
}
const STATE_VARIANT: Record<RealtimeConnectionState, BadgeVariant> = {
  disconnected: 'neutral', connecting: 'brand', connected: 'success', reconnecting: 'warning', error: 'danger',
};

/**
 * `<lr-realtime-session>` — a provider-neutral voice-session shell composing connection status,
 * live activity, transcript, native capture, mute, interruption, and connect/disconnect intents.
 * Transport, authentication, audio playback, and SDK ownership remain with the host.
 *
 * @customElement lr-realtime-session
 * @slot controls - Additional provider-specific controls.
 * @event lr-connect - Connection was requested.
 * @event lr-disconnect - Disconnection was requested.
 * @event lr-mute-change - A controlled microphone mute change was requested.
 * @event lr-interrupt - Interruption of the current response was requested.
 * @csspart base - The named session region.
 * @csspart header - Status and session controls.
 * @csspart status - Connection status badge.
 * @csspart activity - Voice activity visualization.
 * @csspart controls - Built-in and slotted controls.
 * @csspart connect - Connect action.
 * @csspart disconnect - Disconnect action.
 * @csspart mute - Controlled mute action.
 * @csspart interrupt - Response interruption action.
 * @csspart capture - Native push-to-talk capture.
 * @csspart transcript - Live transcript.
 * @csspart error - Localized connection error.
 */
export class LyraRealtimeSession extends LyraElement<LyraRealtimeSessionEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ reflect: true }) state: RealtimeConnectionState = 'disconnected';
  @property({ attribute: 'voice-state' }) voiceState: AudioVisualizerState = 'idle';
  @property({ type: Number }) level: number | null = null;
  @property({ attribute: false }) stream: MediaStream | null = null;
  @property({ attribute: false }) entries: LyraTranscriptEntry[] = [];
  @property({ type: Boolean, reflect: true }) muted = false;
  @property({ type: Boolean, attribute: 'show-capture', reflect: true, converter: trueDefaultBooleanConverter })
  showCapture = true;
  @property({ attribute: 'error-code' }) errorCode = '';
  @property() label = '';

  private stateLabel(): string {
    switch (this.state) {
      case 'disconnected': return this.localize('realtimeSessionDisconnected');
      case 'connecting': return this.localize('realtimeSessionConnecting');
      case 'connected': return this.localize('realtimeSessionConnected');
      case 'reconnecting': return this.localize('realtimeSessionReconnecting');
      case 'error': return this.localize('realtimeSessionError');
    }
  }

  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.label || this.localize('realtimeSessionLabel');
    const active = this.state === 'connected';
    const safeLevel = this.level == null ? null : finiteRange(this.level, 0, 0, 1);
    return html`
      <section part="base" aria-label=${label} aria-busy=${this.state === 'connecting' || this.state === 'reconnecting' ? 'true' : 'false'}>
        <header part="header">
          <lr-badge part="status" variant=${STATE_VARIANT[this.state]}>${this.stateLabel()}</lr-badge>
          <lr-audio-visualizer
            part="activity"
            .state=${this.voiceState}
            .level=${safeLevel}
            .stream=${this.stream}
          ></lr-audio-visualizer>
          <div part="controls">
            ${this.state === 'disconnected' || this.state === 'error'
              ? html`<button part="connect" type="button" @click=${() => this.emit('lr-connect')}>${this.localize('realtimeSessionConnect')}</button>`
              : html`<button part="disconnect" type="button" @click=${() => this.emit('lr-disconnect')}>${this.localize('realtimeSessionDisconnect')}</button>`}
            ${active
              ? html`
                  <button part="mute" type="button" aria-pressed=${this.muted ? 'true' : 'false'} @click=${() => this.emit('lr-mute-change', { muted: !this.muted })}>
                    ${this.localize(this.muted ? 'realtimeSessionUnmute' : 'realtimeSessionMute')}
                  </button>
                  <button part="interrupt" type="button" @click=${() => this.emit('lr-interrupt')}>${this.localize('realtimeSessionInterrupt')}</button>
                `
              : nothing}
            <slot name="controls"></slot>
          </div>
        </header>
        ${this.state === 'error'
          ? html`<p part="error" role="alert">${this.localize('realtimeSessionConnectionFailed')}</p>`
          : nothing}
        ${this.showCapture
          ? html`<lr-push-to-talk part="capture" .disabled=${!active || this.muted} level-events></lr-push-to-talk>`
          : nothing}
        <lr-transcript-feed part="transcript" .entries=${this.entries}></lr-transcript-feed>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-realtime-session': LyraRealtimeSession;
  }
}

