export * from './data/chord/chord.class.js';
import { LyraChord } from './data/chord/chord.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('chord', LyraChord);
