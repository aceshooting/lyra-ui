import type { LyraAccordion } from "./accordion.class.js";
import type {
  LyraAccordionAppearance,
  LyraAccordionHeadingLevel,
  LyraAccordionIconPlacement,
  LyraAccordionItem,
} from "./accordion-item.class.js";

export interface AccordionItemOwnerContext {
  readonly owner: LyraAccordion;
  readonly appearance: LyraAccordionAppearance;
  readonly headingLevel: LyraAccordionHeadingLevel;
  readonly iconPlacement: LyraAccordionIconPlacement;
  readonly requestTransition: (
    item: LyraAccordionItem,
    expanded: boolean,
    source: AccordionItemTransitionSource
  ) => boolean;
  readonly transitionSettled: (
    item: LyraAccordionItem,
    expanded: boolean
  ) => void;
  readonly stateChanged: (item: LyraAccordionItem) => void;
}

export type AccordionItemTransitionSource = "user" | "programmatic";

const owners = new WeakMap<LyraAccordionItem, AccordionItemOwnerContext>();
const stateControllers = new WeakMap<
  LyraAccordionItem,
  (expanded: boolean, announce: boolean) => Promise<void>
>();

export function registerAccordionItemStateController(
  item: LyraAccordionItem,
  controller: (expanded: boolean, announce: boolean) => Promise<void>
): void {
  stateControllers.set(item, controller);
}

export function applyAccordionItemOwnerState(
  item: LyraAccordionItem,
  expanded: boolean,
  announce: boolean
): Promise<void> {
  return stateControllers.get(item)?.(expanded, announce) ?? Promise.resolve();
}

export function bindAccordionItemOwner(
  item: LyraAccordionItem,
  context: AccordionItemOwnerContext
): void {
  owners.set(item, context);
  item.requestUpdate();
}

export function releaseAccordionItemOwner(
  item: LyraAccordionItem,
  owner: LyraAccordion
): void {
  if (owners.get(item)?.owner !== owner) return;
  owners.delete(item);
  item.requestUpdate();
}

export function accordionItemOwnerContext(
  item: LyraAccordionItem
): AccordionItemOwnerContext | undefined {
  return owners.get(item);
}

export function requestAccordionItemTransition(
  item: LyraAccordionItem,
  expanded: boolean,
  source: AccordionItemTransitionSource
): boolean | undefined {
  return owners.get(item)?.requestTransition(item, expanded, source);
}

export function notifyAccordionItemTransitionSettled(
  item: LyraAccordionItem,
  expanded: boolean
): void {
  owners.get(item)?.transitionSettled(item, expanded);
}

export function notifyAccordionItemStateChanged(item: LyraAccordionItem): void {
  owners.get(item)?.stateChanged(item);
}
