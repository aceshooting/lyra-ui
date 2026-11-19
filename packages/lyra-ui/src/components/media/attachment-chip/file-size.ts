import { FILE_SIZE_UNIT_KEYS as unitKeys, type FileSizeUnit } from '../../../internal/bytes.js';

export { formatFileSize, localizedNumberLabel } from '../../../internal/bytes.js';

/** Maps each byte-unit abbreviation to its localization key. */
export const FILE_SIZE_UNIT_KEYS: Record<FileSizeUnit, string> = unitKeys;
