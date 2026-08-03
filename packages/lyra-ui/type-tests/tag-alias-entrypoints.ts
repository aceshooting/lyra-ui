import type { LyraInput } from '../src/components/lr-input.js';
import type { LyraTable } from '../src/components/lr-table.js';

declare const input: LyraInput;
declare const table: LyraTable;

input.value = 'ready';
table.focus();
