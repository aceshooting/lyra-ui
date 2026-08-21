import type {
  AccordionItemOwnerContext,
  AccordionItemOwnerHost,
  AccordionItemTransitionSource,
} from './accordion-types.js';

export type {
  AccordionItemOwnerContext,
  AccordionItemTransitionSource,
} from './accordion-types.js';

const owners = new WeakMap<object, unknown>();
const stateControllers = new WeakMap<object, unknown>();

function ownerContext<TItem extends AccordionItemOwnerHost, TOwner extends object>(
  item: TItem
): AccordionItemOwnerContext<TItem, TOwner> | undefined {
  return owners.get(item) as
    | AccordionItemOwnerContext<TItem, TOwner>
    | undefined;
}

export function registerAccordionItemStateController<
  TItem extends AccordionItemOwnerHost
>(
  item: TItem,
  controller: (expanded: boolean, announce: boolean) => Promise<void>
): void {
  stateControllers.set(item, controller);
}

export function applyAccordionItemOwnerState<
  TItem extends AccordionItemOwnerHost
>(
  item: TItem,
  expanded: boolean,
  announce: boolean
): Promise<void> {
  const controller = stateControllers.get(item) as
    | ((expanded: boolean, announce: boolean) => Promise<void>)
    | undefined;
  return controller?.(expanded, announce) ?? Promise.resolve();
}

export function bindAccordionItemOwner<
  TItem extends AccordionItemOwnerHost,
  TOwner extends object
>(
  item: TItem,
  context: AccordionItemOwnerContext<TItem, TOwner>
): void {
  owners.set(item, context);
  item.requestUpdate();
}

export function releaseAccordionItemOwner<
  TItem extends AccordionItemOwnerHost,
  TOwner extends object
>(
  item: TItem,
  owner: TOwner
): void {
  if (ownerContext<TItem, TOwner>(item)?.owner !== owner) return;
  owners.delete(item);
  item.requestUpdate();
}

export function accordionItemOwnerContext<TItem extends AccordionItemOwnerHost>(
  item: TItem
): AccordionItemOwnerContext<TItem> | undefined {
  return ownerContext<TItem, object>(item);
}

export function requestAccordionItemTransition<
  TItem extends AccordionItemOwnerHost
>(
  item: TItem,
  expanded: boolean,
  source: AccordionItemTransitionSource
): boolean | undefined {
  return ownerContext<TItem, object>(item)?.requestTransition(
    item,
    expanded,
    source
  );
}

export function notifyAccordionItemTransitionSettled<
  TItem extends AccordionItemOwnerHost
>(
  item: TItem,
  expanded: boolean
): void {
  ownerContext<TItem, object>(item)?.transitionSettled(item, expanded);
}

export function notifyAccordionItemStateChanged<
  TItem extends AccordionItemOwnerHost
>(item: TItem): void {
  ownerContext<TItem, object>(item)?.stateChanged(item);
}
