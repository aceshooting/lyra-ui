import type { DocxSession, DocxSnapshot } from '@aceshooting/lyra-docs/docx';
// @ts-expect-error DOCX-specific contracts belong to the format subpath.
import type { DocxSession as RootSession } from '@aceshooting/lyra-docs';
// @ts-expect-error The internal factory is not public.
import { createInternalDocxSession } from '@aceshooting/lyra-docs/docx';
// @ts-expect-error No runtime factory exists before adapter qualification.
import { createDocxSession } from '@aceshooting/lyra-docs/docx';
// @ts-expect-error Internal engine injection is not an export.
import type { DocxSessionPort } from '@aceshooting/lyra-docs/docx/engine-port';

export type ExportWitness = [DocxSession, DocxSnapshot, RootSession, DocxSessionPort];
void createInternalDocxSession;
void createDocxSession;
