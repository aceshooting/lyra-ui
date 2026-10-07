import { LyraElement } from '../src/internal/lyra-element.js';
import { DocumentAnchorTarget, type LyraAnchorTargetEventMap } from '../src/internal/anchor-target.js';
import { TextViewerTarget, type LyraTextViewerTargetEventMap } from '../src/internal/text-viewer-target.js';
import type { LyraAnchor } from '../src/components/viewers/document-viewer/anchors.js';
import type { TextQuoteScope } from '../src/internal/text-quote.js';

class AnchorBase extends LyraElement<LyraAnchorTargetEventMap> {
  static readonly marker = 'anchor';
  protected baseHook(): string { return 'base'; }
}

export class AnchorHookProbe extends DocumentAnchorTarget(AnchorBase) {
  protected override selectionShadowRoots(root: Element): ShadowRoot[] {
    return super.selectionShadowRoots(root);
  }
  protected override bindTextSelection(root: Element): void {
    super.bindTextSelection(root);
    this.unbindTextSelection();
  }
  protected override computeSelectionAnchor(range: Range, text: string): LyraAnchor | null {
    return super.computeSelectionAnchor(range, text);
  }
  protected override baseHook(): string { return super.baseHook(); }
}

class TextBase extends LyraElement<LyraTextViewerTargetEventMap> {}

export class TextHookProbe extends TextViewerTarget(TextBase) {
  protected override buildTextScope(root: Element): TextQuoteScope {
    return super.buildTextScope(root);
  }
  protected override textContentRoot(): Element | null { return super.textContentRoot(); }
}

export const inheritedStatic: 'anchor' = AnchorHookProbe.marker;
export function protectedHooksStayInternal(anchor: AnchorHookProbe, text: TextHookProbe): void {
  // @ts-expect-error Selection listener ownership stays protected.
  anchor.unbindTextSelection();
  // @ts-expect-error Text scope construction stays protected.
  text.buildTextScope(document.body);
}
