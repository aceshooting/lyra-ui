import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import type { LyraTranscriptEntry } from '../transcript-feed/transcript-feed.class.js';
import type { AudioVisualizerState } from '../audio-visualizer/audio-visualizer.class.js';
import type { LyraPushToTalkEventMap } from '../push-to-talk/push-to-talk.class.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import '../audio-visualizer/audio-visualizer.class.js';
import '../push-to-talk/push-to-talk.class.js';
import '../transcript-feed/transcript-feed.class.js';
import '../../overlays/badge/badge.class.js';
import { styles } from './realtime-session.styles.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_open, LYRA_DEFAULT_realtimeSessionConnect, LYRA_DEFAULT_realtimeSessionConnected, LYRA_DEFAULT_realtimeSessionConnecting, LYRA_DEFAULT_realtimeSessionConnectionFailed, LYRA_DEFAULT_realtimeSessionDisconnect, LYRA_DEFAULT_realtimeSessionDisconnected, LYRA_DEFAULT_realtimeSessionError, LYRA_DEFAULT_realtimeSessionInterrupt, LYRA_DEFAULT_realtimeSessionLabel, LYRA_DEFAULT_realtimeSessionMute, LYRA_DEFAULT_realtimeSessionReconnecting, LYRA_DEFAULT_realtimeSessionUnmute } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type RealtimeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export interface LyraRealtimeSessionEventMap extends LyraPushToTalkEventMap {
  'lr-connect': CustomEvent<undefined>;
  'lr-disconnect': CustomEvent<undefined>;
  'lr-mute-change': CustomEvent<{ muted: boolean }>;
  'lr-interrupt': CustomEvent<undefined>;
}
const STATE_VARIANT: Record<RealtimeConnectionState, BadgeVariant> = {
  disconnected: 'neutral',
  connecting: 'brand',
  connected: 'success',
  reconnecting: 'warning',
  error: 'danger',
};

/**
 * `<lr-realtime-session>` — a provider-neutral voice-session shell composing connection status,
 * live activity, transcript, native capture, mute, interruption, and connect/disconnect intents.
 * Transport, authentication, audio playback, and SDK ownership remain with the host.
 * State transitions transfer focus from a disappearing session action to the replacement
 * connect/disconnect action. Hiding the public capture surface does the same only when capture
 * owned focus; surviving or foreign focus is never moved.
 *
 * @customElement lr-realtime-session
 * @slot controls - Additional provider-specific controls.
 * @event lr-connect - Connection was requested.
 * @event lr-disconnect - Disconnection was requested.
 * @event lr-mute-change - A controlled microphone mute change was requested.
 * @event lr-interrupt - Interruption of the current response was requested.
 * @event lr-record-start - Passthrough from capture. `detail: { stream: MediaStream }`.
 * @event lr-record-chunk - Passthrough from capture. `detail: { blob: Blob }`.
 * @event lr-record-stop - Passthrough from capture. `detail: { blob: Blob; durationMs: number }`.
 * @event lr-record-cancel - Passthrough from capture with no detail.
 * @event lr-record-error - Passthrough from capture. `detail: { error: DOMException | Error }`.
 * @event lr-level - Passthrough from capture. `detail: { level: number }`.
 * @event lr-state-change - Passthrough from capture. `detail: { state: PushToTalkState }`.
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
 * @status stable
 * @since 7.0.0
 */
export class LyraRealtimeSession extends LyraElement<LyraRealtimeSessionEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    open: LYRA_DEFAULT_open,
    realtimeSessionConnect: LYRA_DEFAULT_realtimeSessionConnect,
    realtimeSessionConnected: LYRA_DEFAULT_realtimeSessionConnected,
    realtimeSessionConnecting: LYRA_DEFAULT_realtimeSessionConnecting,
    realtimeSessionConnectionFailed: LYRA_DEFAULT_realtimeSessionConnectionFailed,
    realtimeSessionDisconnect: LYRA_DEFAULT_realtimeSessionDisconnect,
    realtimeSessionDisconnected: LYRA_DEFAULT_realtimeSessionDisconnected,
    realtimeSessionError: LYRA_DEFAULT_realtimeSessionError,
    realtimeSessionInterrupt: LYRA_DEFAULT_realtimeSessionInterrupt,
    realtimeSessionLabel: LYRA_DEFAULT_realtimeSessionLabel,
    realtimeSessionMute: LYRA_DEFAULT_realtimeSessionMute,
    realtimeSessionReconnecting: LYRA_DEFAULT_realtimeSessionReconnecting,
    realtimeSessionUnmute: LYRA_DEFAULT_realtimeSessionUnmute,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @property({ reflect: true }) state: RealtimeConnectionState = 'disconnected';
  @property({ attribute: 'voice-state' }) voiceState: AudioVisualizerState = 'idle';
  @property({ type: Number }) level: number | null = null;
  @property({ attribute: false }) stream: MediaStream | null = null;
  @property({ attribute: false }) entries: LyraTranscriptEntry[] = [];
  @property({ type: Boolean, reflect: true }) muted = false;
  /** Shows native push-to-talk capture. Hiding a focused capture transfers focus to the current
   *  connect/disconnect action; hiding it while another control owns focus leaves that focus alone. */
  @property({ type: Boolean, attribute: 'show-capture', reflect: true, converter: trueDefaultBooleanConverter })
  showCapture = true;
  /**
   * Host-readable provider diagnostic identifier. Informational only: changing it does not alter
   * localized error text, announcements, parts, events, or connection state.
   */
  @property({ attribute: 'error-code' }) errorCode = '';
  @property() label = '';
  private transferActionFocus = false;
  private statusAnnouncementSink?: AnnouncementSink;
  private errorAnnouncementSink?: AnnouncementSink;
  private suppressNextStateAnnouncement = true;

  private syncAnnouncementSinks(): void {
    if (!this.isConnected) return;
    if (
      this.statusAnnouncementSink?.element.ownerDocument === this.ownerDocument &&
      this.errorAnnouncementSink?.element.ownerDocument === this.ownerDocument
    )
      return;
    this.statusAnnouncementSink?.release();
    this.errorAnnouncementSink?.release();
    this.statusAnnouncementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.errorAnnouncementSink = acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSinks();
    if (this.hasUpdated) {
      // The state visible when a session reconnects is context, even if its write was queued while
      // detached and Lit has not processed that update yet.
      this.suppressNextStateAnnouncement = true;
      this.requestUpdate();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.statusAnnouncementSink?.release();
    this.errorAnnouncementSink?.release();
    this.statusAnnouncementSink = undefined;
    this.errorAnnouncementSink = undefined;
    this.suppressNextStateAnnouncement = true;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    const stateChanged = changed.has('state');
    const captureHidden = changed.has('showCapture') && changed.get('showCapture') === true && !this.showCapture;
    if (!stateChanged && !captureHidden) return;
    const focused = activeElementIn(this.shadowRoot ?? this.ownerDocument);
    const focusedPart = focused?.getAttribute('part') ?? null;
    this.transferActionFocus =
      captureHidden && !stateChanged
        ? focusedPart === 'capture'
        : focused !== null &&
          (focused.closest('[part="controls"]') !== null ||
            focusedPart === 'connect' ||
            focusedPart === 'disconnect' ||
            focusedPart === 'mute' ||
            focusedPart === 'interrupt' ||
            focusedPart === 'capture');
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    const stateChanged = changed.has('state');
    if (stateChanged && !this.suppressNextStateAnnouncement) {
      // A state supplied at mount is context. Later error transitions use only the assertive sink;
      // ordinary connection lifecycle transitions use only the polite sink, so no change is spoken
      // twice and no shadow-root live region is involved.
      if (this.state === 'error') {
        this.errorAnnouncementSink?.announce(this.localize('realtimeSessionConnectionFailed'));
      } else {
        this.statusAnnouncementSink?.announce(this.stateLabel());
      }
    }
    if ((stateChanged || changed.has('showCapture')) && this.transferActionFocus) {
      this.transferActionFocus = false;
      (this.renderRoot.querySelector('[part="connect"], [part="disconnect"]') as HTMLElement | null)?.focus();
    }
    this.suppressNextStateAnnouncement = false;
  }

  private stateLabel(): string {
    switch (this.state) {
      case 'disconnected':
        return this.localize('realtimeSessionDisconnected');
      case 'connecting':
        return this.localize('realtimeSessionConnecting');
      case 'connected':
        return this.localize('realtimeSessionConnected');
      case 'reconnecting':
        return this.localize('realtimeSessionReconnecting');
      case 'error':
        return this.localize('realtimeSessionError');
    }
  }

  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.label || this.localize('realtimeSessionLabel');
    const active = this.state === 'connected';
    const safeLevel = this.level == null ? null : finiteRange(this.level, 0, 0, 1);
    return html`
      <section
        part="base"
        aria-label=${label}
        aria-busy=${this.state === 'connecting' || this.state === 'reconnecting' ? 'true' : 'false'}
      >
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
              ? html`<button part="connect" type="button" @click=${() => this.emit('lr-connect')}>
                  ${this.localize('realtimeSessionConnect')}
                </button>`
              : html`<button part="disconnect" type="button" @click=${() => this.emit('lr-disconnect')}>
                  ${this.localize('realtimeSessionDisconnect')}
                </button>`}
            ${active
              ? html`
                  <button
                    part="mute"
                    type="button"
                    aria-pressed=${this.muted ? 'true' : 'false'}
                    @click=${() => this.emit('lr-mute-change', { muted: !this.muted })}
                  >
                    ${this.localize(this.muted ? 'realtimeSessionUnmute' : 'realtimeSessionMute')}
                  </button>
                  <button part="interrupt" type="button" @click=${() => this.emit('lr-interrupt')}>
                    ${this.localize('realtimeSessionInterrupt')}
                  </button>
                `
              : nothing}
            <slot name="controls"></slot>
          </div>
        </header>
        ${this.state === 'error'
          ? html`<p part="error">${this.localize('realtimeSessionConnectionFailed')}</p>`
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
