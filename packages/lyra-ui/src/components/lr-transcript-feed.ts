export * from './conversation/transcript-feed/transcript-feed.class.js';
import { LyraTranscriptFeed } from './conversation/transcript-feed/transcript-feed.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('transcript-feed', LyraTranscriptFeed);
