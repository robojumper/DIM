import 'app/dim-ui/EnergyMeterIncrements.scss';
import { t } from 'app/i18next-t';
import type { DimItem } from 'app/inventory/item-types';
import { MAX_ARMOR_ENERGY_CAPACITY } from 'app/search/d2-known-values';
import { clsx } from 'clsx';
import styles from './EnergyIncrements.m.scss';
import { PressTip } from './PressTip';

/** this accepts either an item, or a partial DimItem.energy */
function EnergyIncrements({
  item,
  energy,
}:
  | { item: DimItem; energy?: undefined }
  | {
      item?: undefined;
      energy: {
        energyCapacity: number;
        energyUsed: number;
      };
    }) {
  const { energyCapacity, energyUsed } = item?.energy ?? energy!;
  // layer in possible total slots, then earned slots, then currently used slots
  const meterIncrements = Array<string>(MAX_ARMOR_ENERGY_CAPACITY)
    .fill('unavailable')
    .fill('unused', 0, energyCapacity)
    .fill('used', 0, energyUsed);
  return (
    <div className={clsx('energyMeterIncrements', 'small')}>
      {meterIncrements.map((incrementStyle, i) => (
        <div key={i} className={incrementStyle} />
      ))}
    </div>
  );
}

export function EnergyIncrementsWithPresstip({
  energy,
  wrapperClass,
}: {
  energy: {
    energyCapacity: number;
    energyUsed: number;
  };
  wrapperClass?: string | undefined;
}) {
  const { energyCapacity, energyUsed } = energy;
  const energyUnused = Math.max(energyCapacity - energyUsed, 0);

  return (
    <PressTip
      tooltip={
        <>
          {t('EnergyMeter.Energy')}
          <hr />
          {t('EnergyMeter.Used')}: {energyUsed}
          <br />
          {t('EnergyMeter.Unused')}: {energyUnused}
          {energyUsed > energyCapacity && (
            <>
              <hr />
              {t('EnergyMeter.UpgradeNeeded', energy)}
            </>
          )}
        </>
      }
      className={wrapperClass}
    >
      <EnergyIncrements
        energy={{
          energyCapacity,
          energyUsed,
        }}
      />
      {energyUsed > energyCapacity && <EnergySwap energy={energy} />}
    </PressTip>
  );
}

/**
 * Shows how we recommend the energy of this armor be changed in order to fit its mods.
 */
function EnergySwap({ energy }: { energy: { energyCapacity: number; energyUsed: number } }) {
  const armorEnergyCapacity = energy.energyCapacity;
  const resultingEnergyCapacity = Math.max(energy.energyUsed, armorEnergyCapacity);

  const noEnergyChange = resultingEnergyCapacity === armorEnergyCapacity;

  return (
    <div className={clsx(styles.energySwapContainer, { [styles.energyHidden]: noEnergyChange })}>
      <div className={styles.energyValue}>
        <div
          className={clsx({
            [styles.masterworked]: armorEnergyCapacity === MAX_ARMOR_ENERGY_CAPACITY,
          })}
        >
          {armorEnergyCapacity}
        </div>
      </div>
      <div className={styles.arrow}>➜</div>
      <div className={styles.energyValue}>
        <div
          className={clsx({
            [styles.masterworked]: resultingEnergyCapacity === MAX_ARMOR_ENERGY_CAPACITY,
          })}
        >
          {resultingEnergyCapacity}
        </div>
      </div>
    </div>
  );
}
