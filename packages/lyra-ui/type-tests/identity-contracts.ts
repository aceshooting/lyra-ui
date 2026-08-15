import type { LyraCommand } from '../src/components/layout/command-palette/command-palette.class.js';

const command: LyraCommand = { commandId: 'save', label: 'Save' };

// @ts-expect-error command identity uses the domain-specific commandId name.
const legacyCommand: LyraCommand = { id: 'save', label: 'Save' };

void command;
void legacyCommand;
