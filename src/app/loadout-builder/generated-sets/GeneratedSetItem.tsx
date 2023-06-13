import { EnergyIncrementsWithPresstip } from 'app/dim-ui/EnergyIncrements';
import { t } from 'app/i18next-t';
import { showItemPicker } from 'app/item-picker/item-picker';
import Sockets from 'app/loadout/loadout-ui/Sockets';
import { AppIcon, faRandom, lockIcon } from 'app/shell/icons';
import { PlugCategoryHashes } from 'data/d2/generated-enums';
import type { Dispatch } from 'react';
import type { DimItem, PluggableInventoryItemDefinition } from '../../inventory/item-types';
import LoadoutBuilderItem from '../LoadoutBuilderItem';
import type { LoadoutBuilderAction } from '../loadout-builder-reducer';
import styles from './GeneratedSetItem.m.scss';

/**
 * An individual item in a generated set. Includes a perk display and a button for selecting
 * alternative items with the same stat mix.
 */
export default function GeneratedSetItem({
  item,
  pinned,
  itemOptions,
  assignedMods,
  automaticallyPickedMods,
  energy,
  lbDispatch,
}: {
  item: DimItem;
  pinned: boolean;
  itemOptions: DimItem[];
  assignedMods?: PluggableInventoryItemDefinition[];
  automaticallyPickedMods?: number[];
  energy: { energyCapacity: number; energyUsed: number };
  lbDispatch: Dispatch<LoadoutBuilderAction>;
}) {
  const pinItem = (item: DimItem) => lbDispatch({ type: 'pinItem', item });
  const unpinItem = () => lbDispatch({ type: 'unpinItem', item });

  const chooseReplacement = async () => {
    const ids = new Set(itemOptions.map((i) => i.id));

    try {
      const { item } = await showItemPicker({
        prompt: t('LoadoutBuilder.ChooseAlternateTitle'),
        filterItems: (item: DimItem) => ids.has(item.id),
      });

      pinItem(item);
    } catch (e) {}
  };

  const onSocketClick = (
    plugDef: PluggableInventoryItemDefinition,
    plugCategoryHashWhitelist?: number[]
  ) => {
    const { plugCategoryHash } = plugDef.plug;

    if (plugCategoryHash === PlugCategoryHashes.Intrinsics) {
      // Legendary armor can have intrinsic perks and it might be
      // nice to provide a convenient user interface for those,
      // but the exotic picker is not the way to do it.
      if (item.isExotic) {
        lbDispatch({ type: 'lockExotic', lockedExoticHash: item.hash });
      }
    } else if (plugCategoryHash !== PlugCategoryHashes.EnhancementsArtifice) {
      lbDispatch({
        type: 'openModPicker',
        plugCategoryHashWhitelist,
      });
    }
  };

  return (
    <div>
      <div className={styles.item}>
        <div className={styles.swapButtonContainer}>
          <LoadoutBuilderItem item={item} onShiftClick={() => pinItem(item)} />
          <EnergyIncrementsWithPresstip wrapperClass={styles.energyMeter} energy={energy} />
          {itemOptions.length > 1 ? (
            <button
              type="button"
              className={styles.swapButton}
              title={t('LoadoutBuilder.ChooseAlternateTitle')}
              onClick={chooseReplacement}
            >
              <AppIcon icon={faRandom} />
            </button>
          ) : (
            pinned && (
              <button
                type="button"
                className={styles.swapButton}
                title={t('LoadoutBuilder.UnlockItem')}
                onClick={unpinItem}
              >
                <AppIcon icon={lockIcon} />
              </button>
            )
          )}
        </div>
        <Sockets
          item={item}
          lockedMods={assignedMods}
          automaticallyPickedMods={automaticallyPickedMods}
          onSocketClick={onSocketClick}
          size="small"
        />
      </div>
    </div>
  );
}
