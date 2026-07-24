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
  | 'resizeColumn'
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
  | 'calendarPreviousMonth'
  | 'calendarNextMonth'
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
  | 'wordCloudLegend'
  | 'wordCloudWordAnnouncement'
  | 'comboboxLoadError'
  | 'comboboxSelectedOverflow'
  | 'promptQueueItemLabel'
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
  | 'diffViewHiddenLines'
  | 'diffViewHiddenLinesPlural'
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
  | 'jsonViewerLimit'
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
  | 'promptStudioVariableName'
  | 'promptStudioVariableValue'
  | 'schemaViewerLimit'
  | 'subagentPanelLimit'
  | 'pollPause'
  | 'pollResume'
  | 'pollInactive'
  | 'pollRefreshing'
  | 'pollPaused'
  | 'pollPausedAnnounce'
  | 'pollResumedAnnounce'
  | 'pollRefreshingAnnounce'
  | 'randomContentPause'
  | 'randomContentResume'
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
  | 'tokenInputEditWithContext'
  | 'commandPaletteLabel'
  | 'commandPalettePlaceholder'
  | 'commandPaletteEmpty'
  | 'commandPaletteResults'
  | 'iconButtonLabel'
  | 'codeEditorLabel'
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
  | 'contextMeterLabeledSummary'
  | 'contextMeterSegmentLabel'
  | 'gaugeLabel'
  | 'gaugeValueLabel'
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
  | 'ebookViewerPreviousChapter'
  | 'ebookViewerNextChapter'
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
  | 'contactViewerOrganization'
  | 'contactViewerTypedValue'
  | 'contactViewerAddressFormat'
  | 'contactViewerTypeHome'
  | 'contactViewerTypeWork'
  | 'contactViewerTypeCell'
  | 'contactViewerTypeVoice'
  | 'contactViewerTypeFax'
  | 'contactViewerTypeInternet'
  | 'contactViewerTypePreferred'
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
  | 'chartValueLabel'
  | 'liteChartCustomMarkSummary'
  | 'composerLabel'
  | 'composerPlaceholder'
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
  | 'fileInputRejectedType'
  | 'fileInputRejectedSize'
  | 'fileInputRejectedCount'
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
  | 'threadGroupExpand'
  | 'threadGroupCollapse'
  | 'pinConversation'
  | 'unpinConversation'
  | 'archiveConversation'
  | 'unarchiveConversation'
  | 'deleteConversation'
  | 'searchThreads'
  | 'threadListMatchAnnounce'
  | 'threadListMatchAnnouncePlural'
  | 'threadListEmpty'
  | 'agentWorkspaceLabel'
  | 'agentWorkspaceConversation'
  | 'agentWorkspaceDetails'
  | 'agentWorkspaceRun'
  | 'agentWorkspaceTools'
  | 'agentWorkspaceRetrieval'
  | 'agentWorkspaceGrounding'
  | 'agentWorkspaceContext'
  | 'agentWorkspaceEmpty'
  | 'ragAnswerLabel'
  | 'ragAnswerCitations'
  | 'ragAnswerSources'
  | 'ragAnswerRetry'
  | 'evaluationDashboardLabel'
  | 'evaluationDashboardMetricLabel'
  | 'evaluationDashboardRunsLabel'
  | 'evaluationDashboardNoRuns'
  | 'approvalQueueLabel'
  | 'approvalQueueEmpty'
  | 'approvalQueueOpen'
  | 'approvalQueuePendingCount'
  | 'approvalQueuePending'
  | 'embeddingExplorerLabel'
  | 'embeddingExplorerEmpty'
  | 'embeddingExplorerPoint'
  | 'knowledgeBaseAdminLabel'
  | 'knowledgeBaseAdminSourcesTab'
  | 'knowledgeBaseAdminIngestionTab'
  | 'resizeDivider'
  | 'trendUnchanged'
  | 'trendIncreased'
  | 'trendDecreased'
  | 'trendGoodSuffix'
  | 'trendBadSuffix'
  | 'statTrendIncreased'
  | 'statTrendDecreased'
  | 'statTrendGood'
  | 'statTrendBad'
  | 'statTrendAnnouncement'
  | 'streamStalled'
  | 'streamStallAnnounce'
  | 'streamRecoverAnnounce'
  | 'streamStallClearedAnnounce'
  | 'thinkingPanelLabel'
  | 'messagePartsLabel'
  | 'messagePartError'
  | 'messagePartRetry'
  | 'promptQueueLabel'
  | 'promptQueueEmpty'
  | 'promptQueueSendNow'
  | 'selectionToolbarLabel'
  | 'selectionAsk'
  | 'selectionQuote'
  | 'selectionCite'
  | 'promptInputLabel'
  | 'promptInputControls'
  | 'promptInputSources'
  | 'promptInputAttachments'
  | 'mcpAppLabel'
  | 'mcpAppUnavailable'
  | 'mcpAppLoading'
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
  | 'accessibleLabelSeparator'
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
  | 'widgetCollapse'
  | 'widgetExpand'
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
  | 'emailViewerGroupAddress'
  | 'calendarViewerLabel'
  | 'calendarViewerMissingParser'
  | 'calendarViewerEmpty'
  | 'calendarViewerNoSummary'
  | 'pdfViewerLabel'
  | 'pdfViewerMissingLibrary'
  | 'qrCodeMissingLibrary'
  | 'qrCodeGenerationFailed'
  | 'mapMissingLibrary'
  | 'chartMissingLibrary'
  | 'boxPlotMissingLibrary'
  | 'graphMissingLibrary'
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
  | 'traceTreeMetricLabel'
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
  | 'treeNodeMoved'
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
  | 'browserFrameControllerAgent'
  | 'browserFrameControllerUser'
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
  | 'resultFieldLabel'
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
  | 'flowConnectTarget'
  | 'flowConnectCommitted'
  | 'flowConnectCancelled'
  | 'zoomToFit'
  | 'flowLockCanvas'
  | 'flowControlsLabel'
  | 'flowMinimapLabel'
  | 'flowMinimapViewport'
  | 'flowMinimapInstructions'
  | 'flowMinimapViewportChanged'
  | 'nodePaletteLabel'
  | 'nodePalettePlaceholder'
  | 'nodePaletteEmpty'
  | 'nodePaletteDragHint'
  | 'nodePaletteResultCount'
  | 'nodePaletteResultCountPlural'
  | 'retrievalResultsSelectRow'
  | 'pathStripLabel'
  | 'pathNodeStatus'
  | 'pathRelationStatus'
  | 'flowInputHandle'
  | 'flowOutputHandle'
  | 'flowStatusWithDuration'
  | 'flowStatusWithDetail'
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
  | 'flowRunStepStatus'
  | 'flowRunStatusCount'
  | 'policySummaryLabel'
  | 'policySummaryAllowCount'
  | 'policySummaryDenyCount'
  | 'policySummaryNeedsReviewCount'
  | 'policySummaryStateAllow'
  | 'policySummaryStateDeny'
  | 'policySummaryStateNeedsReview'
  | 'policySummaryCategoryGuardrail'
  | 'policySummaryCategoryPermission'
  | 'policySummaryCategoryPrivacy'
  | 'policySummaryCategoryTool'
  | 'policySummaryDetailLabel'
  | 'evalDatasetLabel'
  | 'evalDatasetAddExample'
  | 'evalDatasetRemoveExample'
  | 'evalDatasetImportLabel'
  | 'evalDatasetSearchLabel'
  | 'evalDatasetTagFilterLabel'
  | 'evalDatasetEmpty'
  | 'evalDatasetNoMatches'
  | 'evalDatasetColumnInput'
  | 'evalDatasetColumnExpectedOutput'
  | 'evalDatasetColumnTags'
  | 'queryBuilderLabel'
  | 'queryBuilderEmpty'
  | 'queryBuilderNoFields'
  | 'queryBuilderAddCondition'
  | 'queryBuilderRemoveCondition'
  | 'queryBuilderFieldLabel'
  | 'queryBuilderFieldPlaceholder'
  | 'queryBuilderOperatorLabel'
  | 'queryBuilderOperatorPlaceholder'
  | 'queryBuilderValueLabel'
  | 'queryBuilderValuePlaceholder'
  | 'queryBuilderCombinatorLabel'
  | 'queryBuilderCombinatorAnd'
  | 'queryBuilderCombinatorOr'
  | 'queryBuilderBooleanTrue'
  | 'queryBuilderBooleanFalse'
  | 'queryBuilderOperatorEquals'
  | 'queryBuilderOperatorNotEquals'
  | 'queryBuilderOperatorGreaterThan'
  | 'queryBuilderOperatorGreaterThanOrEqual'
  | 'queryBuilderOperatorLessThan'
  | 'queryBuilderOperatorLessThanOrEqual'
  | 'queryBuilderOperatorAfter'
  | 'queryBuilderOperatorOnOrAfter'
  | 'queryBuilderOperatorBefore'
  | 'queryBuilderOperatorOnOrBefore'
  | 'queryBuilderOperatorContains'
  | 'queryBuilderOperatorStartsWith'
  | 'queryBuilderOperatorEndsWith'
  | 'queryBuilderOperatorIn'
  | 'queryBuilderOperatorNotIn'
  | 'queryBuilderOperatorIsEmpty'
  | 'queryBuilderOperatorIsNotEmpty'
  | 'memoryPanelLabel'
  | 'memoryPanelShortTermHeading'
  | 'memoryPanelLongTermHeading'
  | 'memoryPanelAdd'
  | 'memoryPanelAddWithContext'
  | 'memoryPanelForgetAll'
  | 'memoryPanelConfirmAddHeading'
  | 'memoryPanelConfirmRemoveHeading'
  | 'memoryPanelConfirmForgetHeading'
  | 'memoryPanelConfirmForgetBody'
  | 'graphExplorerLabel'
  | 'graphExplorerSearchPlaceholder'
  | 'graphExplorerSearchResultsLabel'
  | 'graphExplorerPin'
  | 'graphExplorerUnpin'
  | 'graphExplorerPinned'
  | 'graphExplorerUnpinned'
  | 'graphExplorerPinnedHeading'
  | 'graphExplorerFindPath'
  | 'retrievalModeVector'
  | 'retrievalModeKeyword'
  | 'retrievalModeHybrid'
  | 'retrievalSearchLabel'
  | 'retrievalModeLabel'
  | 'retrievalFiltersLabel'
  | 'groundingSummaryLabel'
  | 'groundingSummaryEmpty'
  | 'groundingSummarySupportedLabel'
  | 'groundingSummaryUnsupportedLabel'
  | 'groundingSummaryCoverageLabel'
  | 'groundingSummaryConfidenceLabel'
  | 'groundingSummaryWarningsHeading'
  | 'groundingSummaryEvidenceHeading'
  | 'claimEvidenceLabel'
  | 'claimEvidenceEmpty'
  | 'claimEvidenceSupported'
  | 'claimEvidencePartiallySupported'
  | 'claimEvidenceUnsupported'
  | 'claimEvidenceContradicted'
  | 'claimEvidenceConfidence'
  | 'retrievalCompareLabel'
  | 'retrievalCompareEmpty'
  | 'retrievalCompareOverlap'
  | 'retrievalCompareRank'
  | 'retrievalCompareDenseScore'
  | 'retrievalCompareSparseScore'
  | 'retrievalCompareRerankScore'
  | 'retrievalCompareFinalScore'
  | 'ragEvalDashboardLabel'
  | 'ragEvalDashboardEmpty'
  | 'ragEvalDashboardRuns'
  | 'ragEvalDashboardSlices'
  | 'ragEvalDashboardAllSlices'
  | 'promptStudioLabel'
  | 'promptStudioMessages'
  | 'promptStudioVariables'
  | 'promptStudioVersions'
  | 'promptStudioPreview'
  | 'promptStudioRun'
  | 'promptStudioSave'
  | 'promptStudioAddMessage'
  | 'promptStudioRemoveMessage'
  | 'promptStudioRoleSystem'
  | 'promptStudioRoleUser'
  | 'promptStudioRoleAssistant'
  | 'promptStudioRoleTool'
  | 'schemaViewerLabel'
  | 'schemaViewerEmpty'
  | 'schemaViewerRequired'
  | 'schemaViewerCircular'
  | 'schemaViewerType'
  | 'subagentPanelLabel'
  | 'subagentPanelEmpty'
  | 'subagentPanelCancel'
  | 'subagentPanelRetry'
  | 'realtimeSessionLabel'
  | 'realtimeSessionDisconnected'
  | 'realtimeSessionConnecting'
  | 'realtimeSessionConnected'
  | 'realtimeSessionReconnecting'
  | 'realtimeSessionError'
  | 'realtimeSessionConnect'
  | 'realtimeSessionDisconnect'
  | 'realtimeSessionMute'
  | 'realtimeSessionUnmute'
  | 'realtimeSessionInterrupt'
  | 'realtimeSessionConnectionFailed'
  | 'contextInspectorRedacted'
  | 'contextInspectorTruncated'
  | 'contextInspectorLabel'
  | 'contextInspectorEmpty'
  | 'contextInspectorCopyLabel'
  | 'knowledgeBaseSyncIdle'
  | 'knowledgeBaseSyncSyncing'
  | 'knowledgeBaseSyncPaused'
  | 'knowledgeBaseSyncSynced'
  | 'knowledgeBaseSyncError'
  | 'knowledgeBaseHealthHealthy'
  | 'knowledgeBaseHealthDegraded'
  | 'knowledgeBaseHealthFailed'
  | 'knowledgeBaseHealthUnknown'
  | 'knowledgeBasePermissionOwner'
  | 'knowledgeBasePermissionEditor'
  | 'knowledgeBasePermissionViewer'
  | 'knowledgeBasePermissionRestricted'
  | 'knowledgeBaseNeverSynced'
  | 'knowledgeBaseSyncAction'
  | 'knowledgeBasePauseAction'
  | 'knowledgeBaseDeleteAction'
  | 'knowledgeBaseNameColumn'
  | 'knowledgeBaseSyncColumn'
  | 'knowledgeBaseHealthColumn'
  | 'knowledgeBasePermissionColumn'
  | 'knowledgeBaseActionsColumn'
  | 'knowledgeBaseTotalSources'
  | 'knowledgeBaseSyncedSources'
  | 'knowledgeBaseSyncingSources'
  | 'knowledgeBaseNeedsAttention'
  | 'knowledgeBaseHeading'
  | 'knowledgeBaseCreateSource'
  | 'knowledgeBaseEmptyHeading'
  | 'ingestionStageQueued'
  | 'ingestionStageUploading'
  | 'ingestionStageExtracting'
  | 'ingestionStageChunking'
  | 'ingestionStageEmbedding'
  | 'ingestionStageIndexing'
  | 'ingestionStageDone'
  | 'ingestionStageFailed'
  | 'ingestionStageCancelled'
  | 'ingestionQueueLabel'
  | 'ingestionQueueEmpty'
  | 'documentLibraryFreshnessFresh'
  | 'documentLibraryFreshnessAging'
  | 'documentLibraryFreshnessStale'
  | 'documentLibrarySelectAll'
  | 'documentLibrarySelectColumn'
  | 'documentLibraryTypeColumn'
  | 'documentLibraryNameColumn'
  | 'documentLibraryVersionColumn'
  | 'documentLibraryOwnerColumn'
  | 'documentLibraryTagsColumn'
  | 'documentLibraryFreshnessColumn'
  | 'documentLibraryUpdatedColumn'
  | 'documentLibraryLabel'
  | 'documentLibraryEmptyHeading'
  | 'documentLibraryNoMatchesHeading'
  | 'documentLibrarySearchPlaceholder'
  | 'documentLibraryFilterByTag'
  | 'documentLibraryClearSelection'
  | 'documentLibrarySelectedCount'
  | 'documentCompareNoVersion'
  | 'documentCompareLabel'
  | 'agentRunCurrentStepLabel'
  | 'graphQueryHopRangeInvalid'
  | 'graphQueryRelationshipTypeLabel'
  | 'graphQueryNodeTypeLabel'
  | 'graphQueryBuilderLabel'
  | 'graphQueryStartLabel'
  | 'graphQueryEndLabel'
  | 'graphQueryMinHopsLabel'
  | 'graphQueryMaxHopsLabel'
  | 'graphQueryDirectionLabel'
  | 'graphQueryRun'
  | 'graphQuerySavedQueriesLabel'
  | 'graphQuerySaveNameLabel'
  | 'graphQuerySaveButton'
  | 'graphQueryLoadWithContext'
  | 'filterBarReset'
  | 'filterBarActiveFilters'
  | 'drilldownDocuments'
  | 'drilldownRuns'
  | 'drilldownEmpty'
  | 'evaluationRunStatusIdle'
  | 'evaluationRunStatusWaitingInput'
  | 'evaluationRunStatusWaitingApproval'
  | 'evaluationRunStatusCancelled'
  | 'evaluationRunGroundingHeading'
  | 'evaluationRunToolTraceHeading'
  | 'evaluationRunInputHeading'
  | 'evaluationRunOutputHeading'
  | 'evaluationRunLabel'
  | 'evaluationRunProgressLabel'
  | 'retrievalFilterChipLabel'
  | 'retrievalSearchEmptyDescription'
  | 'groundingSummaryEvidenceSpan'
  | 'contextInspectorTruncatedCount'
  | 'contextInspectorSegmentTokens'
  | 'knowledgeBaseDocumentCount'
  | 'knowledgeBaseRowActionsLabel'
  | 'knowledgeBaseEmptyDescription'
  | 'ingestionChunkCountPlural'
  | 'ingestionChunkCount'
  | 'ingestionItemProgressLabel'
  | 'ingestionEmbeddedOfTotal'
  | 'ingestionAttemptCount'
  | 'ingestionRetryWithContext'
  | 'ingestionCancelWithContext'
  | 'documentLibrarySelectDocument'
  | 'agentRunStatusAnnounce'
  | 'graphQueryDeleteWithContext'
  | 'evaluationRunExampleLabel'
  | 'evaluationRunExampleStartedAnnounce'
  | 'evaluationRunExampleCompletedAnnounce'
  | 'evaluationRunExampleFailedAnnounce'
  | 'evaluationRunExampleCancelledAnnounce'
  | 'evaluationRunExampleWaitingInputAnnounce'
  | 'evaluationRunExampleWaitingApprovalAnnounce'
  | 'evaluationRunProgressSummary'
  | 'evaluationRunRunningCount'
  | 'evaluationRunFailedCount'
  | 'retrievalStageQueryRewrite'
  | 'retrievalStageEmbed'
  | 'retrievalStageRetrieve'
  | 'retrievalStageRerank'
  | 'retrievalStageFilter'
  | 'retrievalTraceEvidenceToggle'
  | 'documentCompareOldVersion'
  | 'documentCompareNewVersion'
  | 'agentRunStatusIdle'
  | 'agentRunStatusQueued'
  | 'agentRunStatusCollecting'
  | 'agentRunStatusWaitingInput'
  | 'agentRunStatusWaitingApproval'
  | 'agentRunStatusDone'
  | 'agentRunStatusCancelled'
  | 'localePickerLabel'
  | 'localePickerRequired'
  | 'moveUp'
  | 'moveDown'
  | 'reorderItemMoved';

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
  resizeColumn: 'Resize {label} column',
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
  calendarPreviousMonth: 'Previous month',
  calendarNextMonth: 'Next month',
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
  wordCloudLegend: 'Word cloud color key',
  wordCloudWordAnnouncement: '{text}, {weight}',
  comboboxLoadError: 'Could not load options.',
  comboboxSelectedOverflow: '+{n} more',
  promptQueueItemLabel: 'Queued prompt {index}',
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
  diffViewHiddenLines: '{count} unchanged line',
  diffViewHiddenLinesPlural: '{count} unchanged lines',
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
  jsonViewerLimit: 'Only the first {count} JSON nodes and {depth} nesting levels are shown and searched.',
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
  promptStudioVariableName: 'Variable {index} name',
  promptStudioVariableValue: 'Variable {index} value',
  schemaViewerLimit: 'Only the first {count} schema nodes are shown.',
  subagentPanelLimit: 'Only the first {count} subagent runs are shown.',
  pollPause: 'Pause',
  pollResume: 'Resume',
  pollInactive: 'Inactive',
  pollRefreshing: 'Refreshing…',
  pollPaused: 'Paused',
  pollPausedAnnounce: 'Paused.',
  pollResumedAnnounce: 'Resumed.',
  pollRefreshingAnnounce: 'Refreshing now.',
  randomContentPause: 'Pause rotation',
  randomContentResume: 'Resume rotation',
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
  tokenInputEditWithContext: 'Edit {label}',
  commandPaletteLabel: 'Command palette',
  commandPalettePlaceholder: 'Search commands…',
  commandPaletteEmpty: 'No matching commands.',
  commandPaletteResults: 'Commands',
  iconButtonLabel: 'Button',
  codeEditorLabel: 'Code editor',
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
  contextMeterLabeledSummary: '{label}: {summary}',
  contextMeterSegmentLabel: '{label}: {count}',
  gaugeLabel: 'Gauge',
  gaugeValueLabel: '{label}: {value}',
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
  ebookViewerPreviousChapter: 'Previous chapter',
  ebookViewerNextChapter: 'Next chapter',
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
  contactViewerOrganization: 'Organization: {value}',
  contactViewerTypedValue: '{value} ({types})',
  contactViewerAddressFormat:
    '{poBox}\n{extendedAddress}\n{streetAddress}\n{locality} {region} {postalCode}\n{country}',
  contactViewerTypeHome: 'Home',
  contactViewerTypeWork: 'Work',
  contactViewerTypeCell: 'Mobile',
  contactViewerTypeVoice: 'Voice',
  contactViewerTypeFax: 'Fax',
  contactViewerTypeInternet: 'Internet',
  contactViewerTypePreferred: 'Preferred',
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
  chartValueLabel: '{label}: {value}',
  liteChartCustomMarkSummary: '{content} ({index} of {total})',
  composerLabel: 'Message',
  composerPlaceholder: 'Ask anything…',
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
  fileInputRejectedType: '{filename}: this file type is not accepted.',
  fileInputRejectedSize: '{filename}: this file is too large.',
  fileInputRejectedCount: '{filename}: only one file can be selected at a time.',
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
  threadGroupExpand: 'Expand {label}',
  threadGroupCollapse: 'Collapse {label}',
  pinConversation: 'Pin conversation',
  unpinConversation: 'Unpin conversation',
  archiveConversation: 'Archive conversation',
  unarchiveConversation: 'Unarchive conversation',
  deleteConversation: 'Delete conversation',
  searchThreads: 'Search conversations',
  threadListMatchAnnounce: '{count} conversation found',
  threadListMatchAnnouncePlural: '{count} conversations found',
  threadListEmpty: 'No conversations yet',
  agentWorkspaceLabel: 'Agent workspace',
  agentWorkspaceConversation: 'Conversation',
  agentWorkspaceDetails: 'Run details',
  agentWorkspaceRun: 'Agent run',
  agentWorkspaceTools: 'Tools',
  agentWorkspaceRetrieval: 'Retrieved context',
  agentWorkspaceGrounding: 'Grounding',
  agentWorkspaceContext: 'Context',
  agentWorkspaceEmpty: 'No messages yet',
  ragAnswerLabel: 'Grounded answer',
  ragAnswerCitations: 'Citations',
  ragAnswerSources: 'Sources',
  ragAnswerRetry: 'Retry answer',
  evaluationDashboardLabel: 'Evaluation dashboard',
  evaluationDashboardMetricLabel: 'Metric',
  evaluationDashboardRunsLabel: 'Evaluation runs',
  evaluationDashboardNoRuns: 'No evaluation runs yet',
  approvalQueueLabel: 'Tool approval queue',
  approvalQueueEmpty: 'No tool approvals pending',
  approvalQueueOpen: 'Review approval for {tool}',
  approvalQueuePendingCount: '{count} pending approvals',
  approvalQueuePending: 'Pending',
  embeddingExplorerLabel: 'Embedding explorer',
  embeddingExplorerEmpty: 'No embedding points',
  embeddingExplorerPoint: '{label}, embedding point {index}',
  knowledgeBaseAdminLabel: 'Knowledge base administration',
  knowledgeBaseAdminSourcesTab: 'Sources',
  knowledgeBaseAdminIngestionTab: 'Ingestion',
  resizeDivider: 'Resize divider between panel {a} and panel {b}',
  trendUnchanged: 'unchanged',
  trendIncreased: 'increased {value}%',
  trendDecreased: 'decreased {value}%',
  trendGoodSuffix: ', good',
  trendBadSuffix: ', bad',
  statTrendIncreased: 'increased {value}',
  statTrendDecreased: 'decreased {value}',
  statTrendGood: 'good',
  statTrendBad: 'bad',
  statTrendAnnouncement: '{trend}, {polarity}',
  streamStalled: 'Taking longer than usual…',
  streamStallAnnounce: 'Connection stalled.',
  streamRecoverAnnounce: 'Connection restored.',
  streamStallClearedAnnounce: 'No longer stalled.',
  thinkingPanelLabel: 'Thinking',
  messagePartsLabel: 'Message content',
  messagePartError: 'Part failed',
  messagePartRetry: 'Retry this part',
  promptQueueLabel: 'Queued prompts',
  promptQueueEmpty: 'No prompts queued',
  promptQueueSendNow: 'Send now',
  selectionToolbarLabel: 'Selection actions',
  selectionAsk: 'Ask',
  selectionQuote: 'Quote',
  selectionCite: 'Cite',
  promptInputLabel: 'AI prompt',
  promptInputControls: 'Prompt options',
  promptInputSources: 'Sources',
  promptInputAttachments: 'Attachments',
  mcpAppLabel: 'Interactive app',
  mcpAppUnavailable: 'This interactive app could not be loaded.',
  mcpAppLoading: 'Loading interactive app…',
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
  accessibleLabelSeparator: ' — ',
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
  widgetCollapse: 'Collapse panel',
  widgetExpand: 'Expand panel',
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
  emailViewerGroupAddress: '{name}: {members}',
  calendarViewerLabel: 'Calendar viewer',
  calendarViewerMissingParser: 'This viewer needs the optional "ical.js" package installed to parse this calendar.',
  calendarViewerEmpty: 'This calendar has no events.',
  calendarViewerNoSummary: '(no title)',
  pdfViewerLabel: 'PDF document',
  pdfViewerMissingLibrary: 'This viewer needs the optional "pdfjs-dist" package installed to render PDF files.',
  qrCodeMissingLibrary: 'This component needs the optional "qrcode" package installed to render QR codes.',
  qrCodeGenerationFailed: 'This value could not be encoded as a QR code.',
  mapMissingLibrary: 'This component needs the optional "maplibre-gl" package installed to render the map.',
  chartMissingLibrary: 'This component needs the optional "chart.js" package installed to render charts.',
  boxPlotMissingLibrary: 'This component needs the optional box-plot chart package installed to render box plots.',
  graphMissingLibrary: 'This component needs the optional "d3" package installed to render the graph.',
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
  traceTreeMetricLabel: '{label}: {value}',
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
  treeNodeMoved: 'Moved {label} to position {index} of {total}',
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
  browserFrameControllerAgent: 'Agent',
  browserFrameControllerUser: 'User',
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
  resultFieldLabel: '{label}:',
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
  flowConnectTarget: 'Connecting {source} to {target} ({index} of {total})',
  flowConnectCommitted: 'Connected {source} to {target}',
  flowConnectCancelled: 'Connection cancelled',
  zoomToFit: 'Zoom to fit',
  flowLockCanvas: 'Lock canvas',
  flowControlsLabel: 'Canvas controls',
  flowMinimapLabel: 'Workflow overview',
  flowMinimapViewport: 'Visible area',
  flowMinimapInstructions: 'Arrow keys pan. Plus and minus zoom. Enter or Home fits the workflow.',
  flowMinimapViewportChanged: 'Position {x}, {y}. Zoom {zoom}.',
  nodePaletteLabel: 'Node palette',
  nodePalettePlaceholder: 'Search nodes…',
  nodePaletteEmpty: 'No matching nodes.',
  nodePaletteDragHint: 'Drag to the canvas, or press Enter to place',
  nodePaletteResultCount: '{count} item',
  nodePaletteResultCountPlural: '{count} items',
  retrievalResultsSelectRow: 'Select {label}',
  pathStripLabel: 'Path',
  pathNodeStatus: '{label}, node {position} of {total}',
  pathRelationStatus: '{relation}, relation',
  flowInputHandle: 'Input {id}',
  flowOutputHandle: 'Output {id}',
  flowStatusWithDuration: '{status} ({duration})',
  flowStatusWithDetail: '{status} — {detail}',
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
  flowRunStatusCount: '{status}: {count}',
  policySummaryLabel: 'Policy decisions',
  policySummaryAllowCount: '{count} allowed',
  policySummaryDenyCount: '{count} denied',
  policySummaryNeedsReviewCount: '{count} needs review',
  policySummaryStateAllow: 'Allow',
  policySummaryStateDeny: 'Deny',
  policySummaryStateNeedsReview: 'Needs review',
  policySummaryCategoryGuardrail: 'Guardrail',
  policySummaryCategoryPermission: 'Permission',
  policySummaryCategoryPrivacy: 'Privacy',
  policySummaryCategoryTool: 'Tool',
  policySummaryDetailLabel: 'More detail',
  evalDatasetLabel: 'Evaluation examples',
  evalDatasetAddExample: 'Add example',
  evalDatasetRemoveExample: 'Remove example',
  evalDatasetImportLabel: 'Import examples',
  evalDatasetSearchLabel: 'Search examples',
  evalDatasetTagFilterLabel: 'Filter by tag',
  evalDatasetEmpty: 'No examples yet.',
  evalDatasetNoMatches: 'No examples match the current filters.',
  evalDatasetColumnInput: 'Input',
  evalDatasetColumnExpectedOutput: 'Expected output',
  evalDatasetColumnTags: 'Tags',
  queryBuilderLabel: 'Query builder',
  queryBuilderEmpty: 'No conditions yet.',
  queryBuilderNoFields: 'No fields available.',
  queryBuilderAddCondition: 'Add condition',
  queryBuilderRemoveCondition: 'Remove condition {index}',
  queryBuilderFieldLabel: 'Field',
  queryBuilderFieldPlaceholder: 'Select field',
  queryBuilderOperatorLabel: 'Operator',
  queryBuilderOperatorPlaceholder: 'Select operator',
  queryBuilderValueLabel: 'Value',
  queryBuilderValuePlaceholder: 'Select value',
  queryBuilderCombinatorLabel: 'Combine conditions with',
  queryBuilderCombinatorAnd: 'All conditions (AND)',
  queryBuilderCombinatorOr: 'Any condition (OR)',
  queryBuilderBooleanTrue: 'True',
  queryBuilderBooleanFalse: 'False',
  queryBuilderOperatorEquals: 'Equals',
  queryBuilderOperatorNotEquals: 'Does not equal',
  queryBuilderOperatorGreaterThan: 'Greater than',
  queryBuilderOperatorGreaterThanOrEqual: 'Greater than or equal to',
  queryBuilderOperatorLessThan: 'Less than',
  queryBuilderOperatorLessThanOrEqual: 'Less than or equal to',
  queryBuilderOperatorAfter: 'After',
  queryBuilderOperatorOnOrAfter: 'On or after',
  queryBuilderOperatorBefore: 'Before',
  queryBuilderOperatorOnOrBefore: 'On or before',
  queryBuilderOperatorContains: 'Contains',
  queryBuilderOperatorStartsWith: 'Starts with',
  queryBuilderOperatorEndsWith: 'Ends with',
  queryBuilderOperatorIn: 'Is any of',
  queryBuilderOperatorNotIn: 'Is none of',
  queryBuilderOperatorIsEmpty: 'Is empty',
  queryBuilderOperatorIsNotEmpty: 'Is not empty',
  memoryPanelLabel: 'Memory',
  memoryPanelShortTermHeading: 'Short-term context',
  memoryPanelLongTermHeading: 'Long-term memories',
  memoryPanelAdd: 'Add to long-term memory',
  memoryPanelAddWithContext: 'Add "{label}" to long-term memory',
  memoryPanelForgetAll: 'Forget all',
  memoryPanelConfirmAddHeading: 'Add this to long-term memory?',
  memoryPanelConfirmRemoveHeading: 'Remove this item?',
  memoryPanelConfirmForgetHeading: 'Forget all long-term memories?',
  memoryPanelConfirmForgetBody: 'This permanently forgets all {count} long-term memories.',
  graphExplorerLabel: 'Knowledge graph explorer',
  graphExplorerSearchPlaceholder: 'Search entities…',
  graphExplorerSearchResultsLabel: 'Search results',
  graphExplorerPin: 'Pin',
  graphExplorerUnpin: 'Unpin',
  graphExplorerPinned: '{label} pinned',
  graphExplorerUnpinned: '{label} unpinned',
  graphExplorerPinnedHeading: 'Pinned',
  graphExplorerFindPath: 'Find path',
  retrievalModeVector: 'Vector',
  retrievalModeKeyword: 'Keyword',
  retrievalModeHybrid: 'Hybrid',
  retrievalSearchLabel: 'Retrieval search',
  retrievalModeLabel: 'Search mode',
  retrievalFiltersLabel: 'Active filters',
  groundingSummaryLabel: 'Grounding summary',
  groundingSummaryEmpty: 'No grounding assessment available',
  groundingSummarySupportedLabel: 'Supported claims',
  groundingSummaryUnsupportedLabel: 'Unsupported claims',
  groundingSummaryCoverageLabel: 'Citation coverage',
  groundingSummaryConfidenceLabel: 'Confidence',
  groundingSummaryWarningsHeading: 'Warnings',
  groundingSummaryEvidenceHeading: 'Evidence',
  claimEvidenceLabel: 'Claim evidence',
  claimEvidenceEmpty: 'No claim-level evidence available',
  claimEvidenceSupported: 'Supported',
  claimEvidencePartiallySupported: 'Partially supported',
  claimEvidenceUnsupported: 'Unsupported',
  claimEvidenceContradicted: 'Contradicted',
  claimEvidenceConfidence: '{percent} confidence',
  retrievalCompareLabel: 'Retrieval comparison',
  retrievalCompareEmpty: 'No retrieval result sets to compare',
  retrievalCompareOverlap: 'Top-k overlap: {percent}',
  retrievalCompareRank: 'Rank {rank}',
  retrievalCompareDenseScore: 'Dense',
  retrievalCompareSparseScore: 'Sparse',
  retrievalCompareRerankScore: 'Rerank',
  retrievalCompareFinalScore: 'Final',
  ragEvalDashboardLabel: 'RAG evaluation dashboard',
  ragEvalDashboardEmpty: 'No evaluation runs available',
  ragEvalDashboardRuns: 'Evaluation runs',
  ragEvalDashboardSlices: 'Evaluation slices',
  ragEvalDashboardAllSlices: 'All',
  promptStudioLabel: 'Prompt studio',
  promptStudioMessages: 'Prompt messages',
  promptStudioVariables: 'Variables',
  promptStudioVersions: 'Versions',
  promptStudioPreview: 'Resolved preview',
  promptStudioRun: 'Run prompt',
  promptStudioSave: 'Save version',
  promptStudioAddMessage: 'Add message',
  promptStudioRemoveMessage: 'Remove message',
  promptStudioRoleSystem: 'System',
  promptStudioRoleUser: 'User',
  promptStudioRoleAssistant: 'Assistant',
  promptStudioRoleTool: 'Tool',
  schemaViewerLabel: 'Schema viewer',
  schemaViewerEmpty: 'No schema available',
  schemaViewerRequired: 'Required',
  schemaViewerCircular: 'Circular schema reference',
  schemaViewerType: 'Type: {type}',
  subagentPanelLabel: 'Subagents',
  subagentPanelEmpty: 'No subagent runs',
  subagentPanelCancel: 'Cancel subagent',
  subagentPanelRetry: 'Retry subagent',
  realtimeSessionLabel: 'Realtime session',
  realtimeSessionDisconnected: 'Disconnected',
  realtimeSessionConnecting: 'Connecting',
  realtimeSessionConnected: 'Connected',
  realtimeSessionReconnecting: 'Reconnecting',
  realtimeSessionError: 'Connection error',
  realtimeSessionConnect: 'Connect',
  realtimeSessionDisconnect: 'Disconnect',
  realtimeSessionMute: 'Mute microphone',
  realtimeSessionUnmute: 'Unmute microphone',
  realtimeSessionInterrupt: 'Interrupt response',
  realtimeSessionConnectionFailed: 'The realtime connection failed.',
  contextInspectorRedacted: 'Redacted',
  contextInspectorTruncated: 'Truncated',
  contextInspectorLabel: 'Context inspector',
  contextInspectorEmpty: 'No context segments',
  contextInspectorCopyLabel: 'Copy assembled context',
  knowledgeBaseSyncIdle: 'Idle',
  knowledgeBaseSyncSyncing: 'Syncing',
  knowledgeBaseSyncPaused: 'Paused',
  knowledgeBaseSyncSynced: 'Synced',
  knowledgeBaseSyncError: 'Error',
  knowledgeBaseHealthHealthy: 'Healthy',
  knowledgeBaseHealthDegraded: 'Degraded',
  knowledgeBaseHealthFailed: 'Failed',
  knowledgeBaseHealthUnknown: 'Unknown',
  knowledgeBasePermissionOwner: 'Owner',
  knowledgeBasePermissionEditor: 'Editor',
  knowledgeBasePermissionViewer: 'Viewer',
  knowledgeBasePermissionRestricted: 'Restricted',
  knowledgeBaseNeverSynced: 'Never synced',
  knowledgeBaseSyncAction: 'Sync now',
  knowledgeBasePauseAction: 'Pause sync',
  knowledgeBaseDeleteAction: 'Delete source',
  knowledgeBaseNameColumn: 'Source',
  knowledgeBaseSyncColumn: 'Sync status',
  knowledgeBaseHealthColumn: 'Indexing health',
  knowledgeBasePermissionColumn: 'Permission',
  knowledgeBaseActionsColumn: 'Actions',
  knowledgeBaseTotalSources: 'Sources',
  knowledgeBaseSyncedSources: 'Synced',
  knowledgeBaseSyncingSources: 'Syncing',
  knowledgeBaseNeedsAttention: 'Needs attention',
  knowledgeBaseHeading: 'Knowledge base',
  knowledgeBaseCreateSource: 'Add source',
  knowledgeBaseEmptyHeading: 'No knowledge sources yet',
  ingestionStageQueued: 'Queued',
  ingestionStageUploading: 'Uploading',
  ingestionStageExtracting: 'Extracting text',
  ingestionStageChunking: 'Chunking',
  ingestionStageEmbedding: 'Embedding',
  ingestionStageIndexing: 'Indexing',
  ingestionStageDone: 'Done',
  ingestionStageFailed: 'Failed',
  ingestionStageCancelled: 'Cancelled',
  ingestionQueueLabel: 'Ingestion queue',
  ingestionQueueEmpty: 'No documents queued',
  documentLibraryFreshnessFresh: 'Fresh',
  documentLibraryFreshnessAging: 'Aging',
  documentLibraryFreshnessStale: 'Stale',
  documentLibrarySelectAll: 'Select all documents',
  documentLibrarySelectColumn: 'Select',
  documentLibraryTypeColumn: 'Type',
  documentLibraryNameColumn: 'Name',
  documentLibraryVersionColumn: 'Version',
  documentLibraryOwnerColumn: 'Owner',
  documentLibraryTagsColumn: 'Tags',
  documentLibraryFreshnessColumn: 'Freshness',
  documentLibraryUpdatedColumn: 'Updated',
  documentLibraryLabel: 'Document library',
  documentLibraryEmptyHeading: 'No documents yet',
  documentLibraryNoMatchesHeading: 'No matching documents',
  documentLibrarySearchPlaceholder: 'Search documents',
  documentLibraryFilterByTag: 'Filter by tag',
  documentLibraryClearSelection: 'Clear selection',
  documentLibrarySelectedCount: '{count} selected',
  documentCompareNoVersion: 'No version provided.',
  documentCompareLabel: 'Document comparison',
  agentRunCurrentStepLabel: 'Current step',
  graphQueryHopRangeInvalid: 'Maximum hops must be at least the minimum.',
  graphQueryRelationshipTypeLabel: 'Relationship type',
  graphQueryNodeTypeLabel: 'Node type',
  graphQueryBuilderLabel: 'Graph query builder',
  graphQueryStartLabel: 'Start entity',
  graphQueryEndLabel: 'End entity',
  graphQueryMinHopsLabel: 'Minimum hops',
  graphQueryMaxHopsLabel: 'Maximum hops',
  graphQueryDirectionLabel: 'Direction',
  graphQueryRun: 'Run query',
  graphQuerySavedQueriesLabel: 'Saved queries',
  graphQuerySaveNameLabel: 'Query name',
  graphQuerySaveButton: 'Save query',
  graphQueryLoadWithContext: 'Load {name}',
  filterBarReset: 'Reset filters',
  filterBarActiveFilters: 'Active filters',
  drilldownDocuments: 'Documents',
  drilldownRuns: 'Agent runs',
  drilldownEmpty: 'No item selected',
  evaluationRunStatusIdle: 'Idle',
  evaluationRunStatusWaitingInput: 'Waiting for input',
  evaluationRunStatusWaitingApproval: 'Waiting for approval',
  evaluationRunStatusCancelled: 'Cancelled',
  evaluationRunGroundingHeading: 'Grounding',
  evaluationRunToolTraceHeading: 'Tool trace',
  evaluationRunInputHeading: 'Input',
  evaluationRunOutputHeading: 'Output',
  evaluationRunLabel: 'Evaluation run',
  evaluationRunProgressLabel: 'Evaluation batch progress',
  retrievalFilterChipLabel: '{key}: {value}',
  retrievalSearchEmptyDescription: 'Try a different search term or filters.',
  groundingSummaryEvidenceSpan: 'Characters {start}–{end}',
  contextInspectorTruncatedCount: 'Truncated — {count} tokens omitted',
  contextInspectorSegmentTokens: '{tokens} tokens',
  knowledgeBaseDocumentCount: '{count} indexed',
  knowledgeBaseRowActionsLabel: 'Actions for {name}',
  knowledgeBaseEmptyDescription: 'Add a source to start indexing content.',
  ingestionChunkCountPlural: '{count} chunks',
  ingestionChunkCount: '{count} chunk',
  ingestionItemProgressLabel: '{name} — {stage}',
  ingestionEmbeddedOfTotal: '{embedded} of {total} chunks embedded',
  ingestionAttemptCount: 'Attempt {count}',
  ingestionRetryWithContext: 'Retry {label}',
  ingestionCancelWithContext: 'Cancel {label}',
  documentLibrarySelectDocument: 'Select {name}',
  agentRunStatusAnnounce: 'Status: {status}.',
  graphQueryDeleteWithContext: 'Delete {name}',
  evaluationRunExampleLabel: 'Example {index}',
  evaluationRunExampleStartedAnnounce: '{label} started',
  evaluationRunExampleCompletedAnnounce: '{label} completed',
  evaluationRunExampleFailedAnnounce: '{label} failed',
  evaluationRunExampleCancelledAnnounce: '{label} cancelled',
  evaluationRunExampleWaitingInputAnnounce: '{label} needs input',
  evaluationRunExampleWaitingApprovalAnnounce: '{label} needs approval',
  evaluationRunProgressSummary: '{completed} of {total} examples complete',
  evaluationRunRunningCount: '{count} running',
  evaluationRunFailedCount: '{count} failed',
  retrievalStageQueryRewrite: 'Query rewrite',
  retrievalStageEmbed: 'Embed',
  retrievalStageRetrieve: 'Retrieve',
  retrievalStageRerank: 'Rerank',
  retrievalStageFilter: 'Filter',
  retrievalTraceEvidenceToggle: '{label} evidence',
  documentCompareOldVersion: 'Old version',
  documentCompareNewVersion: 'New version',
  agentRunStatusIdle: 'Idle',
  agentRunStatusQueued: 'Queued',
  agentRunStatusCollecting: 'Collecting context',
  agentRunStatusWaitingInput: 'Waiting for input',
  agentRunStatusWaitingApproval: 'Waiting for approval',
  agentRunStatusDone: 'Done',
  agentRunStatusCancelled: 'Cancelled',
  localePickerLabel: 'Language',
  localePickerRequired: 'Please choose a language.',
  moveUp: 'Move up',
  moveDown: 'Move down',
  reorderItemMoved: 'Moved to position {index} of {total}',
};

const locales = new Map<string, LyraLocaleStrings>();
const listeners = new Set<() => void>();
const registryListeners = new Set<() => void>();
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

/** Every locale with registered strings, plus 'en' (always available via DEFAULT_STRINGS even
 *  with no explicit registerLyraLocale('en', ...) call), sorted, deduped. */
export function getRegisteredLyraLocales(): string[] {
  const keys = new Set(['en', ...locales.keys()]);
  return [...keys].sort();
}

/** Subscribe to locale *registry membership* changes (a new locale registered) — distinct from
 *  subscribeLyraLocale(), which only fires for the currently *active* locale's string changes.
 *  Only a consumer that enumerates the registry (lr-locale-picker) needs this; every other
 *  component's rendered strings are unaffected by a registration for a locale it isn't using, so
 *  registerLyraLocale() must not force a global requestUpdate() on every mounted component just
 *  to reach the one picker that cares. */
export function subscribeLyraLocaleRegistry(listener: () => void): () => void {
  registryListeners.add(listener);
  return () => registryListeners.delete(listener);
}

/** Register or extend messages for a locale. */
export function registerLyraLocale(locale: string, strings: LyraLocaleStrings): void {
  const key = normalizeLocale(locale);
  if (!key) throw new TypeError('A locale is required.');
  locales.set(key, { ...(locales.get(key) ?? {}), ...strings });
  if (normalizeLocale(activeLocale) === key || normalizeLocale(activeLocale).startsWith(`${key}-`)) notify();
  for (const listener of [...registryListeners]) listener();
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
  const composedParent = (element: Element): Element | null => {
    if (element.parentElement) return element.parentElement;
    const root = element.getRootNode();
    return typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot ? root.host : null;
  };
  let parent = composedParent(host);
  while (parent) {
    const locale = parent.getAttribute('locale') || parent.getAttribute('lang');
    if (locale) return locale;
    parent = composedParent(parent);
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

/**
 * Returns the text around one rich localized interpolation. `interpolate` must resolve the
 * message through the normal localization values argument with its supplied marker as the rich
 * value. The marker is selected outside the translated template so repeated and omitted
 * placeholders remain well-defined without parsing a localization token by hand.
 */
export function resolveLocalizedParts(
  template: string,
  interpolate: (marker: string) => string,
): string[] {
  let marker = '\ue000';
  while (template.includes(marker)) marker += '\ue001';
  return interpolate(marker).split(marker);
}

export const LYRA_DEFAULT_STRINGS = DEFAULT_STRINGS;
