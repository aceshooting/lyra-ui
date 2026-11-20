/** How raw HTML inside Markdown source is treated. */
export type MarkdownHtmlMode = 'sanitize' | 'escape' | 'trusted';
/** Whether a streaming Markdown tail renders as plain text or as progressively parsed blocks. */
export type MarkdownStreamingRender = 'plain' | 'progressive';
