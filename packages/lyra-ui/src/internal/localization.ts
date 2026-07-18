/**
 * The message keys used by Lyra's built-in labels. Applications can register
 * additional keys as well; components may use a component-specific key when
 * a message is not part of this common set.
 */
export type LyraMessageKey =
  | 'noData'
  | 'graphLegendLabel'
  | 'legendTypeShown'
  | 'legendTypeHidden'
  | 'entityChipWithType'
  | 'jumpToLatest'
  | 'terminalLabel'
  | 'terminalDownload'
  | 'sequenceStripEmpty'
  | 'sequenceStripCategoryCount'
  | 'noColumns'
  | 'loadMore'
  | 'viewerSearchMatchCount'
  | 'viewerSearchMatchCountPlural'
  | 'viewerSearchNoMatches'
  | 'viewerSearchActiveMatch'
  | 'viewerHighlightLabel'
  | 'tableFilterLabel'
  | 'tableFilterPlaceholder'
  | 'tableLoading'
  | 'tableEditCell'
  | 'carousel'
  | 'carouselLabel'
  | 'carouselSlide'
  | 'carouselSlidePosition'
  | 'carouselIndicators'
  | 'carouselGoTo'
  | 'imageComparerLabel'
  | 'zoomableFrameLabel'
  | 'zoomControls'
  | 'zoomOut'
  | 'zoomIn'
  | 'lightboxLabel'
  | 'lightboxImagePosition'
  | 'scrollerLabel'
  | 'chatViewportLabel'
  | 'newMessageCount'
  | 'newMessagesCount'
  | 'newMessages'
  | 'scrollPrevious'
  | 'scrollNext'
  | 'showAllColumns'
  | 'showFewerColumns'
  | 'clear'
  | 'openCalendar'
  | 'open'
  | 'close'
  | 'closeNavigation'
  | 'openNavigation'
  | 'resizeNavigation'
  | 'copy'
  | 'copyJson'
  | 'copied'
  | 'expand'
  | 'collapse'
  | 'expandMessage'
  | 'collapseMessage'
  | 'messageActionsLabel'
  | 'regenerateResponse'
  | 'editMessage'
  | 'showMore'
  | 'showMoreCount'
  | 'showLess'
  | 'retry'
  | 'remove'
  | 'removeWithContext'
  | 'playWithContext'
  | 'pauseWithContext'
  | 'loading'
  | 'loadingDocument'
  | 'noMatches'
  | 'previous'
  | 'next'
  | 'paginationLabel'
  | 'paginationPage'
  | 'branchPickerLabel'
  | 'branchPrevious'
  | 'branchNext'
  | 'branchPosition'
  | 'paginationSummary'
  | 'paginationEmptySummary'
  | 'paginationApplied'
  | 'cancel'
  | 'confirm'
  | 'search'
  | 'circularReference'
  | 'items'
  | 'item'
  | 'trendOf'
  | 'wordCloud'
  | 'notInCatalog'
  | 'sendMessage'
  | 'stopGenerating'
  | 'dropzoneReleaseToAdd'
  | 'dropzoneRejectedType'
  | 'fileSizeUnitB'
  | 'fileSizeUnitKb'
  | 'fileSizeUnitMb'
  | 'fileSizeUnitGb'
  | 'fileSizeUnitTb'
  | 'chartCategory'
  | 'chartPointLabel'
  | 'resetZoom'
  | 'chatSending'
  | 'chatResponding'
  | 'chatFailedToSend'
  | 'chatFailedAnnounce'
  | 'chatCompleteAnnounce'
  | 'showMoreCollapsed'
  | 'expandCode'
  | 'collapseCode'
  | 'copyCode'
  | 'copiedToClipboard'
  | 'codeRegion'
  | 'codeRegionWithLanguage'
  | 'codeBlockLineLabel'
  | 'copyDiff'
  | 'diffViewOldLabel'
  | 'diffViewNewLabel'
  | 'jsonArray'
  | 'jsonObject'
  | 'jsonValue'
  | 'jsonCopyLabel'
  | 'jsonExpandLabel'
  | 'jsonCollapseLabel'
  | 'jsonItemCount'
  | 'jsonItemCountPlural'
  | 'jsonKeyCount'
  | 'jsonKeyCountPlural'
  | 'untitledSource'
  | 'sourcePageSuffix'
  | 'toolCall'
  | 'statusPending'
  | 'statusRunning'
  | 'statusSuccess'
  | 'statusError'
  | 'statusDenied'
  | 'maximize'
  | 'restore'
  | 'wordCloudWord'
  | 'wordCloudWords'
  | 'pollPause'
  | 'pollResume'
  | 'pollRefreshing'
  | 'pollPaused'
  | 'pollPausedAnnounce'
  | 'pollResumedAnnounce'
  | 'pollRefreshingAnnounce'
  | 'attachmentAdd'
  | 'attachmentTriggerFiles'
  | 'attachmentTriggerImage'
  | 'attachmentTriggerCamera'
  | 'attachmentMenuFiles'
  | 'attachmentMenuImage'
  | 'attachmentMenuCamera'
  | 'checkboxRequired'
  | 'checkboxGroupRequired'
  | 'tokenInputRequired'
  | 'commandPaletteLabel'
  | 'commandPalettePlaceholder'
  | 'commandPaletteEmpty'
  | 'commandPaletteResults'
  | 'iconButtonLabel'
  | 'codeEditorLabel'
  | 'dataGridLabel'
  | 'calendarLabel'
  | 'calendarEmpty'
  | 'switchRequired'
  | 'citationHighConfidence'
  | 'citationMediumConfidence'
  | 'citationLowConfidence'
  | 'citationVerified'
  | 'citationUnverified'
  | 'contextMeterUsed'
  | 'contextMeterUsedOfTotal'
  | 'contextMeterSegmentLabel'
  | 'untitledConversation'
  | 'dockPanelCollapse'
  | 'dockPanelExpand'
  | 'dockPanelResize'
  | 'documentPreviewAlt'
  | 'documentPreviewUrlNotAllowed'
  | 'documentPreviewFailedToLoad'
  | 'documentPreviewResourceTooLarge'
  | 'documentPreviewGenericError'
  | 'ebookViewerLoadError'
  | 'ebookViewerRegionLabel'
  | 'fileTypeFile'
  | 'fileTypePdf'
  | 'fileTypeWord'
  | 'fileTypeSpreadsheet'
  | 'fileTypePresentation'
  | 'fileTypeText'
  | 'fileTypeCode'
  | 'fileTypeArchive'
  | 'fileTypeImage'
  | 'fileTypeAudio'
  | 'fileTypeVideo'
  | 'fileTypeWithSize'
  | 'pptxViewerLabel'
  | 'pptxViewerFidelityNotice'
  | 'pptxViewerRenderError'
  | 'pptxViewerPreviousSlide'
  | 'pptxViewerNextSlide'
  | 'pptxViewerSlideOf'
  | 'documentViewerLabel'
  | 'attachmentPreviewName'
  | 'attachmentPreviewFile'
  | 'documentViewerMissingSanitizer'
  | 'docxViewerLabel'
  | 'docxViewerMissingConverter'
  | 'svgViewerLabel'
  | 'htmlViewerLabel'
  | 'datasetViewerMissingParser'
  | 'datasetViewerEmpty'
  | 'datasetViewerCaption'
  | 'datasetViewerCaptionNamed'
  | 'contactViewerLabel'
  | 'contactViewerNoContacts'
  | 'contactViewerUnnamedContact'
  | 'contactViewerPhoneLabel'
  | 'contactViewerEmailLabel'
  | 'contactViewerAddressLabel'
  | 'contactViewerOrganizationLabel'
  | 'exportButtonLabel'
  | 'generationStatusElapsedSeconds'
  | 'generationStatusTokenCount'
  | 'generationStatusTokensCount'
  | 'generationStatusThroughput'
  | 'graphDataList'
  | 'graphItemAnnouncement'
  | 'navigation'
  | 'attachmentRetryWithContext'
  | 'attachmentUploadingWithContext'
  | 'attachmentUploadingProgress'
  | 'attachmentUploadingIndeterminate'
  | 'attachmentUploadFailed'
  | 'attachmentUntitledFile'
  | 'chartTrendIncreasing'
  | 'chartTrendDecreasing'
  | 'chartTrendFlat'
  | 'chartSummary'
  | 'chartSeriesNoData'
  | 'chartSummaryWithData'
  | 'chartSummaryEmpty'
  | 'chartSummarySeparator'
  | 'chartData'
  | 'chart'
  | 'chartTypeLine'
  | 'chartTypeBar'
  | 'chartTypeScatter'
  | 'chartTypePie'
  | 'chartTypeDoughnut'
  | 'chartTypeRadar'
  | 'chartTypePolarArea'
  | 'chartTypeBubble'
  | 'boxPlotSeriesSummary'
  | 'boxPlotSummaryWithData'
  | 'boxPlotSummaryEmpty'
  | 'boxPlotData'
  | 'chartSeriesLabel'
  | 'boxPlotMin'
  | 'boxPlotQ1'
  | 'boxPlotMedian'
  | 'boxPlotQ3'
  | 'boxPlotMax'
  | 'boxPlot'
  | 'histogramFrequency'
  | 'liteChartMarkPosition'
  | 'liteChartMarkSummary'
  | 'liteChartBarLabel'
  | 'composerLabel'
  | 'textareaLabel'
  | 'citation'
  | 'citationWithStatus'
  | 'comboboxOverflow'
  | 'comboboxRequired'
  | 'comboboxLabel'
  | 'rename'
  | 'previousMonth'
  | 'nextMonth'
  | 'chooseDate'
  | 'date'
  | 'dateInputMinMessage'
  | 'dateInputMaxMessage'
  | 'dateInputPastDisabled'
  | 'dateInputFutureDisabled'
  | 'dateInputInvalid'
  | 'documentPreviewEmpty'
  | 'convertingDocument'
  | 'documentPreviewNotAvailable'
  | 'documentPreviewGenericFile'
  | 'documentPreviewTypeDocument'
  | 'documentPreviewTypeImage'
  | 'documentPreviewTypeEmail'
  | 'documentPreviewTypeCalendar'
  | 'archiveViewerUnavailable'
  | 'archiveViewerEmpty'
  | 'archiveViewerFolder'
  | 'archiveViewerFile'
  | 'documentPreviewTypeDataset'
  | 'documentPreviewTypeContact'
  | 'download'
  | 'exportFormatMenuLabel'
  | 'fileInputDefaultLabel'
  | 'fileInputAcceptedOne'
  | 'fileInputAcceptedMany'
  | 'fileInputRejectedOne'
  | 'fileInputRejectedMany'
  | 'fileInputFolderRejected'
  | 'elapsedMinutesSecondsTemplate'
  | 'graphNode'
  | 'graphLink'
  | 'graphDiagram'
  | 'graphTypedNode'
  | 'graphExpandableItem'
  | 'graphNodeFocused'
  | 'graphSelectionCount'
  | 'graphNodesHidden'
  | 'graphCommunity'
  | 'heatmapValueLabel'
  | 'heatmapMatrixCellLabel'
  | 'heatmapCalendarLabel'
  | 'heatmapMatrixLabel'
  | 'heatmapCalendarCellLabel'
  | 'heatmapNoDataValue'
  | 'heatmapDefaultRowLabel'
  | 'heatmapDefaultColLabel'
  | 'heatmapSelectedCellLabel'
  | 'heatmapCellSelectedSuffix'
  | 'inputLabel'
  | 'showPassword'
  | 'hidePassword'
  | 'radioRequired'
  | 'progress'
  | 'popover'
  | 'details'
  | 'breadcrumb'
  | 'timeline'
  | 'rating'
  | 'sliderLabel'
  | 'feedbackPositive'
  | 'feedbackNegative'
  | 'feedbackReasonsLabel'
  | 'feedbackCommentLabel'
  | 'feedbackCommentPlaceholder'
  | 'feedbackSubmit'
  | 'feedbackSubmitted'
  | 'colorPicker'
  | 'mediaCardUntitledFile'
  | 'mediaCardOpenName'
  | 'mediaCardOpenImageAttachment'
  | 'mediaCardOpenVideoAttachment'
  | 'mediaCardOpenFileAttachment'
  | 'mediaCardImageAttachment'
  | 'mediaCardVideoAttachment'
  | 'animatedImageDefaultAlt'
  | 'mentionSuggestions'
  | 'suggestionsLabel'
  | 'map'
  | 'model'
  | 'selectModel'
  | 'modelSelectNoModels'
  | 'modelSelectRequired'
  | 'temperature'
  | 'play'
  | 'playbackPosition'
  | 'selectValueMissing'
  | 'select'
  | 'sourceListDefaultLabel'
  | 'threadListLabel'
  | 'threadGroupPinned'
  | 'threadGroupToday'
  | 'threadGroupYesterday'
  | 'threadGroupPrevious7Days'
  | 'threadGroupPrevious30Days'
  | 'threadGroupArchived'
  | 'pinConversation'
  | 'unpinConversation'
  | 'archiveConversation'
  | 'unarchiveConversation'
  | 'deleteConversation'
  | 'searchThreads'
  | 'threadListMatchAnnounce'
  | 'threadListMatchAnnouncePlural'
  | 'threadListEmpty'
  | 'resizeDivider'
  | 'trendUnchanged'
  | 'trendIncreased'
  | 'trendDecreased'
  | 'trendGoodSuffix'
  | 'trendBadSuffix'
  | 'streamStalled'
  | 'streamStallAnnounce'
  | 'streamRecoverAnnounce'
  | 'streamStallClearedAnnounce'
  | 'thinkingPanelLabel'
  | 'taskListLabel'
  | 'taskListCompletedOfTotal'
  | 'taskListStepStartedAnnounce'
  | 'taskListStepCompletedAnnounce'
  | 'taskListStepFailedAnnounce'
  | 'activityFeedLabel'
  | 'activityFeedCompletedSteps'
  | 'activityFeedCompletedStep'
  | 'handoffLabel'
  | 'handoffToAgent'
  | 'handoffFromToAgent'
  | 'usageBadgeLabel'
  | 'usageBadgeTokensIn'
  | 'usageBadgeTokensOut'
  | 'usageBadgeTokensInLabel'
  | 'usageBadgeTokensOutLabel'
  | 'usageBadgeTotalTokensLabel'
  | 'usageBadgeCostLabel'
  | 'usageBadgeLatencyLabel'
  | 'checkpointLabel'
  | 'checkpointRestore'
  | 'checkpointRestoreWithContext'
  | 'checkpointRestoring'
  | 'checkpointConfirmPrompt'
  | 'thoughtFor'
  | 'thinking'
  | 'rangeStart'
  | 'rangeEnd'
  | 'closeWithContext'
  | 'toolApprovalHeading'
  | 'toolApprovalGenericTool'
  | 'toolApprovalArgsLabel'
  | 'confirmApproved'
  | 'confirmDenied'
  | 'confirmApprovedAnnounce'
  | 'confirmDeniedAnnounce'
  | 'deny'
  | 'edit'
  | 'approve'
  | 'invalidJson'
  | 'fieldRequired'
  | 'fieldMustBeString'
  | 'fieldMustBeNumber'
  | 'fieldMustBeInteger'
  | 'fieldMustBeBoolean'
  | 'unsupportedFieldType'
  | 'fieldMustBeOneOf'
  | 'fieldMustEqual'
  | 'schemaMustBeObject'
  | 'schemaPropertiesMustBeFlat'
  | 'valueMustBeSerializable'
  | 'valueInvalid'
  | 'phoneInputIncomplete'
  | 'durationMilliseconds'
  | 'durationSeconds'
  | 'selectTools'
  | 'searchToolsPlaceholder'
  | 'useDefaultTools'
  | 'toolSelectCustomizeHint'
  | 'noMatchesQuery'
  | 'toolSelectNoneAvailable'
  | 'toolSelectSummary'
  | 'toolCount'
  | 'toolCountPlural'
  | 'otherCategory'
  | 'widgetFullscreenPanel'
  | 'widgetViewGroup'
  | 'widgetExitFullscreen'
  | 'widgetExpandToFullscreen'
  | 'menuLabel'
  | 'pause'
  | 'kbdEscapeVisual'
  | 'kbdEscapeWord'
  | 'kbdTabWord'
  | 'kbdSpaceWord'
  | 'kbdDeleteVisual'
  | 'kbdDeleteWord'
  | 'kbdHomeWord'
  | 'kbdEndWord'
  | 'kbdPageUpVisual'
  | 'kbdPageUpWord'
  | 'kbdPageDownVisual'
  | 'kbdPageDownWord'
  | 'kbdEnterWord'
  | 'kbdBackspaceWord'
  | 'kbdArrowUpWord'
  | 'kbdArrowDownWord'
  | 'kbdArrowLeftWord'
  | 'kbdArrowRightWord'
  | 'kbdPlusWord'
  | 'kbdMinusWord'
  | 'kbdCommandWord'
  | 'kbdControlVisual'
  | 'kbdControlWord'
  | 'kbdOptionWord'
  | 'kbdAltWord'
  | 'kbdShiftWord'
  | 'emailViewerLabel'
  | 'emailViewerMissingParser'
  | 'emailViewerFrom'
  | 'emailViewerTo'
  | 'emailViewerSubject'
  | 'emailViewerDate'
  | 'emailViewerAttachments'
  | 'emailViewerNoSubject'
  | 'emailViewerOpenAttachment'
  | 'emailViewerShowQuoted'
  | 'emailViewerHideQuoted'
  | 'calendarViewerLabel'
  | 'calendarViewerMissingParser'
  | 'calendarViewerEmpty'
  | 'calendarViewerNoSummary'
  | 'pdfViewerLabel'
  | 'pdfViewerMissingLibrary'
  | 'qrCodeMissingLibrary'
  | 'qrCodeGenerationFailed'
  | 'pdfViewerPageOf'
  | 'pdfViewerZoomIn'
  | 'pdfViewerZoomOut'
  | 'pdfViewerCurrentZoom'
  | 'pdfViewerPreviousPage'
  | 'pdfViewerNextPage'
  | 'anchorJumped'
  | 'anchorJumpedToPage'
  | 'anchorNotFound'
  | 'highlightLayerLabel'
  | 'highlightWithLabel'
  | 'highlightOfTotal'
  | 'pageRailLabel'
  | 'pageRailPage'
  | 'pageRailPageHighlighted'
  | 'pageRailPageHighlightedPlural'
  | 'spreadsheetViewerUnavailable'
  | 'csvViewerUnavailable'
  | 'csvViewerLabel'
  | 'spreadsheetViewerLabel'
  | 'knownDateDay'
  | 'knownDateMonth'
  | 'knownDateYear'
  | 'skipToContent'
  | 'tourSkip'
  | 'tourDone'
  | 'tourStepOf'
  | 'emojiPickerSearchLabel'
  | 'emojiPickerGridLabel'
  | 'emojiPickerEmpty'
  | 'pushToTalkRequesting'
  | 'pushToTalkDenied'
  | 'pushToTalkError'
  | 'pushToTalkUnsupported'
  | 'pushToTalkStarted'
  | 'pushToTalkStopped'
  | 'pushToTalkCancelled'
  | 'pushToTalkHold'
  | 'pushToTalkStart'
  | 'pushToTalkStop'
  | 'traceTree'
  | 'traceTreeSpanStatus'
  | 'spanKindAgent'
  | 'spanKindLlm'
  | 'spanKindTool'
  | 'spanKindRetriever'
  | 'spanKindEmbedding'
  | 'spanKindOther'
  | 'tokensIn'
  | 'tokensOut'
  | 'cost'
  | 'duration'
  | 'spanWaterfall'
  | 'spanStartedAtOffset'
  | 'spanTokens'
  | 'rubricSubmit'
  | 'rubricSubmitAndNext'
  | 'rubricSkip'
  | 'compareResponseA'
  | 'compareResponseB'
  | 'compareVoteLabel'
  | 'compareVoteBetter'
  | 'compareVoteTie'
  | 'compareVoteBothBad'
  | 'compareVoteRecorded'
  | 'comparePanel'
  | 'audioVisualizerLabel'
  | 'audioVisualizerIdle'
  | 'audioVisualizerListening'
  | 'audioVisualizerThinking'
  | 'audioVisualizerSpeaking'
  | 'fileTreeLabel'
  | 'fileTreeDiffSummary'
  | 'gitStatusAdded'
  | 'gitStatusModified'
  | 'gitStatusDeleted'
  | 'gitStatusRenamed'
  | 'gitStatusUntracked'
  | 'gitStatusConflicted'
  | 'gitStatusIgnored'
  | 'imageViewerLabel'
  | 'imageViewerFailedToLoad'
  | 'imageViewerRotate'
  | 'imageViewerFitLabel'
  | 'imageViewerFitContain'
  | 'imageViewerFitWidth'
  | 'imageViewerFitActual'
  | 'imageViewerAnnotate'
  | 'imageViewerHighlightsLabel'
  | 'imageViewerUnlabeledHighlight'
  | 'imageViewerAnnotationHint'
  | 'imageViewerAnnotationBoxPosition'
  | 'imageViewerAnnotationAdded'
  | 'imageViewerAnnotationCancelled'
  | 'transcriptFeedLabel'
  | 'transcriptFeedEmpty'
  | 'transcriptFeedInterim'
  | 'commitCardLabel'
  | 'commitCardCopyHash'
  | 'commitCardDiffSummary'
  | 'commitCardShowFiles'
  | 'commitCardHideFiles'
  | 'stackTraceLabel'
  | 'stackTraceShowFrames'
  | 'stackTraceHideFrames'
  | 'statusSkipped'
  | 'testResultsLabel'
  | 'testResultsPassed'
  | 'testResultsFailed'
  | 'testResultsSkipped'
  | 'testResultsRunning'
  | 'testResultsFilterLabel'
  | 'testResultsCompleteAnnounce'
  | 'envListLabel'
  | 'envListReveal'
  | 'envListHide'
  | 'envListValueHidden'
  | 'envListCopy'
  | 'voice'
  | 'voicePickerNoVoices'
  | 'voicePickerRequired'
  | 'voicePickerPreview'
  | 'voicePickerStopPreview'
  | 'avPlayerLabel'
  | 'avPlayerFailedToLoad'
  | 'avPlayerTranscript'
  | 'avPlayerTimeline'
  | 'avPlayerPlaybackRate'
  | 'avPlayerPosition'
  | 'attachmentTriggerAudio'
  | 'attachmentMenuAudio'
  | 'browserFrameLabel'
  | 'browserFrameUrlLabel'
  | 'browserFrameViewOf'
  | 'browserFrameTakeOver'
  | 'browserFrameHandBack'
  | 'browserFrameStop'
  | 'browserFrameStatusIdle'
  | 'browserFrameStatusConnecting'
  | 'browserFrameStatusLive'
  | 'browserFrameStatusStalled'
  | 'notebookViewerLabel'
  | 'notebookViewerInvalid'
  | 'notebookViewerUnsupportedVersion'
  | 'notebookViewerTooManyCells'
  | 'notebookViewerInPrompt'
  | 'notebookViewerInPromptEmpty'
  | 'notebookViewerCodeCell'
  | 'notebookViewerMarkdownCell'
  | 'notebookViewerRawCell'
  | 'notebookViewerErrorOutput'
  | 'notebookViewerShowAllOutput'
  | 'notebookViewerCollapseOutput'
  | 'notebookViewerUnrenderedOutput'
  | 'xmlViewerLabel'
  | 'xmlViewerParseError'
  | 'xmlViewerTooManyNodes'
  | 'xmlViewerChildCount'
  | 'xmlViewerChildCountPlural'
  | 'xmlViewerCopyDocument'
  | 'xmlViewerCopyNode'
  | 'xmlViewerExpandNode'
  | 'xmlViewerCollapseNode'
  | 'artifactPanelLabel'
  | 'artifactPanelPreview'
  | 'artifactPanelCode'
  | 'artifactPanelPreviousVersion'
  | 'artifactPanelNextVersion'
  | 'artifactPanelVersionPosition'
  | 'artifactPanelRestore'
  | 'artifactPanelGenerating'
  | 'geojsonViewLabel'
  | 'geojsonViewInvalid'
  | 'geojsonViewFeatureCount'
  | 'geojsonViewFeatureCountPlural'
  | 'geojsonViewMissingMapLibrary'
  | 'mindMapLabel'
  | 'mindMapTopicStatus'
  | 'mindMapLeafStatus'
  | 'mindMapExpanded'
  | 'mindMapCollapsed'
  | 'entityDegree'
  | 'entityCommunity'
  | 'focusInGraph'
  | 'untitledEntity'
  | 'untitledCommunity'
  | 'communityMemberCount'
  | 'communityDrillIn'
  | 'selectAllSources'
  | 'sourcePickerSelection'
  | 'provenancePanelLabel'
  | 'provenanceEntities'
  | 'provenanceRelationships'
  | 'provenanceCommunities'
  | 'provenanceChunks'
  | 'provenanceEmpty'
  | 'chunkInspectorLabel'
  | 'chunkScore'
  | 'scoreTierHigh'
  | 'scoreTierMedium'
  | 'scoreTierLow'
  | 'chunkInspectorEmpty'
  | 'flowCanvasLabel'
  | 'flowCanvasSummary'
  | 'flowNode'
  | 'flowEdge'
  | 'flowEdgeWithLabel'
  | 'flowItemAnnouncement'
  | 'flowEdgeList'
  | 'flowNodeSelected'
  | 'flowNodeDeselected'
  | 'flowSelectionCleared'
  | 'flowNodeMoved'
  | 'flowConnectStarted'
  | 'flowConnectCommitted'
  | 'flowConnectCancelled'
  | 'zoomToFit'
  | 'flowLockCanvas'
  | 'flowControlsLabel'
  | 'flowMinimapLabel'
  | 'flowMinimapViewport'
  | 'nodePaletteLabel'
  | 'nodePalettePlaceholder'
  | 'nodePaletteEmpty'
  | 'nodePaletteDragHint'
  | 'pathStripLabel'
  | 'pathNodeStatus'
  | 'pathRelationStatus'
  | 'flowInputHandle'
  | 'flowOutputHandle'
  | 'flowStatusWithDuration'
  | 'neighborListLabel'
  | 'neighborRowLabel'
  | 'neighborDirectionIn'
  | 'neighborDirectionOut'
  | 'neighborDirectionBoth'
  | 'neighborExpand'
  | 'neighborListEmpty'
  | 'neighborGroupHeader'
  | 'flowRunOverlayLabel'
  | 'flowRunSummary'
  | 'flowRunStepStatus';

export type LyraLocaleStrings = Partial<Record<LyraMessageKey, string>> & Record<string, string | undefined>;

const DEFAULT_STRINGS: Record<LyraMessageKey, string> = {
  noData: 'No data',
  graphLegendLabel: 'Graph legend',
  legendTypeShown: '{label} shown',
  legendTypeHidden: '{label} hidden',
  entityChipWithType: '{label}, {type}',
  jumpToLatest: 'Jump to latest',
  terminalLabel: 'Terminal output',
  terminalDownload: 'Download log',
  sequenceStripEmpty: 'No items',
  sequenceStripCategoryCount: '{label}: {count}',
  noColumns: 'No columns configured',
  loadMore: 'Load more',
  viewerSearchMatchCount: '{count} match',
  viewerSearchMatchCountPlural: '{count} matches',
  viewerSearchNoMatches: 'No matches',
  viewerSearchActiveMatch: 'Match {current} of {total}',
  viewerHighlightLabel: 'Highlight',
  tableFilterLabel: 'Filter rows',
  tableFilterPlaceholder: 'Filter rows',
  tableLoading: 'Loading rows',
  tableEditCell: 'Edit {column}',
  carousel: 'carousel',
  carouselLabel: 'Carousel',
  carouselSlide: 'slide',
  carouselSlidePosition: 'Slide {index} of {total}',
  carouselIndicators: 'Carousel slides',
  carouselGoTo: 'Go to slide {index}',
  imageComparerLabel: 'Image comparison',
  zoomableFrameLabel: 'Zoomable content',
  zoomControls: 'Zoom controls',
  zoomOut: 'Zoom out',
  zoomIn: 'Zoom in',
  lightboxLabel: 'Image viewer',
  lightboxImagePosition: 'Image {index} of {total}',
  scrollerLabel: 'Scrollable content',
  chatViewportLabel: 'Conversation',
  newMessageCount: '{count} new message',
  newMessagesCount: '{count} new messages',
  newMessages: 'New messages',
  scrollPrevious: 'Scroll backward',
  scrollNext: 'Scroll forward',
  showAllColumns: 'Show all columns',
  showFewerColumns: 'Show fewer columns',
  clear: 'Clear',
  openCalendar: 'Open calendar',
  open: 'Open',
  close: 'Close',
  closeNavigation: 'Close navigation',
  openNavigation: 'Open navigation',
  resizeNavigation: 'Resize navigation',
  copy: 'Copy',
  copyJson: 'Copy JSON to clipboard',
  copied: 'Copied!',
  expand: 'Expand',
  collapse: 'Collapse',
  expandMessage: 'Expand message',
  collapseMessage: 'Collapse message',
  messageActionsLabel: 'Message actions',
  regenerateResponse: 'Regenerate response',
  editMessage: 'Edit message',
  showMore: 'Show more',
  showMoreCount: 'Show {count} more',
  showLess: 'Show less',
  retry: 'Retry',
  remove: 'Remove',
  removeWithContext: 'Remove {label}',
  playWithContext: 'Play {name}',
  pauseWithContext: 'Pause {name}',
  loading: 'Loading…',
  loadingDocument: 'Loading document…',
  noMatches: 'No matches',
  previous: 'Previous',
  next: 'Next',
  paginationLabel: 'Pagination',
  paginationPage: 'Page',
  branchPickerLabel: 'Response versions',
  branchPrevious: 'Previous version',
  branchNext: 'Next version',
  branchPosition: 'Version {index} of {total}',
  paginationSummary: '{start}–{end} of {total} {itemLabel}',
  paginationEmptySummary: '{total} {itemLabel}',
  paginationApplied: 'Page {page} of {totalPages}',
  cancel: 'Cancel',
  confirm: 'Confirm',
  search: 'Search',
  circularReference: 'Circular reference',
  items: 'items',
  item: 'item',
  trendOf: 'Trend of {count} values, last {value}',
  wordCloud: 'Word cloud of {count} {word}',
  notInCatalog: 'not in catalog',
  sendMessage: 'Send message',
  stopGenerating: 'Stop generating',
  dropzoneReleaseToAdd: 'Release to add the file.',
  dropzoneRejectedType: 'This file type is not accepted.',
  fileSizeUnitB: 'B',
  fileSizeUnitKb: 'KB',
  fileSizeUnitMb: 'MB',
  fileSizeUnitGb: 'GB',
  fileSizeUnitTb: 'TB',
  chartCategory: 'Category',
  chartPointLabel: 'Point {n}',
  resetZoom: 'Reset zoom',
  chatSending: 'Sending…',
  chatResponding: 'Responding…',
  chatFailedToSend: 'Failed to send',
  chatFailedAnnounce: 'Message failed to send.',
  chatCompleteAnnounce: 'Message complete.',
  showMoreCollapsed: '+{count}',
  expandCode: 'Expand code',
  collapseCode: 'Collapse code',
  copyCode: 'Copy code',
  copiedToClipboard: 'Copied to clipboard',
  codeRegion: 'Code',
  codeRegionWithLanguage: '{language} code',
  codeBlockLineLabel: 'Line {line}',
  copyDiff: 'Copy diff',
  diffViewOldLabel: 'Original',
  diffViewNewLabel: 'Modified',
  jsonArray: 'array',
  jsonObject: 'object',
  jsonValue: 'value',
  jsonCopyLabel: 'Copy {label}',
  jsonExpandLabel: 'Expand {label}',
  jsonCollapseLabel: 'Collapse {label}',
  jsonItemCount: '{count} item',
  jsonItemCountPlural: '{count} items',
  jsonKeyCount: '{count} key',
  jsonKeyCountPlural: '{count} keys',
  untitledSource: 'Untitled source',
  sourcePageSuffix: '{base} — p. {page}',
  toolCall: 'Tool call',
  statusPending: 'Pending',
  statusRunning: 'Running',
  statusSuccess: 'Success',
  statusError: 'Error',
  statusDenied: 'Denied',
  maximize: 'Maximize',
  restore: 'Restore',
  wordCloudWord: 'word',
  wordCloudWords: 'words',
  pollPause: 'Pause',
  pollResume: 'Resume',
  pollRefreshing: 'Refreshing…',
  pollPaused: 'Paused',
  pollPausedAnnounce: 'Paused.',
  pollResumedAnnounce: 'Resumed.',
  pollRefreshingAnnounce: 'Refreshing now.',
  attachmentAdd: 'Add attachment',
  attachmentTriggerFiles: 'Attach files',
  attachmentTriggerImage: 'Attach an image',
  attachmentTriggerCamera: 'Use camera',
  attachmentMenuFiles: 'Upload files',
  attachmentMenuImage: 'Upload a photo',
  attachmentMenuCamera: 'Take a photo',
  checkboxRequired: 'Please check this box if you want to continue.',
  checkboxGroupRequired: 'Select at least one option.',
  tokenInputRequired: 'Enter at least one value.',
  commandPaletteLabel: 'Command palette',
  commandPalettePlaceholder: 'Search commands…',
  commandPaletteEmpty: 'No matching commands.',
  commandPaletteResults: 'Commands',
  iconButtonLabel: 'Button',
  codeEditorLabel: 'Code editor',
  dataGridLabel: 'Data grid',
  calendarLabel: 'Calendar',
  calendarEmpty: 'No events this month.',
  switchRequired: 'Please turn this on.',
  citationHighConfidence: 'High confidence',
  citationMediumConfidence: 'Medium confidence',
  citationLowConfidence: 'Low confidence',
  citationVerified: 'Verified',
  citationUnverified: 'Unverified',
  contextMeterUsed: '{used} used',
  contextMeterUsedOfTotal: '{used} of {total} used',
  contextMeterSegmentLabel: '{label}: {count}',
  untitledConversation: 'Untitled conversation',
  dockPanelCollapse: 'Collapse panel',
  dockPanelExpand: 'Expand panel',
  dockPanelResize: 'Resize panel',
  documentPreviewAlt: 'Document preview',
  documentPreviewUrlNotAllowed: 'Document URL is not allowed.',
  documentPreviewFailedToLoad: 'Failed to load document.',
  documentPreviewResourceTooLarge: 'This document is too large to preview.',
  documentPreviewGenericError: 'Something went wrong.',
  ebookViewerLoadError: 'Failed to load the ebook.',
  ebookViewerRegionLabel: 'Ebook content',
  fileTypeFile: 'File',
  fileTypePdf: 'PDF',
  fileTypeWord: 'Word document',
  fileTypeSpreadsheet: 'Spreadsheet',
  fileTypePresentation: 'Presentation',
  fileTypeText: 'Text file',
  fileTypeCode: 'Code file',
  fileTypeArchive: 'Archive',
  fileTypeImage: 'Image',
  fileTypeAudio: 'Audio',
  fileTypeVideo: 'Video',
  fileTypeWithSize: '{label} ({size})',
  pptxViewerLabel: 'Presentation viewer',
  pptxViewerFidelityNotice: 'Some slide content may not display.',
  pptxViewerRenderError: 'Failed to render this presentation.',
  pptxViewerPreviousSlide: 'Previous slide',
  pptxViewerNextSlide: 'Next slide',
  pptxViewerSlideOf: 'Slide {current} of {total}',
  documentViewerLabel: 'Document viewer',
  attachmentPreviewName: 'Preview {name}',
  attachmentPreviewFile: 'Preview file',
  documentViewerMissingSanitizer: 'This viewer needs the optional "dompurify" package installed to render safely.',
  docxViewerLabel: 'Word document',
  docxViewerMissingConverter: 'This viewer needs the optional "mammoth" package installed to convert this document.',
  svgViewerLabel: 'SVG image',
  htmlViewerLabel: 'HTML document',
  datasetViewerMissingParser: 'This viewer needs the optional "papaparse" package installed to parse this file.',
  datasetViewerEmpty: 'This dataset has no rows.',
  datasetViewerCaption: '{count} rows',
  datasetViewerCaptionNamed: '{name}: {count} rows',
  contactViewerLabel: 'Contact viewer',
  contactViewerNoContacts: 'No contacts found in this file.',
  contactViewerUnnamedContact: 'Unnamed contact',
  contactViewerPhoneLabel: 'Phone',
  contactViewerEmailLabel: 'Email',
  contactViewerAddressLabel: 'Address',
  contactViewerOrganizationLabel: 'Organization:',
  exportButtonLabel: 'Export',
  generationStatusElapsedSeconds: '{seconds}s',
  generationStatusTokenCount: '{count} token',
  generationStatusTokensCount: '{count} tokens',
  generationStatusThroughput: '{rate} tok/s',
  graphDataList: 'Graph data',
  graphItemAnnouncement: '{item} ({index} of {total})',
  navigation: 'Navigation',
  attachmentRetryWithContext: 'Retry {label}',
  attachmentUploadingWithContext: 'Uploading {label}',
  attachmentUploadingProgress: 'Uploading {percent}%',
  attachmentUploadingIndeterminate: 'Uploading…',
  attachmentUploadFailed: 'Upload failed',
  attachmentUntitledFile: 'Untitled file',
  chartTrendIncreasing: 'increasing',
  chartTrendDecreasing: 'decreasing',
  chartTrendFlat: 'flat',
  chartSummary: '{label}: {count} values, range {min} to {max}, {trend} trend',
  chartSeriesNoData: '{label}: no data',
  chartSummaryWithData: '{type} chart. {summaries}.',
  chartSummaryEmpty: '{type} chart with no data.',
  chartSummarySeparator: '. ',
  chartData: 'Chart data',
  chart: 'Chart',
  chartTypeLine: 'Line',
  chartTypeBar: 'Bar',
  chartTypeScatter: 'Scatter',
  chartTypePie: 'Pie',
  chartTypeDoughnut: 'Doughnut',
  chartTypeRadar: 'Radar',
  chartTypePolarArea: 'Polar area',
  chartTypeBubble: 'Bubble',
  boxPlotSeriesSummary: '{label}: {count} distributions, median range {min} to {max}, {trend} median trend',
  boxPlotSummaryWithData: 'Box plot. {summaries}.',
  boxPlotSummaryEmpty: 'Box plot with no data.',
  boxPlotData: 'Box plot data',
  chartSeriesLabel: 'Series',
  boxPlotMin: 'Min',
  boxPlotQ1: 'Q1',
  boxPlotMedian: 'Median',
  boxPlotQ3: 'Q3',
  boxPlotMax: 'Max',
  boxPlot: 'Box plot',
  histogramFrequency: 'Frequency',
  liteChartMarkPosition: '({index} of {total})',
  liteChartMarkSummary: '{series}, {label}: {value} ({index} of {total})',
  liteChartBarLabel: '{series}, {label}: {value}',
  composerLabel: 'Message',
  textareaLabel: 'Text',
  citation: 'Citation {index}',
  citationWithStatus: 'Citation {index}, {status}',
  comboboxOverflow: '+{n} more — refine your search',
  comboboxRequired: 'Please select an option.',
  comboboxLabel: 'Combobox',
  rename: 'Rename {title}',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  chooseDate: 'Choose date',
  date: 'Date',
  dateInputMinMessage: 'Date must be on or after {min}.',
  dateInputMaxMessage: 'Date must be on or before {max}.',
  dateInputPastDisabled: 'Date cannot be in the past.',
  dateInputFutureDisabled: 'Date cannot be in the future.',
  dateInputInvalid: 'Enter a valid date.',
  documentPreviewEmpty: 'No {type} to display.',
  convertingDocument: 'Converting document…',
  documentPreviewNotAvailable: 'Preview not available for {label}.',
  documentPreviewGenericFile: 'this file',
  documentPreviewTypeDocument: 'document',
  documentPreviewTypeImage: 'image',
  documentPreviewTypeEmail: 'email',
  documentPreviewTypeCalendar: 'calendar',
  archiveViewerUnavailable: 'Archive preview is unavailable.',
  archiveViewerEmpty: 'This archive is empty.',
  archiveViewerFolder: 'Folder',
  archiveViewerFile: 'File',
  spreadsheetViewerUnavailable: 'Spreadsheet preview is unavailable.',
  csvViewerUnavailable: 'CSV preview is unavailable.',
  csvViewerLabel: 'CSV document',
  spreadsheetViewerLabel: 'Spreadsheet',
  knownDateDay: 'Day',
  knownDateMonth: 'Month',
  knownDateYear: 'Year',
  documentPreviewTypeDataset: 'dataset',
  documentPreviewTypeContact: 'contact',
  download: 'Download',
  exportFormatMenuLabel: '{label} format',
  fileInputDefaultLabel: 'Drop files here or click to browse',
  fileInputAcceptedOne: '{count} file added.',
  fileInputAcceptedMany: '{count} files added.',
  fileInputRejectedOne: '{count} file rejected.',
  fileInputRejectedMany: '{count} files rejected.',
  fileInputFolderRejected: 'Folders are not accepted here.',
  elapsedMinutesSecondsTemplate: '{minutes}m {seconds}s',
  graphNode: 'Node {label}',
  graphLink: 'Link from {source} to {target}',
  graphDiagram: 'Node-link diagram with {nodeCount} nodes and {linkCount} links',
  graphTypedNode: '{label} ({type})',
  graphExpandableItem: '{item}, expandable',
  graphNodeFocused: 'Centered on {label}',
  graphSelectionCount: '{count} selected',
  graphNodesHidden: '{hidden} of {total} nodes hidden',
  graphCommunity: 'Community {label}, {count} nodes',
  heatmapValueLabel: 'value',
  heatmapMatrixCellLabel: 'Row {row}, Col {col}: {value}',
  heatmapCalendarLabel: 'Calendar heatmap of {days} days, {label} range {range}',
  heatmapMatrixLabel: 'Heatmap of {rows} × {cols} cells, {label} range {range}',
  heatmapCalendarCellLabel: '{date}: {value}',
  heatmapNoDataValue: 'no data',
  heatmapDefaultRowLabel: 'row {n}',
  heatmapDefaultColLabel: 'col {n}',
  heatmapSelectedCellLabel: 'Selected: {cell}.',
  heatmapCellSelectedSuffix: ' (selected)',
  inputLabel: 'Text',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  radioRequired: 'Please select an option.',
  progress: 'Progress',
  popover: 'Popover',
  details: 'Details',
  breadcrumb: 'Breadcrumb',
  timeline: 'Timeline',
  rating: 'Rating',
  sliderLabel: 'Slider',
  feedbackPositive: 'Good response',
  feedbackNegative: 'Bad response',
  feedbackReasonsLabel: 'Choose a reason',
  feedbackCommentLabel: 'Add a comment',
  feedbackCommentPlaceholder: 'Add more detail (optional)',
  feedbackSubmit: 'Submit feedback',
  feedbackSubmitted: 'Feedback submitted',
  colorPicker: 'Color picker',
  mediaCardUntitledFile: 'Untitled file',
  mediaCardOpenName: 'Open {name}',
  mediaCardOpenImageAttachment: 'Open image attachment',
  mediaCardOpenVideoAttachment: 'Open video attachment',
  mediaCardOpenFileAttachment: 'Open file attachment',
  mediaCardImageAttachment: 'Image attachment',
  mediaCardVideoAttachment: 'Video attachment',
  animatedImageDefaultAlt: 'Animated image',
  mentionSuggestions: 'Suggestions',
  suggestionsLabel: 'Suggested prompts',
  map: 'Map',
  model: 'Model',
  selectModel: 'Select a model…',
  modelSelectNoModels: 'No models',
  modelSelectRequired: 'Please choose a model.',
  temperature: 'Temperature',
  play: 'Play',
  playbackPosition: 'Playback position',
  selectValueMissing: 'Please select an option.',
  select: 'Select',
  sourceListDefaultLabel: 'Sources',
  threadListLabel: 'Conversations',
  threadGroupPinned: 'Pinned',
  threadGroupToday: 'Today',
  threadGroupYesterday: 'Yesterday',
  threadGroupPrevious7Days: 'Previous 7 days',
  threadGroupPrevious30Days: 'Previous 30 days',
  threadGroupArchived: 'Archived',
  pinConversation: 'Pin conversation',
  unpinConversation: 'Unpin conversation',
  archiveConversation: 'Archive conversation',
  unarchiveConversation: 'Unarchive conversation',
  deleteConversation: 'Delete conversation',
  searchThreads: 'Search conversations',
  threadListMatchAnnounce: '{count} conversation found',
  threadListMatchAnnouncePlural: '{count} conversations found',
  threadListEmpty: 'No conversations yet',
  resizeDivider: 'Resize divider between panel {a} and panel {b}',
  trendUnchanged: 'unchanged',
  trendIncreased: 'increased {value}%',
  trendDecreased: 'decreased {value}%',
  trendGoodSuffix: ', good',
  trendBadSuffix: ', bad',
  streamStalled: 'Taking longer than usual…',
  streamStallAnnounce: 'Connection stalled.',
  streamRecoverAnnounce: 'Connection restored.',
  streamStallClearedAnnounce: 'No longer stalled.',
  thinkingPanelLabel: 'Thinking',
  taskListLabel: 'Tasks',
  taskListCompletedOfTotal: '{completed} of {total} completed',
  taskListStepStartedAnnounce: 'Step started: {label}',
  taskListStepCompletedAnnounce: 'Step completed: {label}',
  taskListStepFailedAnnounce: 'Step failed: {label}',
  activityFeedLabel: 'Activity',
  activityFeedCompletedSteps: 'Completed {count} steps',
  activityFeedCompletedStep: 'Completed {count} step',
  handoffLabel: 'Agent handoff',
  handoffToAgent: 'Transferred to {agent}',
  handoffFromToAgent: 'Transferred from {from} to {to}',
  usageBadgeLabel: 'Usage',
  usageBadgeTokensIn: '{count} in',
  usageBadgeTokensOut: '{count} out',
  usageBadgeTokensInLabel: 'Input tokens',
  usageBadgeTokensOutLabel: 'Output tokens',
  usageBadgeTotalTokensLabel: 'Total tokens',
  usageBadgeCostLabel: 'Cost',
  usageBadgeLatencyLabel: 'Latency',
  checkpointLabel: 'Checkpoint',
  checkpointRestore: 'Restore',
  checkpointRestoreWithContext: 'Restore conversation to {label}',
  checkpointRestoring: 'Restoring…',
  checkpointConfirmPrompt: 'Restore the conversation to this point?',
  thoughtFor: 'Thought for {duration}',
  thinking: 'Thinking…',
  rangeStart: 'Range start',
  rangeEnd: 'Range end',
  closeWithContext: 'Close: {snippet}',
  toolApprovalHeading: 'Approve {tool} call?',
  toolApprovalGenericTool: 'tool',
  toolApprovalArgsLabel: 'Tool call arguments (JSON)',
  confirmApproved: 'Approved',
  confirmDenied: 'Denied',
  confirmApprovedAnnounce: 'Action approved.',
  confirmDeniedAnnounce: 'Action denied.',
  deny: 'Deny',
  edit: 'Edit',
  approve: 'Approve',
  invalidJson: 'Invalid JSON.',
  fieldRequired: 'This field is required.',
  fieldMustBeString: 'Must be a string.',
  fieldMustBeNumber: 'Must be a finite number.',
  fieldMustBeInteger: 'Must be a whole number.',
  fieldMustBeBoolean: 'Must be a boolean.',
  unsupportedFieldType: 'Unsupported field type "{type}".',
  fieldMustBeOneOf: 'Must be one of: {values}.',
  fieldMustEqual: 'Must equal {value}.',
  schemaMustBeObject: 'Schema must describe an object.',
  schemaPropertiesMustBeFlat: 'Schema properties must be a flat object.',
  valueMustBeSerializable: 'Value must be JSON-serializable.',
  valueInvalid: 'The value is invalid.',
  phoneInputIncomplete: 'This phone number is incomplete.',
  durationMilliseconds: '{value}ms',
  durationSeconds: '{value}s',
  selectTools: 'Select tools',
  searchToolsPlaceholder: 'Search tools…',
  useDefaultTools: 'Use default tools',
  toolSelectCustomizeHint: 'Turn off to choose individual tools.',
  noMatchesQuery: 'No tools match "{query}".',
  toolSelectNoneAvailable: 'No tools available.',
  toolSelectSummary: '{selected} of {total} tools enabled',
  toolCount: '{count} tool',
  toolCountPlural: '{count} tools',
  otherCategory: 'Other',
  widgetFullscreenPanel: 'Fullscreen panel',
  widgetViewGroup: 'Panel view',
  widgetExitFullscreen: 'Exit fullscreen',
  widgetExpandToFullscreen: 'Expand to fullscreen',
  menuLabel: 'Menu',
  pause: 'Pause',
  kbdEscapeVisual: 'Esc',
  kbdEscapeWord: 'Escape',
  kbdTabWord: 'Tab',
  kbdSpaceWord: 'Space',
  kbdDeleteVisual: 'Del',
  kbdDeleteWord: 'Delete',
  kbdHomeWord: 'Home',
  kbdEndWord: 'End',
  kbdPageUpVisual: 'PgUp',
  kbdPageUpWord: 'Page Up',
  kbdPageDownVisual: 'PgDn',
  kbdPageDownWord: 'Page Down',
  kbdEnterWord: 'Enter',
  kbdBackspaceWord: 'Backspace',
  kbdArrowUpWord: 'Arrow Up',
  kbdArrowDownWord: 'Arrow Down',
  kbdArrowLeftWord: 'Arrow Left',
  kbdArrowRightWord: 'Arrow Right',
  kbdPlusWord: 'Plus',
  kbdMinusWord: 'Minus',
  kbdCommandWord: 'Command',
  kbdControlVisual: 'Ctrl',
  kbdControlWord: 'Control',
  kbdOptionWord: 'Option',
  kbdAltWord: 'Alt',
  kbdShiftWord: 'Shift',
  emailViewerLabel: 'Email viewer',
  emailViewerMissingParser: 'This viewer needs the optional "postal-mime" package installed to parse this message.',
  emailViewerFrom: 'From',
  emailViewerTo: 'To',
  emailViewerSubject: 'Subject',
  emailViewerDate: 'Date',
  emailViewerAttachments: 'Attachments',
  emailViewerNoSubject: '(no subject)',
  emailViewerOpenAttachment: 'Open {filename}',
  emailViewerShowQuoted: 'Show quoted text',
  emailViewerHideQuoted: 'Hide quoted text',
  calendarViewerLabel: 'Calendar viewer',
  calendarViewerMissingParser: 'This viewer needs the optional "ical.js" package installed to parse this calendar.',
  calendarViewerEmpty: 'This calendar has no events.',
  calendarViewerNoSummary: '(no title)',
  pdfViewerLabel: 'PDF document',
  pdfViewerMissingLibrary: 'This viewer needs the optional "pdfjs-dist" package installed to render PDF files.',
  qrCodeMissingLibrary: 'This component needs the optional "qrcode" package installed to render QR codes.',
  qrCodeGenerationFailed: 'This value could not be encoded as a QR code.',
  pdfViewerPageOf: 'Page {page} of {total}',
  pdfViewerZoomIn: 'Zoom in',
  pdfViewerZoomOut: 'Zoom out',
  pdfViewerCurrentZoom: '{percent}%',
  pdfViewerPreviousPage: 'Previous page',
  pdfViewerNextPage: 'Next page',
  anchorJumped: 'Jumped to highlighted passage.',
  anchorJumpedToPage: 'Jumped to page {page}.',
  anchorNotFound: 'Passage not found in this document.',
  highlightLayerLabel: 'Highlights',
  highlightWithLabel: 'Highlight: {label}',
  highlightOfTotal: 'Highlight {index} of {total}',
  pageRailLabel: 'Page thumbnails',
  pageRailPage: 'Page {page}',
  pageRailPageHighlighted: 'Page {page}, {count} highlighted passage',
  pageRailPageHighlightedPlural: 'Page {page}, {count} highlighted passages',
  skipToContent: 'Skip to content',
  tourSkip: 'Skip',
  tourDone: 'Done',
  tourStepOf: 'Step {current} of {total}',
  emojiPickerSearchLabel: 'Search emoji',
  emojiPickerGridLabel: 'Emoji',
  emojiPickerEmpty: 'No emoji found',
  pushToTalkRequesting: 'Requesting microphone…',
  pushToTalkDenied: 'Microphone access denied',
  pushToTalkError: 'Recording failed',
  pushToTalkUnsupported: 'Recording is not supported in this browser',
  pushToTalkStarted: 'Recording started',
  pushToTalkStopped: 'Recording stopped',
  pushToTalkCancelled: 'Recording cancelled',
  pushToTalkHold: 'Hold to talk',
  pushToTalkStart: 'Start recording',
  pushToTalkStop: 'Stop recording',
  traceTree: 'Trace tree',
  traceTreeSpanStatus: '{name} — {status}',
  spanKindAgent: 'Agent',
  spanKindLlm: 'LLM',
  spanKindTool: 'Tool',
  spanKindRetriever: 'Retriever',
  spanKindEmbedding: 'Embedding',
  spanKindOther: 'Other',
  tokensIn: 'Tokens in',
  tokensOut: 'Tokens out',
  cost: 'Cost',
  duration: 'Duration',
  spanWaterfall: 'Span timeline',
  spanStartedAtOffset: 'started at +{value}',
  spanTokens: '{in} tokens in, {out} tokens out',
  rubricSubmit: 'Submit',
  rubricSubmitAndNext: 'Submit and next',
  rubricSkip: 'Skip',
  compareResponseA: 'Response A',
  compareResponseB: 'Response B',
  compareVoteLabel: 'Vote',
  compareVoteBetter: '{label} is better',
  compareVoteTie: 'Tie',
  compareVoteBothBad: 'Both are bad',
  compareVoteRecorded: 'Vote recorded: {label}',
  comparePanel: 'Comparison',
  audioVisualizerLabel: 'Voice activity: {state}',
  audioVisualizerIdle: 'Idle',
  audioVisualizerListening: 'Listening',
  audioVisualizerThinking: 'Thinking',
  audioVisualizerSpeaking: 'Speaking',
  fileTreeLabel: 'Files',
  fileTreeDiffSummary: '+{additions} -{deletions}',
  gitStatusAdded: 'Added',
  gitStatusModified: 'Modified',
  gitStatusDeleted: 'Deleted',
  gitStatusRenamed: 'Renamed',
  gitStatusUntracked: 'Untracked',
  gitStatusConflicted: 'Conflicted',
  gitStatusIgnored: 'Ignored',
  imageViewerLabel: 'Image viewer',
  imageViewerFailedToLoad: 'The image failed to load.',
  imageViewerRotate: 'Rotate',
  imageViewerFitLabel: 'Fit',
  imageViewerFitContain: 'Fit image',
  imageViewerFitWidth: 'Fit width',
  imageViewerFitActual: 'Actual size',
  imageViewerAnnotate: 'Annotate',
  imageViewerHighlightsLabel: 'Highlighted regions',
  imageViewerUnlabeledHighlight: 'Highlight {index}',
  imageViewerAnnotationHint: 'Annotation mode on. Press Enter to place a region, then use arrow keys to move it, Shift plus arrow keys to resize it, Enter to save, or Escape to cancel.',
  imageViewerAnnotationBoxPosition: 'Region at {x} percent, {y} percent, {width} by {height} percent.',
  imageViewerAnnotationAdded: 'Region added.',
  imageViewerAnnotationCancelled: 'Region cancelled.',
  transcriptFeedLabel: 'Transcript',
  transcriptFeedEmpty: 'No transcript yet',
  transcriptFeedInterim: 'Transcribing…',
  commitCardLabel: 'Commit',
  commitCardCopyHash: 'Copy commit hash',
  commitCardDiffSummary: '+{additions} -{deletions} in {files} files',
  commitCardShowFiles: 'Show {count} changed files',
  commitCardHideFiles: 'Hide {count} changed files',
  stackTraceLabel: 'Stack trace',
  stackTraceShowFrames: 'Show {count} internal frames',
  stackTraceHideFrames: 'Hide {count} internal frames',
  statusSkipped: 'Skipped',
  testResultsLabel: 'Test results',
  testResultsPassed: '{count} passed',
  testResultsFailed: '{count} failed',
  testResultsSkipped: '{count} skipped',
  testResultsRunning: '{count} running',
  testResultsFilterLabel: 'Filter by status',
  testResultsCompleteAnnounce: '{passed} passed, {failed} failed, {skipped} skipped',
  envListLabel: 'Environment variables',
  envListReveal: 'Reveal {name}',
  envListHide: 'Hide {name}',
  envListValueHidden: 'Value hidden',
  envListCopy: 'Copy {name}',
  voice: 'Voice',
  voicePickerNoVoices: 'No voices available',
  voicePickerRequired: 'Please choose a voice.',
  voicePickerPreview: 'Preview {name}',
  voicePickerStopPreview: 'Stop preview',
  avPlayerLabel: 'Audio/video player',
  avPlayerFailedToLoad: 'The media failed to load.',
  avPlayerTranscript: 'Transcript',
  avPlayerTimeline: 'Seek',
  avPlayerPlaybackRate: 'Playback speed',
  avPlayerPosition: '{current} of {duration}',
  attachmentTriggerAudio: 'Record audio',
  attachmentMenuAudio: 'Record audio',
  browserFrameLabel: 'Browser view',
  browserFrameUrlLabel: 'Address',
  browserFrameViewOf: 'Browser view of {url}',
  browserFrameTakeOver: 'Take over',
  browserFrameHandBack: 'Hand back',
  browserFrameStop: 'Stop',
  browserFrameStatusIdle: 'Idle',
  browserFrameStatusConnecting: 'Connecting…',
  browserFrameStatusLive: 'Live',
  browserFrameStatusStalled: 'Stalled',
  notebookViewerLabel: 'Notebook viewer',
  notebookViewerInvalid: 'This file is not a valid Jupyter notebook.',
  notebookViewerUnsupportedVersion: 'Notebook format {version} is not supported.',
  notebookViewerTooManyCells: 'This notebook has too many cells to display.',
  notebookViewerInPrompt: 'In [{count}]',
  notebookViewerInPromptEmpty: 'In [ ]',
  notebookViewerCodeCell: 'Code cell {index}',
  notebookViewerMarkdownCell: 'Markdown cell {index}',
  notebookViewerRawCell: 'Raw cell {index}',
  notebookViewerErrorOutput: 'Error',
  notebookViewerShowAllOutput: 'Show all output',
  notebookViewerCollapseOutput: 'Collapse output',
  notebookViewerUnrenderedOutput: 'This output type cannot be displayed.',
  xmlViewerLabel: 'XML viewer',
  xmlViewerParseError: 'This document could not be parsed as XML.',
  xmlViewerTooManyNodes: 'This document has too many nodes to display.',
  xmlViewerChildCount: '{count} child',
  xmlViewerChildCountPlural: '{count} children',
  xmlViewerCopyDocument: 'Copy XML to clipboard',
  xmlViewerCopyNode: 'Copy {name}',
  xmlViewerExpandNode: 'Expand {name}',
  xmlViewerCollapseNode: 'Collapse {name}',
  artifactPanelLabel: 'Artifact',
  artifactPanelPreview: 'Preview',
  artifactPanelCode: 'Code',
  artifactPanelPreviousVersion: 'Previous version',
  artifactPanelNextVersion: 'Next version',
  artifactPanelVersionPosition: 'Version {index} of {count}',
  artifactPanelRestore: 'Restore this version',
  artifactPanelGenerating: 'Generating…',
  geojsonViewLabel: 'Map',
  geojsonViewInvalid: 'This file is not valid GeoJSON.',
  geojsonViewFeatureCount: '{count} feature',
  geojsonViewFeatureCountPlural: '{count} features',
  geojsonViewMissingMapLibrary: 'Install the optional maplibre-gl peer to render this file on a map. Showing the raw GeoJSON instead.',
  mindMapLabel: 'Mind map',
  mindMapTopicStatus: '{label}, level {level}, {count} subtopics',
  mindMapLeafStatus: '{label}, level {level}',
  mindMapExpanded: '{label} expanded',
  mindMapCollapsed: '{label} collapsed',
  entityDegree: 'Connections',
  entityCommunity: 'Community',
  focusInGraph: 'Focus in graph',
  untitledEntity: 'Untitled entity',
  untitledCommunity: 'Untitled community',
  communityMemberCount: '{count} members',
  communityDrillIn: 'Explore community',
  selectAllSources: 'Select all sources',
  sourcePickerSelection: '{selected} of {total} selected',
  provenancePanelLabel: 'Grounding',
  provenanceEntities: 'Entities',
  provenanceRelationships: 'Relationships',
  provenanceCommunities: 'Communities',
  provenanceChunks: 'Text chunks',
  provenanceEmpty: 'No grounding data for this answer',
  chunkInspectorLabel: 'Retrieved chunks',
  chunkScore: 'Relevance {percent}%',
  scoreTierHigh: 'High relevance',
  scoreTierMedium: 'Medium relevance',
  scoreTierLow: 'Low relevance',
  chunkInspectorEmpty: 'No chunks retrieved',
  flowCanvasLabel: 'Workflow canvas',
  flowCanvasSummary: 'Workflow with {nodeCount} nodes and {edgeCount} edges',
  flowNode: 'Node {label}',
  flowEdge: 'Edge from {source} to {target}',
  flowEdgeWithLabel: '{label}, edge from {source} to {target}',
  flowItemAnnouncement: '{item} ({index} of {total})',
  flowEdgeList: 'Workflow edges',
  flowNodeSelected: '{label} selected',
  flowNodeDeselected: '{label} deselected',
  flowSelectionCleared: 'Selection cleared',
  flowNodeMoved: 'Moved {label} to {x}, {y}',
  flowConnectStarted:
    'Connecting from {label}. Use arrow keys to choose a target, Enter to connect, Escape to cancel.',
  flowConnectCommitted: 'Connected {source} to {target}',
  flowConnectCancelled: 'Connection cancelled',
  zoomToFit: 'Zoom to fit',
  flowLockCanvas: 'Lock canvas',
  flowControlsLabel: 'Canvas controls',
  flowMinimapLabel: 'Workflow overview',
  flowMinimapViewport: 'Visible area',
  nodePaletteLabel: 'Node palette',
  nodePalettePlaceholder: 'Search nodes…',
  nodePaletteEmpty: 'No matching nodes.',
  nodePaletteDragHint: 'Drag to the canvas, or press Enter to place',
  pathStripLabel: 'Path',
  pathNodeStatus: '{label}, node {position} of {total}',
  pathRelationStatus: '{relation}, relation',
  flowInputHandle: 'Input {id}',
  flowOutputHandle: 'Output {id}',
  flowStatusWithDuration: '{status} ({duration})',
  neighborListLabel: 'Relationships',
  neighborRowLabel: '{label}, {relation}, {direction}',
  neighborDirectionIn: 'Incoming',
  neighborDirectionOut: 'Outgoing',
  neighborDirectionBoth: 'Bidirectional',
  neighborExpand: 'Expand {label} in graph',
  neighborListEmpty: 'No relationships',
  neighborGroupHeader: '{relation} ({count})',
  flowRunOverlayLabel: 'Run status',
  flowRunSummary: '{done} of {total} steps complete',
  flowRunStepStatus: '{label}: {status}',
};

const locales = new Map<string, LyraLocaleStrings>();
const listeners = new Set<() => void>();
let activeLocale = '';

function normalizeLocale(locale: string): string {
  return locale.trim().replace(/_/g, '-').toLowerCase();
}

function localeCandidates(locale: string): string[] {
  const normalized = normalizeLocale(locale);
  const candidates: string[] = [];
  if (normalized) candidates.push(normalized);
  const language = normalized.split('-')[0];
  if (language && language !== normalized) candidates.push(language);
  if (!candidates.includes('en')) candidates.push('en');
  return candidates;
}

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/** Register or extend messages for a locale. */
export function registerLyraLocale(locale: string, strings: LyraLocaleStrings): void {
  const key = normalizeLocale(locale);
  if (!key) throw new TypeError('A locale is required.');
  locales.set(key, { ...(locales.get(key) ?? {}), ...strings });
  if (normalizeLocale(activeLocale) === key || normalizeLocale(activeLocale).startsWith(`${key}-`)) notify();
}

/** Set the page-level locale used by Lyra components without an explicit locale. */
export function setLyraLocale(locale: string): void {
  const next = locale.trim();
  if (activeLocale === next) return;
  activeLocale = next;
  notify();
}

/** Return the current page-level locale. */
export function getLyraLocale(): string {
  return activeLocale;
}

/** Subscribe to locale changes. The returned function is safe to call repeatedly. */
export function subscribeLyraLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function inheritedLocale(host: Element): string {
  const explicit = host.getAttribute('locale') || host.getAttribute('lang');
  if (explicit) return explicit;
  let parent = host.parentElement;
  while (parent) {
    const locale = parent.getAttribute('locale') || parent.getAttribute('lang');
    if (locale) return locale;
    parent = parent.parentElement;
  }
  if (typeof document !== 'undefined') {
    return document.documentElement.getAttribute('lang') || activeLocale || 'en';
  }
  return activeLocale || 'en';
}

/**
 * Per-host memos for `resolveLyraLocale()`/`resolveLyraDirection()`. The
 * ancestor-chain walk (and `getComputedStyle` for direction) is a per-call
 * cost that per-row template loops multiply by hundreds within a single
 * render pass. Caching is strictly opt-in via `enableLyraLocaleCache()`
 * because a host must guarantee invalidation for the memo to stay honest —
 * arbitrary elements passed to the public resolvers get no caching.
 */
const cacheableLocaleHosts = new WeakSet<Element>();
const resolvedLocaleCache = new WeakMap<Element, string>();
const resolvedDirectionCache = new WeakMap<Element, 'ltr' | 'rtl'>();

/**
 * Opts a host into memoized locale/direction resolution. The host must call
 * `invalidateLyraLocaleCache()` whenever a new update cycle is scheduled and
 * on (re)connection, so a memo never outlives the render pass that produced
 * it. An ancestor `lang`/`dir` change mid-cycle is only reflected in rendered
 * output on the next update anyway, so per-cycle reuse changes nothing
 * observable.
 */
export function enableLyraLocaleCache(host: Element): void {
  cacheableLocaleHosts.add(host);
}

/** Drops a host's memoized locale/direction so the next read re-resolves. */
export function invalidateLyraLocaleCache(host: Element): void {
  resolvedLocaleCache.delete(host);
  resolvedDirectionCache.delete(host);
}

/** Resolve the locale inherited by a component host. */
export function resolveLyraLocale(host: Element): string {
  if (!cacheableLocaleHosts.has(host)) return inheritedLocale(host);
  let locale = resolvedLocaleCache.get(host);
  if (locale === undefined) {
    locale = inheritedLocale(host);
    resolvedLocaleCache.set(host, locale);
  }
  return locale;
}

function inheritedDirection(host: Element): 'ltr' | 'rtl' {
  const explicit = host.getAttribute('dir');
  if (explicit === 'rtl' || explicit === 'ltr') return explicit;
  if (typeof getComputedStyle === 'function') return getComputedStyle(host).direction === 'rtl' ? 'rtl' : 'ltr';
  return 'ltr';
}

/** Resolve the direction inherited by a component host. */
export function resolveLyraDirection(host: Element): 'ltr' | 'rtl' {
  if (!cacheableLocaleHosts.has(host)) return inheritedDirection(host);
  let direction = resolvedDirectionCache.get(host);
  if (direction === undefined) {
    direction = inheritedDirection(host);
    resolvedDirectionCache.set(host, direction);
  }
  return direction;
}

/**
 * Resolve a message for a component. An explicit per-component override wins,
 * followed by a non-empty component property fallback, registered locale
 * messages, and finally the built-in English message.
 */
export function resolveLyraString(
  host: Element,
  key: string,
  overrides?: LyraLocaleStrings,
  fallback?: string,
  values?: Record<string, string | number>,
): string {
  const own = overrides?.[key];
  let message = own ?? fallback;
  if (message === undefined) {
    for (const candidate of localeCandidates(resolveLyraLocale(host))) {
      const registered = locales.get(candidate)?.[key];
      if (registered !== undefined) {
        message = registered;
        break;
      }
    }
  }
  message ??= DEFAULT_STRINGS[key as LyraMessageKey] ?? key;
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name] ?? `{${name}}`));
}

export const LYRA_DEFAULT_STRINGS = DEFAULT_STRINGS;
