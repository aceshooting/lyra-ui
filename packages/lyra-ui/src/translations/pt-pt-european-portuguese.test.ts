import { expect } from '@open-wc/testing';
import { resolveLyraString } from '../internal/localization.js';
// Importing the aggregate registers every pt-PT family slice (agent-tools, charts, conversation,
// data, forms, media, retrieval, shared, utility, viewers) under the 'pt-PT' locale key. This test
// lives beside the aggregate (src/translations/), not inside src/translations/pt-PT/ itself: that
// per-locale directory is scanned by scripts/generate-translation-slices.mjs's stale-file check,
// which (unlike scripts/check-translations.mjs) does not exclude *.test.ts there and throws on any
// file name it does not recognize as a family slice.
import './pt-PT.js';

// Regression guard for the pt-PT catalog's European-Portuguese pass: earlier revisions of this
// catalog were a near-verbatim copy of pt-BR (Brazilian Portuguese), which leaks through in three
// recurring, mechanically detectable ways this suite locks down per message:
//   1. a bare progressive-tense gerund ('Carregando…') where European Portuguese uses the
//      periphrastic 'a' + infinitive construction ('A carregar…');
//   2. a Brazilian-only word (senha, controle, celular, excluir, salvar, registro, pressionado)
//      where European Portuguese has its own distinct term (palavra-passe, controlo, telemóvel,
//      eliminar, guardar, registo, premido);
//   3. a standalone label or announcement left lower-case by a mechanical find/replace pass that
//      swapped a capitalized Brazilian word for a lower-case European one without re-capitalizing
//      the result.
// Each assertion below resolves the live message through the same runtime path a component uses,
// not the raw source text, so it also catches a future edit that reintroduces the regression via a
// different literal.
function pt(): Element {
  const host = document.createElement('div');
  host.setAttribute('locale', 'pt-PT');
  return host;
}

it('uses the periphrastic "a" + infinitive for progressive/status labels, never a bare gerund', () => {
  const host = pt();
  expect(resolveLyraString(host, 'loading')).to.equal('A carregar…');
  expect(resolveLyraString(host, 'thinking')).to.equal('A raciocinar…');
  expect(resolveLyraString(host, 'tableLoading')).to.equal('A carregar linhas');
  expect(resolveLyraString(host, 'loadingDocument')).to.equal('A carregar o documento…');
  expect(resolveLyraString(host, 'convertingDocument')).to.equal('A converter o documento…');
  expect(resolveLyraString(host, 'pollRefreshing')).to.equal('A atualizar…');
  expect(resolveLyraString(host, 'pollRefreshingAnnounce')).to.equal('A atualizar agora.');
  expect(resolveLyraString(host, 'mcpAppLoading')).to.equal('A carregar o app interativo…');
  expect(resolveLyraString(host, 'artifactPanelGenerating')).to.equal('A gerar…');
  expect(resolveLyraString(host, 'browserFrameStatusConnecting')).to.equal('A conectar…');
  expect(resolveLyraString(host, 'toolCallBlockHeaderPending', undefined, undefined, { name: 'x' })).to.equal(
    'A aguardar para usar x',
  );
  expect(resolveLyraString(host, 'toolCallBlockHeaderRunning', undefined, undefined, { name: 'x' })).to.equal(
    'A usar x',
  );
  expect(resolveLyraString(host, 'evaluationRunStatusWaitingInput')).to.equal('A aguardar entrada');
  expect(resolveLyraString(host, 'evaluationRunStatusWaitingApproval')).to.equal('A aguardar aprovação');
  expect(resolveLyraString(host, 'agentRunStatusCollecting')).to.equal('A reunir contexto');
  expect(resolveLyraString(host, 'agentRunStatusWaitingInput')).to.equal('A aguardar entrada');
  expect(resolveLyraString(host, 'agentRunStatusWaitingApproval')).to.equal('A aguardar aprovação');
  expect(resolveLyraString(host, 'chatSending')).to.equal('A enviar…');
  expect(resolveLyraString(host, 'chatResponding')).to.equal('A responder…');
  expect(resolveLyraString(host, 'checkpointRestoring')).to.equal('A restaurar…');
  expect(resolveLyraString(host, 'pushToTalkRequesting')).to.equal('A solicitar o microfone…');
  expect(resolveLyraString(host, 'audioVisualizerListening')).to.equal('A ouvir');
  expect(resolveLyraString(host, 'audioVisualizerThinking')).to.equal('A raciocinar');
  expect(resolveLyraString(host, 'audioVisualizerSpeaking')).to.equal('A falar');
  expect(resolveLyraString(host, 'transcriptFeedInterim')).to.equal('A transcrever…');
  expect(resolveLyraString(host, 'realtimeSessionConnecting')).to.equal('A conectar');
  expect(resolveLyraString(host, 'realtimeSessionReconnecting')).to.equal('A reconectar');
  expect(resolveLyraString(host, 'documentLibraryFreshnessAging')).to.equal('A envelhecer');
  expect(resolveLyraString(host, 'knowledgeBaseSyncSyncing')).to.equal('A sincronizar');
  expect(resolveLyraString(host, 'knowledgeBaseSyncingSources')).to.equal('A sincronizar');
  expect(resolveLyraString(host, 'ingestionStageUploading')).to.equal('A enviar');
  expect(resolveLyraString(host, 'ingestionStageExtracting')).to.equal('A extrair o texto');
  expect(resolveLyraString(host, 'ingestionStageChunking')).to.equal('A dividir em trechos');
  expect(resolveLyraString(host, 'ingestionStageEmbedding')).to.equal('A gerar embeddings');
  expect(resolveLyraString(host, 'ingestionStageIndexing')).to.equal('A indexar');
  expect(
    resolveLyraString(host, 'attachmentUploadingWithContext', undefined, undefined, { label: 'x' }),
  ).to.equal('A enviar x');
  expect(resolveLyraString(host, 'attachmentUploadingIndeterminate')).to.equal('A enviar…');
  expect(
    resolveLyraString(host, 'embeddingExplorerPointLimit', undefined, undefined, { shown: 1, total: 2 }),
  ).to.equal('A mostrar 1 de 2 pontos.');
  expect(
    resolveLyraString(host, 'flowConnectStarted', undefined, undefined, { label: 'x' }),
  ).to.equal(
    'A conectar a partir de x. Use as setas para escolher um destino, Enter para conectar, Escape para cancelar.',
  );
});

it('does not resolve any of the fixed keys to their old bare-gerund Brazilian form', () => {
  const host = pt();
  const shouldNotStartWithGerund: ReadonlyArray<[string, Record<string, string | number>?]> = [
    ['loading'],
    ['thinking'],
    ['tableLoading'],
    ['chatSending'],
    ['chatResponding'],
    ['realtimeSessionConnecting'],
    ['realtimeSessionReconnecting'],
    ['knowledgeBaseSyncSyncing'],
    ['ingestionStageUploading'],
    ['ingestionStageIndexing'],
    ['agentRunStatusCollecting'],
    ['toolCallBlockHeaderRunning', { name: 'x' }],
  ];
  for (const [key, values] of shouldNotStartWithGerund) {
    expect(resolveLyraString(host, key, undefined, undefined, values)).not.to.match(
      /^[A-ZÀ-Ú][a-zà-ú]*(ando|endo|indo)\b/,
      `expected ${key} not to open with a bare Brazilian-style gerund`,
    );
  }
});

it('uses European vocabulary in place of the Brazilian counterpart', () => {
  const host = pt();
  expect(resolveLyraString(host, 'showPassword')).to.equal('Mostrar a palavra-passe');
  expect(resolveLyraString(host, 'hidePassword')).to.equal('Ocultar a palavra-passe');
  expect(resolveLyraString(host, 'sliderLabel')).to.equal('Controlo deslizante');
  expect(resolveLyraString(host, 'browserFrameTakeOver')).to.equal('Assumir o controlo');
  expect(resolveLyraString(host, 'browserFrameHandBack')).to.equal('Devolver o controlo');
  expect(resolveLyraString(host, 'contactViewerTypeCell')).to.equal('Telemóvel');
  expect(resolveLyraString(host, 'gitStatusDeleted')).to.equal('Eliminado');
  expect(resolveLyraString(host, 'deleteConversation')).to.equal('Eliminar a conversa');
  expect(resolveLyraString(host, 'knowledgeBaseDeleteAction')).to.equal('Eliminar a fonte');
  expect(
    resolveLyraString(host, 'graphQueryDeleteWithContext', undefined, undefined, { name: 'x' }),
  ).to.equal('Eliminar x');
  expect(resolveLyraString(host, 'promptStudioSave')).to.equal('Guardar a versão');
  expect(resolveLyraString(host, 'graphQuerySaveButton')).to.equal('Guardar a consulta');
  expect(resolveLyraString(host, 'graphQuerySavedQueriesLabel')).to.equal('Consultas guardadas');
  expect(resolveLyraString(host, 'terminalDownload')).to.equal('Transferir o registo');
  expect(
    resolveLyraString(host, 'compareVoteRecorded', undefined, undefined, { label: 'x' }),
  ).to.equal('Voto registado: x');
  expect(resolveLyraString(host, 'pushToTalkHold')).to.equal('Mantenha premido para falar');
  expect(resolveLyraString(host, 'fileInputFolderRejected')).to.equal('Pastas não são aceites aqui.');
});

it('does not resolve any of the fixed keys to their old Brazilian-only word', () => {
  const host = pt();
  expect(resolveLyraString(host, 'showPassword')).not.to.include('senha');
  expect(resolveLyraString(host, 'sliderLabel')).not.to.include('Controle');
  expect(resolveLyraString(host, 'contactViewerTypeCell')).not.to.equal('Celular');
  expect(resolveLyraString(host, 'gitStatusDeleted')).not.to.equal('Excluído');
  expect(resolveLyraString(host, 'promptStudioSave')).not.to.include('Salvar');
  expect(resolveLyraString(host, 'terminalDownload')).not.to.include('registro');
  expect(resolveLyraString(host, 'pushToTalkHold')).not.to.include('pressionado');
});

it('capitalizes standalone labels and announcements a lower-case find/replace pass left lower-case', () => {
  const host = pt();
  expect(resolveLyraString(host, 'download')).to.equal('Transferir');
  expect(resolveLyraString(host, 'streamRecoverAnnounce')).to.equal('Ligação restabelecida.');
  expect(resolveLyraString(host, 'flowConnectCancelled')).to.equal('Ligação cancelada');
  expect(resolveLyraString(host, 'chartTypeLine')).to.equal('Linhas');
  expect(resolveLyraString(host, 'chartTypeBar')).to.equal('Barras');
  expect(resolveLyraString(host, 'chartTypeScatter')).to.equal('Dispersão');
  expect(resolveLyraString(host, 'chartTypePie')).to.equal('Circular');
  expect(resolveLyraString(host, 'chartTypeDoughnut')).to.equal('Rosca');
  expect(resolveLyraString(host, 'chartTypeRadar')).to.equal('Radar');
  expect(resolveLyraString(host, 'chartTypePolarArea')).to.equal('Área polar');
  expect(resolveLyraString(host, 'chartTypeBubble')).to.equal('Bolhas');
});

it('uses European syntax: até ao/à, já não instead of não … mais, and mais do que', () => {
  const host = pt();
  expect(resolveLyraString(host, 'anchorJumped')).to.equal('Navegou até ao trecho destacado.');
  expect(
    resolveLyraString(host, 'anchorJumpedToPage', undefined, undefined, { page: 3 }),
  ).to.equal('Navegou até à página 3.');
  expect(resolveLyraString(host, 'streamStallClearedAnnounce')).to.equal('A ligação já não está travada.');
  expect(resolveLyraString(host, 'streamStallClearedAnnounce')).not.to.include('não está mais');
  expect(resolveLyraString(host, 'streamStalled')).to.equal('Está a demorar mais do que o normal…');
  expect(
    resolveLyraString(host, 'geojsonViewMissingMapLibrary'),
  ).to.equal(
    'Instale o pacote opcional maplibre-gl para exibir este ficheiro num mapa. A mostrar o GeoJSON bruto em vez disso.',
  );
});
