/**
 * The message keys used by Lyra's built-in labels. Applications can register
 * additional keys as well; components may use a component-specific key when
 * a message is not part of this common set.
 */
export type LyraMessageKey =
  | 'noData'
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
  | 'copyDiff'
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
  | 'thoughtFor'
  | 'thinking'
  | 'rangeStart'
  | 'rangeEnd'
  | 'closeWithContext'
  | 'toolApprovalHeading'
  | 'toolApprovalGenericTool'
  | 'toolApprovalArgsLabel'
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
  | 'gitStatusIgnored';

export type LyraLocaleStrings = Partial<Record<LyraMessageKey, string>> & Record<string, string | undefined>;

const DEFAULT_STRINGS: Record<LyraMessageKey, string> = {
  noData: 'No data',
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
  copiedToClipboard: 'Copied! to clipboard',
  codeRegion: 'Code',
  codeRegionWithLanguage: '{language} code',
  copyDiff: 'Copy diff',
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
  thoughtFor: 'Thought for {duration}',
  thinking: 'Thinking…',
  rangeStart: 'Range start',
  rangeEnd: 'Range end',
  closeWithContext: 'Close: {snippet}',
  toolApprovalHeading: 'Approve {tool} call?',
  toolApprovalGenericTool: 'tool',
  toolApprovalArgsLabel: 'Tool call arguments (JSON)',
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

/** Resolve the locale inherited by a component host. */
export function resolveLyraLocale(host: Element): string {
  return inheritedLocale(host);
}

/** Resolve the direction inherited by a component host. */
export function resolveLyraDirection(host: Element): 'ltr' | 'rtl' {
  const explicit = host.getAttribute('dir');
  if (explicit === 'rtl' || explicit === 'ltr') return explicit;
  if (typeof getComputedStyle === 'function') return getComputedStyle(host).direction === 'rtl' ? 'rtl' : 'ltr';
  return 'ltr';
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
