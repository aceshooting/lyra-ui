/** Browser composition: provider transport and authorization remain application callbacks. */
import { html, render } from 'lit';
import { LyraChatViewport } from '@aceshooting/lyra-ui/components/lr-chat-viewport.js';
import { LyraMessageParts } from '@aceshooting/lyra-ui/components/lr-message-parts.js';
import { LyraSuggestionChips } from '@aceshooting/lyra-ui/components/lr-suggestion-chips.js';
import '@aceshooting/lyra-ui/components/lr-artifact-panel.js';
import { acquireAnnouncementSink } from '@aceshooting/lyra-ui/utilities/announcer.js';
import { LyraGenViewElement } from '@aceshooting/lyra-gen/gen-view.js';
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { createChatStream, moveChatSurface, type LyraGenChatAsk, type LyraGenChatSource } from '@aceshooting/lyra-gen/chat.js';

export function mountInteractiveChat(root: HTMLElement, host: {
  readonly sources: ReadonlyMap<string, LyraGenChatSource>;
  readonly canAsk: () => boolean;
  readonly onAsk: (request: LyraGenChatAsk) => void | Promise<void>;
  readonly onSource: (source: LyraGenChatSource) => void;
  readonly provenance: string;
  readonly onResume: () => void;
  /** Restart the unfinished tail, including its opening fence. */
  readonly onRetry: () => void;
  readonly onCancel: () => void;
}) {
  // Applications localize these host-owned labels before creating the composition.
  const labels = { loading: 'Loading generated content…', incomplete: 'This generated content was interrupted.',
    invalid: 'This generated content could not be displayed.', sourceUnavailable: 'Source unavailable',
    complete: 'Generated content ready.', panel: 'Generated answer', open: 'Open generated content in panel',
    return: 'Return to conversation', panelLink: 'Generated content is in the panel', retry: 'Retry', resume: 'Resume' };
  const controller = createChatStream({ messageId: 'assistant-answer', surfaceId: 'chat-answer',
    catalog: initialCatalog, strings: labels, provenance: host.provenance, sources: host.sources,
    suggestions: [{ id: 'ask:details', label: 'Explain further', question: 'Explain the answer in more detail.', context: { kind: 'follow-up' } }],
    canAsk: host.canAsk, onAsk: host.onAsk });
  const shells = new Map<string, HTMLElement>();
  const views = new Map<string, LyraGenViewElement>();
  const panelParts = new Set<string>();
  const completed = new Set<string>();
  let followFrame: number | undefined;
  let disposed = false;
  const announcements = acquireAnnouncementSink('polite', { document: root.ownerDocument, source: root });
  const transcript = new LyraMessageParts();
  const viewport = new LyraChatViewport();
  viewport.style.blockSize = 'var(--lr-chat-example-height, 24rem)';
  viewport.append(transcript);
  const suggestions = new LyraSuggestionChips();
  const panel = root.ownerDocument.createElement('lr-artifact-panel');
  panel.label = labels.panel;
  panel.hidden = true;
  render(html`<div>${viewport}${suggestions}</div>${panel}`, root);

  transcript.renderPart = part => {
    const island = controller.islandForPart(part.id);
    if (!island) return undefined; // Other custom data remains on its ordinary fallback path.
    if (panelParts.has(part.id)) return html`<button type="button" @click=${() => {
      const shell = shells.get(part.id); shell?.focus({ preventScroll: true });
    }}>${labels.panelLink}</button>`;
    return shells.get(part.id);
  };

  const update = () => {
    const snapshot = controller.snapshot;
    const live = new Set(snapshot.islands.map(island => island.partId));
    for (const [id, shell] of shells) {
      if (live.has(id)) continue;
      shell.remove(); shells.delete(id); views.delete(id); panelParts.delete(id);
    }
    for (const island of snapshot.islands) {
      let shell = shells.get(island.partId);
      if (!shell) {
        shell = root.ownerDocument.createElement('section');
        shell.tabIndex = -1; shell.setAttribute('aria-label', labels.panel);
        shells.set(island.partId, shell);
      }
      let view = views.get(island.partId);
      if (!view) {
        view = new LyraGenViewElement(); view.catalog = initialCatalog; views.set(island.partId, view);
        const ownedShell = shell;
        view.addEventListener('lr-gen-ready', event => {
          const current = controller.islandForPart(island.partId);
          if (current?.document?.surfaceId !== event.detail.surfaceId || current.document.revision !== event.detail.revision) return;
          ownedShell.setAttribute('aria-busy', 'false');
          scheduleFollow();
          if (!completed.has(island.partId)) {
            completed.add(island.partId); announcements.announce(labels.complete);
          }
        });
        view.addEventListener('lr-gen-error', () => ownedShell.setAttribute('aria-busy', 'false'));
      }
      const alreadyReady = view.document === island.document && view.status === 'ready';
      shell.setAttribute('aria-busy', island.status === 'loading' || island.status === 'ready' && !alreadyReady ? 'true' : 'false');
      shell.style.minBlockSize = island.status === 'loading' ? 'var(--lr-gen-chat-reserved-block-size, 4rem)' : '';
      if (island.document) view.document = island.document;
      render(html`<p>${island.provenance ?? ''}</p>
        ${island.status === 'ready' ? view : html`<p>${island.fallback}</p>`}
        ${island.status === 'ready' ? html`<button type="button" @click=${() => openInPanel(island.partId)}>${labels.open}</button>` : ''}
        ${island === snapshot.islands.at(-1) && (island.status === 'incomplete' || island.status === 'error') ? html`<button type="button" @click=${() => {
          if (snapshot.resumable) { controller.resume(); update(); host.onResume(); }
          else { controller.retry(); update(); host.onRetry(); }
        }}>${snapshot.resumable ? labels.resume : labels.retry}</button>` : ''}`, shell);

    }
    transcript.parts = snapshot.parts;
    void transcript.updateComplete.then(scheduleFollow);
    suggestions.suggestions = [{ suggestionId: 'ask:details', label: 'Explain further',
      disabled: snapshot.status !== 'complete' || controller.asking || !host.canAsk() }];
  };
  function scheduleFollow() {
    const owner = root.ownerDocument.defaultView;
    if (disposed || !owner || followFrame !== undefined) return;
    followFrame = owner.requestAnimationFrame(() => {
      followFrame = undefined;
      if (!disposed && viewport.follow && viewport.isConnected) viewport.scrollToBottom({ behavior: 'auto' });
    });
  }
  function openInPanel(partId: string) {
    const shell = shells.get(partId);
    if (!shell) return;
    panelParts.add(partId); panel.hidden = false;
    moveChatSurface(shell, panel);
    transcript.requestUpdate(); // The transcript's replacement links to this same shell.
  }
  function returnToTranscript(partId: string) {
    panelParts.delete(partId); transcript.requestUpdate();
    // Lit moves the cached shell into its original keyed part; it does not reconstruct the view.
    void transcript.updateComplete.then(() => {
      shells.get(partId)?.focus({ preventScroll: true });
      if (!panelParts.size) panel.hidden = true;
    });
  }
  const returnButton = root.ownerDocument.createElement('button');
  returnButton.type = 'button'; returnButton.slot = 'actions'; returnButton.textContent = labels.return;
  returnButton.addEventListener('click', () => { for (const partId of panelParts) returnToTranscript(partId); });
  panel.append(returnButton);
  suggestions.addEventListener('lr-suggestion-select', event => {
    const requested = controller.requestSuggestion(event.detail.suggestionId, crypto.randomUUID());
    update();
    void requested.then(update);
  });
  const selectSource = (event: Event) => {
    const sourceId = (event as CustomEvent<{ sourceId?: unknown }>).detail?.sourceId;
    if (typeof sourceId !== 'string') return;
    const source = host.sources.get(sourceId);
    if (source?.id === sourceId) host.onSource(source); // Recheck current viewer authorization.
  };
  root.addEventListener('lr-citation-activate', selectSource);
  update();
  return { controller, transcript, viewport, suggestions, panel, update,
    push: (chunk: string) => { controller.push(chunk); update(); },
    finish: () => { controller.finish(); update(); },
    interrupt: (resumable: boolean) => { controller.interrupt(resumable); update(); },
    cancel: () => { controller.cancel(); update(); host.onCancel(); },
    refreshSources: () => { controller.refreshSources(); update(); },
    openInPanel, returnToTranscript,
    dispose: () => { disposed = true; if (followFrame !== undefined) root.ownerDocument.defaultView?.cancelAnimationFrame(followFrame); controller.dispose(); announcements.release(); root.removeEventListener('lr-citation-activate', selectSource); render(null, root); shells.clear(); views.clear(); panelParts.clear(); completed.clear(); },
  };
}
