import type { LyraDropZoneFilesDetail, LyraDropZoneRejectedFile } from '../src/components/media/drop-zone/drop-zone.class.js';
import type { LyraFileInputFilesDetail, LyraFileInputRejectedFile } from '../src/components/media/file-input/file-input.class.js';

declare module '../src/internal/file-accept.js' {
  interface FileIntakeRejected { readonly applicationIncidentId?: string }
}
declare module '../src/internal/file-intake.js' {
  interface FileIntakeDetail { readonly applicationBatchId?: string }
}

type Assert<T extends true> = T;
export type IndependentRejection = Assert<'applicationIncidentId' extends
  keyof LyraDropZoneRejectedFile | keyof LyraFileInputRejectedFile ? false : true>;
export type IndependentDetail = Assert<'applicationBatchId' extends
  keyof LyraDropZoneFilesDetail | keyof LyraFileInputFilesDetail ? false : true>;
