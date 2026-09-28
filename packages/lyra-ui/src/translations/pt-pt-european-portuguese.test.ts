import { expect } from '@open-wc/testing';
import { getRegisteredLyraLocaleKeys, resolveLyraString } from '../internal/localization.js';
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
//   2. a Brazilian-only word, spelling or idiom (senha, controle, celular, excluir, salvar,
//      registro, pressionado, o app, artefato, rastreamento, conectar/conexão, soltar for a drop
//      target, um por vez, ruim, deu errado, rolar, reprodutor, status, horário for a clock time,
//      informe, linha do tempo, relacionamento, caractere, feição, travar for a stall, ao vivo,
//      próximo for a Next control) where European Portuguese has its own distinct form
//      (palavra-passe, controlo, telemóvel, eliminar, guardar, registo, premido, a aplicação,
//      artefacto, rastreio, ligar/ligação, largar, um de cada vez, mau, correu mal, deslocar,
//      leitor, estado, hora, introduza, cronologia, relação, carácter, elemento, bloquear,
//      em direto, seguinte);
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
  expect(resolveLyraString(host, 'mcpAppLoading')).to.equal('A carregar a aplicação interativa…');
  expect(resolveLyraString(host, 'artifactPanelGenerating')).to.equal('A gerar…');
  expect(resolveLyraString(host, 'browserFrameStatusConnecting')).to.equal('A ligar…');
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
  expect(resolveLyraString(host, 'realtimeSessionConnecting')).to.equal('A ligar');
  expect(resolveLyraString(host, 'realtimeSessionReconnecting')).to.equal('A restabelecer a ligação');
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
    'A ligar a partir de x. Use as setas para escolher um destino, Enter para ligar, Escape para cancelar.',
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
  expect(resolveLyraString(host, 'mcpAppLabel')).to.equal('Aplicação interativa');
  expect(resolveLyraString(host, 'mcpAppUnavailable')).to.equal(
    'Não foi possível carregar esta aplicação interativa.',
  );
  expect(resolveLyraString(host, 'artifactPanelLabel')).to.equal('Artefacto');
  expect(resolveLyraString(host, 'traceTree')).to.equal('Árvore de rastreio');
  expect(resolveLyraString(host, 'agentTraceFilterLabel')).to.equal('Tipos de span do rastreio');
  expect(resolveLyraString(host, 'stackTraceLabel')).to.equal('Rastreio de pilha');
  expect(resolveLyraString(host, 'stackTraceLimit')).to.equal(
    'Parte do rastreio de pilha foi omitida porque o limite de exibição foi atingido.',
  );
  expect(resolveLyraString(host, 'evaluationRunToolTraceHeading')).to.equal('Rastreio de ferramentas');
  expect(resolveLyraString(host, 'fileInputDefaultLabel')).to.equal(
    'Largue os ficheiros aqui ou clique para procurar',
  );
  expect(resolveLyraString(host, 'dropzoneReleaseToAdd')).to.equal('Largue para adicionar o ficheiro.');
  expect(
    resolveLyraString(host, 'fileInputRejectedCount', undefined, undefined, { filename: 'x' }),
  ).to.equal('x: só é possível selecionar um ficheiro de cada vez.');
  expect(resolveLyraString(host, 'realtimeSessionConnect')).to.equal('Ligar');
  expect(resolveLyraString(host, 'realtimeSessionDisconnect')).to.equal('Desligar');
  expect(resolveLyraString(host, 'realtimeSessionConnected')).to.equal('Ligado');
  expect(resolveLyraString(host, 'realtimeSessionDisconnected')).to.equal('Desligado');
  expect(
    resolveLyraString(host, 'flowConnectTarget', undefined, undefined, {
      source: 'a',
      target: 'b',
      index: 1,
      total: 2,
    }),
  ).to.equal('A ligar a a b (1 de 2)');
  expect(
    resolveLyraString(host, 'flowConnectCommitted', undefined, undefined, { source: 'a', target: 'b' }),
  ).to.equal('a ligado a b');
  expect(resolveLyraString(host, 'entityDegree')).to.equal('Ligações');
  expect(resolveLyraString(host, 'feedbackNegative')).to.equal('Má resposta');
  expect(resolveLyraString(host, 'compareVoteBothBad')).to.equal('Ambas são más');
  expect(resolveLyraString(host, 'statTrendBad')).to.equal('mau');
  expect(resolveLyraString(host, 'documentPreviewGenericError')).to.equal('Algo correu mal.');
  expect(resolveLyraString(host, 'documentPreviewUrlNotAllowed')).to.equal('O URL do documento não é permitido.');
  expect(resolveLyraString(host, 'scrollerLabel')).to.equal('Conteúdo deslocável');
  expect(resolveLyraString(host, 'scrollPrevious')).to.equal('Deslocar para trás');
  expect(resolveLyraString(host, 'scrollNext')).to.equal('Deslocar para a frente');
  expect(resolveLyraString(host, 'avPlayerLabel')).to.equal('Leitor de áudio e vídeo');
  expect(resolveLyraString(host, 'graphNodeFocused', undefined, undefined, { label: 'x' })).to.equal(
    'Centrado em x',
  );
  expect(resolveLyraString(host, 'filterBarReset')).to.equal('Repor os filtros');
  expect(resolveLyraString(host, 'resetZoom')).to.equal('Repor o zoom');
  expect(resolveLyraString(host, 'breadcrumb')).to.equal('Trilho de navegação');
  expect(resolveLyraString(host, 'dataGridTreeLimitReached')).to.equal(
    'Linhas aninhadas adicionais foram omitidas porque o limite da árvore da grelha de dados foi atingido.',
  );
  expect(resolveLyraString(host, 'testResultsFilterLabel')).to.equal('Filtrar por estado');
  expect(resolveLyraString(host, 'agentRunStatusAnnounce', undefined, undefined, { status: 'x' })).to.equal(
    'Estado: x.',
  );
  expect(resolveLyraString(host, 'flowRunStatusLabel')).to.equal('Estado da execução');
  expect(resolveLyraString(host, 'knowledgeBaseSyncColumn')).to.equal('Estado da sincronização');
  expect(resolveLyraString(host, 'tokenInputRequired')).to.equal('Introduza pelo menos um valor.');
  expect(resolveLyraString(host, 'otpInputIncomplete', undefined, undefined, { total: 6 })).to.equal(
    'Introduza todos os 6 caracteres.',
  );
  expect(resolveLyraString(host, 'dateInputInvalid')).to.equal('Introduza uma data válida.');
  expect(resolveLyraString(host, 'timeInputLabel')).to.equal('Hora');
  expect(resolveLyraString(host, 'timeInputOpen')).to.equal('Abrir o seletor de hora');
  expect(resolveLyraString(host, 'timeInputPopup')).to.equal('Escolher uma hora');
  expect(resolveLyraString(host, 'timeInputInvalid')).to.equal('Introduza uma hora completa.');
  expect(resolveLyraString(host, 'timeInputMinMessage', undefined, undefined, { min: 'x' })).to.equal(
    'A hora deve ser igual ou posterior a x.',
  );
  expect(resolveLyraString(host, 'timeInputMaxMessage', undefined, undefined, { max: 'x' })).to.equal(
    'A hora deve ser igual ou anterior a x.',
  );
  expect(
    resolveLyraString(host, 'timeInputRangeMessage', undefined, undefined, { min: 'a', max: 'b' }),
  ).to.equal('A hora deve estar entre a e b, passando pela meia-noite.');
  expect(resolveLyraString(host, 'timeInputStepMessage')).to.equal(
    'Introduza uma hora que corresponda ao intervalo exigido.',
  );
  expect(resolveLyraString(host, 'textareaCharacterCount', undefined, undefined, { count: 1 })).to.equal(
    '1 carácter',
  );
  expect(
    resolveLyraString(host, 'textareaCharactersRemaining', undefined, undefined, { count: 1 }),
  ).to.equal('1 carácter restante');
  expect(resolveLyraString(host, 'geojsonViewFeatureCount', undefined, undefined, { count: 1 })).to.equal(
    '1 elemento',
  );
  expect(resolveLyraString(host, 'geojsonViewFeatureCount', undefined, undefined, { count: 2 })).to.equal(
    '2 elementos',
  );
  expect(resolveLyraString(host, 'timeline')).to.equal('Cronologia');
  expect(resolveLyraString(host, 'timelineClusterCount', undefined, undefined, { count: 3 })).to.equal(
    'Mostrar eventos da cronologia (3)',
  );
  expect(resolveLyraString(host, 'spanWaterfall')).to.equal('Cronologia dos spans');
  expect(resolveLyraString(host, 'graphQueryRelationshipTypeLabel')).to.equal('Tipo de relação');
  expect(resolveLyraString(host, 'provenanceRelationships')).to.equal('Relações');
  expect(resolveLyraString(host, 'neighborListLabel')).to.equal('Relações');
  expect(resolveLyraString(host, 'neighborListEmpty')).to.equal('Nenhuma relação');
  expect(resolveLyraString(host, 'voicePickerStopPreview')).to.equal('Parar a pré-visualização');
  expect(resolveLyraString(host, 'browserFrameStatusStalled')).to.equal('Bloqueado');
  expect(resolveLyraString(host, 'streamStallAnnounce')).to.equal('A ligação bloqueou.');
  expect(resolveLyraString(host, 'browserFrameStatusLive')).to.equal('Em direto');
  expect(resolveLyraString(host, 'checkpointLabel')).to.equal('Ponto de restauro');
  expect(resolveLyraString(host, 'queryBuilderOperatorStartsWith')).to.equal('Começa por');
  expect(resolveLyraString(host, 'approvalQueueOpen', undefined, undefined, { tool: 'x' })).to.equal(
    'Rever a aprovação de x',
  );
  expect(resolveLyraString(host, 'thoughtFor', undefined, undefined, { duration: '5 s' })).to.equal(
    'Raciocinou durante 5 s',
  );
  expect(resolveLyraString(host, 'randomContentPause')).to.equal('Pausar a rotação');
  expect(resolveLyraString(host, 'randomContentResume')).to.equal('Retomar a rotação');
  expect(resolveLyraString(host, 'memoryPanelConfirmForgetBody', undefined, undefined, { count: 3 })).to.equal(
    'Isto esquece permanentemente todas as 3 memórias de longo prazo.',
  );
  // European Portuguese interface text pairs 'anterior' with 'seguinte' for Next controls.
  expect(resolveLyraString(host, 'next')).to.equal('Seguinte');
  expect(resolveLyraString(host, 'nextMonth')).to.equal('Mês seguinte');
  expect(resolveLyraString(host, 'calendarNextMonth')).to.equal('Mês seguinte');
  expect(resolveLyraString(host, 'artifactPanelNextVersion')).to.equal('Versão seguinte');
  expect(resolveLyraString(host, 'branchNext')).to.equal('Versão seguinte');
  expect(resolveLyraString(host, 'ebookViewerNextChapter')).to.equal('Capítulo seguinte');
  expect(resolveLyraString(host, 'pptxViewerNextSlide')).to.equal('Slide seguinte');
  expect(resolveLyraString(host, 'pdfViewerNextPage')).to.equal('Página seguinte');
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
  expect(resolveLyraString(host, 'mcpAppLabel')).not.to.match(/^App\b/);
  expect(resolveLyraString(host, 'artifactPanelLabel')).not.to.equal('Artefato');
  expect(resolveLyraString(host, 'stackTraceLabel')).not.to.include('Rastreamento');
  expect(resolveLyraString(host, 'fileInputDefaultLabel')).not.to.match(/^Solte\b/);
  expect(
    resolveLyraString(host, 'fileInputRejectedCount', undefined, undefined, { filename: 'x' }),
  ).not.to.include('por vez');
  expect(resolveLyraString(host, 'realtimeSessionConnected')).not.to.equal('Conectado');
  expect(resolveLyraString(host, 'entityDegree')).not.to.equal('Conexões');
  // The words below are Brazilian in the sense these keys need but correct European Portuguese
  // in another, so they are pinned per key here rather than banned catalog-wide.
  expect(resolveLyraString(host, 'download')).not.to.equal('Baixar');
  expect(resolveLyraString(host, 'terminalDownload')).not.to.include('Baixar');
  expect(resolveLyraString(host, 'fileTreeLabel')).not.to.equal('Arquivos');
  expect(resolveLyraString(host, 'fileTypeFile')).not.to.equal('Arquivo');
  expect(resolveLyraString(host, 'widgetExitFullscreen')).not.to.include('tela');
  expect(resolveLyraString(host, 'colorPickerEyeDropper')).not.to.include('tela');
  expect(resolveLyraString(host, 'timeInputLabel')).not.to.equal('Horário');
  expect(resolveLyraString(host, 'timeInputPopup')).not.to.include('horário');
  expect(resolveLyraString(host, 'tokenInputRequired')).not.to.match(/^Informe\b/);
  expect(resolveLyraString(host, 'dateInputInvalid')).not.to.match(/^Informe\b/);
  expect(resolveLyraString(host, 'dataGridTreeLimitReached')).not.to.include('grade');
  expect(resolveLyraString(host, 'filterBarReset')).not.to.match(/^Redefinir\b/);
  expect(resolveLyraString(host, 'resetZoom')).not.to.match(/^Redefinir\b/);
  expect(resolveLyraString(host, 'voicePickerStopPreview')).not.to.include('prévia');
  expect(resolveLyraString(host, 'browserFrameStatusStalled')).not.to.equal('Travado');
  expect(resolveLyraString(host, 'streamStallAnnounce')).not.to.include('travou');
  expect(resolveLyraString(host, 'streamStallClearedAnnounce')).not.to.include('travada');
  expect(resolveLyraString(host, 'browserFrameStatusLive')).not.to.equal('Ao vivo');
  expect(resolveLyraString(host, 'chartTypeDoughnut')).not.to.equal('Rosca');
  expect(resolveLyraString(host, 'graphNodeFocused', undefined, undefined, { label: 'x' })).not.to.include(
    'Centralizado',
  );
  expect(resolveLyraString(host, 'neighborListLabel')).not.to.equal('Relacionamentos');
  expect(resolveLyraString(host, 'geojsonViewFeatureCount', undefined, undefined, { count: 2 })).not.to.include(
    'feições',
  );
  expect(resolveLyraString(host, 'breadcrumb')).not.to.include('Trilha');
  expect(resolveLyraString(host, 'checkpointLabel')).not.to.include('restauração');
  expect(resolveLyraString(host, 'memoryPanelConfirmForgetBody', undefined, undefined, { count: 3 })).not.to.match(
    /^Isso\b/,
  );
  expect(resolveLyraString(host, 'approvalQueueOpen', undefined, undefined, { tool: 'x' })).not.to.match(
    /^Revisar\b/,
  );
  expect(resolveLyraString(host, 'queryBuilderOperatorStartsWith')).not.to.equal('Começa com');
  expect(resolveLyraString(host, 'randomContentPause')).not.to.include('rodízio');
  expect(resolveLyraString(host, 'documentPreviewUrlNotAllowed')).not.to.match(/^A URL\b/);
  expect(resolveLyraString(host, 'next')).not.to.equal('Próximo');
  expect(resolveLyraString(host, 'pdfViewerNextPage')).not.to.equal('Próxima página');
});

// Catalog-wide guard: every message the pt-PT catalog registers, in every plural form it carries,
// is scanned for Brazilian forms that European-Portuguese interface text does not use.
// Placeholders are stripped first, because an unresolved '{status}' stays in the resolved text
// verbatim. Words that are Brazilian in one sense but correct European Portuguese in another are
// not listed here. That covers tela (a painting canvas), arquivo (an archive), excluir (exclude),
// baixar (lower), soltar (release a button), controle (a subjunctive), horário (a timetable),
// informe (a report), próximo (next in time), redefinir (redefine), prévia (prior), travar (brake),
// ao vivo (live music), centralizar (centralize), relacionamento (a personal relationship), feição
// (appearance), trilha (a track), grade (railing), isso and revisar (proofread). The previous test
// pins the keys where those words were fixed.
const BRAZILIAN_ONLY_FORMS: ReadonlyArray<[string, RegExp]> = [
  ['app/apps (European: aplicação)', /(?<![\p{L}\p{N}])apps?(?![\p{L}\p{N}])/iu],
  ['artefato (European: artefacto)', /(?<![\p{L}\p{N}])artefatos?(?![\p{L}\p{N}])/iu],
  ['rastreamento (European: rastreio)', /(?<![\p{L}\p{N}])rastreamentos?(?![\p{L}\p{N}])/iu],
  ['por vez (European: de cada vez)', /(?<![\p{L}\p{N}])por vez(?![\p{L}\p{N}])/iu],
  // Conector(es) is the standard noun for integration connectors in both regions; only the verb
  // family is under review here.
  ['conectar (European: ligar)', /(?<![\p{L}\p{N}])(?:des|re)?conect(?!or(?:es)?\b)\p{L}*/iu],
  ['conexão (European: ligação)', /(?<![\p{L}\p{N}])(?:conexão|conexões)(?![\p{L}\p{N}])/iu],
  ['você (European UI: imperative or third person)', /(?<![\p{L}\p{N}])vocês?(?![\p{L}\p{N}])/iu],
  ['usuário (European: utilizador)', /(?<![\p{L}\p{N}])usuári\p{L}*/iu],
  ['contato (European: contacto)', /(?<![\p{L}\p{N}])contatos?(?![\p{L}\p{N}])/iu],
  ['seção (European: secção)', /(?<![\p{L}\p{N}])(?:seção|seções)(?![\p{L}\p{N}])/iu],
  ['equipe (European: equipa)', /(?<![\p{L}\p{N}])equipes?(?![\p{L}\p{N}])/iu],
  ['celular (European: telemóvel)', /(?<![\p{L}\p{N}])celular(?:es)?(?![\p{L}\p{N}])/iu],
  ['ônibus (European: autocarro)', /(?<![\p{L}\p{N}])ônibus(?![\p{L}\p{N}])/iu],
  ['mouse (European: rato)', /(?<![\p{L}\p{N}])mouse(?![\p{L}\p{N}])/iu],
  ['cadastro (European: registo)', /(?<![\p{L}\p{N}])cadastr\p{L}*/iu],
  ['senha (European: palavra-passe)', /(?<![\p{L}\p{N}])senhas?(?![\p{L}\p{N}])/iu],
  ['pressionar (European: premir)', /(?<![\p{L}\p{N}])pression\p{L}*/iu],
  ['gerenciar (European: gerir)', /(?<![\p{L}\p{N}])gerenci\p{L}*/iu],
  ['registro/registrar (European: registo/registar)', /(?<![\p{L}\p{N}])registr\p{L}*/iu],
  ['salvar (European: guardar)', /(?<![\p{L}\p{N}])salvar(?![\p{L}\p{N}])/iu],
  ['ruim (European: mau/má)', /(?<![\p{L}\p{N}])ruins?(?![\p{L}\p{N}])/iu],
  ['deu errado (European: correu mal)', /(?<![\p{L}\p{N}])deu errado(?![\p{L}\p{N}])/iu],
  [
    'rolável/rolagem/rolar para (European: deslocar)',
    /(?<![\p{L}\p{N}])(?:roláve(?:l|is)|rolagem|rolar para)(?![\p{L}\p{N}])/iu,
  ],
  ['para frente (European: para a frente)', /(?<![\p{L}\p{N}])para frente(?![\p{L}\p{N}])/iu],
  ['reprodutor (European: leitor)', /(?<![\p{L}\p{N}])reprodutor(?:es)?(?![\p{L}\p{N}])/iu],
  ['status (European: estado)', /(?<![\p{L}\p{N}])status(?![\p{L}\p{N}])/iu],
  ['linha do tempo (European: cronologia)', /(?<![\p{L}\p{N}])linhas? do tempo(?![\p{L}\p{N}])/iu],
  ['caractere (European: carácter)', /(?<![\p{L}\p{N}])caractere(?![\p{L}\p{N}])/iu],
];

it('carries no Brazilian-only form in any registered pt-PT message or plural form', () => {
  const host = pt();
  const keys = getRegisteredLyraLocaleKeys('pt-PT');
  // Guards against a vacuous pass if the aggregate import ever stopped registering the catalog.
  expect(keys.length).to.be.greaterThan(1000);
  // No values selects the plain string or the plural 'other' form; the counts reach 'one' and
  // 'many' (European Portuguese uses 'many' for exact multiples of a million).
  const valueSets: ReadonlyArray<Record<string, number> | undefined> = [
    undefined,
    { count: 1 },
    { count: 2 },
    { count: 1000000 },
  ];
  const offenders: string[] = [];
  for (const key of keys) {
    const texts = new Set(
      valueSets.map((values) => resolveLyraString(host, key, undefined, undefined, values)),
    );
    for (const text of texts) {
      const prose = text.replace(/\{[^{}]*\}/g, ' ');
      for (const [label, pattern] of BRAZILIAN_ONLY_FORMS) {
        if (pattern.test(prose)) offenders.push(`${key}: ${label}: ${text}`);
      }
    }
  }
  expect(offenders).to.deep.equal([]);
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
  expect(resolveLyraString(host, 'chartTypeDoughnut')).to.equal('Anel');
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
  expect(resolveLyraString(host, 'streamStallClearedAnnounce')).to.equal('A ligação já não está bloqueada.');
  expect(resolveLyraString(host, 'streamStallClearedAnnounce')).not.to.include('não está mais');
  expect(resolveLyraString(host, 'streamStalled')).to.equal('Está a demorar mais do que o normal…');
  expect(
    resolveLyraString(host, 'geojsonViewMissingMapLibrary'),
  ).to.equal(
    'Instale o pacote opcional maplibre-gl para exibir este ficheiro num mapa. A mostrar o GeoJSON bruto em vez disso.',
  );
});
