import { AssumeArmorMasterwork } from '@destinyitemmanager/dim-api-types';
import type { Option } from 'app/dim-ui/RadioButtons';
import RadioButtons from 'app/dim-ui/RadioButtons';
import { t } from 'app/i18next-t';
import type { Dispatch } from 'react';
import { useCallback, useMemo } from 'react';
import type { LoadoutBuilderAction } from '../loadout-builder-reducer';
import styles from './EnergyOptions.m.scss';

export default function EnergyOptions({
  assumeArmorMasterwork,
  lbDispatch,
}: {
  assumeArmorMasterwork: AssumeArmorMasterwork | undefined;
  lbDispatch: Dispatch<LoadoutBuilderAction>;
}) {
  const assumeMasterworkOptions: Option<AssumeArmorMasterwork>[] = useMemo(
    () => [
      {
        label: t('LoadoutBuilder.None'),
        tooltip: t('LoadoutBuilder.AssumeMasterworkOptions.None'),
        value: AssumeArmorMasterwork.None,
      },
      {
        label: t('LoadoutBuilder.Legendary'),
        tooltip: t('LoadoutBuilder.AssumeMasterworkOptions.Legendary'),
        value: AssumeArmorMasterwork.Legendary,
      },
      {
        label: t('LoadoutBuilder.All'),
        tooltip: t('LoadoutBuilder.AssumeMasterworkOptions.All'),
        value: AssumeArmorMasterwork.All,
      },
    ],
    []
  );

  const handleChange = useCallback(
    (assumeArmorMasterwork: AssumeArmorMasterwork) => {
      lbDispatch({
        type: 'assumeArmorMasterworkChanged',
        assumeArmorMasterwork,
      });
    },
    [lbDispatch]
  );

  return (
    <div className={styles.energyOptions}>
      <div className={styles.settingGroup}>
        <div className={styles.title}>{t('LoadoutBuilder.AssumeMasterwork')}</div>
        <RadioButtons
          value={assumeArmorMasterwork ?? AssumeArmorMasterwork.None}
          onChange={handleChange}
          options={assumeMasterworkOptions}
        />
      </div>
    </div>
  );
}
