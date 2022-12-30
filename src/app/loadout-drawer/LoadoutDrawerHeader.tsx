import ClassIcon from 'app/dim-ui/ClassIcon';
import SymbolsPicker from 'app/dim-ui/destiny-symbols/SymbolsPicker';
import { useAutocomplete } from 'app/dim-ui/tags-autocomplete';
import { t } from 'app/i18next-t';
import React, { useRef, useState } from 'react';
import { Loadout } from './loadout-types';
import styles from './LoadoutDrawerHeader.m.scss';
import { loadoutsHashtagsSelector } from './selectors';

export default function LoadoutDrawerHeader({
  loadout,
  onNameChanged,
}: {
  loadout: Readonly<Loadout>;
  onNameChanged(name: string): void;
}) {
  const setName = (e: React.ChangeEvent<HTMLInputElement>) => onNameChanged(e.target.value);
  const inputRef = useRef<HTMLInputElement>(null);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);

  useAutocomplete(inputRef, loadoutsHashtagsSelector);

  return (
    <div className={styles.loadoutName}>
      <ClassIcon classType={loadout.classType} />
      <div className={styles.dimInput}>
        <input
          className={styles.dimInput}
          name="name"
          ref={inputRef}
          onChange={setName}
          minLength={1}
          maxLength={50}
          required={true}
          autoComplete="off"
          type="text"
          value={loadout.name}
          onBlur={() => setInsertionIndex(inputRef.current!.selectionStart ?? null)}
          placeholder={t('Loadouts.LoadoutName')}
        />
        <SymbolsPicker
          input={inputRef}
          setValue={onNameChanged}
          insertionIndex={insertionIndex}
          setInsertionIndex={setInsertionIndex}
        />
      </div>
    </div>
  );
}
