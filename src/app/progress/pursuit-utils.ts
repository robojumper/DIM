import type { DimItem } from 'app/inventory/item-types';
import { chainComparator, compareBy } from 'app/utils/comparators';

const defaultExpirationDate = new Date(8640000000000000);

export const sortPursuits = chainComparator(
  compareBy(showPursuitAsExpired),
  compareBy((item) => !item.tracked),
  compareBy((item) => item.complete),
  compareBy((item) => (item.pursuit?.expirationDate || defaultExpirationDate).getTime()),
  compareBy((item) => item.typeName),
  compareBy((item) => item.icon),
  compareBy((item) => item.name)
);

/**
 * Should this item be displayed as expired (no longer completable)?
 */
export function showPursuitAsExpired(item: DimItem) {
  // Suppress description when expiration is shown
  const suppressExpiration =
    item.pursuit?.suppressExpirationWhenObjectivesComplete && item.complete;

  const expired =
    !suppressExpiration && item.pursuit?.expirationDate
      ? item.pursuit.expirationDate.getTime() < Date.now()
      : false;

  return expired;
}
