/** A one-use document-bound reservation for a deferred overlay's activation order. */
export type OverlayOrderReservation = (document: Document) => number | undefined;

const nextOrders = new WeakMap<Document, number>();

function nextOrder(document: Document): number {
  const order = nextOrders.get(document) ?? 0;
  nextOrders.set(document, order + 1);
  return order;
}

/** Reserves shared ordering before a first-open runtime starts loading. */
export function reserveOverlayOrder(document: Document): OverlayOrderReservation {
  let order: number | undefined = nextOrder(document);
  return (destination) => {
    const reserved = destination === document ? order : undefined;
    order = undefined;
    return reserved;
  };
}

/** Consumes a matching reservation once; ordinary activation or adoption receives a new order. */
export function takeOverlayOrder(document: Document, reservation?: OverlayOrderReservation): number {
  return reservation?.(document) ?? nextOrder(document);
}
