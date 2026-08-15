import type { LyraAppearance } from "../../../internal/variants.js";

export type LyraAccordionIconPlacement = "start" | "end";

/** A heading level string. Values other than 1–6 and `none` render the documented h3 fallback. */
export type LyraAccordionHeadingLevel = string;

export type LyraAccordionAppearance = Exclude<LyraAppearance, "accent">;

export type AccordionItemTransitionSource = "user" | "programmatic";

/** Minimal structural contract used by the owner registry to avoid loading either component. */
export interface AccordionItemOwnerHost {
  requestUpdate(): void;
}

export interface AccordionItemOwnerContext<
  TItem extends AccordionItemOwnerHost = AccordionItemOwnerHost,
  TOwner extends object = object
> {
  readonly owner: TOwner;
  readonly appearance: LyraAccordionAppearance;
  readonly headingLevel: LyraAccordionHeadingLevel;
  readonly iconPlacement: LyraAccordionIconPlacement;
  readonly requestTransition: (
    item: TItem,
    expanded: boolean,
    source: AccordionItemTransitionSource
  ) => boolean;
  readonly transitionSettled: (item: TItem, expanded: boolean) => void;
  readonly stateChanged: (item: TItem) => void;
}
