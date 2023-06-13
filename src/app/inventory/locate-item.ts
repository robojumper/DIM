import { EventBus } from 'app/utils/observable';
import type { DimItem } from './item-types';

export const locateItem$ = new EventBus<DimItem>();

/**
 * Bring an item into view and briefly highlight it. Used to pick out a particular instance of an item in the inventory view.
 */
export function locateItem(item: DimItem) {
  locateItem$.next(item);
}
